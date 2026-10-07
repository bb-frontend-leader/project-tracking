import fs from 'fs';
import path from 'path';

import type { ServiceConfig } from '#domain/entities/service.entity.js';
import {
    CONTENT_VALIDATION_KEYS,
    type ContentValidation
} from '#domain/value-objects/content-validation.value-object.js';

/**
 * Error thrown when the services file is missing, is not valid JSON or has invalid content.
 * The message lists every problem found so they can be fixed in one pass.
 */
export class ServicesConfigError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ServicesConfigError';
    }
}

type PlainObject = Record<string, unknown>;

const ROOT_KEYS = ['defaults', 'services'];
const DEFAULTS_KEYS = ['contentValidation'];
const SERVICE_KEYS = ['name', 'url', 'contentValidation'];

function isPlainObject(value: unknown): value is PlainObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isHttpUrl(value: string): boolean {
    try {
        const { protocol } = new URL(value);
        return protocol === 'http:' || protocol === 'https:';
    } catch {
        return false;
    }
}

/**
 * Reports keys that are not in the allowed list (catches typos such as "expectedTitel")
 */
function checkUnknownKeys(value: PlainObject, allowed: readonly string[], where: string, errors: string[]): void {
    for (const key of Object.keys(value)) {
        if (!allowed.includes(key)) {
            errors.push(`${where}: unknown key "${key}" (allowed: ${allowed.join(', ')})`);
        }
    }
}

/**
 * Validates a content validation block and collects every problem found
 * @returns The typed block when it is an object, otherwise undefined
 */
function validateContentValidation(value: unknown, where: string, errors: string[]): ContentValidation | undefined {
    if (value === undefined) return undefined;

    if (!isPlainObject(value)) {
        errors.push(`${where}: must be an object`);
        return undefined;
    }

    checkUnknownKeys(value, CONTENT_VALIDATION_KEYS, where, errors);

    if (value.expectedTitle !== undefined
        && (typeof value.expectedTitle !== 'string' || value.expectedTitle.trim() === '')) {
        errors.push(`${where}.expectedTitle: must be a non-empty string`);
    }

    for (const key of ['checkForDirectoryListing', 'checkAssets']) {
        if (value[key] !== undefined && typeof value[key] !== 'boolean') {
            errors.push(`${where}.${key}: must be true or false`);
        }
    }

    if (value.forbiddenText !== undefined
        && (!Array.isArray(value.forbiddenText)
            || value.forbiddenText.some(text => typeof text !== 'string' || text === ''))) {
        errors.push(`${where}.forbiddenText: must be an array of non-empty strings`);
    }

    return value as ContentValidation;
}

/**
 * Validates the content of a services file and builds the service configurations
 *
 * Expected shape:
 * {
 *   "defaults": { "contentValidation": { ... } },      // optional, applied to every service
 *   "services": [ { "name": "...", "url": "https://...", "contentValidation": { ... } } ]
 * }
 *
 * The contentValidation of each service is merged (shallow) over the defaults.
 *
 * @param raw - Parsed JSON
 * @param source - File name used in error messages
 * @throws ServicesConfigError listing every problem found
 */
export function parseServicesConfig(raw: unknown, source: string): ServiceConfig[] {
    const errors: string[] = [];

    if (!isPlainObject(raw)) {
        throw new ServicesConfigError(`${source}: the root must be an object with a "services" array`);
    }

    checkUnknownKeys(raw, ROOT_KEYS, 'root', errors);

    // Defaults
    let defaults: ContentValidation | undefined;
    if (raw.defaults !== undefined) {
        if (isPlainObject(raw.defaults)) {
            checkUnknownKeys(raw.defaults, DEFAULTS_KEYS, 'defaults', errors);
            defaults = validateContentValidation(raw.defaults.contentValidation, 'defaults.contentValidation', errors);
        } else {
            errors.push('defaults: must be an object');
        }
    }

    // Services
    if (!Array.isArray(raw.services) || raw.services.length === 0) {
        errors.push('services: must be a non-empty array');
    }

    const configs: ServiceConfig[] = [];
    const seenUrls = new Set<string>();

    (Array.isArray(raw.services) ? raw.services : []).forEach((entry: unknown, index: number) => {
        const where = `services[${index}]`;

        if (!isPlainObject(entry)) {
            errors.push(`${where}: must be an object`);
            return;
        }

        checkUnknownKeys(entry, SERVICE_KEYS, where, errors);

        const name = typeof entry.name === 'string' ? entry.name.trim() : '';
        if (!name) errors.push(`${where}.name: must be a non-empty string`);

        const url = typeof entry.url === 'string' ? entry.url.trim() : '';
        if (!isHttpUrl(url)) {
            errors.push(`${where}.url: must be a valid http(s) URL`);
        } else if (seenUrls.has(url)) {
            errors.push(`${where}.url: duplicated URL "${url}"`);
        } else {
            seenUrls.add(url);
        }

        const own = validateContentValidation(entry.contentValidation, `${where}.contentValidation`, errors);
        const contentValidation = defaults || own ? { ...defaults, ...own } : undefined;

        configs.push({ name, url, contentValidation });
    });

    if (errors.length > 0) {
        throw new ServicesConfigError(`${source} is invalid:\n${errors.map(error => `  - ${error}`).join('\n')}`);
    }

    return configs;
}

/**
 * Loads and validates the services file
 * @param filePath - Path of the JSON file (relative paths are resolved from the working directory)
 * @returns The services to monitor
 * @throws ServicesConfigError if the file is missing, is not valid JSON or has invalid content
 */
export function loadServicesConfig(filePath: string): ServiceConfig[] {
    const resolved = path.resolve(filePath);
    const source = path.basename(resolved);

    let text: string;
    try {
        text = fs.readFileSync(resolved, 'utf8');
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            throw new ServicesConfigError(
                `Services file not found: ${resolved}\n` +
                `  Create it from the template: cp services.example.json ${filePath}`
            );
        }
        throw new ServicesConfigError(`Could not read ${resolved}: ${(error as Error).message}`);
    }

    let raw: unknown;
    try {
        // Strip the UTF-8 BOM that some Windows editors add
        raw = JSON.parse(text.replace(/^\uFEFF/, ''));
    } catch (error) {
        throw new ServicesConfigError(`${source} is not valid JSON: ${(error as Error).message}`);
    }

    return parseServicesConfig(raw, source);
}
