import * as PIXI from "pixi.js";
import { SceneStack } from "../Utils/SceneStack.js";
import { UIScene } from "../Utils/UIScene.js";
import { LoadingScreen } from "../LoadingScreen.js";
import { ChunkManager } from "./ChunkManager.js";
import { World } from "./World.js"; 
import { FULL_W, FULL_H } from "./Utils.js";
import { computeRoadNetwork, generateCityRoadNetwork, buildRoadMask, cityDistance } from "./Roads.js";
import { CityGroup } from "./CityGroup.js";
import { NotifScreen } from "../NotifScreen.js";
import { DriveScene } from "../Road/DriveScene.js";
import { GAMESTATE } from "../GameState.js";
import { GarageScene } from "../Garage/GarageScene.js";
import { QuestScene } from "../Quest/QuestScene.js";
import { MapOverlay } from "./MapOverlay.js";
import { MenuScene } from "../Menu/MenuScene.js";
import { ShopScene } from "../Shop/ShopScene.js";

export class MapScene extends UIScene {

    static async create(app, seed, existingLoadingScreen = null) {
        const loadingScreen = existingLoadingScreen ?? new LoadingScreen(app);
        if (!existingLoadingScreen) SceneStack.pushScene(loadingScreen);

        let scene;

        await loadingScreen.run(
            [
                async () => {
                    scene = new MapScene(app, seed);
                    await scene.chunkManager.loadAllPendingAsync();
                }
            ],
            null,
            ["Generating terrain"]
        );

        return scene;
    }

    constructor(app, seed) {
        super(app, "MapScene");
        this.uiScene = new PIXI.Container();
        this.uiSceneWrapper = new PIXI.Container();
        this.seed = seed;

        this.chunkLayer = new PIXI.Container();
        this.vegetationLayer = new PIXI.Container();
        this.cityLayer = new PIXI.Container();
        this.uiSceneWrapper.addChild(this.chunkLayer);
        this.uiSceneWrapper.addChild(this.vegetationLayer);
        this.uiSceneWrapper.addChild(this.cityLayer);

        this.overlay = new MapOverlay(this.app, {
            onMarkerClick: (city) => this._onMarkerClick(city),
            onMenu: () => { 
                const scene = new MenuScene(this.app, {
                    onContinue: () => { SceneStack.popScene(); }, 
                    onSettings: () => {}, 
                    onStatistics: () => {}, 
                    onAbout: () => {}, 
                    onProfile: () => {}
                });
                SceneStack.pushScene(scene, false);
            },
        });
        this.uiScene.addChild(this.uiSceneWrapper);
        this.uiScene.addChild(this.overlay);

        this.cameraX = FULL_W / 2;
        this.cameraY = FULL_H / 2;
        this.cityGroups = [];

        this._setup();

        const cityIdx = GAMESTATE.currentCityIndex;
        if (cityIdx != null && this.macro.world.cities[cityIdx]) {
            const city = this.macro.world.cities[cityIdx];
            this.cameraX = city.cx;
            this.cameraY = city.cy;
        }

        this._bindPan();

        app.ticker.add(this.update, this);
        this._centerCameraOn(this.cameraX, this.cameraY);

        this._onWindowResize = () => {
            this._centerCameraOn(this.cameraX, this.cameraY); // erzwingt update() mit neuen Maßen
        };
        window.addEventListener('resize', this._onWindowResize);
    }

    update(deltaMS) {
        this.chunkManager.tick();
        this.overlay.updateQuestMarkers(this.cameraX, this.cameraY);
    }

    _setup() {
        this.macro = this.generateWorldMacro(this.seed);

        GAMESTATE.applyCityFeatureOverrides(this.macro.world.cities);

        this.chunkManager = new ChunkManager(this.chunkLayer, this.vegetationLayer, this.macro, 0);
        this.chunkManager.update(this.cameraX, this.cameraY, this.app.screen.width, this.app.screen.height);

        for (let i = 0; i < this.macro.world.cities.length; i++) {
            const city = this.macro.world.cities[i];
            const isCurrent = i === GAMESTATE.currentCityIndex;
            const cityGroup = new CityGroup(city, this.macro.world, this.macro.cityNetworks[i], isCurrent);
            cityGroup.on('cityclick', (c) => this._onCityClick(c));
            this.cityLayer.addChild(cityGroup);
            this.cityGroups.push(cityGroup);
        }

        const currentCity = this.macro.world.cities[GAMESTATE.currentCityIndex];
        this.overlay.setCity(currentCity.name);
        this.overlay.setWorld(this.macro.world);
    }

    _bindPan() {
        let pointerDown = false;
        let dragging = false;
        let startX = 0, startY = 0, lastX = 0, lastY = 0;
        const DRAG_THRESHOLD = 6;

        this.uiSceneWrapper.eventMode = 'static';
        this.uiSceneWrapper.hitArea = new PIXI.Rectangle(0, 0, FULL_W, FULL_H);

        const onDragStart = (e) => {
            this._cameraAnimId = (this._cameraAnimId ?? 0) + 1;
            pointerDown = true;
            dragging = false;
            startX = lastX = e.global.x;
            startY = lastY = e.global.y;
        };

        const onDragMove = (e) => {
            if (!pointerDown) return;
            const dx = e.global.x - lastX, dy = e.global.y - lastY;

            if (!dragging) {
                const totalDist = Math.hypot(e.global.x - startX, e.global.y - startY);
                if (totalDist > DRAG_THRESHOLD) {
                    dragging = true;
                    this.cityLayer.eventMode = 'none';
                }
            }

            if (dragging) {
                lastX = e.global.x; lastY = e.global.y;
                this.panBy(-dx, -dy);
            }
        };

        const onDragEnd = () => {
            pointerDown = false;
            dragging = false;
            this.cityLayer.eventMode = 'static';
        };

        this.uiSceneWrapper.on('pointerdown', onDragStart);
        this.uiSceneWrapper.on('pointerup', onDragEnd);
        this.uiSceneWrapper.on('pointerupoutside', onDragEnd);
        this.uiSceneWrapper.on('pointermove', onDragMove);

        this._onDragStart = onDragStart;
        this._onDragMove = onDragMove;
        this._onDragEnd = onDragEnd;

        this._onWindowPointerUp = onDragEnd;
        window.addEventListener('pointerup', this._onWindowPointerUp);
    }

    panBy(dx, dy) {
        this._centerCameraOn(this.cameraX + dx, this.cameraY + dy);
    }

    _centerCameraOn(worldX, worldY) {
        this.cameraX = Math.max(0, Math.min(FULL_W, worldX));
        this.cameraY = Math.max(0, Math.min(FULL_H, worldY));
        this.uiSceneWrapper.x = Math.round(this.app.screen.width / 2 - this.cameraX);
        this.uiSceneWrapper.y = Math.round(this.app.screen.height / 2 - this.cameraY);
        this.chunkManager.update(this.cameraX, this.cameraY, this.app.screen.width, this.app.screen.height);
    }

    _onMarkerClick(city) {
        this._animateCameraTo(city.cx, city.cy, 650);
    }

    _animateCameraTo(targetX, targetY, durationMs) {
        this._cameraAnimId = (this._cameraAnimId ?? 0) + 1;
        const animId = this._cameraAnimId;
        const startX = this.cameraX, startY = this.cameraY;
        const t0 = performance.now();

        const step = (now) => {
            if (animId !== this._cameraAnimId) return; // abgebrochen (z.B. manuelles Draggen)
            const t = Math.min(1, (now - t0) / durationMs);
            const eased = 1 - Math.pow(1 - t, 3);
            this._centerCameraOn(
                startX + (targetX - startX) * eased,
                startY + (targetY - startY) * eased
            );
            if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }

    _onCityClick(city) {
        const curCity = this.macro.world.cities[GAMESTATE.currentCityIndex ?? 0];
        const toCityIdx = this.macro.world.cities.indexOf(city);
        const cityName = city.name;

        //already at that city
        if (GAMESTATE.currentCityIndex == toCityIdx){
            this._openCityFeatureNotif(city);
            return;
        }

        const CITY_NOTIF_TEXTS = {
            quest: "A local has a task that needs doing. Want to take it on?",
            rennen: "The locals are itching for a race. Fancy your chances?",
            shop: "This town's shop is open and fully stocked.",
            tankstelle: "Running low on fuel? This town has a gas station.",
            werkstatt: "Need repairs or upgrades? This town has a workshop.",
        };

        const distance = cityDistance(curCity, city);
        let text = `INFORMATION\n`;
        text += CITY_NOTIF_TEXTS[city.feature] ?? `Welcome to this town.`;
        text += `\n\nDistance: ${Math.round(distance)}m`;

        const notif = new NotifScreen(
            this.app,
            text,
            "DRIVE THERE",
            async () => {
                SceneStack.popScene();
                const scene = await DriveScene.create(this.app, distance, toCityIdx, cityName);
                SceneStack.pushScene(scene, true);
            },
            "CANCEL",
            () => {
                SceneStack.popScene();
            }
        );

        SceneStack.pushScene(notif, false);
    }

    _openCityFeatureNotif(city) {

        if (!city.feature) {
            const notif = new NotifScreen(
                this.app,
                "INFORMATION\nThere's nothing to do here right now. Check back later.",
                "CLOSE",
                () => SceneStack.popScene()
            );
            SceneStack.pushScene(notif, false);
            return;
        }

        const cityIdx = this.macro.world.cities.indexOf(city);

        const FEATURE_ACTIONS = {
            werkstatt: {
                text: "INFORMATION\nWelcome to the garage. Want to customize your car?",
                openScene: async (app) => await GarageScene.create(app, cityIdx),
            },
            shop: {
                text: "INFORMATION\nThe shop is fully stocked. Want to take a look?",
                openScene: (app) => new ShopScene(app),
            },
            quest: {
                text: "INFORMATION\nThe local quest board is right here. Want to check it out?",
                openScene: async (app) => await QuestScene.create(app, this.macro.world, GAMESTATE.currentCityIndex),
            },
            rennen: {
                text: "INFORMATION\nThe race track is ready. Want to start a race?",
                openScene: null, // TODO: RaceScene noch nicht implementiert
            },
            tankstelle: {
                text: "INFORMATION\nYou're at the gas station. Want to refuel?",
                openScene: null, // TODO: refuel-Logik/Scene noch nicht implementiert
            },
        };

        const action = FEATURE_ACTIONS[city.feature];
        const text = action?.text ?? "INFORMATION\nYou're already here.";

        if (action?.openScene) {
            const notif = new NotifScreen(
                this.app,
                text,
                "YES",
                async () => {
                    SceneStack.popScene();
                    const scene = await action.openScene(this.app);
                    SceneStack.pushScene(scene, true);
                },
                "CANCEL",
                () => {
                    SceneStack.popScene();
                }
            );
            SceneStack.pushScene(notif, false);
        } else {
            const notif = new NotifScreen(
                this.app,
                text,
                "CLOSE",
                () => {
                    SceneStack.popScene();
                }
            );
            SceneStack.pushScene(notif, false);
        }
    }

    destroy() {
        this.chunkManager.destroy();
        for (const g of this.cityGroups) g.destroy({ children: true });
        this.cityGroups = [];
        
        this.overlay.destroy({ children: true });

        this.app.ticker.remove(this.update, this);

        this.uiSceneWrapper.off('pointerdown', this._onDragStart);
        this.uiSceneWrapper.off('pointerup', this._onDragEnd);
        this.uiSceneWrapper.off('pointerupoutside', this._onDragEnd);
        this.uiSceneWrapper.off('pointermove', this._onDragMove);
        this.uiSceneWrapper.eventMode = 'auto';
        this.uiSceneWrapper.hitArea = null;

        if (this._onWindowPointerUp) {
            window.removeEventListener('pointerup', this._onWindowPointerUp);
        }

        window.removeEventListener('resize', this._onWindowResize);

        this.uiSceneWrapper.destroy({ children: true });
    }

    generateWorldMacro(seed) {
        const world = new World(seed);
        const { roads } = computeRoadNetwork(world);
        const cityNetworks = world.cities.map(c => generateCityRoadNetwork(world, c));
        const roadMask = buildRoadMask(roads, 15);

        return { world, roads, cityNetworks, roadMask };
    }
}