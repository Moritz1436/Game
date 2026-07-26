import * as PIXI from "pixi.js";

///@param positions3d - Float32Array, 3 floats per vertex (x,y,z), unchanged local coords
///@param uvs - Float32Array, 2 floats per vertex
///@param indices - Uint32Array
///@param colors - optional: Float32Array, 3 floats per vertex
export function createGeometry3D(positions3d, uvs, indices, colors = null) {
    const attributes = {
        aPosition3d: { buffer: positions3d, size: 3 },
        aUV: { buffer: uvs, size: 2 },
    };
    if (colors) {
        attributes.aColor = { buffer: colors, size: 3 };
    }
    return new PIXI.Geometry({ attributes, indexBuffer: indices });
}