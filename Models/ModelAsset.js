import { ModelInstance } from "./ModelInstance.js";

// Blueprint to a 3d model, which can create lots of 
// instances of a model for a 3d world
export class ModelAsset {

    constructor(data) {

        this.name = data.name;
        this.meshes = [];
        this.sockets = data.sockets ?? [];
        this.requiredSocketTypes = data.requiredSocketTypes ?? [];
        this.modifiers = data.modifiers ?? [];

        let minX = Infinity;
        let minY = Infinity;
        let minZ = Infinity;

        let maxX = -Infinity;
        let maxY = -Infinity;
        let maxZ = -Infinity;

        for (const mesh of data.meshes) {

            this.meshes.push({
                name: mesh.name,
                vertices: mesh.vertices,
                uvs: mesh.uvs,
                indices: mesh.indices,
                texture: mesh.texture,
                normals: mesh.normals ?? null,
                baseColor: mesh.baseColor ?? [1, 1, 1, 1],
                metallic: mesh.metallic ?? 1.0,
                roughness: mesh.roughness ?? 1.0,
            });

            const v = mesh.vertices;

            for (let i = 0; i < v.length; i += 3) {

                const x = v[i];
                const y = v[i + 1];
                const z = v[i + 2];

                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (z < minZ) minZ = z;

                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
                if (z > maxZ) maxZ = z;
            }
        }

        this.bounds = {
            min: {
                x: minX,
                y: minY,
                z: minZ
            },
            max: {
                x: maxX,
                y: maxY,
                z: maxZ
            }
        };

        this.size = {
            x: maxX - minX,
            y: maxY - minY,
            z: maxZ - minZ
        };

        this.center = {
            x: (minX + maxX) * 0.5,
            y: (minY + maxY) * 0.5,
            z: (minZ + maxZ) * 0.5
        };
    }

    createInstance(pos3d, scale = 1) {

        return new ModelInstance(
            this,
            pos3d,
            scale
        );
    }
}