import { UniformGroup } from "pixi.js";
import { IDENTITY_MAT3, eulerToMat3, mat3Transpose } from "./Utils/Mat3Utils.js";

export const cameraUniforms = new UniformGroup({
    uCamRotationInv: { value: new Float32Array(IDENTITY_MAT3), type: 'mat3x3<f32>' },
    uCamPos: { value: new Float32Array(3), type: 'vec3<f32>' },
    uCamFov: { value: 1.0, type: 'f32' },
    uCamNear: { value: 1.0, type: 'f32' },
    uCamFar: { value: 4000.0, type: 'f32' },
    uScreenSize: { value: new Float32Array(2), type: 'vec2<f32>' },
});

export const lightingUniforms = new UniformGroup({
    uLightDir: { value: new Float32Array([0.4, 1.0, 0.3]), type: 'vec3<f32>' },
    uAmbient: { value: 0.3, type: 'f32' },
    uDiffuseStrength: { value: 0.7, type: 'f32' },
    uSpecularStrength: { value: 0.6, type: 'f32' },
    uNightFactor: { value: 0.0, type: 'f32' },
});

export function updateCameraUniforms(cam, width, height) {
    const u = cameraUniforms.uniforms;
    u.uCamPos[0] = cam.pos3d.x;
    u.uCamPos[1] = cam.pos3d.y;
    u.uCamPos[2] = cam.pos3d.z;

    const rotMat = eulerToMat3(cam.rot3d);
    const invRot = mat3Transpose(rotMat);
    u.uCamRotationInv.set(invRot);
    u.uCamFov = cam.fov * Math.PI / 180;
    u.uCamNear = cam.near;
    u.uCamFar = cam.far;
    u.uScreenSize[0] = width;
    u.uScreenSize[1] = height;

    u.uNightFactor = 1.0;
}