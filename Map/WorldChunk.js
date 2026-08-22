import * as PIXI from "pixi.js";
import { drawRoadsVector, drawPineTree, drawBirchTree, drawBoulder, drawMountainPeak } from "./draw.js";
import { isBlocked } from "./Roads.js";
import { mulberry32, hashSeed, FULL_W, fbm, TERRAIN_W, TERRAIN_H, CHUNK_SIZE, lerpColor, clamp01 } from "./Utils.js";
import { PAL } from "./Palette.js";

const TERRAIN_TEXELS_PER_CHUNK = Math.round(CHUNK_SIZE * (TERRAIN_W / FULL_W)); // 128 bei aktuellen Werten
const TERRAIN_PAD_TEXELS = 2;
const VEG_MARGIN = 90;

export class WorldChunk {
    constructor(cx, cy, macro) {
        this.cx = cx;
        this.cy = cy;
        this.worldX = cx * CHUNK_SIZE;
        this.worldY = cy * CHUNK_SIZE;

        // --- Terrain: exakt CHUNK_SIZE, kachelt nahtlos, opak ---
        const terrainCanvas = document.createElement('canvas');
        terrainCanvas.width = CHUNK_SIZE;
        terrainCanvas.height = CHUNK_SIZE;
        const tctx = terrainCanvas.getContext('2d');
        this._drawTerrain(tctx, macro);
        this._drawRoads(tctx, macro);

        this.sprite = new PIXI.Sprite(PIXI.Texture.from(terrainCanvas));
        this.sprite.x = this.worldX;
        this.sprite.y = this.worldY;

        // --- Vegetation: groesser als der Chunk (Rand auf allen Seiten),
        // transparenter Hintergrund. Liegt in einem eigenen Container UEBER
        // allen Terrain-Sprites, deshalb ist Ueberlappung mit Nachbar-Chunks
        // unproblematisch statt sie zu verdecken.
        const vegSize = CHUNK_SIZE + VEG_MARGIN * 2;
        const vegCanvas = document.createElement('canvas');
        vegCanvas.width = vegSize;
        vegCanvas.height = vegSize;
        const vctx = vegCanvas.getContext('2d');
        this._drawVegetation(vctx, macro);

        this.vegSprite = new PIXI.Sprite(PIXI.Texture.from(vegCanvas));
        this.vegSprite.x = this.worldX - VEG_MARGIN;
        this.vegSprite.y = this.worldY - VEG_MARGIN;
    }

    _drawTerrain(ctx, macro) {
        const { world } = macro;
        const texels = TERRAIN_TEXELS_PER_CHUNK;
        const pad = TERRAIN_PAD_TEXELS;
        const texelWorldSize = CHUNK_SIZE / texels;
        const tileSize = texels + pad * 2;

        // Niedrig aufgeloestes Tile NUR fuer diesen Chunk (+ Rand), nicht fuer die ganze Welt
        const low = document.createElement('canvas');
        low.width = tileSize;
        low.height = tileSize;
        const lctx = low.getContext('2d');
        const imgData = lctx.createImageData(tileSize, tileSize);
        const data = imgData.data;

        for (let ty = 0; ty < tileSize; ty++) {
            const pyAbs = this.worldY + (ty - pad + 0.5) * texelWorldSize;
            for (let tx = 0; tx < tileSize; tx++) {
                const pxAbs = this.worldX + (tx - pad + 0.5) * texelWorldSize;
                const info = world.classify(pxAbs, pyAbs);
                const nx0 = world.toNoiseX(pxAbs), ny0 = world.toNoiseY(pyAbs);
                const tex = fbm(world.hTexture, nx0 * 3.2, ny0 * 3.2, 3, 0.15, 0.5, 2.1);

                let color;
                if (info.type === 'water') {
                    const shallow = lerpColor(PAL.waterShallow, PAL.waterMid, clamp01(info.depthT * 1.6));
                    color = lerpColor(shallow, PAL.waterDeep, clamp01((info.depthT - 0.55) * 2.2));
                    const cloud = fbm(world.hTexture, nx0 * 5 + 50, ny0 * 5 + 50, 3, 0.2, 0.5, 2.0);
                    color = lerpColor(color, PAL.waterShallow, cloud * 0.12);
                } else if (info.type === 'sand') {
                    color = lerpColor(PAL.sandDark, PAL.sandLight, tex);
                } else {
                    const forest = world.forestDensity(pxAbs, pyAbs);
                    let grassColor = lerpColor(PAL.grassDark, PAL.grassLight, tex);
                    grassColor = lerpColor(grassColor, PAL.grassShade, forest * 0.35);

                    if (info.type === 'mountain') {
                        const rockTex = fbm(world.hTexture, nx0 * 4 + 20, ny0 * 4 + 20, 3, 0.12, 0.5, 2.1);
                        let rock = lerpColor(PAL.mountainRock, PAL.mountainRockLight, rockTex);
                        const heightT = clamp01((info.elevation - 0.55) / 0.35);
                        rock = lerpColor(rock, PAL.mountainRockLight, heightT * 0.3);
                        if (info.snow > 0.05) {
                            rock = lerpColor(rock, PAL.mountainSnow, clamp01(info.snow));
                        }
                        color = lerpColor(rock, grassColor, (1 - info.depthT) * 0.22);
                    } else if (info.type === 'desert') {
                        const duneTex = fbm(world.hTexture, nx0 * 6 + 80, ny0 * 6 + 80, 3, 0.09, 0.55, 2.2);
                        let sandy = lerpColor(PAL.desertDark, PAL.desertLight, duneTex);
                        const rockPatch = fbm(world.hRock, nx0 * 3, ny0 * 3, 2, 0.15, 0.5, 2.0);
                        if (rockPatch > 0.72) {
                            sandy = lerpColor(sandy, PAL.desertRock, clamp01((rockPatch - 0.72) * 3));
                        }
                        color = lerpColor(sandy, grassColor, (1 - info.depthT) * 0.22);
                    } else {
                        color = grassColor;
                        if (info.desertStrength) {
                            color = lerpColor(color, PAL.desertLight, clamp01(info.desertStrength) * 0.18);
                        }
                        if (info.mountainStrength) {
                            color = lerpColor(color, PAL.mountainRockLight, clamp01(info.mountainStrength) * 0.14);
                        }
                    }
                }

                const idx = (ty * tileSize + tx) * 4;
                data[idx] = color[0];
                data[idx + 1] = color[1];
                data[idx + 2] = color[2];
                data[idx + 3] = 255;
            }
        }
        lctx.putImageData(imgData, 0, 0);

        // Wie vorher: Quelle inkl. Rand hochskalieren, dann auf CHUNK_SIZE clippen -
        // vermeidet harte Kanten am Chunk-Rand, jetzt aber ohne globales Canvas
        const scale = CHUNK_SIZE / texels;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, CHUNK_SIZE, CHUNK_SIZE);
        ctx.clip();
        ctx.drawImage(low, 0, 0, tileSize, tileSize, -pad * scale, -pad * scale, tileSize * scale, tileSize * scale);
        ctx.restore();
    }

    _drawRoads(ctx, macro) {
        ctx.save();
        ctx.translate(-this.worldX, -this.worldY);
        drawRoadsVector(ctx, macro.roads, 15);
        ctx.restore();
    }

    _drawVegetation(ctx, macro) {
        const { world, roadMask } = macro;
        const rand = mulberry32(hashSeed(world.seed, this.cx, this.cy));

        ctx.save();
        ctx.translate(VEG_MARGIN - this.worldX, VEG_MARGIN - this.worldY);

        const treeStride = 15;
        const treeStartX = Math.ceil(this.worldX / treeStride) * treeStride;
        const treeStartY = Math.ceil(this.worldY / treeStride) * treeStride;
        for (let gy = treeStartY; gy < this.worldY + CHUNK_SIZE; gy += treeStride) {
            for (let gx = treeStartX; gx < this.worldX + CHUNK_SIZE; gx += treeStride) {
                const jx = gx + (rand() - 0.5) * treeStride;
                const jy = gy + (rand() - 0.5) * treeStride;
                // NEU: jx,jy direkt uebergeben (absolute Weltpixel), keine
                // Division durch FULL_W/FULL_H mehr noetig
                if (isBlocked(world, roadMask, jx, jy)) continue;
                const info = world.classify(jx, jy);
                if (info.type !== 'grass') continue;
                const density = world.forestDensity(jx, jy);
                if (rand() < density * 0.55 + 0.01) {
                    const sizeBase = 26 + rand() * 20;
                    if (rand() < 0.14) drawBirchTree(ctx, jx, jy, sizeBase * 0.85);
                    else drawPineTree(ctx, jx, jy, sizeBase * (1.0 + density * 0.3), rand());
                }
            }
        }

        const boulderStride = 40;
        const boulderStartX = Math.ceil(this.worldX / boulderStride) * boulderStride;
        const boulderStartY = Math.ceil(this.worldY / boulderStride) * boulderStride;
        for (let gy = boulderStartY; gy < this.worldY + CHUNK_SIZE; gy += boulderStride) {
            for (let gx = boulderStartX; gx < this.worldX + CHUNK_SIZE; gx += boulderStride) {
                const jx = gx + (rand() - 0.5) * boulderStride;
                const jy = gy + (rand() - 0.5) * boulderStride;
                if (isBlocked(world, roadMask, jx, jy)) continue;
                const info = world.classify(jx, jy);
                if (info.type === 'mountain' && info.mountainStrength < 0.75 && rand() < 0.35) {
                    drawBoulder(ctx, jx, jy, 10 + rand() * 12);
                } else if (info.type === 'desert' && rand() < 0.08) {
                    drawBoulder(ctx, jx, jy, 8 + rand() * 8);
                } else if (info.type === 'grass' && info.mountainStrength > 0.2 && rand() < 0.06) {
                    drawBoulder(ctx, jx, jy, 6 + rand() * 6);
                }
            }
        }

    const peakStride = 60;
    const peakStartX = Math.ceil(this.worldX / peakStride) * peakStride;
    const peakStartY = Math.ceil(this.worldY / peakStride) * peakStride;
    for (let gy = peakStartY; gy < this.worldY + CHUNK_SIZE; gy += peakStride) {
        for (let gx = peakStartX; gx < this.worldX + CHUNK_SIZE; gx += peakStride) {
            const jx = gx + (rand() - 0.5) * peakStride * 0.6;
            const jy = gy + (rand() - 0.5) * peakStride * 0.6;
            if (isBlocked(world, roadMask, jx, jy)) continue;
            const info = world.classify(jx, jy);
            if (info.type !== 'mountain' || info.mountainStrength < 0.55) continue;
            if (rand() < info.mountainStrength * 0.6 + 0.25) {
                const size = 22 + info.mountainStrength * 26 + rand() * 20;
                drawMountainPeak(ctx, jx, jy, size, info.snow, rand);
            }
        }
    }

        ctx.restore();
    }

    destroy() {
        this.sprite.parent?.removeChild(this.sprite);
        this.sprite.texture.destroy(true);
        this.sprite.destroy();

        this.vegSprite.parent?.removeChild(this.vegSprite);
        this.vegSprite.texture.destroy(true);
        this.vegSprite.destroy();
    }
}