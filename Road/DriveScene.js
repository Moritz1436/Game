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
export class DriveScene extends PIXI.Container {

    static assets = null;

    static async create(app, distance) {

        //static images that the scene uses
        await PIXI.Assets.load([
            //StreetSegment texture
            "assets/street.png",

            //background Mountains
            "assets/mountains.png",

            //ground
            "assets/ground.png"
        ]);

        //load assets
        DriveScene.assets = {
            trees: {
                high: [
                    await ModelLoader.load("assets/models/Tree1_high.json"),
                    await ModelLoader.load("assets/models/Tree2_high.json"),
                    await ModelLoader.load("assets/models/Tree3_high.json"),
                    await ModelLoader.load("assets/models/Tree4_high.json"),
                    await ModelLoader.load("assets/models/Tree5_high.json")
                ],
                medium: [
                    await ModelLoader.load("assets/models/Tree1_med.json"),
                    await ModelLoader.load("assets/models/Tree2_med.json"),
                    await ModelLoader.load("assets/models/Tree3_med.json"),
                    await ModelLoader.load("assets/models/Tree4_med.json"),
                    await ModelLoader.load("assets/models/Tree5_med.json")
                ],
                low: [
                    await ModelLoader.load("assets/models/Tree1_low.json"),
                    await ModelLoader.load("assets/models/Tree2_low.json"),
                    await ModelLoader.load("assets/models/Tree3_low.json"),
                    await ModelLoader.load("assets/models/Tree4_low.json"),
                    await ModelLoader.load("assets/models/Tree5_low.json")
                ]
            },
            rocks: {
                high: [
                    await ModelLoader.load("assets/models/Rock1_high.json"),
                    await ModelLoader.load("assets/models/Rock2_high.json"),
                    await ModelLoader.load("assets/models/Rock3_high.json")
                ],
                medium: [
                    await ModelLoader.load("assets/models/Rock1_med.json"),
                    await ModelLoader.load("assets/models/Rock2_med.json"),
                    await ModelLoader.load("assets/models/Rock3_med.json")
                ]
            },
            grass: {
                high: [
                    await ModelLoader.load("assets/models/Grass1_high.json"),
                    await ModelLoader.load("assets/models/Grass2_high.json"),
                    await ModelLoader.load("assets/models/Grass3_high.json")
                ]
            },
            bushes: {
                high: [
                    await ModelLoader.load("assets/models/Bush1_high.json"),
                    await ModelLoader.load("assets/models/Bush2_high.json"),
                    await ModelLoader.load("assets/models/Bush3_high.json"),
                    await ModelLoader.load("assets/models/Bush4_high.json")
                ],
                medium: [
                    await ModelLoader.load("assets/models/Bush1_med.json"),
                    await ModelLoader.load("assets/models/Bush2_med.json"),
                    await ModelLoader.load("assets/models/Bush3_med.json"),
                    await ModelLoader.load("assets/models/Bush4_med.json")
                ]
            }
        }

        return new DriveScene(app, distance);
    }

    ///@param app - PixiJs Application
    ///@param distance - how many meters the user has to drive to the next city
    constructor(app, distance) {
        super();

        const scaledDistance = distance * 20;
        this.distance = scaledDistance;

        this.app = app;

        this.label = "DriveScene";

        this.camPos3dStart = {x: 0, y: 100, z: 0};
        this.camera = new Camera(app, this.camPos3dStart);

        //world units movement per second
        this.speedX = 250;
        this.speedZ = 800;

        this.mountainLayer = new PIXI.Container();
        this.groundLayer = new PIXI.Container();
        this.roadLayer = new PIXI.Container();
        this.objectLayer = new PIXI.Container();
        this.overlayLayer = new PIXI.Container();
        this.debugLayer = new PIXI.Container();

        //Background -> Foreground
        this.addChild(this.mountainLayer);
        this.addChild(this.groundLayer);
        this.addChild(this.roadLayer);
        this.addChild(this.objectLayer);
        this.addChild(this.overlayLayer);
        this.addChild(this.debugLayer);

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

        super.destroy({
            children: true
        });
    }

    update(ticker) {
        //frame indipendant
        const dt = ticker.deltaMS / 1000;

        // Move Camera based on Inputs
        if (Input.isKeyDown("KeyW")){
            this.camera.pos3d.z -= this.speedZ * dt;
        }
        if (Input.isKeyDown("KeyS")){
            this.camera.pos3d.z += this.speedZ * dt;
        }
        if (Input.isKeyDown("KeyD")){
            this.camera.pos3d.x += this.speedX * dt;
        }
        if (Input.isKeyDown("KeyA")){
            this.camera.pos3d.x -= this.speedX * dt;
        }

        const distanceCovered = this.camPos3dStart.z - this.camera.pos3d.z;
        if (distanceCovered >= this.distance){
            console.log("finish");
            
            SceneStack.pushScene(this.app, new MapScene(this.app));
            return;
        }

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