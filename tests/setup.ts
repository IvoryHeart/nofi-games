// Mock Canvas 2D context for jsdom environment
const noop = () => {};
const noopReturn = () => ({});

function createMockContext(): CanvasRenderingContext2D {
  return {
    // State
    canvas: document.createElement('canvas'),
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    miterLimit: 10,
    lineDashOffset: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    shadowBlur: 0,
    shadowColor: 'rgba(0,0,0,0)',
    font: '10px sans-serif',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    direction: 'inherit',
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'low',
    filter: 'none',
    fontKerning: 'auto',
    fontStretch: 'normal',
    fontVariantCaps: 'normal',
    letterSpacing: '0px',
    textRendering: 'auto',
    wordSpacing: '0px',

    // Methods
    save: noop,
    restore: noop,
    scale: noop,
    rotate: noop,
    translate: noop,
    transform: noop,
    setTransform: noop as any,
    resetTransform: noop,
    getTransform: () => new DOMMatrix(),
    createLinearGradient: () => ({ addColorStop: noop }) as any,
    createRadialGradient: () => ({ addColorStop: noop }) as any,
    createConicGradient: () => ({ addColorStop: noop }) as any,
    createPattern: () => null,
    clearRect: noop,
    fillRect: noop,
    strokeRect: noop,
    beginPath: noop,
    fill: noop,
    stroke: noop,
    clip: noop as any,
    isPointInPath: () => false as any,
    isPointInStroke: () => false as any,
    drawFocusIfNeeded: noop as any,
    moveTo: noop,
    lineTo: noop,
    quadraticCurveTo: noop,
    bezierCurveTo: noop,
    arcTo: noop,
    rect: noop,
    roundRect: noop,
    arc: noop,
    ellipse: noop,
    closePath: noop,
    fillText: noop,
    strokeText: noop,
    measureText: () => ({ width: 0, actualBoundingBoxAscent: 0, actualBoundingBoxDescent: 0, actualBoundingBoxLeft: 0, actualBoundingBoxRight: 0, fontBoundingBoxAscent: 0, fontBoundingBoxDescent: 0, alphabeticBaseline: 0, emHeightAscent: 0, emHeightDescent: 0, hangingBaseline: 0, ideographicBaseline: 0 }) as TextMetrics,
    drawImage: noop as any,
    createImageData: (() => ({ width: 0, height: 0, data: new Uint8ClampedArray(), colorSpace: 'srgb' })) as any,
    getImageData: () => ({ width: 0, height: 0, data: new Uint8ClampedArray(), colorSpace: 'srgb' }) as any,
    putImageData: noop as any,
    setLineDash: noop,
    getLineDash: () => [],
    getContextAttributes: () => ({ alpha: true, colorSpace: 'srgb', desynchronized: false, willReadFrequently: false }),
    reset: noop,
  } as unknown as CanvasRenderingContext2D;
}

// Monkey-patch HTMLCanvasElement.prototype.getContext
const originalGetContext = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function(contextId: string, ...args: any[]) {
  if (contextId === '2d') {
    const ctx = createMockContext();
    (ctx as any).canvas = this;
    return ctx;
  }
  return originalGetContext.call(this, contextId, ...args);
} as any;
