import type { RenderContext } from './types.js';
/**
 * The info lines, arranged by `display.layout`. A segment's priority travels
 * with it, so one moved to another line keeps its place in the drop order.
 */
export declare function renderInfoLines(ctx: RenderContext): string[];
/**
 * The prompt currently being worked on, e.g. `❯ fix the auth redirect (12s)`.
 *
 * The age is time since the prompt was submitted — during a turn that reads as
 * how long Copilot has been working, and afterwards as how long the session has
 * been idle. Timestamps come from the hook payload, so a missing or nonsensical
 * one (clock skew, a hook that never fired) drops the age rather than the line.
 */
export declare function renderPromptLine(ctx: RenderContext): string | null;
export declare function renderToolsLine(ctx: RenderContext): string | null;
export declare function renderAgentLines(ctx: RenderContext): string[];
export declare function renderLines(ctx: RenderContext): string[];
export declare function render(ctx: RenderContext): void;
