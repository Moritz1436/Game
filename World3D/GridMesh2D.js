import * as PIXI from "pixi.js";
import { Object3D } from "./Object3D.js"

// 1 rectangular Mesh internally subdevided into many rectangles 
// for a cleaner texture when projecting from 3d to 2d
export class GridMesh2D extends Object3D {

    ///@param app - PixiJs application
    ///@param cam - Camera Object of the Screen
    ///@param rows - into how many rows the mesh's geometry will be devided (with verticies)
    ///@param cols - into how many cols the mesh's geometry will be devided (with verticies)
    ///@param texture - texture that will be put onto the mesh
    ///@param texCover2d - how the texture should cover the mesh (-1 full cover; any other will be world units until the texture repeats)
    ///@param pos3d - position of the Mesh (center)
    ///@param size2d - size (use .x and .y); y -> z
    constructor(app, cam, rows, cols, texture, texCover2d, pos3d, size2d) {
        super(pos3d, {x: size2d.x, y: 0, z: size2d.y});

        this.rows = rows;
        this.cols = cols;

        this.texLengthX = texCover2d.x;
        this.texLengthZ = texCover2d.y;
        
        this.rawVerticies = [];
        this.uvs = [];
        this.indices = [];

        const horSegSize = this.size3d.z / this.rows;
        const vertSegSize = this.size3d.x / this.cols;
        for (let i = 0; i <= this.cols; i++){
            const x = (this.pos3d.x - this.size3d.x * 0.5) + i * vertSegSize;
            for (let j = 0; j <= this.rows; j++){
                const z = (this.pos3d.z - this.size3d.z * 0.5) + j * horSegSize;

                this.rawVerticies.push({x: x, y: this.pos3d.y, z: z});

                let u;
                let v;

                // X
                if (this.texLengthX === -1) {
                    // tex over full width
                    u = (x - (this.pos3d.x - this.size3d.x * 0.5)) / this.size3d.x;
                } else {
                    // repeat tex every texLengthX units
                    u = x / this.texLengthX;
                }

                // Z
                if (this.texLengthZ === -1) {
                    // tex over full width
                    v = (z - (this.pos3d.z - this.size3d.z * 0.5)) / this.size3d.z;
                } else {
                    // repeat tex every texLengthZ units
                    v = z / this.texLengthZ;
                }

                this.uvs.push(u, v);
            }
        }


        const vertsPerRow = this.rows + 1;
        for (let row = 0; row < this.cols; row++) {
            for (let col = 0; col < this.rows; col++) {

                const topLeft = row * vertsPerRow + col;
                const topRight = topLeft + 1;
                const bottomLeft = topLeft + vertsPerRow;
                const bottomRight = bottomLeft + 1;

                this.indices.push(
                    topLeft,
                    topRight,
                    bottomLeft,

                    topRight,
                    bottomRight,
                    bottomLeft
                );
            }
        }

        const w = app.renderer.width;
        const h = app.renderer.height;

        const verticies = [];
        for (const vertex of this.rawVerticies){
            const p = cam.project(vertex, w, h);

            verticies.push(p.x, p.y);
        }

        this.geometry = new PIXI.MeshGeometry({
            positions: new Float32Array(verticies),
            uvs: new Float32Array(this.uvs),
            indices: new Uint32Array(this.indices)
        });        
        
        this.mesh = new PIXI.Mesh({
            geometry: this.geometry,
            texture: texture
        });
        this.geometry.getBuffer("aPosition").update();

        this.mesh.position.set(0,0);
    }

    update(app, cam) {
        const w = app.renderer.width;
        const h = app.renderer.height;

        for (let i = 0; i < this.rawVerticies.length; i++){
            const vert = this.rawVerticies[i];
            const p = cam.project(vert, w, h);

            if (p) {
                this.geometry.positions[i * 2] = p.x;
                this.geometry.positions[i * 2 + 1] = p.y;
            }
        }

        this.geometry.getBuffer("aPosition").update();
    }

}