import * as PIXI from "pixi.js";
import { UIScene } from "./Utils/UIScene.js";

const COLORS = {
    bg: 0x111111,
    barBg: 0x2b2b2b,
    barBorder: 0x555555,
    barFill: 0xf4c542,
    text: 0xffffff,
};

// Simple progress-bar loading screen. Pass a list of async load functions,
// it runs them (sequentially, so the bar advances predictably step by step),
// updates the bar after each one finishes, then calls onComplete.
export class LoadingScreen extends UIScene {

    ///@param app - PIXI Application
    constructor(app) {
        super(app, "LoadingScreen");
        this.uiScene = new PIXI.Container();

        this.bgGfx = new PIXI.Graphics();
        this.uiScene.addChild(this.bgGfx);

        this.barBgGfx = new PIXI.Graphics();
        this.uiScene.addChild(this.barBgGfx);

        this.barFillGfx = new PIXI.Graphics();
        this.uiScene.addChild(this.barFillGfx);

        this.label = new PIXI.Text({
            text: "Loading...",
            style: { fontFamily: "monospace", fontSize: 16, fill: COLORS.text, fontWeight: "bold" },
        });
        this.label.anchor.set(0.5);
        this.uiScene.addChild(this.label);

        this.progress = 0; // 0..1

        this.layout();
        this._resizeHandler = () => this.layout();
        window.addEventListener("resize", this._resizeHandler);
    }

    layout() {
        const w = this.app.renderer.width;
        const h = this.app.renderer.height;

        this.bgGfx.clear();
        this.bgGfx.rect(0, 0, w, h).fill(COLORS.bg);

        this._barW = w * 0.4;
        this._barH = h * 0.03;
        this._barX = (w - this._barW) / 2;
        this._barY = h / 2 - this._barH / 2;

        this.barBgGfx.clear();
        this.barBgGfx
            .rect(this._barX, this._barY, this._barW, this._barH)
            .fill(COLORS.barBg)
            .stroke({ width: Math.max(2, h * 0.004), color: COLORS.barBorder });

        this.label.position.set(w / 2, this._barY - h * 0.04);
        this.label.style.fontSize = h * 0.025;

        this._drawFill();
    }

    setProgress(t, label) {
        this.progress = Math.max(0, Math.min(1, t));
        if (label) this.label.text = label;
        if (window.DEBUG.enabled) console.log(label);
        this._drawFill();
    }

    _drawFill() {
        this.barFillGfx.clear();
        const fillW = this._barW * this.progress;
        if (fillW > 0) {
            this.barFillGfx.rect(this._barX, this._barY, fillW, this._barH).fill(COLORS.barFill);
        }
    }

    ///@param tasks - array of async functions: () => Promise<void>
    ///@param onComplete - called after every task finished
    ///@param labels - optional array of display labels matching tasks, same length
    async run(tasks, onComplete, labels) {
        for (let i = 0; i < tasks.length; i++) {
            const label = labels?.[i] ?? `Loading... (${i + 1}/${tasks.length})`;
            this.setProgress(i / tasks.length, label);
            await tasks[i]();
        }
        onComplete && onComplete();
    }

    destroy(options) {
        window.removeEventListener("resize", this._resizeHandler);
    }
}