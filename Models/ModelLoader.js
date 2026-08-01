import * as PIXI from "pixi.js";
import { ModelAsset } from "./ModelAsset.js";

// Create a 3d object in Blender and export it as a .glb, then use /dev/Converter.py to convert 
// it to a json that you can load with this class into an asset which is the blueprint 
// to creating a lot of instances of the model in the 3d world
export class ModelLoader {

    // path -> Promise<ModelAsset>. Storing the PROMISE (not just the
    // resolved asset) is what makes this safe against concurrent calls:
    // if load() is called twice for the same path before the first call
    // finishes, both callers await the same in-flight promise instead of
    // triggering two separate fetches/texture loads for the same file.
    static cache = new Map();

    ///@param path - path to the model JSON file
    ///@param factory - optional (data) => ModelAsset, lets callers use a
    ///                 subclass (e.g. CarPieceAsset) instead of the base
    ///                 ModelAsset. Defaults to plain ModelAsset.
    static load(path, factory = (data) => new ModelAsset(data)) {
        if (this.cache.has(path)) {
            return this.cache.get(path);
        }

        const promise = this._loadInternal(path, factory).catch((err) => {
            // don't leave a rejected promise cached - a later retry should
            // actually try again instead of forever returning the same error
            this.cache.delete(path);
            throw err;
        });

        this.cache.set(path, promise);
        return promise;
    }

    static async _loadInternal(path, factory) {
        const response = await fetch(path);
        if (!response.ok) {
            throw new Error(`ModelLoader: failed to fetch "${path}" (${response.status})`);
        }
        const data = await response.json();

        // load all mesh textures in parallel instead of one-by-one -
        // meaningfully faster for models with several materials
        await Promise.all(
            data.meshes.map(async (mesh) => {
                if (!mesh.texture) {
                    mesh.texture = PIXI.Texture.WHITE;
                    return;
                }
                await PIXI.Assets.load(mesh.texture);
                mesh.texture = PIXI.Assets.get(mesh.texture);
            })
        );

        return factory(data);
    }

    ///@param entries - array of { path, factory? } - loads several models in
    ///                 parallel. Convenience for CarPieceAssetManager-style
    ///                 batch loading.
    static loadMany(entries) {
        return Promise.all(
            entries.map(e => this.load(e.path, e.factory))
        );
    }

    // Drop a single cached asset (e.g. to force a re-fetch during dev/hot-reload).
    // Note: this does NOT destroy any already-created ModelInstances using it.
    static clearCache(path) {
        if (path) {
            this.cache.delete(path);
        } else {
            this.cache.clear();
        }
    }

}