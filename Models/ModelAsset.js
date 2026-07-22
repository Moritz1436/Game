import { ModelInstance } from "./ModelInstance.js";

// Blueprint to a 3d model, which can create lots of 
// instances of a model for a 3d world
export class ModelAsset {

    constructor(data) {

        this.name = data.name;

        this.meshes = data.meshes.map(mesh => {

            return {
                //relative to model position
                vertices: mesh.vertices,
                uvs: mesh.uvs,
                indices: mesh.indices,
                texture: mesh.texture
            };

        });
    }

    createInstance(pos3d, scale = 1) {

        return new ModelInstance(
            this,
            pos3d,
            scale
        );
    }
}