import { computeScaleForWidth, ROT_X_TO_NEGZ, rotationY, rotationZ } from "../Car/CarUtils.js";
import { RoadManager } from "./RoadManager.js";
import { NotifScreen } from "../NotifScreen.js";
import { SceneStack } from "../Utils/SceneStack.js";
import { GAMESTATE } from "../GameState.js";


export class EnemyCarManager {
    ///@param camera
    ///@param carManager - bestehende CarManager-Instanz
    ///@param assetManager
    ///@param defaultConfig - Config, die JEDES Enemy-Auto bekommt
    ///@param options - { carWidth, laneCount, roadWidth, spawnDistance, despawnMargin, spawnInterval, spawnIntervalJitter, baseSpeed, addSpeed }
    constructor(app, driveScene, camera, carManager, assetManager, defaultConfig, options = {}) {
        this.app = app;
        this.driveScene = driveScene;
        this.camera = camera;
        this.carManager = carManager;
        this.assetManager = assetManager;
        this.defaultConfig = defaultConfig;

        this.laneCount = options.laneCount ?? 3;
        this.roadWidth = options.roadWidth ?? RoadManager.width * 0.8624;
        this.carWidth = options.carWidth ?? ((this.roadWidth * 2) / this.laneCount) * 0.8;
        this.spawnDistance = options.spawnDistance ?? 3000;   // world units vor der Kamera (Horizont)
        this.despawnMargin = options.despawnMargin ?? 200;    // world units hinter der Kamera
        this.spawnInterval = options.spawnInterval ?? 2.0;
        this.spawnIntervalJitter = options.spawnIntervalJitter ?? 1.0;

        this.baseSpeed = options.baseSpeed ?? 80;
        this.addSpeed = options.addSpeed ?? 60;

        //for car spawning if its not null
        this.maxZ = options.maxZ ?? null;

        const baseAsset = this.assetManager.getAssetByName(defaultConfig.base);
        this.scale = computeScaleForWidth(baseAsset, this.carWidth);

        this._enemyData = new Map(); // Car -> { speed, lane }
        this._spawnTimer = this._nextSpawnDelay();

        this._inCollision = false;
    }

    _nextSpawnDelay() {
        return this.spawnInterval + Math.random() * this.spawnIntervalJitter;
    }

    _laneX(laneIndex) {
        const laneWidth = this.roadWidth / this.laneCount;
        const firstCenter = -this.roadWidth / 2 + laneWidth / 2;
        return firstCenter + laneIndex * laneWidth;
    }

    _spawnOne() {
        const lane = Math.floor(Math.random() * this.laneCount);
        const spawnZ = this.camera.pos3d.z - this.spawnDistance;

        if (this.maxZ != null && spawnZ < this.maxZ) return;

        const pos3d = {
            x: this._laneX(lane),
            y: 0,
            z: this.camera.pos3d.z - this.spawnDistance,
        };

        const config = structuredClone(this.defaultConfig);
        const car = this.carManager.spawnEnemyCar(config, pos3d, this.scale);
        car.rotate(ROT_X_TO_NEGZ);
        car.repositionToGround();
        car.initWheelState();

        const speed = this.baseSpeed + Math.random() * this.addSpeed;
        this._enemyData.set(car, { speed, lane });
    }

    update(dt) {
        // ---- Spawnen ----
        this._spawnTimer -= dt;
        if (this._spawnTimer <= 0) {
            this._spawnOne();
            this._spawnTimer = this._nextSpawnDelay();
        }

        // ---- Bewegen (nur -z) + Despawnen hinter der Kamera ----
        for (const car of [...this._enemyData.keys()]) {
            const data = this._enemyData.get(car);

            const pos = { ...car.pos3d };
            const moveAmount = data.speed * dt;
            pos.z -= moveAmount;
            car.setPosition(pos);
            car.updateWheels(dt, moveAmount, 0);

            if (pos.z > this.camera.pos3d.z + this.despawnMargin || pos.z < this.maxZ) {
                this.carManager.destroyCar(car);
                this._enemyData.delete(car);
            }
        }

        // ---- Kollisionen: erstmal nur loggen ----
        const collisions = this.carManager.checkCollisions();
        if (collisions.length > 0) {
            if (!this._inCollision) {
                this.driveScene.stopCar();
                const notif = new NotifScreen(
                    this.app,
                    "ACCIDENT!\nYou’ve been involved in a collision. Your car needs a quick repair before you can continue.\n\nRepair Cost: $500\n\nYour Balance: $" + `${GAMESTATE.money}`,
                    "PAY & CONTINUE",
                    () => {
                        SceneStack.popScene();
                        GAMESTATE.spendMoney(500, true, this.app, () => {
                            this.driveScene.unstopCar();
                            this._inCollision = false;
                            for (const car of collisions){
                                this.carManager.destroyCar(car);
                                this._enemyData.delete(car);
                            }
                        });
                    }
                );
                SceneStack.pushScene(notif, false);
                this._inCollision = true;
            }
        }
    }

    destroy() {
        for (const car of this._enemyData.keys()) {
            this.carManager.destroyCar(car);
        }
        this._enemyData.clear();
    }
}