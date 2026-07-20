import { GroundChunk } from "./GroundChunk.js";


//Manages the Ground Chunks, only holds chunks visible to the user, 
// new ones get created and old chunks will be freed
export class GroundManager {

    constructor(app, cam, layer, debugLayer, pos3d, worldSize2d) {

        this.cam = cam;
        this.app = app;
        this.layer = layer;
        this.debugLayer = debugLayer;

        this.chunkSize = 100;
        this.chunks = new Map();
        
        this.pos3d = pos3d;
        this.worldSize2d = worldSize2d;
        // how many chunks will be rendered
        this.renderDistanceX = 15;
        this.renderDistanceZ = cam.far / this.chunkSize;


        // chunk limits precompute
        this.minChunkX = Math.floor(
            (-worldSize2d.x * 0.5) / this.chunkSize
        );

        this.maxChunkX = Math.floor(
            (worldSize2d.x * 0.5) / this.chunkSize
        );


        this.minChunkZ = Math.floor(
            (-worldSize2d.y * 0.5) / this.chunkSize
        );

        this.maxChunkZ = Math.floor(
            (worldSize2d.y * 0.5) / this.chunkSize
        );
    }

    update() {
        const camX = this.cam.pos3d.x;
        const camZ = this.cam.pos3d.z;

        // current chunk
        const localX = camX - this.pos3d.x;
        const localZ = camZ - this.pos3d.z;

        const chunkX = Math.floor(localX / this.chunkSize);
        const chunkZ = Math.floor(localZ / this.chunkSize);

        const neededChunks = new Set();

        //create needed chunks
        for (let x = -this.renderDistanceX; x <= this.renderDistanceX; x++) {
            for (let z = -this.renderDistanceZ; z <= this.renderDistanceZ; z++) {

                const cx = chunkX + x;
                const cz = chunkZ + z;

                if (
                    cx < this.minChunkX ||
                    cx > this.maxChunkX ||
                    cz < this.minChunkZ ||
                    cz > this.maxChunkZ
                ) {
                    continue;
                }

                const chunkWorldZ = this.pos3d.z + cz * this.chunkSize;
                //chunk is behind cam
                if (chunkWorldZ > this.cam.pos3d.z) {
                    continue;
                }

                const key = `${cx},${cz}`;

                neededChunks.add(key);


                if (!this.chunks.has(key)) {
                    this.createChunk(cx, cz);
                }
            }
        }

        //remove unsued chunks
        for (const [key, chunk] of this.chunks) {

            if (!neededChunks.has(key)) {
                chunk.destroy();

                this.chunks.delete(key);
            }
        }

        //update visible chunks
        for (const chunk of this.chunks.values()) {
            chunk.gridMesh2d.update(this.app, this.cam);
        }

    }

    createChunk(x, z) {

        const pos = {
            x: this.pos3d.x + x * this.chunkSize + this.chunkSize * 0.5,
            y: this.pos3d.y,
            z: this.pos3d.z + z * this.chunkSize + this.chunkSize * 0.5
        };

        const size = {
            x: this.chunkSize,
            y: this.chunkSize
        };

        const chunk = new GroundChunk(
            this.app,
            this.cam,
            this.layer,
            this.debugLayer,
            pos,
            size
        );

        this.chunks.set(`${x},${z}`, chunk);

        this.layer.addChild(chunk.gridMesh2d.mesh);
    }

}