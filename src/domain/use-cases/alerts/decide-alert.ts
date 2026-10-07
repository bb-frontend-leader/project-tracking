import type { Service } from '#domain/entities/service.entity.js';
import type { AlertType } from '#domain/value-objects/alert-notification.value-object.js';
import type { MonitorConfig } from '#domain/value-objects/monitor-config.value-object.js';

/**
 * Decides which notification (if any) must be sent after a service check
 *
 * Alert policy:
 * - down: failing, failure threshold reached and no alert sent yet for this incident
 * - reminder: still failing and the reminder interval elapsed since the last alert
 * - recovery: back up after an alert was sent
 *
 * Pure function: it reads the service state but never modifies it. The caller
 * updates the state (markAlerted / clearIncident) only after the email was sent,
 * so a failed delivery is retried on the next cycle.
 *
 * @param service - Service already updated with the latest check result
 * @param isUp - Whether the latest check was successful
 * @param now - Current time
 * @param config - Alert thresholds
 * @returns The notification type to send, or null when nothing must be sent
 */
export function decideAlert(
    service: Pick<Service, 'consecutiveFailures' | 'lastAlertAt'>,
    isUp: boolean,
    now: Date,
    config: Pick<MonitorConfig, 'maxConsecutiveFailures' | 'alertReminderMinutes'>
): AlertType | null {
    if (isUp) {
        return service.lastAlertAt ? 'recovery' : null;
    }

    if (service.consecutiveFailures < config.maxConsecutiveFailures) {
        return null;
    }

    if (!service.lastAlertAt) {
        return 'down';
    }

    const reminderMs = config.alertReminderMinutes * 60_000;
    if (reminderMs > 0 && now.getTime() - service.lastAlertAt.getTime() >= reminderMs) {
        return 'reminder';
    }

    return null;
}
