import { useEffect, useMemo, useRef, useState } from 'react';
import L, { DomUtil } from 'leaflet';
import { Circle, MapContainer, Marker, TileLayer, Tooltip, useMap } from 'react-leaflet';
import { greatCircleKm, localFieldKernel, type GeographicPoint } from '@/lib/geographic-confidence';
import { CONFIDENCE_TIERS, confidenceTier, heatColor } from '@/lib/result-insights';
import 'leaflet/dist/leaflet.css';

export type RankedMapEntry = { index: number; place: string; position: GeographicPoint | null; percent: number | null };
export type SearchCircle = { center: GeographicPoint; radiusKm: number; label: string };

/** Canvas heat layer: each pixel takes the strongest score-weighted geodesic field. */
function HeatLayer({ points, supportKm }: { points: Array<{ position: GeographicPoint; unit: number }>; supportKm: number }) {
  const map = useMap();
  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.className = 'leaflet-layer leaflet-zoom-hide';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.pointerEvents = 'none';
    canvas.style.position = 'absolute';
    map.getPanes().overlayPane.appendChild(canvas);
    let frame = 0, disposed = false;
    const draw = () => {
      frame = 0; if (disposed) return;
      const size = map.getSize(); if (!size.x || !size.y) return;
      DomUtil.setPosition(canvas, map.containerPointToLayerPoint([0, 0]));
      canvas.style.width = `${size.x}px`; canvas.style.height = `${size.y}px`;
      const w = Math.ceil(size.x / 3), h = Math.ceil(size.y / 3);
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d'); if (!ctx) return;
      const image = ctx.createImageData(w, h);
      const lats = Array.from({ length: h }, (_, y) => map.containerPointToLatLng([0, (y + .5) * size.y / h]).lat);
      const lngs = Array.from({ length: w }, (_, x) => map.containerPointToLatLng([(x + .5) * size.x / w, 0]).lng);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let v = 0;
        for (const p of points) v = Math.max(v, p.unit * localFieldKernel(greatCircleKm([lats[y], lngs[x]], p.position), supportKm * (.45 + .55 * p.unit)));
        if (v <= .01) continue;
        const [r, g, b] = heatColor(v), o = (y * w + x) * 4;
        image.data[o] = r; image.data[o + 1] = g; image.data[o + 2] = b; image.data[o + 3] = Math.round(Math.min(.62, v * .7) * 255);
      }
      ctx.putImageData(image, 0, 0);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(draw); };
    map.on('moveend zoomend resize viewreset', schedule); schedule();
    return () => { disposed = true; cancelAnimationFrame(frame); map.off('moveend zoomend resize viewreset', schedule); canvas.remove(); };
  }, [map, points, supportKm]);
  return null;
}

function Viewport({ bounds, focus, focusZoom, overview }: { bounds: L.LatLngBounds | null; focus: { position: GeographicPoint | null; token: number }; focusZoom: number; overview: number }) {
  const map = useMap();
  useEffect(() => { if (bounds?.isValid()) map.fitBounds(bounds, { padding: [34, 34], maxZoom: focusZoom, animate: false }); }, [map, bounds, focusZoom, overview]);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (focus.position) map.flyTo(focus.position, Math.max(map.getZoom(), focusZoom), { duration: .6 });
  }, [map, focus.token]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false, animate: false }));
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}

function bindPinKeys(marker: L.Marker, index: number, ref: { current: (index: number) => void }) {
  const el = marker.getElement();
  if (!el || el.dataset.keysBound) return;
  el.dataset.keysBound = '1';
  el.setAttribute('role', 'button');
  el.setAttribute('tabindex', '0');
  el.setAttribute('aria-label', `Select place ${index + 1}`);
  el.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.code === 'Space' || event.key === ' ' || event.key === 'Space' || event.key === 'Spacebar') { event.preventDefault(); event.stopImmediatePropagation(); ref.current(index); }
  }, { capture: true });
}

function pinIcon(number: number, color: string, selected: boolean) {
  return L.divIcon({
    className: 'rp-pin-wrap',
    html: `<span class="rp-pin${selected ? ' is-selected' : ''}" style="--pin:${color}"><span>${number}</span></span>`,
    iconSize: [selected ? 40 : 32, selected ? 48 : 40],
    iconAnchor: [selected ? 20 : 16, selected ? 46 : 38],
    tooltipAnchor: [0, selected ? -46 : -38],
  });
}

export function RankedPlacesMap({ entries, selectedIndex, onSelect, focusToken, circle, supportKm, focusZoom, title, subtitle }: {
  entries: RankedMapEntry[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  focusToken: number;
  circle?: SearchCircle | null;
  supportKm: number;
  focusZoom: number;
  title: string;
  subtitle?: string;
}) {
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const located = useMemo(() => entries.filter((e): e is RankedMapEntry & { position: GeographicPoint } => e.position !== null), [entries]);
  const heatPoints = useMemo(() => located.filter((e) => e.percent !== null).map((e) => ({ position: e.position, unit: (e.percent ?? 0) / 100 })), [located]);
  const bounds = useMemo(() => {
    const b = L.latLngBounds([]);
    located.forEach((e) => b.extend(e.position));
    if (circle) b.extend(L.latLng(circle.center[0], circle.center[1]).toBounds(Math.max(circle.radiusKm * 1000, 300) * 2));
    return b.isValid() ? b : null;
  }, [located, circle]);
  const [overview, setOverview] = useState(0);
  const [tileError, setTileError] = useState(false);
  const selectedPosition = located.find((e) => e.index === selectedIndex)?.position ?? null;
  const center: GeographicPoint = located[0]?.position ?? circle?.center ?? [20, 0];
  const unmapped = entries.filter((e) => !e.position);

  return <section className="rp-map" aria-labelledby="rp-map-title" data-testid="map-ranked-places">
    <header className="rp-map-head">
      <div className="min-w-0"><p className="rp-eyebrow">Map / numbered by rank</p><h2 className="rp-title" id="rp-map-title">{title}</h2>{subtitle && <p className="rp-sub" data-testid="text-map-subtitle">{subtitle}</p>}</div>
      {located.length > 1 && <button type="button" className="rp-text-button" onClick={() => setOverview((v) => v + 1)} data-testid="button-map-fit-all">Show all pins</button>}
    </header>
    {bounds ? <div className="rp-map-surface">
      <MapContainer center={center} zoom={5} scrollWheelZoom={false} aria-label="Map of ranked places with numbered pins">
        <TileLayer referrerPolicy="strict-origin" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" eventHandlers={{ tileerror: () => setTileError(true) }} />
        <Viewport bounds={bounds} focus={{ position: selectedPosition, token: focusToken }} focusZoom={focusZoom} overview={overview} />
        <HeatLayer points={heatPoints} supportKm={supportKm} />
        {circle && <Circle center={circle.center} radius={circle.radiusKm * 1000} pathOptions={{ color: '#385e51', weight: 2, dashArray: '6 6', fillOpacity: 0, interactive: true }}>
          <Tooltip sticky>Walking-distance search circle · {circle.radiusKm.toFixed(1)} km</Tooltip>
        </Circle>}
        {[...located].reverse().map((e) => <Marker key={e.index} position={e.position} icon={pinIcon(e.index + 1, confidenceTier(e.percent).color, e.index === selectedIndex)} zIndexOffset={e.index === selectedIndex ? 1000 : -e.index} title={`${e.index + 1}. ${e.place}`} eventHandlers={{ click: () => onSelectRef.current(e.index), add: (ev) => bindPinKeys(ev.target as L.Marker, e.index, onSelectRef) }}>
          <Tooltip direction="top">{e.index + 1}. {e.place} · Confidence {e.percent ?? 'not supplied'}</Tooltip>
        </Marker>)}
      </MapContainer>
    </div> : <div className="rp-map-empty" data-testid="map-no-coordinates">{entries.length ? 'None of the ranked places include usable map coordinates. No pins or heat have been invented.' : 'No places were returned, so there is nothing to map.'}</div>}
    {tileError && <p className="rp-note" role="alert" data-testid="status-map-tiles-error">Some map tiles could not load. Pins and rankings are unchanged.</p>}
    <MapLegend circle={Boolean(circle)} />
    {unmapped.length > 0 && <p className="rp-note" data-testid="text-unmapped-places">Not on map (no coordinates): {unmapped.map((e) => `${e.index + 1}. ${e.place}`).join(' · ')}</p>}
  </section>;
}

export function MapLegend({ circle }: { circle: boolean }) {
  const { strong, possible, weak } = CONFIDENCE_TIERS;
  return <div className="rp-legend" data-testid="legend-map">
    <span className="rp-legend-item"><span className="rp-pin rp-pin-static" style={{ ['--pin' as string]: strong.color }}><span>1</span></span>Pin number = rank in list</span>
    <span className="rp-legend-item">{[strong, possible, weak].map((t) => <span key={t.key} className="rp-legend-tier"><i style={{ background: t.color }} />{t.label}</span>)}</span>
    <span className="rp-legend-item rp-legend-heat"><small>Less likely</small><i style={{ background: `linear-gradient(90deg, ${weak.color}22, ${weak.color}, ${possible.color}, ${strong.color})` }} /><small>More likely</small></span>
    {circle && <span className="rp-legend-item"><i className="rp-legend-circle" />Walking-distance circle</span>}
  </div>;
}
