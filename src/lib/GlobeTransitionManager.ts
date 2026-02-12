/**
 * GlobeTransitionManager
 *
 * Orchestrates the shared-element transition from Home globe → Map page.
 * Appends DOM overlays directly to document.body so they persist across
 * React Router route changes.
 *
 * Flow:
 *  1. captureGlobe()  – screenshot the Mapbox canvas into a circular overlay
 *  2. Iris-close starts immediately (starfield covers screen)
 *  3. Home navigates after 650 ms
 *  4. morphToTarget() called by Map page → morphs captured globe to viewport center
 *  5. Iris-open reveals the real map underneath
 */

// ── types ──────────────────────────────────────────────────────────────────────
interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ── module state ───────────────────────────────────────────────────────────────
let active = false;
let maskEl: HTMLDivElement | null = null;
let spaceEl: HTMLDivElement | null = null;
let capturedSrc: Rect | null = null;

// ── easing functions ────────────────────────────────────────────────────────────

/** Smooth deceleration – great for "landing" animations */
function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

/** Smooth acceleration – great for "launching" animations */
function easeInQuart(t: number): number {
  return t * t * t * t;
}

/** Smooth S-curve – great for morph/translate animations */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ── helpers ────────────────────────────────────────────────────────────────────

function generateStarShadows(count: number, w: number, h: number): string {
  const shadows: string[] = [];
  for (let i = 0; i < count; i++) {
    const x = Math.round(Math.random() * w);
    const y = Math.round(Math.random() * h);
    const size = Math.random() < 0.3 ? 2 : 1;
    const opacity = (Math.random() * 0.6 + 0.2).toFixed(2);
    shadows.push(`${x}px ${y}px 0 ${size}px rgba(255,255,255,${opacity})`);
  }
  return shadows.join(',');
}

// ── public API ─────────────────────────────────────────────────────────────────

export function captureGlobe(containerEl: HTMLElement): boolean {
  try {
    const canvas = containerEl.querySelector('canvas.mapboxgl-canvas') as HTMLCanvasElement | null;
    if (!canvas) return false;

    const dataURL = canvas.toDataURL('image/png');
    if (!dataURL || dataURL === 'data:,') return false;

    const rect = containerEl.getBoundingClientRect();
    const diameter = Math.min(rect.width, rect.height);
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    capturedSrc = {
      x: cx - diameter / 2,
      y: cy - diameter / 2,
      width: diameter,
      height: diameter,
    };

    // ── mask overlay (z-index 99999) ─────────────────────────────────────────
    maskEl = document.createElement('div');
    maskEl.id = 'globe-transition-mask';
    maskEl.style.cssText = `
      position: fixed; inset: 0; z-index: 99999;
      pointer-events: none;
    `;

    const circleWrap = document.createElement('div');
    circleWrap.id = 'globe-circle-wrap';
    circleWrap.style.cssText = `
      position: absolute;
      left: ${capturedSrc.x}px;
      top: ${capturedSrc.y}px;
      width: ${capturedSrc.width}px;
      height: ${capturedSrc.height}px;
      border-radius: 50%;
      overflow: hidden;
      will-change: transform, opacity;
      box-shadow: 0 0 60px 15px rgba(34,211,238,0.15), 0 0 120px 40px rgba(34,211,238,0.05);
    `;

    const img = document.createElement('img');
    img.src = dataURL;
    img.style.cssText = `
      width: 100%; height: 100%;
      object-fit: cover;
      display: block;
    `;
    circleWrap.appendChild(img);
    maskEl.appendChild(circleWrap);

    // ── space overlay (z-index 99998) ────────────────────────────────────────
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    spaceEl = document.createElement('div');
    spaceEl.id = 'globe-transition-space';
    spaceEl.style.cssText = `
      position: fixed; inset: 0; z-index: 99998;
      background: #050810;
      pointer-events: none;
      opacity: 0;
    `;

    const starLayer = document.createElement('div');
    starLayer.style.cssText = `
      position: absolute; inset: 0;
      width: 1px; height: 1px;
      box-shadow: ${generateStarShadows(300, vw, vh)};
    `;
    spaceEl.appendChild(starLayer);

    const starLayer2 = document.createElement('div');
    starLayer2.style.cssText = `
      position: absolute; inset: 0;
      width: 1px; height: 1px;
      box-shadow: ${generateStarShadows(150, vw, vh)};
      opacity: 0.5;
    `;
    spaceEl.appendChild(starLayer2);

    const styleTag = document.createElement('style');
    styleTag.id = 'globe-transition-styles';
    styleTag.textContent = `
      @keyframes globe-star-drift {
        0%   { transform: translate(0, 0); }
        50%  { transform: translate(-8px, 4px); }
        100% { transform: translate(0, 0); }
      }
      #globe-transition-space > div {
        animation: globe-star-drift 12s ease-in-out infinite;
      }
    `;
    document.head.appendChild(styleTag);

    document.body.appendChild(spaceEl);
    document.body.appendChild(maskEl);

    active = true;
    (window as any).__globeTransition = true;

    runIrisClose();

    return true;
  } catch (e) {
    console.warn('[GlobeTransition] capture failed:', e);
    return false;
  }
}

export function isActive(): boolean {
  return active;
}

/**
 * Morph the circular overlay from its captured position to `targetRect`.
 * Called immediately when the Map page mounts — no need to wait for map load.
 *
 * Uses an S-curve easing with a subtle scale pulse for a premium feel.
 */
export function morphToTarget(
  targetRect: Rect,
  onRevealMap: () => void,
  onComplete: () => void
): void {
  if (!active || !maskEl || !spaceEl || !capturedSrc) {
    onRevealMap();
    onComplete();
    cleanup();
    return;
  }

  const circleWrap = maskEl.querySelector('#globe-circle-wrap') as HTMLDivElement | null;
  if (!circleWrap) {
    onRevealMap();
    onComplete();
    cleanup();
    return;
  }

  const srcCx = capturedSrc.x + capturedSrc.width / 2;
  const srcCy = capturedSrc.y + capturedSrc.height / 2;
  const tgtCx = targetRect.x + targetRect.width / 2;
  const tgtCy = targetRect.y + targetRect.height / 2;

  const dx = tgtCx - srcCx;
  const dy = tgtCy - srcCy;
  const scale = targetRect.width / capturedSrc.width;

  const morphDuration = 700;
  const morphStart = performance.now();

  // Subtle overshoot: scale up ~5% then settle
  const overshoot = 1.05;

  function morphFrame(now: number) {
    const elapsed = now - morphStart;
    const t = Math.min(elapsed / morphDuration, 1);
    const e = easeInOutCubic(t);

    // Position follows S-curve
    const currentDx = dx * e;
    const currentDy = dy * e;

    // Scale: overshoot in the middle, settle at final
    let currentScale: number;
    if (t < 0.6) {
      // Scale up with slight overshoot
      const scaleT = t / 0.6;
      const scaleE = easeOutQuart(scaleT);
      currentScale = 1 + (scale * overshoot - 1) * scaleE;
    } else {
      // Settle from overshoot to final scale
      const settleT = (t - 0.6) / 0.4;
      const settleE = easeOutQuart(settleT);
      currentScale = scale * overshoot + (scale - scale * overshoot) * settleE;
    }

    if (circleWrap) {
      circleWrap.style.transform = `translate(${currentDx}px, ${currentDy}px) scale(${currentScale})`;
      // Subtle glow pulse during morph
      const glowIntensity = Math.sin(t * Math.PI) * 0.3;
      circleWrap.style.boxShadow = `0 0 ${60 + glowIntensity * 80}px ${15 + glowIntensity * 25}px rgba(34,211,238,${0.15 + glowIntensity})`;
    }

    if (t < 1) {
      requestAnimationFrame(morphFrame);
    } else {
      runIrisOpen(() => {
        onRevealMap();
      }, () => {
        onComplete();
        cleanup();
      });
    }
  }

  requestAnimationFrame(morphFrame);
}

export function cleanup(): void {
  if (maskEl) { maskEl.remove(); maskEl = null; }
  if (spaceEl) { spaceEl.remove(); spaceEl = null; }
  const styleTag = document.getElementById('globe-transition-styles');
  if (styleTag) styleTag.remove();
  capturedSrc = null;
  active = false;
  delete (window as any).__globeTransition;
}

// ── internal animations ────────────────────────────────────────────────────────

function runIrisClose(): void {
  if (!spaceEl) return;

  const duration = 700;
  const start = performance.now();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const maxRadius = Math.hypot(vw, vh) / 2;

  // Fade in the space background smoothly
  spaceEl.style.transition = 'opacity 200ms ease-out';
  spaceEl.style.opacity = '1';

  function frame(now: number) {
    if (!spaceEl) return;
    const elapsed = now - start;
    const t = Math.min(elapsed / duration, 1);
    const e = easeInQuart(t);

    const r = Math.max(maxRadius * (1 - e), 0);
    // Soft feathered edge (wider gradient band for smoother look)
    const feather = Math.max(8, r * 0.08);
    const grad = `radial-gradient(circle ${r}px at 50% 50%, transparent 0px, transparent ${Math.max(r - feather, 0)}px, rgba(5,8,16,1) ${r + feather}px)`;
    spaceEl.style.maskImage = grad;
    spaceEl.style.webkitMaskImage = grad;

    if (t < 1) {
      requestAnimationFrame(frame);
    }
  }

  requestAnimationFrame(frame);
}

function runIrisOpen(onReveal: () => void, onComplete: () => void): void {
  if (!spaceEl || !maskEl) {
    onReveal();
    onComplete();
    return;
  }

  const duration = 600;
  const start = performance.now();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const maxRadius = Math.hypot(vw, vh) / 2;

  let revealed = false;

  function frame(now: number) {
    if (!spaceEl) return;
    const elapsed = now - start;
    const t = Math.min(elapsed / duration, 1);
    const e = easeOutQuart(t);

    const radius = maxRadius * e;
    // Soft feathered edge for smooth reveal
    const feather = Math.max(8, radius * 0.06);
    const grad = `radial-gradient(circle ${radius}px at 50% 50%, transparent 0px, transparent ${Math.max(radius - feather, 0)}px, rgba(5,8,16,1) ${radius + feather}px)`;
    spaceEl.style.maskImage = grad;
    spaceEl.style.webkitMaskImage = grad;

    // Reveal the map early so it fades in under the opening iris
    if (!revealed && t > 0.15) {
      revealed = true;
      onReveal();
    }

    // Fade out the captured globe image during iris open
    if (maskEl) {
      const fadeT = Math.min(t / 0.5, 1);
      maskEl.style.opacity = `${1 - easeOutQuart(fadeT)}`;
    }

    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      if (spaceEl) {
        spaceEl.style.transition = 'opacity 250ms ease-out';
        spaceEl.style.opacity = '0';
      }
      if (maskEl) {
        maskEl.style.opacity = '0';
      }
      setTimeout(onComplete, 270);
    }
  }

  requestAnimationFrame(frame);
}
