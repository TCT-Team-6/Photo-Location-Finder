import {
  AmbientLight, BoxGeometry, CanvasTexture, CapsuleGeometry, CatmullRomCurve3, CylinderGeometry,
  DirectionalLight, Group, LinearFilter, NearestFilter, Mesh, MeshPhysicalMaterial, MeshStandardMaterial,
  NoToneMapping, PCFShadowMap, PerspectiveCamera, PlaneGeometry, Scene, ShaderMaterial,
  ShadowMaterial, SphereGeometry, SRGBColorSpace, Texture, TorusGeometry, TubeGeometry,
  Vector2, Vector3, WebGLRenderer, WebGLRenderTarget, type BufferGeometry, type Material,
} from 'three';
import type { SpringAxis } from './loupe-physics';
import { advanceTool, createToolMotion, pickUpTool, returnTool, type ToolMode } from './loupe-kinematics';
import { instrumentLayout, overPhoto, scrollLight } from './instrument-layout';
import { createDataWall } from './loupe-wall';
import { createPanelSurface } from './loupe-panel-surface';
import { createLoupeLayer } from './loupe-layer';
import { boundPoint, rubberbandPoint } from './loupe-bounds';
import { advanceDataResolve, compensatedRadius, GLASS_MAGNIFICATION, HELD_LIFT, lensPhotoContact, pickupScale } from './lens-feedback';
import type { LoupePhase, LoupePoint } from './loupe-dwell';
import type { ExamplePhoto, ImageRegion, RegionReading } from './loupe-image-data';

const PHOTO_VERTEX=`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const PHOTO_FRAGMENT=`uniform sampler2D uPhoto;uniform vec2 uCover;varying vec2 vUv;
void main(){gl_FragColor=texture2D(uPhoto,(vUv-.5)*uCover+.5);
#include <colorspace_fragment>
}`;
const GLASS_VERTEX=`varying vec3 vNormal;varying vec2 vLocal;
void main(){vNormal=normalize(normalMatrix*normal);vLocal=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
// Both real scene transmission and the data wall use the same refracted scene UV.
const GLASS_FRAGMENT=`
uniform sampler2D uWall;uniform vec2 uResolution;uniform vec2 uStage;uniform vec2 uPhotoSize;
uniform sampler2D uScene;uniform vec2 uCenter;uniform vec2 uViewport;uniform vec2 uStageOrigin;uniform float uPixelDpr;uniform vec3 uLight;uniform float uResolve;uniform float uRadius;uniform float uMagnification;varying vec3 vNormal;varying vec2 vLocal;
void main(){
 vec3 n=normalize(vNormal);float edge=smoothstep(.85,1.,clamp(length(vLocal),0.,1.));
 vec2 screen=vec2(gl_FragCoord.x/uResolution.x,1.-gl_FragCoord.y/uResolution.y)*uViewport-uStageOrigin;
 vec3 ray=refract(vec3(0.,0.,-1.),n,1./1.517);
 vec2 wallPoint=uCenter+(screen-uCenter)/uMagnification*(1.+.075*edge)+ray.xy*2.2*edge;
 vec2 uv=vec2(wallPoint.x/uPhotoSize.x,1.-wallPoint.y/uPhotoSize.y);
 vec2 sceneUV=vec2(wallPoint.x/uStage.x,1.-wallPoint.y/uStage.y);
 vec2 fringe=n.xy*.00012*edge;
 vec3 data=vec3(texture2D(uWall,clamp(uv+fringe,.0001,.9999)).r,texture2D(uWall,clamp(uv,.0001,.9999)).g,texture2D(uWall,clamp(uv-fringe,.0001,.9999)).b);
 vec3 transmitted=vec3(texture2D(uScene,clamp(sceneUV+fringe,.0001,.9999)).r,texture2D(uScene,clamp(sceneUV,.0001,.9999)).g,texture2D(uScene,clamp(sceneUV-fringe,.0001,.9999)).b);
 float fresnel=.035+.965*pow(1.-abs(n.z),5.);
 float shine=pow(max(dot(reflect(-normalize(uLight),n),vec3(0.,0.,1.)),0.),18.);
 // Mask the same refracted point sampled by both textures. Convert its gradient
 // back to CSS pixels so magnification, barrel curvature and DPR keep a 12px feather.
 float photoDistance=min(min(wallPoint.x,uPhotoSize.x-wallPoint.x),min(wallPoint.y,uPhotoSize.y-wallPoint.y));
 vec2 sourceGradient=vec2(dFdx(photoDistance)*uResolution.x/uViewport.x,dFdy(photoDistance)*uResolution.y/uViewport.y);
 float feather=6.*max(length(sourceGradient),.0001);
 float edgeMask=smoothstep(-feather,feather,photoDistance);
 float radial=length(screen-uCenter)/max(1.,uRadius),front=uResolve*1.12-.06;
 float radialMask=1.-smoothstep(front-.06,front+.06,radial);
 vec3 color=mix(transmitted,data,edgeMask*radialMask);
 float stripe=floor(fract(wallPoint.x*uPixelDpr)*3.);
 vec3 aperture=stripe<1.?vec3(1.,.5,.5):stripe<2.?vec3(.5,1.,.5):vec3(.5,.5,1.);
 color=mix(color,color*aperture,.15);
 color=mix(color,vec3(.91,.96,.94),.015)*(1.-edge*.045);
 color=mix(color,vec3(.98,.99,.97),fresnel*.13)+shine*.045;
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
};
type Options = {
  reducedMotion?: boolean; photo: ExamplePhoto; regions: ImageRegion[]; sampleIndex?:number;
  readPixels: (point: LoupePoint,viewport: {width:number;height:number},radius:number) => RegionReading;
  onReading?: (reading: RegionReading,phase: LoupePhase) => void; onFrame?: (point: LoupePoint,progress: number,state: ToolFrame) => void;
  onMode?: (mode: ToolMode) => void;
};

export function createOpticalRenderer(canvas: HTMLCanvasElement,image: HTMLImageElement,options: Options): OpticalRenderer {
  const layer=createLoupeLayer(canvas);
  let renderer:WebGLRenderer;
  try{renderer=new WebGLRenderer({canvas:layer.canvas,alpha:true,antialias:true,powerPreference:'low-power'});}catch(error){layer.dispose();throw error;}
  const geometries:BufferGeometry[]=[],materials:Material[]=[],textures:Texture[]=[];
  let frame=0,disposed=false,dataWall:ReturnType<typeof createDataWall>|null=null,panelSurface:ReturnType<typeof createPanelSurface>|null=null,sceneTarget:WebGLRenderTarget|null=null;
  let lightToDispose:DirectionalLight|null=null;
  const release=()=>{cancelAnimationFrame(frame);geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());sceneTarget?.dispose();lightToDispose?.shadow.dispose();dataWall?.dispose();panelSurface?.dispose();layer.dispose();renderer.dispose();};
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
    const panel=panelSurface,panelTexture=new CanvasTexture(panel.canvas);panelTexture.colorSpace=SRGBColorSpace;panelTexture.minFilter=panelTexture.magFilter=LinearFilter;panelTexture.generateMipmaps=false;textures.push(panelTexture);
    const panelMaterial=ownM(new ShaderMaterial({vertexShader:PHOTO_VERTEX,fragmentShader:PHOTO_FRAGMENT,uniforms:{uPhoto:{value:panelTexture},uCover:{value:new Vector2(1,1)}},depthTest:false,depthWrite:false}));
    const panelPlane=new Mesh(ownG(new PlaneGeometry(1,1)),panelMaterial);panelPlane.renderOrder=-10;scene.add(panelPlane);
    sceneTarget=new WebGLRenderTarget(1,1,{depthBuffer:true,stencilBuffer:false});const background=sceneTarget;
    background.texture.generateMipmaps=false;background.texture.minFilter=background.texture.magFilter=NearestFilter;
    const texture=new CanvasTexture(wall.canvas);texture.colorSpace=SRGBColorSpace;texture.minFilter=texture.magFilter=NearestFilter;texture.generateMipmaps=false;textures.push(texture);
    const glassMaterial=ownM(new ShaderMaterial({
      vertexShader:GLASS_VERTEX,fragmentShader:GLASS_FRAGMENT,transparent:true,depthWrite:false,
      uniforms:{uWall:{value:texture},uScene:{value:background.texture},uResolution:{value:new Vector2(1,1)},uStage:{value:new Vector2(1,1)},uViewport:{value:new Vector2(1,1)},uStageOrigin:{value:new Vector2()},uPixelDpr:{value:1},uPhotoSize:{value:new Vector2(1,1)},uCenter:{value:new Vector2()},uResolve:{value:0},uRadius:{value:1},uMagnification:{value:GLASS_MAGNIFICATION},uLight:{value:new Vector3(-.85,1,.65)}},
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
    let visible=true,ratio=1,zoom=1,phase:LoupePhase='binary',lastTime=0,lastWall=-1000,lastReport=-1000,glitchStart=0,reverseUntil=0,cycleStart=0;
    let shadowDirty=true,wallDirty=false,panelDirty=true,backgroundDirty=true,used=false,readout='X — / Y —',dataResolve=0,reading:RegionReading|undefined,lastMode:ToolMode='docked',lightProgress=0;
    let center:LoupePoint={...layout.dock},screenRadius=layout.dockRadius;
    let pointerAnchor:LoupePoint|null=null;
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
      glassMaterial.uniforms.uResolve.value=dataResolve;glassMaterial.uniforms.uRadius.value=screenRadius;
      glassMaterial.uniforms.uCenter.value.set(center.x,center.y);
      const next=[motion.x.position,motion.y.position,motion.lift.position,motion.tiltX.position,motion.tiltY.position,motion.swing.position,scale.position];
      const moving=next.some((value,index)=>Math.abs(value-prior[index])>(index>2?.00004:.01));
      if(motion.mode==='held'&&contact>0&&(lastWall<0||now-lastWall>35)){
        if(wallDirty){wall.resize(layout.photoWidth,layout.photoHeight,zoom,renderer.capabilities.maxTextureSize);wallDirty=false;}
        reading=options.readPixels({x:(center.x-layout.photoWidth/2)/zoom+layout.photoWidth/2,y:(center.y-layout.photoHeight/2)/zoom+layout.photoHeight/2},{width:layout.photoWidth,height:layout.photoHeight},screenRadius/zoom);
        if(inspecting)options.onReading?.(reading,phase);
        const reverse=now<reverseUntil;
        const progress=phase==='decoding'?Math.min(1,(now-glitchStart)/500):reverse?Math.max(0,(reverseUntil-now)/500):phase==='json'?1:0;
        wall.paint(now,phase,progress,center,screenRadius,reading,options.photo,options.regions,reduced,reverse,dataResolve);
        texture.needsUpdate=true;lastWall=now;
      }
      const nextReadout=inspecting&&reading?`X ${reading.stats.pixel_xy[0]} / Y ${reading.stats.pixel_xy[1]}`:'X — / Y —';
      if(nextReadout!==readout){readout=nextReadout;panelDirty=true;}
      if(panelDirty){panel.paint(layout,reduced?0:lightProgress,used,readout,ratio);panelTexture.needsUpdate=true;panelDirty=false;backgroundDirty=true;}
      const light=scrollLight(reduced?0:lightProgress),lift=Math.max(0,Math.min(1,(motion.lift.position-28)/(HELD_LIFT-28)));
      key.shadow.radius=light.blur/3*(1+lift*.25);
      if(backgroundDirty){
        loupe.visible=false;renderer.setRenderTarget(background);renderer.autoClear=true;renderer.shadowMap.needsUpdate=true;
        try{renderer.render(scene,camera);}finally{renderer.setRenderTarget(null);loupe.visible=true;}
      }
      const stageRect=canvas.getBoundingClientRect();glassMaterial.uniforms.uStageOrigin.value.set(stageRect.left,stageRect.top);
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
      canvas.dataset.pickupScale=scale.position.toFixed(4);canvas.dataset.resolve=dataResolve.toFixed(4);canvas.dataset.refractionSource='scene-render-target';canvas.dataset.magnification=String(GLASS_MAGNIFICATION);
      canvas.dataset.wallDpr=String(wall.pixelRatio);canvas.dataset.glyphHeight=String(wall.glyphHeight*GLASS_MAGNIFICATION);canvas.dataset.sampling='nearest';canvas.dataset.renderDpr=String(ratio);
      canvas.dataset.tiltX=String(motion.tiltX.position);canvas.dataset.tiltY=String(motion.tiltY.position);canvas.dataset.restAngle=String(motion.roll.position);
      if(now-lastReport>40||!moving){
        options.onFrame?.(center,phase==='json'?100:cycleStart?Math.min(99,Math.floor((now-cycleStart)/15)):0,{mode:motion.mode,radius:screenRadius,inspecting,returnCount:motion.returnedAt,tiltX:motion.tiltX.position,tiltY:motion.tiltY.position});lastReport=now;
      }
      if(moving||motion.mode==='returning'||Math.abs(dataResolve-contact)>.001||Math.abs(previousResolve-dataResolve)>.0001||motion.mode==='held'&&contact>0&&(phase!=='json'||now<reverseUntil))request();
    };
    const resetReveal=()=>{phase='binary';cycleStart=0;reverseUntil=0;lastWall=-1000;};
    const visibility=()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else{lastTime=0;request();}};
    const preference=()=>{reduced=media.matches;applyLight();request();};
    const scroll=()=>{if(!frame)lastTime=0;request();};
    renderer.compile(scene,camera);
    document.addEventListener('visibilitychange',visibility);media.addEventListener('change',preference);
    window.addEventListener('scroll',scroll,{passive:true});
    void document.fonts.ready.then(()=>{if(!disposed){wall.resize(layout.photoWidth,layout.photoHeight,zoom,renderer.capabilities.maxTextureSize);panelDirty=true;lastWall=-1000;request();}});
    const floorPoint=(point:LoupePoint)=>({x:layout.width/2+(point.x-layout.width/2)*(1-HELD_LIFT/camera.position.z),y:layout.height/2+(point.y-layout.height/2)*(1-HELD_LIFT/camera.position.z)});
    return {
      pickup(point){if(motion.mode==='held')return;lastTime=0;used=true;panelDirty=true;pickUpTool(motion,floorPoint(point));pointerAnchor={...point};resetReveal();cycleStart=performance.now();notifyMode();request();},
      release(){if(motion.mode!=='held')return;lastTime=0;returnTool(motion);const edge=boundPoint(center,{width:layout.width,height:layout.height});if(edge.x!==center.x||edge.y!==center.y){const factor=1-motion.lift.position/camera.position.z;motion.returnEdge={x:layout.width/2+(edge.x-layout.width/2)*factor,y:layout.height/2+(edge.y-layout.height/2)*factor};}resetReveal();notifyMode();request();},
      hover(point){motion.hover=point;if(motion.mode==='docked'){if(!frame)lastTime=0;request();}},
      draw(point){if(motion.mode!=='held')return;if(!frame)lastTime=0;motion.target=floorPoint(rubberbandPoint(point,{width:layout.width,height:layout.height}));if(!pointerAnchor||Math.hypot(point.x-pointerAnchor.x,point.y-pointerAnchor.y)>=3){pointerAnchor={...point};if(phase==='json'||phase==='decoding'){glitchStart=performance.now();reverseUntil=glitchStart+500;phase='binary';}cycleStart=performance.now();lastWall=-1000;}request();},
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
        camera.aspect=layout.width/layout.height;camera.position.z=layout.height/(2*Math.tan(35*Math.PI/360));camera.updateProjectionMatrix();
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
      setPhase(next){if(phase!==next&&next==='binary'&&phase==='json')reverseUntil=performance.now()+500;phase=next;glitchStart=performance.now();lastWall=-1000;if(next==='json'){cycleStart=0;reverseUntil=0;}request();},
      cancelReveal(){if(phase==='json'||phase==='decoding'){glitchStart=performance.now();reverseUntil=glitchStart+500;}phase='binary';cycleStart=0;lastWall=-1000;request();},
      setVisible(next){visible=next;layer.canvas.style.visibility=next?'visible':'hidden';if(!next){cancelAnimationFrame(frame);frame=0;}else{lastTime=0;request();}},
      setPhotoZoom(next){zoom=Math.max(1,Math.min(1.12,next));photoMaterial.uniforms.uCover.value.copy(baseCover).divideScalar(zoom);wallDirty=true;backgroundDirty=true;lastWall=-1000;request();},
      setLighting(progress){lightProgress=progress;applyLight();request();},
      dispose(){disposed=true;document.removeEventListener('visibilitychange',visibility);media.removeEventListener('change',preference);window.removeEventListener('scroll',scroll);release();},
    };
  }catch(error){release();throw error;}
}
