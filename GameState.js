import { DEFAULT_CAR_CONFIG } from "./GlobalAssets.js";
import { NotifScreen } from "./NotifScreen.js";
import { SceneStack } from "./Utils/SceneStack.js";

// Central, singleton gamestate. Scenes/UI read from this and call its
// mutator methods instead of touching plain fields directly.
export class GameState {
    constructor() {
        this.money = 0;

        //configState.exportConfig not the car or config instances itself
        this.ownedCars = [];
        this.activeCarIndex = 0;

        //add current city here later

        this.showTips = false;

        this._listeners = new Set();
    }

    setShowTips(v) {
        this.showTips = v;
        this._notify("showTips");
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

    spendMoney(amount, important = false, app = null, cb = null) {
        if (this.money < amount){
            if (!important || !app) return false;
            const notif = new NotifScreen(
                app,
                "DAMN YOUR BROKE!\nHere`s some money for you:\n\nYou got: $5000",
                "CONTINUE",
                () => {
                    GAMESTATE.addMoney(5000);
                    this.money -= amount;
                    SceneStack.popScene();
                    if (cb) cb();
                }
            );
            SceneStack.pushScene(notif, false);
            return true;
        }
        this.money -= amount;
        this._notify("money");
        if (cb) cb();
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
            ownedCars: this.ownedCars,
            activeCarIndex: this.activeCarIndex
        };
    }

    importSave(data) {
        this.money = data.money ?? 0;
        this.ownedCars = data.ownedCars ?? [];
        this.activeCarIndex = data.activeCarIndex ?? 0;
        this.showTips = data.showTips;
        this._notify("all");
    }

    //loads players gamestate from server (to be implemented) otherwise has a fallback, also used for new players
    loadState() {
        //get it from server

        //fallback
        const data = {
            money: 5000,
            ownedCars: [ DEFAULT_CAR_CONFIG ],
            activeCarIndex: 0,
            showTips: true,
        }

        this.importSave(data);
    }
}

export const GAMESTATE = new GameState();