import cron, { type ScheduledTask } from 'node-cron';

import { Service, type ServiceConfig } from '#domain/entities/service.entity.js';
import { decideAlert } from '#domain/use-cases/alerts/decide-alert.js';
import { CheckUseCase } from '#domain/use-cases/checks/check.use-case.js';
import type { SendEmailAlert } from '#domain/use-cases/email/send-email-alert.use-case.js';
import type { AlertNotification } from '#domain/value-objects/alert-notification.value-object.js';
import type { CheckResult } from '#domain/value-objects/check-result.value-object.js';
import type { MonitorConfig } from '#domain/value-objects/monitor-config.value-object.js';

/**
 * Optional collaborators of the MonitorService
 */
export interface MonitorServiceOptions {
    /**
     * Returns the current list of services to monitor. When provided, it is called
     * at the start of every cycle so changes to the services file apply without a restart.
     */
    loadServices?: () => ServiceConfig[];

    /** Called after every completed check cycle (e.g. to ping a heartbeat URL) */
    onCycleComplete?: () => Promise<void> | void;
}

/**
 * MonitorService - Coordinates scheduled service health monitoring
 *
 * Manages the monitoring lifecycle including:
 * - Registering services to monitor (and reloading them every cycle)
 * - Scheduling periodic health checks via cron
 * - Sending email alerts when a service goes down, stays down, or recovers
 * - Providing status reporting
 */
export class MonitorService {
    private services: Service[] = [];
    private cronJob: ScheduledTask | null = null;
    private isRunning: boolean = false;
    private isChecking: boolean = false;

    /**
     * Creates a new MonitorService instance
     * @param checkUseCase - Use case for performing service checks
     * @param sendEmailAlert - Use case for sending email alerts
     * @param config - Scheduling and alerting parameters
     * @param options - Optional services reloading and cycle hooks
     */
    constructor(
        private checkUseCase: CheckUseCase,
        private sendEmailAlert: SendEmailAlert,
        private config: MonitorConfig,
        private options: MonitorServiceOptions = {},
    ) {}

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
     * Reloads the services list from its source and reconciles it with the running one
     *
     * Services are matched by URL, so the ones that remain keep their state
     * (consecutive failures, open incident). New services are added and the ones
     * no longer listed are removed. If the source cannot be loaded or is invalid,
     * the previous list is kept and the problem is logged.
     */
    syncServices(): void {
        if (!this.options.loadServices) return;

        let configs: ServiceConfig[];
        try {
            configs = this.options.loadServices();
        } catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            console.error(`⚠️  No se pudo recargar la lista de servicios, se mantiene la anterior.\n${reason}`);
            return;
        }

        const current = new Map(this.services.map(service => [service.url, service]));
        const next: Service[] = [];

        for (const config of configs) {
            const existing = current.get(config.url);

            if (existing) {
                existing.name = config.name;
                existing.contentValidation = config.contentValidation;
                current.delete(config.url);
                next.push(existing);
            } else {
                const service = new Service(config);
                console.log(`➕ Servicio agregado: ${service.name} (${service.url})`);
                next.push(service);
            }
        }

        for (const removed of current.values()) {
            console.log(`➖ Servicio eliminado: ${removed.name} (${removed.url})`);
        }

        this.services = next;
    }

    /**
     * Checks all registered services and sends alerts if needed
     *
     * A cycle that starts while the previous one is still running is skipped.
     * Services are checked in parallel; a failure in one never affects the others.
     *
     * For each service:
     * 1. Executes health check via CheckUseCase
     * 2. Decides whether a down / reminder / recovery email is due
     * 3. Sends the email and records it only if it was delivered
     */
    async checkAllServices(): Promise<void> {
        if (this.isChecking) {
            console.warn('⚠️  La verificación anterior sigue en curso, se omite este ciclo');
            return;
        }

        this.isChecking = true;

        try {
            this.syncServices();

            console.log(`\n🔍 Iniciando verificación de ${this.services.length} servicios...`);
            const startTime = Date.now();

            await Promise.all(this.services.map(service => this.checkService(service)));

            const totalTime = Date.now() - startTime;
            console.log(`✅ Verificación completada en ${totalTime}ms\n`);
        } finally {
            this.isChecking = false;
        }

        try {
            await this.options.onCycleComplete?.();
        } catch (error) {
            console.error('❌ Error en la acción posterior al ciclo:', error);
        }
    }

    /**
     * Checks one service and notifies if needed. Never throws.
     * @param service - Service to check
     */
    private async checkService(service: Service): Promise<void> {
        try {
            const result = await this.checkUseCase.execute(service);
            await this.notify(service, result);
        } catch (error) {
            console.error(`❌ Error verificando ${service.name}:`, error);
        }
    }

    /**
     * Sends the notification that corresponds to the latest check result, if any
     *
     * The incident state is updated only after the email was delivered, so a
     * failed delivery is retried on the next cycle.
     *
     * @param service - The service that was just checked
     * @param result - Result of the check
     */
    private async notify(service: Service, result: CheckResult): Promise<void> {
        const now = new Date();
        const type = decideAlert(service, result.success, now, this.config);

        if (!type) return;

        const notification: AlertNotification = {
            type,
            serviceName: service.name,
            serviceUrl: service.url,
            detail: type === 'recovery'
                ? `El servicio volvió a responder correctamente (${result.message})`
                : `${result.message} (Fallos consecutivos: ${service.consecutiveFailures})`,
            downSince: service.downSince
        };

        try {
            await this.sendEmailAlert.execute(notification);
        } catch (error) {
            console.error(`❌ Error enviando alerta (${type}) para ${service.name}:`, error);
            return;
        }

        if (type === 'recovery') {
            service.clearIncident();
        } else {
            service.markAlerted(now);
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
        this.checkAllServices().catch(error => console.error('❌ Error en la verificación inicial:', error));

        // Schedule periodic checks
        this.cronJob = cron.schedule(
            this.config.checkInterval,
            () => {
                this.checkAllServices().catch(error => console.error('❌ Error en la verificación programada:', error));
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
                    ? service.lastCheck.toLocaleString('es-CO', { timeZone: this.config.timezone })
                    : 'Nunca';
                console.log(`   ${statusIcon} ${service.name} - Última verificación: ${lastCheck}`);
            });
            console.log('\n❤️  Monitoreado por el Equipo Técnico de Books&Books\n');
        }
    }
}
