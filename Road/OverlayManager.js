import * as PIXI from "pixi.js";



//overlay for DriveScene
export class OverlayManager {

    constructor(app, layer) {
        this.app = app;
        this.container = layer;

        //bg
        this.background = new PIXI.Graphics();

        this.container.addChild(this.background);

        const fontSize = app.renderer.height * 0.15 * 0.4;

        // Text Style
        this.style = new PIXI.TextStyle({
            fontFamily: "Arial",
            fontSize: fontSize,
            fill: 0xffffff
        });

        this.distanceText = new PIXI.Text({
            text: "Distance: 0m",
            style: this.style
        });

        this.speedText = new PIXI.Text({
            text: "Speed: 0 km/h",
            style: this.style
        });

        this.container.addChild(
            this.distanceText,
            this.speedText
        );

        app.renderer.on("resize", this.onResize);
        this.onResize();
    }

    onResize() {
        const w = this.app.renderer.width;
        const h = this.app.renderer.height;
        const barHeight = h * 0.15;

        this.background.clear();

        this.background.rect(
            0,
            0,
            w,
            barHeight
        );

        this.background.fill({
            color: 0x333333,
            alpha: 0.7
        });

        const distanceBounds = this.distanceText.getBounds();
        const speedBounds = this.speedText.getBounds();

        this.style.fontSize = barHeight * 0.4;

        this.distanceText.position.set(
            w * 0.1,
            (barHeight - distanceBounds.height) * 0.5
        );

        this.speedText.position.set(
            w * 0.9 - speedBounds.width,
            (barHeight - speedBounds.height) * 0.5
        );
    }

    update(distance, speed) {
        this.distanceText.text = `Distance: ${Math.floor(distance)}m`;

        this.speedText.text = `Speed: ${Math.floor(speed)} km/h`;
    }

    destroy() {
        this.app.renderer.off("resize", this.onResize);
        
        this.container.destroy({
            children: true
        });
    }

}