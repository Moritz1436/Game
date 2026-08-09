import { Car } from "./Car.js";

export class CarManager {
    constructor(layer, assetManager) {
        this.layer = layer;
        this.assetManager = assetManager;

        this.playerCar = null;
        this.enemyCars = [];
    }

    spawnPlayerCar(config, pos3d, scale) {
        this.playerCar = new Car(this.layer, this.assetManager, config, pos3d, scale);
        return this.playerCar;
    }

    spawnEnemyCar(config, pos3d, scale) {
        const car = new Car(this.layer, this.assetManager, config, pos3d, scale);
        this.enemyCars.push(car);
        return car;
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