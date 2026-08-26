export const NOISE_SCALE = 2048;

export const PIXEL_WARP_SCALE = 500;   // Wellenlaenge der organischen Verzerrung
export const PIXEL_WARP_AMOUNT = 140;  // wie stark verzerrt wird (px)
export const BIOME_PATCH_SCALE = 1200;  // Gebirge/Wueste Fleckgroesse (px)
export const SEA_PATCH_SCALE = 900;    // grosse Gewaesser (px)
export const POND_PATCH_SCALE = 420;   // kleine Teiche/Seen (px)

export const CHUNK_SIZE = 512;
export const FULL_W = 16384;
export const FULL_H = 16384;

export const CITIES_PER_CHUNK_MIN = 0.117;
export const CITIES_PER_CHUNK_MAX = 0.234;

const TERRAIN_PIXELS_PER_CHUNK = 128;
const chunksAcrossX = FULL_W / CHUNK_SIZE;
const chunksAcrossY = FULL_H / CHUNK_SIZE;
export const TERRAIN_W = Math.round(chunksAcrossX * TERRAIN_PIXELS_PER_CHUNK);
export const TERRAIN_H = Math.round(chunksAcrossY * TERRAIN_PIXELS_PER_CHUNK);

// ---- Seeded RNG (mulberry32) - reproduzierbar ueber den Seed-Wert ----
export function mulberry32(seed) {
    return function() {
        seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function hashSeed(baseSeed, cx, cy) {
    let h = baseSeed;
    h = Math.imul(h ^ cx, 2654435761);
    h = Math.imul(h ^ cy, 2246822519);
    h ^= h >>> 15;
    return h >>> 0;
}

// ---- Hash-basiertes Value-Noise, mehrere unabhaengige Kanaele ueber Offsets ----
export function makeHash(seedOffset) {
    return function(ix, iy) {
        let n = ix * 374761393 + iy * 668265263 + seedOffset * 987651341;
        n = (n ^ (n >> 13)) * 1274126177;
        n = n ^ (n >> 16);
        return ((n >>> 0) % 100000) / 100000;
    };
}

export function smoothstep01(t) { return t * t * (3 - 2 * t); }

export function valueNoise2D(hashFn, x, y) {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = x - x0, fy = y - y0;
    const v00 = hashFn(x0, y0), v10 = hashFn(x0 + 1, y0);
    const v01 = hashFn(x0, y0 + 1), v11 = hashFn(x0 + 1, y0 + 1);
    const u = smoothstep01(fx), v = smoothstep01(fy);
    const a = v00 + (v10 - v00) * u;
    const b = v01 + (v11 - v01) * u;
    return a + (b - a) * v;
}

export function fbm(hashFn, x, y, octaves, scale, gain, lacunarity) {
    let sum = 0, amp = 1, freq = 1 / scale, maxAmp = 0;
    for (let i = 0; i < octaves; i++) {
        sum += amp * valueNoise2D(hashFn, x * freq, y * freq);
        maxAmp += amp;
        amp *= gain;
        freq *= lacunarity;
    }
    return sum / maxAmp;
}

export function clamp01(v) { return Math.max(0, Math.min(1, v)); }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function smoothstepRange(edge0, edge1, x) {
    const t = clamp01((x - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
}
export function gaussianBlob(x, y, cx, cy, rx, ry) {
    const dx = (x - cx) / rx, dy = (y - cy) / ry;
    return Math.exp(-(dx * dx + dy * dy));
}
export function lerpColor(c1, c2, t) {
    return [
        Math.round(lerp(c1[0], c2[0], t)),
        Math.round(lerp(c1[1], c2[1], t)),
        Math.round(lerp(c1[2], c2[2], t)),
    ];
}
export function clampInt(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }


export function lerpHexColor(a, b, t) {
    const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
    const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
    return (Math.round(ar + (br - ar) * t) << 16)
         | (Math.round(ag + (bg - ag) * t) << 8)
         | Math.round(ab + (bb - ab) * t);
}