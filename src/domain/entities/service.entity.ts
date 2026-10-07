import { randomUUID } from 'crypto';

import type { ContentValidation } from '#domain/value-objects/content-validation.value-object.js';

/**
 * Enum for service status values
 */
export enum ServiceStatusEnum {
    UP = 'up',
    DOWN = 'down',
    UNKNOWN = 'unknown'
}

/**
 * Represents the current operational status of a service
 */
export type ServiceStatus = `${ServiceStatusEnum}`;

/**
 * Configuration object for creating a new Service instance
 */
export interface ServiceConfig {
    name: string;
    url: string;
    contentValidation?: ContentValidation;
}

/**
 * Service Entity - Represents a monitored web service
 *
 * This entity encapsulates all information about a service being monitored,
 * including its current status, check history, failure tracking and the
 * state of the current incident (alerts already sent).
 */
export class Service {
    /** Unique identifier for the service */
    public id: string;

    /** Human-readable name of the service */
    public name: string;

    /** URL endpoint to monitor */
    public url: string;

    /** Current operational status */
    public status: ServiceStatus;

    /** Timestamp of the last check attempt */
    public lastCheck: Date | null;

    /** Timestamp of the last successful check */
    public lastSuccessfulCheck: Date | null;

    /** Counter for consecutive failed checks */
    public consecutiveFailures: number;

    /** Timestamp when the service was added to monitoring */
    public createdAt: Date;

    /** Optional content validation rules */
    public contentValidation?: ContentValidation;

    /** Timestamp of the first failed check of the current incident (null when there is none) */
    public downSince: Date | null;

    /**
     * Timestamp of the last alert email sent for the current incident.
     * A non-null value means the incident is open: a down alert was already sent
     * and a recovery notice is still pending.
     */
    public lastAlertAt: Date | null;

    /**
     * Creates a new Service instance
     * @param config - Configuration object containing service details
     */
    constructor(config: ServiceConfig) {
        this.id = randomUUID();
        this.name = config.name;
        this.url = config.url;
        this.status = ServiceStatusEnum.UNKNOWN;
        this.lastCheck = null;
        this.lastSuccessfulCheck = null;
        this.consecutiveFailures = 0;
        this.createdAt = new Date();
        this.contentValidation = config.contentValidation;
        this.downSince = null;
        this.lastAlertAt = null;
    }

    /**
     * Whether an alert was sent for the current incident and it has not been closed yet
     */
    get hasOpenIncident(): boolean {
        return this.lastAlertAt !== null;
    }

    /**
     * Updates the service status based on check result
     *
     * Tracks check timestamp, updates status, and manages failure counter.
     * Resets consecutive failures counter when service is up. The incident
     * start time is kept after a recovery while a recovery notice is pending.
     *
     * @param isUp - Whether the service check was successful
     * @param now - Time of the check (injectable for tests)
     */
    updateStatus(isUp: boolean, now: Date = new Date()): void {
        this.lastCheck = now;

        if (isUp) {
            this.status = ServiceStatusEnum.UP;
            this.lastSuccessfulCheck = now;
            this.consecutiveFailures = 0;

            if (!this.hasOpenIncident) {
                this.downSince = null;
            }
        } else {
            this.status = ServiceStatusEnum.DOWN;
            this.consecutiveFailures++;
            this.downSince ??= now;
        }
    }

    /**
     * Records that an alert email (down or reminder) was sent
     * @param now - Time the alert was sent
     */
    markAlerted(now: Date = new Date()): void {
        this.lastAlertAt = now;
    }

    /**
     * Closes the current incident after the recovery notice was sent
     */
    clearIncident(): void {
        this.lastAlertAt = null;
        this.downSince = null;
    }
}
