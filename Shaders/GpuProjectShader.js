import { GlProgram, Shader, UniformGroup } from "pixi.js";
import { cameraUniforms } from "../World3D/Uniforms.js";

//Basic Shader for simple rendering

const vertexSrc = `
attribute vec3 aPosition3d;
attribute vec2 aUV;

uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
uniform mat3 uCamRotationInv;
uniform mat3 uRotationMatrix;

uniform vec3 uObjPos;
uniform float uObjScale;

uniform vec3 uCamPos;
uniform float uCamFov;
uniform float uCamNear;
uniform float uCamFar;
uniform vec2 uScreenSize;

varying vec2 vUV;
varying float vValid;

void main() {
    vec3 world = uObjPos + (uRotationMatrix * (aPosition3d * uObjScale));

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

    vUV = aUV;
    vValid = validDepth ? 1.0 : 0.0;
}`;

const fragmentSrc = `
precision mediump float;
varying vec2 vUV;
varying float vValid;
uniform sampler2D uTexture;

void main() {
    if (vValid < 0.999) {
        discard;
    }
    gl_FragColor = texture2D(uTexture, vUV);
}`;

const gpuProjectProgram = GlProgram.from({ vertex: vertexSrc, fragment: fragmentSrc });

export function createGpuProjectShader(texture, objPos, objScale) {
    return new Shader({
        glProgram: gpuProjectProgram,
        resources: {
            uTexture: texture.source,
            uCamera: cameraUniforms,
            uObject: new UniformGroup({
                uObjPos: { value: new Float32Array([objPos.x, objPos.y, objPos.z]), type: 'vec3<f32>' },
                uObjScale: { value: objScale, type: 'f32' },
                uRotationMatrix: { value: new Float32Array([1,0,0, 0,1,0 ,0,0,1]), type: "mat3x3<f32>" }
            }),
        }
    });
}