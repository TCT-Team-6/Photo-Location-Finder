import { useCallback, useEffect, useRef } from 'react';

/** Warns on tab close / reload while a form is dirty. State only; nothing persisted. */
export function useDirtyGuard() {
  const dirty = useRef(false);
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty.current) { e.preventDefault(); e.returnValue = ''; } };
    const click = (e: MouseEvent) => {
      if (!dirty.current || e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download') || anchor.href === window.location.href) return;
      if (!window.confirm('You have unsaved changes. Leave without saving?')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', h);
    document.addEventListener('click', click, true);
    return () => {
      window.removeEventListener('beforeunload', h);
      document.removeEventListener('click', click, true);
    };
  }, []);
  const setDirty = useCallback((d: boolean) => { dirty.current = d; }, []);
  const confirmLeave = useCallback(() => !dirty.current || window.confirm('You have unsaved changes. Leave without saving?'), []);
  return { setDirty, confirmLeave };
}
