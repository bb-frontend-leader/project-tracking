import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { decideAlert } from './decide-alert.js';

const MINUTE = 60_000;
const NOW = new Date('2026-10-07T15:00:00Z');
const config = { maxConsecutiveFailures: 2, alertReminderMinutes: 60 };
const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * MINUTE);

describe('decideAlert', () => {
    describe('while the service is up', () => {
        it('sends nothing when there is no open incident', () => {
            assert.equal(decideAlert({ consecutiveFailures: 0, lastAlertAt: null }, true, NOW, config), null);
        });

        it('sends a recovery notice when an alert was sent before', () => {
            assert.equal(decideAlert({ consecutiveFailures: 0, lastAlertAt: minutesAgo(30) }, true, NOW, config), 'recovery');
        });
    });

    describe('while the service is down', () => {
        it('waits until the failure threshold is reached', () => {
            assert.equal(decideAlert({ consecutiveFailures: 1, lastAlertAt: null }, false, NOW, config), null);
        });

        it('sends the down alert once the threshold is reached', () => {
            assert.equal(decideAlert({ consecutiveFailures: 2, lastAlertAt: null }, false, NOW, config), 'down');
        });

        it('sends the down alert if the threshold was exceeded while no alert had been delivered', () => {
            assert.equal(decideAlert({ consecutiveFailures: 7, lastAlertAt: null }, false, NOW, config), 'down');
        });

        it('does not repeat the alert before the reminder interval', () => {
            assert.equal(decideAlert({ consecutiveFailures: 5, lastAlertAt: minutesAgo(59) }, false, NOW, config), null);
        });

        it('sends a reminder when the interval has elapsed', () => {
            assert.equal(decideAlert({ consecutiveFailures: 5, lastAlertAt: minutesAgo(60) }, false, NOW, config), 'reminder');
            assert.equal(decideAlert({ consecutiveFailures: 50, lastAlertAt: minutesAgo(600) }, false, NOW, config), 'reminder');
        });

        it('never sends reminders when the interval is 0', () => {
            const noReminders = { ...config, alertReminderMinutes: 0 };

            assert.equal(decideAlert({ consecutiveFailures: 50, lastAlertAt: minutesAgo(10_000) }, false, NOW, noReminders), null);
        });
    });
});
