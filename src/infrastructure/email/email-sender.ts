import type { Transporter } from 'nodemailer';
import nodemailer from 'nodemailer';

import { envs } from '../../config/plugins/env.plugin.js';

import { EmailRepository } from '#domain/repositories/email.repository.js';
import type { AlertNotification, AlertType } from '#domain/value-objects/alert-notification.value-object.js';
import type { EmailConfig } from '#domain/value-objects/email-config.value-object.js';
import { escapeHtml } from '#utils/escape-html.js';
import { formatDuration } from '#utils/format-duration.js';

/**
 * Texts and colors that change depending on the notification type
 */
interface AlertTemplate {
    subject: (serviceName: string) => string;
    heading: string;
    boxTitle: string;
    boxColor: string;
    boxBorder: string;
    labelColor: string;
    closing: string;
}

const TEMPLATES: Record<AlertType, AlertTemplate> = {
    down: {
        subject: name => `🚨 Books&Books Alerta: ${name} - Servicio Caído`,
        heading: '⚠️ Alerta de Monitoreo',
        boxTitle: '🛑 Sitio Web No Disponible',
        boxColor: '#f8d7da',
        boxBorder: '#dc3545',
        labelColor: '#721c24',
        closing: '👨‍💻 Por favor, verifica el servidor y los archivos del proyecto lo antes posible.'
    },
    reminder: {
        subject: name => `⏰ Books&Books Recordatorio: ${name} - Sigue Caído`,
        heading: '⏰ Recordatorio de Monitoreo',
        boxTitle: '🛑 El Sitio Web Sigue No Disponible',
        boxColor: '#fff3cd',
        boxBorder: '#ffc107',
        labelColor: '#856404',
        closing: '👨‍💻 El servicio continúa con problemas. Por favor, revisa el servidor y los archivos del proyecto.'
    },
    recovery: {
        subject: name => `✅ Books&Books Recuperado: ${name} - Servicio Restablecido`,
        heading: '✅ Servicio Restablecido',
        boxTitle: '🟢 Sitio Web Disponible Nuevamente',
        boxColor: '#d4edda',
        boxBorder: '#28a745',
        labelColor: '#155724',
        closing: '🎉 No se requiere ninguna acción. El monitoreo continúa normalmente.'
    }
};

/**
 * EmailSender - SMTP-based email notification implementation
 *
 * Handles email operations using nodemailer with SMTP transport.
 * Supports HTML and plain text email formats for better compatibility.
 */
export class EmailSender implements EmailRepository {
    private transporter: Transporter;
    private config: EmailConfig;

    /**
     * Creates a new EmailSender instance with SMTP configuration from environment
     */
    constructor() {
        // Build configuration from environment variables
        const config: EmailConfig = {
            user: envs.SMTP_USER,
            pass: envs.SMTP_PASS,
            from: envs.EMAIL_FROM,
            to: envs.EMAIL_TO
        }

        this.config = config;

        // Initialize nodemailer transporter using service configuration
        // Using 'service' is more reliable than manual host/port configuration
        this.transporter = nodemailer.createTransport({
            service: envs.MAILER_SERVICE,
            auth: {
                user: config.user,
                pass: config.pass
            }
        });
    }

    /**
     * Sends a notification email about a service (down, reminder or recovery)
     *
     * Creates a formatted HTML and plain text email with service details.
     * Every value interpolated in the HTML is escaped. Timestamps use the
     * timezone configured in the environment.
     *
     * @param notification - Notification type and service details
     * @throws Error if email sending fails
     */
    async sendAlert(notification: AlertNotification): Promise<void> {
        const template = TEMPLATES[notification.type];
        const { serviceName } = notification;

        const mailOptions = {
            from: this.config.from,
            to: this.config.to.join(', '),
            subject: template.subject(serviceName),
            html: this.buildHtml(notification, template),
            text: this.buildText(notification, template)
        };

        try {
            await this.transporter.sendMail(mailOptions);
            console.log(`✉️  Email (${notification.type}) enviado para ${serviceName}`);
        } catch (error) {
            console.error(`❌ Error al enviar email para ${serviceName}:`, error);
            throw error;
        }
    }

    /**
     * Formats a date using the configured timezone
     * @param date - Date to format
     */
    private formatDate(date: Date): string {
        return date.toLocaleString('es-CO', {
            timeZone: envs.TIMEZONE,
            dateStyle: 'full',
            timeStyle: 'long'
        });
    }

    /**
     * Builds the detail lines shown in the info box (label + value, both plain text)
     * @param notification - Notification data
     */
    private buildDetails(notification: AlertNotification): Array<{ label: string; value: string }> {
        const now = new Date();
        const isRecovery = notification.type === 'recovery';
        const details = [
            { label: isRecovery ? '🛠️ Detalle' : '🐞 Detalle del Error', value: notification.detail },
            { label: '🕒 Fecha y Hora', value: this.formatDate(now) }
        ];

        if (notification.downSince) {
            details.push(
                { label: '📉 Caído desde', value: this.formatDate(notification.downSince) },
                { label: '⏱️ Duración', value: formatDuration(now.getTime() - notification.downSince.getTime()) }
            );
        }

        return details;
    }

    /**
     * Builds the HTML body of the email
     * @param notification - Notification data
     * @param template - Texts and colors for the notification type
     */
    private buildHtml(notification: AlertNotification, template: AlertTemplate): string {
        const serviceName = escapeHtml(notification.serviceName);
        const serviceUrl = escapeHtml(notification.serviceUrl);
        const detailLines = this.buildDetails(notification)
            .map(({ label, value }) => `<p><span class="label">${label}:</span> ${escapeHtml(value)}</p>`)
            .join('\n                            ');

        return `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff; }
                        .header { color: #333; padding: 30px; text-align: center;}
                        .header h1 { margin: 0; font-size: 24px; }
                        .brand { font-size: 14px; margin-top: 10px; opacity: 0.9; }
                        .alert-box { background-color: ${template.boxColor}; border-left: 4px solid ${template.boxBorder}; padding: 20px; margin: 20px 0; }
                        .info-box { background-color: #e7f3ff; border-left: 4px solid #2196F3; padding: 15px; margin: 15px 0; }
                        .label { font-weight: bold; color: ${template.labelColor}; }
                        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; text-align: center; }
                        .love { color: #e74c3c; }
                        a { color: #667eea; text-decoration: none; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>${template.heading}</h1>
                            <div class="brand">📚 Books&amp;Books - Monitor de Plataformas Digitales</div>
                        </div>

                        <div class="alert-box">
                            <h3>${template.boxTitle}</h3>
                            <p><span class="label">Servicio:</span> ${serviceName}</p>
                            <p><span class="label">URL:</span> <a href="${serviceUrl}">${serviceUrl}</a></p>
                        </div>

                        <div class="info-box">
                            ${detailLines}
                        </div>

                        <p>${template.closing}</p>

                        <div class="footer">
                            <p>Este es un mensaje automático del sistema de monitoreo de Books&amp;Books.</p>
                            <p>Hecho con <span class="love">❤️</span> por el Equipo Técnico de Books&amp;Books</p>
                        </div>
                    </div>
                </body>
                </html>
            `;
    }

    /**
     * Builds the plain text body of the email
     * @param notification - Notification data
     * @param template - Texts and colors for the notification type
     */
    private buildText(notification: AlertNotification, template: AlertTemplate): string {
        const detailLines = this.buildDetails(notification)
            .map(({ label, value }) => `${label}: ${value}`)
            .join('\n');

        return `
📚 BOOKS&BOOKS - ${template.heading.toUpperCase()}
=====================================

${template.boxTitle}

Servicio: ${notification.serviceName}
URL: ${notification.serviceUrl}
${detailLines}

${template.closing}

---
Hecho con ❤️ por el Equipo Técnico de Books&Books
            `.trim();
    }

    /**
     * Verifies SMTP connection is working correctly
     *
     * Tests the connection to the SMTP server using the configured credentials.
     * This should be called during application startup.
     *
     * @returns Promise resolving to true if connection successful, false otherwise
     */
    async verifyConnection(): Promise<boolean> {
        try {
            await this.transporter.verify();
            console.log('✅ Conexión SMTP verificada correctamente');
            return true;
        } catch (error) {
            console.error('❌ Error al verificar conexión SMTP:', error);
            return false;
        }
    }
}
