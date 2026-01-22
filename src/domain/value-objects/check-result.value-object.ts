/**
 * Value Object representing the result of a service check operation
 * Immutable object that encapsulates the outcome of an HTTP check
 */
export interface CheckResult {
    success: boolean;
    statusCode?: number;
    message: string;
    timestamp: Date;
    responseTime: number;
}
