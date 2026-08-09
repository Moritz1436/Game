

// Central, singleton gamestate. Scenes/UI read from this and call its
// mutator methods instead of touching plain fields directly.
export class GameState {
    constructor() {
        this.money = 0;

        //configState.exportConfig not the car or config instances itself
        this.ownedCars = [];
        this.activeCarIndex = 0;

        this._listeners = new Set();
    }

    getCurrentCarConfig() {
        return this.ownedCars[this.activeCarIndex] ?? {};
    }

    setActiveIndex(idx) {
        this.activeCarIndex = idx;
    }

    updateCarConfig(newConfig) {
        this.ownedCars[this.activeCarIndex] = newConfig;
        this._notify("ownedCar");
    }

    addMoney(amount) {
        this.money = Math.max(0, this.money + amount);
        this._notify("money");
    }

    spendMoney(amount) {
        if (this.money < amount) return false;
        this.money -= amount;
        this._notify("money");
        return true;
    }

    // listener gets called with (field, gameState) whenever a field changes. field can be "money", "ownedCar", "all", ...
    //returns func to remove listener
    onChange(listener) {
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    _notify(field) {
        for (const listener of this._listeners) listener(field, this);
    }

    exportSave() {
        return {
            money: this.money,
            ownedCars: this.ownedCars
        };
    }

    importSave(data) {
        this.money = data.money ?? 0;
        this.ownedCars = data.ownedCars ?? [];
        this._notify("all");
    }
}

export const GAMESTATE = new GameState();