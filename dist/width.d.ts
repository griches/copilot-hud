export declare function stripAnsi(text: string): string;
/** Never dropped, however narrow the terminal gets. */
export declare const KEEP = 0;
export interface Segment {
    text: string;
    /** KEEP (0) pins the segment; higher numbers are dropped first. */
    priority: number;
}
/** Display width of a string, ignoring ANSI escape sequences. */
export declare function visibleWidth(text: string): number;
/**
 * Cut a string to `max` visible columns, appending `…` when anything was
 * removed. Escape sequences are preserved verbatim, and a reset is appended so
 * a truncated line can never leak color onto the rest of the terminal.
 */
export declare function truncateVisible(text: string, max: number): string;
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
export declare function detectWidth(configured?: number): number | undefined;
/**
 * Join segments with `sep`, dropping the least important ones until the line
 * fits `max` columns. KEEP-priority segments are never dropped; if the line is
 * still too wide once only those remain, it is truncated.
 */
export declare function joinFit(segments: Segment[], sep: string, max?: number): string;
