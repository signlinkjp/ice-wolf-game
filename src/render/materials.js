/**
 * Texture and material helpers.
 *
 * The six stages reuse the hand-drawn pictures the GDevelop build shipped
 * (assets/floor_*.png, wall_*.png, cap_*.png, ice_freeze.png, pad_*.png). Those
 * pictures are deliberately deep-toned, so each one is lifted with a white
 * screen pass at load time: the pattern and the grain stay, the arena reads
 * bright and the characters keep their silhouette against it.
 */
import * as THREE from '../../vendor/three.module.js';

const loader = new THREE.TextureLoader();
const cache = new Map();

/**
 * @param {string} path
 * @param {number} repeatX
 * @param {number} repeatY
 * @param {number} lift 0..1 white lift (0 = the original picture)
 */
export function texture(path, repeatX = 1, repeatY = 1, lift = 0) {
  const key = `${path}|${repeatX}|${repeatY}|${lift}`;
  if (cache.has(key)) return cache.get(key);
  if (!lift) {
    const tex = loader.load(path);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.anisotropy = 4;
    cache.set(key, tex);
    return tex;
  }
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 4;
  const image = new Image();
  image.onload = () => {
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(image, 0, 0, size, size);
    if (lift > 0) {
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = Math.min(1, lift);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    tex.needsUpdate = true;
  };
  image.src = path;
  cache.set(key, tex);
  return tex;
}

/**
 * A bright, pop surface: the palette colour as the base, the hand-drawn picture
 * from the old build laid over it as fine detail. This keeps the ice-brick grain
 * and the skate marks while letting each stage be as bright as it wants.
 */
export function surface(path, baseColor, detail = 0.3, repeatX = 1, repeatY = 1) {
  const key = `s|${path}|${baseColor}|${detail}|${repeatX}|${repeatY}`;
  if (cache.has(key)) return cache.get(key);
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 4;
  const image = new Image();
  image.onload = () => {
    ctx.globalAlpha = Math.max(0, Math.min(1, detail));
    ctx.drawImage(image, 0, 0, size, size);
    ctx.globalAlpha = 1;
    // A light wash pulls the detail towards the stage colour instead of the
    // picture's own dark tone.
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, size, size);
    ctx.globalAlpha = 1;
    tex.needsUpdate = true;
  };
  image.src = path;
  cache.set(key, tex);
  return tex;
}

export function standard(params) {
  return new THREE.MeshStandardMaterial({ roughness: 0.82, metalness: 0.02, ...params });
}

export function glow(color, opacity = 0.7) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
}

/** A soft round blob used as a cheap shadow under every character. */
let blobTex = null;
export function blobShadowTexture() {
  if (blobTex) return blobTex;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(8,26,46,0.38)');
  g.addColorStop(0.65, 'rgba(8,26,46,0.18)');
  g.addColorStop(1, 'rgba(8,26,46,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  blobTex = new THREE.CanvasTexture(c);
  blobTex.colorSpace = THREE.SRGBColorSpace;
  return blobTex;
}

/** A name tag drawn to a canvas: crisp at any text size, no font files. */
export function labelTexture(text, color = '#ffffff', background = 'rgba(12,28,52,0.72)') {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 96;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 256, 96);
  const pad = 12;
  ctx.font = 'bold 44px system-ui, -apple-system, "Hiragino Sans", "Noto Sans JP", sans-serif';
  const w = Math.min(232, ctx.measureText(text).width + pad * 2);
  roundRect(ctx, (256 - w) / 2, 16, w, 60, 26);
  ctx.fillStyle = background;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 47, 220);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function disposeGroup(group) {
  group.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        if (m.map && m.map !== blobTex) m.map.dispose();
        m.dispose();
      }
    }
  });
}
