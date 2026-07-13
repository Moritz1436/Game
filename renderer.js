import * as PIXI from "pixi.js";
import * as APP from "./app2.js";

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

    const  tex = PIXI.Texture.from("assets/landscape.png");
    tex.source.scaleMode = "nearest";
    const background = new PIXI.Sprite(tex);
    background.width = APP.getWidth();
    background.height = APP.getHeight();
    c.addChild(background);

    for (const obj of city_data.cities) {
        const tex = PIXI.Texture.from("/assets/" + obj.texture);
        tex.source.scaleMode = "nearest";
        const img = new PIXI.Sprite(tex);

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
        popScene(app);

        pushScene(app, createDriveScene(app, city_obj));
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


function createDriveScene(app, city_obj) {

    const cur_city = city_data.cities.find(c => c.id === APP.state.current_city_id);

    const dist = Math.sqrt(
        Math.pow(city_obj.position[0] - cur_city.position[0], 2) +
        Math.pow(city_obj.position[1] - cur_city.position[1], 2)
    ) * 10;

    console.log("Distance to city " + city_obj.id + ": " + dist.toFixed(2) + "m");


    const c = new PIXI.Container();
    c.label = "drive_scene";
    c.eventMode = "static";

    // ===== HINTERGRUND =====
    const side = new PIXI.Graphics();
    side.rect(0, 0, app.screen.width, app.screen.height);
    side.fill(0x2e9e4f);
    c.addChild(side);
    

    // ===== STRAẞE =====
    const road = new PIXI.Graphics();
    
    // Straßen-Fläche
    const roadTop = 0;
    const roadBottom = app.screen.height;
    const roadWidthTop = app.screen.width * 0.2;
    const roadWidthBottom = app.screen.width * 0.75;
    
    road.moveTo(
        (app.screen.width - roadWidthTop) / 2,
        roadTop
    );
    road.lineTo(
        (app.screen.width + roadWidthTop) / 2,
        roadTop
    );
    road.lineTo(
        (app.screen.width + roadWidthBottom) / 2,
        roadBottom
    );
    road.lineTo(
        (app.screen.width - roadWidthBottom) / 2,
        roadBottom
    );
    road.fill(0x444444);
    c.addChild(road);

    // =========================================================================
    // FAHRBAHNMARKIERUNGEN - Sanfter Übergang
    // =========================================================================

    const numLanes = 3;
    const numSegments = 20;

    for (let i = 1; i < numLanes; i++) {
        const t = i / numLanes;
        
        const xTop = (app.screen.width - roadWidthTop) / 2 + roadWidthTop * t;
        const xBottom = (app.screen.width - roadWidthBottom) / 2 + roadWidthBottom * t;
        
        const line = new PIXI.Graphics();
        line.moveTo(xTop, roadTop);
        line.lineTo(xBottom, roadBottom);

        
        line.stroke({ 
            color: 0xffffff, 
            width: 7,
            alpha: 0.9
        });
        
        c.addChild(line);
    }

    // ===== SEITENSTREIFEN (Optional) =====
    // Äußere Linien durchgehend
    for (let side = 0; side < 2; side++) {
        const t = side === 0 ? 0.02 : 0.98; // leicht innerhalb
        
        const xTop = (app.screen.width - roadWidthTop) / 2 + roadWidthTop * t;
        const xBottom = (app.screen.width - roadWidthBottom) / 2 + roadWidthBottom * t;
        
        const edgeLine = new PIXI.Graphics();
        edgeLine.moveTo(xTop, roadTop);
        edgeLine.lineTo(xBottom, roadBottom);
        edgeLine.stroke({ 
            color: 0xffffff, 
            width: 7,
            alpha: 0.8
        });
        c.addChild(edgeLine);
    }

    // ===== STRAẞENRAND (Links/Rechts) =====
    const roadEdge = new PIXI.Graphics();
    
    // Linker Rand
    roadEdge.moveTo(
        (app.screen.width - roadWidthTop) / 2,
        roadTop
    );
    roadEdge.lineTo(
        (app.screen.width - roadWidthBottom) / 2,
        roadBottom
    );
    roadEdge.stroke({ color: 0x666666, width: 3 });
    c.addChild(roadEdge);
    
    // Rechter Rand
    const roadEdgeRight = new PIXI.Graphics();
    roadEdgeRight.moveTo(
        (app.screen.width + roadWidthTop) / 2,
        roadTop
    );
    roadEdgeRight.lineTo(
        (app.screen.width + roadWidthBottom) / 2,
        roadBottom
    );
    roadEdgeRight.stroke({ color: 0x666666, width: 3 });
    c.addChild(roadEdgeRight);

    // ===== ESC ZURÜCK =====
    const keyHandler = (e) => {
        if (e.key === "Escape") {
            popScene(appRef);
        }
    };
    window.addEventListener("keydown", keyHandler);
    
    c.on("removed", () => {
        window.removeEventListener("keydown", keyHandler);
    });

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
