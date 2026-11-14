import {
  AmbientLight, CanvasTexture, CapsuleGeometry, CylinderGeometry, DirectionalLight,
  Group, LinearFilter, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, NoToneMapping,
  OrthographicCamera, PCFShadowMap, PlaneGeometry, Scene, ShaderMaterial, ShadowMaterial,
  SphereGeometry, SRGBColorSpace, Texture, TorusGeometry, Vector2, WebGLRenderer,
  type BufferGeometry, type Material,
} from 'three';
import { stepLoupeSpring, type SpringAxis } from './loupe-physics';
import type { LoupePhase, LoupePoint } from './loupe-dwell';
import type { RegionReading } from './loupe-image-data';

const PHOTO_VERTEX = `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const PHOTO_FRAGMENT = `
uniform sampler2D uPhoto; uniform vec2 uCover; varying vec2 vUv;
void main(){gl_FragColor=texture2D(uPhoto,(vUv-.5)*uCover+.5);
#include <colorspace_fragment>
}`;
const GLASS_VERTEX = `
varying vec3 vNormal; varying vec2 vLocal;
void main(){vNormal=normalize(normalMatrix*normal);vLocal=position.xy;
gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}
`;
// The glass refracts only the opaque DATA texture; no photograph is transmitted.
const GLASS_FRAGMENT = `
uniform sampler2D uData;
uniform vec2 uResolution; uniform vec2 uCenter; uniform vec2 uRadius;
varying vec3 vNormal; varying vec2 vLocal;
void main(){
 vec3 n=normalize(vNormal);
 vec2 q=vLocal/1.025;
 float edge=pow(clamp(length(q),0.,1.),6.);
 vec3 ray=refract(vec3(0.,0.,-1.),n,1./1.517);
 vec2 uv=.5+q*.5*(1.+.085*edge)+ray.xy*.008*edge;
 vec2 dispersion=n.xy*.0015*edge;
 vec3 glass=vec3(texture2D(uData,clamp(uv+dispersion,0.001,.999)).r,
 texture2D(uData,clamp(uv,0.001,.999)).g,texture2D(uData,clamp(uv-dispersion,0.001,.999)).b);
 float fresnel=.025+.975*pow(1.-abs(n.z),5.);
 float shine=pow(max(dot(reflect(-normalize(vec3(-.5,.7,1.)),n),vec3(0.,0.,1.)),0.),100.);
 glass=mix(glass,vec3(.90,.91,.90),fresnel*.07)+shine*.06;
 gl_FragColor=vec4(glass,1.);
 #include <colorspace_fragment>
}`;

export type OpticalRenderer = {
  draw: (point: LoupePoint) => void;
  resize: (width: number, height: number, dpr?: number) => void;
  setPhase: (phase: LoupePhase) => void;
  cancelReveal: () => void;
  setVisible: (visible: boolean) => void;
  setPhotoZoom: (zoom: number) => void;
  dispose: () => void;
};
type Options = {
  reducedMotion?: boolean;
  readPixels: (point: LoupePoint, viewport: { width: number; height: number }, radius: number) => RegionReading;
  onReading?: (reading: RegionReading) => void;
  onFrame?: (point: LoupePoint, progress: number) => void;
};

export function createOpticalRenderer(canvas: HTMLCanvasElement, image: HTMLImageElement, options: Options): OpticalRenderer {
  const renderer = new WebGLRenderer({ canvas, alpha: false, antialias: true, powerPreference: 'low-power' });
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];
  const textures: Texture[] = [];
  let frame = 0;
  let disposed = false;
  const release = () => {
    cancelAnimationFrame(frame);
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    textures.forEach((texture) => texture.dispose());
    renderer.dispose();
  };
  try {
    renderer.setClearColor(0xf4f4f2);
    renderer.debug.onShaderError = () => { throw new Error('Three.js lens shader could not compile.'); };
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = NoToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFShadowMap;
    renderer.shadowMap.autoUpdate = false;
    const photoScene = new Scene();
    const scene = new Scene();
    const camera = new OrthographicCamera(-1, 1, 1, -1, .1, 3000);
    camera.position.z = 1100;
    const ownGeometry = <T extends BufferGeometry>(geometry: T): T => { geometries.push(geometry); return geometry; };
    const ownMaterial = <T extends Material>(material: T): T => { materials.push(material); return material; };
    const source = new Texture(image);
    source.colorSpace = SRGBColorSpace;
    source.minFilter = LinearFilter;
    source.magFilter = LinearFilter;
    source.generateMipmaps = false;
    source.needsUpdate = true;
    textures.push(source);
    const photoMaterial = ownMaterial(new ShaderMaterial({
      vertexShader: PHOTO_VERTEX, fragmentShader: PHOTO_FRAGMENT,
      uniforms: { uPhoto: { value: source }, uCover: { value: new Vector2(1, 1) } },
      depthTest: false, depthWrite: false,
    }));
    const photoPlane = new Mesh(ownGeometry(new PlaneGeometry(1, 1)), photoMaterial);
    photoScene.add(photoPlane);
    const dataCanvas = document.createElement('canvas');
    dataCanvas.width = dataCanvas.height = 512;
    const context = dataCanvas.getContext('2d');
    if (!context) throw new Error('Lens data surface unavailable.');
    const dataFont = getComputedStyle(canvas).getPropertyValue('--app-font-mono').trim() || '"DM Mono", monospace';
    const highContrast = canvas.closest('[data-high-contrast="true"]') !== null;
    const dataTexture = new CanvasTexture(dataCanvas);
    dataTexture.colorSpace = SRGBColorSpace;
    dataTexture.minFilter = LinearFilter;
    dataTexture.generateMipmaps = false;
    textures.push(dataTexture);
    const glassMaterial = ownMaterial(new ShaderMaterial({
      vertexShader: GLASS_VERTEX, fragmentShader: GLASS_FRAGMENT,
      uniforms: {
        uData: { value: dataTexture },
        uResolution: { value: new Vector2(1, 1) }, uCenter: { value: new Vector2(.5, .5) },
        uRadius: { value: new Vector2(.1, .1) },
      },
    }));
    const loupe = new Group();
    loupe.position.z = 36;
    scene.add(loupe);
    const dark = ownMaterial(new MeshPhysicalMaterial({ color: 0x202421, metalness: .72, roughness: .28, clearcoat: .5, clearcoatRoughness: .3 }));
    const metal = ownMaterial(new MeshStandardMaterial({ color: 0x8f9690, metalness: .85, roughness: .24 }));
    const red = ownMaterial(new MeshStandardMaterial({ color: 0xb6382e, metalness: .25, roughness: .4 }));
    const grip = ownMaterial(new MeshPhysicalMaterial({ color: 0x171c19, metalness: .25, roughness: .4, clearcoat: .2 }));
    const addMesh = (geometry: BufferGeometry, material: Material, z = 0) => {
      const mesh = new Mesh(ownGeometry(geometry), material);
      mesh.position.z = z;
      mesh.castShadow = true;
      loupe.add(mesh);
      return mesh;
    };
    // All geometry is authored around a 100-unit lens; loupe.scale adapts it.
    addMesh(new TorusGeometry(107, 9, 20, 112), dark);
    addMesh(new TorusGeometry(102, 1.3, 10, 112), metal, 6);
    addMesh(new TorusGeometry(109, .9, 8, 112), red, 8.5);
    addMesh(new TorusGeometry(113.5, .8, 8, 112), metal, 2);
    const lens = addMesh(new SphereGeometry(1, 80, 40), glassMaterial, 1);
    lens.scale.set(100, 100, 8);
    lens.castShadow = false;
    const handle = addMesh(new CapsuleGeometry(11, 87, 8, 20), grip, -1);
    handle.position.set(101, -135, -1);
    handle.rotation.z = .64;
    const collar = addMesh(new CylinderGeometry(12, 11, 25, 32), metal, 0);
    collar.position.set(72, -96, 0);
    collar.rotation.z = .64;
    const endCap = addMesh(new CylinderGeometry(10, 10, 4, 24), dark);
    endCap.position.set(132, -176, -1);
    endCap.rotation.z = .64;
    for (let i = 0; i < 8; i++) {
      const groove = addMesh(new TorusGeometry(11, .45, 6, 24), dark);
      groove.rotation.x = Math.PI / 2;
      groove.rotation.z = .64;
      groove.position.set(95 + i * 4.2, -127 - i * 5.6, -1);
    }
    scene.add(new AmbientLight(0xf4f4f2, 2.2));
    const key = new DirectionalLight(0xfaf9f4, 3.7);
    key.position.set(-340, 440, 900);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = key.shadow.camera.bottom = -1000;
    key.shadow.camera.right = key.shadow.camera.top = 1000;
    key.shadow.camera.far = 2200;
    key.shadow.bias = -.0004;
    scene.add(key);
    const fill = new DirectionalLight(0xe4e8e6, 2);
    fill.position.set(420, -100, 450);
    scene.add(fill);
    const shadow = new Mesh(ownGeometry(new PlaneGeometry(1, 1)), ownMaterial(new ShadowMaterial({ opacity: .2 })));
    shadow.receiveShadow = true;
    scene.add(shadow);
    let width = 1, height = 1, radius = 125, ratio = 1, photoZoom = 1;
    const baseCover = new Vector2(1, 1);
    let x: SpringAxis = { position: 0, velocity: 0 };
    let y: SpringAxis = { position: 0, velocity: 0 };
    let destination: LoupePoint = { x: 0, y: 0 };
    let anchor: LoupePoint = { x: -999, y: -999 };
    let tiltX: SpringAxis = { position: 0, velocity: 0 };
    let tiltY: SpringAxis = { position: 0, velocity: 0 };
    let visible = true;
    let phase: LoupePhase = 'binary';
    let lastTime = 0, lastData = -1000, lastReport = -1000, cycleStart = 0, glitchStart = -1000, reverseUntil = 0;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    let reduceMotion = options.reducedMotion ?? media.matches;
    let currentReading: RegionReading;
    let shadowDirty = true;
    const paintData = (now: number) => {
      currentReading = options.readPixels({ x: (x.position - width / 2) / photoZoom + width / 2, y: (y.position - height / 2) / photoZoom + height / 2 }, { width, height }, radius / photoZoom);
      options.onReading?.(currentReading);
      context.fillStyle = '#f4f4f2';
      context.fillRect(0, 0, 512, 512);
      context.fillStyle = highContrast ? '#101410' : '#242723';
      const record = currentReading.record;
      const stats = currentReading.stats;
      const clip = (value: unknown, limit: number) => String(value ?? '').length > limit ? `${String(value).slice(0, limit - 1)}…` : String(value ?? '');
      const jsonLines = [
        '{', ` "region":${JSON.stringify(clip(record.region, 20))},`,
        ` "pixel_xy":${JSON.stringify(stats.pixel_xy)},`,
        ` "avg_rgb":${JSON.stringify(stats.avg_rgb)},`,
        ` "hex":"${stats.hex}",`,
        ` "brightness":${stats.brightness},`,
        ` "dominant_colors":`, `  ${JSON.stringify(stats.dominant_colors)},`,
        ` "edge_density":${stats.edge_density},`,
        ` "clue":${JSON.stringify(clip(record.clue ?? record.subject, 23))},`,
        ` "gps":${JSON.stringify(record.gps)},`,
        ` "gps_status":${JSON.stringify(clip(record.gps_status, 23))},`,
        ` "capture":${JSON.stringify(clip(record.capture, 23))},`,
        ' "details":"full JSON download"', '}',
      ];
      const showJson = phase === 'json';
      const transitioning = !reduceMotion && (phase === 'decoding' || now < reverseUntil);
      const progress = phase === 'decoding' ? Math.min(1, (now - glitchStart) / 500) : Math.max(0, (reverseUntil - now) / 500);
      const lines = showJson || transitioning ? jsonLines : currentReading.binary;
      context.font = `${showJson || transitioning ? 19 : 16}px ${dataFont}`;
      lines.forEach((line, row) => {
        let output = line;
        let shift = 0;
        if (transitioning && !reduceMotion) {
          const frame = Math.floor((now - glitchStart) / 42);
          const preserve = Math.floor(line.length * progress);
          const bytes = currentReading.binary[row % currentReading.binary.length].replaceAll(' ', '');
          output = line.split('').map((char, index) => index < preserve || char === ' ' ? char : bytes[(index + frame) % bytes.length]).join('');
          shift = ((frame + row * 3) % 5 - 2) * (1 - progress) * 7;
          context.fillStyle = 'rgba(142,40,35,.55)';
          context.fillText(output, 72 + shift + 2, 75 + row * 24);
          context.fillStyle = 'rgba(35,66,82,.5)';
          context.fillText(output, 72 + shift - 2, 75 + row * 24);
        }
        context.fillStyle = '#242723';
        context.fillText(output, (showJson || transitioning ? 72 : 65) + shift, (showJson || transitioning ? 75 : 66) + row * (showJson || transitioning ? 24 : 23));
      });
      if (transitioning && !reduceMotion) {
        const slice = Math.floor((now - glitchStart) / 60) % 8;
        const yy = 110 + slice * 36;
        // Shift existing glyph slices, never a scan line or a separate box.
        context.drawImage(dataCanvas, 65, yy, 380, 9, 65 + (slice % 2 ? 8 : -8), yy, 380, 9);
      }
      dataTexture.needsUpdate = true;
      lastData = now;
    };
    const canRender = () => visible && !document.hidden && !disposed && !renderer.getContext().isContextLost();
    const request = () => {
      if (!frame && canRender()) frame = requestAnimationFrame(render);
    };
    const render = (now: number) => {
      frame = 0;
      if (!canRender()) return;
      const dt = lastTime ? Math.min((now - lastTime) / 1000, 1 / 30) : 1 / 60;
      lastTime = now;
      if (reduceMotion) {
        x = { position: destination.x, velocity: 0 };
        y = { position: destination.y, velocity: 0 };
        tiltX = tiltY = { position: 0, velocity: 0 };
      } else {
        x = stepLoupeSpring(x, destination.x, dt);
        y = stepLoupeSpring(y, destination.y, dt);
        tiltX = stepLoupeSpring(tiltX, Math.max(-.065, Math.min(.065, y.velocity * -.00014)), dt);
        tiltY = stepLoupeSpring(tiltY, Math.max(-.065, Math.min(.065, x.velocity * .00014)), dt);
      }
      loupe.position.set(x.position - width / 2, height / 2 - y.position, 36);
      loupe.rotation.set(tiltX.position, tiltY.position, 0);
      glassMaterial.uniforms.uCenter.value.set(x.position / width, 1 - y.position / height);
      const moving = Math.abs(x.position - destination.x) + Math.abs(y.position - destination.y) > .035
        || Math.abs(x.velocity) + Math.abs(y.velocity) > .07
        || Math.abs(tiltX.position) + Math.abs(tiltY.position) > .0001
        || Math.abs(tiltX.velocity) + Math.abs(tiltY.velocity) > .0002;
      if (lastData < 0 || now - lastData > 50 && (moving || phase === 'decoding' || now < reverseUntil)) paintData(now);
      renderer.autoClear = true;
      renderer.render(photoScene, camera);
      renderer.autoClear = false;
      renderer.clearDepth();
      renderer.shadowMap.needsUpdate = moving || shadowDirty;
      shadowDirty = false;
      renderer.render(scene, camera);
      renderer.autoClear = true;
      if (now - lastReport > 60 || !moving) {
        const progress = phase === 'json' ? 100 : cycleStart ? Math.min(99, Math.floor((now - cycleStart) / 15)) : 0;
        options.onFrame?.({ x: x.position, y: y.position }, progress);
        lastReport = now;
      }
      if (moving || phase === 'decoding' || now < reverseUntil || cycleStart > 0 && phase !== 'json' && now - cycleStart < 1500) request();
    };
    const visibility = () => {
      if (document.hidden) { cancelAnimationFrame(frame); frame = 0; }
      else { lastTime = 0; request(); }
    };
    const preference = () => { reduceMotion = media.matches; request(); };
    renderer.compile(photoScene, camera);
    renderer.compile(scene, camera);
    document.addEventListener('visibilitychange', visibility);
    media.addEventListener('change', preference);
    void document.fonts.ready.then(() => { if (!disposed) { lastData = -1000; request(); } });
    return {
      draw(point) {
        destination = point;
        if (Math.hypot(point.x - anchor.x, point.y - anchor.y) >= 3) {
          if (phase === 'json' || phase === 'decoding') { glitchStart = performance.now(); reverseUntil = glitchStart + 500; }
          anchor = { ...point }; phase = 'binary'; cycleStart = performance.now(); lastData = -1000;
        }
        request();
      },
      resize(nextWidth, nextHeight, dpr = window.devicePixelRatio) {
        width = Math.max(1, nextWidth); height = Math.max(1, nextHeight);
        ratio = Math.max(1, Math.min(dpr || 1, 1.6));
        radius = Math.min(window.innerHeight * .20, width * .44);
        renderer.setPixelRatio(ratio);
        renderer.setSize(width, height, false);
        camera.left = -width / 2; camera.right = width / 2; camera.top = height / 2; camera.bottom = -height / 2;
        camera.updateProjectionMatrix();
        photoPlane.scale.set(width, height, 1);
        shadow.scale.set(width, height, 1);
        loupe.scale.setScalar(radius / 100);
        const coverScale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
        baseCover.set(width / (image.naturalWidth * coverScale), height / (image.naturalHeight * coverScale));
        photoMaterial.uniforms.uCover.value.copy(baseCover).divideScalar(photoZoom);
        glassMaterial.uniforms.uResolution.value.set(Math.round(width * ratio), Math.round(height * ratio));
        glassMaterial.uniforms.uRadius.value.set(radius / width, radius / height);
        if (!destination.x) {
          destination = { x: width * .46, y: height * .44 };
          x.position = destination.x; y.position = destination.y;
        }
        shadowDirty = true; lastData = -1000; request();
      },
      setPhase(next) {
        if (phase !== next && next === 'binary' && phase === 'json') reverseUntil = performance.now() + 500;
        phase = next; glitchStart = performance.now(); lastData = -1000;
        if (next === 'json') { cycleStart = 0; reverseUntil = 0; }
        request();
      },
      cancelReveal() {
        if (phase !== 'json') { cycleStart = 0; phase = 'binary'; lastData = -1000; }
        request();
      },
      setVisible(next) {
        visible = next;
        if (!next) { cancelAnimationFrame(frame); frame = 0; }
        else { lastTime = 0; request(); }
      },
      setPhotoZoom(next) {
        photoZoom = Math.max(1, Math.min(1.12, next));
        photoMaterial.uniforms.uCover.value.copy(baseCover).divideScalar(photoZoom);
        lastData = -1000;
        request();
      },
      dispose() {
        disposed = true;
        document.removeEventListener('visibilitychange', visibility);
        media.removeEventListener('change', preference);
        key.shadow.dispose();
        release();
      },
    };
  } catch (error) {
    release();
    throw error;
  }
}
