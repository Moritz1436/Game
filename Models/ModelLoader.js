import * as PIXI from "pixi.js";
import { ModelAsset } from "./ModelAsset.js";

// Create a 3d object in Blender and export it as a .glb, then use /dev/Converter.py to convert 
// it to a json that you can load with this class into an asset which is the blueprint 
// to creating a lot of instances of the model in the 3d world
export class ModelLoader {

    static cache = new Map();

    //loads not only the asset but also the texture
    static async load(path) {

        if (this.cache.has(path)) {
            return this.cache.get(path);
        }

        const response = await fetch(path);
        const data = await response.json();

        for(const mesh of data.meshes){
            await PIXI.Assets.load(mesh.texture);
            mesh.texture = PIXI.Assets.get(mesh.texture);
        }

        const asset = new ModelAsset(data);

        this.cache.set(path, asset);

        return asset;
    }

}