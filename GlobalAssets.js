

import { CarPieceAssetManager } from "./Car/CarPieceAssetManager.js";

// Everything that's needed across multiple scenes (car parts used in both
// Garage and Drive, shared UI assets, etc). Loaded ONCE at app startup,
// stays resident for the whole session.
export const globalAssetManager = new CarPieceAssetManager();

//any models that are needed in more than 1 scene go here
export const GLOBAL_MANIFEST = [
    //{ type: "base",    name: "base_sedan",      path: "assets/models/car/base_sedan.json" },
    { type: "base",    name: "base_audi",      path: "assets/models/car/base_audi.json" },
    { type: "base",    name: "base_bmw",      path: "assets/models/car/base_bmw.json" },
    { type: "base",    name: "base_ford",      path: "assets/models/car/base_ford.json" },
    { type: "base",    name: "base_lambo",      path: "assets/models/car/base_lambo.json" },
    { type: "base",    name: "base_mazda",      path: "assets/models/car/base_mazda.json" },
    { type: "base",    name: "base_mustang",      path: "assets/models/car/base_mustang.json" },
    { type: "tire",    name: "tire_wide",      path: "assets/models/car/tire_wide.json" },
    { type: "tire",    name: "tire_narrow",      path: "assets/models/car/tire_narrow.json" },
    { type: "tire",    name: "tire_sport",      path: "assets/models/car/tire_sport.json" },
    { type: "tire",    name: "tire_1",          path: "assets/models/car/tire_1.json" },
    { type: "tire",    name: "tire_2",          path: "assets/models/car/tire_2.json" },
    { type: "tire",    name: "tire_3",          path: "assets/models/car/tire_3.json" },
    { type: "spoiler", name: "spoiler_big",     path: "assets/models/car/spoiler_big.json" },
    { type: "spoiler", name: "spoiler_bmw",     path: "assets/models/car/spoiler_bmw.json" },
    { type: "spoiler", name: "spoiler_lambo",     path: "assets/models/car/spoiler_lambo.json" }
];

export async function loadGlobalAssetEntry(entry) {
    await globalAssetManager.loadAllAssets([entry]);
}


export const DEFAULT_CAR_CONFIG = {
    base: "base_bmw",
    parts: {
        socket_tire_FL: "tire_wide",
        socket_tire_FR: "tire_wide",
        socket_tire_RL: "tire_wide",
        socket_tire_RR: "tire_wide",
        socket_spoiler: "spoiler_bmw",
    },
    colors: {
        base: { front_lights: "0xf4e972" }
    },
    properties: {
        speed: 800,
        boost_time: 0,
        boost_value: 1
    }
};