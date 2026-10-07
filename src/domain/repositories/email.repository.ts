import type { AlertNotification } from '#domain/value-objects/alert-notification.value-object.js';

/**
 * Repository interface for email operations
 * Implementations must provide both alert sending and connection verification
 */
export interface EmailRepository {
    /**
     * Send a notification email about a service (down, reminder or recovery)
     * @param notification - Notification data
     */
    sendAlert(notification: AlertNotification): Promise<void>;

    /**
     * Verify that the email service connection is working
     * @returns Promise that resolves to true if connection is successful, false otherwise
     */
    verifyConnection(): Promise<boolean>;
}
