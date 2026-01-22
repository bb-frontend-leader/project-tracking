import type { CheckResult } from '#domain/value-objects/check-result.value-object.js';
import type { ContentValidation } from '#domain/value-objects/content-validation.value-object.js';

/**
 * Repository interface for HTTP checking operations
 * Implementations must provide methods to check URL availability and content validation
 */
export interface HttpCheckerRepository {
    /**
     * Check if a URL is accessible and optionally validate its content
     * @param url - The URL to check
     * @param contentValidation - Optional validation rules for the response content
     * @returns Promise with the check result including status, response time, etc.
     */
    check(url: string, contentValidation?: ContentValidation): Promise<CheckResult>;
}
