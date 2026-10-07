import fs from 'fs';
import path from 'path';

import { LogEntity, LogStatusEnum } from '#domain/entities/log.entity.js';
import { LogRepository } from '#domain/repositories/log.repository.js';

/**
 * Options for FileSystemDatasource
 */
export interface FileSystemDatasourceOptions {
    /** Directory where daily log files are written (default: ./logs) */
    logDir?: string;
    /** Days to keep daily log files (default: 30) */
    retentionDays?: number;
    /** Maximum number of logs to keep in memory (default: 1000) */
    maxLogsInMemory?: number;
    /** IANA timezone used for file names and console output (default: America/Bogota) */
    timezone?: string;
}

const LOG_FILE_PATTERN = /^monitor-(\d{4}-\d{2}-\d{2})\.log$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * FileSystemDatasource - File-based log persistence implementation
 *
 * Manages log storage using both in-memory cache and file persistence.
 * Logs are written as JSON lines (ISO 8601 timestamps) to one file per day
 * (monitor-YYYY-MM-DD.log); files older than the retention period are deleted.
 * Provides console output with colored formatting and supports log export.
 */
export class FileSystemDatasource implements LogRepository {
    private logs: LogEntity[] = [];
    private logDir: string;
    private retentionDays: number;
    private maxLogsInMemory: number;
    private timezone: string;
    private lastPrunedDay: string | null = null;

    /**
     * Creates a new FileSystemDatasource instance
     * @param options - Optional settings (see FileSystemDatasourceOptions)
     */
    constructor(options: FileSystemDatasourceOptions = {}) {
        this.logDir = options.logDir ?? path.join(process.cwd(), 'logs');
        this.retentionDays = options.retentionDays ?? 30;
        this.maxLogsInMemory = options.maxLogsInMemory ?? 1000;
        this.timezone = options.timezone ?? 'America/Bogota';
        this.ensureLogDirectory();
        this.pruneOldLogs(new Date());
    }

    /**
     * Ensures the log directory exists, creating it if necessary
     */
    private ensureLogDirectory(): void {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    /**
     * Returns the calendar day (YYYY-MM-DD) of a date in the configured timezone
     * @param date - Date to format
     */
    private dayOf(date: Date): string {
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: this.timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(date);
    }

    /**
     * Deletes daily log files older than the retention period
     * Runs at startup and once per day; failures never interrupt logging.
     * @param now - Current time
     */
    private pruneOldLogs(now: Date): void {
        const today = this.dayOf(now);
        if (this.lastPrunedDay === today) return;
        this.lastPrunedDay = today;

        // ISO dates sort alphabetically, so a string comparison is enough
        const oldestKept = this.dayOf(new Date(now.getTime() - this.retentionDays * DAY_MS));

        try {
            for (const file of fs.readdirSync(this.logDir)) {
                const match = LOG_FILE_PATTERN.exec(file);
                if (match && match[1] < oldestKept) {
                    fs.rmSync(path.join(this.logDir, file), { force: true });
                }
            }
        } catch (error) {
            console.error('Error eliminando logs antiguos:', error);
        }
    }

    /**
     * Saves a log entry to memory, file, and console
     *
     * Performs three operations:
     * 1. Adds log to in-memory cache (with automatic cleanup)
     * 2. Appends log to the file of its day in JSON format
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
     * Writes a log entry to the daily log file as one JSON line
     * The timestamp is ISO 8601 (UTC) and responseTime is a number of milliseconds,
     * so every line can be read back with LogEntity.fromJson.
     * @param log - The log entity to write
     */
    private writeToFile(log: LogEntity): void {
        const logAsJSON = JSON.stringify(log) + '\n';
        const filePath = path.join(this.logDir, `monitor-${this.dayOf(log.timestamp)}.log`);

        try {
            this.pruneOldLogs(log.timestamp);
            fs.appendFileSync(filePath, logAsJSON);
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
            timeZone: this.timezone,
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
     * Note: Does not affect persisted log files
     */
    clearLogs(): void {
        this.logs = [];
    }

    /**
     * Exports all in-memory logs to a JSON file
     * @param filePath - Optional custom export path (default: ./logs/export-{timestamp}.json)
     */
    exportLogsToFile(filePath?: string): void {
        const exportPath = filePath || path.join(this.logDir, `export-${Date.now()}.json`);
        fs.writeFileSync(exportPath, JSON.stringify(this.logs, null, 2));
        console.log(`📊 Logs exportados a: ${exportPath}`);
    }
}
