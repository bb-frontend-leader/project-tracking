/**
 * Value Object representing monitor service configuration
 * Defines scheduling and alerting parameters
 */
export interface MonitorConfig {
    checkInterval: string; // cron expression
    timezone: string;
    maxConsecutiveFailures: number;
    /** Minutes between reminders while a service stays down (0 disables reminders) */
    alertReminderMinutes: number;
}
