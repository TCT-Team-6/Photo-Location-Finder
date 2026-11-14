import type { LoupePoint } from './loupe-dwell';

const VERTEX = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

// Analytic spherical refraction, not path tracing. Source and glass use one
// cover-mapped texture in screen coordinates so the lens examines what is below.
const FRAGMENT = `
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_photo;
uniform vec2 u_resolution;
uniform vec2 u_cover;
uniform vec2 u_center;
uniform float u_radius;

vec3 photo(vec2 pixel) {
  vec2 uv = (pixel / u_resolution - 0.5) * u_cover + 0.5;
  return texture2D(u_photo, clamp(uv, 0.001, 0.999)).rgb;
}
float capsule(vec2 p, vec2 a, vec2 b, float radius) {
  vec2 ab = b - a;
  return length(p - a - ab * clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0)) - radius;
}
vec2 refractedPixel(vec2 pixel, vec3 normal, float ior) {
  vec3 ray = refract(vec3(0.0, 0.0, -1.0), normal, 1.0 / ior);
  return pixel + ray.xy * (u_radius * 1.65) / max(0.25, -ray.z);
}
void main() {
  vec2 p = v_uv * u_resolution;
  vec2 delta = p - u_center;
  float distanceToCenter = length(delta);
  vec2 direction = vec2(0.64, -0.768);
  vec2 a = u_center + direction * (u_radius + 4.0);
  vec2 b = u_center + direction * (u_radius + 112.0);
  vec3 color = photo(p);
  // Soft contact shadows on the photograph, behind the handle and rim.
  float rimShadow = 1.0 - smoothstep(u_radius + 11.0, u_radius + 36.0, length(delta - vec2(7.0, -12.0)));
  float handleShadow = 1.0 - smoothstep(-2.0, 16.0, capsule(p - vec2(7.0, -10.0), a, b, 14.0));
  color *= 1.0 - max(rimShadow * 0.32, handleShadow * 0.28);
  // A shaded capsule handle, silver collar and vermilion grip band.
  float handle = capsule(p, a, b, 13.5);
  if (handle < 1.0) {
    float longitudinal = dot(p - a, direction);
    float transverse = dot(p - a, vec2(-direction.y, direction.x)) / 14.0;
    float cylinder = sqrt(max(0.0, 1.0 - transverse * transverse));
    vec3 grip = mix(vec3(0.035, 0.045, 0.052), vec3(0.28, 0.30, 0.31), pow(cylinder, 5.0));
    float grooves = 0.94 + 0.06 * cos(longitudinal * 2.2);
    grip *= grooves;
    if (longitudinal < 23.0) grip = vec3(0.30, 0.33, 0.34) + pow(cylinder, 8.0) * 0.58;
    if (longitudinal > 33.0 && longitudinal < 42.0) grip = vec3(0.55, 0.10, 0.065) + cylinder * 0.20;
    color = mix(color, grip, 1.0 - smoothstep(-0.8, 0.8, handle));
  }
  // Machined metal annulus with directional reflections and engraved rings.
  float outer = u_radius + 14.0;
  if (distanceToCenter < outer + 1.0) {
    vec2 directionToPixel = delta / max(distanceToCenter, 0.001);
    float light = dot(directionToPixel, normalize(vec2(-0.7, 0.9)));
    float radial = (distanceToCenter - u_radius) / 14.0;
    vec3 metal = mix(vec3(0.055, 0.065, 0.075), vec3(0.63, 0.66, 0.66), pow(abs(light), 6.0));
    metal += 0.12 * sin(radial * 26.0);
    metal += pow(max(0.0, light), 40.0) * 0.65;
    float outerBevel = smoothstep(0.85, 1.0, radial);
    metal = mix(metal, vec3(0.65, 0.67, 0.66), outerBevel * 0.8);
    if (radial > 0.22 && radial < 0.36) metal = vec3(0.52, 0.12, 0.085) * (0.7 + 0.3 * light);
    color = mix(color, metal, 1.0 - smoothstep(outer - 0.7, outer + 0.7, distanceToCenter));
  }
  if (distanceToCenter < u_radius + 0.8) {
    vec2 q = delta / u_radius;
    // A spherical cap gives a nonuniform optical distortion across the lens.
    vec3 normal = normalize(vec3(q * 0.65, sqrt(max(0.001, 1.0 - dot(q * 0.65, q * 0.65)))));
    vec2 redUV = refractedPixel(p, normal, 1.513);
    vec2 greenUV = refractedPixel(p, normal, 1.517);
    vec2 blueUV = refractedPixel(p, normal, 1.521);
    vec3 glass = vec3(photo(redUV).r, photo(greenUV).g, photo(blueUV).b);
    float fresnel = 0.04 + 0.96 * pow(1.0 - normal.z, 5.0);
    vec3 lightDirection = normalize(vec3(-0.45, 0.65, 0.9));
    float specular = pow(max(dot(reflect(-lightDirection, normal), vec3(0.0, 0.0, 1.0)), 0.0), 85.0);
    glass = mix(glass, vec3(0.77, 0.84, 0.87), fresnel * 0.65);
    glass += vec3(0.95, 0.96, 0.90) * specular * 0.65;
    float edge = smoothstep(0.90, 1.0, length(q));
    glass *= 1.0 - edge * 0.30;
    color = mix(color, glass, 1.0 - smoothstep(u_radius - 0.7, u_radius + 0.7, distanceToCenter));
  }
  gl_FragColor = vec4(color, 1.0);
}`;

export type OpticalRenderer = {
  draw: (point: LoupePoint) => void;
  resize: (width: number, height: number, dpr?: number) => void;
  dispose: () => void;
};

export function createOpticalRenderer(canvas: HTMLCanvasElement, image: HTMLImageElement): OpticalRenderer {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: 'low-power' });
  if (!gl) throw new Error('WebGL is not available.');
  const shaders: WebGLShader[] = [];
  let program: WebGLProgram | null = null;
  let buffer: WebGLBuffer | null = null;
  let texture: WebGLTexture | null = null;
  let frame = 0;
  let disposed = false;
  let width = 1;
  let height = 1;
  let point = { x: .5, y: .5 };
  const release = () => {
    if (frame) cancelAnimationFrame(frame);
    if (texture) gl.deleteTexture(texture);
    if (buffer) gl.deleteBuffer(buffer);
    if (program) gl.deleteProgram(program);
    shaders.forEach((shader) => gl.deleteShader(shader));
  };
  try {
    const compile = (kind: number, source: string) => {
      const shader = gl.createShader(kind);
      if (!shader) throw new Error('Could not allocate shader.');
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || 'Shader compilation failed.');
      return shader;
    };
    program = gl.createProgram();
    if (!program) throw new Error('Could not allocate program.');
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Optics program could not link.');
    buffer = gl.createBuffer();
    texture = gl.createTexture();
    if (!buffer || !texture) throw new Error('Could not allocate optical resources.');
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    // The sample files are same-origin. This throws on a tainted remote image.
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
    if (gl.getError() !== gl.NO_ERROR) throw new Error('Photo texture could not be uploaded.');
    const resolution = gl.getUniformLocation(program, 'u_resolution');
    const cover = gl.getUniformLocation(program, 'u_cover');
    const center = gl.getUniformLocation(program, 'u_center');
    const radius = gl.getUniformLocation(program, 'u_radius');
    gl.uniform1i(gl.getUniformLocation(program, 'u_photo'), 0);
    const requestDraw = () => {
      if (disposed || frame || gl.isContextLost()) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (disposed || gl.isContextLost()) return;
        gl.uniform2f(center, point.x, height - point.y);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      });
    };
    return {
      draw(next) { point = next; requestDraw(); },
      resize(nextWidth, nextHeight, dpr = window.devicePixelRatio) {
        width = Math.max(1, nextWidth);
        height = Math.max(1, nextHeight);
        const ratio = Math.max(1, Math.min(dpr || 1, 1.75));
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.uniform2f(resolution, width, height);
        const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
        gl.uniform2f(cover, width / (image.naturalWidth * scale), height / (image.naturalHeight * scale));
        gl.uniform1f(radius, Math.min(97, width * .18));
        requestDraw();
      },
      dispose() { disposed = true; release(); },
    };
  } catch (error) {
    release();
    throw error;
  }
}
