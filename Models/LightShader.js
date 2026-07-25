import { GlProgram, Shader } from "pixi.js";

const vertexSrc = `
attribute vec2 aPosition;
attribute vec2 aUV;
attribute vec3 aColor;

uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;

varying vec2 vUV;
varying vec3 vColor;

void main() {
    mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
    gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
    vUV = aUV;
    vColor = aColor;
}`;

const fragmentSrc = `
precision mediump float;
varying vec2 vUV;
varying vec3 vColor;
uniform sampler2D uTexture;

void main() {
    vec4 tex = texture2D(uTexture, vUV);
    gl_FragColor = vec4(tex.rgb * vColor, tex.a);
}`;


const litProgram = GlProgram.from({ vertex: vertexSrc, fragment: fragmentSrc });

export function createLightShader(texture) {
    return new Shader({
        glProgram: litProgram,
        resources: {
            uTexture: texture.source
        }
    });
}