export interface BuilderConfig {
  allowedPaths: string;
  allowedDependencies: string[];
  maxFiles: number;
  maxFileSize: number;
  maxTurns: number;
  modelAllowlist: string[];
  systemPromptPath: string;
}

export const DEFAULT_CONFIG: BuilderConfig = {
  allowedPaths: 'src/games/[slug]/**',
  allowedDependencies: ['matter-js', 'howler', 'pixi.js'],
  maxFiles: 20,
  maxFileSize: 50000,
  maxTurns: 50,
  modelAllowlist: ['anthropic/claude-sonnet-4-20250514', 'openai/gpt-4o', 'google/gemini-2.5-pro'],
  systemPromptPath: './prompts/game-builder.md',
};
