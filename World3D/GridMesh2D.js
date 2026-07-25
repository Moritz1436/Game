import * as PIXI from "pixi.js";
import { Object3D } from "./Object3D.js"

// 1 rectangular Mesh internally subdevided into many rectangles 
// for a cleaner texture when projecting from 3d to 2d
export class GridMesh2D extends Object3D {

    ///@param app - PIXIJS Application
    ///@param cam - Camera Object of the 3d World
    ///@param layer - Pixi.Container to add the Mesh to
    ///@param debugLayer - Pixi.Container for debug renderes
    ///@param rows - into how many rows the mesh's geometry will be devided (with verticies)
    ///@param cols - into how many cols the mesh's geometry will be devided (with verticies)
    ///@param texture - texture that will be put onto the mesh
    ///@param texCover2d - how the texture should cover the mesh (-1 full cover; any other will be world units until the texture repeats)
    ///@param pos3d - position of the Mesh (center)
    ///@param size2d - size (use .x and .y); y -> z
    constructor(app, cam, layer, debugLayer, rows, cols, texture, texCover2d, pos3d, size2d) {
        super(pos3d, {x: size2d.x, y: 0, z: size2d.y});

        this.rows = rows;
        this.cols = cols;

        this.texLengthX = texCover2d.x;
        this.texLengthZ = texCover2d.y;

        this.debugGraphics = null;
        this.debugLayer = debugLayer;

        this.rawVerticies = [];
        this.uvs = [];
        this.indices = [];

        const stepX = this.size3d.x / cols;
        const stepZ = this.size3d.z / rows;

        for (let x = 0; x <= cols; x++) {
            for (let z = 0; z <= rows; z++) {

                const localX = -this.size3d.x * 0.5 + x * stepX;
                const localZ = -this.size3d.z * 0.5 + z * stepZ;

                this.rawVerticies.push({
                    x: localX,
                    y: 0,
                    z: localZ
                });

                let u;
                let v;

                if (this.texLengthX === -1) {
                    u = x / cols;
                } else {
                    u = (pos3d.x + localX) / this.texLengthX;
                }


                if (this.texLengthZ === -1) {
                    v = z / rows;
                } else {
                    v = -(pos3d.z + localZ) / this.texLengthZ;
                }

                this.uvs.push(u, v);
            }
        }


        const vertsPerRow = rows + 1;

        for (let x = 0; x < cols; x++) {
            for (let z = 0; z < rows; z++) {

                const a = x * vertsPerRow + z;
                const b = a + 1;
                const c = a + vertsPerRow;
                const d = c + 1;

                this.indices.push(
                    a,b,c,
                    b,d,c
                );
            }
        }

        this.geometry = new PIXI.MeshGeometry({
            positions: new Float32Array(this.rawVerticies.length * 2),
            uvs: new Float32Array(this.uvs),
            indices: new Uint32Array(this.indices)
        });        
        
        this.mesh = new PIXI.Mesh({
            geometry: this.geometry,
            texture: texture
        });
        //Debug count stats
        window.DEBUG.meshes++;
        window.DEBUG.triangles += this.indices.length / 3;

        this.geometryPositionBuffer = this.geometry.getBuffer("aPosition");

        this.update(app,cam);
    }

    destroy(layer) {
        //Debug count stats
        window.DEBUG.meshes--;
        window.DEBUG.triangles -= this.indices.length / 3;
        this.mesh.destroy();
        this.geometry.destroy();
        layer.removeChild(this.mesh);

        if (this.debugGraphics) {
            this.debugGraphics.destroy();
            this.debugLayer.removeChild(this.debugGraphics);
            this.debugGraphics = null;
        }
    }

    update(app, cam) {
        const w = app.renderer.width;
        const h = app.renderer.height;

        let visible = true;

        //update projected verticies
        for (let i = 0; i < this.rawVerticies.length; i++){
            const local = this.rawVerticies[i];
            const world = {
                x: this.pos3d.x + local.x,
                y: this.pos3d.y + local.y,
                z: this.pos3d.z + local.z
            };

            const p = cam.project(world, w, h);

            if (p) {
                this.geometry.positions[i * 2] = p.x;
                this.geometry.positions[i * 2 + 1] = p.y;
            }
            else {
                visible = false;
                break;
            }
        }

        this.mesh.visible = visible;

        //  DEBUG DRAW BORDER ARROUND MESHES
        if (window.DEBUG.enabled && window.DEBUG.showMeshes && visible) {

            if (!this.debugGraphics) {
                this.debugGraphics = new PIXI.Graphics();
                this.debugLayer.addChild(this.debugGraphics);
            }

            this.debugGraphics.clear();

            this.renderDebugOutlines(cam, w, h);
        }
        else {
            if (this.debugGraphics) {
                this.debugGraphics.clear();
                if (!window.DEBUG.showMeshes) {
                    this.debugGraphics.destroy();
                    this.debugGraphics = null;
                }
            }
        }

        this.geometryPositionBuffer.update();
    }


    renderDebugOutlines(cam, w, h) {
        const cornerIndices = [
            0,
            this.rows,
            this.cols * (this.rows + 1),
            this.cols * (this.rows + 1) + this.rows
        ];
        const corners = [];

        for (const index of cornerIndices) {
            const local = this.rawVerticies[index];

            const world = {
                x: this.pos3d.x + local.x,
                y: this.pos3d.y + local.y,
                z: this.pos3d.z + local.z
            };

            const p = cam.project(world, w, h);

            if (p) {
                corners.push(p);
            }
        }

        if (corners.length === 4) {
            this.debugGraphics.moveTo(
                corners[0].x,
                corners[0].y
            );

            this.debugGraphics.lineTo(
                corners[1].x,
                corners[1].y
            );

            this.debugGraphics.lineTo(
                corners[3].x,
                corners[3].y
            );

            this.debugGraphics.lineTo(
                corners[2].x,
                corners[2].y
            );

            this.debugGraphics.closePath();

            this.debugGraphics.stroke({
                color: 0xff0000,
                width: 2
            });
        }
    }

}