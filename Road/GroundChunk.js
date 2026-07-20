import * as PIXI from "pixi.js";
import { Object3D } from "../World3D/Object3D.js";
import { GridMesh2D } from "../World3D/GridMesh2D.js";

// 1 Mesh
export class GroundChunk extends Object3D {

    constructor(app, cam, layer, debugLayer, pos3d, size2d) {
        super(pos3d, {x: size2d.x, y: 0, z: size2d.y});

        this.layer = layer;

        this.rawVerticies = [
            {x: -size2d.x * 0.5, y: 0, z: -size2d.y * 0.5},
            {x: -size2d.x * 0.5, y: 0, z: +size2d.y * 0.5},
            {x:  size2d.x * 0.5, y: 0, z: +size2d.y * 0.5},
            {x:  size2d.x * 0.5, y: 0, z: -size2d.y * 0.5}
        ];

        this.gridMesh2d = new GridMesh2D(
            app,
            cam,
            layer,
            debugLayer,
            5, 
            5,
            PIXI.Texture.WHITE,
            {x: -1, y: -1},
            pos3d,
            size2d
        );

        this.gridMesh2d.mesh.tint = 0x3a8f3a;
    }

    destroy() {
        this.gridMesh2d.destroy(this.layer);
    }
}