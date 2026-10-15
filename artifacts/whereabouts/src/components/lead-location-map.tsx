import { useEffect, useMemo, useRef } from 'react';
import { CircleMarker, MapContainer, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet';
import type { Investigation } from '@workspace/api-client-react';
import 'leaflet/dist/leaflet.css';

type Lead = Investigation['candidates'][number];
type LocatedLead = { lead: Lead; index: number; position: [number, number] };

function modelScore(confidence: number) {
  const normalized = confidence > 1 ? confidence / 100 : confidence;
  return Math.round(Math.max(0, Math.min(1, normalized)) * 100);
}

export function coordinatesFromMapsUrl(value: string): [number, number] | null {
  try {
    const url = new URL(value);
    const query = url.searchParams.get('query') ?? url.searchParams.get('q') ?? '';
    const match = query.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (!match) return null;
    const latitude = Number(match[1]);
    const longitude = Number(match[2]);
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
    return [latitude, longitude];
  } catch {
    return null;
  }
}

function MapViewController({ points, selectedIndex, mapKey }: {
  points: LocatedLead[];
  selectedIndex: number;
  mapKey: string;
}) {
  const map = useMap();
  const previousSelection = useRef(selectedIndex);

  useEffect(() => {
    const positions = points.map((point) => point.position);
    const selected = points.find((point) => point.index === selectedIndex);
    if (previousSelection.current !== selectedIndex && selected) {
      map.flyTo(selected.position, Math.max(map.getZoom(), 6), { duration: 0.55 });
    } else if (positions.length > 1) {
      map.fitBounds(positions, { padding: [36, 36], maxZoom: 5 });
    } else if (positions.length === 1) {
      map.setView(positions[0], 6);
    }
    previousSelection.current = selectedIndex;
  }, [map, mapKey, points, selectedIndex]);

  return null;
}

export function LeadLocationMap({ candidates, selectedIndex, onSelect, onOpenLead }: {
  candidates: Lead[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onOpenLead: (index: number) => void;
}) {
  const points = useMemo(
    () => candidates.flatMap((lead, index) => {
      const position = coordinatesFromMapsUrl(lead.mapsUrl);
      return position ? [{ lead, index, position }] : [];
    }),
    [candidates],
  );
  const mapKey = points.map(({ index, position }) => `${index}:${position.join(',')}`).join('|');
  const center: [number, number] = points[0]?.position ?? [20, 0];

  return <section className="overflow-hidden rounded-2xl border border-[#d8d1c2] bg-[#f8f5ec]" data-testid="map-top-location-leads">
    <div className="flex items-center justify-between gap-4 border-b border-[#e1dbce] px-4 py-3">
      <div><p className="font-data text-[9px] uppercase tracking-[.15em] text-[#9c6d4e]">Location overview</p><p className="mt-1 text-xs text-[#66796e]">The three highest-scored leads</p></div>
      <span className="font-data text-[9px] text-[#839086]">© OpenStreetMap</span>
    </div>
    {points.length ? <MapContainer key={mapKey || 'no-coordinate-map'} center={center} zoom={2} scrollWheelZoom={false} className="h-[310px] w-full" data-testid="map-lead-locations">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapViewController points={points} selectedIndex={selectedIndex} mapKey={mapKey} />
      {points.map(({ lead, index, position }) => {
        const selected = index === selectedIndex;
        const color = index === 0 ? '#20804f' : index === 1 ? '#d3a726' : '#c94f49';
        return <CircleMarker
          key={`${lead.place}-${index}`}
          center={position}
          radius={index === 0 ? 13 : selected ? 10 : 8}
          pathOptions={{ color, weight: selected ? 3 : 2, fillColor: color, fillOpacity: 0.96 }}
          eventHandlers={{ click: () => { onSelect(index); onOpenLead(index); } }}
        >
          <Tooltip direction="top" offset={[0, -8]}>{index + 1}. {lead.place}<br />Lat {position[0].toFixed(5)} · Lon {position[1].toFixed(5)}</Tooltip>
          <Popup><strong>{lead.place}</strong><br />Model score: {modelScore(lead.confidence)} / 100<br />Click marker to open location report</Popup>
        </CircleMarker>;
      })}
    </MapContainer> : <div className="grid h-[210px] place-items-center px-6 text-center text-sm leading-6 text-[#718078]" data-testid="map-no-coordinates">The analyzer did not return map coordinates for these leads. Open a lead’s map link to explore its location.</div>}
    {points.length < candidates.length && points.length > 0 && <p className="border-t border-[#e1dbce] px-4 py-2 text-[11px] text-[#718078]">Some leads do not include coordinates and cannot be pinned.</p>}
  </section>;
}
