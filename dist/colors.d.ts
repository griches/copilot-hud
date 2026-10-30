export declare const RESET: string;
export declare function colorize(text: string, color: string): string;
export declare function dim(text: string): string;
export declare function bold(text: string): string;
/** Build a percent → color function for a bar that escalates at two thresholds. */
export declare function levelColor(warnAt: number, criticalAt: number, ok: string, warn: string, critical: string): (percent: number) => string;
/**
 * Render text with a per-character rainbow gradient, optionally on a background color.
 * Pass bgColor = 'none' (or '') to disable the background while keeping the gradient.
 */
export declare function rainbow(text: string, bgColor?: string): string;
export declare function renderBar(percent: number, width: number, colorFn: (p: number) => string, style?: string): string;
