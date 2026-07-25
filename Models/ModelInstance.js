import * as PIXI from "pixi.js";
import { Object3D } from "../World3D/Object3D.js";
import { createLightShader } from "./LightShader.js";

const LIGHT_DIR = normalize({ x: 0.4, y: 1.0, z: 0.3 });
const AMBIENT = 0.35;
const DIFFUSE = 0.75;

function normalize(v) {
    const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) || 1;
    return { x: v.x / len, y: v.y / len, z: v.z / len };
}

// fills `out` (Float32Array, 3 values per vertex) with brightness from normals
function computeVertexLighting(normals, out) {
    if (!normals) {
        out.fill(1.0); // no normals -> fallback
        return;
    }
    for (let i = 0, j = 0; i < normals.length; i += 3, j += 3) {
        let nx = normals[i], ny = normals[i + 1], nz = normals[i + 2];
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        nx /= len; ny /= len; nz /= len;

        const dot = nx * LIGHT_DIR.x + ny * LIGHT_DIR.y + nz * LIGHT_DIR.z;
        const intensity = Math.min(1.2, AMBIENT + DIFFUSE * Math.max(0, dot));

        out[j] = intensity;
        out[j + 1] = intensity;
        out[j + 2] = intensity;
    }
}

// Instance of a 3d Model created by an asset, which was loaded by the loader
// each modelinstance gets its owm PIXI.Container
export class ModelInstance extends Object3D {

    ///@param asset: ModelAsset you want to instanciate
    ///@param layer: BaseLayer the new layer will be added to 
    ///@param pos3d: worldPosition of the object
    ///@param scale: scale for the objects size
    constructor(asset, layer, pos3d, scale = 1) {
        super(pos3d, { x: 0, y: 0, z: 0 });

        this.asset = asset;
        this.scale = scale;
        this.layer = layer;
        this.container = new PIXI.Container();
        this.layer.addChild(this.container);

        this.meshes = [];

        for (const meshData of asset.meshes) {

            const vertexCount = meshData.vertices.length / 3;

            const geometry = new PIXI.MeshGeometry({
                positions: new Float32Array(
                    (meshData.vertices.length / 3) * 2
                ),
                uvs: new Float32Array(meshData.uvs),
                indices: new Uint32Array(meshData.indices)
            });

            //coloring (cpu lighting with normals)
            const colors = new Float32Array(vertexCount * 3);
            computeVertexLighting(meshData.normals, colors);
            geometry.addAttribute("aColor", colors, 3);

            const mesh = new PIXI.Mesh({
                geometry,
                shader: createLightShader(meshData.texture)
            });

            this.meshes.push({
                mesh,
                geometry,
                positionBuffer: geometry.getBuffer("aPosition"),
                vertices: meshData.vertices,
                normals: meshData.normals
            });

            this.container.addChild(mesh);

            // Debug count stats
            window.DEBUG.meshes++;
            window.DEBUG.triangles += meshData.indices.length / 3;
        }

    }

    update(app, cam) {
        const w = app.renderer.width;
        const h = app.renderer.height;

        const dx = this.pos3d.x - cam.pos3d.x;
        const dy = this.pos3d.y - cam.pos3d.y;
        const dz = this.pos3d.z - cam.pos3d.z;

        const distance =
            Math.sqrt(
                dx*dx +
                dy*dy +
                dz*dz
            );

        //depth for rendering
        this.container.zIndex = -distance;

        for (const m of this.meshes) {

            const positions = m.positionBuffer.data;

            let visible = true;

            for (let i = 0, j = 0; i < m.vertices.length; i += 3, j += 2) {

                const world = {
                    x: this.pos3d.x + m.vertices[i] * this.scale,
                    y: this.pos3d.y + m.vertices[i + 1] * this.scale,
                    z: this.pos3d.z + m.vertices[i + 2] * this.scale
                };

                const p = cam.project(world, w, h);

                if (!p) {
                    visible = false;
                    break;
                }

                positions[j] = p.x;
                positions[j + 1] = p.y;
            }

            m.mesh.visible = visible;
            m.positionBuffer.update();
        }
    }

    destroy() {

        for (const m of this.meshes) {
            //Debug count stats
            window.DEBUG.meshes--;
            window.DEBUG.triangles -= m.mesh.geometry.indexBuffer.data.length / 3;

            this.container.removeChild(m.mesh);
            m.mesh.destroy();

        }

        this.layer.removeChild(this.container);
        this.container.destroy();
        this.meshes.length = 0;
    }

}