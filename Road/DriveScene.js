import * as PIXI from "pixi.js";
import { Camera } from "../World3D/Camera.js";
import { Input } from "../Utils/Input.js";
import { RoadManager } from "./RoadManager.js";
import { GroundManager } from "./GroundManager.js";
import { MountainManager } from "./MountainManager.js";
import { ModelLoader } from "../Models/ModelLoader.js";
import { ObjectManager } from "./ObjectManager.js";
import { OverlayManager } from "./OverlayManager.js";
import { SceneStack } from "../Utils/SceneStack.js";
import { MapScene } from "../Map/MapScene.js";
import { UIScene } from "../Utils/UIScene.js";
import { LoadingScreen } from "../LoadingScreen.js";
import { CarManager } from "../Car/CarManager.js";
import { GAMESTATE } from "../GameState.js";
import { globalAssetManager, DEFAULT_CAR_CONFIG } from "../GlobalAssets.js";
import { computeScaleForWidth, ROT_X_TO_NEGZ, rotationY, rotationZ } from "../Car/CarUtils.js";
import { mat3Mul } from "../World3D/Utils/Mat3Utils.js";

/* Note:
    use https://itch.io/game-assets/free/tag-3d/tag-tree for more models
*/

/* Meshes used:
    Object Layer: 9 * objectsPerChunkPerSide(50) * 2 * meshes_per_object(1) (in theory, lazy loading for small objects far away)
    Road Layer: 42
    ground Layer: 42
    mountain Layer: 0
    Car Layer: todo
*/

/* 3D Models: Count(23)

    Name         High       Medium       Low
                                
    Bush1    |  198 tris |  138 tris | ---- tris
    Bush2    |  250 tris |  142 tris | ---- tris
    Bush3    |  208 tris |  139 tris | ---- tris
    Bush4    |  116 tris |   83 tris | ---- tris

    Grass1   |   40 tris | ---- tris | ---- tris
    Grass2   |   60 tris | ---- tris | ---- tris
    Grass3   |  100 tris | ---- tris | ---- tris

    Rock1    |  128 tris |   76 tris | ---- tris
    Rock2    |  394 tris |  241 tris | ---- tris
    Rock3    |  154 tris |  107 tris | ---- tris

    Tree1    |  413 tris |  123 tris |   59 tris
    Tree2    |  276 tris |   82 tris |   52 tris
    Tree3    |  435 tris |  130 tris |   64 tris
    Tree4    |  128 tris |   38 tris |   34 tris
    Tree5    |  348 tris |  104 tris |   60 tris
*/

/* Debug Features
    ShowMeshes: for ground and street
    arrows to move cam arround car, up/down to move car in 4 spots, left/right to rot cam
    showcarbounds
*/

//Scene when driving from 1 city to another
export class DriveScene extends UIScene {

    static assets = null;

    static async create(app, distance, existingLoadingScreen = null) {
        const loadingScreen = existingLoadingScreen ?? new LoadingScreen(app);
        if (!existingLoadingScreen) SceneStack.pushScene(loadingScreen);

        //static images that the scene uses
        const imageAssets = [
            "assets/street.png",
            "assets/mountains.png",
            "assets/ground.png"
        ];

        const modelAssets = {
            trees: {
                high: [
                    "Tree1_high",
                    "Tree2_high",
                    "Tree3_high",
                    "Tree4_high",
                    "Tree5_high"
                ],
                medium: [
                    "Tree1_med",
                    "Tree2_med",
                    "Tree3_med",
                    "Tree4_med",
                    "Tree5_med"
                ],
                low: [
                    "Tree1_low",
                    "Tree2_low",
                    "Tree3_low",
                    "Tree4_low",
                    "Tree5_low"
                ]
            },
            rocks: {
                high: [
                    "Rock1_high",
                    "Rock2_high",
                    "Rock3_high"
                ],
                medium: [
                    "Rock1_med",
                    "Rock2_med",
                    "Rock3_med"
                ]
            },
            grass: {
                high: [
                    "Grass1_high",
                    "Grass2_high",
                    "Grass3_high"
                ]
            },
            bushes: {
                high: [
                    "Bush1_high",
                    "Bush2_high",
                    "Bush3_high",
                    "Bush4_high"
                ],
                medium: [
                    "Bush1_med",
                    "Bush2_med",
                    "Bush3_med",
                    "Bush4_med"
                ]
            }
        };

        DriveScene.assets = {
            trees: { high: [], medium: [], low: [] },
            rocks: { high: [], medium: [] },
            grass: { high: [] },
            bushes: { high: [], medium: [] }
        };

        const tasks = [];
        const labels = [];

        // Static images
        for (const path of imageAssets) {
            tasks.push(async () => {
                await PIXI.Assets.load(path);
            });

            labels.push(`Loading Images`);
        }

        // Models
        for (const [category, levels] of Object.entries(modelAssets)) {
            for (const [level, models] of Object.entries(levels)) {
                for (const modelName of models) {
                    const path = `assets/models/nature/${modelName}.json`;

                    tasks.push(async () => {
                        const model = await ModelLoader.load(path);
                        DriveScene.assets[category][level].push(model);
                    });

                    labels.push(`Loading ${modelName}`);
                }
            }
        }

        await loadingScreen.run(
            tasks,
            null,
            labels
        );

        return new DriveScene(app, distance);
    }

    ///@param app - PixiJs Application
    ///@param distance - how many meters the user has to drive to the next city
    constructor(app, distance) {
        super(app, "DriveScene");
        this.uiScene = new PIXI.Container();
        this.world3dScene = new PIXI.Container();

        const scaledDistance = distance * 20;
        this.distance = scaledDistance;

        this.camPos3dStart = {x: 0, y: 100, z: 0};
        const camRot = { x: -0.15, y: 0, z: 0 };
        this.camera = new Camera(app, this.camPos3dStart, camRot);

        this.mountainLayer = new PIXI.Container();
        this.groundLayer = new PIXI.Container();
        this.roadLayer = new PIXI.Container();
        this.objectLayer = new PIXI.Container();
        this.carLayer = new PIXI.Container();
        this.overlayLayer = new PIXI.Container();
        this.debugLayerUI = new PIXI.Container();
        this.debugLayerWorld = new PIXI.Container();

        this.world3dScene.addChild(this.mountainLayer);
        this.world3dScene.addChild(this.groundLayer);
        this.world3dScene.addChild(this.roadLayer);
        this.world3dScene.addChild(this.objectLayer);
        this.world3dScene.addChild(this.carLayer);
        this.world3dScene.addChild(this.debugLayerWorld);
        
        //Background -> Foreground
        this.uiScene.addChild(this.debugLayerUI);
        this.uiScene.addChild(this.overlayLayer);

        //Player Car
        this.carZOffset = 250; //how many world units the car is infornt of the cam
        this.carFollowSpeedX = 7.0;
        this.carFollowSpeedZ = 15.0;
        this.carWidth = RoadManager.width * 2.0 / 3.0 * 0.7; //world units
        this.carManager = new CarManager(this.carLayer, globalAssetManager);
        const playerCarConfig = GAMESTATE.getCurrentCarConfig();
        this.carVisualPos = { x: 0, y: 0, z: this.camPos3dStart.z - this.carZOffset };
        const baseAsset = globalAssetManager.getAssetByName(playerCarConfig.base);
        const carScale = computeScaleForWidth(baseAsset, this.carWidth);

        this.playerCar = this.carManager.spawnPlayerCar(playerCarConfig, this.carVisualPos, carScale);
        this.playerCar.rotate(ROT_X_TO_NEGZ);
        this.playerCar.repositionToGround();
        this.carVisualPos.y = this.playerCar.pos3d.y;

        //steering
        this.baseRot = this.playerCar.getRotation();
        this.rot_tire_FR = this.playerCar.getRotation("socket_tire_FR");
        this.rot_tire_FL = this.playerCar.getRotation("socket_tire_FL");
        this.rot_tire_RL = this.playerCar.getRotation("socket_tire_RL");
        this.rot_tire_RR = this.playerCar.getRotation("socket_tire_RR");
        this.maxSteeringAngle = 0.21; // ca. 12°
        this.steeringSpeed = 8;
        this.steeringAngle = 0;
        this.steeringTarget = 0;
        const bounds = this.playerCar.getLocalBounds("socket_tire_FR");
        this.wheelRadius = (bounds.max.y - bounds.min.y) * 0.5;

        //Debug
        this.dDown = false;
        this.uDown = false;
        this.level = 0;
        this.carXOffset = 0;

        //road
        this.road = new RoadManager(
            app,
            this.camera,
            this.roadLayer,
            this.debugLayerUI,
            scaledDistance
        );

        // mountains
        this.mountains = new MountainManager(
            app,
            this.camera,
            this.mountainLayer
        );

        //objects at the side of the road (trees, rocks, etc.)
        this.objects = new ObjectManager(
            app, 
            this.camera, 
            this.objectLayer,
            scaledDistance,
            DriveScene.assets
        );

        this.overlay = new OverlayManager(app, this.overlayLayer);
        this.displaySpeed = 0;
        this.speedUpdateTimer = 0;

        //base background
        const groundLength = scaledDistance + 3200;
        const groundPos = {
            x: 0,
            y: -1,
            z: 50 - scaledDistance * 0.5
        };
        this.ground = new GroundManager(app, this.camera, this.groundLayer, this.debugLayerUI, groundPos, {x: 5000, y: groundLength });

        app.ticker.add(this.update, this);
    }

    destroy() {
        this.app.ticker.remove(this.update, this);
        this.road.destroy();
        this.mountains.destroy();
        this.objects.destroy();
        this.overlay.destroy();
        this.ground.destroy();
        this.carManager.destroy();
    }

    async update(ticker) {
        //frame indipendant
        const dt = ticker.deltaMS / 1000;

        const speedZ = this.playerCar.properties.speed;
        const baseSpeedZ = speedZ * 0.6;
        const additionalSpeedZ = speedZ * 0.4;
        const speedX = speedZ * 0.25;

        const newCamPos = { x: this.camera.pos3d.x, y: this.camera.pos3d.y, z: this.camera.pos3d.z };
        const oldCamPosZ = this.camera.pos3d.z;
        newCamPos.z -= baseSpeedZ * dt;

        let steeringInput = 0;

        //DEBUG START
        if (window.DEBUG.enabled) {
            let newInput = false;
            if (Input.isKeyDown("ArrowDown")) {
                if (!this.dDown){
                    this.level += 1;
                    if (this.level >= 4) this.level = 0;
                    newInput = true;
                }
                this.dDown = true;
            }
            else {
                this.dDown = false;
            }
            if (Input.isKeyDown("ArrowUp")) {
                if (!this.uDown){
                    this.level -= 1;
                    if (this.level < 0) this.level = 3;
                    newInput = true;
                }
                this.uDown = true;
            }
            else {
                this.uDown = false;
            }

            if (Input.isKeyDown("ArrowLeft")) { 
                this.camera.rot3d.y += dt;
            }
            if (Input.isKeyDown("ArrowRight")) {
                this.camera.rot3d.y -= dt;
            }

            if (newInput) {
                if (this.level == 0){
                    this.carXOffset = 0;
                    this.carZOffset = 250;
                } 
                if (this.level == 1){
                    this.carXOffset = -200;
                    this.carZOffset = 0;
                } 
                if (this.level == 2){
                    this.carXOffset = 0;
                    this.carZOffset = -250;
                } 
                if (this.level == 3){
                    this.carXOffset = 200;
                    this.carZOffset = 0;
                }
            }
        }
        //DEBUG END

        // Move Camera based on Inputs
        if (Input.isKeyDown("KeyW")){
            newCamPos.z -= additionalSpeedZ * dt;
        }
        if (Input.isKeyDown("KeyS")){
            newCamPos.z += additionalSpeedZ * dt;
        }
        if (Input.isKeyDown("KeyD")){
            steeringInput -= 1;
            newCamPos.x += speedX * dt;
        }
        if (Input.isKeyDown("KeyA")){
            steeringInput += 1;
            newCamPos.x -= speedX * dt;
        }
        const oldX = newCamPos.x;

        const minX = (-RoadManager.width + this.playerCar.getLocalBounds().max.x) * 0.5;
        const maxX = (RoadManager.width - this.playerCar.getLocalBounds().max.x) * 0.5;

        newCamPos.x = Math.max(minX, Math.min(newCamPos.x, maxX));
        newCamPos.z = Math.min(newCamPos.z, 0);
        this.camera.pos3d = newCamPos;

        if (oldX !== newCamPos.x) steeringInput = 0;

        const distanceCovered = this.camPos3dStart.z - this.camera.pos3d.z;
        if (distanceCovered >= this.distance){
            console.log("finish");
            
            const scene = await MapScene.create(this.app);
            SceneStack.pushScene(scene);
            return;
        }

        //position lerping 
        const targetX = this.camera.pos3d.x + this.carXOffset;
        const targetZ = this.camera.pos3d.z - this.carZOffset;
        const followTX = 1 - Math.exp(-this.carFollowSpeedX * dt);
        const followTZ = 1 - Math.exp(-this.carFollowSpeedZ * dt);
        
        this.carVisualPos.x += (targetX - this.carVisualPos.x) * followTX;
        this.carVisualPos.z += (targetZ - this.carVisualPos.z) * followTZ;
        this.playerCar.setPosition(this.carVisualPos);

        //steering rotation for rootPiece and front tires
        this.steeringTarget = steeringInput * this.maxSteeringAngle;
        const steeringFollow = 1 - Math.exp(-this.steeringSpeed * dt);
        this.steeringAngle += (this.steeringTarget - this.steeringAngle) * steeringFollow;
        const addRot = rotationY(-this.steeringAngle);
        const steeringRot = rotationY(-this.steeringAngle);

        //wheel rolling * wheel steering
        const wheelRotation = ((oldCamPosZ - this.camera.pos3d.z) / this.wheelRadius);
        const rotWheel = rotationZ(-wheelRotation);

        this.rot_tire_FR = mat3Mul(rotWheel, this.rot_tire_FR);
        this.rot_tire_FL = mat3Mul(rotWheel, this.rot_tire_FL);
        this.rot_tire_RL = mat3Mul(rotWheel, this.rot_tire_RL);
        this.rot_tire_RR = mat3Mul(rotWheel, this.rot_tire_RR);

        this.playerCar.setRotation(mat3Mul(this.baseRot, addRot));
        this.playerCar.setRotation(mat3Mul(steeringRot, this.rot_tire_FR), "socket_tire_FR");
        this.playerCar.setRotation(mat3Mul(steeringRot, this.rot_tire_FL), "socket_tire_FL");
        this.playerCar.setRotation(this.rot_tire_RL, "socket_tire_RL");
        this.playerCar.setRotation(this.rot_tire_RR, "socket_tire_RR");


        //debug car bounds
        if (window.DEBUG.enabled && window.DEBUG.showCarBounds) {
            this.playerCar.showDebugOutline(this.debugLayerWorld);
        } else {
            this.playerCar.hideDebugOutline();
        }


        //update mountains
        this.mountains.update();
        
        //update roadsegments
        this.road.update();
        
        //update object layer
        this.objects.update();
        
        //update ground
        this.ground.update(this.app, this.camera);

        this.speedUpdateTimer += dt;
        if (this.speedUpdateTimer >= 0.5) {
            this.displaySpeed = Math.abs((oldCamPosZ - this.camera.pos3d.z) / dt);
            this.speedUpdateTimer = 0;
        }

        this.overlay.update(distanceCovered, this.displaySpeed);

        this.camera.update();
    }
}