import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

import { MonitorService, type MonitorServiceOptions } from './monitor-service.js';

import { Service, type ServiceConfig } from '#domain/entities/service.entity.js';
import type { CheckUseCase } from '#domain/use-cases/checks/check.use-case.js';
import type { SendEmailAlert } from '#domain/use-cases/email/send-email-alert.use-case.js';
import type { AlertNotification } from '#domain/value-objects/alert-notification.value-object.js';
import type { CheckResult } from '#domain/value-objects/check-result.value-object.js';
import type { MonitorConfig } from '#domain/value-objects/monitor-config.value-object.js';

const config: MonitorConfig = {
    checkInterval: '*/5 * * * *',
    timezone: 'America/Bogota',
    maxConsecutiveFailures: 2,
    alertReminderMinutes: 60
};

/**
 * Fake check use case: every URL is "up" unless it is listed in `down`.
 * It updates the service like the real CheckUseCase does.
 */
class FakeCheck {
    down = new Set<string>();
    calls: string[] = [];
    gate: Promise<void> | null = null;

    async execute(service: Service): Promise<CheckResult> {
        this.calls.push(service.url);
        if (this.gate) await this.gate;

        const success = !this.down.has(service.url);
        service.updateStatus(success);

        return {
            success,
            statusCode: success ? 200 : 500,
            message: success ? 'Service is up (200)' : 'Service returned error status 500',
            timestamp: new Date(),
            responseTime: 1
        };
    }
}

/** Fake email use case that records notifications and can be forced to fail */
class FakeEmail {
    sent: AlertNotification[] = [];
    failing = false;

    async execute(notification: AlertNotification): Promise<void> {
        if (this.failing) throw new Error('SMTP unavailable');
        this.sent.push(notification);
    }
}

const urlOf = (name: string) => `https://example.com/${name}/`;
const serviceConfigs = (...names: string[]): ServiceConfig[] => names.map(name => ({ name, url: urlOf(name) }));

describe('MonitorService', () => {
    let check: FakeCheck;
    let email: FakeEmail;

    const createMonitor = (names: string[], options: MonitorServiceOptions = {}) => {
        const monitor = new MonitorService(
            check as unknown as CheckUseCase,
            email as unknown as SendEmailAlert,
            config,
            options
        );
        monitor.addServices(serviceConfigs(...names).map(serviceConfig => new Service(serviceConfig)));
        return monitor;
    };

    beforeEach(() => {
        check = new FakeCheck();
        email = new FakeEmail();
        mock.method(console, 'log', () => {});
        mock.method(console, 'warn', () => {});
        mock.method(console, 'error', () => {});
    });

    afterEach(() => {
        mock.restoreAll();
    });

    describe('alerts', () => {
        it('sends a single down alert when the threshold is reached, not on every cycle', async () => {
            const monitor = createMonitor(['a']);
            check.down.add(urlOf('a'));

            await monitor.checkAllServices(); // failure 1: below the threshold
            assert.equal(email.sent.length, 0);

            await monitor.checkAllServices(); // failure 2: threshold reached
            await monitor.checkAllServices();
            await monitor.checkAllServices();

            assert.equal(email.sent.length, 1);
            assert.equal(email.sent[0].type, 'down');
            assert.equal(email.sent[0].serviceName, 'a');
            assert.match(email.sent[0].detail, /Fallos consecutivos: 2/);
            assert.ok(email.sent[0].downSince);
        });

        it('sends one recovery notice when the service comes back, and nothing afterwards', async () => {
            const monitor = createMonitor(['a']);
            check.down.add(urlOf('a'));
            await monitor.checkAllServices();
            await monitor.checkAllServices();

            check.down.clear();
            await monitor.checkAllServices();
            await monitor.checkAllServices();

            assert.deepEqual(email.sent.map(n => n.type), ['down', 'recovery']);
            assert.ok(email.sent[1].downSince, 'the recovery notice reports when the incident started');
            assert.equal(monitor.getServices()[0].hasOpenIncident, false);
        });

        it('does not send a recovery notice when no alert was sent before', async () => {
            const monitor = createMonitor(['a']);
            check.down.add(urlOf('a'));
            await monitor.checkAllServices(); // a single failure, below the threshold

            check.down.clear();
            await monitor.checkAllServices();

            assert.equal(email.sent.length, 0);
        });

        it('sends a reminder once the reminder interval has elapsed', async () => {
            const monitor = createMonitor(['a']);
            check.down.add(urlOf('a'));
            await monitor.checkAllServices();
            await monitor.checkAllServices();
            assert.equal(email.sent.length, 1);

            const service = monitor.getServices()[0];
            service.lastAlertAt = new Date(Date.now() - 61 * 60_000);
            await monitor.checkAllServices();

            assert.deepEqual(email.sent.map(n => n.type), ['down', 'reminder']);

            await monitor.checkAllServices(); // the reminder timer restarted
            assert.equal(email.sent.length, 2);
        });

        it('retries on the next cycle when the email could not be delivered', async () => {
            const monitor = createMonitor(['a']);
            check.down.add(urlOf('a'));
            email.failing = true;

            await monitor.checkAllServices();
            await monitor.checkAllServices(); // threshold reached but delivery fails
            assert.equal(email.sent.length, 0);
            assert.equal(monitor.getServices()[0].hasOpenIncident, false);

            email.failing = false;
            await monitor.checkAllServices();

            assert.deepEqual(email.sent.map(n => n.type), ['down']);
            assert.equal(monitor.getServices()[0].hasOpenIncident, true);
        });

        it('keeps the incident open and retries when the recovery notice fails', async () => {
            const monitor = createMonitor(['a']);
            check.down.add(urlOf('a'));
            await monitor.checkAllServices();
            await monitor.checkAllServices();

            check.down.clear();
            email.failing = true;
            await monitor.checkAllServices();
            assert.equal(monitor.getServices()[0].hasOpenIncident, true);

            email.failing = false;
            await monitor.checkAllServices();

            assert.deepEqual(email.sent.map(n => n.type), ['down', 'recovery']);
        });

        it('tracks each service independently', async () => {
            const monitor = createMonitor(['a', 'b']);
            check.down.add(urlOf('b'));

            await monitor.checkAllServices();
            await monitor.checkAllServices();

            assert.deepEqual(email.sent.map(n => n.serviceName), ['b']);
        });
    });

    describe('cycles', () => {
        it('skips a cycle that starts while the previous one is still running', async () => {
            let cycles = 0;
            const monitor = createMonitor(['a'], { onCycleComplete: () => { cycles++; } });
            let release!: () => void;
            check.gate = new Promise<void>(resolve => { release = resolve; });

            const first = monitor.checkAllServices();
            await monitor.checkAllServices(); // returns immediately: skipped
            assert.equal(check.calls.length, 1);

            release();
            await first;
            assert.equal(cycles, 1, 'only the completed cycle triggers the hook');

            await monitor.checkAllServices();
            assert.equal(check.calls.length, 2);
        });

        it('keeps checking the other services when one of them throws', async () => {
            const monitor = createMonitor(['a', 'b']);
            const original = check.execute.bind(check);
            check.execute = async service => {
                if (service.name === 'a') throw new Error('boom');
                return original(service);
            };

            await monitor.checkAllServices();

            assert.equal(monitor.getServices().find(s => s.name === 'b')?.status, 'up');
        });

        it('does not fail the cycle when the completion hook throws', async () => {
            const monitor = createMonitor(['a'], { onCycleComplete: () => { throw new Error('hook'); } });

            await monitor.checkAllServices();
            await monitor.checkAllServices();

            assert.equal(check.calls.length, 2);
        });
    });

    describe('syncServices', () => {
        it('reloads the list on every cycle and keeps the state of the services that remain', async () => {
            let current = serviceConfigs('a', 'b');
            const monitor = createMonitor(['a', 'b'], { loadServices: () => current });
            check.down.add(urlOf('a'));
            await monitor.checkAllServices();
            await monitor.checkAllServices();
            const kept = monitor.getServices().find(s => s.name === 'a')!;
            assert.equal(kept.consecutiveFailures, 2);
            assert.equal(email.sent.length, 1);

            // b removed, c added, a renamed
            current = [{ name: 'a renamed', url: urlOf('a') }, ...serviceConfigs('c')];
            await monitor.checkAllServices();

            const services = monitor.getServices();
            assert.deepEqual(services.map(s => s.name), ['a renamed', 'c']);
            assert.equal(services[0], kept, 'the same entity is reused');
            assert.equal(services[0].consecutiveFailures, 3);
            assert.equal(services[1].consecutiveFailures, 0);
            assert.equal(email.sent.length, 1, 'the open incident prevents a new down alert');
        });

        it('applies updated validation rules to the services that remain', async () => {
            let current: ServiceConfig[] = [{ name: 'a', url: urlOf('a') }];
            const monitor = createMonitor(['a'], { loadServices: () => current });
            current = [{ name: 'a', url: urlOf('a'), contentValidation: { expectedTitle: 'New' } }];

            monitor.syncServices();

            assert.deepEqual(monitor.getServices()[0].contentValidation, { expectedTitle: 'New' });
        });

        it('keeps the previous list when the source is invalid', async () => {
            let broken = false;
            const monitor = createMonitor(['a', 'b'], {
                loadServices: () => {
                    if (broken) throw new Error('services.json is not valid JSON');
                    return serviceConfigs('a', 'b');
                }
            });
            await monitor.checkAllServices();

            broken = true;
            await monitor.checkAllServices();

            assert.deepEqual(monitor.getServices().map(s => s.name), ['a', 'b']);
            assert.equal(check.calls.length, 4, 'both cycles still checked both services');
        });
    });
});
