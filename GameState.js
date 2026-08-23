import { DEFAULT_CAR_CONFIG } from "./GlobalAssets.js";
import { NotifScreen } from "./NotifScreen.js";
import { SceneStack } from "./Utils/SceneStack.js";
import { CITY_FEATURES } from "./Map/Palette.js";
import { QUEST_TYPES } from "./Quest/Quests.js";

// Central, singleton gamestate. Scenes/UI read from this and call its
// mutator methods instead of touching plain fields directly.
export class GameState {
    constructor() {
        this.money = 0;

        //configState.exportConfig not the car or config instances itself
        this.ownedCars = [];
        this.activeCarIndex = 0;

        this.currentCityIndex = null; //idx in city array
        this.cityFeatureOverrides = {}; // { [cityIndex]: { feature: string|null, respawnAt: number|null } }

        this.showTips = false;
        this.activeQuest = null;
        this.originalSpeed = 0;

        this._listeners = new Set();
    }

    completeCityFeature(cityIndex, cooldownMs = 2 * 60 * 1000) {
        this.cityFeatureOverrides[cityIndex] = {
            feature: null,
            respawnAt: Date.now() + cooldownMs,
        };
    }
    
    _restoreCarSpeedIfNeeded() {
        if (this.activeQuest?.type === QUEST_TYPES.DELIVER_HEAVY && this.originalSpeed) {
            const config = this.getCurrentCarConfig();
            config.properties.speed.value += this.originalSpeed;
            this.originalSpeed = 0;
        }
    }

    abandonQuest() {
        this._restoreCarSpeedIfNeeded();
        this.activeQuest = null;
    }

    completeActiveQuest() {
        this._restoreCarSpeedIfNeeded();
        this.activeQuest = null;
    }

    failActiveQuest() {
        this._restoreCarSpeedIfNeeded();
        this.activeQuest = null;
    }

    acceptQuest(quest, currentCityIndex) {
        if (quest.type === QUEST_TYPES.DELIVER_HEAVY) {
            const config = this.getCurrentCarConfig();
            this.originalSpeed = config.properties.speed.value * 0.2;
            config.properties.speed.value -= this.originalSpeed;
        }

        this.activeQuest = {
            ...quest,
            acceptedFromCityIndex: currentCityIndex,
            progress: 0,
            startedAt: Date.now(),
            expiresAt: Date.now() + quest.expiryMs,
        };
    }

    applyCityFeatureOverrides(cities) {
        const now = Date.now();
        for (let i = 0; i < cities.length; i++) {
            const override = this.cityFeatureOverrides[i];
            if (!override) continue;

            const canRespawn = override.feature === null
                && override.respawnAt != null
                && now >= override.respawnAt;

            if (canRespawn) {
                const newFeature = CITY_FEATURES[Math.floor(Math.random() * CITY_FEATURES.length)];
                override.feature = newFeature;
                override.respawnAt = null;
                cities[i].feature = newFeature;
            } else {
                cities[i].feature = override.feature;
            }
        }
    }

    setCurrentCity(cityIdx){
        this.currentCityIndex = cityIdx;
    }

    clearCurrentCity() {
        this.currentCityIndex = null;
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
            if (!important || !app){
                if (cb) cb(false);
                return false;
            }
            const notif = new NotifScreen(
                app,
                "DAMN YOUR BROKE!\nHere`s some money for you:\n\nYou got: $5000",
                "CONTINUE",
                () => {
                    GAMESTATE.addMoney(5000);
                    this.money -= amount;
                    SceneStack.popScene();
                    if (cb) cb(true);
                }
            );
            SceneStack.pushScene(notif, false);
            return true;
        }
        this.money -= amount;
        this._notify("money");
        if (cb) cb(true);
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
            activeCarIndex: this.activeCarIndex,
            showTips: this.showTips,
            city: this.currentCityIndex,
        };
    }

    importSave(data) {
        this.money = data.money ?? 0;
        this.ownedCars = data.ownedCars ?? [];
        this.activeCarIndex = data.activeCarIndex ?? 0;
        this.showTips = data.showTips;
        this.currentCityIndex = data.city;
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
            city: 0,
        }

        this.importSave(data);
    }
}

export const GAMESTATE = new GameState();