import fs from 'fs';
import path from 'path';

import { LogEntity, LogStatusEnum } from '#domain/entities/log.entity.js';
import { LogRepository } from '#domain/repositories/log.repository.js';

/**
 * FileSystemDatasource - File-based log persistence implementation
 * 
 * Manages log storage using both in-memory cache and file persistence.
 * Provides console output with colored formatting and supports log export.
 */
export class FileSystemDatasource implements LogRepository {
    private logs: LogEntity[] = [];
    private logFilePath: string;
    private maxLogsInMemory: number;

    /**
     * Creates a new FileSystemDatasource instance
     * @param logFilePath - Optional custom path for log file (default: ./logs/monitor.log)
     * @param maxLogsInMemory - Maximum number of logs to keep in memory (default: 1000)
     */
    constructor(logFilePath?: string, maxLogsInMemory: number = 1000) {
        this.logFilePath = logFilePath || path.join(process.cwd(), 'logs', 'monitor.log');
        this.maxLogsInMemory = maxLogsInMemory;
        this.ensureLogDirectory();
    }

    /**
     * Ensures the log directory exists, creating it if necessary
     */
    private ensureLogDirectory(): void {
        const logDir = path.dirname(this.logFilePath);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
    }

    /**
     * Saves a log entry to memory, file, and console
     * 
     * Performs three operations:
     * 1. Adds log to in-memory cache (with automatic cleanup)
     * 2. Appends log to file in JSON format
     * 3. Outputs formatted log to console
     * 
     * @param log - The log entity to save
     */
    saveLog(log: LogEntity) {
        // Add to memory cache
        this.logs.push(log);

        // Remove oldest logs if memory limit exceeded
        if (this.logs.length > this.maxLogsInMemory) {
            this.logs.shift();
        }

        // Persist to file
        this.writeToFile(log);

        // Display in console
        this.logToConsole(log);
    }

    /**
     * Writes a log entry to the log file in JSON format
     * @param log - The log entity to write
     */
    private writeToFile(log: LogEntity): void {
        const timestamp = log.timestamp.toLocaleString('es-CO', {
            timeZone: 'America/Bogota'
        });

        const logAsJSON = JSON.stringify({
            ...log,
            timestamp,
            responseTime: `${log.responseTime}ms`
        }) + '\n';

        try {
            fs.appendFileSync(this.logFilePath, logAsJSON);
        } catch (error) {
            console.error('Error escribiendo en log:', error);
        }
    }

    /**
     * Outputs a colored, formatted log entry to the console
     * @param entry - The log entity to display
     */
    private logToConsole(entry: LogEntity): void {
        const timestamp = entry.timestamp.toLocaleString('es-CO', {
            timeZone: 'America/Bogota',
            hour12: false
        });

        const icon = entry.status === LogStatusEnum.SUCCESS ? '✅' : '❌';
        const statusText = entry.status === LogStatusEnum.SUCCESS ? 'UP' : 'DOWN';
        const color = entry.status === LogStatusEnum.SUCCESS ? '\x1b[32m' : '\x1b[31m';
        const reset = '\x1b[0m';

        console.log(
            `${color}${icon} [${timestamp}] ${statusText}${reset} - ${entry.name} (${entry.url}) - ${entry.message} - ${entry.responseTime}ms`
        );
    }

    /**
     * Retrieves recent logs from memory
     * @param count - Number of logs to retrieve (default: 50)
     * @returns Array of most recent log entries
     */
    getLogs(count: number = 50): LogEntity[] {
        return this.logs.slice(-count);
    }

    /**
     * Clears all logs from memory
     * Note: Does not affect persisted log file
     */
    clearLogs(): void {
        this.logs = [];
    }

    /**
     * Exports all in-memory logs to a JSON file
     * @param filePath - Optional custom export path (default: ./logs/export-{timestamp}.json)
     */
    exportLogsToFile(filePath?: string): void {
        const exportPath = filePath || path.join(process.cwd(), 'logs', `export-${Date.now()}.json`);
        fs.writeFileSync(exportPath, JSON.stringify(this.logs, null, 2));
        console.log(`📊 Logs exportados a: ${exportPath}`);
    }
}
