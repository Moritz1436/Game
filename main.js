import * as PIXI from "pixi.js";
import { SceneStack } from "./Utils/SceneStack.js";
import { Input } from "./Utils/Input.js";
import { MapScene } from "./Map/MapScene.js";

/////////// GLOBALS //////////////
const resolution = 9/16;

export function getWidth() {
    return 1920;
}

export function getHeight() {
    return 1080;
}

(async () => {

    //Setup
    const app = new PIXI.Application();
    await app.init({ 
        width: getWidth(), 
        height: getHeight(), 
        backgroundColor: 0x222222, 
        antialias:false 
    });

    document.getElementById('game').appendChild(app.canvas);

    function resizeCanvas() {

        const width = window.innerWidth * 0.7;
        const height = width * resolution;

        app.canvas.style.width = width + "px";
        app.canvas.style.height = height + "px";
    }

    window.addEventListener(
        "resize",
        resizeCanvas
    );
    resizeCanvas();

    // App Init
    Input.init();
    await initializeRender();

    // Start Scene
    const mapScene = new MapScene(app);
    SceneStack.pushScene(app, mapScene);

})();


export let city_data = null;

///@brief loads neccessary textures (needed since pixiv8) and old MapScene stuff
async function initializeRender() {
    
    ///@deprecated MapScene stuff
    const response = await fetch("/assets/city_locations.json");
    city_data = await response.json();

    for (const obj of city_data.cities) {
        await PIXI.Assets.load("/assets/" + obj.texture);
    }

    await PIXI.Assets.load([
        //MapScene background map
        "assets/landscape.png",

        //DriveScene StreetSegment texture
        "assets/street.png"
    ]);

}