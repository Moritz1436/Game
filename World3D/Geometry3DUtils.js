import * as PIXI from "pixi.js";

///@param positions3d - Float32Array, 3 floats per vertex (x,y,z), unchanged local coords
///@param uvs - Float32Array, 2 floats per vertex
///@param indices - Uint32Array
///@param colors - optional: Float32Array, 3 floats per vertex
export function createGeometry3D(positions3d, uvs, indices, colors = null, normals = null) {
    const geometry = new PIXI.Geometry({ indexBuffer: indices });
    geometry.addAttribute("aPosition3d", positions3d, 3);
    geometry.addAttribute("aUV", uvs, 2);
    if (colors) geometry.addAttribute("aColor", colors, 3);
    if (normals) geometry.addAttribute("aNormal", normals, 3);
    return geometry;
}