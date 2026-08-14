// Holds the CURRENT car configuration as plain, serializable data - separate
// from the rendered Car/CarPieceInstance tree. This is the "source of truth"
// for save/load, UI selection state, etc. The rendered Car is just a
// projection of this state (via car.importConfig(state.exportConfig())).
export class CarConfigState {

    ///@param initialConfig - { base, parts: {socketName: pieceName}, colors: {...} }
    constructor(initialConfig) {
        this.data = {
            base: initialConfig.base,
            parts: { ...(initialConfig.parts ?? {}) },
            colors: structuredClone(initialConfig.colors ?? {}),
            properties: initialConfig.properties ?? {},
            unlockedParts: initialConfig.unlockedParts ?? []
        };
    }

    isPartUnlocked(pieceName) {
        return this.data.unlockedParts?.includes(pieceName) ?? false;
    }

    unlockPart(pieceName) {
        if (!this.data.unlockedParts) this.data.unlockedParts = [];
        if (!this.data.unlockedParts.includes(pieceName)) {
            this.data.unlockedParts.push(pieceName);
        }
    }

    setBase(pieceName) {
        this.data.base = pieceName;
        // NOTE: existing parts are left as-is. If the new base doesn't have a
        // matching socket name, CarPieceInstance.attachChild() will simply
        // warn and skip it on next applyTo() - not a crash, just a silent
        // drop of incompatible parts. Fine for now; revisit if that's
        // confusing in practice.
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

    exportConfig() {
        return structuredClone(this.data);
    }

    applyTo(car) {
        car.importConfig(this.exportConfig());
    }
}