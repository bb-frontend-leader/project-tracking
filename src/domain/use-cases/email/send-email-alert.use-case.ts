import { EmailRepository } from "#domain/repositories/email.repository.js";

/**
 * SendEmailAlert - Use case for sending email alerts
 * 
 * Encapsulates the business logic for sending alert notifications
 * when a service failure is detected. Delegates the actual email
 * sending to the email repository implementation.
 */
export class SendEmailAlert {
    /**
     * Creates a new SendEmailAlert instance
     * @param email - Repository for email operations
     */
    constructor(private readonly email: EmailRepository) { }

    /**
     * Sends an email alert about a service failure
     * 
     * @param serviceName - Name of the failed service
     * @param serviceUrl - URL of the failed service
     * @param error - Error message or description
     * @returns Promise that resolves when email is sent
     */
    async execute(serviceName: string, serviceUrl: string, error: string): Promise<void> {
        await this.email.sendAlert(serviceName, serviceUrl, error);
    }
}
