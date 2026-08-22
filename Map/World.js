import { FULL_W, FULL_H, NOISE_SCALE, mulberry32, makeHash, fbm, smoothstepRange, clamp01, PIXEL_WARP_SCALE, PIXEL_WARP_AMOUNT, SEA_PATCH_SCALE, POND_PATCH_SCALE, BIOME_PATCH_SCALE } from "./Utils.js";
import { CITY_PALETTES, CITY_FEATURES } from "./Palette.js";

export class World {
    constructor(seed) {
        this.seed = seed; // NEU: wurde vorher nirgends gespeichert. WorldChunk
        // ruft aber hashSeed(world.seed, cx, cy) auf - world.seed war also
        // immer undefined (-> als 0 interpretiert), wodurch die Vegetations-
        // verteilung pro Chunk NIE vom eigentlichen Karten-Seed abhing,
        // sondern fuer jeden Seed identisch war. Echter Bug, jetzt gefixt.
        this.rand = mulberry32(seed);

        this.hLand = makeHash(seed + 1);
        this.hWarpX = makeHash(seed + 2);
        this.hWarpY = makeHash(seed + 3);
        this.hTexture = makeHash(seed + 4);
        this.hForest = makeHash(seed + 5);
        this.hEdge = makeHash(seed + 6);
        this.hMountain = makeHash(seed + 7);
        this.hDesert = makeHash(seed + 8);
        this.hRock = makeHash(seed + 9);
        this.hCity = makeHash(seed + 10);
        this.hRoad = makeHash(seed + 11);

        // Gebirge/Wueste/Seen/Inseln bleiben im festen Noise-Referenzraum
        // (0..1 relativ zu NOISE_SCALE) verankert - absolute Groesse bleibt
        // dadurch unabhaengig von FULL_W/FULL_H konstant.
        const mtAngle = this.rand() * Math.PI * 2;
        const mtDist = 0.10 + this.rand() * 0.60;

        this.hRoad = makeHash(seed + 11);
        this.hWater = makeHash(seed + 12);
        this.hPond = makeHash(seed + 13);


        const cityCount = 30 + Math.floor(this.rand() * 30);
        this.cities = [];
        let attempts = 0;
        while (this.cities.length < cityCount && attempts < 5000) {
            attempts++;
            const cx = FULL_W * 0.14 + this.rand() * FULL_W * 0.72;
            const cy = FULL_H * 0.14 + this.rand() * FULL_H * 0.72;
            const radius = 90 + this.rand() * 110;
            let farEnough = true;
            for (const c of this.cities) {
                if (Math.hypot(cx - c.cx, cy - c.cy) < (radius + c.radius + FULL_W * 0.045)) { farEnough = false; break; }
            }
            if (!farEnough) continue;
            if (!this.citySiteOk(cx, cy, radius)) continue;
            this.cities.push({
                cx, cy, radius,
                angle: this.rand() * Math.PI,
                blockSpacing: 52 + this.rand() * 32,
                rand: mulberry32((Math.floor(this.rand() * 1e9) ^ 0x9e3779b9) >>> 0),
                palette: CITY_PALETTES[Math.floor(this.rand() * CITY_PALETTES.length)],
                feature: CITY_FEATURES[Math.floor(this.rand() * CITY_FEATURES.length)],
            });
        }
    }

    // Rechnet absolute Weltpixel in einen Bruchteil des festen Noise-
    // Referenzfelds um, zentriert auf die Kartenmitte. Die EINZIGE Stelle,
    // an der FULL_W/FULL_H ueberhaupt in die Rauschen-Berechnung einfliessen
    // - nur um den sichtbaren Kartenausschnitt im Referenzfeld zu zentrieren,
    // NICHT um das Feld auf die Kartengroesse zu strecken. Bei FULL_W ===
    // NOISE_SCALE ist das identisch zum alten px/FULL_W.
    toNoiseX(px) { return 0.5 + (px - FULL_W / 2) / NOISE_SCALE; }
    toNoiseY(py) { return 0.5 + (py - FULL_H / 2) / NOISE_SCALE; }

    terrainOkForCity(info) {
        if (info.type === 'water') return false;
        if (info.type === 'mountain' && info.depthT > 0.4) return false;
        return true;
    }

    // cx,cy,radius sind jetzt absolute Weltpixel
    citySiteOk(cx, cy, radius) {
        const center = this.classify(cx, cy);
        if (!this.terrainOkForCity(center)) return false;
        let good = 0, total = 0;
        for (let a = 0; a < Math.PI * 2 - 0.001; a += Math.PI / 6) {
            for (const rr of [radius * 0.55, radius * 0.95]) {
                const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
                total++;
                if (px < FULL_W * 0.03 || px > FULL_W * 0.97 || py < FULL_H * 0.03 || py > FULL_H * 0.97) continue;
                const info = this.classify(px, py);
                if (this.terrainOkForCity(info)) good++;
            }
        }
        return total > 0 && (good / total) > 0.78;
    }

    // x,y jetzt absolute Weltpixel. city.cx/cy sind ebenfalls bereits
    // absolute Pixel (siehe Konstruktor).
    cityInfluence(x, y) {
        for (const city of this.cities) {
            const dx = x - city.cx, dy = y - city.cy;
            const dist = Math.hypot(dx, dy);
            if (dist > city.radius * 1.35) continue;
            const nx = this.toNoiseX(x), ny = this.toNoiseY(y);
            const edgeNoise = fbm(this.hCity, nx * 7 + this.toNoiseX(city.cx) * 3, ny * 7 + this.toNoiseY(city.cy) * 3, 3, 0.05, 0.5, 2.1);
            const effR = city.radius * (0.85 + 0.35 * edgeNoise);
            if (dist < effR) return { city, t: clamp01(dist / effR) };
        }
        return null;
    }

    elevation(x, y) {
        const nx0 = this.toNoiseX(x), ny0 = this.toNoiseY(y);
        const detailWarpAmt = 0.09;
        const dwx = nx0 + (fbm(this.hWarpX, nx0, ny0, 3, 0.35, 0.5, 2.1) - 0.5) * detailWarpAmt;
        const dwy = ny0 + (fbm(this.hWarpY, nx0, ny0, 3, 0.35, 0.5, 2.1) - 0.5) * detailWarpAmt;
        const landBase = fbm(this.hLand, dwx, dwy, 4, 0.28, 0.5, 2.0);

        // Organische Verzerrung in absoluten Weltpixeln - unabhaengig von
        // NOISE_SCALE/FULL_W, dadurch identisch kalibriert egal wo auf der
        // (auch sehr grossen) Karte
        const wpx = x + (fbm(this.hWarpX, x, y, 3, PIXEL_WARP_SCALE, 0.5, 2.1) - 0.5) * 2 * PIXEL_WARP_AMOUNT;
        const wpy = y + (fbm(this.hWarpY, x, y, 3, PIXEL_WARP_SCALE, 0.5, 2.1) - 0.5) * 2 * PIXEL_WARP_AMOUNT;

        // Grossflaechiges Wasser-Feld statt fixer Lake-Liste/hasSea-Mechanik:
        // ueberall auf der Karte koennen Seen/Meeresarme entstehen, nicht nur
        // in Spawn-Naehe. Zwei Frequenzen (Meer + Teiche) fuer Groessenvielfalt.
        const seaField = fbm(this.hWater, wpx, wpy, 4, SEA_PATCH_SCALE, 0.5, 2.0);
        const pondField = fbm(this.hPond, wpx, wpy, 3, POND_PATCH_SCALE, 0.5, 2.0);
        const seaMask = smoothstepRange(0.60, 0.74, seaField);
        const pondMask = smoothstepRange(0.72, 0.85, pondField) * 0.85;
        let water = Math.max(seaMask, pondMask);

        const coastNoise = fbm(this.hEdge, x, y, 3, 70, 0.55, 2.2);
        water *= (0.55 + 0.75 * coastNoise);

        const mountainField = fbm(this.hMountain, wpx, wpy, 4, BIOME_PATCH_SCALE, 0.5, 2.0);
        const mountainMask = smoothstepRange(0.48, 0.66, mountainField);
        const mtEdge = fbm(this.hMountain, x, y, 3, 90, 0.55, 2.2);
        const mountainRaw = clamp01(mountainMask * (0.5 + 0.85 * mtEdge));
        const mountainBump = Math.pow(mountainRaw, 1.4) * 0.75;

        return 0.52 + landBase * 0.32 - water * 1.3 + mountainBump;
    }

    biomeMasks(x, y) {
        const wpx = x + (fbm(this.hWarpX, x, y, 3, PIXEL_WARP_SCALE, 0.5, 2.1) - 0.5) * 2 * PIXEL_WARP_AMOUNT;
        const wpy = y + (fbm(this.hWarpY, x, y, 3, PIXEL_WARP_SCALE, 0.5, 2.1) - 0.5) * 2 * PIXEL_WARP_AMOUNT;

        const mountainField = fbm(this.hMountain, wpx, wpy, 4, BIOME_PATCH_SCALE, 0.5, 2.0);
        let mountain = smoothstepRange(0.48, 0.66, mountainField);
        const mtEdge = fbm(this.hMountain, x, y, 3, 90, 0.55, 2.2);
        mountain = clamp01(mountain * (0.5 + 0.85 * mtEdge));

        const desertField = fbm(this.hDesert, wpx, wpy, 4, BIOME_PATCH_SCALE, 0.5, 2.0);
        let desert = smoothstepRange(0.48, 0.66, desertField);
        const dsEdge = fbm(this.hDesert, x, y, 3, 95, 0.55, 2.2);
        desert = clamp01(desert * (0.5 + 0.85 * dsEdge));

        return { mountain, desert };
    }

    classify(x, y) {
        const e = this.elevation(x, y);
        const seaLevel = 0.42;
        const nx0 = this.toNoiseX(x), ny0 = this.toNoiseY(y);
        const beachNoise = fbm(this.hEdge, nx0 * 2.5, ny0 * 2.5, 3, 0.12, 0.5, 2.1);
        const sandLevel = seaLevel + 0.13 + beachNoise * 0.07;

        if (e < seaLevel) {
            const depthT = clamp01((seaLevel - e) / 0.30);
            return { type: 'water', elevation: e, depthT };
        }

        const { mountain, desert } = this.biomeMasks(x, y);
        const mountainStrength = mountain;
        const desertStrength = clamp01(desert * (1 - mountainStrength * 0.7));

        if (mountainStrength > 0.5) {
            const depthT = smoothstepRange(0.5, 0.88, mountainStrength);
            const snow = smoothstepRange(0.68, 0.92, mountainStrength);
            return { type: 'mountain', elevation: e, mountainStrength, depthT, snow: clamp01(snow) };
        }

        if (e < sandLevel) {
            return { type: 'sand', elevation: e, depthT: 0 };
        }

        if (desertStrength > 0.45) {
            const depthT = smoothstepRange(0.45, 0.80, desertStrength);
            return { type: 'desert', elevation: e, desertStrength, depthT };
        }

        return { type: 'grass', elevation: e, mountainStrength, desertStrength };
    }

    forestDensity(x, y) {
        const nx0 = this.toNoiseX(x), ny0 = this.toNoiseY(y);
        const leftMask = smoothstepRange(0.38, 0.02, nx0);
        const rightLowerMask = smoothstepRange(0.62, 0.97, nx0) * smoothstepRange(0.28, 0.55, ny0);
        const rightUpperSparse = smoothstepRange(0.70, 0.99, nx0) * smoothstepRange(0.60, 0.95, ny0) * 0.5;
        const base = Math.max(leftMask, rightLowerMask, rightUpperSparse);
        const noiseVar = fbm(this.hForest, nx0, ny0, 3, 0.12, 0.5, 2.0);
        let density = clamp01(base * 0.75 + noiseVar * 0.4);

        const { mountain, desert } = this.biomeMasks(x, y);
        density = clamp01(density + clamp01(mountain - 0.1) * (1 - mountain) * 0.4);
        density = clamp01(density * (1 - desert * 0.92));

        return density;
    }

}