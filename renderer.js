import * as PIXI from "pixi.js";


let ready = false;
let city_data = null;

export async function initRender() {
    //bg
    await PIXI.Assets.load("assets/landscape.png");

    const response = await fetch("/assets/city_locations.json");
    city_data = await response.json();

    for (const obj of city_data.cities) {
        await PIXI.Assets.load("/assets/" + obj.texture);
    }

    ready = true;
}

export function createMapScene(app) {
    if (!ready) return;

    const c = new PIXI.Container();
    c.label = "map_scene";
    c.eventMode = "static";

    // ===== HINTERGRUND =====
    const background = PIXI.Sprite.from("assets/landscape.png");
    background.width = app.renderer.width;
    background.height = app.renderer.height;
    c.addChild(background);

    for (const obj of city_data.cities) {
        const tex = PIXI.Texture.from("/assets/" + obj.texture);
        tex.source.scaleMode = "nearest";
        const img = new PIXI.Sprite(tex);

        img.x = obj.position[0] + 0.5 * tex.width;
        img.y = obj.position[1] + 0.5 * tex.height;

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

        img.on("pointertap", () => {
            handleCityClick(app, img, obj);
        });

        const shadow = new PIXI.Graphics();

        shadow.circle(0, 0, 80);
        shadow.fill({
            color: 0x000000,
            alpha: 0.25
        });

        shadow.position = img.position.clone();
        shadow.alpha = 0;

        c.addChildAt(shadow, 0);

        c.addChild(img);
    }

    return c;
}


function handleCityClick(app, sprite, obj) {
    const scene = createGotoCityScene(app, obj);
    pushScene(app, scene, false);
}


export function createGotoCityScene(app, city_obj) {
    if (!ready) return;

    const c = new PIXI.Container();
    c.label = "goto_city_scene";
    c.eventMode = "static";

    const onKeyDown = (e) => {
        if (e.key === "Escape") {
            popScene(app);
        }
    };

    window.addEventListener("keydown", onKeyDown);
    c.on("removed", () => {
        window.removeEventListener("keydown", onKeyDown);
    });

    const bg = new PIXI.Graphics();
    
    const width = app.screen.width * 0.8;
    const height = app.screen.height * 0.8;
    
    const x = (app.screen.width - width) / 2;
    const y = (app.screen.height - height) / 2;

    const blocker = new PIXI.Graphics();

    blocker.rect(
        0,
        0,
        app.screen.width,
        app.screen.height
    );

    blocker.fill({
        color: 0x000000,
        alpha: 0
    });

    blocker.eventMode = "static";

    c.addChild(blocker);

    const panel = new PIXI.Container();
    panel.position.set(x, y);

    blocker.on("pointertap", (e) => {
        e.stopPropagation();

        // Scene schließen
        popScene(app);
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
        text: "Zur Stadt " + city_obj.type +" (" + city_obj.id + ") reisen?",
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

    travelButton.on("pointertap", () => {
        console.log("Losfahren");
        // deine Funktion hier
    });


    const backButton = createButton(
        "Zurück",
        startX + buttonWidth + gap
    );

    backButton.on("pointertap", () => {
        popScene(app);
    });


    panel.addChild(travelButton);
    panel.addChild(backButton);

    c.addChild(panel);

    return c;
}


const sceneStack = [];

export function pushScene(app, scene, replace = true) {

    if (replace && sceneStack.length > 0) {
        const oldScene = sceneStack.pop();

        app.stage.removeChild(oldScene);
    }

    sceneStack.push(scene);
    app.stage.addChild(scene);
}

export function popScene(app) {
    const oldScene = sceneStack.pop();

    app.stage.removeChild(oldScene);
}
