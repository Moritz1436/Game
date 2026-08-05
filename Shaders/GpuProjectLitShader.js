import { GlProgram, Shader, UniformGroup } from "pixi.js";
import { cameraUniforms } from "../World3D/CameraUniforms.js";

//Advanced Shader for rendering with lighting and material properties (metallic/roughness)

const vertexSrc = `
attribute vec3 aPosition3d;
attribute vec2 aUV;
attribute vec3 aNormal;

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
varying vec3 vWorldNormal;
varying vec3 vWorldPos;
varying float vValid;

void main() {
    vec3 world = uObjPos + (uRotationMatrix * (aPosition3d * uObjScale));

    vWorldNormal = uRotationMatrix * aNormal;
    vWorldPos = world;

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
varying vec3 vWorldNormal;
varying vec3 vWorldPos;
varying float vValid;

uniform sampler2D uTexture;
uniform vec4 uBaseColor;
uniform float uMetallic;
uniform float uRoughness;

uniform highp vec3 uCamPos;
uniform vec3 uLightDir;   // normalized, points TOWARD the light
uniform float uAmbient;
uniform float uDiffuseStrength;
uniform float uSpecularStrength;

void main() {
    if (vValid < 0.999) {
        discard;
    }

    vec4 tex = texture2D(uTexture, vUV);
    vec3 albedo = tex.rgb * uBaseColor.rgb;

    vec3 N = normalize(vWorldNormal);
    vec3 L = uLightDir;
    vec3 V = normalize(uCamPos - vWorldPos);
    vec3 H = normalize(L + V);

    float NdotL = max(dot(N, L), 0.0);
    float NdotH = max(dot(N, H), 0.0);

    // Stylized (non-physical) metallic/roughness approximation:
    // - metallic: little/no diffuse, specular tinted by albedo instead of white
    // - roughness: controls highlight size/sharpness (low = tight & bright, high = wide & dim)
    float shininess = mix(128.0, 4.0, uRoughness);
    float spec = pow(NdotH, shininess) * uSpecularStrength;

    vec3 diffuseColor = albedo * (1.0 - uMetallic);
    vec3 specularColor = mix(vec3(1.0), albedo, uMetallic);

    vec3 color = albedo * uAmbient
                + diffuseColor * NdotL * uDiffuseStrength
                + specularColor * spec;

    color = pow(color, vec3(1.0 / 2.2)); // gamma correction

    gl_FragColor = vec4(color, tex.a * uBaseColor.a);
}`;

const litProjectProgram = GlProgram.from({ vertex: vertexSrc, fragment: fragmentSrc });

export function createGpuProjectLitShader(texture, objPos, objScale, materialInfo = {}) {
    const baseColor = materialInfo.baseColor ?? [1, 1, 1, 1];
    const metallic = materialInfo.metallic ?? 1.0;
    const roughness = materialInfo.roughness ?? 1.0;

    return new Shader({
        glProgram: litProjectProgram,
        resources: {
            uTexture: texture.source,
            uCamera: cameraUniforms,
            uObject: new UniformGroup({
                uObjPos: { value: new Float32Array([objPos.x, objPos.y, objPos.z]), type: 'vec3<f32>' },
                uObjScale: { value: objScale, type: 'f32' },
                uRotationMatrix: { value: new Float32Array([1,0,0, 0,1,0, 0,0,1]), type: "mat3x3<f32>" }
            }),
            uMaterial: new UniformGroup({
                uBaseColor: { value: new Float32Array(baseColor), type: 'vec4<f32>' },
                uMetallic: { value: metallic, type: 'f32' },
                uRoughness: { value: roughness, type: 'f32' },
            }),
            uLighting: new UniformGroup({
                uLightDir: { value: new Float32Array([0.4, 1.0, 0.3]), type: 'vec3<f32>' },
                uAmbient: { value: 0.3, type: 'f32' },
                uDiffuseStrength: { value: 0.7, type: 'f32' },
                uSpecularStrength: { value: 0.6, type: 'f32' },
            }),
        }
    });
}