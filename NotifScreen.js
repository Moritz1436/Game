import * as PIXI from "pixi.js";
import { UIScene } from "./Utils/UIScene.js";
import { COLORS } from "./Colors.js";
import { pixelText, drawBox } from "./Utils/UI.js";

function createButton(label, onClick) {
    const c = new PIXI.Container();
    c.eventMode = "static";
    c.cursor = "pointer";

    const bg = new PIXI.Graphics();
    c.addChild(bg);
    c._bg = bg;

    const txt = pixelText(label, 16, COLORS.textLight);
    txt.anchor.set(0.5);
    c.addChild(txt);
    c._txt = txt;

    c._redraw = (w, h) => {
        drawBox(bg, w, h, COLORS.btnBg, COLORS.btnBorder, Math.max(2, h * 0.06));
        txt.style.fontSize = h * 0.4;
        txt.position.set(w / 2, h / 2);
    };

    c.on("pointerover", () => bg.tint = 0xffffff); // simple hover feedback, ersetzt via redraw beim nächsten resize ohnehin
    c.on("pointerover", () => drawBox(bg, c._w, c._h, COLORS.btnBgHover, COLORS.btnBorder, Math.max(2, c._h * 0.06)));
    c.on("pointerout", () => drawBox(bg, c._w, c._h, COLORS.btnBg, COLORS.btnBorder, Math.max(2, c._h * 0.06)));
    c.on("pointerdown", () => c._onClick && c._onClick());

    c.setLabel = (l) => { txt.text = l; };
    c._onClick = onClick;
    c.setCallback = (cb) => { c._onClick = cb; };

    return c;
}

export class NotifScreen extends UIScene {

    ///@param app - PIXI Application
    ///@param text - Nachrichtentext
    ///@param label1 - Text des ersten Buttons
    ///@param cb1 - Callback des ersten Buttons
    ///@param label2 - optional: Text des zweiten Buttons (null = nur 1 Button)
    ///@param cb2 - optional: Callback des zweiten Buttons
    constructor(app, text, label1, cb1, label2 = null, cb2 = null) {
        super(app, "NotifScreen");

        this.uiScene = new PIXI.Container();
        this.world3dScene = new PIXI.Container();

        this._text = text;
        this._label1 = label1;
        this._cb1 = cb1;
        this._label2 = label2;
        this._cb2 = cb2;

        // ---- fullscreen dimmer ----
        this.dimmer = new PIXI.Graphics();
        this.dimmer.eventMode = "static"; // blockt Klicks auf darunterliegende Szene
        this.uiScene.addChild(this.dimmer);

        // ---- panel (80% x 80%) ----
        this.panel = new PIXI.Container();
        this.uiScene.addChild(this.panel);

        this.panelBg = new PIXI.Graphics();
        this.panel.addChild(this.panelBg);

        this.messageText = pixelText(text, 20, COLORS.textLight);
        this.messageText.anchor.set(0.5, 0);
        this.messageText.style.wordWrap = true;
        this.messageText.style.align = "center";
        this.panel.addChild(this.messageText);

        this.button1 = createButton(label1 ?? "", cb1);
        this.panel.addChild(this.button1);

        this.button2 = label2 != null ? createButton(label2, cb2) : null;
        if (this.button2) this.panel.addChild(this.button2);

        this._resizeHandler = () => this.layout();
        this.app.renderer.on('resize', this._resizeHandler);

        this.layout();
    }

    // -----------------------------------------------------------------
    // Setter, um Text/Buttons nachträglich zu ändern
    // -----------------------------------------------------------------
    setText(text) {
        this._text = text;
        this.messageText.text = text;
        this.layout();
    }

    setButton1(label, cb) {
        this._label1 = label;
        this._cb1 = cb;
        this.button1.setLabel(label);
        this.button1.setCallback(cb);
    }

    setButton2(label, cb) {
        this._label2 = label;
        this._cb2 = cb;

        if (label == null) {
            if (this.button2) {
                this.panel.removeChild(this.button2);
                this.button2.destroy();
                this.button2 = null;
                this.layout();
            }
            return;
        }

        if (!this.button2) {
            this.button2 = createButton(label, cb);
            this.panel.addChild(this.button2);
        } else {
            this.button2.setLabel(label);
            this.button2.setCallback(cb);
        }
        this.layout();
    }

    // -----------------------------------------------------------------
    layout() {
        const w = this.app.renderer.width;
        const h = this.app.renderer.height;

        // ---- Dimmer: fullscreen ----
        this.dimmer.clear();
        this.dimmer.rect(0, 0, w, h).fill({ color: COLORS.overlayDim, alpha: 0.65 });

        // ---- Panel: 80% x 80%, zentriert ----
        const panelW = w * 0.8;
        const panelH = h * 0.8;
        this.panel.position.set((w - panelW) / 2, (h - panelH) / 2);
        drawBox(this.panelBg, panelW, panelH, COLORS.panelBg, COLORS.panelBorder, Math.max(2, h * 0.004));

        // ---- Text ----
        const textPad = panelW * 0.08;
        this.messageText.style.fontSize = panelH * 0.06;
        this.messageText.style.wordWrapWidth = panelW - textPad * 2;
        this.messageText.position.set(panelW / 2, panelH * 0.12);

        // ---- Buttons ----
        const btnW = panelW * 0.32;
        const btnH = panelH * 0.12;
        const btnY = panelH * 0.78;
        const gap = panelW * 0.04;

        this.button1._w = btnW;
        this.button1._h = btnH;

        if (this.button2) {
            const totalW = btnW * 2 + gap;
            const startX = (panelW - totalW) / 2;

            this.button1._redraw(btnW, btnH);
            this.button1.position.set(startX, btnY);

            this.button2._w = btnW;
            this.button2._h = btnH;
            this.button2._redraw(btnW, btnH);
            this.button2.position.set(startX + btnW + gap, btnY);
        } else {
            this.button1._redraw(btnW, btnH);
            this.button1.position.set((panelW - btnW) / 2, btnY);
        }
    }

    destroy() {
        this.app.renderer.off('resize', this._resizeHandler);
    }
}