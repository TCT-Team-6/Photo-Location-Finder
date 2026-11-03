import { useEffect } from 'react';
import L from 'leaflet';
import { Circle, CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

function Fit({ center, radiusM }: { center: [number, number]; radiusM: number }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(L.latLng(center[0], center[1]).toBounds(Math.max(radiusM, 300) * 2.3), { padding: [16, 16] });
  }, [map, center, radiusM]);
  return null;
}

export type MapPoint = { position: [number, number]; label: string; index: number };

export function DemoSearchMap({ center, radiusKm, label, points, selectedIndex, onSelect }: {
  center: [number, number] | null;
  radiusKm: number;
  label: string;
  points: MapPoint[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  return <section className="overflow-hidden rounded-2xl border border-[#d8d1c2] bg-[#f8f5ec]" data-testid="map-demo-search-area">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e1dbce] px-4 py-3">
      <div><p className="font-data text-[9px] uppercase tracking-[.15em] text-[#9c6d4e]">Possible search area</p><p className="mt-1 text-xs text-[#344b42]" data-testid="text-demo-search-area-label">{label}</p></div>
      <span className="font-data text-[9px] text-[#839086]">© OpenStreetMap</span>
    </div>
    {center ? <MapContainer center={center} zoom={11} scrollWheelZoom={false} className="h-[340px] w-full">
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Fit center={center} radiusM={radiusKm * 1000} />
      <Circle center={center} radius={radiusKm * 1000} pathOptions={{ color: '#d36b3a', weight: 2, dashArray: '6 6', fillColor: '#e8875a', fillOpacity: 0.16 }}>
        <Tooltip sticky>Possible search area · {radiusKm.toFixed(1)} km radius</Tooltip>
      </Circle>
      {points.map((p) => <CircleMarker key={p.index} center={p.position} radius={p.index === selectedIndex ? 11 : 8} pathOptions={{ color: '#263d36', weight: 2, fillColor: p.index === 0 ? '#385e51' : '#9fb3a5', fillOpacity: 0.95 }} eventHandlers={{ click: () => onSelect(p.index) }}>
        <Tooltip direction="top" offset={[0, -8]}>{p.index + 1}. {p.label}</Tooltip>
      </CircleMarker>)}
    </MapContainer> : <div className="grid h-[220px] place-items-center px-6 text-center text-sm text-[#718078]">No coordinates for the top place in this sample.</div>}
    <p className="border-t border-[#e1dbce] px-4 py-2 text-[10px] leading-4 text-[#829087]">Estimated from time missing and a typical walking pace. Not a tracked location.</p>
  </section>;
}
