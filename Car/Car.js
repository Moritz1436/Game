import { Object3D } from "../World3D/Object3D.js";
import { CarPieceInstance } from "./CarPieceInstance.js";
import { aabbOverlap } from "../World3D/Utils/BoundsUtils.js";
import { mat3Mul } from "../World3D/Utils/Mat3Utils.js";

function rgbaToHex(rgba) {
    const r = Math.round(rgba[0] * 255);
    const g = Math.round(rgba[1] * 255);
    const b = Math.round(rgba[2] * 255);
    return (r << 16) | (g << 8) | b;
}

// only bases have sockets.
// objects pivot points:
// base: center
// tires: x,y: center, z: min bounds
// spoiler: 

// config shape:
// {
//   base: "sedan_base",
//   parts: { "socket_tire_FL": "tire_sport", socket_spoiler: "spoiler_big" },
//   colors: {
//     "base": {                          // "base": type of the piece, not the pieceName
//        "Karosserie_0_0": 0xd35400,     // "Karosserie_0_0": name of the mesh in the piece's JSON
//        "Chrom_1_0": 0xcccccc
//        // "Fenster_2_0" not named -> uses default from JSON
//     },
//     "socket_tire_FL": {
//        "Reifen_0_0": 0x222222
//     }
//   }
// }
export class Car extends Object3D {

    constructor(layer, assetManager, config, pos3d, scale = 30) {
        super(pos3d, { x: 0, y: 0, z: 0 });

        this.layer = layer;
        this.assetManager = assetManager;
        this.scale = scale;

        this.speed = 0;
        this.lod = 'high';
        this.rootPiece = null;

        this.importConfig(config);
    }

    _getPosition() {
        const myBounds = this.rootPiece.getWorldAABB();
        const yOffset = -myBounds.min.y * this.scale;
        return { ...this.pos3d, y: yOffset };
    }

    importConfig(config) {
        const MIRRORED_SOCKETS = new Set(["socket_tire_fr", "socket_tire_rr"]);

        if (this.rootPiece) this.rootPiece.destroy();

        const baseAsset = this.assetManager.getAssetByName(config.base);
        this.rootPiece = new CarPieceInstance(baseAsset, this.layer, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, this.scale);
        
        for (const [socketName, partName] of Object.entries(config.parts ?? {})) {
            const partAsset = this.assetManager.getAssetByName(partName);
            if (!partAsset) continue;
            
            const mirrored = MIRRORED_SOCKETS.has(socketName.toLowerCase());
            const piece = new CarPieceInstance(partAsset, this.layer, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 1, mirrored);
            this.rootPiece.attachChild(socketName, piece);
            this.applyPieceColors(piece, config.colors?.[socketName]);
        }
        
        this.rootPiece.updateWorldTransform();
        
        const pos = this._calculateGroundPosition();
        this.rootPiece.setLocalPosition(pos);
        this.pos3d = pos;

        this.applyPieceColors(this.rootPiece, config.colors?.["base"]);
    }

    ///@brief rotates the rootpiece, making it face this direction
    ///@param direction: "x", "-x", "y", "-y", "z", "-z", saying the matrix is already facing x
    rotateRoot(direction) {
        if (!this.rootPiece) return;
        let rot;

        switch (direction) {
            case "x":
                rot = [
                    1, 0, 0,
                    0, 1, 0,
                    0, 0, 1
                ];
                break;

            case "-x":
                rot = [
                    -1, 0, 0,
                    0, 1, 0,
                    0, 0, -1
                ];
                break;

            case "y":
                rot = [
                    0, -1, 0,
                    1,  0, 0,
                    0,  0, 1
                ];
                break;

            case "-y":
                rot = [
                    0, 1, 0,
                    -1, 0, 0,
                    0, 0, 1
                ];
                break;

            case "z":
                rot = [
                    0, 0, 1,
                    0, 1, 0,
                    -1, 0, 0
                ];
                break;

            case "-z":
                rot = [
                    0, 0, -1,
                    0, 1,  0,
                    1, 0,  0
                ];
                break;

            default:
                throw new Error(`Unknown direction: ${direction}`);
        }

        this.rootPiece.localRotationMatrix = mat3Mul(this.rootPiece.localRotationMatrix, rot);
        this.rootPiece.updateWorldTransform();
    }

    _calculateGroundPosition() {
        if (!this.rootPiece) {
            return { x: 0, y: 0, z: 0 };
        }
        
        const myBounds = this.rootPiece.getWorldAABB();
        const yOffset = -myBounds.min.y;

        return {
            x: this.pos3d?.x ?? 0,
            y: yOffset,
            z: this.pos3d?.z ?? 0
        };
    }
    
    repositionToGround() {
        if (!this.rootPiece) return;
        this.rootPiece.updateWorldTransform();
        
        const pos = this._calculateGroundPosition();
        this.rootPiece.setLocalPosition(pos);
        this.pos3d = pos;
    }

    exportConfig() {
        const config = { base: this.rootPiece.asset.pieceName, parts: {}, colors: {} };

        config.colors["base"] = this.exportPieceColors(this.rootPiece);
        for (const [socketName, child] of this.rootPiece.children) {
            config.parts[socketName] = child.asset.pieceName;
            config.colors[socketName] = this.exportPieceColors(child);
        }

        return config;
    }

    // Only exports meshes whose current color actually differs from the
    // model's own default baseColor - keeps configs small and makes it clear
    // which meshes were deliberately customized vs. left at default.
    exportPieceColors(piece) {
        const overrides = {};
        for (const meshEntry of piece.meshes) {
            const current = meshEntry.mesh.shader.resources.uMaterial.uniforms.uBaseColor;
            const defaultColor = piece.asset.meshes.find(m => m.name === meshEntry.name)?.baseColor;
            if (!defaultColor) continue;

            const changed = current.some((v, i) => Math.abs(v - defaultColor[i]) > 0.001);
            if (changed) {
                overrides[meshEntry.name] = rgbaToHex(current);
            }
        }
        return overrides;
    }

    // meshColors: optional { meshName: colorHex, ... }. Meshes NOT listed here
    // keep whatever baseColor came from the model JSON (the "default").
    applyPieceColors(piece, meshColors) {
        if (!meshColors) return; // no overrides at all for this piece -> everything stays default
        for (const [meshName, colorHex] of Object.entries(meshColors)) {
            piece.setMeshBaseColor(meshName, colorHex);
        }
    }

    // TODO: needs LOD variants per CarPieceAsset to actually swap geometry.
    // Not implemented yet - stub for now, same pattern as ObjectManager's
    // per-chunk LOD swap once part LOD variants exist.
    changeLOD(lod) {
        this.lod = lod;
    }

    move(delta) {
        this.pos3d.x += delta.x;
        this.pos3d.y += delta.y;
        this.pos3d.z += delta.z;

        this.rootPiece.setLocalPosition(this.pos3d); // cascades to every attached part
    }

    checkCollision(otherCars) {
        const myBounds = this.rootPiece.getWorldAABB();
        return otherCars.filter(other =>
            other !== this && aabbOverlap(myBounds, other.rootPiece.getWorldAABB())
        );
    }

    destroy() {
        this.rootPiece.destroy();
    }
}