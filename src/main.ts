
import { servicesConfig } from './config/services.config.js';

import { Service } from '#domain/entities/service.entity.js';
import { CheckUseCase } from '#domain/use-cases/checks/check.use-case.js';
import { SendEmailAlert } from '#domain/use-cases/email/send-email-alert.use-case.js';
import { VerifyEmailConnection } from '#domain/use-cases/email/verify-email-connection.use-case.js';
import { FileSystemDatasource } from '#infrastructure/datasources/file-system.datasource.js';
import { EmailSender } from '#infrastructure/email/email-sender.js';
import { HttpChecker } from '#infrastructure/http-checker.js';
import { MonitorService } from '#presentation/monitor-service.js';

/**
 * Main application entry point
 * 
 * Bootstraps the website monitoring system by:
 * 1. Initializing infrastructure dependencies (HTTP checker, email sender, logger)
 * 2. Configuring use cases with their dependencies
 * 3. Verifying email connectivity
 * 4. Setting up the monitoring service with registered services
 * 5. Starting scheduled health checks
 * 6. Handling graceful shutdown on termination signals
 */
async function main() {
    console.log('\n📚 ====================================');
    console.log('🚀 Books&Books - Website Monitor');
    console.log('🛡️  Protecting Digital Platforms 24/7');
    console.log('====================================\n');

    // Initialize infrastructure layer implementations
    const httpChecker = new HttpChecker();
    const emailSender = new EmailSender();
    const FileSystemLogger = new FileSystemDatasource();

    // Initialize email use cases with repository dependency
    const sendEmailAlert = new SendEmailAlert(emailSender);
    const verifyEmailConnection = new VerifyEmailConnection(emailSender);

    // Verify SMTP connection before starting monitoring
    console.log('🔌 Verificando conexión SMTP...');
    const smtpOk = await verifyEmailConnection.execute();
    if (!smtpOk) {
        console.error('❌ No se pudo conectar al servidor SMTP');
        console.error('💡 Verifica las credenciales en el archivo .env');
        process.exit(1);
    }

    // Initialize check use case with dependencies
    const checkUseCase = new CheckUseCase(httpChecker, FileSystemLogger);

    // Create monitoring service coordinator
    const monitor = new MonitorService(checkUseCase, sendEmailAlert);

    // Load and register services to monitor from configuration
    const services = servicesConfig.map(config => new Service(config));
    monitor.addServices(services);

    // Handle graceful shutdown on SIGINT (Ctrl+C)
    process.on('SIGINT', () => {
        console.log('\n\n⚠️  Señal de interrupción recibida');
        monitor.printStatus();
        monitor.stop();
        console.log('👋 Sistema detenido correctamente');
        process.exit(0);
    });

    // Handle graceful shutdown on SIGTERM
    process.on('SIGTERM', () => {
        console.log('\n\n⚠️  Señal de terminación recibida');
        monitor.stop();
        process.exit(0);
    });

    // Start the monitoring service (performs initial check and schedules periodic checks)
    monitor.start();

    // Display status summary every hour
    setInterval(() => {
        monitor.printStatus();
    }, 3600000); // 1 hour in milliseconds
}

// Execute main function and handle fatal errors
main().catch(error => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
});
