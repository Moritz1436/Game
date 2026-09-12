// Holds the CURRENT car configuration as plain, serializable data - separate
// from the rendered Car/CarPieceInstance tree. This is the "source of truth"
// for save/load, UI selection state, etc. The rendered Car is just a
// projection of this state (via car.importConfig(state.exportConfig())).
// Car Specific!
export class CarConfigState {

    ///@param initialConfig - { base, parts: {socketName: pieceName}, colors: {...} }
    constructor(initialConfig) {
        this.data = {
            base: initialConfig.base,
            parts: { ...(initialConfig.parts ?? {}) },
            colors: structuredClone(initialConfig.colors ?? {}),
            materials: structuredClone(initialConfig.materials ?? {}),
            modifierValues: structuredClone(initialConfig.modifierValues ?? {}),
            properties: initialConfig.properties ?? {},
        };
    }

    setBase(pieceName) {
        this.data.base = pieceName;
    }

    // Sets `pieceName` on every socket of `type` that exists on `baseAsset`.
    // Pass pieceName=null to remove all parts of that type instead.
    setPartsForType(type, pieceName, baseAsset) {
        const sockets = baseAsset.sockets.filter(s => s.type === type);
        for (const socket of sockets) {
            if (pieceName == null) {
                delete this.data.parts[socket.name];
            } else {
                this.data.parts[socket.name] = pieceName;
            }
        }
    }

    removePartsForType(type, baseAsset) {
        this.setPartsForType(type, null, baseAsset);
    }

    // Returns the pieceName currently assigned to the FIRST socket of `type`
    // on baseAsset (used by the UI to show current selection - assumes all
    // sockets of the same type share the same variant, which is how the
    // simple UI applies changes via setPartsForType above).
    getPartForType(type, baseAsset) {
        const socket = baseAsset.sockets.find(s => s.type === type);
        if (!socket) return null;
        return this.data.parts[socket.name] ?? null;
    }

    setMeshColor(pieceKey, meshName, colorHex) {
        if (!this.data.colors[pieceKey]) this.data.colors[pieceKey] = {};
        this.data.colors[pieceKey][meshName] = colorHex;
    }

    getMeshColor(pieceKey, meshName) {
        return this.data.colors[pieceKey]?.[meshName] ?? null;
    }

    setMeshMaterial(pieceKey, meshName, { metallic, roughness } = {}) {
        if (!this.data.materials[pieceKey]) this.data.materials[pieceKey] = {};
        const existing = this.data.materials[pieceKey][meshName] ?? {};
        this.data.materials[pieceKey][meshName] = {
            metallic: metallic !== undefined ? metallic : existing.metallic,
            roughness: roughness !== undefined ? roughness : existing.roughness,
        };
    }

    getMeshMaterial(pieceKey, meshName) {
        return this.data.materials[pieceKey]?.[meshName] ?? null;
    }

    getMeshMetallic(pieceKey, meshName) {
        return this.getMeshMaterial(pieceKey, meshName)?.metallic ?? null;
    }

    getMeshRoughness(pieceKey, meshName) {
        return this.getMeshMaterial(pieceKey, meshName)?.roughness ?? null;
    }

    // group: "pos" | "rot", axis: "x" | "y" | "z"
    setModifierValue(socketName, group, axis, value) {
        if (!this.data.modifierValues[socketName]) {
            this.data.modifierValues[socketName] = { pos: {}, rot: {} };
        }
        this.data.modifierValues[socketName][group][axis] = value;
    }

    getModifierValue(socketName, group, axis) {
        return this.data.modifierValues[socketName]?.[group]?.[axis] ?? 0;
    }

    setModifierValues(type, values) {
        this.data.modifierValues[type] = structuredClone(values);
    }

    getModifierValues(type) {
        return this.data.modifierValues[type] ?? null;
    }

    exportConfig() {
        return structuredClone(this.data);
    }

    applyTo(car) {
        car.importConfig(this.exportConfig());
    }
}