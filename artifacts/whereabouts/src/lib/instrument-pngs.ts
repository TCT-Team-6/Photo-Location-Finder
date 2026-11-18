import type {InstrumentKind} from '@/components/physical-models';
/** Actual InstrumentKit WebGL scene renders. Do not replace with drawn proxies. */
export const instrumentPNGs:Partial<Record<InstrumentKind,string>>={
  "dial": "dial.png",
  "shutter": "shutter.png",
  "keys": "keys.png",
  "voice": "voice.png",
  "swatch": "swatch.png",
  "lever": "lever.png",
  "rocker": "rocker.png",
  "tally": "tally.png",
  "drawer": "drawer.png",
  "loupe": "loupe.png",
  "tray": "tray.png",
  "print": "print.png"
};
