import * as PIXI from "pixi.js";
import { GridMesh2D } from "../World3D/GridMesh2D.js";

export class RoadManager {

    static laneWidth = 120;
    static sideWidthMultiplier = 1.3;

    constructor(app, cam, layer, debugLayer, distance, options = {}) {

        this.app = app;
        this.cam = cam;
        this.layer = layer;
        this.debugLayer = debugLayer;
        this.distance = distance;

        this.laneCount = Math.max(2, options.laneCount ?? 3);

        this.segmentLength = 100;
        this.texRepeatZ = 500;

        this.frontChunks = Math.ceil(cam.far / this.segmentLength);
        this.backChunks = 1;

        this.sideTexture = PIXI.Assets.get(options.sideTexturePath ?? "assets/lane_side.png");
        this.sideTexture.source.addressMode = "repeat";

        this.middleTexture = this.laneCount > 2
            ? PIXI.Assets.get(options.middleTexturePath ?? "assets/lane_middle.png")
            : null;
        if (this.middleTexture) this.middleTexture.source.addressMode = "repeat";

        this.maxSegment = Math.ceil(distance / this.segmentLength);

        this.laneLayout = this._computeLaneLayout();

        this.segments = new Map(); // "${index}_${lane}" -> GridMesh2D
    }

    static computeTotalWidth(laneCount) {
        const sideWidth = RoadManager.laneWidth * RoadManager.sideWidthMultiplier;
        const middleWidth = RoadManager.laneWidth;
        const sides = 2 * sideWidth;
        const middles = Math.max(0, laneCount - 2) * middleWidth;
        return sides + middles;
    }

    _computeLaneLayout() {
        const sideWidth = RoadManager.laneWidth * RoadManager.sideWidthMultiplier;
        const middleWidth = RoadManager.laneWidth;

        const widths = [];
        for (let i = 0; i < this.laneCount; i++) {
            const isSide = i === 0 || i === this.laneCount - 1;
            widths.push(isSide ? sideWidth : middleWidth);
        }

        const totalWidth = widths.reduce((sum, w) => sum + w, 0);

        const lanes = [];
        let cursor = -totalWidth / 2;
        for (let i = 0; i < this.laneCount; i++) {
            const w = widths[i];
            lanes.push({
                width: w,
                centerX: cursor + w / 2,
                isSide: i === 0 || i === this.laneCount - 1,
            });
            cursor += w;
        }

        return { lanes, totalWidth };
    }

    _laneTexture(laneIndex) {
        if (laneIndex === 0) return { texture: this.sideTexture, flipX: true };                   // linker Rand
        if (laneIndex === this.laneCount - 1) return { texture: this.sideTexture, flipX: false };  // rechter Rand
        return { texture: this.middleTexture, flipX: false };                                       // Mittelspuren
    }

    update() {
        const currentSegment = Math.floor(-this.cam.pos3d.z / this.segmentLength);
        const needed = new Set();

        for (let i = currentSegment - this.backChunks; i <= currentSegment + this.frontChunks; i++) {
            if (i < 0 || i >= this.maxSegment) continue;

            for (let lane = 0; lane < this.laneCount; lane++) {
                const key = `${i}_${lane}`;
                needed.add(key);
                if (!this.segments.has(key)) {
                    this.createSegment(i, lane);
                }
            }
        }

        for (const [key, segment] of this.segments) {
            if (!needed.has(key)) {
                segment.destroy(this.layer);
                this.segments.delete(key);
            }
        }

        for (const segment of this.segments.values()) {
            segment.update(this.app, this.cam);
        }
    }

    createSegment(index, lane) {
        const laneInfo = this.laneLayout.lanes[lane];

        const pos = {
            x: laneInfo.centerX,
            y: 0,
            z: -(index * this.segmentLength) - this.segmentLength * 0.5
        };
        const size = { x: laneInfo.width, y: this.segmentLength };

        const { texture, flipX } = this._laneTexture(lane);

        const mesh = new GridMesh2D(
            this.app,
            this.cam,
            this.layer,
            this.debugLayer,
            10,
            20,
            texture,
            { x: -1, y: this.texRepeatZ },
            pos,
            size,
            flipX
        );

        this.layer.addChild(mesh.mesh);
        this.segments.set(`${index}_${lane}`, mesh);
    }

    destroy() {
        for (const segment of this.segments.values()) {
            segment.destroy(this.layer);
        }
        this.segments.clear();
    }
}