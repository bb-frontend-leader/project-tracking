/**
 * Value Object representing monitor service configuration
 * Defines scheduling and failure threshold parameters
 */
export interface MonitorConfig {
    checkInterval: string; // cron expression
    timezone: string;
    maxConsecutiveFailures: number;
}
