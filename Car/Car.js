import { Object3D } from "../World3D/Object3D.js";
import { CarPieceInstance } from "./CarPieceInstance.js";
import { aabbOverlap } from "../World3D/Utils/BoundsUtils.js";
import { DebugOutline } from "../World3D/DebugOutline.js";
import { computeScaleForWidth, ROT_X_TO_NEGZ, shrinkBounds } from "./CarUtils.js";
import { rotationY, rotationZ, mat3Mul } from "../World3D/Utils/Mat3Utils.js";

const WHEEL_SOCKETS = ["socket_tire_FR", "socket_tire_FL", "socket_tire_RL", "socket_tire_RR"];
const FRONT_WHEEL_SOCKETS = new Set(["socket_tire_FR", "socket_tire_FL"]);

function rgbaToHex(rgba) {
    const r = Math.round(rgba[0] * 255);
    const g = Math.round(rgba[1] * 255);
    const b = Math.round(rgba[2] * 255);
    return (r << 16) | (g << 8) | b;
}

// only bases have sockets.
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

    constructor(layer, assetManager, config, pos3d, scale = 30, lightManager = null) {
        super(pos3d, { x: 0, y: 0, z: 0 });

        this.layer = layer;
        this.assetManager = assetManager;
        this.scale = scale;
        this.lightManager = lightManager;

        // properties: {
        //     speed: { value: 80, increase: 5, level: 0, maxLevel: 20, cost: 1000 },
        //     boost_time: { value: 3, increase: 0.5, level: 0, maxLevel: 5, cost: 800 },
        //     boost_value: { value: 1.5, increase: 0.1, level: 0, maxLevel: 5, cost: 800 },
        //     boost_cooldown: { value: 8, increase: -0.5, level: 0, maxLevel: 10, cost: 300 },
        // }
        // value = current value
        // increase = value += increase
        this.properties = {};

        this.lod = 'high';
        this.rootPiece = null;

        this.importConfig(config);
    }

    ///@brief upgrades a property by one level, if not already maxed. Free (no cost) for now.
    ///@returns true if upgraded, false if maxLevel reached or property unknown
    upgradeProperty(key) {
        const prop = this.properties[key];
        if (!prop || prop.level >= prop.maxLevel) return false;
        prop.value += prop.increase;
        prop.level += 1;
        return true;
    }

    ///@returns the value the property would have after the next upgrade, or null if maxed/unknown
    getPropertyNextValue(key) {
        const prop = this.properties[key];
        if (!prop || prop.level >= prop.maxLevel) return null;
        return prop.value + prop.increase;
    }

    getWorldAABB() { return this.rootPiece.getWorldAABB(); }

    _getPosition() {
        const myBounds = this.rootPiece.getWorldAABB();
        const yOffset = -myBounds.min.y * this.scale;
        return { ...this.pos3d, y: yOffset };
    }

    importConfig(config) {
        const MIRRORED_SOCKETS = new Set(["socket_tire_fr", "socket_tire_rr"]);
        this.currentConfig = structuredClone(config);

        if (this.rootPiece) this.rootPiece.destroy();

        const baseAsset = this.assetManager.getAssetByName(config.base);
        this.rootPiece = new CarPieceInstance(baseAsset, this.layer, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, this.scale, false, this.lightManager);
        
        for (const [socketName, partName] of Object.entries(config.parts ?? {})) {
            const partAsset = this.assetManager.getAssetByName(partName);
            if (!partAsset) continue;
            
            const mirrored = MIRRORED_SOCKETS.has(socketName.toLowerCase());
            const piece = new CarPieceInstance(partAsset, this.layer, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 1, mirrored, this.lightManager);
            this.rootPiece.attachChild(socketName, piece);
        }

        for (const [type, modValues] of Object.entries(config.modifierValues ?? {})) {
            for (const piece of this.getPiecesByType(type)) {
                piece.importModifierValues(modValues);
            }
        }

        for (const [type, meshColors] of Object.entries(config.colors ?? {})) {
            if (type === "base") {
                this.applyPieceColors(this.rootPiece, meshColors);
                continue;
            }

            const pieces = this.getPiecesByType(type);

            for (const piece of pieces) {
                this.applyPieceColors(piece, meshColors);
            }
        }

        for (const [type, meshMaterials] of Object.entries(config.materials ?? {})) {
            if (type === "base") {
                this.applyPieceMaterials(this.rootPiece, meshMaterials);
                continue;
            }

            const pieces = this.getPiecesByType(type);

            for (const piece of pieces) {
                this.applyPieceMaterials(piece, meshMaterials);
            }
        }

        this.properties = config.properties;
        
        this.rootPiece.updateWorldTransform();
        
        const pos = this._calculateGroundPosition();
        this.rootPiece.setLocalPosition(pos);
        this.pos3d = pos;

        this._refreshDebugShape();
    }

    replacePart(type, pieceName, modifierValues = null) {
        if (!this.rootPiece) return;

        const MIRRORED_SOCKETS = new Set([
            "socket_tire_fr",
            "socket_tire_rr"
        ]);

        const baseAsset = this.rootPiece.asset;

        const sockets = baseAsset.sockets.filter(
            socket => socket.type === type
        );

        if (sockets.length === 0) {
            console.warn(`Car: no sockets of type "${type}" found`);
            return;
        }

        const partAsset = pieceName
            ? this.assetManager.getAssetByName(pieceName)
            : null;

        if (pieceName && !partAsset) {
            console.warn(`Car: part "${pieceName}" not found`);
            return;
        }

        for (const socket of sockets) {
            const socketName = socket.name;
            const oldPiece = this.rootPiece.children.get(socketName);

            // Altes Part entfernen.
            if (oldPiece) {
                oldPiece.destroy();
                this.rootPiece.children.delete(socketName);
            }

            // null = Part entfernen
            if (!partAsset) {
                continue;
            }

            const mirrored = MIRRORED_SOCKETS.has(
                socketName.toLowerCase()
            );

            const piece = new CarPieceInstance(
                partAsset,
                this.layer,
                { x: 0, y: 0, z: 0 },
                { x: 0, y: 0, z: 0 },
                1,
                mirrored,
                this.lightManager
            );

            const attached = this.rootPiece.attachChild(
                socketName,
                piece
            );

            if (!attached) {
                piece.destroy();
                continue;
            }

            const colors = this.currentConfig?.colors?.[socketName];
            this.applyPieceColors(piece, colors);

            const materials = this.currentConfig?.materials?.[socketName];
            this.applyPieceMaterials(piece, materials);
        }

        if (modifierValues) {
            for (const piece of this.getPiecesByType(type)) {
                piece.importModifierValues(modifierValues);
            }
        }

        this.rootPiece.updateWorldTransform();

        this.repositionToGround();
        this._refreshDebugShape();

        if (this.wheelSockets) this.initWheelState(this.maxSteeringAngle, this.steeringSpeed);
    }

    setPieceMeshColor(pieceKey, meshName, colorHex) {
        const piece = pieceKey === "base"
            ? this.rootPiece
            : this._getPiece(pieceKey);

        if (!piece) {
            console.warn(`Car: piece "${pieceKey}" not found`);
            return;
        }

        console.log(`setting ${pieceKey}'s ${meshName} to ${colorHex}`);

        piece.setMeshBaseColor(meshName, colorHex);
    }

    showDebugOutline(layer, color = [1, 0, 0]) {
        if (!this.debugOutline) {
            this.debugOutline = new DebugOutline(layer, color);
            this._refreshDebugShape();
            this._syncDebugTransform();
        }
        return this.debugOutline;
    }

    hideDebugOutline() {
        if (this.debugOutline) {
            this.debugOutline.destroy();
            this.debugOutline = null;
        }
    }

    //when the bounds change
    _refreshDebugShape() {
        if (this.debugOutline) this.debugOutline.rebuildShape(this.rootPiece.getLocalAABB());
    }

    _syncDebugTransform() {
        if (this.debugOutline) this.debugOutline.setTransform(this.rootPiece.pos3d, this.rootPiece.rotationMatrix);
    }

    _getPieceBySocketName(name, piece = null) {
        if (!piece) piece = this.rootPiece;

        for (const [socketName, child] of piece.children) {
            if (socketName === name) return child;
            const t = this._getPieceBySocketName(name, child);
            if (t) return t;
        }

        return null;
    }

    _getPiece(piece) {
        if (!this.rootPiece) return null;
        if (!piece) return this.rootPiece;
        const p = this._getPieceBySocketName(piece);
        if (!p) console.warn(`socket ${piece} not found!`);
        return p;
    }

    getPiecesByType(type) {
        const pieces = [];

        const collect = (piece) => {
            if (piece.asset.type === type) {
                pieces.push(piece);
            }

            for (const child of piece.children.values()) {
                collect(child);
            }
        };

        if (this.rootPiece) {
            collect(this.rootPiece);
        }

        return pieces;
    }

    ///@brief rotates the rootpiece, localRotationMatrix *= rot
    ///@param rot: 3x3 matrix
    ///@param piece: name of the piece, null => root
    rotate(rot, piece = null) {
        const target = this._getPiece(piece);
        if (!target) return;
        target.rotate(rot);
    }

    ///@param rot: 3x3 matrix
    ///@param piece: name of the piece, null => root
    setRotation(mat, piece = null) {
        const target = this._getPiece(piece);
        if (!target) return;
        target.setExternalRotation(mat);

        if (!piece) this._syncDebugTransform();
    }

    ///@param piece: name of the piece, null => root
    getRotation(piece = null) {
        const target = this._getPiece(piece);
        if (!target) return;
        return target.getExternalRotation();
    }

    ///@param piece: name of the piece, null => root
    getLocalBounds(piece = null) {
        const target = this._getPiece(piece);
        if (!target) return;
        return target.getLocalAABB();
    }

    _calculateGroundPosition() {
        if (!this.rootPiece) {
            return { x: 0, y: 0, z: 0 };
        }
        
        const myBounds = this.rootPiece.getLocalAABB();
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

        this._syncDebugTransform();
    }

    exportConfig() {
        const config = { base: this.rootPiece.asset.pieceName, parts: {}, colors: {}, materials: {}, properties: this.properties };

        config.colors["base"] = this.exportPieceColors(this.rootPiece);
        config.materials["base"] = this.exportPieceMaterials(this.rootPiece);
        for (const [socketName, child] of this.rootPiece.children) {
            config.parts[socketName] = child.asset.pieceName;
            config.colors[socketName] = this.exportPieceColors(child);
            config.materials[socketName] = this.exportPieceMaterials(child);
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

    exportPieceMaterials(piece) {
        const overrides = {};
        for (const meshEntry of piece.meshes) {
            const currentMetallic = meshEntry.mesh.shader.resources.uMaterial.uniforms.uMetallic;
            const currentRoughness = meshEntry.mesh.shader.resources.uMaterial.uniforms.uRoughness;
            const defaultEntry = piece.asset.meshes.find(m => m.name === meshEntry.name);
            if (!defaultEntry) continue;

            const defaultMetallic = defaultEntry.metallic ?? 1.0;
            const defaultRoughness = defaultEntry.roughness ?? 1.0;

            const metallicChanged = Math.abs(currentMetallic - defaultMetallic) > 0.001;
            const roughnessChanged = Math.abs(currentRoughness - defaultRoughness) > 0.001;

            if (metallicChanged || roughnessChanged) {
                overrides[meshEntry.name] = {
                    metallic: metallicChanged ? currentMetallic : undefined,
                    roughness: roughnessChanged ? currentRoughness : undefined,
                };
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

    applyPieceMaterials(piece, meshMaterials) {
        if (!meshMaterials) return;
        for (const [meshName, mat] of Object.entries(meshMaterials)) {
            if (mat.metallic !== undefined) piece.setMeshMetallic(meshName, mat.metallic);
            if (mat.roughness !== undefined) piece.setMeshRoughness(meshName, mat.roughness);
        }
    }

    // TODO: needs LOD variants per CarPieceAsset to actually swap geometry.
    // Not implemented yet - stub for now, same pattern as ObjectManager's
    // per-chunk LOD swap once part LOD variants exist.
    changeLOD(lod) {
        this.lod = lod;
    }

    setPosition(pos3d) {
        this.pos3d = pos3d;
        this.rootPiece.setLocalPosition(this.pos3d); // cascades to every attached part
        this._syncDebugTransform();
    }

    checkCollision(otherCars, hitboxFactor = 0.9) {
        const myBounds = shrinkBounds(this.rootPiece.getWorldAABB(), hitboxFactor);
        return otherCars.filter(other =>
            other !== this && aabbOverlap(myBounds, shrinkBounds(other.rootPiece.getWorldAABB(), hitboxFactor))
        );
    }

    destroy() {
        this.hideDebugOutline();
        this.rootPiece.destroy();
    }

    ///@brief Captures the current rotation as baseline for wheel rolling/steering.
    ///Call AFTER the car's initial orientation (rotate()) and grounding (repositionToGround()). 
    // Also call again after replacePart() if a tire piece changed size/shape.
    initWheelState(maxSteeringAngle = 0.21, steeringSpeed = 8) {
        this.baseRot = this.getRotation();

        this.wheelSockets = WHEEL_SOCKETS.filter(name => this._getPieceBySocketName(name));
        this.frontWheelSockets = new Set(this.wheelSockets.filter(name => FRONT_WHEEL_SOCKETS.has(name)));

        this.wheelRotations = {};
        for (const name of this.wheelSockets) {
            this.wheelRotations[name] = this.getRotation(name);
        }

        this.wheelRadius = 0;
        if (this.wheelSockets.length > 0) {
            const wheelPiece = this._getPieceBySocketName(this.wheelSockets[0]);
            const rawBounds = wheelPiece.asset.bounds;
            this.wheelRadius = (rawBounds.max.y - rawBounds.min.y) * 0.5 * this.scale;
        }

        this.maxSteeringAngle = maxSteeringAngle;
        this.steeringSpeed = steeringSpeed;
        this.steeringAngle = 0;
        this.steeringTarget = 0;
    }

    ///@param dt - seconds
    ///@param distanceMoved - forward world-units traveled this frame (positive = forward), drives wheel roll
    ///@param steeringInput - -1..1, 0 = geradeaus
    updateWheels(dt, distanceMoved, steeringInput = 0) {
        if (!this.wheelSockets || this.wheelSockets.length === 0) return;

        this.steeringTarget = steeringInput * this.maxSteeringAngle;
        const steeringFollow = 1 - Math.exp(-this.steeringSpeed * dt);
        this.steeringAngle += (this.steeringTarget - this.steeringAngle) * steeringFollow;

        const bodyRot = rotationY(-this.steeringAngle);

        const wheelRotation = this.wheelRadius > 0 ? (distanceMoved / this.wheelRadius) : 0;
        const rotWheel = rotationZ(-wheelRotation);

        for (const name of this.wheelSockets) {
            this.wheelRotations[name] = mat3Mul(rotWheel, this.wheelRotations[name]);

            let finalRot = this.wheelRotations[name];

            if (this.frontWheelSockets.has(name)) {
                const piece = this._getPieceBySocketName(name);
                // Y-Rotation kehrt sich bei gespiegelten Pieces um (mirrorZ
                // spiegelt Z -> Rotationen um X/Y invertieren sich, Z bleibt gleich)
                const steeringAngleForWheel = piece?.mirrored ? -this.steeringAngle : this.steeringAngle;
                const steeringRot = rotationY(-steeringAngleForWheel);
                finalRot = mat3Mul(steeringRot, finalRot);
            }

            this.setRotation(finalRot, name);
        }

        this.setRotation(mat3Mul(this.baseRot, bodyRot));
    }

}