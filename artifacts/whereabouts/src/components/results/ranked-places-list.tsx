import { useEffect, useRef, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { CONFIDENCE_DEFINITION, confidenceTier, type SupportingClue } from '@/lib/result-insights';

export type RankedListItem = { index: number; place: string; region: string; percent: number | null; clues: SupportingClue[]; mapped: boolean };

export function ConfidenceMeter({ percent, testId, size = 'lg' }: { percent: number | null; testId?: string; size?: 'lg' | 'sm' }) {
  const tier = confidenceTier(percent);
  return <div className={`rp-meter rp-meter-${size}`} data-tier={tier.key}>
    <div className="rp-meter-top">
      <span className="rp-meter-num" style={{ color: tier.color }} data-testid={testId}>{percent ?? '—'}</span>
      <span className="rp-meter-meta"><span className="rp-meter-label">Confidence{percent !== null && ' / 100'}</span><span className="rp-tier" style={{ background: tier.color }} data-testid={testId ? `${testId}-tier` : undefined}>{tier.label}</span></span>
    </div>
    <div className="rp-bar" role="meter" aria-label="Confidence" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent ?? undefined}><i style={{ width: `${percent ?? 0}%`, background: tier.color }} /></div>
  </div>;
}

export function RankedPlacesList({ items, selectedIndex, onSelect, scrollToken, activeTag, onClueFocus, actions, renderDetails, testId = 'list-ranked-places' }: {
  items: RankedListItem[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  /** Changes whenever a map pin selects a place; the list then scrolls to it. */
  scrollToken: number;
  activeTag: string | null;
  onClueFocus: (tag: string | null) => void;
  actions?: ReactNode;
  renderDetails?: (index: number) => ReactNode;
  testId?: string;
}) {
  const refs = useRef(new Map<number, HTMLLIElement>());
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const node = refs.current.get(selectedIndex);
    if (!node) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    node.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
    node.querySelector<HTMLButtonElement>('.rp-item-select')?.focus({ preventScroll: true });
  }, [scrollToken]); // eslint-disable-line react-hooks/exhaustive-deps

  return <section className="rp-list" aria-labelledby="rp-list-title" data-testid="section-ranked-places">
    <header className="rp-list-head">
      <div className="min-w-0"><p className="rp-eyebrow">Ranked by Confidence</p><h2 className="rp-title" id="rp-list-title">Likely places to check</h2>
        <p className="rp-sub" data-testid="text-confidence-definition">{CONFIDENCE_DEFINITION}</p>
        {items.length > 0 && <p className="rp-count" data-testid="text-leads-count">{items.length === 1 ? '1 lead considered' : `${items.length} leads considered${items.length > 3 ? ' · scroll to see all' : ''}`}</p>}</div>
      {actions && <div className="rp-list-actions">{actions}</div>}
    </header>
    {items.length ? <ol className="rp-items" tabIndex={0} aria-label="All leads considered, ranked" data-testid={testId}>{items.map((item) => {
      const tier = confidenceTier(item.percent), selected = item.index === selectedIndex;
      return <li key={`${item.place}-${item.index}`} ref={(node) => { if (node) refs.current.set(item.index, node); else refs.current.delete(item.index); }} className={`rp-item${selected ? ' is-selected' : ''}`} style={{ ['--tier' as string]: tier.color }} data-testid={`card-ranked-place-${item.index}`}>
        <button type="button" className="rp-item-select" aria-pressed={selected} onClick={() => onSelect(item.index)} data-testid={`button-select-place-${item.index}`}>
          <span className="rp-num" style={{ background: tier.color }} aria-label={`Rank ${item.index + 1}`}>{item.index + 1}</span>
          <span className="rp-item-name"><span className="rp-place" data-testid={`text-place-name-${item.index}`}>{item.place}</span><span className="rp-region">{item.region}{!item.mapped && <> · <em>not on map: no coordinates</em></>}</span></span>
          <ConfidenceMeter percent={item.percent} testId={`text-place-confidence-${item.index}`} />
        </button>
        <div className="rp-clues" aria-label="Photo clues supporting this place">
          {item.clues.length ? item.clues.map((clue, i) => <button type="button" key={`${clue.label}-${i}`} className={`rp-chip${clue.photoTag && clue.photoTag === activeTag ? ' is-active' : ''}${clue.photoTag ? '' : ' no-tag'}`}
            onMouseEnter={() => onClueFocus(clue.photoTag)} onMouseLeave={() => onClueFocus(null)} onFocus={() => onClueFocus(clue.photoTag)} onBlur={() => onClueFocus(null)}
            onClick={() => onClueFocus(clue.photoTag)}
            title={clue.photoTag ? `Highlights "${clue.photoTag}" on the photo` : 'No matching tag on the photo'} data-testid={`chip-place-clue-${item.index}-${i}`}>
            <Check size={11} strokeWidth={3} aria-hidden="true" />{clue.label}
          </button>) : <span className="rp-chip-none" data-testid={`text-place-clues-unavailable-${item.index}`}>Supporting photo clues unavailable for this place</span>}
        </div>
        {selected && renderDetails?.(item.index)}
      </li>;
    })}</ol> : <p className="rp-empty" data-testid="content-no-candidates">No likely places were returned. Keep the photo saved and revisit as new clues surface.</p>}
  </section>;
}
