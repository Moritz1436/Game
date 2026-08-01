import * as PIXI from "pixi.js";
import { Camera } from "../World3D/Camera.js";
import { GridMesh2D } from "../World3D/GridMesh2D.js";
import { Input } from "../Utils/Input.js";
import { OrbitCameraController } from "./OrbitCameraController.js";
import { CarPieceAssetManager } from "../Car/CarPieceAssetManager.js";
import { CarManager } from "../Car/CarManager.js";
import { GarageOverlay } from "./GarageOverlay.js";
import { getAABBCorners } from "../World3D/Utils/BoundsUtils.js";
import { AABBDebugMesh } from "../World3D/AABBDebugMesh.js";

/* Car Piece Data
    Todo: LOD

    base_sedan.json:    1830 Tris | 7 Meshes
    tire_sport.json:    1412 Tris | 4 Meshes
    spoiler_big.json:    224 Tris | 1 Meshes

*/

export class GarageScene extends PIXI.Container {

    static assetManager = null;

    static async create(app) {
        GarageScene.assetManager = new CarPieceAssetManager();

        await this.assetManager.loadAllAssets([
            { type: "base",    name: "sedan_base",    path: "assets/models/base_sedan.json" },
            { type: "tire",    name: "tire_sport",    path: "assets/models/tire_sport.json" },
            { type: "spoiler", name: "spoiler_big",   path: "assets/models/spoiler_big.json" },
        ]);

        return new GarageScene(app);
    }

    constructor(app) {
        super();

        this.app = app;
        this.label = "GarageScene";

        const camPos = { x: 0, y: 25, z: 0 };
        const camRot = { x: 0, y: 0, z: 0 };
        this.camera = new Camera(app, camPos, camRot);
        const target = {x: 0, y: 5, z: -100}
        this.orbitController = new OrbitCameraController(this.camera, target, 100);

        this.groundLayer = new PIXI.Container();
        this.carLayer = new PIXI.Container();
        this.debugLayer = new PIXI.Container();


        this.ground = this.createGround();
        this.overlay = new GarageOverlay(this.app, GarageScene.assetManager, {
            onExit: () => { console.log("Exit Garage"); },
            onPartVariantSelect: (type, pieceName) => { console.log(`selected ${type} ${pieceName}`); }
        });

        //background -> foreground
        this.addChild(this.groundLayer);
        this.addChild(this.carLayer);
        this.addChild(this.debugLayer);
        this.addChild(this.overlay);

        this.overlay.setMoney(6122451);

        this.aabbDebug = null;

        this.carManager = new CarManager(this.carLayer, GarageScene.assetManager);
        this.car = this.carManager.spawnPlayerCar({
            base: "sedan_base",
            parts: {
                socket_tire_FL: "tire_sport",
                socket_tire_FR: "tire_sport",
                socket_tire_RL: "tire_sport",
                socket_tire_RR: "tire_sport",
                socket_spoiler: "spoiler_big",
            },
            colors: {
                "base": {
                    "Car": 0x00FF00,
                },
            }
        }, target, 30);

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
            this.drawDebug();
        }
        else if (this.aabbDebug) {
            this.aabbDebug.destroy();
            this.aabbDebug = null;
        }
    }

    destroy() {
        this.app.ticker.remove(this.update, this);

        this.ground.destroy(this.groundLayer);

        super.destroy({
            children: true
        });
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
                z: -100
            },
            {
                x: 100,
                y: 100
            }
        );
        this.groundLayer.addChild(grid.mesh);

        return grid;
    }

    drawDebug() {
        if (this.aabbDebug == null) {
            this.aabbDebug = new AABBDebugMesh(this.debugLayer, [1, 0, 0]);
        }
        const aabb = this.car.rootPiece.getWorldAABB();
        const corners = getAABBCorners(aabb);
        this.aabbDebug.update(corners);
    }

}