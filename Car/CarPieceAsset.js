import { ModelLoader } from "../Models/ModelLoader.js";
import { ModelAsset } from "../Models/ModelAsset.js";
import { PART_DEFAULT_COST } from "../GlobalAssets.js";

/* JSON shape:

{
  "meshes": [
    {
      "texture": "assets/models/sedan_base.jpg",
      "vertices": [...],
      "uvs": [...],
      "indices": [...],
      "normals": [...]
    }
  ],
  "sockets": [
    {
      "name": "socket_tire_FL",
      "type": "tire",
      "pos": { "x": -0.82, "y": 0.0, "z": 1.35 }
    },
    {
      "name": "socket_tire_FR",
      "type": "tire",
      "pos": { "x": 0.82, "y": 0.0, "z": 1.35 }
    },
    {
      "name": "socket_tire_RL",
      "type": "tire",
      "pos": { "x": -0.82, "y": 0.0, "z": -1.35 }
    },
    {
      "name": "socket_tire_RR",
      "type": "tire",
      "pos": { "x": 0.82, "y": 0.0, "z": -1.35 }
    },
    {
      "name": "socket_spoiler",
      "type": "spoiler",
      "pos": { "x": 0.0, "y": 0.62, "z": -1.58 }
    }
  ],
  "requiredSocketTypes": [ "tire" ]
}

*/

// A single physical car part blueprint (chassis, a tire, a spoiler, ...).
// Adds a "type" (what kind of part this is, used to match sockets) and a
// unique "pieceName" (used in car configs to reference this exact part).
export class CarPieceAsset extends ModelAsset {
    constructor(data, type, pieceName) {
        super(data); // meshes + sockets (sockets come from named Empty nodes, see Converter.py)
        this.type = type;
        this.pieceName = pieceName;
        this.price = data.price ?? PART_DEFAULT_COST;
    }

    static load(path, type, pieceName) {
        return ModelLoader.load(path, (data) => new CarPieceAsset(data, type, pieceName));
    }
}