import * as PIXI from "pixi.js";
import { GridMesh2D } from "../World3D/GridMesh2D.js";
import { mulberry32, lerpHexColor } from "../Map/Utils.js";

// ---------------------------------------------------------------------
// Prozedurale Gras-Textur: hellgruene Basis mit unregelmaessigen Flecken
// (dunkler/heller) und feinen Grasbueschel-Strichen fuer Nahdistanz-Detail.
// Seeded, damit die Textur bei jedem Laden identisch aussieht statt bei
// jedem Constructor-Call neu zu "flackern". Ersetzt komplett das vorherige
// externe assets/ground.png (kein PIXI.Assets.load mehr noetig, spart
// zudem einen Netzwerk-Request).
// ---------------------------------------------------------------------
function createGroundTexture() {
    const size = 512;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#4a7a3a";
    ctx.fillRect(0, 0, size, size);

    const rand = mulberry32(42); // fester Seed - immer dieselbe Textur

    const patchColors = ["#3f6b30", "#5c8c48", "#456e35", "#6a9954"];
    for (let i = 0; i < 90; i++) {
        const x = rand() * size, y = rand() * size;
        const r = 12 + rand() * 30;
        ctx.fillStyle = patchColors[Math.floor(rand() * patchColors.length)];
        ctx.globalAlpha = 0.25 + rand() * 0.25;
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * (0.5 + rand() * 0.5), rand() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.globalAlpha = 0.18;
    for (let i = 0; i < 18; i++) {
        const x = rand() * size, y = rand() * size;
        const r = 8 + rand() * 16;
        ctx.fillStyle = "#642808";
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * (0.4 + rand() * 0.3), rand() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.strokeStyle = "rgba(40, 65, 28, 0.4)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 400; i++) {
        const x = rand() * size, y = rand() * size;
        const len = 3 + rand() * 5;
        const angle = -Math.PI / 2 + (rand() - 0.5) * 0.8;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
        ctx.stroke();
    }

    return PIXI.Texture.from(canvas);
}

// Manages the ground as an infinite, forward-streamed strip of Z-chunks.
// Chunk resolution (LOD) is re-evaluated every frame and chunks are rebuilt
// in place when their LOD level changes.
export class GroundManager {

    ///@param app - PIXIJS Application
    ///@param cam - Camera Object of the 3d World
    ///@param layer - PIXI.Container the ground meshes get added to
    ///@param debugLayer - PIXI.Container for debug outlines
    ///@param pos3d - world-space origin of the ground strip (x = strip center, z = chunk index origin)
    ///@param size - { x: Breite in Weltuinheiten, y: gesamte Laenge } - x wird jetzt tatsaechlich verwendet (vorher hartcodiert 5000)
    constructor(app, cam, layer, debugLayer, pos3d, size, roadWidth) {
        this.app = app;
        this.cam = cam;
        this.layer = layer;
        this.debugLayer = debugLayer;

        this.pos3d = pos3d;

        this.stripWidth = size?.x ?? 1400;
        this.roadHalfWidth = (roadWidth ?? 0) * 0.5;

        this.chunkLength = 160;

        this._groundTexture = createGroundTexture();
        this._groundTexture.source.addressMode = "repeat";

        this.texRepeatX = 90;
        this.texRepeatZ = 90;

        this.frontChunks = Math.min(Math.ceil(cam.far / this.chunkLength), 24);
        this.backChunks = 1;

        this.chunks = new Map();

        this._currentTint = 0xffffff;
    }

    update(nightFactor = 0) {
        const localZ = this.cam.pos3d.z - this.pos3d.z;
        const currentChunk = Math.floor(-localZ / this.chunkLength);

        const needed = new Set();

        for (let i = currentChunk - this.backChunks; i <= currentChunk + this.frontChunks; i++) {
            const desiredLod = this.getLod(i - currentChunk);

            for (const side of [-1, 1]) {
                const key = `${side}:${i}`;
                needed.add(key);

                const chunk = this.chunks.get(key);
                if (!chunk) {
                    this.chunks.set(key, this.buildChunk(i, side, desiredLod));
                } else if (chunk.lod !== desiredLod.level) {
                    chunk.gridMesh2d.destroy(this.layer);
                    this.chunks.set(key, this.buildChunk(i, side, desiredLod));
                }
            }
        }

        for (const [id, chunk] of this.chunks) {
            if (!needed.has(id)) {
                chunk.gridMesh2d.destroy(this.layer);
                this.chunks.delete(id);
            }
        }

        const nightTint = 0x0a0e1c;
        const tint = lerpHexColor(0xffffff, nightTint, nightFactor);
        if (tint !== this._currentTint) {
            this._currentTint = tint;
            for (const chunk of this.chunks.values()) {
                chunk.gridMesh2d.mesh.tint = tint;
            }
        }

        for (const chunk of this.chunks.values()) {
            chunk.gridMesh2d.update(this.app, this.cam);
        }
    }

    getLod(chunkOffset) {
        const dist = Math.abs(chunkOffset);
        if (dist <= 2) return { level: 'high', rows: 5, cols: 10 };
        if (dist <= 5) return { level: 'mid', rows: 2, cols: 6 };
        return { level: 'low', rows: 1, cols: 4 };
    }

    buildChunk(id, side, lod) {
        const stripCenterOffset = side * (this.roadHalfWidth + this.stripWidth * 0.5);
        const pos = {
            x: this.pos3d.x + stripCenterOffset,
            y: this.pos3d.y,
            z: this.pos3d.z - id * this.chunkLength - this.chunkLength * 0.5
        };
        const size = { x: this.stripWidth, y: this.chunkLength };

        const gridMesh2d = new GridMesh2D(
            this.app, this.cam, this.layer, this.debugLayer,
            lod.rows, lod.cols,
            this._groundTexture,
            { x: this.texRepeatX, y: this.texRepeatZ },
            pos, size
        );
        this.layer.addChild(gridMesh2d.mesh);

        gridMesh2d.mesh.tint = this._currentTint;

        return { gridMesh2d, lod: lod.level };
    }

    destroy() {
        for (const chunk of this.chunks.values()) {
            chunk.gridMesh2d.destroy(this.layer);
        }
        this.chunks.clear();
        this._groundTexture.destroy(true);
    }
}