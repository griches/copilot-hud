import { closeSync, openSync } from 'node:fs';
import { isatty, WriteStream } from 'node:tty';
/**
 * Terminal-width fitting for the HUD.
 *
 * Every line the HUD draws is a join of independently rendered, ANSI-colored
 * segments. Without a width budget those lines simply wrap, and a wrapped
 * status line is worse than a truncated one — it pushes the prompt around and
 * the second half lands with no context. So each line declares its segments
 * with a priority, and we drop the least important ones until the line fits.
 *
 * All measurement is on *visible* width: escape sequences cost zero columns,
 * and the wide (double-column) CJK ranges cost two.
 */
// SGR color sequences are all this HUD emits; matching them alone is enough.
const ANSI_PATTERN = /\x1b\[[0-9;]*m/;
export function stripAnsi(text) {
    return text.replace(new RegExp(ANSI_PATTERN, 'g'), '');
}
/** Never dropped, however narrow the terminal gets. */
export const KEEP = 0;
/**
 * Columns occupied by one code point. Covers the common double-width ranges
 * (CJK, Hangul, kana, fullwidth forms) — project paths and session names are
 * routinely non-Latin, and counting those as one column each would under-measure
 * the line and let it wrap anyway.
 */
function charWidth(codePoint) {
    if (codePoint === 0x200b)
        return 0; // zero-width space
    if (codePoint >= 0x0300 && codePoint <= 0x036f)
        return 0; // combining marks
    if ((codePoint >= 0x1100 && codePoint <= 0x115f) // Hangul Jamo
        || (codePoint >= 0x2e80 && codePoint <= 0x303e) // CJK radicals, Kangxi
        || (codePoint >= 0x3041 && codePoint <= 0x33ff) // kana, CJK compatibility
        || (codePoint >= 0x3400 && codePoint <= 0x4dbf) // CJK ext A
        || (codePoint >= 0x4e00 && codePoint <= 0x9fff) // CJK unified
        || (codePoint >= 0xa000 && codePoint <= 0xa4cf) // Yi
        || (codePoint >= 0xac00 && codePoint <= 0xd7a3) // Hangul syllables
        || (codePoint >= 0xf900 && codePoint <= 0xfaff) // CJK compatibility ideographs
        || (codePoint >= 0xfe30 && codePoint <= 0xfe6f) // CJK compatibility forms
        || (codePoint >= 0xff00 && codePoint <= 0xff60) // fullwidth forms
        || (codePoint >= 0xffe0 && codePoint <= 0xffe6)
        || (codePoint >= 0x1f300 && codePoint <= 0x1f64f) // emoji
        || (codePoint >= 0x1f900 && codePoint <= 0x1f9ff)
        || (codePoint >= 0x20000 && codePoint <= 0x3fffd) // CJK ext B+
    ) {
        return 2;
    }
    return 1;
}
/** Display width of a string, ignoring ANSI escape sequences. */
export function visibleWidth(text) {
    let width = 0;
    for (const part of splitAnsi(text)) {
        if (part.escape)
            continue;
        for (const ch of part.text) {
            width += charWidth(ch.codePointAt(0) ?? 0);
        }
    }
    return width;
}
/** Split into escape / literal runs so escapes can be copied without counting. */
function splitAnsi(text) {
    const parts = [];
    let rest = text;
    while (rest.length > 0) {
        const match = rest.match(ANSI_PATTERN);
        if (!match || match.index === undefined) {
            parts.push({ text: rest, escape: false });
            break;
        }
        if (match.index > 0) {
            parts.push({ text: rest.slice(0, match.index), escape: false });
        }
        parts.push({ text: match[0], escape: true });
        rest = rest.slice(match.index + match[0].length);
    }
    return parts;
}
/**
 * Cut a string to `max` visible columns, appending `…` when anything was
 * removed. Escape sequences are preserved verbatim, and a reset is appended so
 * a truncated line can never leak color onto the rest of the terminal.
 */
export function truncateVisible(text, max) {
    if (max <= 0)
        return '';
    if (visibleWidth(text) <= max)
        return text;
    const budget = max - 1; // room for the ellipsis
    let out = '';
    let width = 0;
    for (const part of splitAnsi(text)) {
        if (part.escape) {
            out += part.text;
            continue;
        }
        for (const ch of part.text) {
            const w = charWidth(ch.codePointAt(0) ?? 0);
            if (width + w > budget) {
                return `${out}\x1b[0m…`;
            }
            out += ch;
            width += w;
        }
    }
    return `${out}\x1b[0m…`;
}
function parsePositive(value) {
    if (!value)
        return undefined;
    const n = parseInt(value, 10);
    return Number.isFinite(n) && n > 0 ? n : undefined;
}
/**
 * Best-effort terminal width.
 *
 * The statusline runs with its stdio piped — Copilot captures the output — so
 * `process.stdout.columns` is usually undefined here and we have to work
 * harder. The `/dev/tty` probe is the one that actually fires in a real
 * session: it opens the controlling terminal directly and asks it, without
 * spawning anything. Returns undefined when the width is genuinely unknowable,
 * which callers treat as "don't truncate".
 */
export function detectWidth(configured) {
    if (configured && configured > 0)
        return configured;
    const fromEnv = parsePositive(process.env.COPILOT_HUD_COLUMNS);
    if (fromEnv)
        return fromEnv;
    if (process.stdout.columns)
        return process.stdout.columns;
    if (process.stderr.columns)
        return process.stderr.columns;
    const columns = parsePositive(process.env.COLUMNS);
    if (columns)
        return columns;
    return ttyWidth();
}
/** Ask the controlling terminal directly. POSIX only; silent on failure. */
function ttyWidth() {
    if (process.platform === 'win32')
        return undefined;
    let fd;
    try {
        fd = openSync('/dev/tty', 'r+');
        if (!isatty(fd))
            return undefined;
        const stream = new WriteStream(fd);
        const columns = stream.columns;
        return columns && columns > 0 ? columns : undefined;
    }
    catch {
        return undefined;
    }
    finally {
        if (fd !== undefined) {
            try {
                closeSync(fd);
            }
            catch {
                // already gone
            }
        }
    }
}
/**
 * Join segments with `sep`, dropping the least important ones until the line
 * fits `max` columns. KEEP-priority segments are never dropped; if the line is
 * still too wide once only those remain, it is truncated.
 */
export function joinFit(segments, sep, max) {
    const kept = segments.filter((s) => s.text.length > 0);
    if (kept.length === 0)
        return '';
    const join = (parts) => parts.map((s) => s.text).join(sep);
    if (!max || max <= 0)
        return join(kept);
    const sepWidth = visibleWidth(sep);
    const lineWidth = (parts) => parts.reduce((sum, s) => sum + visibleWidth(s.text), 0)
        + Math.max(0, parts.length - 1) * sepWidth;
    while (lineWidth(kept) > max) {
        // Drop the least important segment; on a tie the rightmost goes first,
        // which keeps the line reading left-to-right in importance order.
        let dropIndex = -1;
        let worst = -Infinity;
        for (let i = 0; i < kept.length; i++) {
            if (kept[i].priority > KEEP && kept[i].priority >= worst) {
                worst = kept[i].priority;
                dropIndex = i;
            }
        }
        if (dropIndex === -1)
            break; // only pinned segments left
        kept.splice(dropIndex, 1);
    }
    return truncateVisible(join(kept), max);
}
