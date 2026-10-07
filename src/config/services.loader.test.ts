import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import { loadServicesConfig, parseServicesConfig, ServicesConfigError } from './services.loader.js';

const validFile = {
    defaults: {
        contentValidation: { checkForDirectoryListing: true, forbiddenText: ['Welcome to nginx!'] }
    },
    services: [
        { name: 'App A', url: 'https://example.com/a/', contentValidation: { expectedTitle: 'App A', checkAssets: true } },
        { name: 'App B', url: 'https://example.com/b/' }
    ]
};

function messageOf(raw: unknown): string {
    try {
        parseServicesConfig(raw, 'services.json');
    } catch (error) {
        assert.ok(error instanceof ServicesConfigError);
        return error.message;
    }
    assert.fail('Expected a ServicesConfigError');
}

describe('parseServicesConfig', () => {
    it('returns the services and merges each contentValidation over the defaults', () => {
        const configs = parseServicesConfig(validFile, 'services.json');

        assert.equal(configs.length, 2);
        assert.deepEqual(configs[0], {
            name: 'App A',
            url: 'https://example.com/a/',
            contentValidation: {
                checkForDirectoryListing: true,
                forbiddenText: ['Welcome to nginx!'],
                expectedTitle: 'App A',
                checkAssets: true
            }
        });
        assert.deepEqual(configs[1].contentValidation, validFile.defaults.contentValidation);
    });

    it('lets a service override a default', () => {
        const configs = parseServicesConfig({
            ...validFile,
            services: [{ name: 'X', url: 'https://example.com/', contentValidation: { checkForDirectoryListing: false } }]
        }, 'services.json');

        assert.equal(configs[0].contentValidation?.checkForDirectoryListing, false);
        assert.deepEqual(configs[0].contentValidation?.forbiddenText, ['Welcome to nginx!']);
    });

    it('accepts a file without defaults and without validation', () => {
        const configs = parseServicesConfig({ services: [{ name: 'X', url: 'http://example.com' }] }, 'services.json');

        assert.deepEqual(configs, [{ name: 'X', url: 'http://example.com', contentValidation: undefined }]);
    });

    it('trims names and URLs', () => {
        const configs = parseServicesConfig({ services: [{ name: '  X ', url: ' https://example.com/ ' }] }, 'services.json');

        assert.equal(configs[0].name, 'X');
        assert.equal(configs[0].url, 'https://example.com/');
    });

    it('rejects a root that is not an object', () => {
        assert.match(messageOf([]), /root must be an object/);
        assert.match(messageOf(null), /root must be an object/);
    });

    it('rejects an empty or missing services list', () => {
        assert.match(messageOf({ services: [] }), /services: must be a non-empty array/);
        assert.match(messageOf({}), /services: must be a non-empty array/);
    });

    it('rejects a missing name and an invalid URL', () => {
        const message = messageOf({ services: [{ name: '', url: 'not a url' }, { name: 'FTP', url: 'ftp://example.com/' }] });

        assert.match(message, /services\[0\]\.name/);
        assert.match(message, /services\[0\]\.url: must be a valid http\(s\) URL/);
        assert.match(message, /services\[1\]\.url: must be a valid http\(s\) URL/);
    });

    it('rejects duplicated URLs', () => {
        const message = messageOf({
            services: [{ name: 'A', url: 'https://example.com/' }, { name: 'B', url: 'https://example.com/' }]
        });

        assert.match(message, /services\[1\]\.url: duplicated URL/);
    });

    it('rejects unknown keys so typos are caught', () => {
        const message = messageOf({
            services: [{ name: 'A', url: 'https://example.com/', contentValidation: { expectedTitel: 'A' } }],
            default: {}
        });

        assert.match(message, /unknown key "expectedTitel"/);
        assert.match(message, /root: unknown key "default"/);
    });

    it('rejects values of the wrong type', () => {
        const message = messageOf({
            services: [{
                name: 'A',
                url: 'https://example.com/',
                contentValidation: { expectedTitle: '', checkAssets: 'yes', forbiddenText: 'Welcome' }
            }]
        });

        assert.match(message, /expectedTitle: must be a non-empty string/);
        assert.match(message, /checkAssets: must be true or false/);
        assert.match(message, /forbiddenText: must be an array of non-empty strings/);
    });

    it('reports every problem in a single error', () => {
        const message = messageOf({ services: [{ name: '', url: 'x' }, { url: 'https://example.com/' }] });

        assert.equal(message.split('\n').filter(line => line.startsWith('  - ')).length, 3);
    });
});

describe('loadServicesConfig', () => {
    let dir: string;

    before(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'services-loader-'));
    });

    after(() => {
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('loads a valid file', () => {
        const file = path.join(dir, 'ok.json');
        fs.writeFileSync(file, JSON.stringify(validFile));

        assert.equal(loadServicesConfig(file).length, 2);
    });

    it('loads a file that starts with a UTF-8 BOM', () => {
        const file = path.join(dir, 'bom.json');
        fs.writeFileSync(file, '﻿' + JSON.stringify(validFile));

        assert.equal(loadServicesConfig(file).length, 2);
    });

    it('explains how to create a missing file', () => {
        assert.throws(
            () => loadServicesConfig(path.join(dir, 'missing.json')),
            (error: Error) => error instanceof ServicesConfigError && /not found/.test(error.message) && /services\.example\.json/.test(error.message)
        );
    });

    it('reports invalid JSON', () => {
        const file = path.join(dir, 'broken.json');
        fs.writeFileSync(file, '{ "services": [ ');

        assert.throws(() => loadServicesConfig(file), /broken\.json is not valid JSON/);
    });

    it('reports invalid content with the file name', () => {
        const file = path.join(dir, 'invalid.json');
        fs.writeFileSync(file, JSON.stringify({ services: [] }));

        assert.throws(() => loadServicesConfig(file), /invalid\.json is invalid/);
    });

    it('accepts the example file shipped with the repository', () => {
        const configs = loadServicesConfig(path.join(process.cwd(), 'services.example.json'));

        assert.ok(configs.length > 0);
    });
});
