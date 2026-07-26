import * as PIXI from "pixi.js";
import { Object3D } from "../World3D/Object3D.js";
import { createGpuProjectLitShader } from "../World3D/GpuProjectLitShader.js";
import { createGeometry3D } from "../World3D/Geometry3DUtils.js"

const LIGHT_DIR = normalize({ x: 0.4, y: 1.0, z: 0.3 });
const AMBIENT = 0.35;
const DIFFUSE = 0.75;

function normalize(v) {
    const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) || 1;
    return { x: v.x / len, y: v.y / len, z: v.z / len };
}

// fills `out` (Float32Array, 3 values per vertex) with brightness from normals
function computeVertexLighting(normals, out) {
    if (!normals) { out.fill(1.0); return; }
    for (let i = 0, j = 0; i < normals.length; i += 3, j += 3) {
        let nx = normals[i], ny = normals[i+1], nz = normals[i+2];
        const len = Math.sqrt(nx*nx + ny*ny + nz*nz) || 1;
        nx/=len; ny/=len; nz/=len;
        const dot = nx*LIGHT_DIR.x + ny*LIGHT_DIR.y + nz*LIGHT_DIR.z;
        const intensity = Math.min(1.2, AMBIENT + DIFFUSE * Math.max(0, dot));
        out[j] = out[j+1] = out[j+2] = intensity;
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

            const colors = new Float32Array(vertexCount * 3);
            computeVertexLighting(meshData.normals, colors);

            const geometry = createGeometry3D(meshData.vertices, meshData.uvs, meshData.indices, colors);

            const mesh = new PIXI.Mesh({
                geometry,
                shader: createGpuProjectLitShader(meshData.texture, pos3d, scale)
            });

            this.meshes.push({
                mesh,
                geometry
            });

            this.container.addChild(mesh);

            // Debug count stats
            window.DEBUG.meshes++;
            window.DEBUG.triangles += meshData.indices.length / 3;
        }

    }

    //only call when the obejcts position has changed
    updatePosition(newPos3d) {
        this.pos3d = newPos3d;
        for (const m of this.meshes) {
            const u = m.mesh.shader.resources.uObject.uniforms;
            u.uObjPos[0] = newPos3d.x;
            u.uObjPos[1] = newPos3d.y;
            u.uObjPos[2] = newPos3d.z;
        }
    }

    setVisible(v) {
        for (const m of this.meshes) m.mesh.visible = v;
    }

    update(app, cam) {
        const dx = this.pos3d.x - cam.pos3d.x;
        const dy = this.pos3d.y - cam.pos3d.y;
        const dz = cam.pos3d.z - this.pos3d.z; // Tiefe vor der Kamera

        //depth for rendering
        this.container.zIndex = -(dx*dx + dy*dy + dz*dz);
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