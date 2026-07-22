import * as PIXI from "pixi.js";
import { Camera } from "../World3D/Camera.js";
import { Input } from "../Utils/Input.js";
import { RoadManager } from "./RoadManager.js";
import { GroundManager } from "./GroundManager.js";
import { MountainManager } from "./MountainManager.js";
import { ModelLoader } from "../Models/ModelLoader.js";
import { ModelInstance } from "../Models/ModelInstance.js";

// TODO:
// trees/other as importable 3d models but with worldPos and worldSize 
// import many more different 3d models like trees, rocks, grass (+ many variations) to create forrest
//      -> own objectManager, that 
//          - deletes objects out of view/renderdistance (when projection is null) and also creates objects (random)
//          - handles levels of detail for each object (far, middle, near)
//          - adds lighting to objects (maybe put into modelInstance or smth)
// clouds behind the mountains
// a more realistic transition between mountainsSprite and horizon
// other cars (-> collisions, spawning etc)
// your own car

// LATER: 
// bioms (+ biom specific surrounding models)
// street has curves and ground not always being flat -> little elevations

//Scene when driving from 1 city to another
export class DriveScene extends PIXI.Container {

    static treeAsset = null;

    static async create(app, distance) {

        //static images that the scene uses
        await PIXI.Assets.load([
            //StreetSegment texture
            "assets/street.png",

            //background Mountains
            "assets/mountains.png"
        ]);

        DriveScene.treeAsset = await ModelLoader.load(
            "assets/models/tree.json"
        );

        return new DriveScene(app, distance);
    }

    ///@param app - PixiJs Application
    ///@param distance - how many meters the user has to drive to the next city
    constructor(app, distance) {
        super();

        const scaledDistance = distance * 20;

        this.app = app;

        this.label = "DriveScene";

        this.camera = new Camera(app);

        //world units movement per second
        this.speedX = 150;
        this.speedZ = 500;

        this.mountainLayer = new PIXI.Container();
        this.groundLayer = new PIXI.Container();
        this.roadLayer = new PIXI.Container();
        this.objectLayer = new PIXI.Container();
        this.debugLayer = new PIXI.Container();

        //Background -> Foreground
        this.addChild(this.mountainLayer);
        this.addChild(this.groundLayer);
        this.addChild(this.roadLayer);
        this.addChild(this.objectLayer);
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

        
        // 2 DEMO trees
        this.trees = [];
        this.trees.push(
            new ModelInstance(
                DriveScene.treeAsset,
                this.objectLayer,
                {
                    x: 50,
                    y: 0,
                    z: -200
                },
                20
            ),
            new ModelInstance(
                DriveScene.treeAsset,
                this.objectLayer,
                {
                    x: -80,
                    y: 0,
                    z: -400
                },
                25
            )
        );

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

    destroy(options) {
        this.app.ticker.remove(this.update, this);
        this.road.destroy();
        this.mountains.destroy();

        super.destroy(options);
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

        this.mountains.update();

        //update roadsegments
        this.road.update();

        //update ground
        this.ground.update(this.app, this.camera);

        // DEMO update trees
        for (const tree of this.trees) {
            tree.update(this.app, this.camera);
        }

    }

}