const KEY='whereabouts-sound-v1';
let audio:AudioContext|null=null,idle:ReturnType<typeof setTimeout>|undefined;
export function soundEnabled(){try{return localStorage.getItem(KEY)==='on';}catch{return false;}}
export function setSoundEnabled(enabled:boolean){try{localStorage.setItem(KEY,enabled?'on':'off');}catch{/* Session UI remains usable. */}if(!enabled){clearTimeout(idle);void audio?.close();audio=null;}}
export function deskSound(kind:'detent'|'stop'|'shutter'|'switch'|'stamp'|'crackle'|'resolve'|'flap'){
  if(!soundEnabled())return;
  try{if((kind==='detent'||kind==='shutter')&&'vibrate'in navigator)navigator.vibrate(10);}catch{/* Optional device support. */}
  try{
    clearTimeout(idle);
    audio??=new AudioContext();void audio.resume().catch(()=>{});const gain=audio.createGain(),now=audio.currentTime,duration=kind==='crackle'?.055:.035;
    gain.gain.setValueAtTime(.018,now);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);gain.connect(audio.destination);
    if(kind==='crackle'||kind==='flap'){const buffer=audio.createBuffer(1,Math.ceil(audio.sampleRate*duration),audio.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(kind==='flap'?Math.exp(-i/(audio.sampleRate*.004))*.75:.4);const source=audio.createBufferSource();source.buffer=buffer;source.connect(gain);source.start();source.stop(now+duration);source.onended=()=>{source.disconnect();gain.disconnect();};}
    else{const oscillator=audio.createOscillator();oscillator.frequency.setValueAtTime(kind==='stop'?135:kind==='shutter'?110:kind==='stamp'?155:340,now);oscillator.type='triangle';oscillator.connect(gain);oscillator.start();oscillator.stop(now+duration);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};}
    const current=audio;idle=setTimeout(()=>{if(audio===current){void current?.close();audio=null;}},220);
  }catch{/* Audio/haptics are optional, never prerequisites. */}
}
