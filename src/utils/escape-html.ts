const HTML_ENTITIES: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
};

/**
 * Escapes the characters that have special meaning in HTML
 * Use it for any value interpolated into an HTML template
 * @param value - Raw text
 * @returns Text safe to embed in HTML content or attribute values
 */
export function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, char => HTML_ENTITIES[char]);
}
