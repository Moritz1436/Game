import * as PIXI from "pixi.js";
import { Camera } from "../World3D/Camera.js";
import { Input } from "../Utils/Input.js";
import { RoadSegment } from "./RoadSegment.js";


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

        this.numSegments = 100;
        this.roadSegments = [];
        for (let i = 0; i < this.numSegments; i++){
            const sizeZ = 50;
            const posZ = -1000 - i * sizeZ;
            const road = new RoadSegment(this, {x: 0, y: 0, z: posZ}, {x: 200, y: sizeZ});
            this.roadSegments.push(road);
            this.addChild(road.getMesh());
        }

        this.speed = 10;

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
            this.camera.z -= this.speed * dt;
        }
        if (Input.isKeyDown("KeyS")){
            this.camera.z += this.speed * dt;
        }
        if (Input.isKeyDown("KeyD")){
            this.camera.x += this.speed * dt;
        }
        if (Input.isKeyDown("KeyA")){
            this.camera.x -= this.speed * dt;
        }

        for (const road of this.roadSegments){
            road.update(this.app, this.camera);
        }

    }

}