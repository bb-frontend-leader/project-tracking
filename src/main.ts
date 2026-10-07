
import { envs } from './config/plugins/env.plugin.js';
import { loadServicesConfig, ServicesConfigError } from './config/services.loader.js';

import { Service, type ServiceConfig } from '#domain/entities/service.entity.js';
import { CheckUseCase } from '#domain/use-cases/checks/check.use-case.js';
import { SendEmailAlert } from '#domain/use-cases/email/send-email-alert.use-case.js';
import { VerifyEmailConnection } from '#domain/use-cases/email/verify-email-connection.use-case.js';
import { FileSystemDatasource } from '#infrastructure/datasources/file-system.datasource.js';
import { EmailSender } from '#infrastructure/email/email-sender.js';
import { createHeartbeat } from '#infrastructure/heartbeat.js';
import { HttpChecker } from '#infrastructure/http-checker.js';
import { MonitorService } from '#presentation/monitor-service.js';

/**
 * Main application entry point
 *
 * Bootstraps the website monitoring system by:
 * 1. Loading the services to monitor from the services file
 * 2. Initializing infrastructure dependencies (HTTP checker, email sender, logger)
 * 3. Configuring use cases with their dependencies
 * 4. Verifying email connectivity (a failure is reported but does not stop monitoring)
 * 5. Setting up the monitoring service with registered services
 * 6. Starting scheduled health checks
 * 7. Handling graceful shutdown on termination signals
 */
async function main() {
    console.log('\n📚 ====================================');
    console.log('🚀 Books&Books - Website Monitor');
    console.log('🛡️  Protecting Digital Platforms 24/7');
    console.log('====================================\n');

    // Load services to monitor; without them there is nothing to do
    let serviceConfigs: ServiceConfig[];
    try {
        serviceConfigs = loadServicesConfig(envs.SERVICES_FILE);
    } catch (error) {
        console.error('❌ No se pudo cargar la lista de servicios');
        console.error(error instanceof ServicesConfigError ? error.message : error);
        process.exit(1);
    }

    // Initialize infrastructure layer implementations
    const httpChecker = new HttpChecker(envs.HTTP_TIMEOUT);
    const emailSender = new EmailSender();
    const logger = new FileSystemDatasource({
        retentionDays: envs.LOG_RETENTION_DAYS,
        timezone: envs.TIMEZONE
    });

    // Initialize email use cases with repository dependency
    const sendEmailAlert = new SendEmailAlert(emailSender);
    const verifyEmailConnection = new VerifyEmailConnection(emailSender);

    // Verify SMTP connection; keep monitoring even if it fails so outages are still logged
    console.log('🔌 Verificando conexión SMTP...');
    const smtpOk = await verifyEmailConnection.execute();
    if (!smtpOk) {
        console.warn('⚠️  No se pudo conectar al servidor SMTP: las alertas no se podrán enviar hasta que se corrija');
        console.warn('💡 Verifica las credenciales en el archivo .env (el envío se reintenta en cada ciclo)');
    }

    // Initialize check use case with dependencies
    const checkUseCase = new CheckUseCase(httpChecker, logger);

    // Create monitoring service coordinator; the services file is re-read on every cycle
    const monitor = new MonitorService(
        checkUseCase,
        sendEmailAlert,
        {
            checkInterval: envs.CHECK_INTERVAL,
            timezone: envs.TIMEZONE,
            maxConsecutiveFailures: envs.MAX_CONSECUTIVE_FAILURES,
            alertReminderMinutes: envs.ALERT_REMINDER_MINUTES
        },
        {
            loadServices: () => loadServicesConfig(envs.SERVICES_FILE),
            onCycleComplete: createHeartbeat(envs.HEARTBEAT_URL, envs.HTTP_TIMEOUT)
        }
    );

    // Register the services loaded at startup
    monitor.addServices(serviceConfigs.map(config => new Service(config)));

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

    // Log unexpected errors instead of dying silently. After an uncaught exception the
    // process state is not reliable, so exit and let the supervisor (pm2, systemd) restart it.
    process.on('unhandledRejection', reason => {
        console.error('❌ Promesa rechazada sin manejar:', reason);
    });
    process.on('uncaughtException', error => {
        console.error('❌ Excepción no capturada, se reiniciará el proceso:', error);
        process.exit(1);
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
