import { FULL_W, FULL_H, CHUNK_SIZE } from "./Utils.js";
import { WorldChunk } from "./WorldChunk.js";


export class ChunkManager {
    constructor(terrainContainer, vegetationContainer, macro, loadRadius = 3, chunksPerFrame = 1, frameBudgetMs = 8) {
        this.terrainContainer = terrainContainer;
        this.vegetationContainer = vegetationContainer;
        this.macro = macro;
        this.loadRadius = loadRadius;
        this.frameBudgetMs = frameBudgetMs;
        this.chunksPerFrame = chunksPerFrame;
        this.activeChunks = new Map();
        this.pendingKeys = []; // Warteschlange, naechste zuerst
        this._lastCenterCx = null;
        this._lastCenterCy = null;
    }

    _loadOneChunk(key) {
        const [cx, cy] = key.split(',').map(Number);
        const chunk = new WorldChunk(cx, cy, this.macro);
        this.terrainContainer.addChild(chunk.sprite);
        this.vegetationContainer.addChild(chunk.vegSprite);
        this.activeChunks.set(key, chunk);
    }

    loadAllPendingAsync(onProgress = null) {
        const total = this.pendingKeys.length;
        return new Promise((resolve) => {
            const step = () => {
                const frameStart = performance.now();

                while (this.pendingKeys.length > 0 && (performance.now() - frameStart) < this.frameBudgetMs) {
                    const key = this.pendingKeys.shift();
                    if (!this.activeChunks.has(key)) {
                        this._loadOneChunk(key);
                    }
                }

                onProgress?.(total - this.pendingKeys.length, total);

                if (this.pendingKeys.length > 0) {
                    requestAnimationFrame(step);
                } else {
                    resolve();
                }
            };
            requestAnimationFrame(step);
        });
    }

    loadAllPending() {
        while (this.pendingKeys.length > 0) {
            const key = this.pendingKeys.shift();
            if (this.activeChunks.has(key)) continue;
            this._loadOneChunk(key);
        }
    }

    update(cameraX, cameraY, viewportW = 0, viewportH = 0) {
        const centerCx = Math.floor(cameraX / CHUNK_SIZE);
        const centerCy = Math.floor(cameraY / CHUNK_SIZE);

        // Wie viele Chunks braucht's mindestens, um den sichtbaren Bereich
        // (plus den festen loadRadius als Puffer) komplett abzudecken?
        const halfW = viewportW / 2;
        const halfH = viewportH / 2;
        const radiusX = Math.ceil(halfW / CHUNK_SIZE) + this.loadRadius;
        const radiusY = Math.ceil(halfH / CHUNK_SIZE) + this.loadRadius;

        if (centerCx === this._lastCenterCx && centerCy === this._lastCenterCy
            && radiusX === this._lastRadiusX && radiusY === this._lastRadiusY) return;
        this._lastCenterCx = centerCx;
        this._lastCenterCy = centerCy;
        this._lastRadiusX = radiusX;
        this._lastRadiusY = radiusY;

        const needed = new Map();
        for (let dy = -radiusY; dy <= radiusY; dy++) {
            for (let dx = -radiusX; dx <= radiusX; dx++) {
                const cx = centerCx + dx, cy = centerCy + dy;
                if (cx < 0 || cy < 0 || cx * CHUNK_SIZE >= FULL_W || cy * CHUNK_SIZE >= FULL_H) continue;
                needed.set(`${cx},${cy}`, dx * dx + dy * dy);
            }
        }

        for (const [key, chunk] of this.activeChunks) {
            if (!needed.has(key)) {
                chunk.destroy();
                this.activeChunks.delete(key);
            }
        }

        this.pendingKeys = this.pendingKeys.filter(k => needed.has(k) && !this.activeChunks.has(k));
        const alreadyPending = new Set(this.pendingKeys);
        for (const key of needed.keys()) {
            if (!this.activeChunks.has(key) && !alreadyPending.has(key)) {
                this.pendingKeys.push(key);
            }
        }
        this.pendingKeys.sort((a, b) => needed.get(a) - needed.get(b));
    }

    // Wird JEDEN Frame aufgerufen (aus MapScene.update) - baut hoechstens
    // chunksPerFrame Chunks, verteilt die teure Arbeit also ueber mehrere
    // Frames statt alles auf einmal beim Grenzuebertritt
    tick() {
        let budget = this.chunksPerFrame;
        while (budget > 0 && this.pendingKeys.length > 0) {
            const key = this.pendingKeys.shift();
            if (this.activeChunks.has(key)) continue;
            const [cx, cy] = key.split(',').map(Number);
            const chunk = new WorldChunk(cx, cy, this.macro);
            this.terrainContainer.addChild(chunk.sprite);
            this.vegetationContainer.addChild(chunk.vegSprite);
            this.activeChunks.set(key, chunk);
            budget--;
        }
    }

    destroy() {
        for (const chunk of this.activeChunks.values()) chunk.destroy();
        this.activeChunks.clear();
        this.pendingKeys = [];
    }
}