import type {InstrumentKind} from '@/components/physical-models';
/** Actual InstrumentKit WebGL scene renders. Do not replace with drawn proxies. */
export const instrumentPNGRevision:string='aligned-selector-v3';
export const instrumentPNGs:Partial<Record<InstrumentKind,string>>={
  "shutter": "shutter.png",
  "keys": "keys.png",
  "voice": "voice.png",
  "lever": "lever.png",
  "rocker": "rocker.png",
  "tally": "tally.png",
  "splitflap": "splitflap.png",
  "fontslider": "fontslider.png",
  "drawer": "drawer.png",
  "loupe": "loupe.png",
  "tray": "tray.png",
  "archiveprint": "archiveprint.png",
  "print": "print.png",
  "dial": "dial.png",
  "swatch": "swatch.png"
};
