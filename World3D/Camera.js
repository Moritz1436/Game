import { Object3D } from "./Object3D.js";
import { updateCameraUniforms } from "./CameraUniforms.js";
import { eulerToMat3, mat3TransformVec3, mat3Transpose } from "./Utils/Mat3Utils.js";

export class Camera extends Object3D {

    constructor(app, pos3d, rot3d) {
        const size3d = {x: 0, y: 0, z:0};
        const pos = {x: pos3d.x, y: pos3d.y, z: pos3d.z}
        
        super(pos, size3d);

        this.app = app;
        
        this.fov = 60;

        //clipping
        this.near = 1;
        this.far = 6000;

        //x -> up/down
        //y -> left/right
        //z -> roll
        this.rot3d = rot3d;
    }

    ///@param target - point the camera will be looking at
    lookAt(target) {
        const dx = target.x - this.pos3d.x;
        const dy = target.y - this.pos3d.y;
        const dz = target.z - this.pos3d.z;

        const horizontalDist = Math.sqrt(dx*dx + dz*dz);

        const yaw = Math.atan2(-dx, -dz);

        const pitch = Math.atan2(dy, horizontalDist);

        this.rot3d = { x: pitch, y: yaw, z: 0 };
    }

    update() {
        updateCameraUniforms(this, this.app.renderer.width, this.app.renderer.height);
    }

    project(worldPos, width, height) {
        const dx = worldPos.x - this.pos3d.x;
        const dy = worldPos.y - this.pos3d.y;
        const dz = worldPos.z - this.pos3d.z;

        const rotMat = eulerToMat3(this.rot3d);
        const invRot = mat3Transpose(rotMat);
        const local = mat3TransformVec3(invRot, { x: dx, y: dy, z: dz });

        const camDz = -local.z;

        if (camDz <= this.near || camDz >= this.far) return null;

        const fovRad = this.fov * Math.PI / 180;
        const scale = 1 / Math.tan(fovRad / 2);

        const screenX = (local.x / camDz) * scale * (height / 2) + width / 2;
        const screenY = -(local.y / camDz) * scale * (height / 2) + height / 2;

        return { x: screenX, y: screenY };
    }

    getHorizonY() {
        const w = this.app.renderer.width;
        const h = this.app.renderer.height;

        const rotMat = eulerToMat3(this.rot3d);
        const forward = mat3TransformVec3(rotMat, { x: 0, y: 0, z: -1 });

        const farPoint = {
            x: this.pos3d.x + forward.x * this.far * 0.5,
            y: this.pos3d.y,
            z: this.pos3d.z + forward.z * this.far * 0.5,
        };

        const p = this.project(farPoint, w, h);
        return p ? p.y : h * 0.5;
    }

}