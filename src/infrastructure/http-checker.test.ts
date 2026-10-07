import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';

import { HttpChecker } from './http-checker.js';

const SPA_HTML = `<!doctype html><html><head><title>Mi App 2026</title>
<script type="module" crossorigin src="./assets/app.js"></script>
<link rel="stylesheet" href="./assets/app.css">
<link rel="icon" href="./favicon.png"></head><body><div id="root"></div></body></html>`;

const NGINX_ERROR = (code: string) =>
    `<html>\r\n<head><title>${code}</title></head>\r\n<body>\r\n<center><h1>${code}</h1></center>\r\n<hr><center>nginx/1.24.0 (Ubuntu)</center>\r\n</body>\r\n</html>\r\n`;

describe('HttpChecker', () => {
    let server: http.Server;
    let base: string;
    const checker = new HttpChecker(2000);

    before(async () => {
        server = http.createServer((req, res) => {
            const html = (body: string, status = 200) => {
                res.writeHead(status, { 'content-type': 'text/html' });
                res.end(body);
            };

            switch (req.url) {
                case '/ok/': return html(SPA_HTML);
                case '/ok/assets/app.js': return res.writeHead(200, { 'content-type': 'text/javascript' }).end('//js');
                case '/ok/assets/app.css': return res.writeHead(200, { 'content-type': 'text/css' }).end('/*css*/');
                case '/broken-assets/': return html(SPA_HTML);
                case '/broken-assets/assets/app.js': return res.writeHead(200).end('//js');
                case '/external-assets/':
                    return html('<html><head><title>Mi App 2026</title><script src="https://cdn.invalid/lib.js"></script></head></html>');
                case '/no-title/': return html('<html><body>Sin titulo</body></html>');
                case '/forbidden/': return html(NGINX_ERROR('403 Forbidden'), 403);
                case '/autoindex/':
                    return html('<html><head><title>Index of /sitio/</title></head><body><h1>Index of /sitio/</h1><hr><pre></pre></body></html>');
                case '/welcome/': return html('<!DOCTYPE html><html><head><title>Welcome to nginx!</title></head></html>');
                case '/soft404/': return html('<html><head><title>Página no encontrada</title></head></html>');
                case '/redirect/': return res.writeHead(301, { location: '/ok/' }).end();
                case '/stall/':
                    // Headers and a partial body are sent, but the body never ends
                    res.writeHead(200, { 'content-type': 'text/html' });
                    res.write('<html><head><title>Mi App');
                    return;
                default: return html(NGINX_ERROR('404 Not Found'), 404);
            }
        });

        await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
        base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    });

    after(() => {
        server.closeAllConnections();
        server.close();
    });

    it('reports success for a 200 page without validation rules', async () => {
        const result = await checker.check(`${base}/ok/`);

        assert.equal(result.success, true);
        assert.equal(result.statusCode, 200);
    });

    it('reports failure with the status code for 404 and 403', async () => {
        const notFound = await checker.check(`${base}/missing/`);
        const forbidden = await checker.check(`${base}/forbidden/`);

        assert.equal(notFound.success, false);
        assert.equal(notFound.statusCode, 404);
        assert.equal(forbidden.success, false);
        assert.equal(forbidden.statusCode, 403);
    });

    describe('expectedTitle', () => {
        it('matches a substring ignoring case', async () => {
            const result = await checker.check(`${base}/ok/`, { expectedTitle: 'mi app' });

            assert.equal(result.success, true);
        });

        it('fails and reports the actual title when it does not match', async () => {
            const result = await checker.check(`${base}/ok/`, { expectedTitle: 'Otra Cosa' });

            assert.equal(result.success, false);
            assert.equal(result.statusCode, 200);
            assert.match(result.message, /Unexpected page title "Mi App 2026"/);
        });

        it('fails when the page has no title', async () => {
            const result = await checker.check(`${base}/no-title/`, { expectedTitle: 'Mi App' });

            assert.equal(result.success, false);
            assert.match(result.message, /Unexpected page title ""/);
        });
    });

    describe('checkForDirectoryListing', () => {
        it('detects an nginx autoindex page', async () => {
            const result = await checker.check(`${base}/autoindex/`, { checkForDirectoryListing: true });

            assert.equal(result.success, false);
            assert.match(result.message, /Directory listing detected/);
        });

        it('ignores the listing when the option is off', async () => {
            const result = await checker.check(`${base}/autoindex/`, {});

            assert.equal(result.success, true);
        });

        it('does not flag a normal page', async () => {
            const result = await checker.check(`${base}/ok/`, { checkForDirectoryListing: true });

            assert.equal(result.success, true);
        });
    });

    describe('forbiddenText', () => {
        it('detects the nginx default page', async () => {
            const result = await checker.check(`${base}/welcome/`, { forbiddenText: ['Welcome to nginx!'] });

            assert.equal(result.success, false);
            assert.match(result.message, /Welcome to nginx!/);
        });

        it('detects a soft 404 ignoring case', async () => {
            const result = await checker.check(`${base}/soft404/`, { forbiddenText: ['página no encontrada'] });

            assert.equal(result.success, false);
        });

        it('passes when none of the texts appear', async () => {
            const result = await checker.check(`${base}/ok/`, { forbiddenText: ['Welcome to nginx!', 'Página no encontrada'] });

            assert.equal(result.success, true);
        });
    });

    describe('checkAssets', () => {
        it('passes when scripts and stylesheets respond OK', async () => {
            const result = await checker.check(`${base}/ok/`, { checkAssets: true });

            assert.equal(result.success, true);
        });

        it('fails and names the asset that is missing', async () => {
            const result = await checker.check(`${base}/broken-assets/`, { checkAssets: true });

            assert.equal(result.success, false);
            assert.equal(result.statusCode, 200);
            // app.js responds 200 in this fixture; only the stylesheet is missing
            assert.match(result.message, /Failed to load assets: \/broken-assets\/assets\/app\.css \(404\)/);
            assert.doesNotMatch(result.message, /app\.js/);
        });

        it('ignores assets served from other origins', async () => {
            const result = await checker.check(`${base}/external-assets/`, { checkAssets: true });

            assert.equal(result.success, true);
        });

        it('resolves assets against the final URL after a redirect', async () => {
            const result = await checker.check(`${base}/redirect/`, { checkAssets: true });

            assert.equal(result.success, true);
        });

        it('does not request assets when the option is off', async () => {
            const result = await checker.check(`${base}/broken-assets/`, {});

            assert.equal(result.success, true);
        });
    });

    describe('timeouts and network errors', () => {
        it('times out when the body never finishes', async () => {
            const slow = new HttpChecker(300);
            const startedAt = Date.now();

            const result = await slow.check(`${base}/stall/`);

            assert.equal(result.success, false);
            assert.match(result.message, /timed out after 300ms/);
            assert.ok(Date.now() - startedAt < 1500, 'the check must end close to the timeout');
        });

        it('reports the network error code when the connection is refused', async () => {
            const closed = http.createServer();
            await new Promise<void>(resolve => closed.listen(0, '127.0.0.1', resolve));
            const { port } = closed.address() as AddressInfo;
            await new Promise<void>(resolve => closed.close(() => resolve()));

            const result = await checker.check(`http://127.0.0.1:${port}/`);

            assert.equal(result.success, false);
            assert.equal(result.statusCode, undefined);
            assert.match(result.message, /ECONNREFUSED/);
        });
    });
});
