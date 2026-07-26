import { GlProgram, Shader, UniformGroup } from "pixi.js";
import { cameraUniforms } from "./CameraUniforms.js";

const vertexSrc = `
attribute vec3 aPosition3d;
attribute vec2 aUV;
attribute vec3 aColor;

uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;

uniform vec3 uObjPos;
uniform float uObjScale;

uniform vec3 uCamPos;
uniform float uCamFov;
uniform float uCamNear;
uniform float uCamFar;
uniform float uCamHorizonOffset;
uniform vec2 uScreenSize;

varying vec2 vUV;
varying vec3 vColor;
varying float vValid;

void main() {
    vec3 world = uObjPos + aPosition3d * uObjScale;

    float dx = world.x - uCamPos.x;
    float dy = world.y - uCamPos.y;
    float dz = uCamPos.z - world.z;

    bool validDepth = dz >= uCamNear && dz < uCamFar;
    float clampedDz = max(dz, uCamNear);

    float scale = 1.0 / tan(uCamFov * 0.5);
    float screenX = (dx / clampedDz) * scale * (uScreenSize.y * 0.5) + uScreenSize.x * 0.5;
    float screenY = -(dy / clampedDz) * scale * (uScreenSize.y * 0.5) + uScreenSize.y * 0.5 + uCamHorizonOffset;

    if (!validDepth) {
        screenX = uScreenSize.x * 5.0;
        screenY = uScreenSize.y * 5.0;
    }

    mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
    gl_Position = vec4((mvp * vec3(screenX, screenY, 1.0)).xy, 0.0, 1.0);

    vUV = aUV;
    vColor = aColor;
    vValid = validDepth ? 1.0 : 0.0;
}`;

const fragmentSrc = `
precision mediump float;
varying vec2 vUV;
varying vec3 vColor;
varying float vValid;
uniform sampler2D uTexture;

void main() {
    if (vValid < 0.999) {
        discard;
    }
    vec4 tex = texture2D(uTexture, vUV);
    gl_FragColor = vec4(tex.rgb * vColor, tex.a);
}`;

const litProjectProgram = GlProgram.from({ vertex: vertexSrc, fragment: fragmentSrc });

export function createGpuProjectLitShader(texture, objPos, objScale) {
    return new Shader({
        glProgram: litProjectProgram,
        resources: {
            uTexture: texture.source,
            uCamera: cameraUniforms, // GETEILTE Instanz, nicht neu erzeugen
            uObject: new UniformGroup({
                uObjPos: { value: new Float32Array([objPos.x, objPos.y, objPos.z]), type: 'vec3<f32>' },
                uObjScale: { value: objScale, type: 'f32' },
            }),
        }
    });
}