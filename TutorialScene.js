import { UIScene } from "./Utils/UIScene.js";
import { pixelText, drawBox} from "./Utils/UI.js";
import { COLORS } from "./Colors.js";
import { drawCityBadge } from "./Map/draw.js";
import * as PIXI from "pixi.js";

const BADGE_CANVAS_W = 120;
const BADGE_CANVAS_H = 100;
const BADGE_ORIGIN_X = BADGE_CANVAS_W / 2;   // x-Ursprung fuer drawCityBadge
const BADGE_ORIGIN_Y = BADGE_CANVAS_H * 0.9; // y-Ursprung (Fusspunkt/Schatten)

function createFeatureIconTexture(feature) {
    const canvas = document.createElement("canvas");
    canvas.width = BADGE_CANVAS_W;
    canvas.height = BADGE_CANVAS_H;
    const ctx = canvas.getContext("2d");
    drawCityBadge(ctx, BADGE_ORIGIN_X, BADGE_ORIGIN_Y, feature, Math.random);

    const texture = PIXI.Texture.from(canvas);
    // Ankerpunkt so setzen, dass der Badge-Kreis (nicht der Schatten) im
    // Zentrum des Sprites liegt - floatY liegt 42px ueber dem Ursprung.
    texture._badgeAnchorY = (BADGE_ORIGIN_Y - 42) / BADGE_CANVAS_H;
    return texture;
}

const PAGES = [
    {
        title: "WELCOME",
        lines: [
            "Travel between cities in your own car.",
            "Each city lets you do different things:",
            "customize your car, take on quests,",
            "open crates, or enter races.",
            "",
            "You have to drive there yourself.",
        ],
    },
    {
        title: "GARAGE",
        feature: "werkstatt",
        lines: [
            "Change your car's parts and colors.",
            "Upgrade stats like speed and boost.",
        ],
    },
    {
        title: "QUESTS",
        feature: "quest",
        lines: [
            "Take on jobs for cash rewards.",
        ],
    },
    {
        title: "SHOP",
        feature: "shop",
        lines: [
            "Buy crates for a chance at parts,",
            "money, or car stat boosts.",
        ],
    },
    {
        title: "RACE TRACK",
        feature: "rennen",
        lines: [
            "Put up cash to enter a race.",
            "Winner takes it all.",
        ],
    },
    {
        title: "GAS STATION",
        feature: "tankstelle",
        lines: [
            "Refuel your car, and see",
            "other players' cars online.",
        ],
    },
];

// TutorialScene - fullscreen, im selben Pixel-Art-Stil wie MenuScene,
// mit mehreren Seiten (Vor/Zurueck) und Skip-Option.
export class TutorialScene extends UIScene {

    ///@param app - PIXI Application
    ///@param callbacks - { onSkip, onComplete }
    constructor(app, callbacks = {}) {
        super(app, "TutorialScene");
        this.callbacks = callbacks;
        this.pageIndex = 0;

        this.uiScene = new PIXI.Container();
        this.uiScene.eventMode = "static";

        this._pageContainers = [];
        this._dots = [];

        this._buildBackdrop();
        this._buildHeader();
        this._buildPages();
        this._buildNav();

        this.layout();
        this._showPage(0);

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
        this.backdrop = new PIXI.Graphics();
        this.uiScene.addChild(this.backdrop);
    }

    _buildHeader() {
        this.titleText = pixelText("HOW TO PLAY", 15, COLORS.gold);
        this.titleText.anchor.set(0.5, 0);
        this.uiScene.addChild(this.titleText);

        this.skipBtn = new PIXI.Container();
        this.skipBtn.eventMode = "static";
        this.skipBtn.cursor = "pointer";

        this.skipBtnBg = new PIXI.Graphics();
        this.skipBtn.addChild(this.skipBtnBg);

        this.skipBtnText = pixelText("SKIP", 13, COLORS.textLight);
        this.skipBtnText.anchor.set(0.5);
        this.skipBtn.addChild(this.skipBtnText);

        this.skipBtn.on("pointerover", () => this._drawSmallButton(this.skipBtnBg, this._skipW, this._skipH, true));
        this.skipBtn.on("pointerout", () => this._drawSmallButton(this.skipBtnBg, this._skipW, this._skipH, false));
        this.skipBtn.on("pointertap", () => {
            this.callbacks.onSkip && this.callbacks.onSkip();
        });

        this.uiScene.addChild(this.skipBtn);
    }

    _buildPages() {
        this.pagesLayer = new PIXI.Container();
        this.uiScene.addChild(this.pagesLayer);

        for (const page of PAGES) {
            const container = new PIXI.Container();
            container.visible = false;

            if (page.feature) {
                const texture = createFeatureIconTexture(page.feature);
                const icon = new PIXI.Sprite(texture);
                icon.anchor.set(0.5, texture._badgeAnchorY ?? 0.5);
                container.addChild(icon);
                container._icon = icon;
            }

            const title = pixelText(page.title, 16, COLORS.gold);
            title.anchor.set(0.5, 0);
            container.addChild(title);
            container._title = title;

            const body = pixelText(page.lines.join("\n"), 13, COLORS.textLight);
            body.anchor.set(0.5, 0);
            if (body.style) body.style.align = "center";
            container.addChild(body);
            container._body = body;

            this.pagesLayer.addChild(container);
            this._pageContainers.push(container);
        }
    }

    _buildNav() {
        this.navLayer = new PIXI.Container();
        this.uiScene.addChild(this.navLayer);

        this.prevBtn = this._makeNavButton("<", () => this._goTo(this.pageIndex - 1));
        this.nextBtn = this._makeNavButton(">", () => this._goTo(this.pageIndex + 1));
        this.navLayer.addChild(this.prevBtn.container, this.nextBtn.container);

        this.dotsLayer = new PIXI.Container();
        this.navLayer.addChild(this.dotsLayer);
        for (let i = 0; i < PAGES.length; i++) {
            const dot = new PIXI.Graphics();
            this.dotsLayer.addChild(dot);
            this._dots.push(dot);
        }
    }

    _makeNavButton(label, onTap) {
        const container = new PIXI.Container();
        container.eventMode = "static";
        container.cursor = "pointer";

        const bg = new PIXI.Graphics();
        container.addChild(bg);

        const text = pixelText(label, 18, COLORS.textLight);
        text.anchor.set(0.5);
        container.addChild(text);

        container.on("pointerover", () => this._drawSmallButton(bg, this._navBtnSize, this._navBtnSize, true));
        container.on("pointerout", () => this._drawSmallButton(bg, this._navBtnSize, this._navBtnSize, false));
        container.on("pointertap", onTap);

        return { container, bg, text };
    }

    _drawSmallButton(bg, w, h, hover) {
        drawBox(bg, w, h, hover ? COLORS.panelBgHover : COLORS.boxBg, COLORS.boxBorder, Math.max(2, h * 0.12));
    }

    _drawDot(dot, active) {
        dot.clear();
        const r = this._dotR;
        dot.circle(0, 0, r).fill(active ? COLORS.gold : COLORS.boxBg);
        dot.circle(0, 0, r).stroke({ width: 1, color: COLORS.boxBorder, alpha: 0.8 });
    }

    // -----------------------------------------------------------------
    // Navigation
    // -----------------------------------------------------------------
    _showPage(index) {
        this.pageIndex = Math.max(0, Math.min(PAGES.length - 1, index));
        this._pageContainers.forEach((c, i) => { c.visible = i === this.pageIndex; });

        this.prevBtn.container.visible = this.pageIndex > 0;

        const isLast = this.pageIndex === PAGES.length - 1;
        this.nextBtn.text.text = isLast ? "DONE" : ">";

        this._dots.forEach((dot, i) => this._drawDot(dot, i === this.pageIndex));
    }

    _goTo(index) {
        if (index >= PAGES.length) {
            this.callbacks.onComplete && this.callbacks.onComplete();
            return;
        }
        if (index < 0) return;
        this._showPage(index);
        this.layout();
    }

    // -----------------------------------------------------------------
    // Layout - Fullscreen, Seite mittig, Nav unten
    // -----------------------------------------------------------------
    layout() {
        const w = this.app.renderer.width;
        const h = this.app.renderer.height;

        this.backdrop.clear();
        this.backdrop.rect(0, 0, w, h).fill({ color: COLORS.panelBg, alpha: 1 });

        // ---- Header ----
        this.titleText.style.fontSize = h * 0.045;
        this.titleText.position.set(w / 2, h * 0.05);

        this._skipW = w * 0.12;
        this._skipH = h * 0.05;
        this.skipBtnText.style.fontSize = this._skipH * 0.4;
        this._drawSmallButton(this.skipBtnBg, this._skipW, this._skipH, false);
        this.skipBtnText.position.set(this._skipW / 2, this._skipH / 2);
        this.skipBtn.position.set(w - this._skipW - w * 0.04, h * 0.04);

        // ---- Seiteninhalt ----
        const page = this._pageContainers[this.pageIndex];
        const centerX = w / 2;
        let cursorY = h * 0.22;

        if (page && page._icon) {
            const iconSize = Math.min(w, h) * 0.16;
            const scale = iconSize / BADGE_CANVAS_W;
            page._icon.scale.set(scale);
            page._icon.position.set(centerX, cursorY + iconSize / 2);
            cursorY += iconSize + h * 0.04;
        }

        if (page) {
            page._title.style.fontSize = h * 0.035;
            page._title.position.set(centerX, cursorY);
            cursorY += h * 0.07;

            page._body.style.fontSize = h * 0.024;
            if (page._body.style) page._body.style.wordWrapWidth = w * 0.7;
            page._body.position.set(centerX, cursorY);
        }

        // ---- Nav-Buttons ----
        this._navBtnSize = h * 0.06;
        const navY = h * 0.88;

        this.prevBtn.container.position.set(w * 0.08, navY);
        this.nextBtn.container.position.set(w * 0.92 - this._navBtnSize, navY);

        this.prevBtn.text.style.fontSize = this._navBtnSize * 0.32;
        this.nextBtn.text.style.fontSize = this._navBtnSize * 0.32;
        this.prevBtn.text.position.set(this._navBtnSize / 2, this._navBtnSize / 2);
        this.nextBtn.text.position.set(this._navBtnSize / 2, this._navBtnSize / 2);

        this._drawSmallButton(this.prevBtn.bg, this._navBtnSize, this._navBtnSize, false);
        this._drawSmallButton(this.nextBtn.bg, this._navBtnSize, this._navBtnSize, false);

        // ---- Seiten-Punkte ----
        this._dotR = Math.max(3, h * 0.008);
        const dotGap = this._dotR * 4;
        const dotsW = (PAGES.length - 1) * dotGap;
        this.dotsLayer.position.set(centerX - dotsW / 2, navY + this._navBtnSize / 2);
        this._dots.forEach((dot, i) => {
            dot.position.set(i * dotGap, 0);
            this._drawDot(dot, i === this.pageIndex);
        });
    }
}