import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Service } from './service.entity.js';

const at = (iso: string) => new Date(iso);

describe('Service', () => {
    const create = () => new Service({ name: 'Demo', url: 'https://example.com/demo/' });

    it('starts as unknown with no failures and no incident', () => {
        const service = create();

        assert.equal(service.status, 'unknown');
        assert.equal(service.consecutiveFailures, 0);
        assert.equal(service.downSince, null);
        assert.equal(service.hasOpenIncident, false);
        assert.ok(service.id);
    });

    it('counts consecutive failures and resets them on success', () => {
        const service = create();

        service.updateStatus(false);
        service.updateStatus(false);
        assert.equal(service.status, 'down');
        assert.equal(service.consecutiveFailures, 2);

        service.updateStatus(true);
        assert.equal(service.status, 'up');
        assert.equal(service.consecutiveFailures, 0);
        assert.ok(service.lastSuccessfulCheck);
    });

    it('records the start of the incident at the first failure only', () => {
        const service = create();

        service.updateStatus(false, at('2026-10-07T10:00:00Z'));
        service.updateStatus(false, at('2026-10-07T10:05:00Z'));

        assert.deepEqual(service.downSince, at('2026-10-07T10:00:00Z'));
    });

    it('forgets the incident on recovery when no alert was sent', () => {
        const service = create();

        service.updateStatus(false, at('2026-10-07T10:00:00Z'));
        service.updateStatus(true, at('2026-10-07T10:05:00Z'));

        assert.equal(service.downSince, null);
    });

    it('keeps the incident after recovery until the recovery notice is sent', () => {
        const service = create();

        service.updateStatus(false, at('2026-10-07T10:00:00Z'));
        service.markAlerted(at('2026-10-07T10:05:00Z'));
        service.updateStatus(true, at('2026-10-07T10:10:00Z'));

        assert.equal(service.hasOpenIncident, true);
        assert.deepEqual(service.downSince, at('2026-10-07T10:00:00Z'));

        service.clearIncident();

        assert.equal(service.hasOpenIncident, false);
        assert.equal(service.downSince, null);
    });
});
