import * as PIXI from "pixi.js";
import { Camera } from "../World3D/Camera.js";
import { GridMesh2D } from "../World3D/GridMesh2D.js";
import { Input } from "../Utils/Input.js";
import { OrbitCameraController } from "./OrbitCameraController.js";
import { CarPieceAssetManager } from "../Car/CarPieceAssetManager.js";
import { CarManager } from "../Car/CarManager.js";
import { GarageOverlay } from "./GarageOverlay.js";
import { getAABBCorners } from "../World3D/Utils/BoundsUtils.js";
import { DebugOutline } from "../World3D/DebugOutline.js";
import { UIScene } from "../Utils/UIScene.js";
import { MapScene } from "../Map/MapScene.js";
import { SceneStack } from "../Utils/SceneStack.js";
import { CarConfigState } from "../Car/CarConfigState.js";
import { LoadingScreen } from "../LoadingScreen.js";
import { GAMESTATE } from "../GameState.js";
import { globalAssetManager } from "../GlobalAssets.js";

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

    static async create(app, existingLoadingScreen = null) {
        const loadingScreen = existingLoadingScreen ?? new LoadingScreen(app);
        if (!existingLoadingScreen) SceneStack.pushScene(loadingScreen);

        return new GarageScene(app);
    }

    constructor(app) {
        super(app, "GarageScene");
        this.uiScene = new PIXI.Container();
        this.world3dScene = new PIXI.Container();

        this.camera = new Camera(app, null, null);
        const target = {x: 0, y: 0, z: 0};
        this.orbitController = new OrbitCameraController(this.camera, target, 150);

        this.groundLayer = new PIXI.Container();
        this.carLayer = new PIXI.Container();
        this.debugLayer = new PIXI.Container();

        this.ground = this.createGround();
        this.aabbDebug = null;
        
        this.carConfig = new CarConfigState(GAMESTATE.getCurrentCarConfig());

        this.carManager = new CarManager(this.carLayer, globalAssetManager);
        const config = this.carConfig.exportConfig();
        const baseAsset = globalAssetManager.getAssetByName(config.base);
        
        const scale = 30;
        this.car = this.carManager.spawnPlayerCar(config, target, scale);


        this.overlay = new GarageOverlay(this.app, globalAssetManager, this.car, this.carConfig, {
            onExit: async (config) => {
                GAMESTATE.updateCarConfig(config);
                const scene = await MapScene.create(this.app);
                SceneStack.pushScene(scene);
            }
        });


        this.world3dScene.addChild(this.groundLayer);
        this.world3dScene.addChild(this.carLayer);
        this.world3dScene.addChild(this.debugLayer);

        //Background -> Foreground
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
        this.app.ticker.remove(this.update, this);

        this.carManager.destroy();
        this.carManager = null;
        this.ground.destroy(this.groundLayer);

        GAMESTATE.updateCarConfig(this.carConfig.exportConfig());
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