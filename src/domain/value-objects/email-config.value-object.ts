/**
 * Value Object representing email configuration
 * Contains all necessary parameters for email service connection
 */
export interface EmailConfig {
    user: string;
    pass: string;
    from: string;
    to: string[];
}
