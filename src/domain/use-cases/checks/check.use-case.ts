import { LogEntity, LogStatusEnum } from "#domain/entities/log.entity.js";
import { Service } from "#domain/entities/service.entity.js";
import type { HttpCheckerRepository } from "#domain/repositories/http-checker.repository.js";
import type { LogRepository } from "#domain/repositories/log.repository.js";
import { CheckResult } from "#domain/value-objects/check-result.value-object.js";

/**
 * CheckUseCase - Orchestrates service health checks
 * 
 * This use case coordinates the process of checking a service's availability,
 * updating its status, and logging the result. It follows the single responsibility
 * principle by delegating HTTP checking and logging to their respective repositories.
 */
export class CheckUseCase {
    /**
     * Creates a new CheckUseCase instance
     * @param httpChecker - Repository for performing HTTP health checks
     * @param logger - Repository for persisting log entries
     */
    constructor(
        private httpChecker: HttpCheckerRepository,
        private logger: LogRepository
    ) {}

    /**
     * Executes a health check for the given service
     * 
     * Workflow:
     * 1. Performs HTTP check via httpChecker repository
     * 2. Updates service status based on check result
     * 3. Creates and persists a log entry
     * 4. Returns the check result
     * 
     * @param service - The service entity to check
     * @returns Promise resolving to the check result
     */
    async execute(service: Service): Promise<CheckResult> {
        const result = await this.httpChecker.check(service.url, service.contentValidation);
        
        // Update service status based on check outcome
        service.updateStatus(result.success);

        // Create and persist log entry
        const logEntry = new LogEntity({
            timestamp: result.timestamp,
            name: service.name,
            url: service.url,
            status: result.success ? LogStatusEnum.SUCCESS : LogStatusEnum.FAILURE,
            code: result.statusCode,
            message: result.message,
            responseTime: result.responseTime
        });

        this.logger.saveLog(logEntry);

        return result;
    }
}