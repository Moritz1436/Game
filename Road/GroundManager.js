import * as PIXI from "pixi.js";
import { GridMesh2D } from "../World3D/GridMesh2D.js";


// Manages the ground as an infinite, forward-streamed strip of Z-chunks.
// Chunk resolution (LOD) is re-evaluated every frame and chunks are rebuilt
// in place when their LOD level changes.
export class GroundManager {

    ///@param app - PIXIJS Application
    ///@param cam - Camera Object of the 3d World
    ///@param layer - PIXI.Container the ground meshes get added to
    ///@param debugLayer - PIXI.Container for debug outlines
    ///@param pos3d - world-space origin of the ground strip (x = strip center, z = chunk index origin)
    ///@param groundWidth - width in world units (X) each chunk mesh covers
    constructor(app, cam, layer, debugLayer, pos3d) {
        this.app = app;
        this.cam = cam;
        this.layer = layer;
        this.debugLayer = debugLayer;

        this.pos3d = pos3d;
        this.groundWidth = 5000;

        // depth (Z) of a single chunk band
        this.chunkLength = 100;

        // World-unit texture repeat instead of per-chunk (-1) UVs, so a real
        // texture tiles seamlessly across chunk borders instead of stretching
        // per chunk.
        this.texRepeatX = 300;
        this.texRepeatZ = 300;

        this.frontChunks = Math.ceil(cam.far / this.chunkLength);
        this.backChunks = 1;

        // id -> { gridMesh2d, lod: 'high'|'mid'|'low' }
        this.chunks = new Map();
    }

    update() {
        const localZ = this.cam.pos3d.z - this.pos3d.z;
        const currentChunk = Math.floor(-localZ / this.chunkLength);

        const needed = new Set();

        for (let i = currentChunk - this.backChunks; i <= currentChunk + this.frontChunks; i++) {
            needed.add(i);

            const desiredLod = this.getLod(i - currentChunk);
            const chunk = this.chunks.get(i);

            if (!chunk) {
                this.chunks.set(i, this.buildChunk(i, desiredLod));
            } else if (chunk.lod !== desiredLod.level) {
                // camera crossed close enough (or far enough) that this
                // chunk's resolution is now wrong -> rebuild its geometry
                chunk.gridMesh2d.destroy(this.layer);
                this.chunks.set(i, this.buildChunk(i, desiredLod));
            }
        }

        for (const [id, chunk] of this.chunks) {
            if (!needed.has(id)) {
                chunk.gridMesh2d.destroy(this.layer);
                this.chunks.delete(id);
            }
        }

        for (const chunk of this.chunks.values()) {
            chunk.gridMesh2d.update(this.app, this.cam);
        }
    }

    // chunkOffset is measured in chunk units relative to the camera's
    // current chunk (not world units) - only changes when the camera
    // crosses a chunk boundary, so this never thrashes mid-chunk.
    getLod(chunkOffset) {
        const dist = Math.abs(chunkOffset);
        if (dist <= 2) return { level: 'high', rows: 6, cols: 10 };
        if (dist <= 6) return { level: 'mid', rows: 3, cols: 6 };
        return { level: 'low', rows: 1, cols: 3 };
    }

    buildChunk(id, lod) {
        const pos = {
            x: this.pos3d.x,
            y: this.pos3d.y,
            z: this.pos3d.z - id * this.chunkLength - this.chunkLength * 0.5
        };
        const size = { x: this.groundWidth, y: this.chunkLength };

        const texture = PIXI.Assets.get("assets/ground.png");
        texture.source.addressMode = "repeat";

        const gridMesh2d = new GridMesh2D(
            this.app, this.cam, this.layer, this.debugLayer,
            lod.rows, lod.cols,
            texture,
            { x: this.texRepeatX, y: this.texRepeatZ },
            pos, size
        );
        this.layer.addChild(gridMesh2d.mesh);

        return { gridMesh2d, lod: lod.level };
    }

    destroy() {
        for (const chunk of this.chunks.values()) {
            chunk.gridMesh2d.destroy(this.layer);
        }
        this.chunks.clear();
    }
}