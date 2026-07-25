import * as PIXI from "pixi.js";
import { GridMesh2D } from "../World3D/GridMesh2D.js";

export class RoadManager {

    static width = 400;

    constructor(app, cam, layer, debugLayer, distance) {

        this.app = app;
        this.cam = cam;
        this.layer = layer;
        this.debugLayer = debugLayer;
        this.distance = distance;

        this.segmentLength = 100;
        this.texRepeatZ = 500;

        this.frontChunks = Math.ceil(cam.far / this.segmentLength);
        this.backChunks = 1;

        this.texture = PIXI.Assets.get("assets/street.png");
        this.texture.source.addressMode = "repeat";

        this.maxSegment = Math.ceil(distance / this.segmentLength);

        this.segments = new Map();
    }

    update() {
        const currentSegment = Math.floor(-this.cam.pos3d.z / this.segmentLength);

        const needed = new Set();

        for (let i = currentSegment - this.backChunks; i <= currentSegment + this.frontChunks; i++) {
            if (i < 0 ||  i >= this.maxSegment) {
                continue;
            }

            needed.add(i);

            //create new segments
            if (!this.segments.has(i)) {
                this.createSegment(i);
            }
        }

        //remove old
        for (const [id, segment] of this.segments) {

            if (!needed.has(id)) {

                segment.destroy(this.layer);

                this.segments.delete(id);
            }
        }

        for (const segment of this.segments.values()) {
            segment.update(
                this.app,
                this.cam
            );
        }
    }

    createSegment(index) {
        const pos = {x: 0, y: 0, z: -(index * this.segmentLength) - this.segmentLength * 0.5};
        const size = {x: RoadManager.width, y: this.segmentLength};

        const mesh = new GridMesh2D(
            this.app,
            this.cam,
            this.layer,
            this.debugLayer,
            10,
            20,
            this.texture,
            {
                x: -1,
                y: this.texRepeatZ
            },
            pos,
            size
        );

        this.layer.addChild(
            mesh.mesh
        );

        this.segments.set(
            index,
            mesh
        );
    }

    destroy() {

        for (const segment of this.segments.values()) {
            segment.destroy( this.layer );
        }

        this.segments.clear();
    }
}