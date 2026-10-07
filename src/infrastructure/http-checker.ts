import type { HttpCheckerRepository } from '#domain/repositories/http-checker.repository.js';
import type { CheckResult } from '#domain/value-objects/check-result.value-object.js';
import type { ContentValidation } from '#domain/value-objects/content-validation.value-object.js';

const USER_AGENT = 'Website-Monitor/1.0';

/** Maximum number of same-origin assets verified per page when checkAssets is enabled */
const MAX_ASSETS_PER_PAGE = 5;

const DIRECTORY_LISTING_PATTERNS = [
    /<title>\s*Index of \//i,
    /<h1>\s*Index of \//i
];

/**
 * HttpChecker - Implementation of HTTP health checking
 *
 * Performs HTTP GET requests to check service availability and validates
 * response content according to specified rules. Uses native fetch API
 * with a single timeout (AbortSignal.timeout) that covers response headers,
 * body download and asset verification.
 */
export class HttpChecker implements HttpCheckerRepository {
    /**
     * Creates a new HttpChecker instance
     * @param timeout - Maximum time in milliseconds for the whole check (default: 10000)
     */
    constructor(private readonly timeout: number = 10000) {}

    /**
     * Checks if a service is available and responding correctly
     *
     * Performs the following checks:
     * 1. Makes HTTP GET request with timeout
     * 2. Validates HTTP status code
     * 3. Optionally validates response content
     *
     * @param url - The URL to check
     * @param contentValidation - Optional content validation rules
     * @returns Promise resolving to check result with status and metrics
     */
    async check(url: string, contentValidation?: ContentValidation): Promise<CheckResult> {
        const startTime = Date.now();
        const signal = AbortSignal.timeout(this.timeout);

        try {
            const response = await fetch(url, {
                method: 'GET',
                signal,
                headers: { 'User-Agent': USER_AGENT }
            });

            // Check if HTTP status indicates an error
            if (!response.ok) {
                await response.body?.cancel();

                return {
                    success: false,
                    statusCode: response.status,
                    message: `Service returned error status ${response.status}`,
                    timestamp: new Date(),
                    responseTime: Date.now() - startTime
                };
            }

            // Read response content for validation (still covered by the timeout signal)
            const content = await response.text();

            // Validate content if rules are specified
            if (contentValidation) {
                const contentIssue = await this.validateContent(
                    content,
                    response.url || url,
                    contentValidation,
                    signal
                );

                if (contentIssue) {
                    return {
                        success: false,
                        statusCode: response.status,
                        message: contentIssue,
                        timestamp: new Date(),
                        responseTime: Date.now() - startTime
                    };
                }
            }

            // Success - service is up and content is valid
            return {
                success: true,
                statusCode: response.status,
                message: `Service is up (${response.status})`,
                timestamp: new Date(),
                responseTime: Date.now() - startTime
            };
        } catch (error) {
            return {
                success: false,
                message: this.describeError(error),
                timestamp: new Date(),
                responseTime: Date.now() - startTime
            };
        }
    }

    /**
     * Builds a readable message from a fetch/abort error
     * @param error - The thrown value
     */
    private describeError(error: unknown): string {
        if (error instanceof Error) {
            if (error.name === 'TimeoutError') {
                return `Request timed out after ${this.timeout}ms`;
            }

            // Node's fetch hides the real reason (ENOTFOUND, ECONNREFUSED, cert errors) in `cause`
            const cause = (error as Error & { cause?: { code?: string } }).cause;
            return cause?.code ? `${error.message} (${cause.code})` : error.message;
        }

        return 'Unknown error occurred';
    }

    /**
     * Validates response content against specified rules
     *
     * Rules are evaluated in this order: forbidden text, directory listing,
     * expected title, assets. The first failing rule is reported.
     *
     * @param content - HTML/text content to validate
     * @param pageUrl - Final URL of the page (after redirects), used to resolve assets
     * @param validation - Validation rules to apply
     * @param signal - Abort signal shared with the main request
     * @returns Error message if validation fails, null if content is valid
     */
    private async validateContent(
        content: string,
        pageUrl: string,
        validation: ContentValidation,
        signal: AbortSignal
    ): Promise<string | null> {
        // Default server pages, soft 404s and similar
        for (const text of validation.forbiddenText ?? []) {
            if (content.toLowerCase().includes(text.toLowerCase())) {
                return `Forbidden text found in page: "${text}"`;
            }
        }

        // Directory listing (indicates missing website files)
        if (validation.checkForDirectoryListing) {
            if (DIRECTORY_LISTING_PATTERNS.some(pattern => pattern.test(content))) {
                return 'Directory listing detected (Index of) - site files missing';
            }
        }

        if (validation.expectedTitle) {
            const title = this.extractTitle(content);

            if (!title.toLowerCase().includes(validation.expectedTitle.toLowerCase())) {
                return `Unexpected page title "${title}" (expected to contain "${validation.expectedTitle}")`;
            }
        }

        if (validation.checkAssets) {
            return await this.validateAssets(content, pageUrl, signal);
        }

        return null;
    }

    /**
     * Extracts the text of the <title> tag
     * @param html - HTML content
     * @returns Trimmed title with collapsed whitespace, or an empty string if missing
     */
    private extractTitle(html: string): string {
        const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        return match ? match[1].replace(/\s+/g, ' ').trim() : '';
    }

    /**
     * Verifies that same-origin scripts and stylesheets referenced by the page respond OK.
     * Catches pages that return 200 but whose application bundle is missing (blank screen).
     *
     * @param html - HTML of the page
     * @param pageUrl - Final URL of the page, used to resolve relative references
     * @param signal - Abort signal shared with the main request
     * @returns Error message if any asset fails, null otherwise
     */
    private async validateAssets(html: string, pageUrl: string, signal: AbortSignal): Promise<string | null> {
        const assetUrls = this.extractAssetUrls(html, pageUrl);
        const origin = new URL(pageUrl).origin;

        const failures = (await Promise.all(assetUrls.map(async assetUrl => {
            const label = assetUrl.replace(origin, '');

            try {
                const response = await fetch(assetUrl, {
                    method: 'HEAD',
                    signal,
                    headers: { 'User-Agent': USER_AGENT }
                });

                return response.ok ? null : `${label} (${response.status})`;
            } catch (error) {
                if (error instanceof Error && error.name === 'TimeoutError') {
                    throw error;
                }

                return `${label} (${this.describeError(error)})`;
            }
        }))).filter((failure): failure is string => failure !== null);

        return failures.length > 0 ? `Failed to load assets: ${failures.join(', ')}` : null;
    }

    /**
     * Extracts same-origin script and stylesheet URLs from HTML
     * @param html - HTML content
     * @param pageUrl - Base URL used to resolve relative references
     * @returns Absolute URLs (deduplicated, limited to MAX_ASSETS_PER_PAGE)
     */
    private extractAssetUrls(html: string, pageUrl: string): string[] {
        const base = new URL(pageUrl);
        const urls = new Set<string>();

        for (const [, tag, attributes] of html.matchAll(/<(script|link)\b([^>]*)>/gi)) {
            const isScript = tag.toLowerCase() === 'script';
            const reference = this.getAttribute(attributes, isScript ? 'src' : 'href');

            if (!reference) continue;

            if (!isScript && !/\b(stylesheet|modulepreload)\b/i.test(this.getAttribute(attributes, 'rel') ?? '')) {
                continue;
            }

            try {
                const resolved = new URL(reference, base);

                if (resolved.origin === base.origin) {
                    resolved.hash = '';
                    urls.add(resolved.toString());
                }
            } catch {
                // Ignore references that cannot be parsed as URLs
            }
        }

        return [...urls].slice(0, MAX_ASSETS_PER_PAGE);
    }

    /**
     * Reads an attribute value from the inside of an HTML tag
     * @param attributes - Raw attribute string
     * @param name - Attribute name
     */
    private getAttribute(attributes: string, name: string): string | null {
        const match = attributes.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'));
        return match ? (match[1] ?? match[2]) : null;
    }
}
