/**
 * Enum representing the status of a service check
 */
export enum LogStatusEnum {
    SUCCESS = 'success',
    FAILURE = 'failure'
}

/**
 * Options for creating a LogEntity instance
 */
export interface LogEntityOptions {
    timestamp: Date;
    name: string;
    url: string;
    status: LogStatusEnum;
    code?: number;
    message: string;
    responseTime: number;
}

/**
 * LogEntity - Represents a single service check log entry
 * 
 * Immutable record of a service check attempt, capturing all relevant
 * information including status, response time, and any error messages.
 */
export class LogEntity {
    /** Timestamp when the check was performed */
    public timestamp: Date;
    
    /** Name of the service that was checked */
    public name: string;
    
    /** URL that was checked */
    public url: string;
    
    /** Result status of the check */
    public status: LogStatusEnum;
    
    /** HTTP status code (if available) */
    public code?: number;
    
    /** Descriptive message about the check result */
    public message: string
    
    /** Response time in milliseconds */
    public responseTime: number;

    /**
     * Creates a new LogEntity instance
     * @param options - Configuration object with log details
     */
    constructor(options: LogEntityOptions) {
        this.timestamp = options.timestamp;
        this.name = options.name;
        this.url = options.url;
        this.status = options.status;
        this.code = options.code;
        this.message = options.message;
        this.responseTime = options.responseTime;
    }

    /**
     * Creates a LogEntity from a JSON string
     * @param json - JSON string representation of a log entry
     * @returns LogEntity instance
     */
    static fromJson = (json: string): LogEntity => {
        const log = JSON.parse(json);

        return new LogEntity({
            timestamp: new Date(log.timestamp),
            name: log.name,
            url: log.url,
            status: log.status,
            code: log.code,
            message: log.message,
            responseTime: log.responseTime
        });
    }

    /**
     * Creates a LogEntity from a plain object
     * @param obj - Plain object with log properties
     * @returns LogEntity instance
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static fromObject = (obj: { [key: string]: any }): LogEntity => {
        return new LogEntity({
            timestamp: new Date(obj.timestamp),
            name: obj.name,
            url: obj.url,
            status: obj.status,
            code: obj.code,
            message: obj.message,
            responseTime: obj.responseTime
        });
    }
}