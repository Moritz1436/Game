import * as PIXI from "pixi.js";
import { RoadManager } from "./RoadManager.js";
import { DriveScene } from "./DriveScene.js";
import { ModelInstance } from "../Models/ModelInstance.js";

//manages trees, stones, grass etc.
// just dont drive through objects, could get ugly lol
export class ObjectManager {

    constructor(app, camera, layer, distance, assets) {

        this.app = app;
        this.camera = camera;
        this.layer = layer;
        this.layer.sortableChildren = true;
        this.assets = assets;

        this.chunkLength = 500;

        this.distance = distance;
        this.maxChunk = Math.ceil(distance / this.chunkLength);

        // Loading distance in chunks in z direction
        this.frontChunks = Math.ceil(camera.far / this.chunkLength);
        this.backChunks = 0;

        //loading distance in world units in x direction
        this.loadingDistanceX = 500;

        this.objectsPerChunkPerSide = 40;

        this.loadedChunks = new Map();
        this.creationQueue = [];
        this.maxCreationsPerFrame = 20;
    }

    update() {
        const currentChunk = Math.floor(
            -this.camera.pos3d.z / this.chunkLength
        );
        this._currentChunkForPriority = currentChunk;

        // load chunks
        for (
            let i = currentChunk - this.backChunks;
            i <= currentChunk + this.frontChunks;
            i++
        ) {

            if (i < 0 || i >= this.maxChunk) {
                continue;
            }

            const wantedLOD = this.getLOD(i - currentChunk);

            const chunk = this.loadedChunks.get(i);

            if (!chunk) {
                this.loadChunk(i, wantedLOD);
            }
            else if (chunk.lod !== wantedLOD) {
                this.destroyInstances(chunk);
                chunk.lod = wantedLOD;
                this.queueInstanceCreation(chunk);
            }
        }

        // remove chunks
        for (const id of this.loadedChunks.keys()) {
            if (
                id < currentChunk - this.backChunks ||
                id > currentChunk + this.frontChunks
            ) {
                this.unloadChunk(id);
            }
        }

        this.processCreationQueue();
    }

    queueInstanceCreation(chunk) {
        for (const obj of chunk.objects) {
            this.creationQueue.push({ chunk, obj });
        }
    }

    processCreationQueue() {
        if (this.creationQueue.length === 0) return;

        //sort list for priority (= closest to cam gets highest priority)
        this.creationQueue.sort((a, b) => {
            const distA = Math.abs(a.chunk.id - this._currentChunkForPriority);
            const distB = Math.abs(b.chunk.id - this._currentChunkForPriority);
            return distA - distB;
        });

        let count = 0;
        while (count < this.maxCreationsPerFrame && this.creationQueue.length > 0) {
            const { chunk, obj } = this.creationQueue.shift();

            if (!this.loadedChunks.has(chunk.id)) continue;

            const lod = this.getObjectLOD(obj.type, chunk.lod);
            if (lod === null) { obj.instance = null; count++; continue; }

            const asset = this.assets[obj.type][chunk.lod][obj.variant];
            obj.instance = new ModelInstance(asset, this.layer, obj.pos3d, obj.scale);
            count++;
        }
    }

    //gets id of a random asset
    randomVariant(type) {
        return Math.floor(
            Math.random() *
            this.assets[type].high.length
        );
    }

    ///@param t - how far the objects center will be from the road, closer -> small objects more likely, 0=close...1=far
    // near road:
    // trees 40%
    // bushes 20%
    // grass 30%
    // rocks 10%
    //
    // far away:
    // trees 85%
    // bushes 10%
    // grass 3%
    // rocks 2%
    chooseType(t) {
        const treeChance = 0.40 + t * (0.85 - 0.40);
        const bushChance = treeChance + (0.20 + t * (0.10 - 0.20));
        const grassChance = bushChance + (0.30 + t * (0.03 - 0.30));

        const r = Math.random();
        if (r < treeChance)
            return "trees";

        if (r < bushChance)
            return "bushes";

        if (r < grassChance)
            return "grass";

        return "rocks";
    }

    ///@brief creates a random pseudo object of a random type at a random position inside a chunk
    ///@param id - chunk id
    ///@param isLeft - wether the object is to be created on the left side, otherwise on the right
    createObject(id, isLeft) {
        const t = Math.random();
        const type = this.chooseType(t);
        const distToRoadX = t * this.loadingDistanceX;
        const variant = this.randomVariant(type);

        let scale;

        switch(type) {

            case "trees":
                scale = 30 + Math.random() * 15;
                break;

            case "rocks":
                scale = 25 + Math.random() * 10;
                break;

            case "grass":
                scale = 80 + Math.random() * 40;
                break;

            case "bushes":
                scale = 50 + Math.random() * 20;
                break;
        }

        const asset = this.assets[type].high[variant];

        const halfSize = asset.size.x * scale * 0.5;

        const roadHalf = RoadManager.width * 0.5;

        const x = isLeft
            ? -roadHalf - halfSize - distToRoadX
            :  roadHalf + halfSize + distToRoadX;

        const startZ = -id * this.chunkLength;

        return {
            type,
            variant,
            pos3d: {
                x,
                y: 0,
                z: startZ - Math.random() * this.chunkLength
            },
            scale,
            instance: null
        };
    }

    getObjectLOD(type, chunkLOD) {
        switch (type) {

            case "trees":
                // trees: high / medium / low
                return chunkLOD;

            case "bushes":
            case "rocks":
                // bushes + rocks: only high + medium
                if (chunkLOD === "low")
                    return null;

                return chunkLOD;

            case "grass":
                // grass: only high
                if (chunkLOD !== "high")
                    return null;

                return "high";
        }

        return null;
    }

    getLOD(chunkOffset) {

        const d = Math.abs(chunkOffset);

        if (d <= 2)
            return "high";

        if (d <= 5)
            return "medium";

        return "low";
    }

    destroyInstances(chunk) {
        for (const obj of chunk.objects) {

            if (obj.instance) {
                obj.instance.destroy();
                obj.instance = null;
            }
        }

        this.creationQueue = this.creationQueue.filter(entry => entry.chunk !== chunk);
    }

    loadChunk(id, lod) {
        const objects = [];

        for (let i = 0; i < this.objectsPerChunkPerSide; i++) {
            objects.push(this.createObject(id, true));
            objects.push(this.createObject(id, false));
        }

        const chunk = { id, lod, objects };
        this.loadedChunks.set(id, chunk);
        this.queueInstanceCreation(chunk);
    }

    unloadChunk(id) {
        const chunk = this.loadedChunks.get(id);
        if (!chunk) return;

        this.destroyInstances(chunk);
        this.loadedChunks.delete(id);
    }

    destroy() {
        for (const id of this.loadedChunks.keys()) {
            this.unloadChunk(id);
        }

        this.loadedChunks.clear();
        this.creationQueue.length = 0;
    }
}