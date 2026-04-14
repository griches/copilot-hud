// ANSI color codes
const CODES: Record<string, string> = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
};

export const RESET = CODES.reset;

export function colorize(text: string, color: string): string {
  const code = CODES[color];
  if (!code) {
    const num = parseInt(color, 10);
    if (!Number.isNaN(num) && num >= 0 && num <= 255) {
      return `\x1b[38;5;${num}m${text}${RESET}`;
    }
    return text;
  }
  return `${code}${text}${RESET}`;
}

export function dim(text: string): string {
  return colorize(text, 'dim');
}

export function bold(text: string): string {
  const code = CODES.bold ?? '';
  return `${code}${text}${RESET}`;
}

export function getContextColor(percent: number): string {
  if (percent >= 85) return 'red';
  if (percent >= 70) return 'yellow';
  return 'green';
}

export function getUsageColor(percent: number): string {
  if (percent >= 90) return 'red';
  if (percent >= 75) return 'brightMagenta';
  return 'brightBlue';
}

// 256-color rainbow gradient for per-character coloring
const RAINBOW_COLORS = [196, 208, 220, 226, 190, 154, 118, 82, 49, 43, 37, 33, 27, 63, 99, 135, 171, 207];
const LIGHT_GRAY_BG = '\x1b[48;5;236m'; // subtle dark gray background

export function rainbow(text: string): string {
  let result = '';
  let colorIdx = 0;
  for (const ch of text) {
    if (ch === ' ' || ch === '/') {
      result += `${LIGHT_GRAY_BG}${CODES.dim}${ch}${RESET}`;
    } else {
      const c = RAINBOW_COLORS[colorIdx % RAINBOW_COLORS.length];
      result += `${LIGHT_GRAY_BG}\x1b[38;5;${c}m${ch}${RESET}`;
      colorIdx++;
    }
  }
  return result;
}

export function renderBar(percent: number, width: number, colorFn: (p: number) => string): string {
  const clamped = Math.min(100, Math.max(0, percent));
  const filled = Math.round((clamped / 100) * width);
  const empty = width - filled;
  const color = colorFn(clamped);
  return colorize('█'.repeat(filled), color) + dim('░'.repeat(empty));
}
