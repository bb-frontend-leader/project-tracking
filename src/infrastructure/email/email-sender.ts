import type { Transporter } from 'nodemailer';
import nodemailer from 'nodemailer';

import { envs } from '../../config/plugins/env.plugin.js';

import { EmailRepository } from '#domain/repositories/email.repository.js';
import type { EmailConfig } from '#domain/value-objects/email-config.value-object.js';

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
     * Sends an alert email notification for a failed service
     * 
     * Creates a formatted HTML and plain text email with service details
     * and error information. Uses Colombia timezone for timestamps.
     * 
     * @param serviceName - Name of the failed service
     * @param serviceUrl - URL of the failed service
     * @param error - Error message or description
     * @throws Error if email sending fails
     */
    async sendAlert(serviceName: string, serviceUrl: string, error: string): Promise<void> {
        // Format timestamp in Colombia timezone
        const timestamp = new Date().toLocaleString('es-CO', {
            timeZone: 'America/Bogota',
            dateStyle: 'full',
            timeStyle: 'long'
        });

        const mailOptions = {
            from: this.config.from,
            to: this.config.to.join(', '),
            subject: `🚨 Books&Books Alerta: ${serviceName} - Servicio Caído`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff; }
                        .header { color: #333; padding: 30px; text-align: center;}
                        .header h1 { margin: 0; font-size: 24px; }
                        .brand { font-size: 14px; margin-top: 10px; opacity: 0.9; }
                        .alert-box { background-color: #f8d7da; border-left: 4px solid #dc3545; padding: 20px; margin: 20px 0; }
                        .info-box { background-color: #e7f3ff; border-left: 4px solid #2196F3; padding: 15px; margin: 15px 0; }
                        .label { font-weight: bold; color: #721c24; }
                        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; text-align: center; }
                        .love { color: #e74c3c; }
                        a { color: #667eea; text-decoration: none; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>⚠️ Alerta de Monitoreo</h1>
                            <div class="brand">📚 Books&Books - Monitor de Plataformas Digitales</div>
                        </div>
                        
                        <div class="alert-box">
                            <h3>🛑 Sitio Web No Disponible</h3>
                            <p><span class="label">Servicio:</span> ${serviceName}</p>
                            <p><span class="label">URL:</span> <a href="${serviceUrl}">${serviceUrl}</a></p>
                        </div>

                        <div class="info-box">
                            <p><span class="label">🐞 Detalle del Error:</span> ${error}</p>
                            <p><span class="label">🕒 Fecha y Hora:</span> ${timestamp}</p>
                        </div>

                        <p>👨‍💻 Por favor, verifica el servidor y los archivos del proyecto lo antes posible.</p>

                        <div class="footer">
                            <p>Este es un mensaje automático del sistema de monitoreo de Books&Books.</p>
                            <p>Hecho con <span class="love">❤️</span> por el Equipo Técnico de Books&Books</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
            text: `
📚 BOOKS&BOOKS - ALERTA DE MONITOREO
=====================================

🛑 Sitio Web Caído Detectado

Servicio: ${serviceName}
URL: ${serviceUrl}
🐞 Error: ${error}
🕒 Fecha y Hora: ${timestamp}

👨‍💻 Acción Requerida: Por favor verifica el servidor y los archivos del proyecto inmediatamente.

---
Hecho con ❤️ por el Equipo Técnico de Books&Books
            `.trim()
        };

        try {
            await this.transporter.sendMail(mailOptions);
            console.log(`✉️  Email de alerta enviado para ${serviceName}`);
        } catch (error) {
            console.error(`❌ Error al enviar email para ${serviceName}:`, error);
            throw error;
        }
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
