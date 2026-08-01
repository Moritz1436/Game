import * as PIXI from "pixi.js";



export class MountainManager {

    constructor(app, cam, layer) {

        this.app = app;
        this.cam = cam;
        this.layer = layer;
        
        //moutains
        this.sprite = PIXI.Sprite.from(
            "assets/mountains.png"
        );

        this.horizonSpriteOffset = 50;

        this.sprite.anchor.set(0.5, 1);

        layer.addChild(this.sprite);

        //fog overlay for transition between mountains and horizon
        this.fog = this.createFogTexture();
        this.fog.anchor.set(0.5, 1);
        layer.addChild(this.fog);


        this.update();
    }

    createFogTexture() {

        const canvas = document.createElement("canvas");

        canvas.width = 4;
        canvas.height = 200;

        const ctx = canvas.getContext("2d");

        const gradient = ctx.createLinearGradient(
            0,
            0,
            0,
            canvas.height
        );

        gradient.addColorStop(0, "rgba(200,220,220,0)");
        gradient.addColorStop(0.5, "rgba(200,220,220,0.4)");
        gradient.addColorStop(1, "rgba(200,220,220,0.6)");

        ctx.fillStyle = gradient;
        ctx.fillRect(
            0,
            0,
            canvas.width,
            canvas.height
        );


        const texture = PIXI.Texture.from(canvas);

        const sprite = new PIXI.Sprite(texture);

        return sprite;
    }


    update() {
        const width = this.app.renderer.width;
        const height = this.app.renderer.height;

        //mountains
        const horizonY = this.cam.getHorizonY();
        const movement = this.cam.pos3d.x * 0.05;

        this.sprite.x = width * 0.5 - movement;
        this.sprite.y = horizonY + this.horizonSpriteOffset;

        this.sprite.width = width * 1.1;
        this.sprite.height = horizonY + this.horizonSpriteOffset;

        //fog transition
        this.fog.x = width * 0.5;
        this.fog.y = horizonY + this.horizonSpriteOffset;

        this.fog.width = width;
        this.fog.height = 120;
    }

    destroy() {
        this.sprite.destroy();
        this.fog.destroy();
    }

}