export class OrbitCameraController {
    constructor(camera, target, distance) {
        this.camera = camera;
        this.target = target;
        this.distance = distance;
        this.yaw = 0;
        this.pitch = 0.15;
    }

    update() {
        const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
        const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
        
        this.camera.pos3d.x = this.target.x - this.distance * cp * sy;
        this.camera.pos3d.y = this.target.y + this.distance * sp;
        this.camera.pos3d.z = this.target.z + this.distance * cp * cy;

        this.camera.lookAt(this.target);
    }

    rotate(deltaYaw, deltaPitch) {
        this.yaw += deltaYaw;
        this.pitch = Math.max(-1.2, Math.min(1.2, this.pitch + deltaPitch));
    }
}