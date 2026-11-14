export type LoupePhase = 'binary' | 'decoding' | 'json';
export type LoupePoint = { x: number; y: number };
export const LOUPE_DWELL_MS = 2000;
export const LOUPE_DECODE_MS = 260;
export const LOUPE_JITTER_PX = 3;

type Clock = {
  schedule: (callback: () => void, delay: number) => unknown;
  cancel: (timer: unknown) => void;
};

/**
 * Timers are injected so dwell, cancellation and stale callbacks are testable.
 * Coordinates use CSS pixels, independent of devicePixelRatio.
 */
export function createLoupeDwell(onPhase: (phase: LoupePhase) => void, clock: Clock) {
  let phase: LoupePhase = 'binary';
  let anchor: LoupePoint | null = null;
  let timer: unknown;
  let generation = 0;
  let disposed = false;
  const emit = (next: LoupePhase) => { phase = next; onPhase(next); };
  const clear = () => {
    generation += 1;
    if (timer !== undefined) clock.cancel(timer);
    timer = undefined;
  };
  const reset = () => {
    clear();
    anchor = null;
    if (!disposed) emit('binary');
  };
  return {
    move(point: LoupePoint) {
      if (disposed) return;
      if (anchor && Math.hypot(point.x - anchor.x, point.y - anchor.y) < LOUPE_JITTER_PX) return;
      clear();
      anchor = { ...point };
      emit('binary');
      const token = generation;
      timer = clock.schedule(() => {
        if (disposed || token !== generation) return;
        emit('decoding');
        timer = clock.schedule(() => {
          if (disposed || token !== generation) return;
          timer = undefined;
          emit('json');
        }, LOUPE_DECODE_MS);
      }, LOUPE_DWELL_MS);
    },
    leave() {
      clear();
      anchor = null;
      // A resolved record stays readable/downloadable after leaving the stage.
      if (!disposed && phase !== 'json') emit('binary');
    },
    reset,
    dispose() { clear(); disposed = true; anchor = null; },
  };
}
