import * as PIXI from "pixi.js";
import { createWireframeShader } from "../Shaders//WireframeShader.js";

const EDGES = [
    [0,1],[1,3],[3,2],[2,0], // bottom face
    [4,5],[5,7],[7,6],[6,4], // top face
    [0,4],[1,5],[2,6],[3,7], // verticals
];

export class AABBDebugMesh {
    constructor(layer, color = [1, 0, 0]) {
        this.layer = layer;

        // 8 corners, 3 floats each - filled in update()
        this.positions = new Float32Array(8 * 3);

        const indices = new Uint32Array(EDGES.flat());

        this.geometry = new PIXI.Geometry({
            attributes: {
                aPosition3d: { buffer: this.positions, size: 3 },
            },
            indexBuffer: indices,
            topology: 'line-list', // draw as line segments, not triangles
        });

        this.mesh = new PIXI.Mesh({
            geometry: this.geometry,
            shader: createWireframeShader(color),
        });

        this.layer.addChild(this.mesh);
    }

    ///@param corners - array of 8 {x,y,z} world-space AABB corners
    update(corners) {
        for (let i = 0; i < 8; i++) {
            this.positions[i*3]   = corners[i].x;
            this.positions[i*3+1] = corners[i].y;
            this.positions[i*3+2] = corners[i].z;
        }
        this.geometry.getBuffer("aPosition3d").update();
    }

    destroy() {
        this.mesh.destroy();
        this.geometry.destroy();
        this.layer.removeChild(this.mesh);
    }
}