import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

import { FileSystemDatasource } from './file-system.datasource.js';

import { LogEntity, LogStatusEnum } from '#domain/entities/log.entity.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const dayOf = (date: Date, timeZone = 'America/Bogota') =>
    new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);

const createLog = (timestamp: Date, overrides: Partial<ConstructorParameters<typeof LogEntity>[0]> = {}) =>
    new LogEntity({
        timestamp,
        name: 'Demo',
        url: 'https://example.com/demo/',
        status: LogStatusEnum.FAILURE,
        code: 404,
        message: 'Service returned error status 404',
        responseTime: 69,
        ...overrides
    });

describe('FileSystemDatasource', () => {
    let dir: string;

    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-datasource-'));
        mock.method(console, 'log', () => {});
        mock.method(console, 'error', () => {});
    });

    afterEach(() => {
        mock.restoreAll();
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('writes one JSON line per log with an ISO timestamp and a numeric response time', () => {
        const datasource = new FileSystemDatasource({ logDir: dir });
        const timestamp = new Date('2026-10-07T15:30:00Z');

        datasource.saveLog(createLog(timestamp));

        const file = path.join(dir, `monitor-${dayOf(timestamp)}.log`);
        const lines = fs.readFileSync(file, 'utf8').trim().split('\n');
        const parsed = JSON.parse(lines[0]);

        assert.equal(lines.length, 1);
        assert.equal(parsed.timestamp, '2026-10-07T15:30:00.000Z');
        assert.equal(parsed.responseTime, 69);
        assert.equal(parsed.status, 'failure');
        assert.deepEqual(LogEntity.fromJson(lines[0]).timestamp, timestamp);
    });

    it('uses the calendar day of the configured timezone for the file name', () => {
        const datasource = new FileSystemDatasource({ logDir: dir, timezone: 'America/Bogota' });

        // 02:30 UTC is still the previous day in Bogota (UTC-5)
        datasource.saveLog(createLog(new Date('2026-03-15T02:30:00Z')));

        assert.deepEqual(fs.readdirSync(dir).filter(f => f.startsWith('monitor-')), ['monitor-2026-03-14.log']);
    });

    it('appends logs of the same day to the same file', () => {
        const datasource = new FileSystemDatasource({ logDir: dir });
        const timestamp = new Date('2026-10-07T15:30:00Z');

        datasource.saveLog(createLog(timestamp));
        datasource.saveLog(createLog(timestamp, { status: LogStatusEnum.SUCCESS, code: 200 }));

        const file = path.join(dir, `monitor-${dayOf(timestamp)}.log`);
        assert.equal(fs.readFileSync(file, 'utf8').trim().split('\n').length, 2);
    });

    it('creates the log directory when it does not exist', () => {
        const nested = path.join(dir, 'nested', 'logs');

        new FileSystemDatasource({ logDir: nested });

        assert.ok(fs.existsSync(nested));
    });

    it('deletes daily files older than the retention period and keeps everything else', () => {
        const now = new Date();
        const oldFile = `monitor-${dayOf(new Date(now.getTime() - 40 * DAY_MS))}.log`;
        const recentFile = `monitor-${dayOf(new Date(now.getTime() - 5 * DAY_MS))}.log`;
        const todayFile = `monitor-${dayOf(now)}.log`;

        for (const file of [oldFile, recentFile, todayFile, 'monitor.log', 'notes.txt']) {
            fs.writeFileSync(path.join(dir, file), 'x');
        }

        new FileSystemDatasource({ logDir: dir, retentionDays: 30 });

        assert.deepEqual(fs.readdirSync(dir).sort(), [recentFile, todayFile, 'monitor.log', 'notes.txt'].sort());
    });

    it('keeps only the most recent logs in memory', () => {
        const datasource = new FileSystemDatasource({ logDir: dir, maxLogsInMemory: 2 });

        for (const name of ['A', 'B', 'C']) {
            datasource.saveLog(createLog(new Date(), { name }));
        }

        assert.deepEqual(datasource.getLogs().map(log => log.name), ['B', 'C']);
    });
});
