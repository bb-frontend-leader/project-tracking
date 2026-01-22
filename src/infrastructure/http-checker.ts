import { envs } from '../config/plugins/env.plugin.js';

import type { HttpCheckerRepository } from '#domain/repositories/http-checker.repository.js';
import type { CheckResult } from '#domain/value-objects/check-result.value-object.js';
import type { ContentValidation } from '#domain/value-objects/content-validation.value-object.js';

/**
 * HttpChecker - Implementation of HTTP health checking
 * 
 * Performs HTTP GET requests to check service availability and validates
 * response content according to specified rules. Uses native fetch API
 * with timeout control via AbortController.
 */
export class HttpChecker implements HttpCheckerRepository {
    private timeout: number;

    /**
     * Creates a new HttpChecker instance
     * @param timeout - Request timeout in milliseconds (default: 10000)
     */
    constructor(timeout: number = 10000) {
        this.timeout = envs.HTTP_TIMEOUT || timeout;
    }

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

        try {
            // Setup timeout control
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);

            // Perform HTTP GET request with custom User-Agent
            const response = await fetch(url, {
                method: 'GET',
                signal: controller.signal,
                headers: {
                    'User-Agent': 'Website-Monitor/1.0'
                }
            });

            clearTimeout(timeoutId);
            const responseTime = Date.now() - startTime;

            // Check if HTTP status indicates an error
            if (!response.ok) {
                return {
                    success: false,
                    statusCode: response.status,
                    message: `Service returned error status ${response.status}`,
                    timestamp: new Date(),
                    responseTime
                };
            }

            // Read response content for validation
            const content = await response.text();

            // Validate content if rules are specified
            if (contentValidation) {
                const contentIssue = this.validateContent(content, contentValidation);

                if (contentIssue) {
                    return {
                        success: false,
                        statusCode: response.status,
                        message: contentIssue,
                        timestamp: new Date(),
                        responseTime
                    };
                }
            }

            // Success - service is up and content is valid
            return {
                success: true,
                statusCode: response.status,
                message: `Service is up (${response.status})`,
                timestamp: new Date(),
                responseTime
            };
        } catch (error) {
            const responseTime = Date.now() - startTime;

            return {
                success: false,
                message: error instanceof Error ? error.message : 'Unknown error occurred',
                timestamp: new Date(),
                responseTime
            };
        }
    }

    /**
     * Validates response content against specified rules
     * 
     * @param content - HTML/text content to validate
     * @param validation - Validation rules to apply
     * @returns Error message if validation fails, null if content is valid
     */
    private validateContent(content: string, validation: ContentValidation): string | null {
        // Detect Apache directory listing (indicates missing website files)
        if (validation.checkForApacheIndex) {
            const apacheIndexPatterns = [
                /Index of \//i,
                /<title>Index of/i,
                /Apache.*Server at/i,
                /<h1>Index of/i
            ];

            for (const pattern of apacheIndexPatterns) {
                if (pattern.test(content)) {
                    return 'Apache directory listing detected (Index of) - site files missing';
                }
            }
        }

        return null;
    }
}
