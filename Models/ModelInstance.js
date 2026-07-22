import * as PIXI from "pixi.js";
import { Object3D } from "../World3D/Object3D.js";

// Instance of a 3d Model created by an asset, which was loaded by the loader
export class ModelInstance extends Object3D {

    constructor(asset, layer, pos3d, scale = 1) {
        super(pos3d, { x: 0, y: 0, z: 0 });

        this.asset = asset;
        this.scale = scale;
        this.layer = layer;

        this.meshes = [];

        for (const meshData of asset.meshes) {

            const geometry = new PIXI.MeshGeometry({
                positions: new Float32Array(
                    (meshData.vertices.length / 3) * 2
                ),
                uvs: new Float32Array(meshData.uvs),
                indices: new Uint32Array(meshData.indices)
            });

            const mesh = new PIXI.Mesh({
                geometry,
                texture: meshData.texture
            });

            this.meshes.push({
                mesh,
                geometry,
                positionBuffer: geometry.getBuffer("aPosition"),
                vertices: meshData.vertices
            });

            this.layer.addChild(mesh);

            // Debug count stats
            window.DEBUG.meshes++;
            window.DEBUG.triangles += meshData.indices.length / 3;
        }

    }

    update(app, cam) {
        const w = app.renderer.width;
        const h = app.renderer.height;

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

            this.layer.removeChild(m.mesh);
            m.mesh.destroy();
        }

        this.meshes.length = 0;
    }

}