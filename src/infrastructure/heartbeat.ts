/**
 * Creates a function that pings a heartbeat URL (e.g. healthchecks.io)
 *
 * The monitor calls it after every completed check cycle. If pings stop arriving,
 * the external service raises an alert: that is how a dead monitor is detected.
 * Ping failures are logged and never interrupt monitoring.
 *
 * @param url - Heartbeat URL (when undefined, no heartbeat is configured)
 * @param timeout - Maximum time in milliseconds for each ping (default: 10000)
 * @returns The ping function, or undefined when no URL is configured
 */
export function createHeartbeat(url: string | undefined, timeout: number = 10000): (() => Promise<void>) | undefined {
    if (!url) return undefined;

    return async () => {
        try {
            const response = await fetch(url, {
                method: 'GET',
                signal: AbortSignal.timeout(timeout),
                headers: { 'User-Agent': 'Website-Monitor/1.0' }
            });
            await response.body?.cancel();

            if (!response.ok) {
                console.warn(`⚠️  Heartbeat respondió con estado ${response.status}`);
            }
        } catch (error) {
            console.warn('⚠️  No se pudo enviar el heartbeat:', error instanceof Error ? error.message : error);
        }
    };
}
