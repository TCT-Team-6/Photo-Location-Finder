import {
  AmbientLight, BoxGeometry, CapsuleGeometry, CatmullRomCurve3, CylinderGeometry, DataTexture,
  DirectionalLight, Group, LinearFilter, NearestFilter, Mesh, MeshPhysicalMaterial, MeshStandardMaterial,
  NoToneMapping, PCFShadowMap, PerspectiveCamera, PlaneGeometry, Scene, ShaderMaterial,
  ShadowMaterial, SphereGeometry, SRGBColorSpace, Texture, TorusGeometry, TubeGeometry,
  Vector2, Vector3, Vector4, WebGLRenderer, WebGLRenderTarget, type BufferGeometry, type Material,
} from 'three';
import type { SpringAxis } from './loupe-physics';
import { advanceTool, createToolMotion, pickUpTool, returnTool, type ToolMode } from './loupe-kinematics';
import { instrumentLayout, overPhoto, scrollLight } from './instrument-layout';
import { createDataWall,dataGlyphSamplingRatio } from './loupe-wall';
import { createPanelSurface } from './loupe-panel-surface';
import { createLoupeLayer } from './loupe-layer';
import { boundPoint } from './loupe-bounds';
import { advanceDataResolve, compensatedRadius, GLASS_MAGNIFICATION, HELD_LIFT, lensPhotoContact, pickupScale } from './lens-feedback';
import type { LoupePhase, LoupePoint } from './loupe-dwell';
import type { ExamplePhoto, ImageRegion, RegionReading } from './loupe-image-data';
import {createPageCapture} from './page-capture';
import {createDecryptTimeline} from './decrypt-timeline';
import {deskSound} from './desk-sound';
import {RGB_SCREEN_GLSL} from './rgb-screen';
import {STAGE_PROJECTION_GLSL,lensSurface} from './loupe-projection';
import {createLiveCanvasTexture} from './live-canvas-texture';

const PHOTO_VERTEX=`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const PHOTO_FRAGMENT=`uniform sampler2D uPhoto;uniform vec2 uCover;varying vec2 vUv;
void main(){gl_FragColor=texture2D(uPhoto,(vUv-.5)*uCover+.5);
#include <colorspace_fragment>
}`;
const GLASS_VERTEX=`varying vec3 vNormal;varying vec2 vLocal;varying vec3 vWorld;
void main(){vNormal=normalize(normalMatrix*normal);vLocal=position.xy;vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
// Both real scene transmission and the data wall use the same refracted scene UV.
const GLASS_FRAGMENT=`
uniform sampler2D uWall;uniform vec2 uResolution;uniform vec2 uStage;uniform vec2 uPhotoSize;
uniform sampler2D uScene;uniform sampler2D uPage;uniform float uCaptureReady;uniform vec4 uDomControl;uniform float uHeaderBottom;uniform float uWait;uniform float uFlash;uniform float uSplit;
uniform vec2 uCenter;uniform vec2 uViewport;uniform vec2 uStageOrigin;uniform float uPixelDpr;uniform vec3 uLight;uniform float uResolve;uniform float uRadius;uniform float uMagnification;varying vec3 vNormal;varying vec2 vLocal;
uniform float uCameraZ;uniform float uDataDpr;uniform vec4 uWallRect;uniform vec4 uPaperTitle;uniform vec4 uPaperIntro;varying vec3 vWorld;
${STAGE_PROJECTION_GLSL}
float inRect(vec2 p,vec4 rect){return step(rect.x,p.x)*step(p.x,rect.z)*step(rect.y,p.y)*step(p.y,rect.w);}
float onPaper(vec2 p){vec2 viewportPoint=p+uStageOrigin;return max(inRect(viewportPoint,uPaperTitle),inRect(viewportPoint,uPaperIntro));}
vec3 sampleDisplay(vec2 p){
 vec2 pageUV=vec2((p.x+uStageOrigin.x)/uViewport.x,1.-(p.y+uStageOrigin.y)/uViewport.y);
 vec3 page=texture2D(uPage,clamp(pageUV,.0001,.9999)).rgb;
 float inStage=step(0.,p.x)*step(p.x,uStage.x)*step(0.,p.y)*step(p.y,uStage.y);
 float inControl=step(uDomControl.x,p.x)*step(p.x,uDomControl.z)*step(uDomControl.y,p.y)*step(p.y,uDomControl.w)*uCaptureReady;
 float inHeader=(1.-step(uHeaderBottom,p.y+uStageOrigin.y))*uCaptureReady;
 // Never clamp an off-stage lookup into the photo/data texture.
 if(inStage<.5||inHeader>.5||onPaper(p)>.5)return mix(vec3(.91),page,uCaptureReady);
 vec3 scene=texture2D(uScene,clamp(vec2(p.x/uStage.x,1.-p.y/uStage.y),.0001,.9999)).rgb;
 vec3 display=mix(mix(vec3(.91),page,uCaptureReady),scene,inStage*(1.-inControl)*(1.-inHeader));
 return display;
}
float dataMask(vec2 p){
 if(p.x<0.||p.y<0.||p.x>uStage.x||p.y>uStage.y||p.y+uStageOrigin.y<uHeaderBottom||onPaper(p)>.5)return 0.;
 float distance=min(min(p.x,uPhotoSize.x-p.x),min(p.y,uPhotoSize.y-p.y));
 float halfWidth=6./uMagnification;
 return smoothstep(-halfWidth,halfWidth,distance)*uResolve;
}
vec3 sampleData(vec2 p){
 vec2 uv=(p-uWallRect.xy)/uWallRect.zw;
 return texture2D(uWall,vec2(uv.x,1.-uv.y)).rgb;
}
${RGB_SCREEN_GLSL}
void main(){
 vec3 n=normalize(vNormal);float edge=smoothstep(.85,1.,clamp(length(vLocal),0.,1.));
 vec2 screen=projectStagePoint(vWorld);
 vec3 ray=refract(vec3(0.,0.,-1.),n,1./1.517);
 vec2 wallPoint=uCenter+(screen-uCenter)/uMagnification*(1.+.075*edge)+ray.xy*2.2*edge;
  vec2 pixel=floor((wallPoint+uStageOrigin)*uPixelDpr),cell=fract((wallPoint+uStageOrigin)*uPixelDpr),samplePoint=(pixel+.5)/uPixelDpr-uStageOrigin;
  vec3 values=vec3(sampleDisplay(samplePoint+vec2(uSplit,0.)/uPixelDpr).r,sampleDisplay(samplePoint).g,sampleDisplay(samplePoint-vec2(uSplit,0.)/uPixelDpr).b);
  float mask=dataMask(wallPoint);
  // The instrument's typeset data screen is HiDPI; don't downsample its glyphs
  // into the page's much coarser camera-pixel lattice before magnifying them.
  vec2 dataPixel=floor(wallPoint*uDataDpr),dataCell=fract(wallPoint*uDataDpr),dataPoint=(dataPixel+.5)/uDataDpr;
  vec3 dataValues=vec3(sampleData(dataPoint+vec2(uSplit,0.)/uDataDpr).r,sampleData(dataPoint).g,sampleData(dataPoint-vec2(uSplit,0.)/uDataDpr).b);
 float fresnel=.035+.965*pow(1.-abs(n.z),5.);
 float shine=pow(max(dot(reflect(-normalize(uLight),n),vec3(0.,0.,1.)),0.),18.);
   vec3 color=mix(rgbEmitter(values,cell),rgbEmitter(dataValues,dataCell),mask);
  color*=1.+uFlash;color*=1.-edge*.065;
  color+=fresnel*.025+shine*.025;
  float radial=length(screen-uCenter)/max(1.,uRadius),angle=fract(atan(screen.x-uCenter.x,-screen.y+uCenter.y)/6.2831853+1.);
   float arc=step(.976,radial)*(1.-step(.985,radial))*step(angle,uWait)*step(.001,uWait);
  color=mix(color,vec3(.467,.039,.027),arc);
 gl_FragColor=vec4(color,1.);
 #include <colorspace_fragment>
}`;

export type ToolFrame = { mode: ToolMode; radius: number; inspecting: boolean; returnCount: number; tiltX: number; tiltY: number };
export type OpticalRenderer = {
  draw: (point: LoupePoint) => void; hover: (point: LoupePoint) => void;
  pickup: (point: LoupePoint) => void; release: () => void; hitTest: (point: LoupePoint) => boolean;
  resize: (width: number,height: number,dpr?: number) => void; setPhase: (phase: LoupePhase) => void;
  cancelReveal: () => void; setVisible: (visible: boolean) => void; setPhotoZoom: (zoom: number) => void;
  setLighting: (progress: number) => void; dispose: () => void;
  setMagnification:(zoom:number)=>void;refreshCapture:()=>void;
};
type Options = {
  reducedMotion?: boolean; photo: ExamplePhoto; regions: ImageRegion[]; sampleIndex?:number;
  readPixels: (point: LoupePoint,viewport: {width:number;height:number},radius:number) => RegionReading;
  onReading?: (reading: RegionReading,phase: LoupePhase) => void; onFrame?: (point: LoupePoint,progress: number,state: ToolFrame) => void;
  onMode?: (mode: ToolMode) => void;
  onPhase?:(phase:LoupePhase)=>void;onCapture?:(status:string)=>void;
};

export function createOpticalRenderer(canvas: HTMLCanvasElement,image: HTMLImageElement,options: Options): OpticalRenderer {
  const layer=createLoupeLayer(canvas);
  let renderer:WebGLRenderer;
  try{renderer=new WebGLRenderer({canvas:layer.canvas,alpha:true,antialias:true,powerPreference:'low-power'});}catch(error){layer.dispose();throw error;}
  const geometries:BufferGeometry[]=[],materials:Material[]=[],textures:Texture[]=[];
  const canvasUploads:ReturnType<typeof createLiveCanvasTexture>[]=[];
  let frame=0,disposed=false,dataWall:ReturnType<typeof createDataWall>|null=null,panelSurface:ReturnType<typeof createPanelSurface>|null=null,sceneTarget:WebGLRenderTarget|null=null;
  let lightToDispose:DirectionalLight|null=null;
  let capture:ReturnType<typeof createPageCapture>|null=null;
  const release=()=>{cancelAnimationFrame(frame);capture?.dispose();canvasUploads.forEach(resource=>resource.dispose());geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());sceneTarget?.dispose();lightToDispose?.shadow.dispose();dataWall?.dispose();panelSurface?.dispose();layer.dispose();renderer.dispose();};
  try{
    canvas.removeAttribute('data-data-resolve');
    renderer.setClearColor(0xf4f4f2,0);renderer.outputColorSpace=SRGBColorSpace;renderer.toneMapping=NoToneMapping;
    renderer.debug.onShaderError=()=>{throw new Error('The 3D instrument shader could not compile.');};
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=PCFShadowMap;renderer.shadowMap.autoUpdate=false;
    const ownG=<T extends BufferGeometry>(g:T):T=>{geometries.push(g);return g;};
    const ownM=<T extends Material>(m:T):T=>{materials.push(m);return m;};
    const scene=new Scene(),camera=new PerspectiveCamera(35,1,.1,12000);
    const source=new Texture(image);source.colorSpace=SRGBColorSpace;source.minFilter=source.magFilter=LinearFilter;source.generateMipmaps=false;source.needsUpdate=true;textures.push(source);
    const photoMaterial=ownM(new ShaderMaterial({vertexShader:PHOTO_VERTEX,fragmentShader:PHOTO_FRAGMENT,uniforms:{uPhoto:{value:source},uCover:{value:new Vector2(1,1)}},depthTest:false,depthWrite:false}));
    const photoPlane=new Mesh(ownG(new PlaneGeometry(1,1)),photoMaterial);photoPlane.renderOrder=-10;scene.add(photoPlane);
    const computed=getComputedStyle(canvas),font=computed.getPropertyValue('--app-font-mono').trim()||'"DM Mono",monospace';
    dataWall=createDataWall(image,font,computed.getPropertyValue('--ink').trim()||'#242723',computed.getPropertyValue('--paper').trim()||'#f4f4f2');
    const wall=dataWall;
    panelSurface=createPanelSurface(font,options.photo,options.sampleIndex??0);
    // A constant, immutable fallback must never alias a resizable data canvas.
    const paperTexture=new DataTexture(new Uint8Array([244,244,242,255]),1,1);paperTexture.colorSpace=SRGBColorSpace;paperTexture.needsUpdate=true;textures.push(paperTexture);
    const wallUniform={value:paperTexture as Texture},pageUniform={value:paperTexture as Texture},panelUniform={value:paperTexture as Texture};
    const wallUpload=createLiveCanvasTexture(wallUniform,t=>renderer.initTexture(t)),pageUpload=createLiveCanvasTexture(pageUniform,t=>renderer.initTexture(t)),panelUpload=createLiveCanvasTexture(panelUniform,t=>renderer.initTexture(t),LinearFilter);
    canvasUploads.push(wallUpload,pageUpload,panelUpload);
    const panel=panelSurface;
    const panelMaterial=ownM(new ShaderMaterial({vertexShader:PHOTO_VERTEX,fragmentShader:PHOTO_FRAGMENT,uniforms:{uPhoto:panelUniform,uCover:{value:new Vector2(1,1)}},depthTest:false,depthWrite:false}));
    const panelPlane=new Mesh(ownG(new PlaneGeometry(1,1)),panelMaterial);panelPlane.renderOrder=-10;scene.add(panelPlane);
    sceneTarget=new WebGLRenderTarget(1,1,{depthBuffer:true,stencilBuffer:false});const background=sceneTarget;
    background.texture.generateMipmaps=false;background.texture.minFilter=background.texture.magFilter=NearestFilter;
    const paperTitle={value:new Vector4(1,1,-1,-1)},paperIntro={value:new Vector4(1,1,-1,-1)};
    const glassMaterial=ownM(new ShaderMaterial({
      vertexShader:GLASS_VERTEX,fragmentShader:GLASS_FRAGMENT,transparent:true,depthWrite:false,
      uniforms:{uPaperTitle:paperTitle,uPaperIntro:paperIntro,uWall:wallUniform,uScene:{value:background.texture},uPage:pageUniform,uCaptureReady:{value:0},uDomControl:{value:new Vector4()},uHeaderBottom:{value:0},uWait:{value:0},uFlash:{value:0},uSplit:{value:0},uCameraZ:{value:1},uDataDpr:{value:dataGlyphSamplingRatio(devicePixelRatio)},uWallRect:{value:new Vector4(0,0,1,1)},uResolution:{value:new Vector2(1,1)},uStage:{value:new Vector2(1,1)},uViewport:{value:new Vector2(1,1)},uStageOrigin:{value:new Vector2()},uPixelDpr:{value:1},uPhotoSize:{value:new Vector2(1,1)},uCenter:{value:new Vector2()},uResolve:{value:0},uRadius:{value:1},uMagnification:{value:GLASS_MAGNIFICATION},uLight:{value:new Vector3(-.85,1,.65)}},
    }));
    const dark=ownM(new MeshPhysicalMaterial({color:0x202421,metalness:.72,roughness:.28,clearcoat:.55,clearcoatRoughness:.24}));
    const bracketMaterial=ownM(new MeshStandardMaterial({color:0x1c1c1c,metalness:.3,roughness:.7}));
    const steel=ownM(new MeshStandardMaterial({color:0xa1a69e,metalness:.85,roughness:.22}));
    const red=ownM(new MeshStandardMaterial({color:0xb6382e,metalness:.2,roughness:.45}));
    const grip=ownM(new MeshPhysicalMaterial({color:0x191d19,metalness:.12,roughness:.65}));
    const mesh=(parent:Group,geometry:BufferGeometry,material:Material,px=0,py=0,pz=0)=>{
      const object=new Mesh(ownG(geometry),material);object.position.set(px,py,pz);object.castShadow=true;object.receiveShadow=true;parent.add(object);return object;
    };
    const loupe=new Group();scene.add(loupe);
    mesh(loupe,new TorusGeometry(107,9,20,104),dark);
    mesh(loupe,new TorusGeometry(102,1.5,10,104),steel,0,0,6);
    mesh(loupe,new TorusGeometry(108,.85,8,104),red,0,0,9);
    mesh(loupe,new TorusGeometry(113.5,.8,8,104),steel,0,0,2);
    const glass=mesh(loupe,new SphereGeometry(1,72,36),glassMaterial,0,0,1);glass.scale.set(100,100,9);glass.castShadow=false;glass.renderOrder=2;
    // The handle has its own damped rotational joint behind the lens.
    const handle=new Group();handle.position.set(0,-105,0);loupe.add(handle);
    mesh(handle,new CylinderGeometry(12,11,24,24),steel,0,-4,0);
    mesh(handle,new CapsuleGeometry(11,88,8,20),grip,0,-65,-1);
    mesh(handle,new CylinderGeometry(10,10,4,24),dark,0,-120,-1);
    for(let i=0;i<8;i++){const groove=mesh(handle,new TorusGeometry(11,.45,6,24),dark,0,-38-i*7,-1);groove.rotation.x=Math.PI/2;}
    const holder=new Group();scene.add(holder);
    // Keep both real mounting bolts within the 1.6x glass field, not hidden under the rim.
    mesh(holder,new BoxGeometry(100,23,9),bracketMaterial,0,15,5);
    mesh(holder,new BoxGeometry(38,12,18),bracketMaterial,0,15,16);
    mesh(holder,new BoxGeometry(14,70,9),bracketMaterial,0,-20,16);
    for(const sx of[-36,36]){
      const screw=mesh(holder,new SphereGeometry(4,20,12),steel,sx,15,11);screw.scale.z=.45;
      mesh(holder,new BoxGeometry(4,.8,.5),bracketMaterial,sx,15,13);
    }
    mesh(holder,new SphereGeometry(2.7,16,12),red,0,23.5,11);
    const cradleCurve=new CatmullRomCurve3([new Vector3(-102,45,18),new Vector3(-106,-30,24),new Vector3(0,-55,29),new Vector3(106,-30,24),new Vector3(102,45,18)]);
    mesh(holder,new TubeGeometry(cradleCurve,64,5.5,10,false),bracketMaterial);
    // Dark contact pads sit under the resting rim; real shadowing adds the contact occlusion.
    mesh(holder,new CapsuleGeometry(6,14,4,12),grip,-101,-6,25);
    mesh(holder,new CapsuleGeometry(6,14,4,12),grip,101,-6,25);
    const receiver=new Mesh(ownG(new PlaneGeometry(1,1)),ownM(new ShadowMaterial({opacity:.25,depthWrite:false})));receiver.position.z=.05;receiver.receiveShadow=true;scene.add(receiver);
    scene.add(new AmbientLight(0xf4f4f2,.85));
    const key=new DirectionalLight(0xfaf9f4,3.1);lightToDispose=key;key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.bias=-.00015;key.shadow.normalBias=.4;scene.add(key);scene.add(key.target);
    let layout=instrumentLayout(1,1),motion=createToolMotion(layout.dock),scale:SpringAxis={position:1,velocity:0};
    let visible=true,ratio=1,zoom=1,phase:LoupePhase='binary',lastTime=0,lastWall=-1000,lastReport=-1000;
    let shadowDirty=true,wallDirty=false,panelDirty=true,backgroundDirty=true,used=false,readout='X — / Y —',dataResolve=0,reading:RegionReading|undefined,lastMode:ToolMode='docked',lightProgress=0;
    let center:LoupePoint={...layout.dock},screenRadius=layout.dockRadius;
    const decrypt=createDecryptTimeline();let magnification=GLASS_MAGNIFICATION,lastCrackle=false;
    const baseCover=new Vector2(),projected=new Vector3();
    const media=matchMedia('(prefers-reduced-motion: reduce)');let reduced=options.reducedMotion??media.matches;
    const notifyMode=()=>{
      canvas.dataset.toolMode=motion.mode;
      if(lastMode!==motion.mode){lastMode=motion.mode;options.onMode?.(motion.mode);}
    };
    const applyLight=()=>{
      const l=scrollLight(reduced?0:lightProgress),extent=Math.max(layout.width,layout.height);
      key.position.set(l.x*extent,-l.y*extent,l.z*extent);
      key.shadow.radius=l.blur/3;key.shadow.camera.left=key.shadow.camera.bottom=-extent;
      key.shadow.camera.right=key.shadow.camera.top=extent;key.shadow.camera.far=extent*6;key.shadow.camera.updateProjectionMatrix();
      glassMaterial.uniforms.uLight.value.set(l.x,-l.y,l.z).normalize();shadowDirty=true;panelDirty=true;backgroundDirty=true;
    };
    const canRender=()=>visible&&!document.hidden&&!disposed&&!renderer.getContext().isContextLost();
    const request=()=>{if(!frame&&canRender())frame=requestAnimationFrame(render);};
    const render=(now:number)=>{
      frame=0;if(!canRender())return;
      const elapsed=lastTime?Math.max(0,(now-lastTime)/1000):1/60;lastTime=now;
      const prior=[motion.x.position,motion.y.position,motion.lift.position,motion.tiltX.position,motion.tiltY.position,motion.swing.position,scale.position];
      const wasReturning=motion.mode==='returning';
      advanceTool(motion,elapsed,reduced);
      scale=wasReturning&&motion.mode==='docked'?{position:1,velocity:0}:pickupScale(scale,motion.mode==='held',elapsed,reduced);
      const radius=compensatedRadius(layout.dockRadius,scale.position,camera.position.z,motion.lift.position);
      loupe.position.set(motion.x.position-layout.width/2,layout.height/2-motion.y.position,motion.lift.position);
      loupe.rotation.set(motion.tiltX.position,motion.tiltY.position,motion.roll.position);
      loupe.scale.setScalar(radius/100);handle.rotation.z=motion.swing.position;
      camera.updateMatrixWorld();projected.copy(loupe.position).project(camera);
      center={x:(projected.x*.5+.5)*layout.width,y:(.5-projected.y*.5)*layout.height};
      screenRadius=radius*camera.position.z/(camera.position.z-motion.lift.position);
      const inspecting=motion.mode==='held'&&overPhoto(center,layout);
      const contact=motion.mode==='held'?lensPhotoContact(center,screenRadius,{width:layout.photoWidth,height:layout.photoHeight}):0;
      const previousResolve=dataResolve;dataResolve=advanceDataResolve(dataResolve,contact,elapsed,reduced);
      if(motion.mode==='held'&&contact>0)decrypt.move(center,now);else decrypt.reset();
      const transition=decrypt.frame(now,reduced);
       if(phase!==transition.phase){phase=transition.phase;lastWall=-1000;options.onPhase?.(phase);if(phase==='json')deskSound('resolve');}
      if(transition.scramble&&!lastCrackle&&!transition.reverse)deskSound('crackle');lastCrackle=transition.scramble;
      glassMaterial.uniforms.uWait.value=reduced?0:transition.wait;glassMaterial.uniforms.uFlash.value=transition.flash;glassMaterial.uniforms.uSplit.value=transition.rgbSplit?1:0;
      glassMaterial.uniforms.uResolve.value=dataResolve;glassMaterial.uniforms.uRadius.value=screenRadius;
      glassMaterial.uniforms.uCenter.value.set(center.x,center.y);
      const next=[motion.x.position,motion.y.position,motion.lift.position,motion.tiltX.position,motion.tiltY.position,motion.swing.position,scale.position];
      const moving=next.some((value,index)=>Math.abs(value-prior[index])>(index>2?.00004:.01));
      if(motion.mode==='held'&&contact>0&&(lastWall<0||now-lastWall>(phase==='decoding'?14:35))){
        if(wallDirty){wall.resize(layout.photoWidth,layout.photoHeight,zoom,renderer.capabilities.maxTextureSize);wallDirty=false;}
        reading=options.readPixels({x:(center.x-layout.photoWidth/2)/zoom+layout.photoWidth/2,y:(center.y-layout.photoHeight/2)/zoom+layout.photoHeight/2},{width:layout.photoWidth,height:layout.photoHeight},screenRadius/zoom);
        if(inspecting)options.onReading?.(reading,phase);
        wall.paint(now,phase,transition.resolution,center,screenRadius/magnification*1.12,reading,options.photo,options.regions,reduced,transition.reverse,dataResolve,transition.elapsed,transition.reverseAge,transition.reverseStart);
        const rect=wall.detailRect;glassMaterial.uniforms.uWallRect.value.set(rect.x,rect.y,rect.width,rect.height);
        wallUpload.update(wall.detailCanvas);glassMaterial.uniformsNeedUpdate=true;lastWall=now;
      }
      const nextReadout=inspecting&&reading?`X ${reading.stats.pixel_xy[0]} / Y ${reading.stats.pixel_xy[1]}`:'X — / Y —';
      if(nextReadout!==readout){readout=nextReadout;panelDirty=true;}
      if(panelDirty){panel.paint(layout,reduced?0:lightProgress,used,readout,ratio);panelUpload.update(panel.canvas);panelMaterial.uniformsNeedUpdate=true;panelDirty=false;backgroundDirty=true;}
      const light=scrollLight(reduced?0:lightProgress),lift=Math.max(0,Math.min(1,(motion.lift.position-28)/(HELD_LIFT-28)));
      key.shadow.radius=light.blur/3*(1+lift*.25);
      if(backgroundDirty){
        loupe.visible=false;renderer.setRenderTarget(background);renderer.autoClear=true;renderer.shadowMap.needsUpdate=true;
        try{renderer.render(scene,camera);}finally{renderer.setRenderTarget(null);loupe.visible=true;}
      }
      const stageRect=canvas.getBoundingClientRect();glassMaterial.uniforms.uStageOrigin.value.set(stageRect.left,stageRect.top);
      // Intro copy can overlap a pinned stage in document stacking order. It is
      // still DOM paper, not photo data, even inside the stage's geometric rect.
      const paperRects=[document.querySelector('.wa-hero-title')?.getBoundingClientRect(),document.querySelector('.wa-hero-intro')?.getBoundingClientRect()];
      [paperTitle,paperIntro].forEach((uniform,index)=>{const rect=paperRects[index];if(rect)uniform.value.set(rect.left,rect.top,rect.right,rect.bottom);else uniform.value.set(1,1,-1,-1);});
      glassMaterial.uniforms.uHeaderBottom.value=Math.max(0,Math.min(innerHeight,document.querySelector('header')?.getBoundingClientRect().bottom??0));
      const control=canvas.parentElement?.querySelector('.wa-zoom-control')?.getBoundingClientRect();glassMaterial.uniforms.uDomControl.value=control?{x:control.left-stageRect.left,y:control.top-stageRect.top,z:control.right-stageRect.left,w:control.bottom-stageRect.top}:{x:0,y:0,z:0,w:0};
      glassMaterial.uniforms.uViewport.value.set(window.innerWidth,window.innerHeight);
      renderer.autoClear=true;renderer.shadowMap.needsUpdate=moving||shadowDirty||backgroundDirty;shadowDirty=false;backgroundDirty=false;
      layer.render(renderer,scene,camera,loupe,layout.width,layout.height);
      notifyMode();
      const dockFactor=camera.position.z/(camera.position.z-28);
      canvas.dataset.loupeX=center.x.toFixed(2);canvas.dataset.loupeY=center.y.toFixed(2);canvas.dataset.loupeRadius=screenRadius.toFixed(2);
      canvas.dataset.dockX=(layout.width/2+(layout.dock.x-layout.width/2)*dockFactor).toFixed(2);canvas.dataset.dockY=(layout.height/2+(layout.dock.y-layout.height/2)*dockFactor).toFixed(2);
      canvas.dataset.returnCount=String(motion.returnedAt);canvas.dataset.wallSpace='photo';canvas.dataset.wallPhase=phase;canvas.dataset.wallWidth=String(wall.canvas.width);canvas.dataset.wallHeight=String(wall.canvas.height);
      canvas.dataset.returnPhase=motion.returnEdge?'edge':motion.mode==='returning'?'cradle':motion.mode;
      canvas.dataset.photoWidth=String(layout.photoWidth);canvas.dataset.photoHeight=String(layout.photoHeight);canvas.dataset.photoZoom=String(zoom);canvas.dataset.regionId=inspecting?(reading?.region?.id??''):'';
      canvas.dataset.pickupScale=scale.position.toFixed(4);canvas.dataset.resolve=dataResolve.toFixed(4);canvas.dataset.refractionSource='viewport-capture+live-scene+data';canvas.dataset.magnification=String(magnification);
      canvas.dataset.wallDpr=String(wall.pixelRatio);canvas.dataset.glyphHeight=String(wall.glyphHeight*magnification);canvas.dataset.sampling='rgb-subpixels';canvas.dataset.renderDpr=String(ratio);canvas.dataset.decryptElapsed=String(transition.elapsed);
      const overPaper=paperRects.some(rect=>rect&&center.x+stageRect.left>=rect.left&&center.x+stageRect.left<=rect.right&&center.y+stageRect.top>=rect.top&&center.y+stageRect.top<=rect.bottom);
      canvas.dataset.centerSource=overPaper?'page':lensSurface(center,layout,{width:layout.photoWidth,height:layout.photoHeight});canvas.dataset.dataRasterDpr=String(wall.detailRatio);
      canvas.dataset.tiltX=String(motion.tiltX.position);canvas.dataset.tiltY=String(motion.tiltY.position);canvas.dataset.restAngle=String(motion.roll.position);
      if(now-lastReport>40||!moving){
        options.onFrame?.(center,phase==='json'?100:transition.reverse?Math.round(transition.resolution*100):Math.min(99,Math.floor((phase==='binary'?transition.wait*1000:1000+transition.elapsed)/(1000+(reduced?150:600))*100)),{mode:motion.mode,radius:screenRadius,inspecting,returnCount:motion.returnedAt,tiltX:motion.tiltX.position,tiltY:motion.tiltY.position});lastReport=now;
      }
      if(moving||motion.mode==='returning'||Math.abs(dataResolve-contact)>.001||Math.abs(previousResolve-dataResolve)>.0001||motion.mode==='held'&&contact>0&&phase!=='json')request();
    };
    const resetReveal=()=>{decrypt.reset();phase='binary';options.onPhase?.('binary');lastWall=-1000;};
    const visibility=()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else{lastTime=0;request();}};
    const preference=()=>{reduced=media.matches;applyLight();request();};
    const scroll=()=>{if(!frame)lastTime=0;request();};
    capture=createPageCapture(page=>{if(disposed)return;pageUpload.update(page);glassMaterial.uniformsNeedUpdate=true;glassMaterial.uniforms.uCaptureReady.value=1;request();},state=>{canvas.dataset.pageCapture=state;if(state==='failed')glassMaterial.uniforms.uCaptureReady.value=0;options.onCapture?.(state);},renderer.capabilities.maxTextureSize);
    renderer.compile(scene,camera);
    document.addEventListener('visibilitychange',visibility);media.addEventListener('change',preference);
    window.addEventListener('scroll',scroll,{passive:true});
    void document.fonts.ready.then(()=>{if(!disposed){wall.resize(layout.photoWidth,layout.photoHeight,zoom,renderer.capabilities.maxTextureSize);panelDirty=true;lastWall=-1000;request();}});
    const floorPoint=(point:LoupePoint)=>({x:layout.width/2+(point.x-layout.width/2)*(1-HELD_LIFT/camera.position.z),y:layout.height/2+(point.y-layout.height/2)*(1-HELD_LIFT/camera.position.z)});
    return {
      pickup(point){if(motion.mode==='held')return;lastTime=0;used=true;panelDirty=true;pickUpTool(motion,floorPoint(point));resetReveal();notifyMode();request();},
      release(){if(motion.mode!=='held')return;lastTime=0;returnTool(motion);const edge=boundPoint(center,{width:layout.width,height:layout.height});if(edge.x!==center.x||edge.y!==center.y){const factor=1-motion.lift.position/camera.position.z;motion.returnEdge={x:layout.width/2+(edge.x-layout.width/2)*factor,y:layout.height/2+(edge.y-layout.height/2)*factor};}resetReveal();notifyMode();request();},
      hover(point){motion.hover=point;if(motion.mode==='docked'){if(!frame)lastTime=0;request();}},
      draw(point){if(motion.mode!=='held')return;if(!frame)lastTime=0;motion.target=floorPoint(point);lastWall=-1000;request();},
      hitTest(point){
        if(Math.hypot(point.x-center.x,point.y-center.y)<screenRadius*1.2)return true;
        const vx=Math.sin(motion.roll.position)*screenRadius*2.25,vy=Math.cos(motion.roll.position)*screenRadius*2.25;
        const px=point.x-center.x,py=point.y-center.y,t=Math.max(.4,Math.min(1,(px*vx+py*vy)/(vx*vx+vy*vy)));
        return Math.hypot(px-vx*t,py-vy*t)<screenRadius*.16;
      },
      resize(width,height,dpr=window.devicePixelRatio){
        layout=instrumentLayout(Math.max(1,width),Math.max(1,height));motion.dock={...layout.dock};
        if(motion.mode==='docked'){const count=motion.returnedAt;motion=createToolMotion(layout.dock);motion.returnedAt=count;scale={position:1,velocity:0};}
        const limit=Math.min(renderer.capabilities.maxTextureSize,renderer.getContext().getParameter(renderer.getContext().MAX_RENDERBUFFER_SIZE) as number);
        ratio=Math.min(dpr||1,limit/Math.max(window.innerWidth,window.innerHeight,layout.width,layout.height));
        renderer.setPixelRatio(ratio);renderer.setSize(window.innerWidth,window.innerHeight,false);
        canvas.width=Math.round(layout.width*ratio);canvas.height=Math.round(layout.height*ratio);glassMaterial.uniforms.uPixelDpr.value=ratio;
        glassMaterial.uniforms.uDataDpr.value=dataGlyphSamplingRatio(devicePixelRatio);
        camera.aspect=layout.width/layout.height;camera.position.z=layout.height/(2*Math.tan(35*Math.PI/360));camera.updateProjectionMatrix();
        glassMaterial.uniforms.uCameraZ.value=camera.position.z;
        photoPlane.scale.set(layout.photoWidth,layout.photoHeight,1);photoPlane.position.set((layout.photoWidth-layout.width)/2,(layout.height-layout.photoHeight)/2,0);
        const panelHeight=layout.mobile?160:layout.height;
        panelPlane.scale.set(layout.panelWidth,panelHeight,1);panelPlane.position.set(layout.mobile?0:layout.photoWidth+layout.panelWidth/2-layout.width/2,layout.mobile?-(layout.height-panelHeight)/2:0,0);
        receiver.scale.set(layout.width,layout.height,1);
        holder.position.set(layout.dock.x-layout.width/2,layout.height/2-layout.dock.y-layout.dockRadius*.45,0);holder.scale.setScalar(layout.dockRadius/100);
        const cover=Math.max(layout.photoWidth/image.naturalWidth,layout.photoHeight/image.naturalHeight);
        baseCover.set(layout.photoWidth/(image.naturalWidth*cover),layout.photoHeight/(image.naturalHeight*cover));photoMaterial.uniforms.uCover.value.copy(baseCover).divideScalar(zoom);
        renderer.getDrawingBufferSize(glassMaterial.uniforms.uResolution.value);background.setSize(Math.round(layout.width*ratio),Math.round(layout.height*ratio));glassMaterial.uniforms.uStage.value.set(layout.width,layout.height);glassMaterial.uniforms.uPhotoSize.value.set(layout.photoWidth,layout.photoHeight);
        wall.resize(layout.photoWidth,layout.photoHeight,zoom,renderer.capabilities.maxTextureSize);lastWall=-1000;applyLight();request();
      },
      setPhase(next){if(next==='binary')resetReveal();request();},
      cancelReveal(){resetReveal();request();},
      setVisible(next){visible=next;layer.canvas.style.visibility=next?'visible':'hidden';if(!next){cancelAnimationFrame(frame);frame=0;}else{lastTime=0;request();}},
      setPhotoZoom(next){zoom=Math.max(1,Math.min(1.12,next));photoMaterial.uniforms.uCover.value.copy(baseCover).divideScalar(zoom);wallDirty=true;backgroundDirty=true;lastWall=-1000;request();},
      setLighting(progress){lightProgress=progress;applyLight();request();},
      setMagnification(next){magnification=[3,6,10].includes(next)?next:6;glassMaterial.uniforms.uMagnification.value=magnification;lastWall=-1000;request();capture?.refresh();},
      refreshCapture(){capture?.refresh();},
      dispose(){disposed=true;document.removeEventListener('visibilitychange',visibility);media.removeEventListener('change',preference);window.removeEventListener('scroll',scroll);release();},
    };
  }catch(error){release();throw error;}
}
