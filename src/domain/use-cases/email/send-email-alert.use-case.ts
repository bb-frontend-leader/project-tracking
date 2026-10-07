import type { EmailRepository } from "#domain/repositories/email.repository.js";
import type { AlertNotification } from "#domain/value-objects/alert-notification.value-object.js";

/**
 * SendEmailAlert - Use case for sending email notifications
 *
 * Encapsulates the business logic for notifying that a service went down,
 * is still down, or recovered. Delegates the actual email sending to the
 * email repository implementation.
 */
export class SendEmailAlert {
    /**
     * Creates a new SendEmailAlert instance
     * @param email - Repository for email operations
     */
    constructor(private readonly email: EmailRepository) { }

    /**
     * Sends an email notification about a service
     *
     * @param notification - Notification type and service details
     * @returns Promise that resolves when email is sent
     */
    async execute(notification: AlertNotification): Promise<void> {
        await this.email.sendAlert(notification);
    }
}
