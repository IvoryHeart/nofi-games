import gameEngineRaw from '../../../engine/GameEngine.ts?raw';
import audioRaw from '../../../utils/audio.ts?raw';
import hapticsRaw from '../../../utils/haptics.ts?raw';
import rngRaw from '../../../utils/rng.ts?raw';
import { STORAGE_SCORES_STUB, REGISTRY_STUB } from './stubs';
import { getBootstrapTs, getIndexHtml } from './bootstrap';

export interface SandpackFileMap {
  [path: string]: string;
}

const TEMPLATE_GAME = `
import { GameEngine, GameConfig } from '../engine/GameEngine';

export class TemplateGame extends GameEngine {
  private time = 0;

  init() {
    this.setScore(0);
  }

  update(dt: number) {
    this.time += dt;
  }

  render() {
    this.clear('#FEF0E4');

    const pulse = Math.sin(this.time * 3) * 10 + 40;
    this.drawCircle(this.width / 2, this.height / 2 - 40, pulse, '#8B5E83');

    this.drawText('Hello, new game!', this.width / 2, this.height / 2 + 40, {
      color: '#8B5E83',
      size: 24,
      align: 'center',
    });

    this.drawText(\`Score: \${this.getScore()}\`, this.width / 2, this.height / 2 + 80, {
      color: '#3D2B35',
      size: 16,
      align: 'center',
    });
  }
}
`;

function baseFileMap(): SandpackFileMap {
  return {
    '/src/engine/GameEngine.ts': gameEngineRaw,
    '/src/utils/audio.ts': audioRaw,
    '/src/utils/haptics.ts': hapticsRaw,
    '/src/utils/rng.ts': rngRaw,
    '/src/storage/scores.ts': STORAGE_SCORES_STUB,
    '/src/games/registry.ts': REGISTRY_STUB,
  };
}

export function buildTemplateFileMap(): SandpackFileMap {
  return {
    ...baseFileMap(),
    '/src/game/index.ts': TEMPLATE_GAME,
    '/src/main.ts': getBootstrapTs(),
    '/index.html': getIndexHtml(),
  };
}

export function buildGameFileMap(
  gameFiles: Record<string, string>,
  dependencies?: Record<string, string>,
): SandpackFileMap {
  const files: SandpackFileMap = {
    ...baseFileMap(),
    '/src/main.ts': getBootstrapTs(),
    '/index.html': getIndexHtml(),
  };

  for (const [relativePath, content] of Object.entries(gameFiles)) {
    files[`/src/game/${relativePath}`] = content;
  }

  if (dependencies) {
    for (const [path, content] of Object.entries(dependencies)) {
      files[path] = content;
    }
  }

  return files;
}
