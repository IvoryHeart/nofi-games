import { createRoot, type Root } from 'react-dom/client';
import { createElement } from 'react';
import { RemixOverlay } from './RemixOverlay';

export interface RemixContext {
  gameId: string;
  gameName: string;
  onExit: () => void;
}

export interface RemixHandle {
  unmount: () => void;
}

export function mountRemix(container: HTMLElement, ctx: RemixContext): RemixHandle {
  const root: Root = createRoot(container);
  root.render(createElement(RemixOverlay, ctx));
  return {
    unmount: () => root.unmount(),
  };
}
