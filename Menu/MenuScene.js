import * as PIXI from "pixi.js";
import { UIScene } from "../Utils/UIScene.js";
import { pixelText, drawBox } from "../Utils/UI.js";
import { COLORS } from "../Colors.js";

const BUTTON_LABELS = ["Continue", "Settings", "Statistics", "About", "Profile"];

//MenuScene - Hauptmenü im selben Design wie das MapOverlay
export class MenuScene extends UIScene {

    ///@param app - PIXI Application
    ///@param callbacks - { onContinue, onSettings, onStatistics, onAbout, onProfile }
    constructor(app, callbacks = {}) {
        super(app, "MenuScene");
        this.callbacks = callbacks;

        this.uiScene = new PIXI.Container();
        this.uiScene.eventMode = "static";

        this._buttons = [];

        this._buildBackdrop();
        this._buildPanel();
        this._buildTitle();
        this._buildButtons();

        this.layout();

        this._resizeHandler = () => this.layout();
        this.app.renderer.on('resize', this._resizeHandler);
    }

    destroy(options) {
        this.app.renderer.off('resize', this._resizeHandler);
        this.uiScene.destroy(options);
    }

    // -----------------------------------------------------------------
    // Aufbau
    // -----------------------------------------------------------------
    _buildBackdrop() {
        // transparenter Screen, dimmt nur leicht den Hintergrund dahinter
        this.backdrop = new PIXI.Graphics();
        this.uiScene.addChild(this.backdrop);
    }

    _buildPanel() {
        this.panel = new PIXI.Container();
        this.uiScene.addChild(this.panel);

        this.panelBg = new PIXI.Graphics();
        this.panel.addChild(this.panelBg);
    }

    _buildTitle() {
        this.titleText = pixelText("MENU", 15, COLORS.gold);
        this.titleText.anchor.set(0.5, 0);
        this.panel.addChild(this.titleText);
    }

    _buildButtons() {
        for (const label of BUTTON_LABELS) {
            const btn = new PIXI.Container();
            btn.eventMode = "static";
            btn.cursor = "pointer";

            const bg = new PIXI.Graphics();
            btn.addChild(bg);

            const text = pixelText(label, 16, COLORS.textLight);
            text.anchor.set(0.5);
            btn.addChild(text);

            btn.on("pointerover", () => this._drawButton(bg, true));
            btn.on("pointerout", () => this._drawButton(bg, false));
            btn.on("pointertap", () => {
                const cbName = `on${label}`;
                this.callbacks[cbName] && this.callbacks[cbName]();
            });

            this.panel.addChild(btn);
            this._buttons.push({ container: btn, bg, text, label });
        }
    }

    _drawButton(bg, hover) {
        drawBox(
            bg,
            this._buttonW, this._buttonH,
            hover ? COLORS.panelBgHover : COLORS.boxBg,
            COLORS.boxBorder,
            Math.max(2, this._buttonH * 0.06)
        );
    }

    // -----------------------------------------------------------------
    // Layout - Panel ~80% von Breite/Höhe, zentriert
    // -----------------------------------------------------------------
    layout() {
        const w = this.app.renderer.width;
        const h = this.app.renderer.height;

        this.backdrop.clear();
        this.backdrop.rect(0, 0, w, h).fill({ color: COLORS.overlayDim, alpha: 0.001 });

        const panelW = w * 0.8;
        const panelH = h * 0.8;
        const panelX = (w - panelW) / 2;
        const panelY = (h - panelH) / 2;

        drawBox(this.panelBg, panelW, panelH, COLORS.panelBg, COLORS.panelBorder, Math.max(2, h * 0.004));
        this.panel.position.set(panelX, panelY);

        // ---- Titel ----
        this.titleText.style.fontSize = panelH * 0.06;
        this.titleText.position.set(panelW / 2, panelH * 0.06);

        // ---- Buttons ----
        this._buttonW = panelW * 0.6;
        this._buttonH = panelH * 0.1;
        const gap = panelH * 0.04;
        const startY = panelH * 0.24;

        this._buttons.forEach((btn, i) => {
            this._drawButton(btn.bg, false);
            btn.text.style.fontSize = this._buttonH * 0.32;
            btn.text.position.set(this._buttonW / 2, this._buttonH / 2);

            const x = panelW / 2 - this._buttonW / 2;
            const y = startY + i * (this._buttonH + gap);
            btn.container.position.set(x, y);
        });
    }

}