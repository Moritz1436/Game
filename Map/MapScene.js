import * as PIXI from "pixi.js";
import { SceneStack } from "../Utils/SceneStack.js";
import { UIScene } from "../Utils/UIScene.js";
import { LoadingScreen } from "../LoadingScreen.js";
import { ChunkManager } from "./ChunkManager.js";
import { World } from "./World.js"; 
import { FULL_W, FULL_H } from "./Utils.js";
import { computeRoadNetwork, generateCityRoadNetwork, buildRoadMask } from "./Roads.js";
import { CityGroup } from "./CityGroup.js";
import { NotifScreen } from "../NotifScreen.js";
import { DriveScene } from "../Road/DriveScene.js";

export class MapScene extends UIScene {

    static async create(app, seed, existingLoadingScreen = null) {
        const loadingScreen = existingLoadingScreen ?? new LoadingScreen(app);
        if (!existingLoadingScreen) SceneStack.pushScene(loadingScreen);

        let scene;

        await loadingScreen.run(
            [
                async () => {
                    scene = new MapScene(app, seed);
                    scene.chunkManager.loadAllPending();
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
        this.seed = seed;

        this.chunkLayer = new PIXI.Container();
        this.vegetationLayer = new PIXI.Container();
        this.cityLayer = new PIXI.Container();
        this.uiScene.addChild(this.chunkLayer);
        this.uiScene.addChild(this.vegetationLayer);
        this.uiScene.addChild(this.cityLayer);

        this.cameraX = FULL_W / 2;
        this.cameraY = FULL_H / 2;
        this.cityGroups = [];

        this._setup();
        this._bindPan();

        app.ticker.add(this.update, this);
    }

    update(deltaMS) {
        this.chunkManager.tick();
    }

    _setup() {
        this.macro = this.generateWorldMacro(this.seed);
        this.chunkManager = new ChunkManager(this.chunkLayer, this.vegetationLayer, this.macro, 2);
        this.chunkManager.update(this.cameraX, this.cameraY);

        for (let i = 0; i < this.macro.world.cities.length; i++) {
            const city = this.macro.world.cities[i];
            const cityGroup = new CityGroup(city, this.macro.world, this.macro.cityNetworks[i]);
            cityGroup.on('cityclick', (c) => this._onCityClick(c));
            this.cityLayer.addChild(cityGroup);
            this.cityGroups.push(cityGroup);
        }

        this._centerCameraOn(this.cameraX, this.cameraY);
    }

    _bindPan() {
        let pointerDown = false;
        let dragging = false;
        let startX = 0, startY = 0, lastX = 0, lastY = 0;
        const DRAG_THRESHOLD = 6;

        this.uiScene.eventMode = 'static';
        this.uiScene.hitArea = new PIXI.Rectangle(0, 0, FULL_W, FULL_H);

        const onDragStart = (e) => {
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

        this.uiScene.on('pointerdown', onDragStart);
        this.uiScene.on('pointerup', onDragEnd);
        this.uiScene.on('pointerupoutside', onDragEnd);
        this.uiScene.on('pointermove', onDragMove);

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
        // Ganzzahlig runden - sonst rendern benachbarte Chunk-Sprites bei
        // unterschiedlichen Subpixel-Positionen, was je nach Filtering
        // feine Naehte zwischen Chunks erzeugen kann.
        this.uiScene.x = Math.round(this.app.screen.width / 2 - this.cameraX);
        this.uiScene.y = Math.round(this.app.screen.height / 2 - this.cameraY);
        this.chunkManager.update(this.cameraX, this.cameraY);
    }

    _onCityClick(city) {

        const CITY_NOTIF_TEXTS = {
            quest: "A local has a task that needs doing. Want to take it on?",
            rennen: "The locals are itching for a race. Fancy your chances?",
            shop: "This town's shop is open and fully stocked.",
            tankstelle: "Running low on fuel? This town has a gas station.",
            werkstatt: "Need repairs or upgrades? This town has a workshop.",
        };

        const text = CITY_NOTIF_TEXTS[city.feature] ?? `Welcome to this town.`;

        const notif = new NotifScreen(
            this.app,
            text,
            "DRIVE THERE",
            async () => {
                SceneStack.popScene();
                const scene = await DriveScene.create(this.app, 2400);
                SceneStack.pushScene(scene, true);
            },
            "CANCEL",
            () => {
                SceneStack.popScene();
            }
        );

        SceneStack.pushScene(notif, false);
    }

    destroy() {
        this.chunkManager.destroy();
        for (const g of this.cityGroups) g.destroy({ children: true });
        this.cityGroups = [];

        this.app.ticker.remove(this.update, this);

        this.uiScene.off('pointerdown', this._onDragStart);
        this.uiScene.off('pointerup', this._onDragEnd);
        this.uiScene.off('pointerupoutside', this._onDragEnd);
        this.uiScene.off('pointermove', this._onDragMove);
        this.uiScene.eventMode = 'auto';
        this.uiScene.hitArea = null;

        if (this._onWindowPointerUp) {
            window.removeEventListener('pointerup', this._onWindowPointerUp);
        }

        this.uiScene.destroy({ children: true });
    }

    generateWorldMacro(seed) {
        const world = new World(seed);
        const { roads } = computeRoadNetwork(world);
        const cityNetworks = world.cities.map(c => generateCityRoadNetwork(world, c));
        const roadMask = buildRoadMask(roads, 15);

        return { world, roads, cityNetworks, roadMask };
    }
}