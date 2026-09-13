import { GlProgram, Shader, UniformGroup } from "pixi.js";
import { cameraUniforms, lightingUniforms } from "../World3D/Uniforms.js";

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

const MAX_POINT_LIGHTS = 4;

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
uniform vec3 uLightDir;
uniform float uAmbient;
uniform float uDiffuseStrength;
uniform float uSpecularStrength;
uniform float uNightFactor;

// NEU: flache float-Arrays statt vec3-Arrays (PIXI's UniformGroup
// unterstuetzt keine vec3<f32>[N] Arrays - nur skalare/Vektor-Basistypen).
// 3 Floats pro Licht fuer Position, 3 fuer Farbe, 1 fuer Intensity.
uniform float uPointLightPos[${MAX_POINT_LIGHTS * 3}];
uniform float uPointLightColor[${MAX_POINT_LIGHTS * 3}];
uniform float uPointLightIntensity[${MAX_POINT_LIGHTS}];

void main() {
    if (vValid < 0.999) {
        discard;
    }

    vec4 tex = texture2D(uTexture, vUV);
    vec3 texLinear = pow(tex.rgb, vec3(2.2));
    vec3 albedo = texLinear * uBaseColor.rgb;

    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(uCamPos - vWorldPos);

    float shininess = mix(128.0, 4.0, uRoughness);

    vec3 diffuseColor = albedo * (1.0 - uMetallic);
    vec3 specularColor = mix(vec3(1.0), albedo, uMetallic);

    vec3 L = uLightDir;
    vec3 H = normalize(L + V);
    float NdotL = max(dot(N, L), 0.0);
    float NdotH = max(dot(N, H), 0.0);
    float spec = pow(NdotH, shininess) * uSpecularStrength;

    vec3 color = albedo * uAmbient
                + diffuseColor * NdotL * uDiffuseStrength
                + specularColor * spec;

    // NEU: vec3 manuell aus den flachen Arrays zusammensetzen
    for (int i = 0; i < ${MAX_POINT_LIGHTS}; i++) {
        vec3 lightPos = vec3(uPointLightPos[i*3], uPointLightPos[i*3+1], uPointLightPos[i*3+2]);
        vec3 lightColor = vec3(uPointLightColor[i*3], uPointLightColor[i*3+1], uPointLightColor[i*3+2]);

        vec3 toLight = lightPos - vWorldPos;
        float dist = length(toLight);
        vec3 Lp = toLight / max(dist, 0.0001);

        float attenuation = uPointLightIntensity[i] / (1.0 + dist * dist * 0.0008);

        vec3 Hp = normalize(Lp + V);
        float NdotLp = max(dot(N, Lp), 0.0);
        float NdotHp = max(dot(N, Hp), 0.0);
        float specP = pow(NdotHp, shininess) * uSpecularStrength;

        color += lightColor * attenuation * (diffuseColor * NdotLp + specularColor * specP);
    }

    vec3 nightTint = vec3(0.55, 0.62, 0.85);
    float nightDarken = mix(1.0, 0.35, uNightFactor);
    color = mix(color, color * nightTint, uNightFactor * 0.6) * nightDarken;

    color = pow(color, vec3(1.0 / 2.2));

    gl_FragColor = vec4(color, tex.a * uBaseColor.a);
}`;

const litProjectProgram = GlProgram.from({ vertex: vertexSrc, fragment: fragmentSrc });

export function createGpuProjectLitShader(texture, objPos, objScale, materialInfo = {}) {
    const baseColor = materialInfo.baseColor ?? [1, 1, 1, 1];
    const metallic = materialInfo.metallic ?? 1.0;
    const roughness = materialInfo.roughness ?? 1.0;

    // NEU: flache Float32Arrays statt vec3-Arrays
    const pointLightPos = new Float32Array(MAX_POINT_LIGHTS * 3);
    const pointLightColor = new Float32Array(MAX_POINT_LIGHTS * 3);
    const pointLightIntensity = new Float32Array(MAX_POINT_LIGHTS);

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
            uLighting: lightingUniforms,
            // NEU: flache f32-Arrays - jeweils type: 'f32' mit passender
            // Array-Laenge als value
            uPointLights: new UniformGroup({
                uPointLightPos: { value: pointLightPos, type: 'f32', size: MAX_POINT_LIGHTS * 3 },
                uPointLightColor: { value: pointLightColor, type: 'f32', size: MAX_POINT_LIGHTS * 3 },
                uPointLightIntensity: { value: pointLightIntensity, type: 'f32', size: MAX_POINT_LIGHTS },
            }),
        }
    });
}

export function setPointLights(shader, lights) {
    const posArr = shader.resources.uPointLights.uniforms.uPointLightPos;
    const colorArr = shader.resources.uPointLights.uniforms.uPointLightColor;
    const intensityArr = shader.resources.uPointLights.uniforms.uPointLightIntensity;

    for (let i = 0; i < MAX_POINT_LIGHTS; i++) {
        const light = lights[i];
        if (light) {
            posArr[i * 3 + 0] = light.pos.x;
            posArr[i * 3 + 1] = light.pos.y;
            posArr[i * 3 + 2] = light.pos.z;

            colorArr[i * 3 + 0] = light.color[0];
            colorArr[i * 3 + 1] = light.color[1];
            colorArr[i * 3 + 2] = light.color[2];

            intensityArr[i] = light.intensity;
        } else {
            intensityArr[i] = 0;
        }
    }
}

export { MAX_POINT_LIGHTS };