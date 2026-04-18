/**
 * Returns the last name (with particles) for display in formation circles.
 *
 * Examples:
 *   "Ryan Sessegnon"   → "Sessegnon"
 *   "Raúl Jiménez"    → "Jiménez"
 *   "Virgil van Dijk"  → "van Dijk"
 *   "Kevin De Bruyne"  → "De Bruyne"
 *   "Trent Alexander-Arnold" → "Alexander-Arnold"
 *   "Pelé"             → "Pelé"   (single name returned as-is)
 */
export function formatPlayerName(fullName) {
    if (!fullName) return '';

    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0];

    // Name particles that prefix a surname — keep them attached
    const particles = ['van', 'de', 'di', 'del', 'della', 'da', 'dos', 'la', 'le'];

    // Walk backwards from the second-to-last word; collect particles
    let lastNameStart = parts.length - 1;
    for (let i = parts.length - 2; i >= 0; i--) {
        if (particles.includes(parts[i].toLowerCase())) {
            lastNameStart = i;
        } else {
            break;
        }
    }

    return parts.slice(lastNameStart).join(' ');
}
