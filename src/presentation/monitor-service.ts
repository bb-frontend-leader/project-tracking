import cron, { type ScheduledTask } from 'node-cron';

import { envs } from '../config/plugins/env.plugin.js';

import { Service } from '#domain/entities/service.entity.js';
import { CheckUseCase } from '#domain/use-cases/checks/check.use-case.js';
import type { SendEmailAlert } from '#domain/use-cases/email/send-email-alert.use-case.js';
import type { MonitorConfig } from '#domain/value-objects/monitor-config.value-object.js';

/**
 * MonitorService - Coordinates scheduled service health monitoring
 * 
 * Manages the monitoring lifecycle including:
 * - Registering services to monitor
 * - Scheduling periodic health checks via cron
 * - Sending email alerts for failures
 * - Providing status reporting
 */
export class MonitorService {
    private services: Service[] = [];
    private cronJob: ScheduledTask | null = null;
    private isRunning: boolean = false;
    private config: MonitorConfig;

    /**
     * Creates a new MonitorService instance
     * @param checkUseCase - Use case for performing service checks
     * @param sendEmailAlert - Use case for sending email alerts
     */
    constructor(
        private checkUseCase: CheckUseCase,
        private sendEmailAlert: SendEmailAlert,
    ) {
        // Load configuration from environment
        this.config = {
            checkInterval: envs.CHECK_INTERVAL,
            timezone: envs.TIMEZONE,
            maxConsecutiveFailures: envs.MAX_CONSECUTIVE_FAILURES
        }
    }

    /**
     * Adds a single service to the monitoring list
     * @param service - Service entity to monitor
     */
    addService(service: Service): void {
        this.services.push(service);
        console.log(`➕ Servicio agregado: ${service.name} (${service.url})`);
    }

    /**
     * Adds multiple services to the monitoring list
     * @param services - Array of service entities to monitor
     */
    addServices(services: Service[]): void {
        services.forEach(service => this.addService(service));
    }

    /**
     * Checks all registered services and sends alerts if needed
     * 
     * For each service:
     * 1. Executes health check via CheckUseCase
     * 2. Checks if failure threshold is exceeded
     * 3. Sends email alert if necessary
     */
    async checkAllServices(): Promise<void> {
        console.log(`\n🔍 Iniciando verificación de ${this.services.length} servicios...`);
        const startTime = Date.now();

        for (const service of this.services) {
            try {
                const result = await this.checkUseCase.execute(service);

                // Send alert if service is down and has exceeded failure threshold
                if (!result.success && service.consecutiveFailures >= this.config.maxConsecutiveFailures) {
                    await this.sendAlert(service, result.message);
                }
            } catch (error) {
                console.error(`❌ Error verificando ${service.name}:`, error);
            }
        }

        const totalTime = Date.now() - startTime;
        console.log(`✅ Verificación completada en ${totalTime}ms\n`);
    }

    /**
     * Sends an email alert for a failed service
     * @param service - The service that failed
     * @param errorMessage - Description of the failure
     */
    private async sendAlert(service: Service, errorMessage: string): Promise<void> {
        try {
            await this.sendEmailAlert.execute(
                service.name,
                service.url,
                `${errorMessage} (Fallos consecutivos: ${service.consecutiveFailures})`
            );
        } catch (error) {
            console.error(`❌ Error enviando alerta para ${service.name}:`, error);
        }
    }

    /**
     * Starts the monitoring service
     * 
     * Performs initial check immediately, then schedules periodic checks
     * according to the configured cron expression.
     */
    start(): void {
        if (this.isRunning) {
            console.log('⚠️  El monitor ya está en ejecución');
            return;
        }

        console.log(`\n🚀 Iniciando Monitor de Books&Books...`);
        console.log(`📊 Horario: ${this.config.checkInterval}`);
        console.log(`🌍 Zona Horaria: ${this.config.timezone}`);
        console.log(`💻 Servicios: ${this.services.length}`);

        // Run initial check immediately
        this.checkAllServices();

        // Schedule periodic checks
        this.cronJob = cron.schedule(
            this.config.checkInterval,
            () => {
                this.checkAllServices();
            },
            {
                timezone: this.config.timezone
            }
        );

        this.isRunning = true;
        console.log(`✅ Monitor de Books&Books iniciado exitosamente! 🛡️\n`);
    }

    /**
     * Stops the monitoring service
     * Cancels scheduled checks and updates running status
     */
    stop(): void {
        if (this.cronJob) {
            this.cronJob.stop();
            this.cronJob = null;
        }
        this.isRunning = false;
        console.log('🛑 Monitor detenido');
    }

    /**
     * Gets current monitoring status and statistics
     * @returns Object with monitoring metrics
     */
    getStatus(): {
        isRunning: boolean;
        totalServices: number;
        servicesUp: number;
        servicesDown: number;
        servicesUnknown: number;
    } {
        return {
            isRunning: this.isRunning,
            totalServices: this.services.length,
            servicesUp: this.services.filter(s => s.status === 'up').length,
            servicesDown: this.services.filter(s => s.status === 'down').length,
            servicesUnknown: this.services.filter(s => s.status === 'unknown').length
        };
    }

    /**
     * Gets all registered services
     * @returns Array of service entities
     */
    getServices(): Service[] {
        return this.services;
    }

    /**
     * Prints detailed monitoring status to console
     * Shows service counts, individual service statuses, and last check times
     */
    printStatus(): void {
        const status = this.getStatus();
        console.log('\n📚 Estado del Monitor de Books&Books:');
        console.log(`   🟢 Estado: ${status.isRunning ? '🟢 Activo' : '🔴 Inactivo'}`);
        console.log(`   📊 Total de Servicios: ${status.totalServices}`);
        console.log(`   🟢 En Línea: ${status.servicesUp}`);
        console.log(`   🔴 Caídos: ${status.servicesDown}`);
        console.log(`   ⚪ Desconocidos: ${status.servicesUnknown}`);
        console.log('');

        if (this.services.length > 0) {
            console.log('📋 Detalle de Servicios:');
            this.services.forEach(service => {
                const statusIcon = service.status === 'up' ? '🟢' :
                    service.status === 'down' ? '🔴' : '⚪';
                const lastCheck = service.lastCheck
                    ? service.lastCheck.toLocaleString('es-CO', { timeZone: 'America/Bogota' })
                    : 'Nunca';
                console.log(`   ${statusIcon} ${service.name} - Última verificación: ${lastCheck}`);
            });
            console.log('\n❤️  Monitoreado por el Equipo Técnico de Books&Books\n');
        }
    }
}
