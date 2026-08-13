import * as PIXI from "pixi.js";
import * as APP from "../main.js";
import { SceneStack } from "../Utils/SceneStack.js";
import { DriveScene } from "../Road/DriveScene.js";
import { GarageScene } from "../Garage/GarageScene.js";
import { UIScene } from "../Utils/UIScene.js";
import { LoadingScreen } from "../LoadingScreen.js";

export class MapScene extends UIScene {

    static city_data = null;

    static async create(app, existingLoadingScreen = null) {
        const loadingScreen = existingLoadingScreen ?? new LoadingScreen(app);
        if (!existingLoadingScreen) SceneStack.pushScene(loadingScreen);

        await loadingScreen.run(
            [
                //@deprecated city stuff
                async () => {
                    const response = await fetch("/assets/city_locations.json");
                    MapScene.city_data = await response.json();
                },

                async () => {
                    for (const obj of MapScene.city_data.cities) {
                        await PIXI.Assets.load("/assets/" + obj.texture);
                    }
                },

                //static images
                async () => {
                    await PIXI.Assets.load("assets/landscape.png");
                }
            ],
            null,
            [
                "Loading city data",
                "Loading city textures",
                "Loading map"
            ]
        );

        return new MapScene(app);
    }

    constructor(app) {
        super(app, "MapScene");
        this.uiScene = new PIXI.Container();

        this.city_obj = MapScene.city_data;
        this.uiScene.eventMode = "static";
    
        // Background
        const tex = PIXI.Texture.from("assets/landscape.png");
        tex.source.scaleMode = "nearest";
        const background = new PIXI.Sprite(tex);
        background.width = APP.getWidth();
        background.height = APP.getHeight();
        this.uiScene.addChild(background);

        this.uiScene.addChild(this.createButton());
    
        //put cities to the spots written in the city_data
        for (const obj of this.city_obj.cities) {
            const tex2 = PIXI.Texture.from("/assets/" + obj.texture);
            tex2.source.scaleMode = "nearest";
            const img = new PIXI.Sprite(tex2);
    
            img.x = obj.position[0] + 0.5 * img.width;
            img.y = obj.position[1] + 0.5 * img.height;
    
            img.anchor.set(0.5);
            img.eventMode = "static";
            img.cursor = "pointer";
    
            img.on("pointerover", () => {
                img.scale.set(1.2);
                shadow.alpha = 1;
            });
    
    
            img.on("pointerout", () => {
                img.scale.set(1);
                shadow.alpha = 0;
            });
    
            img.on("pointertap", async () => {
                const scene = await GotoCityScene.create(this.app, this.city_obj);
                SceneStack.pushScene(scene, false);
            });
    
            const shadow = new PIXI.Graphics();
    
            shadow.circle(0, 0, 80);
            shadow.fill({
                color: 0x000000,
                alpha: 0.25
            });
    
            shadow.position = img.position.clone();
            shadow.alpha = 0;
    
            this.uiScene.addChildAt(shadow, 0);
    
            this.uiScene.addChild(img);
        }
    }

    createButton() {
        const button = new PIXI.Container();

        // Hintergrund
        const bg = new PIXI.Graphics();

        bg.roundRect(0, 0, 200, 60, 10);

        bg.fill({
            color: 0x3b82f6
        });

        button.addChild(bg);

        // Text
        const text = new PIXI.Text({
            text: "Garage",
            style: {
                fontFamily: "Arial",
                fontSize: 24,
                fill: 0xffffff
            }
        });

        text.anchor.set(0.5);
        text.position.set(100, 30);

        button.addChild(text);

        // Interaktiv machen
        button.eventMode = "static";
        button.cursor = "pointer";

        // Hover
        button.on("pointerover", () => {
            bg.tint = 0xdddddd;
        });

        button.on("pointerout", () => {
            bg.tint = 0xffffff;
        });

        // Klick
        button.on("pointerdown", async () => {
            const scene = await GarageScene.create(this.app);
            SceneStack.pushScene(scene);
        });

        // Position
        button.position.set(this.app.renderer.width * 0.8, this.app.renderer.height * 0.8);

        // Zum Container hinzufügen
        return button;
    }

    destroy() {
    }

}


class GotoCityScene extends UIScene {

    static async create(app, c) {
        return new GotoCityScene(app, c);
    }

    constructor(app, city) {
        super(app, "GotoCityScene");
        this.uiScene = new PIXI.Container();

        this.uiScene.eventMode = "static";

        this.city_obj = city;

        this.onKeyDown = (e) => {
            if (e.key === "Escape") {
                SceneStack.popScene(this.app);
            }
        };

        window.addEventListener("keydown", this.onKeyDown);

        const bg = new PIXI.Graphics();
        
        const width = this.app.screen.width * 0.8;
        const height = this.app.screen.height * 0.8;
        
        const x = (this.app.screen.width - width) / 2;
        const y = (this.app.screen.height - height) / 2;

        const blocker = new PIXI.Graphics();

        blocker.rect(
            0,
            0,
            this.app.screen.width,
            this.app.screen.height
        );

        blocker.fill({
            color: 0x000000,
            alpha: 0
        });

        blocker.eventMode = "static";

        this.uiScene.addChild(blocker);

        const panel = new PIXI.Container();
        panel.position.set(x, y);

        blocker.on("pointertap", (e) => {
            e.stopPropagation();

            // Scene schließen
            SceneStack.popScene(this.app);
        });
        
        bg.roundRect(
            0,
            0,
            width,
            height,
            10
        );
        
        bg.fill({
            color: 0xffffff,
            alpha: 0.8
        });

        panel.addChild(bg);
        panel.eventMode = "static";

        panel.on("pointertap", (e) => {
            e.stopPropagation();
        });

        
        const title = new PIXI.Text({
            text: "Zur Stadt " + this.city_obj.type +" (" + this.city_obj.id + ") reisen?",
            style: {
                fontSize: 16,
                fill: 0x000000
            }
        });
        
        title.anchor.set(0.5, 0);
        title.x = width / 2;
        title.y = 20;
        
        panel.addChild(title);

        const distanceText = new PIXI.Text({
            text: "Distanz: 1200m",
            style: {
                fontSize: 12,
                fill: 0x000000
            }
        });

        distanceText.anchor.set(0.5);
        distanceText.position.set(
            width / 2,
            height * 0.25
        );

        panel.addChild(distanceText);

        function createButton(text, x) {
            const button = new PIXI.Container();

            const buttonWidth = width * 0.2;
            const buttonHeight = width * 0.1;

            const bg = new PIXI.Graphics();

            bg.roundRect(
                0,
                0,
                buttonWidth,
                buttonHeight,
                15
            );

            bg.fill({
                color: 0x3498db,
                alpha: 1
            });

            button.addChild(bg);


            const label = new PIXI.Text({
                text,
                style: {
                    fontSize: buttonHeight * 0.35,
                    fill: 0xffffff
                }
            });

            label.anchor.set(0.5);

            label.position.set(
                buttonWidth / 2,
                buttonHeight / 2
            );

            button.addChild(label);


            button.pivot.set(
                buttonWidth / 2,
                buttonHeight / 2
            );

            button.position.set(
                x + buttonWidth / 2,
                height - buttonHeight / 2 - height * 0.05
            );


            button.eventMode = "static";
            button.cursor = "pointer";


            button.on("pointerover", () => {
                button.scale.set(1.05);
            });

            button.on("pointerout", () => {
                button.scale.set(1);
            });


            return button;
        }

        const buttonWidth = width * 0.2;

        const gap = width * 0.05;

        const totalWidth = buttonWidth * 2 + gap;

        const startX = (width - totalWidth) / 2;


        const travelButton = createButton(
            "Losfahren",
            startX
        );

        travelButton.on("pointertap", async () => {
            SceneStack.popScene(this.app);

            const driveScene = await DriveScene.create(this.app, 2400);
            SceneStack.pushScene(driveScene);
        });


        const backButton = createButton(
            "Zurück",
            startX + buttonWidth + gap
        );

        backButton.on("pointertap", () => {
            SceneStack.popScene(this.app);
        });


        panel.addChild(travelButton);
        panel.addChild(backButton);

        this.uiScene.addChild(panel);
    }

    destroy() {
        window.removeEventListener("keydown", this.onKeyDown);
    }
}