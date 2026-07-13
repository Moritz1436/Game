import * as PIXI from "pixi.js";
import * as RENDER from "./renderer.js";

/////////// GLOBALS //////////////
const W = 480, H = 270; 
const resolution = 270/480;
const scale = 4;

export function getWidth() {
    return W * scale;
}

export function getHeight() {
    return H * scale;
}

export const state = {
    money: 5000,
    current_city_id: 1
};

/////////// INIT //////////////

(async () => {

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

    await RENDER.initRender();

    const mapScene = RENDER.createMapScene(app);
    RENDER.pushScene(app, mapScene);

})();