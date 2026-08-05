import * as PIXI from "pixi.js";
import { SceneStack } from "./Utils/SceneStack.js";
import { Input } from "./Utils/Input.js";
import { MapScene } from "./Map/MapScene.js";

/////////// GLOBALS //////////////
const resolution = 9/16;

/* Note:
    Meshes and triangles are currently only created and destroyed in these classes:
    - ModelInstance
    - GridMesh2D
*/
window.DEBUG = {
    enabled: false,
    showMeshes: false,
    meshes: 0,
    triangles: 0,
    speedHack: false,
    showCarBounds: false
}

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
        antialias:false,
        powerPreference: "high-performance",
        depth: true
    });
    app.ticker.remove(app.render, app);

    const gl = app.renderer.gl;
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    app.ticker.add(() => {
        SceneStack.render(app);
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
    setupDebug(app);
    Input.init();
    await initializeRender();

    // Start Scene
    const mapScene = await MapScene.create(app);
    SceneStack.pushScene(mapScene);

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

    //static images
    await PIXI.Assets.load([
        //MapScene background map
        "assets/landscape.png"
    ]);

}


function setupDebug(app) {
    const debugToggle = document.getElementById("debugToggle");
    const showMeshesToggle = document.getElementById("showMeshesToggle");
    const speedToggle = document.getElementById("speedToggle");

    debugToggle.checked = false;
    debugToggle.addEventListener("change", (e) => {
        window.DEBUG.enabled = e.target.checked;
    });

    showMeshesToggle.checked = false;
    showMeshesToggle.addEventListener("change", (e) => {
        window.DEBUG.showMeshes = e.target.checked;
    });

    const showCarBoundsToggle = document.getElementById("showCarBoundsToggle");
    showCarBoundsToggle.checked = false;
    showCarBoundsToggle.addEventListener("change", (e) => {
        window.DEBUG.showCarBounds = e.target.checked;
    });

    speedToggle.checked = false;
    speedToggle.addEventListener("change", (e) => {
        window.DEBUG.speedHack = e.target.checked;
        if (SceneStack.getTopSceneName() === "DriveScene"){
            if (e.target.checked){
                SceneStack.getTopScene().speedZ *= 10;      
                SceneStack.getTopScene().speedX *= 10;      
            } 
            else {
                SceneStack.getTopScene().speedZ /= 10;
                SceneStack.getTopScene().speedX /= 10;
            }
        }
    });

    const fpsCounter = document.getElementById("fpsCounter");
    const meshCounter = document.getElementById("meshCounter");
    const triangleCounter = document.getElementById("triangleCounter");

    app.ticker.add(() => {
        fpsCounter.textContent = `FPS: ${Math.round(app.ticker.FPS)}`;

        meshCounter.textContent = `MESHES: ${window.DEBUG.meshes}`;
        triangleCounter.textContent = `TRIANGLES: ${window.DEBUG.triangles}`;
    });
}