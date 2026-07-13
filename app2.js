import * as PIXI from "pixi.js";
import * as RENDER from "./renderer.js";

/////////// GLOBALS //////////////
const W = 480, H = 270; 

/////////// INIT //////////////

(async () => {

    const app = new PIXI.Application();
    await app.init({ 
        width: W, 
        height: H, 
        backgroundColor: 0x2e9e4f, 
        antialias:false 
    });

    document.getElementById('game').appendChild(app.canvas);

    function resizeCanvas() {

        const width = window.innerWidth * 0.7;
        const height = width * (H / W);

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