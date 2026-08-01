import { ModelInstance } from "../Models/ModelInstance.js";
import { eulerToMat3, mat3Mul, mirrorZ, mat3TransformVec3, IDENTITY_MAT3 } from "../World3D/Utils/Mat3Utils.js";
import { transformBounds, mergeBounds } from "../World3D/Utils/BoundsUtils.js";

// One node in a car's part tree (base -> tire -> ... -> anything attached
// to that). Transform is stored LOCAL to the parent (root piece: local IS
// world). World pos/rotation/scale are only recomputed when something
// actually changes (attach/detach/move/rotate), not every frame - rendering
// itself is handled entirely by your central camera/render system based on
// whatever pos3d/rotationMatrix/scale end up set on the underlying
// ModelInstance.
export class CarPieceInstance extends ModelInstance {

    ///@param asset - CarPieceAsset
    ///@param layer - render layer/container (passed straight to ModelInstance)
    ///@param localPos3d - position relative to parent (root: relative to car origin)
    ///@param localRot3d - rotation relative to parent, Euler radians
    ///@param localScale - scale relative to parent's effective scale (usually 1 for attached parts)
    ///@param mirrored - if true, the piece is mirrored along the X axis (used for left/right tires)
    constructor(asset, layer, localPos3d = { x: 0, y: 0, z: 0 }, localRot3d = { x: 0, y: 0, z: 0 }, localScale = 1, mirrored = false) {
        const baseLocalRotMat = eulerToMat3(localRot3d);
        const localRotMat = mirrored ? mat3Mul(baseLocalRotMat, mirrorZ()) : baseLocalRotMat;
        super(asset, layer, { ...localPos3d }, localScale, localRotMat);

        this.localPos3d = { ...localPos3d };
        this.localRotationMatrix = localRotMat;
        this.localScale = localScale;

        this.parent = null;
        this.children = new Map(); // socketName -> CarPieceInstance

        this.boundsChanged = true;
        this.cachedAABB = null;
    }

    // Attach a child into one of this piece's sockets. Fails (with a
    // console warning) if the socket doesn't exist, the piece's type
    // doesn't match what the socket accepts, or the socket is occupied.
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
        piece.localPos3d = { ...socket.pos };
        this.children.set(socketName, piece);

        piece.updateWorldTransform();
        this.invalidateBoundsUpward();
        return true;
    }

    removeChild(socketName) {
        const child = this.children.get(socketName);
        if (!child) return;

        child.destroy();
        this.children.delete(socketName);
        this.invalidateBoundsUpward();
    }

    // Recompute this piece's world transform from the parent's current world
    // transform + this piece's local offset, then cascade to children.
    // Call after attaching/moving/rotating - not per frame.
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
            // root piece: local IS world
            this.pos3d = { ...this.localPos3d };
            this.rotationMatrix = this.localRotationMatrix;
            this.scale = this.localScale;
        }

        // Push the freshly computed world transform to whatever your base
        // ModelInstance/render system expects.
        this.setPosition(this.pos3d);
        this.setRotationMatrix(this.rotationMatrix);
        this.setScale(this.scale);

        for (const child of this.children.values()) {
            child.updateWorldTransform();
        }
    }

    // Change this piece's local rotation (e.g. a spinning wheel, a steered
    // front axle) and re-cascade immediately.
    setLocalRotation(localRot3d) {
        this.localRotationMatrix = eulerToMat3(localRot3d);
        this.updateWorldTransform();
    }

    setLocalPosition(localPos3d) {
        this.localPos3d = { ...localPos3d };
        this.updateWorldTransform();
    }

    invalidateBoundsUpward() {
        this.boundsChanged = true;
        this.cachedAABB = null;
        if (this.parent) this.parent.invalidateBoundsUpward();
    }

    // World-space AABB of this piece plus all children, cached until
    // something structural changes anywhere in the subtree.
    getWorldAABB() {
        if (this.cachedAABB && !this.boundsChanged) return this.cachedAABB;

        let bounds = transformBounds(this.asset.bounds, this.pos3d, this.scale);
        for (const child of this.children.values()) {
            bounds = mergeBounds(bounds, child.getWorldAABB());
        }

        this.cachedAABB = bounds;
        this.boundsChanged = false;
        return bounds;
    }

    destroy() {
        for (const child of this.children.values()) child.destroy();
        this.children.clear();
        super.destroy();
    }
}