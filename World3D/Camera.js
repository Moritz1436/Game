export class Camera {

    constructor(app) {

        //Position
        this.x = 0;
        this.y = 50;
        this.z = 0;

        this.fov = 60;

        //clipping
        this.near = 1;
        this.far = 1000;
    }

    project(worldPos, width, height){
        const dx = worldPos.x - this.x;
        const dy = worldPos.y - this.y;
        const dz = this.z - worldPos.z;

        if (dz <= this.near) {
            return null;
        }
        
        const fovRad = this.fov * Math.PI / 180;
        const aspect = width / height;
        const scale = 1 / Math.tan(fovRad / 2);
        
        const screenX = (dx / dz) * scale * aspect * width / 2 + width / 2;
        const screenY = -(dy / dz) * scale * height / 2 + height / 2;
        
        return { x: screenX, y: screenY };
    }

}