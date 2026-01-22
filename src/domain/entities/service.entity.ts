import type { ContentValidation } from '#domain/value-objects/content-validation.value-object.js';

/**
 * Represents the current operational status of a service
 */
export type ServiceStatus = 'up' | 'down' | 'unknown';

/**
 * Enum for service status values
 */
export enum ServiceStatusEnum {
    UP = 'up',
    DOWN = 'down',
    UNKNOWN = 'unknown'
}

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
 * including its current status, check history, and failure tracking.
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
    public contentValidation?: {
        checkForApacheIndex?: boolean;
    };

    /**
     * Creates a new Service instance
     * @param config - Configuration object containing service details
     */
    constructor(config: ServiceConfig) {
        this.id = crypto.randomUUID();
        this.name = config.name;
        this.url = config.url;
        this.status = 'unknown';
        this.lastCheck = null;
        this.lastSuccessfulCheck = null;
        this.consecutiveFailures = 0;
        this.createdAt = new Date();
        this.contentValidation = config.contentValidation;
    }

    /**
     * Updates the service status based on check result
     * 
     * Tracks check timestamp, updates status, and manages failure counter.
     * Resets consecutive failures counter when service is up.
     * 
     * @param isUp - Whether the service check was successful
     */
    updateStatus(isUp: boolean): void {
        this.lastCheck = new Date();
        
        if (isUp) {
            this.status = ServiceStatusEnum.UP;
            this.lastSuccessfulCheck = new Date();
            this.consecutiveFailures = 0;
        } else {
            this.status = ServiceStatusEnum.DOWN;
            this.consecutiveFailures++;
        }
    }
}