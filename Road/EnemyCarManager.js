import { computeScaleForWidth, ROT_X_TO_NEGZ } from "../Car/CarUtils.js";
import { rotationY, rotationZ } from "../World3D/Utils/Mat3Utils.js";
import { RoadManager } from "./RoadManager.js";
import { NotifScreen } from "../NotifScreen.js";
import { SceneStack } from "../Utils/SceneStack.js";
import { GAMESTATE } from "../GameState.js";
import { ToastManager } from "../ToastManager.js";

const ENEMY_BASE_COLORS = [
    0x1A1A1E, // jet black
    0x2B2E33, // gunmetal
    0x4A4E57, // slate gray
    0x8C9096, // silver
    0xC7C9CC, // pearl silver
    0xF5F3EF, // pearl white
    0xE8E4DB, // champagne
    0x7A2E2E, // deep crimson
    0xB5443C, // burnt orange-red
    0x1E3A5F, // midnight blue
    0x2F6690, // ocean blue
    0x2E4A3D, // British racing green
    0x5C6B47, // olive drab
    0x6B4A2E, // saddle brown
    0xC9A24B, // gold metallic
];

const ENEMY_STRIPE_COLORS = [
    0xFFFFFF, // white
    0xE0DED8, // off-white
    0x1A1A1E, // black
    0x2B2E33, // gunmetal
    0xC9A24B, // gold
    0xE8B923, // racing yellow
    0xD94F30, // racing orange
    0x9A1F2B, // racing red
    0x1E5B8C, // cobalt blue
    0x2E7D5B, // racing green
];


export class EnemyCarManager {
    ///@param camera
    ///@param carManager - bestehende CarManager-Instanz
    ///@param assetManager
    ///@param defaultConfig - Config for every enemy car, colors defined and set to 0x000000 will be randomly chossen
    ///@param options - { carWidth, laneCount, roadWidth, spawnDistance, despawnMargin, spawnInterval, spawnIntervalJitter, baseSpeed, addSpeed }
    constructor(app, driveScene, camera, carManager, assetManager, defaultConfig, options = {}) {
        this.app = app;
        this.driveScene = driveScene;
        this.camera = camera;
        this.carManager = carManager;
        this.assetManager = assetManager;
        this.defaultConfig = defaultConfig;

        this.laneCount = options.laneCount ?? 3;
        this.roadWidth = options.roadWidth ?? RoadManager.computeTotalWidth(this.laneCount);
        this.carWidth = options.carWidth ?? RoadManager.laneWidth * 0.8;
        this.spawnDistance = options.spawnDistance ?? 3000;   // world units vor der Kamera (Horizont)
        this.despawnMargin = options.despawnMargin ?? 200;    // world units hinter der Kamera
        this.spawnInterval = options.spawnInterval ?? 1.6;
        this.spawnIntervalJitter = options.spawnIntervalJitter ?? 1.0;

        this.baseSpeed = options.baseSpeed ?? 90;
        this.addSpeed = options.addSpeed ?? 40;

        this.minLaneGap = options.minLaneGap ?? this.carWidth * 4;
        this.prefillFarFraction = options.prefillFarFraction ?? 0.5;

        const baseAsset = this.assetManager.getAssetByName(defaultConfig.base);
        this.scale = computeScaleForWidth(baseAsset, this.carWidth, "z");
        this.carLength = baseAsset.size.x * this.scale;

        this._freeLane = Math.floor(Math.random() * this.laneCount);

        this._enemyData = new Map(); // Car -> { speed, lane }
        this._spawnTimer = this._nextSpawnDelay();

        this._inCollision = false;

        this._prefillRoad();
    }

    _prefillRoad() {
        const farStart = this.spawnDistance * this.prefillFarFraction;
        const farEnd = this.spawnDistance;

        const avgSpeed = this.baseSpeed + this.addSpeed * 0.5;
        const waveSpacing = Math.max(
            this.minLaneGap,
            avgSpeed * this.spawnInterval,
            this.carLength * 3
        );

        for (let dist = farEnd; dist >= farStart; dist -= waveSpacing) {
            const spawnZ = this.camera.pos3d.z - dist;

            this._advanceFreeLane(spawnZ);
            const lanes = this._generateWavePattern();
            for (const lane of lanes) {
                this._trySpawnInLane(lane, spawnZ);
            }
        }
    }

    _randomCarColor(palette) {
        return palette[
            Math.floor(Math.random() * palette.length)
        ];
    }

    _nextSpawnDelay() {
        return this.spawnInterval + Math.random() * this.spawnIntervalJitter;
    }

    _laneX(laneIndex) {
        const laneWidth = RoadManager.laneWidth;
        const firstCenter = -(this.laneCount - 1) * laneWidth / 2;
        return firstCenter + laneIndex * laneWidth;
    }

    //chooses random lanes to fill, but always leaves 1 out
    _generateWavePattern() {
        const maxLanesToFill = Math.max(1, this.laneCount - 1); // mind. 1 Spur bleibt frei
        const fillCount = 1 + Math.floor(Math.random() * maxLanesToFill); // 1..laneCount-1

        const lanes = Array.from({ length: this.laneCount }, (_, i) => i);
        // Fisher-Yates shuffle
        for (let i = lanes.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [lanes[i], lanes[j]] = [lanes[j], lanes[i]];
        }
        return lanes.slice(0, fillCount);
    }

    _isLaneClear(lane, spawnZ) {
        for (const car of this._enemyData.keys()) {
            const data = this._enemyData.get(car);
            if (data.lane !== lane) continue;
            if (Math.abs(car.pos3d.z - spawnZ) < this.minLaneGap) return false;
        }
        return true;
    }

    _spawnWave() {
        const spawnZ = this.camera.pos3d.z - this.spawnDistance;

        this._advanceFreeLane(spawnZ);
        const lanes = this._generateWavePattern();
        for (const lane of lanes) {
            this._trySpawnInLane(lane, spawnZ);
        }
    }

    _advanceFreeLane(spawnZ) {
        if (Math.random() < 0.5) return;

        const candidates = [this._freeLane - 1, this._freeLane + 1]
            .filter(l => l >= 0 && l < this.laneCount);

        if (candidates.length === 2 && Math.random() < 0.5) candidates.reverse();

        for (const lane of candidates) {
            if (this._isLaneClearAhead(lane, spawnZ)) {
                this._freeLane = lane;
                break;
            }
        }
    }

    _isLaneClearAhead(lane, spawnZ) {
        for (const car of this._enemyData.keys()) {
            const data = this._enemyData.get(car);
            if (data.lane !== lane) continue;
            if (car.pos3d.z <= this.camera.pos3d.z && car.pos3d.z >= spawnZ) return false;
        }
        return true;
    }

    _generateWavePattern() {
        const fillableLanes = Array.from({ length: this.laneCount }, (_, i) => i)
            .filter(l => l !== this._freeLane);

        if (fillableLanes.length === 0) return [];

        const fillCount = 1 + Math.floor(Math.random() * fillableLanes.length);

        // Fisher-Yates shuffle
        for (let i = fillableLanes.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [fillableLanes[i], fillableLanes[j]] = [fillableLanes[j], fillableLanes[i]];
        }
        return fillableLanes.slice(0, fillCount);
    }

    _trySpawnInLane(lane, spawnZ) {
        if (!this._isLaneClear(lane, spawnZ)) return; // Spur gerade belegt -> diese Welle überspringen für diese Spur

        const pos3d = { x: this._laneX(lane), y: 0, z: spawnZ };

        const config = structuredClone(this.defaultConfig);
        config.colors.base.base = this._randomCarColor(ENEMY_BASE_COLORS);
        config.colors.base.detail2 = this._randomCarColor(ENEMY_STRIPE_COLORS);

        const car = this.carManager.spawnEnemyCar(config, pos3d, this.scale);
        car.rotate(ROT_X_TO_NEGZ);
        car.repositionToGround();
        car.initWheelState();

        const speed = this.baseSpeed + Math.random() * this.addSpeed;
        this._enemyData.set(car, { speed, lane });
    }

    update(dt) {
        // ---- Spawnen (in Wellen, statt pro Auto einzeln) ----
        this._spawnTimer -= dt;
        if (this._spawnTimer <= 0) {
            this._spawnWave();
            this._spawnTimer = this._nextSpawnDelay();
        }

        // ---- Bewegen (nur -z) + Despawnen ----
        for (const car of [...this._enemyData.keys()]) {
            const data = this._enemyData.get(car);

            const pos = { ...car.pos3d };
            const moveAmount = data.speed * dt;
            pos.z -= moveAmount;
            car.setPosition(pos);
            car.updateWheels(dt, moveAmount, 0);

            if (pos.z > this.camera.pos3d.z + this.despawnMargin) {
                this.carManager.destroyCar(car);
                this._enemyData.delete(car);
            }
        }

        // ---- Collisions ----
        const collisions = this.carManager.checkCollisions();
        if (collisions.length > 0) {
            if (!this._inCollision) {
                this.driveScene.stopCar();
                ToastManager.update('crash', {});
                const notif = new NotifScreen(
                    this.app,
                    "ACCIDENT!\nYou've been involved in a collision. Your car needs a quick repair before you can continue.\n\nRepair Cost: $500\n\nYour Balance: $" + `${GAMESTATE.money}`,
                    "PAY & CONTINUE",
                    () => {
                        SceneStack.popScene();
                        GAMESTATE.spendMoney(500, true, this.app, () => {
                            this.driveScene.unstopCar();
                            this._inCollision = false;
                            for (const car of collisions) {
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