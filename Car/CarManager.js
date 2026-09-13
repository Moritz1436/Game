import { Car } from "./Car.js";

export class CarManager {
    constructor(layer, assetManager, lightManager) {
        this.layer = layer;
        this.assetManager = assetManager;
        this.lightManager = lightManager;

        this.debugLayer = null;

        this.playerCar = null;
        this.enemyCars = [];
    }

    spawnPlayerCar(config, pos3d, scale) {
        this.playerCar = new Car(this.layer, this.assetManager, config, pos3d, scale, this.lightManager);
        if (this.debugLayer != null) {
            this.playerCar.showDebugOutline(this.debugLayer);
        }
        return this.playerCar;
    }

    spawnEnemyCar(config, pos3d, scale) {
        const car = new Car(this.layer, this.assetManager, config, pos3d, scale, this.lightManager);
        this.enemyCars.push(car);
        if (this.debugLayer != null) {
            car.showDebugOutline(this.debugLayer);
        }
        return car;
    }

    showDebugOutlines(layer) {
        this.debugLayer = layer;
        this.playerCar?.showDebugOutline(layer);
        for (const c of this.enemyCars){
            c.showDebugOutline(layer);
        }
    }

    hideDebugOutlines() {
        this.debugLayer = null;
        this.playerCar?.hideDebugOutline();
        for (const c of this.enemyCars){
            c.hideDebugOutline();
        }
    }

    destroyCar(car) {
        car.destroy();
        if (car === this.playerCar) {
            this.playerCar = null;
        } else {
            this.enemyCars = this.enemyCars.filter(c => c !== car);
        }
    }

    checkCollisions() {
        if (!this.playerCar) return [];
        return this.playerCar.checkCollision(this.enemyCars);
    }

    destroy() {
        this.playerCar?.destroy();
        for (const car of this.enemyCars) car.destroy();
        this.playerCar = null;
        this.enemyCars = [];
    }
}