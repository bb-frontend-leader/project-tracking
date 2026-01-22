import { EmailRepository } from "#domain/repositories/email.repository.js";

/**
 * VerifyEmailConnection - Use case for verifying email service connectivity
 * 
 * Validates that the email service is properly configured and can
 * establish a connection. This is typically run during application
 * startup to ensure email alerts will work when needed.
 */
export class VerifyEmailConnection {
    /**
     * Creates a new VerifyEmailConnection instance
     * @param email - Repository for email operations
     */
    constructor( private readonly email: EmailRepository) {}

    /**
     * Verifies the email service connection
     * 
     * @returns Promise resolving to true if connection is successful, false otherwise
     */
    async execute(): Promise<boolean> {
        return await this.email.verifyConnection();
    }
}
