import { loadConfig, resolveConfig, type HudConfig } from './config.js';
import { renderLines } from './render.js';
import { stripAnsi } from './width.js';
import type { RenderContext } from './types.js';

/**
 * Real HUD output for the looks offered by setup and configure, drawn from
 * sample data by the actual renderer so an example can't drift from the code.
 */
const LOOKS: Array<{ preset: string; title: string; summary: string }> = [
  { preset: 'standard', title: 'Standard', summary: 'the default' },
  { preset: 'compact', title: 'Compact', summary: 'one line, plus agents while they run' },
  { preset: 'minimal', title: 'Minimal', summary: 'the essentials on two lines, plus agents while they run' },
  { preset: 'full', title: 'Full', summary: 'everything, including the quota forecast' },
];

function sampleContext(config: HudConfig, now: number, width?: number): RenderContext {
  const sessionId = 'preview';
  return {
    config,
    now,
    width,
    gitStatus: {
      branch: 'main',
      dirty: true,
      ahead: 2,
      behind: 0,
      fileStats: { modified: 3, added: 1, deleted: 0, untracked: 4 },
    },
    quota: {
      updatedAt: now,
      quotas: [{
        id: 'premium_interactions',
        unlimited: false,
        used: 3000,
        entitlement: 7500,
        usedPercentage: 40,
        // Five days into the month, which is too fast and shows off the pace flag.
        resetDate: new Date(now + 25 * 86_400_000).toISOString(),
        overage: 0,
      }],
    },
    session: {
      session_id: sessionId,
      session_name: 'Creating README',
      cwd: `${process.env.HOME ?? ''}/projects/my-project`,
      model: {
        id: 'claude-sonnet-4.6',
        display_name: 'claude-sonnet-4.6 (1x) (medium)',
        reasoningEffort: 'medium',
      },
      context_window: {
        context_window_size: 200_000,
        remaining_tokens: 130_000,
        used_percentage: 35,
        total_input_tokens: 1_500_000,
        total_output_tokens: 12_200,
        total_cache_read_tokens: 1_400_000,
        total_cache_write_tokens: 0,
        last_call_input_tokens: 76_000,
        last_call_output_tokens: 200,
      },
      cost: {
        total_duration_ms: 300_000,
        total_api_duration_ms: 290_000,
        total_lines_added: 42,
        total_lines_removed: 3,
      },
      ai_used: { total_nano_aiu: 1_420_000_000, formatted: '1.42' },
    },
    state: {
      sessionId,
      sessionActive: true,
      lastPrompt: 'fix the auth redirect loop',
      lastPromptTime: now - 42_000,
      recentTools: [
        { name: 'view', target: 'src/index.ts', status: 'running', timestamp: now },
        { name: 'edit', target: './auth.ts', status: 'success', timestamp: now - 4_000 },
        { name: 'bash', target: 'git status', status: 'success', timestamp: now - 9_000 },
      ],
      agents: [
        { subagentType: 'explore', description: 'Analyze test coverage', status: 'running', startTime: now - 45_000 },
      ],
    },
  } as RenderContext;
}

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

/**
 * `--current` draws the user's own config instead of the looks; `--width N`
 * fits lines to N columns. Color follows the terminal, so an agent capturing
 * this gets clean text it can paste into a code block.
 */
export function renderPreview(args: string[]): string {
  const now = Date.now();
  const width = parseInt(option(args, '--width') ?? '', 10);
  const columns = width > 0 ? width : undefined;
  const color = args.includes('--color') || (Boolean(process.stdout.isTTY) && !process.env.NO_COLOR);

  const blocks = args.includes('--current')
    ? [renderLines(sampleContext(loadConfig(), now, columns))]
    : LOOKS.map(({ preset, title, summary }) => [
      `${title}: ${summary}`,
      ...renderLines(sampleContext(resolveConfig({ preset }), now, columns)),
    ]);

  const text = blocks.map((lines) => lines.join('\n')).join('\n\n');
  return `${color ? text : stripAnsi(text)}\n`;
}
