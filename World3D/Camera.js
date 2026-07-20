import { Object3D } from "./Object3D.js";


export class Camera extends Object3D {

    constructor(app) {
        const pos3d = {x: 0, y: 100, z: 0};
        const size3d = {x: 0, y: 0, z:0};
        
        super(pos3d, size3d);
        
        this.horizonOffset = -150;
        this.fov = 60;

        //clipping
        this.near = 1;
        this.far = 2000;
    }

    project(worldPos, width, height){
        const dx = worldPos.x - this.pos3d.x;
        const dy = worldPos.y - this.pos3d.y;
        const dz = this.pos3d.z - worldPos.z;

        if (dz <= this.near || dz >= this.far) {
            return null;
        }
        
        const fovRad = this.fov * Math.PI / 180;
        const aspect = width / height;
        const scale = 1 / Math.tan(fovRad / 2);
        
        const screenX = (dx / dz) * scale * aspect * width / 2 + width / 2;
        const screenY = -(dy / dz) * scale * height / 2 + height / 2 + this.horizonOffset;
        
        return { x: screenX, y: screenY };
    }

}