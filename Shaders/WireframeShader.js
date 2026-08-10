import { GlProgram, Shader, UniformGroup } from "pixi.js";
import { cameraUniforms } from "../World3D/CameraUniforms.js";
import { IDENTITY_MAT3 } from "../World3D/Utils/Mat3Utils.js";

//Debug Shader for rendering outlines of 3d objects, so they get into the gpu z index buffer
//we ignore the WebGL warning "WebGL warning: uniform setter: Uniform's `type` requires uniform setter of type <enum 0x8b51>/0/0." - must be a bug!

const vertexSrc = `
attribute vec3 aPosition3d;

uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
uniform mat3 uCamRotationInv;

uniform vec3 uCamPos;
uniform float uCamFov;
uniform float uCamNear;
uniform float uCamFar;
uniform vec2 uScreenSize;

uniform mat3 uRot;
uniform vec3 uCenter;

varying float vValid;

void main() {
    vec3 world = uRot * aPosition3d + uCenter;

    float dx = world.x - uCamPos.x;
    float dy = world.y - uCamPos.y;
    float dz = world.z - uCamPos.z;

    vec3 local = uCamRotationInv * vec3(dx, dy, dz);
    float camDz = -local.z;

    bool validDepth = camDz >= uCamNear && camDz < uCamFar;
    float clampedDz = max(camDz, uCamNear);

    float scale = 1.0 / tan(uCamFov * 0.5);
    float screenX = (local.x / clampedDz) * scale * (uScreenSize.y * 0.5) + uScreenSize.x * 0.5;
    float screenY = -(local.y / clampedDz) * scale * (uScreenSize.y * 0.5) + uScreenSize.y * 0.5;

    if (!validDepth) {
        screenX = uScreenSize.x * 5.0;
        screenY = uScreenSize.y * 5.0;
    }

    mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
    float ndcDepth = (camDz - uCamNear) / (uCamFar - uCamNear) * 2.0 - 1.0;

    gl_Position = vec4((mvp * vec3(screenX, screenY, 1.0)).xy, ndcDepth, 1.0);
    vValid = validDepth ? 1.0 : 0.0;
}`;

const fragmentSrc = `
precision mediump float;
varying float vValid;
uniform vec3 uColor;

void main() {
    if (vValid < 0.999) discard;
    gl_FragColor = vec4(uColor, 1.0);
}`;

const wireframeProgram = GlProgram.from({ vertex: vertexSrc, fragment: fragmentSrc });

export function createWireframeShader(color = [1.0, 0.0, 0.0]) {
    return new Shader({
        glProgram: wireframeProgram,
        resources: {
            uCamera: cameraUniforms,
            uMaterial: new UniformGroup({
                uColor: { value: new Float32Array(color), type: 'vec3<f32>' },
            }),
            uOutline: new UniformGroup({
                uCenter: { value: new Float32Array(3), type: 'vec3<f32>' },
                uRot: { value: new Float32Array(IDENTITY_MAT3), type: 'mat3x3<f32>' },
            }),
        }
    });
}