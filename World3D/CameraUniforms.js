import { UniformGroup } from "pixi.js";

export const cameraUniforms = new UniformGroup({
    uCamPos: { value: new Float32Array(3), type: 'vec3<f32>' },
    uCamFov: { value: 1.0, type: 'f32' },
    uCamNear: { value: 1.0, type: 'f32' },
    uCamFar: { value: 4000.0, type: 'f32' },
    uCamHorizonOffset: { value: 0.0, type: 'f32' },
    uScreenSize: { value: new Float32Array(2), type: 'vec2<f32>' },
});

export function updateCameraUniforms(cam, width, height) {
    const u = cameraUniforms.uniforms;
    u.uCamPos[0] = cam.pos3d.x;
    u.uCamPos[1] = cam.pos3d.y;
    u.uCamPos[2] = cam.pos3d.z;
    u.uCamFov = cam.fov * Math.PI / 180;
    u.uCamNear = cam.near;
    u.uCamFar = cam.far;
    u.uCamHorizonOffset = cam.horizonOffset;
    u.uScreenSize[0] = width;
    u.uScreenSize[1] = height;
}