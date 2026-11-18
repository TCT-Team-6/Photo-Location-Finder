export function interactionShiftIsRelevant(interactionAt: number, entryAt: number) {
  return entryAt >= interactionAt && entryAt - interactionAt <= 500;
}
/** Development diagnostics include shifts marked hadRecentInput, which CLS normally ignores. */
export function installLayoutMonitor() {
  if (typeof PerformanceObserver === 'undefined' || !PerformanceObserver.supportedEntryTypes.includes('layout-shift')) return;
  let interactedAt = -Infinity, control = '';
  const interaction = (event: Event) => {
    const node = event.target instanceof Element ? event.target.closest('.physical-footprint,[data-control]') : null;
    if (!node) return;
    interactedAt = performance.now(); control = node.getAttribute('aria-label') ?? node.getAttribute('data-control') ?? node.className;
  };
  const observer = new PerformanceObserver(list => {
    for (const entry of list.getEntries()) {
      if (!interactionShiftIsRelevant(interactedAt, entry.startTime)) continue;
      const shift = entry as PerformanceEntry & { value?: number; sources?: { node?: Node }[] };
      // Text repaint can emit a zero-impact entry without moving any footprint.
      if (shift.value === 0) continue;
      console.warn('[Control layout shift]', control, shift.sources?.map(s => {const element=s.node instanceof Element?s.node:s.node?.parentElement;return element?.getAttribute('data-testid')??element?.tagName??'unknown';}).join(', '));
    }
  });
  observer.observe({ type: 'layout-shift', buffered: false });
  document.addEventListener('pointerdown', interaction, true); document.addEventListener('keydown', interaction, true);
  return () => { observer.disconnect(); document.removeEventListener('pointerdown', interaction, true); document.removeEventListener('keydown', interaction, true); };
}
