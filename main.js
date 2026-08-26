import * as PIXI from "pixi.js";
import { SceneStack } from "./Utils/SceneStack.js";
import { Input } from "./Utils/Input.js";
import { MapScene } from "./Map/MapScene.js";
import { GAMESTATE } from "./GameState.js";
import { LoadingScreen } from "./LoadingScreen.js";
import { GLOBAL_MANIFEST, loadGlobalAssetEntry, MAP_SEED } from "./GlobalAssets.js";
import { ToastManager } from "./ToastManager.js";


/* Note:
    Meshes and triangles are currently only created and destroyed in these classes:
    - ModelInstance
    - GridMesh2D
*/
window.DEBUG = {
    enabled: false,
    showMeshes: false,
    meshes: 0,
    gridMeshes: 0,
    gridMeshTriangles: 0,
    triangles: 0,
    speedHack: false,
    showCarBounds: false
};

(async () => {

    //Setup
    const app = new PIXI.Application();
    await app.init({ 
        resizeTo: window,
        backgroundColor: 0x222222, 
        antialias:false,
        powerPreference: "high-performance",
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
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

    // App Init
    setupDebug(app);
    Input.init();

    await boot(app);
})();


function setupDebug(app) {
    const debugToggle = document.getElementById("debugToggle");
    const showMeshesToggle = document.getElementById("showMeshesToggle");

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

    const fpsCounter = document.getElementById("fpsCounter");
    const meshCounter = document.getElementById("meshCounter");
    const triangleCounter = document.getElementById("triangleCounter");
    const gridMeshTriangleCounter = document.getElementById("gridMeshTriangles")
    const gridMeshCounter = document.getElementById("gridMeshes")

    app.ticker.add(() => {
        fpsCounter.textContent = `FPS: ${Math.round(app.ticker.FPS)}`;

        meshCounter.textContent = `MESHES: ${window.DEBUG.meshes}`;
        triangleCounter.textContent = `TRIANGLES: ${window.DEBUG.triangles}`;
        gridMeshCounter.textContent = `GRIDMESHES: ${window.DEBUG.gridMeshes}`;
        gridMeshTriangleCounter.textContent = `GRIDTRIANGLES: ${window.DEBUG.gridMeshTriangles}`;
    });
}


async function boot(app) {
    const loadingScreen = new LoadingScreen(app);
    SceneStack.pushScene(loadingScreen);

    //car pieces
    await loadingScreen.run(
        GLOBAL_MANIFEST.map((entry, i) => async () => {
            await loadGlobalAssetEntry(entry);
        }),
        null,
        GLOBAL_MANIFEST.map(e => `Loading ${e.name}`)
    );

    //static images
    const imgs = [
        // GarageOverlay
        "assets/colorpicker.png",
        "assets/wrench.png",
        "assets/upgrades.png",
    ];
    await loadingScreen.run(
        imgs.map(img => async () => {
            await PIXI.Assets.load(img);
        }),
        null,
        imgs.map(() => "Loading Images")
    );

    GAMESTATE.loadState();

    ToastManager.init(app);

    // Start Scene
    const mapScene = await MapScene.create(app, MAP_SEED, loadingScreen);
    SceneStack.pushScene(mapScene);
}