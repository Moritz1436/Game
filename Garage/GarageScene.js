import * as PIXI from "pixi.js";
import { Camera } from "../World3D/Camera.js";
import { GridMesh2D } from "../World3D/GridMesh2D.js";
import { Input } from "../Utils/Input.js";
import { OrbitCameraController } from "./OrbitCameraController.js";
import { CarManager } from "../Car/CarManager.js";
import { GarageOverlay } from "./GarageOverlay.js";
import { UIScene } from "../Utils/UIScene.js";
import { MapScene } from "../Map/MapScene.js";
import { SceneStack } from "../Utils/SceneStack.js";
import { CarConfigState } from "../Car/CarConfigState.js";
import { LoadingScreen } from "../LoadingScreen.js";
import { GAMESTATE } from "../GameState.js";
import { globalAssetManager, MAP_SEED } from "../GlobalAssets.js";

/* Car Piece Data
    Todo: LOD

    base_sedan.json:    1830 Tris | 7 Meshes
    tire_sport.json:    1412 Tris | 4 Meshes
    tire_1.json:        1308 Tris | 7 Meshes
    tire_2.json:        1464 Tris | 6 Meshes
    tire_3.json:        1136 Tris | 5 Meshes
    spoiler_big.json:    224 Tris | 1 Meshes

*/

export class GarageScene extends UIScene {

    static async create(app, cityIdx, existingLoadingScreen = null) {
        const loadingScreen = existingLoadingScreen ?? new LoadingScreen(app);
        if (!existingLoadingScreen) SceneStack.pushScene(loadingScreen);

        return new GarageScene(app, cityIdx);
    }

    constructor(app, cityIdx) {
        super(app, "GarageScene");
        this.uiScene = new PIXI.Container();
        this.world3dScene = new PIXI.Container();

        this.cityIdx = cityIdx;

        this.camera = new Camera(app, null, null);
        const target = {x: 0, y: 0, z: 0};
        this.orbitController = new OrbitCameraController(this.camera, target, 150);

        // Camera drag
        this.isDraggingCamera = false;
        this.lastPointerX = 0;
        this.lastPointerY = 0;

        this._onPointerMove = this.onCameraDrag.bind(this);
        this._onPointerUp = this.onCameraDragEnd.bind(this);

        this.dragLayer = new PIXI.Container();
        this.dragLayer.eventMode = "static";

        this.dragLayer.on("pointerdown", this.onCameraDragStart, this);
        this.dragLayer.hitArea = null;
        this._onResize = () => {
            this.dragLayer.hitArea = new PIXI.Rectangle(
                0,
                0,
                this.app.renderer.width,
                this.app.renderer.height
            );
        }
        this._onResize();
        window.addEventListener("resize", this._onResize);

        this._onWheel = this.onCameraWheel.bind(this);
        window.addEventListener("wheel", this._onWheel, { passive: false });

        this.groundLayer = new PIXI.Container();
        this.carLayer = new PIXI.Container();
        this.debugLayer = new PIXI.Container();

        this.ground = this.createGround();
        this.aabbDebug = null;
        
        this.carConfig = new CarConfigState(GAMESTATE.getCurrentCarConfig());

        this.carManager = new CarManager(this.carLayer, globalAssetManager);
        const config = this.carConfig.exportConfig();
        
        const scale = 30;
        this.car = this.carManager.spawnPlayerCar(config, target, scale);


        this.overlay = new GarageOverlay(this.app, globalAssetManager, this.car, this.carConfig, {
            onExit: async (config) => {
                GAMESTATE.updateCarConfig(config);
                GAMESTATE.completeCityFeature(this.cityIdx);
                const scene = await MapScene.create(this.app, MAP_SEED);
                SceneStack.pushScene(scene);
            }
        });


        this.world3dScene.addChild(this.groundLayer);
        this.world3dScene.addChild(this.carLayer);
        this.world3dScene.addChild(this.debugLayer);

        //Background -> Foreground
        this.uiScene.addChild(this.dragLayer);
        this.uiScene.addChild(this.overlay);

        app.ticker.add(this.update, this);
    }

    update(ticker) {
        const dt = ticker.deltaMS / 1000;
        const rotateSpeed = 1.2;

        //rotate cam
        if (Input.isKeyDown("ArrowDown")) this.orbitController.rotate(0, -rotateSpeed * dt);
        if (Input.isKeyDown("ArrowUp")) this.orbitController.rotate(0, rotateSpeed * dt);
        if (Input.isKeyDown("ArrowLeft")) this.orbitController.rotate(-rotateSpeed * dt, 0);
        if (Input.isKeyDown("ArrowRight")) this.orbitController.rotate(rotateSpeed * dt, 0);


        this.orbitController.update();
        this.camera.update();
        
        this.ground.update(this.app, this.camera);
        if (window.DEBUG.enabled && window.DEBUG.showCarBounds) {
            this.car.showDebugOutline(this.debugLayer);
        } else {
            this.car.hideDebugOutline();
        }
    }

    destroy() {
        this.onCameraDragEnd();
        window.removeEventListener("resize", this._onResize);
        window.removeEventListener("wheel", this._onWheel);
        this.app.ticker.remove(this.update, this);

        this.carManager.destroy();
        this.carManager = null;
        this.ground.destroy(this.groundLayer);

        GAMESTATE.updateCarConfig(this.carConfig.exportConfig());
    }

    onCameraDragStart(event) {
        this.isDraggingCamera = true;
        this.overlay._closeOptions();

        this.lastPointerX = event.clientX;
        this.lastPointerY = event.clientY;

        document.body.style.cursor = "grabbing";

        window.addEventListener("pointermove", this._onPointerMove);
        window.addEventListener("pointerup", this._onPointerUp);
    }

    onCameraDrag(event) {
        if (!this.isDraggingCamera) return;

        const x = event.clientX;
        const y = event.clientY;

        const dx = x - this.lastPointerX;
        const dy = y - this.lastPointerY;

        this.lastPointerX = x;
        this.lastPointerY = y;

        const horizontalSensitivity = 0.003;
        const verticalSensitivity = 0.002;

        this.orbitController.rotate(
            dx * horizontalSensitivity,
            dy * verticalSensitivity
        );
    }

    onCameraDragEnd() {
        if (!this.isDraggingCamera) return;

        this.isDraggingCamera = false;

        document.body.style.cursor = "";

        window.removeEventListener("pointermove", this._onPointerMove);
        window.removeEventListener("pointerup", this._onPointerUp);
    }

    
    onCameraWheel(event) {
        if (this.overlay.isPointerOverOverlay) {
            return;
        }

        event.preventDefault();

        const zoomSpeed = 0.2;

        this.orbitController.distance += event.deltaY * zoomSpeed;

        this.orbitController.distance = Math.max(
            100,
            Math.min(this.orbitController.distance, 300)
        );
    }

    createGround() {
        const grid = new GridMesh2D(
            this.app,
            this.camera,
            this.groundLayer,
            null,
            1,
            1,
            PIXI.Texture.WHITE,
            { x: -1, y: -1 },
            {
                x: 0,
                y: 0,
                z: 0
            },
            {
                x: 150,
                y: 150
            }
        );
        this.groundLayer.addChild(grid.mesh);

        return grid;
    }
}