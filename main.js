import * as PIXI from "pixi.js";
import { SceneStack } from "./Utils/SceneStack.js";
import { Input } from "./Utils/Input.js";
import { MapScene } from "./Map/MapScene.js";
import { GAMESTATE } from "./GameState.js";
import { LoadingScreen } from "./LoadingScreen.js";
import { GLOBAL_MANIFEST, loadGlobalAssetEntry, MAP_SEED } from "./GlobalAssets.js";
import { ToastManager } from "./ToastManager.js";
import { TutorialScene } from "./TutorialScene.js";

/* Note:
    Meshes and triangles are currently only created and destroyed in these classes:
    - ModelInstance
    - GridMesh2D
*/
window.DEBUG = {
    enabled: false,
    showMeshes: false,
    showLights: false,
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
    const showMeshesToggle = document.getElementById("showMeshesToggle");
    showMeshesToggle.checked = false;
    showMeshesToggle.addEventListener("change", (e) => {
        window.DEBUG.showMeshes = e.target.checked;
    });

    const showCarBoundsToggle = document.getElementById("showCarBoundsToggle");
    showCarBoundsToggle.checked = false;
    showCarBoundsToggle.addEventListener("change", (e) => {
        window.DEBUG.showCarBounds = e.target.checked;
    });

    const showLightsToggle = document.getElementById("showLightsToggle");
    showLightsToggle.checked = false;
    showLightsToggle.addEventListener("change", (e) => {
        window.DEBUG.showLights = e.target.checked;
    });

    const moneyButton = document.getElementById("moneyButton");
    moneyButton.addEventListener("click", () => {
        GAMESTATE.addMoney(5000);
    });

    const speedToggle = document.getElementById("speedToggle");
    speedToggle.checked = false;
    let lastSpeed = GAMESTATE.getCurrentCarConfig()?.properties?.speed?.value ?? 80;
    speedToggle.addEventListener("change", (e) => {
        window.DEBUG.speedHack = e.target.checked;
        const config = GAMESTATE.getCurrentCarConfig();
        if (config && config.properties && config.properties.speed) {
            if (window.DEBUG.speedHack) {
                lastSpeed = config.properties.speed.value;
                config.properties.speed.value = 250;
            } else {
                config.properties.speed.value = lastSpeed;
            }
        }
        const driveScene = SceneStack.getTopScene(false);
        if (driveScene && driveScene.label === "DriveScene") {
            if (window.DEBUG.speedHack) {
                driveScene.baseSpeed = 2500;
                driveScene.targetSpeed = 2500;
            } else {
                driveScene.baseSpeed = lastSpeed * 10;
                driveScene.targetSpeed = lastSpeed * 10;
            }
        }
    });

    const fpsCounter = document.getElementById("fpsCounter");
    const meshCounter = document.getElementById("meshCounter");
    const triangleCounter = document.getElementById("triangleCounter");
    const gridMeshTriangleCounter = document.getElementById("gridMeshTriangles")
    const gridMeshCounter = document.getElementById("gridMeshes")

    const fpsHistory = [];
    const FPS_AVG_WINDOW = 3000;

    app.ticker.add(() => {
        const now = performance.now();
        fpsHistory.push({ time: now, fps: app.ticker.FPS });

        while (fpsHistory.length > 0 && now - fpsHistory[0].time > FPS_AVG_WINDOW) {
            fpsHistory.shift();
        }

        const avgFps = fpsHistory.reduce((sum, entry) => sum + entry.fps, 0) / fpsHistory.length;
        fpsCounter.textContent = `FPS: ${Math.round(avgFps)}`;

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
        "assets/modifiers.png",
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

    const tutScene = new TutorialScene(app, {
        onSkip: async () => {
            const mapScene = await MapScene.create(app, MAP_SEED);
            SceneStack.pushScene(mapScene);
        },
        onComplete: async () => {
            const mapScene = await MapScene.create(app, MAP_SEED);
            SceneStack.pushScene(mapScene);
        },
    });

    SceneStack.pushScene(tutScene);
}