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

        //world units movement per second
        this.speedX = 250;
        this.speedZ = 800;

        this.mountainLayer = new PIXI.Container();
        this.groundLayer = new PIXI.Container();
        this.roadLayer = new PIXI.Container();
        this.objectLayer = new PIXI.Container();
        this.carLayer = new PIXI.Container();
        this.overlayLayer = new PIXI.Container();
        this.debugLayer = new PIXI.Container();

        this.world3dScene.addChild(this.mountainLayer);
        this.world3dScene.addChild(this.groundLayer);
        this.world3dScene.addChild(this.roadLayer);
        this.world3dScene.addChild(this.objectLayer);
        this.world3dScene.addChild(this.carLayer);
        
        //Background -> Foreground
        this.uiScene.addChild(this.debugLayer);
        this.uiScene.addChild(this.overlayLayer);

        this.carManager = new CarManager(this.carLayer, globalAssetManager);
        const playerCarConfig = GAMESTATE.ownedCars[GAMESTATE.activeCarIndex] ?? DEFAULT_CAR_CONFIG;
        const startPos = { x: 0, y: 0, z: this.camPos3dStart.z - 200 };

        this.playerCar = this.carManager.spawnPlayerCar(playerCarConfig, startPos, 30);
        this.playerCar.rotateRoot("-z");

        //road
        this.road = new RoadManager(
            app,
            this.camera,
            this.roadLayer,
            this.debugLayer,
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

        //base background
        const groundLength = scaledDistance + 3200;
        const groundPos = {
            x: 0,
            y: -1,
            z: 50 - scaledDistance * 0.5
        };
        this.ground = new GroundManager(app, this.camera, this.groundLayer, this.debugLayer, groundPos, {x: 5000, y: groundLength });

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

        let delta = {x: 0, y: 0, z: 0};

        // Move Camera based on Inputs
        if (Input.isKeyDown("KeyW")){
            delta.z -= this.speedZ * dt;
        }
        if (Input.isKeyDown("KeyS")){
            delta.z += this.speedZ * dt;
        }
        if (Input.isKeyDown("KeyD")){
            delta.x += this.speedX * dt;
        }
        if (Input.isKeyDown("KeyA")){
            delta.x -= this.speedX * dt;
        }

        const distanceCovered = this.camPos3dStart.z - this.camera.pos3d.z;
        if (distanceCovered >= this.distance){
            console.log("finish");
            
            const scene = await MapScene.create(this.app);
            SceneStack.pushScene(scene);
            return;
        }

        //move objects
        this.camera.pos3d.x += delta.x;
        this.camera.pos3d.y += delta.y;
        this.camera.pos3d.z += delta.z;
        this.carManager.playerCar.move(delta);


        //update mountains
        this.mountains.update();
        
        //update roadsegments
        this.road.update();
        
        //update object layer
        this.objects.update();
        
        //update ground
        this.ground.update(this.app, this.camera);

        this.overlay.update(distanceCovered, this.speedZ);

        this.camera.update();
    }

}