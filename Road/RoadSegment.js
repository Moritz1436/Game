import * as PIXI from "pixi.js";
import { GridMesh2D } from "../World3D/GridMesh2D.js"


//1 road piece which is made out of 1 Mesh
export class RoadSegment {

    ///@param roadRenderer - belonging Scene
    ///@param pos3d - position of the RoadSegment (center)
    ///@param size2d - size of the RoadSegment (.x and .y) y -> z
    constructor(roadRenderer, pos3d, size2d) {

        // world units for 1 texture until repeat
        const texLengthZ = 100;

        //how many segments per mesh/roadsegment (segment is subdevided in the geo with more verticies)
        const verticalSegments = 20;
        const horizontalSegments = 100;

        this.texture = PIXI.Assets.get("assets/street.png");
        this.texture.source.addressMode = "repeat";

        this.gridMesh2d = new GridMesh2D(
            roadRenderer.app, 
            roadRenderer.camera, 
            horizontalSegments, 
            verticalSegments, 
            this.texture, 
            { x: -1, y: texLengthZ}, 
            pos3d, 
            size2d
        );
    }

    getMesh() {
        return this.gridMesh2d.mesh;
    }

    update(app, cam) {
        this.gridMesh2d.update(app, cam);
    }
}