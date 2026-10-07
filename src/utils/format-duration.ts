/**
 * Formats a duration as a short human-readable string in Spanish
 * @param ms - Duration in milliseconds
 * @returns e.g. "menos de 1 min", "35 min", "2 h 15 min", "1 d 3 h"
 */
export function formatDuration(ms: number): string {
    const totalMinutes = Math.floor(Math.max(ms, 0) / 60_000);

    if (totalMinutes < 1) return 'menos de 1 min';

    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;

    if (days > 0) return hours > 0 ? `${days} d ${hours} h` : `${days} d`;
    if (hours > 0) return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
    return `${minutes} min`;
}
