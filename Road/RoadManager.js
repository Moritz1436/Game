import { RoadSegment } from "./RoadSegment.js";

export class RoadManager {

    constructor(app, cam, layer, debugLayer, distance) {

        this.app = app;
        this.cam = cam;
        this.layer = layer;
        this.debugLayer = debugLayer;

        this.segmentLength = 100;
        this.segmentWidth = 200;

        this.renderDistance = cam.far / this.segmentLength;

        this.maxSegment = Math.ceil(distance / this.segmentLength);

        this.segments = new Map();
    }

    update() {

        const camSegment = Math.floor((-this.cam.pos3d.z) / this.segmentLength);

        const needed = new Set();

        for (let i = camSegment - this.renderDistance; i <= camSegment + this.renderDistance; i++) {

            if (i < 0 || i >= this.maxSegment) {
                continue;
            }

            needed.add(i);

            if (!this.segments.has(i)) {
                this.createSegment(i);
            }
        }

        for (const [index, segment] of this.segments) {

            if (!needed.has(index)) {
                segment.destroy();
                this.segments.delete(index);
            }
        }

        for (const segment of this.segments.values()) {
            segment.update(this.app, this.cam);
        }
    }

    createSegment(index) {

        const pos = {
            x: 0,
            y: 0,
            z: 50 - index * this.segmentLength
        };

        const size = {
            x: this.segmentWidth,
            y: this.segmentLength
        };

        const road = new RoadSegment(
            this.app,
            this.cam,
            this.layer,
            this.debugLayer,
            pos,
            size
        );

        this.segments.set(index, road);

        this.layer.addChild(road.gridMesh2d.mesh);
    }

    destroy() {

        for (const road of this.segments.values()) {
            road.destroy();
        }

        this.segments.clear();
    }
}