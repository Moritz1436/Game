import { ModelInstance } from "../Models/ModelInstance.js";
import { eulerToMat3, mat3Mul, mirrorZ, mat3TransformVec3, IDENTITY_MAT3 } from "../World3D/Utils/Mat3Utils.js";
import { transformBounds, mergeBounds } from "../World3D/Utils/BoundsUtils.js";

const DEG2RAD = Math.PI / 180;
const AXES = ['x', 'y', 'z'];

// One node in a car's part tree (base -> tire -> ... -> anything attached
// to that). Transform is stored LOCAL to the parent (root piece: local IS
// world). World pos/rotation/scale are only recomputed when something
// actually changes (attach/detach/move/rotate), not every frame - rendering
// itself is handled entirely by your central camera/render system based on
// whatever pos3d/rotationMatrix/scale end up set on the underlying
// ModelInstance.
export class CarPieceInstance extends ModelInstance {

    constructor(asset, layer, localPos3d = { x: 0, y: 0, z: 0 }, localRot3d = { x: 0, y: 0, z: 0 }, localScale = 1, mirrored = false, lightManager = null) {
        const baseLocalRotMat = eulerToMat3(localRot3d);
        const localRotMat = mirrored ? mat3Mul(baseLocalRotMat, mirrorZ()) : baseLocalRotMat;
        super(asset, layer, { ...localPos3d }, localScale, localRotMat, lightManager);

        this.mirrored = mirrored;
        this.localPos3d = { ...localPos3d };
        this.localRotationMatrix = localRotMat;
        this.localScale = localScale;

        this.baseLocalPos3d = { ...localPos3d };
        this.baseLocalRotRad = { ...localRot3d };
        //external rotation
        this.extraRotationMatrix = IDENTITY_MAT3;

        this.modifierValues = {
            pos: { x: 0, y: 0, z: 0 },
            rot: { x: 0, y: 0, z: 0 },
        };

        this.parent = null;
        this.children = new Map();
    }

    attachChild(socketName, piece) {
        const socket = this.asset.sockets.find(s => s.name === socketName);
        if (!socket) {
            console.warn(`CarPieceInstance: socket "${socketName}" not found on "${this.asset.pieceName}"`);
            return false;
        }
        if (piece.asset.type !== socket.type) {
            console.warn(`CarPieceInstance: piece type "${piece.asset.type}" doesn't match socket type "${socket.type}"`);
            return false;
        }
        if (this.children.has(socketName)) {
            console.warn(`CarPieceInstance: socket "${socketName}" already occupied`);
            return false;
        }

        piece.parent = this;

        piece.baseLocalPos3d = { ...socket.pos };
        const socketRotDeg = socket.rot ?? { x: 0, y: 0, z: 0 };
        piece.baseLocalRotRad = {
            x: socketRotDeg.x * DEG2RAD,
            y: socketRotDeg.y * DEG2RAD,
            z: socketRotDeg.z * DEG2RAD,
        };

        piece._recomputeLocalTransform();
        this.children.set(socketName, piece);

        piece.updateWorldTransform();
        return true;
    }

    removeChild(socketName) {
        const child = this.children.get(socketName);
        if (!child) return;
        child.destroy();
        this.children.delete(socketName);
    }

    updateWorldTransform() {
        if (this.parent) {
            const parentRotMat = this.parent.rotationMatrix ?? IDENTITY_MAT3;
            const parentScale = this.parent.scale;

            const rotatedOffset = mat3TransformVec3(parentRotMat, this.localPos3d);
            const worldPos = {
                x: this.parent.pos3d.x + rotatedOffset.x * parentScale,
                y: this.parent.pos3d.y + rotatedOffset.y * parentScale,
                z: this.parent.pos3d.z + rotatedOffset.z * parentScale,
            };

            this.pos3d = worldPos;
            this.rotationMatrix = mat3Mul(parentRotMat, this.localRotationMatrix);
            this.scale = parentScale * this.localScale;
        } else {
            this.pos3d = { ...this.localPos3d };
            this.rotationMatrix = this.localRotationMatrix;
            this.scale = this.localScale;
        }

        this.setPosition(this.pos3d);
        this.setRotationMatrix(this.rotationMatrix);
        this.setScale(this.scale);

        for (const child of this.children.values()) {
            child.updateWorldTransform();
        }
    }

    setLocalRotation(localRot3d) {
        this.baseLocalRotRad = { ...localRot3d };
        this._recomputeLocalTransform();
        this.updateWorldTransform();
    }

    setLocalPosition(localPos3d) {
        this.baseLocalPos3d = { ...localPos3d };
        this._recomputeLocalTransform();
        this.updateWorldTransform();
    }

    _recomputeLocalTransform() {
        const posOffset = this.modifierValues.pos;
        this.localPos3d = {
            x: this.baseLocalPos3d.x + posOffset.x,
            y: this.baseLocalPos3d.y + posOffset.y,
            z: this.baseLocalPos3d.z + posOffset.z,
        };

        const rotOffset = this.modifierValues.rot;
        const combinedRotRad = {
            x: this.baseLocalRotRad.x + rotOffset.x * DEG2RAD,
            y: this.baseLocalRotRad.y + rotOffset.y * DEG2RAD,
            z: this.baseLocalRotRad.z + rotOffset.z * DEG2RAD,
        };

        const baseMat = eulerToMat3(combinedRotRad);
        const mirroredMat = this.mirrored ? mat3Mul(baseMat, mirrorZ()) : baseMat;
        this.localRotationMatrix = mat3Mul(mirroredMat, this.extraRotationMatrix);
    }

    getModifierRange(group, axis) {
        const typeMods = this.parent?.modifiers?.[this.asset.type];
        return typeMods?.[group]?.[axis] ?? null;
    }

    _mirrorModifierValue(group, axis, value) {
        if (!this.mirrored) return value;

        if (group === "rot") {
            return axis === "z" ? value : -value;
        }

        if (group === "pos") {
            return axis === "z" ? -value : value;
        }

        return value;
    }

    setModifierValue(group, axis, value) {
        const range = this.getModifierRange(group, axis);
        let clamped = 0;
        if (range) {
            const lo = Math.min(range.min, range.max);
            const hi = Math.max(range.min, range.max);
            clamped = Math.min(Math.max(value, lo), hi);
        }

        // Bei gespiegelten Pieces das Vorzeichen für die betroffene(n) Achse(n) umkehren
        const effective = this.mirrored ? this._mirrorModifierValue(group, axis, clamped) : clamped;

        this.modifierValues[group][axis] = effective;
        this._recomputeLocalTransform();
        this.updateWorldTransform();

        return clamped;
    }

    exportModifierValues() {
        const result = { pos: {}, rot: {} };
        for (const group of ['pos', 'rot']) {
            for (const axis of AXES) {
                const v = this.modifierValues[group][axis];
                if (v) result[group][axis] = v;
            }
        }
        return result;
    }

    importModifierValues(values = {}) {
        for (const group of ['pos', 'rot']) {
            const axes = values[group] ?? {};
            for (const axis of AXES) {
                if (axes[axis] !== undefined) this.setModifierValue(group, axis, axes[axis]);
            }
        }
    }

    getWorldAABB() {
        let bounds = transformBounds(this.asset.bounds, this.pos3d, this.scale, this.rotationMatrix);
        for (const child of this.children.values()) bounds = mergeBounds(bounds, child.getWorldAABB());
        return bounds;
    }

    getLocalAABB(originPos = { x: 0, y: 0, z: 0 }, parentScale = 1) {
        const scale = parentScale * this.localScale;
        const pos = this.parent
            ? {
                x: originPos.x + this.localPos3d.x * parentScale,
                y: originPos.y + this.localPos3d.y * parentScale,
                z: originPos.z + this.localPos3d.z * parentScale,
            }
            : originPos;

        let bounds = transformBounds(this.asset.bounds, pos, scale);
        for (const child of this.children.values()) bounds = mergeBounds(bounds, child.getLocalAABB(pos, scale));
        return bounds;
    }

    // Multipliziert eine zusätzliche Rotation auf die bestehende externe Rotation drauf
    // (z.B. einmaliges 90°-Drehen beim Spawnen). Bleibt unabhängig von Socket-Rotation/Modifiern erhalten.
    rotate(rotMat) {
        this.extraRotationMatrix = mat3Mul(this.extraRotationMatrix, rotMat);
        this._recomputeLocalTransform();
        this.updateWorldTransform();
    }

    // Setzt die externe Rotation absolut (überschreibt vorherige externe Rotation,
    // lässt Socket-Rotation/Modifier-Werte aber unangetastet).
    setExternalRotation(rotMat) {
        this.extraRotationMatrix = [...rotMat];
        this._recomputeLocalTransform();
        this.updateWorldTransform();
    }

    getExternalRotation() {
        return [...this.extraRotationMatrix];
    }

    destroy() {
        for (const child of this.children.values()) child.destroy();
        this.children.clear();
        super.destroy();
    }
}