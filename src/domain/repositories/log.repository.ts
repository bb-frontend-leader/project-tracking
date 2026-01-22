import type { LogEntity } from '#domain/entities/log.entity.js';

/**
 * Repository interface for log operations
 * Implementations must provide methods to save and retrieve logs
 */
export interface LogRepository {
    /**
     * Save a log entry
     * @param log - The log entity to save
     */
    saveLog(log: LogEntity): void;

    /**
     * Retrieve recent logs
     * @param count - Optional number of logs to retrieve (defaults to implementation-specific value)
     * @returns Array of log entities
     */
    getLogs(count?: number): LogEntity[];
}
