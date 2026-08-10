import * as PIXI from "pixi.js";
import { Object3D } from "../World3D/Object3D.js";
import { createGpuProjectLitShader } from "../Shaders/GpuProjectLitShader.js";
import { createGeometry3D } from "../World3D/Geometry3DUtils.js"
import { eulerToMat3, IDENTITY_MAT3 } from "../World3D/Utils/Mat3Utils.js";

// Instance of a 3d Model created by an asset, which was loaded by the loader
// each modelinstance gets its owm PIXI.Container
export class ModelInstance extends Object3D {

    ///@param asset - ModelAsset (or subclass) to instantiate
    ///@param layer - render container the meshes get added to
    ///@param pos3d - world position
    ///@param scale - uniform scale
    ///@param rotation - EITHER a flat 9-element rotation matrix (preferred -
    ///                  use this when composing transforms, e.g. from a
    ///                  parent piece's matrix) OR Euler angles {x,y,z} in
    ///                  radians (converted once, for simple one-off cases
    ///                  like static scenery that never composes rotations).
    constructor(asset, layer, pos3d, scale = 1, rotation = IDENTITY_MAT3) {
        super(pos3d, { x: 0, y: 0, z: 0 });

        this.asset = asset;
        this.scale = scale;
        this.layer = layer;

        this.rotationMatrix = this._resolveRotation(rotation);

        this.meshes = [];

        for (const meshData of asset.meshes) {
            const geometry = createGeometry3D(meshData.vertices, meshData.uvs, meshData.indices, null, meshData.normals ?? []);

            const mesh = new PIXI.Mesh({
                geometry,
                shader: createGpuProjectLitShader(meshData.texture, pos3d, scale,
                    {
                        baseColor: meshData.baseColor,
                        metallic: meshData.metallic,
                        roughness: meshData.roughness,
                    }
                )
            });

            this.meshes.push({
                name: meshData.name,
                mesh,
                geometry
            });

            this.layer.addChild(mesh);

            // Debug count stats
            window.DEBUG.meshes++;
            window.DEBUG.triangles += meshData.indices.length / 3;
        }

        // apply the resolved rotation to the GPU uniforms right away
        this.setRotationMatrix(this.rotationMatrix);

    }

    getMeshByName(name) {
        return this.meshes.find(m => m.name === name);
    }

    setMeshBaseColor(name, colorHex) {
        const entry = this.getMeshByName(name);
        if (!entry) {
            console.warn(`ModelInstance: no mesh named "${name}" on asset "${this.asset.name}"`);
            return;
        }

        const hex = typeof colorHex === "string"
            ? parseInt(colorHex.replace("#", ""), 16)
            : colorHex;

        const rgba = new Float32Array([
            ((hex >> 16) & 0xff) / 255,
            ((hex >> 8) & 0xff) / 255,
            (hex & 0xff) / 255,
            1.0,
        ]);

        entry.mesh.shader.resources.uMaterial.uniforms.uBaseColor.set(rgba);
    }

    // Accepts either a 9-element matrix (array/Float32Array) or an Euler
    // {x,y,z} object, and always returns a flat 9-element matrix.
    _resolveRotation(rotation) {
        if (Array.isArray(rotation) || rotation instanceof Float32Array) {
            return rotation;
        }
        return eulerToMat3(rotation); // Euler convenience path
    }

    // Preferred entry point when composing transforms (parent * local).
    setRotationMatrix(mat9) {
        this.rotationMatrix = mat9;
        for (const m of this.meshes) {
            m.mesh.shader.resources.uObject.uniforms.uRotationMatrix.set(mat9);
        }
    }

    // Convenience wrapper for simple, non-composed cases.
    setRotation(rot3d) {
        this.setRotationMatrix(eulerToMat3(rot3d));
    }

    setPosition(newPos3d) {
        this.pos3d = newPos3d;
        for (const m of this.meshes) {
            const u = m.mesh.shader.resources.uObject.uniforms;
            u.uObjPos[0] = newPos3d.x;
            u.uObjPos[1] = newPos3d.y;
            u.uObjPos[2] = newPos3d.z;
        }
    }

    setScale(scale) {
        this.scale = scale;
        for (const m of this.meshes) {
            m.mesh.shader.resources.uObject.uniforms.uObjScale = scale;
        }
    }

    setVisible(v) {
        for (const m of this.meshes) m.mesh.visible = v;
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