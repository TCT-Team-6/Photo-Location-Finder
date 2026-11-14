import { useCallback, useEffect, useRef, useState } from 'react';
import { createLoupeDwell, type LoupePhase, type LoupePoint } from '@/lib/loupe-dwell';

export function useLoupeDwell(sampleId: string) {
  const [phase, setPhase] = useState<LoupePhase>('binary');
  const controller = useRef<ReturnType<typeof createLoupeDwell> | null>(null);
  useEffect(() => {
    const instance = createLoupeDwell(setPhase, {
      schedule: (callback, delay) => window.setTimeout(callback, delay),
      cancel: (timer) => window.clearTimeout(timer as number),
    });
    controller.current = instance;
    instance.reset();
    return () => { instance.dispose(); controller.current = null; };
  }, [sampleId]);
  const move = useCallback((point: LoupePoint) => controller.current?.move(point), []);
  const leave = useCallback(() => controller.current?.leave(), []);
  const reset = useCallback(() => controller.current?.reset(), []);
  return { phase, move, leave, reset };
}
