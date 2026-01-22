/**
 * Repository interface for email operations
 * Implementations must provide both alert sending and connection verification
 */
export interface EmailRepository {
    /**
     * Send an alert email about a service failure
     * @param serviceName - Name of the service that failed
     * @param serviceUrl - URL of the service
     * @param error - Error message describing the failure
     */
    sendAlert(serviceName: string, serviceUrl: string, error: string): Promise<void>;

    /**
     * Verify that the email service connection is working
     * @returns Promise that resolves to true if connection is successful, false otherwise
     */
    verifyConnection(): Promise<boolean>;
}
