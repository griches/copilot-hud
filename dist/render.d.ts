import type { RenderContext } from './types.js';
export declare function renderProjectLine(ctx: RenderContext): string;
export declare function renderContextLine(ctx: RenderContext): string | null;
export declare function renderToolsLine(ctx: RenderContext): string | null;
export declare function renderAgentLines(ctx: RenderContext): string[];
export declare function render(ctx: RenderContext): void;
