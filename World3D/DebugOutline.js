import * as PIXI from "pixi.js";
import { createWireframeShader } from "../Shaders/WireframeShader.js";
import { getAABBCorners } from "./Utils/BoundsUtils.js";

const EDGES = [
    [0,1],[1,3],[3,2],[2,0], // bottom face
    [4,5],[5,7],[7,6],[6,4], // top face
    [0,4],[1,5],[2,6],[3,7], // verticals
];

export class DebugOutline {
    constructor(layer, color = [1, 0, 0]) {
        this.layer = layer;

        this.positions = new Float32Array(8 * 3);
        const indices = new Uint32Array(EDGES.flat());

        this.geometry = new PIXI.Geometry({
            attributes: { aPosition3d: { buffer: this.positions, size: 3 } },
            indexBuffer: indices,
            topology: 'line-list',
        });

        this.shader = createWireframeShader(color);
        this.mesh = new PIXI.Mesh({ geometry: this.geometry, shader: this.shader });

        this.layer.addChild(this.mesh);
    }

    // Call only when the underlying piece tree structurally changes
    // (new/removed parts) - never per frame.
    ///@param localAABB - from rootPiece.getLocalAABB(): {min:{x,y,z}, max:{x,y,z}}
    rebuildShape(localAABB) {
        const corners = getAABBCorners(localAABB); // corners in root-local, un-rotated space
        for (let i = 0; i < 8; i++) {
            this.positions[i*3]   = corners[i].x;
            this.positions[i*3+1] = corners[i].y;
            this.positions[i*3+2] = corners[i].z;
        }
        this.geometry.getBuffer("aPosition3d").update();
    }

    // Call whenever the car's world position/rotation changes - pure
    // uniform writes, no buffer upload.
    setTransform(pos3d, rotMat3) {
        const u = this.shader.resources.uOutline.uniforms;
        u.uCenter[0] = pos3d.x;
        u.uCenter[1] = pos3d.y;
        u.uCenter[2] = pos3d.z;
        u.uRot.set(rotMat3);
    }

    destroy() {
        this.mesh.destroy();
        this.geometry.destroy();
        this.layer.removeChild(this.mesh);
    }
}