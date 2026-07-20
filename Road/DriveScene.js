import * as PIXI from "pixi.js";
import { Camera } from "../World3D/Camera.js";
import { Input } from "../Utils/Input.js";
import { RoadManager } from "./RoadManager.js";
import { GroundManager } from "./GroundManager.js";
import { MountainManager } from "./MountainManager.js";

//TODO:
// trees/other as 2d sprites but with worldPos and worldSize
// clouds behind the mountains
// a more realistic transition between mountainsSprite and horizon

//Scene when driving from 1 city to another
// 1 World Unit == 1 Meter
export class DriveScene extends PIXI.Container {

    ///@param app - PixiJs Application
    ///@param distance - how many meters the user has to drive to the next city
    constructor(app, distance) {
        super();

        const scaledDistance = distance * 20;

        this.app = app;
        app.ticker.add(this.update, this);

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

        //base background
        const groundLength = scaledDistance + 3200;
        const groundPos = {
            x: 0,
            y: -1,
            z: 50 - scaledDistance * 0.5
        };
        this.ground = new GroundManager(app, this.camera, this.groundLayer, this.debugLayer, groundPos, {x: 5000, y: groundLength });

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

    }

}