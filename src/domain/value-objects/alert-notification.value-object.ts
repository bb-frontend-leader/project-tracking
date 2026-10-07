/**
 * Kind of notification sent to the recipients:
 * - down: the service failed and exceeded the consecutive failures threshold
 * - reminder: the service is still down after the reminder interval
 * - recovery: the service is back up after an alerted incident
 */
export type AlertType = 'down' | 'reminder' | 'recovery';

/**
 * Value Object representing a notification about a service
 */
export interface AlertNotification {
    type: AlertType;
    serviceName: string;
    serviceUrl: string;
    /** Failure description (down/reminder) or recovery detail */
    detail: string;
    /** Start of the incident, used to report how long the service was down */
    downSince: Date | null;
}
