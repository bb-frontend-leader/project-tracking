import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { escapeHtml } from './escape-html.js';
import { formatDuration } from './format-duration.js';

describe('escapeHtml', () => {
    it('escapes the characters with special meaning in HTML', () => {
        assert.equal(escapeHtml(`<a href="x">Tom & 'Jerry'</a>`), '&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/a&gt;');
    });

    it('leaves plain text untouched', () => {
        assert.equal(escapeHtml('Service returned error status 404'), 'Service returned error status 404');
    });
});

describe('formatDuration', () => {
    const MINUTE = 60_000;

    it('formats minutes, hours and days', () => {
        assert.equal(formatDuration(30_000), 'menos de 1 min');
        assert.equal(formatDuration(35 * MINUTE), '35 min');
        assert.equal(formatDuration(120 * MINUTE), '2 h');
        assert.equal(formatDuration(135 * MINUTE), '2 h 15 min');
        assert.equal(formatDuration(27 * 60 * MINUTE), '1 d 3 h');
        assert.equal(formatDuration(24 * 60 * MINUTE), '1 d');
    });

    it('treats negative durations as zero', () => {
        assert.equal(formatDuration(-5 * MINUTE), 'menos de 1 min');
    });
});
