import * as PIXI from "pixi.js";
import { GAMESTATE } from "../GameState.js";
import { CircularGauge } from "./CircularGauge.js";

const COLORS = {
    panelBg: 0x2b2b2b,
    panelBorder: 0x111111,
    gold: 0xf4c542,
    goldDark: 0xa9791b,
    textLight: 0xffffff,
    textDim: 0xaaaaaa,
    exitRed: 0xb03030,
    exitRedHover: 0xd04040,
    boostBg: 0x1a1a1a,
    boostFill: 0x4fc3f7,       // hellblau
    boostFillCooldown: 0x2a5a6b, // gedämpft während Cooldown, kein Boost verfügbar
    speedFill: 0xf4c542,
    rpmFillLow: 0x4caf50,
    rpmFillHigh: 0xd04040,
    tipBg: 0x000000
};

export function pixelText(str, size, color = COLORS.textLight) {
    const t = new PIXI.Text({
        text: str,
        style: { fontFamily: "monospace", fontSize: size, fill: color, fontWeight: "bold" },
    });
    t.resolution = 2;
    return t;
}

function drawBox(g, w, h, bg, border, borderWidth) {
    g.clear();
    g.rect(0, 0, w, h).fill(bg);
    g.rect(0, 0, w, h).stroke({ width: borderWidth, color: border });
}

// ---------------------------------------------------------------------------
// Simple horizontal gauge: Label + Balken + Zahl. Für Speed/RPM.
// ---------------------------------------------------------------------------
class Gauge extends PIXI.Container {
    constructor(label, fillColor, maxValue) {
        super();
        this.maxValue = maxValue;
        this.fillColor = fillColor;
        this.value = 0;

        this.bg = new PIXI.Graphics();
        this.addChild(this.bg);

        this.fill = new PIXI.Graphics();
        this.addChild(this.fill);

        this.labelText = pixelText(label, 10, COLORS.textDim);
        this.addChild(this.labelText);

        this.valueText = pixelText("0", 14, COLORS.textLight);
        this.addChild(this.valueText);
    }

    setValue(v) {
        this.value = Math.max(0, Math.min(this.maxValue, v));
        this.valueText.text = Math.round(this.value).toString();
        this._redrawFill();
    }

    setSize(w, h) {
        this.w = w;
        this.h = h;

        drawBox(this.bg, w, h, COLORS.boostBg, COLORS.panelBorder, Math.max(2, h * 0.05));

        this.labelText.style.fontSize = h * 0.22;
        this.labelText.position.set(h * 0.15, h * 0.08);

        this.valueText.style.fontSize = h * 0.32;
        this.valueText.anchor.set(1, 0);
        this.valueText.position.set(w - h * 0.15, h * 0.08);

        this._redrawFill();
    }

    _redrawFill() {
        if (!this.w) return;
        this.fill.clear();
        const barY = this.h * 0.62;
        const barH = this.h * 0.28;
        const barW = (this.w - this.h * 0.3) * (this.value / this.maxValue);
        if (barW > 0) {
            this.fill.rect(this.h * 0.15, barY, barW, barH).fill(this.fillColor);
        }
    }
}


//overlay for DriveScene
export class DriveOverlay extends PIXI.Container {

    ///@param app - PIXI Application
    ///@param callbacks - { onExit }
    constructor(app, boost_duration, callbacks = {}) {
        super();
        this.app = app;
        this.callbacks = callbacks;
        this.eventMode = "static";

        // ---- boost state ----
        this.boostAmount = 1;          // 0..1
        this.boosting = false;
        this.boostDrainPerSecond = 1 / boost_duration;
        this.boostRefillPerSecond = 1 / (boost_duration * 4);
        this.boostCooldownDuration = 1.5;
        this._cooldownTimer = 0;
        // ---- tutorial tips ----
        this._tipStage = 0;
        // 0 = drive tip
        // 1 = boost tip
        // 2 = both done

        this._tipDriveKeys = new Set(["w", "a", "s", "d"]);
        this.boostEndCallback = null;

        this.tipSettingListener = GAMESTATE.onChange((field, gameState) => {
            if (field == "showTips") {
                if (!gameState.showTips) this.hideTip();
            }
        });

        this._buildTopBar();
        this._buildBottomBar();
        this._buildTip();

        this._initTutorialTips();

        this.layout();

        this._resizeHandler = () => this.layout();
        window.addEventListener("resize", this._resizeHandler);
    }

    destroy(options) {
        window.removeEventListener("resize", this._resizeHandler);
        if (this._onTutorialKeyDown) {
            window.removeEventListener("keydown", this._onTutorialKeyDown);
        }
        this.tipSettingListener();
        super.destroy(options);
    }

    _initTutorialTips() {
        if (!GAMESTATE.showTips) return;

        this._tipStage = 0;

        this.showTip("Use W/A/S/D to drive");

        this._onTutorialKeyDown = (e) => {
            if (!GAMESTATE.showTips) return;

            const key = e.key.toLowerCase();

            if (this._tipStage === 0 && this._tipDriveKeys.has(key)) {
                this._tipStage = 1;

                this.showTip("Use SPACE to boost");
            }
        };

        window.addEventListener("keydown", this._onTutorialKeyDown);
    }

    // -----------------------------------------------------------------
    // Top bar: Distance (links), Boost-Bar (mitte), Exit (rechts)
    // -----------------------------------------------------------------
    _buildTopBar() {
        // ---- distance ----
        this.distancePanel = new PIXI.Container();
        this.addChild(this.distancePanel);

        this.distancePanelBg = new PIXI.Graphics();
        this.distancePanel.addChild(this.distancePanelBg);

        this.distanceText = pixelText("0m", 16, COLORS.textLight);
        this.distancePanel.addChild(this.distanceText);

        // ---- boost bar ----
        this.boostPanel = new PIXI.Container();
        this.addChild(this.boostPanel);

        this.boostBg = new PIXI.Graphics();
        this.boostPanel.addChild(this.boostBg);

        this.boostFill = new PIXI.Graphics();
        this.boostPanel.addChild(this.boostFill);

        this.boostLabel = pixelText("BOOST", 12, COLORS.textLight);
        this.boostLabel.anchor.set(0.5);
        this.boostPanel.addChild(this.boostLabel);

        // ---- exit button (1:1 aus eurem bestehenden Snippet übernommen) ----
        this.exitButton = new PIXI.Container();
        this.exitButton.eventMode = "static";
        this.exitButton.cursor = "pointer";
        this.addChild(this.exitButton);

        this.exitButtonBg = new PIXI.Graphics();
        this.exitButton.addChild(this.exitButtonBg);

        this.exitButtonText = pixelText("X", 16, COLORS.textLight);
        this.exitButtonText.anchor.set(0.5);
        this.exitButton.addChild(this.exitButtonText);

        this.exitButton.on("pointerover", () => this._drawExitButton(true));
        this.exitButton.on("pointerout", () => this._drawExitButton(false));
        this.exitButton.on("pointerdown", () => {
            this.callbacks.onExit && this.callbacks.onExit();
        });
    }

    _drawExitButton(hover) {
        const size = this._exitSize;
        drawBox(this.exitButtonBg, size, size, hover ? COLORS.exitRedHover : COLORS.exitRed, COLORS.panelBorder, Math.max(2, size * 0.06));
        this.exitButtonText.position.set(size / 2, size / 2);
    }

    // -----------------------------------------------------------------
    // Bottom bar: Speedometer (links), RPM (daneben), Tip (mitte)
    // -----------------------------------------------------------------
    _buildBottomBar() {
        this.speedGauge = new CircularGauge("SPEED", 300, 50);
        this.addChild(this.speedGauge);

        this.rpmGauge = new CircularGauge("RPM", 8000, 1000, 6000); // Redline ab 6000
        this.addChild(this.rpmGauge);
    }

    _buildTip() {
        this.tipPanel = new PIXI.Container();
        this.tipPanel.visible = false;
        this.addChild(this.tipPanel);

        this.tipBg = new PIXI.Graphics();
        this.tipPanel.addChild(this.tipBg);

        this.tipText = pixelText("", 14, COLORS.textLight);
        this.tipText.anchor.set(0.5);
        this.tipPanel.addChild(this.tipText);
    }

    // -----------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------
    setDistance(meters) {
        this.distanceText.text = `${Math.max(0, Math.round(meters))}m`;
    }

    setSpeed(value) {
        this.speedGauge.setValue(value);
    }

    setRPM(value) {
        this.rpmGauge.setValue(value);
    }

    showTip(text) {
        if (!GAMESTATE.showTips) return;

        this.tipText.text = text;
        this.tipPanel.visible = true;
        this.layout();
    }

    hideTip() {
        this.tipPanel.visible = false;
    }

    // Vom Spiel aufgerufen, wenn der Spieler Boost aktiviert (z.B. Space gedrückt)
    onBoostStart(onBoostEnd) {
        if (this.boostAmount <= 0) return false; // no boost left
        this.boosting = true;
        this.boostEndCallback = onBoostEnd;

        if (this._tipStage === 1) {
            this._tipStage = 2;
            this.hideTip();

            //tutorial done
            GAMESTATE.setShowTips(false);
        }

        return true;
    }

    // Vom Spiel aufgerufen, wenn Boost losgelassen/beendet wird
    onBoostEnd() {
        this.boosting = false;
        if (this.boostEndCallback) this.boostEndCallback();
        this.boostEndCallback = null;
        this._cooldownTimer = this.boostCooldownDuration;
    }

    update(dt) {
        if (this.boosting) {
            this.boostAmount = Math.max(0, this.boostAmount - this.boostDrainPerSecond * dt);
            this._cooldownTimer = this.boostCooldownDuration; // Cooldown wird während Boost immer wieder zurückgesetzt

            if (this.boostAmount <= 0) {
                this.onBoostEnd();
            }
        } else if (this._cooldownTimer > 0) {
            this._cooldownTimer -= dt;
        } else if (this.boostAmount < 1) {
            this.boostAmount = Math.min(1, this.boostAmount + this.boostRefillPerSecond * dt);
        }

        this._redrawBoostFill();

        this.speedGauge.update(dt);
        this.rpmGauge.update(dt);
    }

    _redrawBoostFill() {
        if (!this._boostBarW) return;
        this.boostFill.clear();

        const inCooldown = !this.boosting && this._cooldownTimer > 0;
        const color = inCooldown ? COLORS.boostFillCooldown : COLORS.boostFill;

        const fillW = (this._boostBarW - this._boostBarPad * 2) * this.boostAmount;
        if (fillW > 0) {
            this.boostFill.rect(this._boostBarPad, this._boostBarPad, fillW, this._boostBarH - this._boostBarPad * 2).fill(color);
        }
    }

    // -----------------------------------------------------------------
    // Layout - alles relativ zu app.renderer.width/height
    // -----------------------------------------------------------------
    layout() {
        const w = this.app.renderer.width;
        const h = this.app.renderer.height;
        const margin = w * 0.02;

        // ---- distance (top-left) ----
        const distW = w * 0.16;
        const distH = h * 0.06;
        drawBox(this.distancePanelBg, distW, distH, COLORS.panelBg, COLORS.panelBorder, Math.max(2, h * 0.004));
        this.distancePanel.position.set(margin, margin);
        this.distanceText.style.fontSize = distH * 0.4;
        this.distanceText.position.set(distH * 0.25, distH * 0.5 - this.distanceText.height * 0.5);

        // ---- boost bar (top-center) ----
        const boostW = w * 0.3;
        const boostH = h * 0.05;
        this._boostBarW = boostW;
        this._boostBarH = boostH;
        this._boostBarPad = Math.max(2, boostH * 0.15);

        this.boostBg.clear();
        drawBox(this.boostBg, boostW, boostH, COLORS.boostBg, COLORS.panelBorder, Math.max(2, h * 0.004));
        this.boostPanel.position.set((w - boostW) / 2, margin);

        this.boostLabel.style.fontSize = boostH * 0.5;
        this.boostLabel.position.set(boostW / 2, boostH / 2);

        this._redrawBoostFill();

        // ---- exit button (top-right) ----
        this._exitSize = h * 0.06;
        this._drawExitButton(false);
        this.exitButton.position.set(w - margin - this._exitSize, margin);

        // ---- bottom-left: speed + rpm (Rundinstrumente) ----
        const gaugeDiameter = h * 0.22;
        const gaugeGap = w * 0.015;

        this.speedGauge.setSize(gaugeDiameter);
        this.speedGauge.position.set(margin + gaugeDiameter / 2, h - gaugeDiameter / 2 - margin);

        this.rpmGauge.setSize(gaugeDiameter);
        this.rpmGauge.position.set(margin + gaugeDiameter + gaugeGap + gaugeDiameter / 2, h - gaugeDiameter / 2 - margin);

        // ---- tip (bottom-center) ----
        if (this.tipPanel.visible) {
            const tipPadX = w * 0.02;
            const tipH = h * 0.05;
            this.tipText.style.fontSize = tipH * 0.4;

            const tipW = this.tipText.width + tipPadX * 2;

            this.tipBg.clear();
            this.tipBg.roundRect(0, 0, tipW, tipH, 0).fill({ color: COLORS.tipBg, alpha: 0.65 });
            this.tipBg.rect(0, 0, tipW, tipH).stroke({ width: Math.max(1, h * 0.003), color: COLORS.panelBorder });

            this.tipPanel.position.set((w - tipW) / 2, h - tipH - margin - h * 0.02);
            this.tipText.position.set(tipW / 2, tipH / 2);
        }
    }

}