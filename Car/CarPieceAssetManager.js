import { CarPieceAsset } from "./CarPieceAsset.js";

export class CarPieceAssetManager {
    constructor() {
        this.assetsByName = new Map();
        this.assetsByType = new Map();
    }

    async loadAllAssets(manifest) {
        for (const entry of manifest) {
            const asset = await CarPieceAsset.load(entry.path, entry.type, entry.name);
            this.assetsByName.set(entry.name, asset);

            if (!this.assetsByType.has(entry.type)) this.assetsByType.set(entry.type, []);
            this.assetsByType.get(entry.type).push(asset);
        }
    }

    getAssetByName(name) {
        const asset = this.assetsByName.get(name);
        if (!asset) return null;
        return asset;
    }

    getAllAssetsOfType(type) {
        return this.assetsByType.get(type) ?? [];
    }
}