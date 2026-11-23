import { useRef,useState } from 'react';
import { InstrumentView as PhysicalView } from './InstrumentKit';
import { useGuideMicrophone } from '@/hooks/use-guide-microphone';
import { deskSound } from '@/lib/desk-sound';
export function GuideVoiceControl({ onText }: { onText: (text: string) => void }) {
  const mic = useGuideMicrophone(onText), down = useRef(0), wasActive = useRef(false),[pressed,setPressed]=useState(false);
  const press = () => {setPressed(true); down.current = performance.now(); wasActive.current = mic.listening || mic.pending; deskSound('switch'); if (wasActive.current) mic.stop(); else void mic.start(); };
  const release = () => {setPressed(false); if (!wasActive.current && performance.now() - down.current >= 300) mic.stop(); };
  return <div><div className="physical-footprint physical-voice" data-control="Guide push to talk">
    <PhysicalView kind="voice" active={mic.listening} amount={mic.level} pressed={pressed} interaction={{disabled:!mic.supported,onDown:press,onUp:release,onCancel:()=>{setPressed(false);mic.stop();}}}/>
    <button type="button" className="physical-hit" disabled={!mic.supported} aria-label={mic.listening ? 'Stop recording; tap again to stop' : 'Hold to speak, or tap to toggle recording'} aria-pressed={mic.listening} aria-describedby="guide-voice-status" data-testid="button-guide-voice"
      onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); press(); }} onPointerUp={e => { release(); if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); }}
      onPointerCancel={e => { mic.stop(); if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); }}
      onClick={e => { if (e.detail === 0) mic.toggle(); }}
      onKeyDown={e => { if (e.key === ' ') { e.preventDefault(); if (!e.repeat) press(); } else if (e.key === 'Enter') { e.preventDefault(); if (!e.repeat) mic.toggle(); } }}
      onKeyUp={e => { if (e.key === ' ') { e.preventDefault(); release(); } }} />
  </div><p className="physical-voice-caption">{mic.error||(!mic.supported?'Voice unavailable. Please type instead.':'Hold or tap to talk')}</p><span id="guide-voice-status" role="status" className="sr-only">{mic.error||(mic.pending?'Waiting for microphone permission.':mic.listening?'Recording.':'Not recording.')}</span></div>;
}
