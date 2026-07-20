import * as PIXI from "pixi.js";
import { Camera } from "../World3D/Camera.js";
import { Input } from "../Utils/Input.js";
import { RoadSegment } from "./RoadSegment.js";
import { GroundManager } from "./GroundManager.js";

//TODO:
// trees/other as 2d sprites but with worldPos and worldSize
// moutains as background
// performance upgrades like dont render roadsegments not visible to the camera

export class DriveScene extends PIXI.Container {

    constructor(app) {
        super();

        this.app = app;
        app.ticker.add(this.update, this);

        this.label = "DriveScene";

        this.camera = new Camera(app);

        //world units movement per second
        this.speed = 10;

        this.debugLayer = new PIXI.Container();
        this.groundLayer = new PIXI.Container();
        this.roadLayer = new PIXI.Container();
        this.objectLayer = new PIXI.Container();

        this.addChild(this.groundLayer);
        this.addChild(this.roadLayer);
        this.addChild(this.objectLayer);
        this.addChild(this.debugLayer);

        //road
        this.numSegments = 100;
        this.roadSegments = [];
        for (let i = 0; i < this.numSegments; i++){
            const sizeZ = 50;
            const posZ = -1000 - i * sizeZ;
            const road = new RoadSegment(app, this.camera, this.roadLayer, this.debugLayer, {x: 0, y: 0, z: posZ}, {x: 200, y: sizeZ});
            this.roadSegments.push(road);
        }

        //base background
        const groundPos = {
            x: 0,
            y: -1,
            z: 0
        };
        this.ground = new GroundManager(app, this.camera, this.groundLayer, this.debugLayer, groundPos, {x: 10000, y: 10000 });

    }

    destroy(options) {
        this.app.ticker.remove(this.update, this);

        super.destroy(options);
    }

    update(ticker) {
        //frame indipendant
        const dt = ticker.deltaTime;

        // Move Camera based on Inputs
        if (Input.isKeyDown("KeyW")){
            this.camera.pos3d.z -= this.speed * dt;
        }
        if (Input.isKeyDown("KeyS")){
            this.camera.pos3d.z += this.speed * dt;
        }
        if (Input.isKeyDown("KeyD")){
            this.camera.pos3d.x += this.speed * dt;
        }
        if (Input.isKeyDown("KeyA")){
            this.camera.pos3d.x -= this.speed * dt;
        }

        //update roadsegments
        for (const road of this.roadSegments){
            road.update(this.app, this.camera);
        }

        //update ground
        this.ground.update(this.app, this.camera);

    }

}