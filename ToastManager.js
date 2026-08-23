import * as PIXI from "pixi.js";
import { QUEST_TYPES } from "./Quest/Quests.js";
import { pixelText } from "./Utils/UI.js";
import { COLORS } from "./Colors.js";
import { GAMESTATE } from "./GameState.js";
import { SceneStack } from "./Utils/SceneStack.js";
import { UIScene } from "./Utils/UIScene.js";

function formatRemaining(ms) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
}

export class ToastManager extends UIScene {
    static _instance = null;

    static init(app) {
        if (ToastManager._instance) return ToastManager._instance;
        ToastManager._instance = new ToastManager(app);
        SceneStack.pushScene(ToastManager._instance, false);
        return ToastManager._instance;
    }

    static update(eventType, payload = {}) {
        ToastManager._instance?._handleEvent(eventType, payload);
    }

    constructor(app) {
        super(app, "ToastManager");
        
        this.topMost = true;

        this.uiScene = new PIXI.Container();
        this.uiScene.eventMode = "static";
        this.uiScene.cursor = "pointer";
        this.uiScene.visible = false;
        this.uiScene.alpha = 0;

        this._buildUI();

        this._state = "hidden"; // 'hidden' | 'active' | 'result'
        this._resultUntil = 0;
        this._resultKind = null; // 'success' | 'fail'
        this._animatingOut = false;

        this._dropdownOpen = false;
        this._dropdownAutoCloseAt = 0;

        this.card.eventMode = "static";
        this.card.cursor = "pointer";
        this.card.on("pointerdown", (e) => {
            e.stopPropagation();
        });
        this.card.on("pointertap", (e) => {
            e.stopPropagation();
            this._toggleDropdown();
        });

        this._onPointerDown = () => {
            if (this._dropdownOpen) this._closeDropdown();
        };

        this.uiScene.on("pointerdown", this._onPointerDown);

        this._resizeHandler = () => this.layout();
        window.addEventListener("resize", this._resizeHandler);

        this._tickerFn = () => this._tick();
        app.ticker.add(this._tickerFn);

        this.layout();
    }

    // -------------------------------------------------------------
    _buildUI() {
        this.card = new PIXI.Container();
        this.uiScene.addChild(this.card);
        
        this.bg = new PIXI.Graphics();
        this.card.addChild(this.bg);

        this.accentBar = new PIXI.Graphics();
        this.card.addChild(this.accentBar);

        this.titleText = pixelText("", 14, COLORS.textLight);
        this.titleText.anchor.set(0, 0.5);
        this.card.addChild(this.titleText);

        this.starsText = pixelText("", 10, COLORS.textDim);
        this.starsText.anchor.set(0, 0);
        this.card.addChild(this.starsText);

        this.timerText = pixelText("", 14, COLORS.gold);
        this.timerText.anchor.set(1, 0.5);
        this.card.addChild(this.timerText);

        this.progressTrack = new PIXI.Graphics();
        this.card.addChild(this.progressTrack);

        this.progressFill = new PIXI.Graphics();
        this.card.addChild(this.progressFill);

        this.resultText = pixelText("", 16, 0xffffff);
        this.resultText.anchor.set(0.5, 0.5);
        this.resultText.visible = false;
        this.card.addChild(this.resultText);

        // ---- Dropdown (klappt nach oben aus) ----
        this.dropdown = new PIXI.Container();
        this.dropdown.eventMode = "static";
        this.dropdown.on("pointerdown", (e) => {
            e.stopPropagation();
        });
        this.dropdown.visible = false;
        this.uiScene.addChild(this.dropdown);

        this.dropdownBg = new PIXI.Graphics();
        this.dropdown.addChild(this.dropdownBg);

        this.dropdownDesc = pixelText("", 12, COLORS.textLight);
        this.dropdownDesc.anchor.set(0, 0);
        this.dropdownDesc.style.wordWrap = true;
        this.dropdown.addChild(this.dropdownDesc);

        this.dropdownReward = pixelText("", 13, COLORS.gold);
        this.dropdownReward.anchor.set(0, 1);
        this.dropdown.addChild(this.dropdownReward);
    }

    // -------------------------------------------------------------
    _handleEvent(eventType, payload) {
        const quest = GAMESTATE.activeQuest;
        if (!quest) return;

        switch (eventType) {
            case "city_reached": this._onCityReached(quest, payload); break;
            case "distance": this._onDistance(quest, payload); break;
            case "race_won": this._onRaceWon(quest); break;
            case "crash": this._onCrash(quest); break;
        }
    }

    _onCityReached(quest, payload) {
        const targetIdx = quest.data?.targetCityIndex;
        if (targetIdx == null || payload.cityIndex !== targetIdx) return;

        if (quest.type === QUEST_TYPES.DRIVE_TO_CITY_TIMED && Date.now() > quest.expiresAt) {
            this._fail(quest, "TOO LATE");
            return;
        }

        if (
            quest.type === QUEST_TYPES.DRIVE_TO_CITY ||
            quest.type === QUEST_TYPES.DELIVER_HEAVY ||
            quest.type === QUEST_TYPES.DRIVE_TO_CITY_TIMED
        ) {
            this._complete(quest);
        }
    }

    _onDistance(quest, payload) {
        const meters = payload.deltaMeters ?? 0;
        if (meters <= 0) return;

        const CITY_TARGET_TYPES = [
            QUEST_TYPES.DRIVE_TO_CITY,
            QUEST_TYPES.DRIVE_TO_CITY_TIMED,
            QUEST_TYPES.DELIVER_HEAVY,
        ];
        if (CITY_TARGET_TYPES.includes(quest.type)) {
            if (payload.toCityIdx == null || payload.toCityIdx !== quest.data?.targetCityIndex) {
                return;
            }
        }

        quest.progress = (quest.progress ?? 0) + meters;

        if (quest.type === QUEST_TYPES.DRIVE_DISTANCE || quest.type === QUEST_TYPES.DRIVE_DISTANCE_NO_CRASH) {
            if (quest.progress >= quest.data.targetDistance) this._complete(quest);
        }
    }

    _onRaceWon(quest) {
        if (quest.type === QUEST_TYPES.RACE) this._complete(quest);
    }

    _onCrash(quest) {
        if (quest.type === QUEST_TYPES.DRIVE_DISTANCE_NO_CRASH) this._fail(quest, "CRASHED");
    }

    // -------------------------------------------------------------
    _complete(quest) {
        GAMESTATE.addMoney?.(quest.reward); // ANNAHME: GAMESTATE.addMoney(amount) existiert
        GAMESTATE.completeActiveQuest();
        this._showResult("success", `+$${quest.reward}`);
    }

    _fail(quest, reasonLabel) {
        GAMESTATE.failActiveQuest();
        this._showResult("fail", reasonLabel);
    }

    _showResult(kind, label) {
        this._state = "result";
        this._resultKind = kind;
        this._resultUntil = Date.now() + 2200;
        this.resultText.text = kind === "success" ? `QUEST COMPLETE  ${label}` : `QUEST FAILED  ${label}`;
        this.resultText.style.fill = kind === "success" ? 0x4caf50 : 0xd04040;
    }

    _toggleDropdown() {
        if (this._state !== "active" || !GAMESTATE.activeQuest) return;
        if (this._dropdownOpen) this._closeDropdown();
        else this._openDropdown();
    }

    // -------------------------------------------------------------
    _openDropdown() {
        this._dropdownOpen = true;
        this._dropdownAutoCloseAt = Date.now() + 6000; // 6s Auto-Close bei Inaktivitaet
        this.dropdown.visible = true;
        this._layoutDropdown();
        this._updateDropdownContent();
        this._animateDropdown(true);
    }

    _closeDropdown() {
        if (!this._dropdownOpen) return;
        this._dropdownOpen = false;
        this._animateDropdown(false);
    }

    _animateDropdown(opening) {
        const t0 = performance.now();
        const startAlpha = this.dropdown.alpha;
        const targetAlpha = opening ? 1 : 0;
        const step = (now) => {
            const t = Math.min(1, (now - t0) / 180);
            this.dropdown.alpha = startAlpha + (targetAlpha - startAlpha) * t;
            if (t < 1) {
                requestAnimationFrame(step);
            } else if (!opening) {
                this.dropdown.visible = false;
            }
        };
        requestAnimationFrame(step);
    }

    // -------------------------------------------------------------
    _tick() {
        const quest = GAMESTATE.activeQuest;

        if (this._state === "result") {
            if (Date.now() >= this._resultUntil) {
                this._state = quest ? "active" : "hidden";
            }
        } else if (quest) {
            if (Date.now() > quest.expiresAt) {
                this._fail(quest, "EXPIRED");
                return;
            }
            this._state = "active";
        } else {
            this._state = "hidden";
        }

        // Auto-Close des Dropdowns bei Inaktivitaet
        if (this._dropdownOpen && Date.now() >= this._dropdownAutoCloseAt) {
            this._closeDropdown();
        }

        this._updateVisibility();
        if (this._state === "active" || this._state === "result") {
            this._updateContent();
            if (this._dropdownOpen) this._updateDropdownContent();
        }
    }

    _updateVisibility() {
        const shouldShow = this._state !== "hidden";
        if (shouldShow && !this.uiScene.visible) {
            this.uiScene.visible = true;
            this._animateIn();
        } else if (!shouldShow && this.uiScene.visible && !this._animatingOut) {
            if (this._dropdownOpen) this._closeDropdown();
            this._animateOut();
        }
    }

    _animateIn() {
        const targetX = this.uiScene.x;
        this.uiScene.alpha = 0;
        this.uiScene.x = targetX + 40;
        const t0 = performance.now();
        const step = (now) => {
            const t = Math.min(1, (now - t0) / 280);
            const eased = 1 - Math.pow(1 - t, 3);
            this.uiScene.alpha = eased;
            this.uiScene.x = targetX + 40 * (1 - eased);
            if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }

    _animateOut() {
        this._animatingOut = true;
        const t0 = performance.now();
        const startAlpha = this.uiScene.alpha;
        const step = (now) => {
            const t = Math.min(1, (now - t0) / 320);
            this.uiScene.alpha = startAlpha * (1 - t);
            if (t < 1) {
                requestAnimationFrame(step);
            } else {
                this.uiScene.visible = false;
                this._animatingOut = false;
            }
        };
        requestAnimationFrame(step);
    }

    _updateContent() {
        const quest = GAMESTATE.activeQuest;

        if (this._state === "result") {
            this.titleText.visible = false;
            this.starsText.visible = false;
            this.timerText.visible = false;
            this.progressTrack.visible = false;
            this.progressFill.visible = false;
            this.resultText.visible = true;

            const pulse = 0.6 + Math.sin(Date.now() / 100) * 0.4;
            this._redrawBg(this._resultKind === "success" ? 0x2d5a3a : 0x5a2d2d, pulse);
            return;
        }

        if (!quest) return;

        this.titleText.visible = true;
        this.starsText.visible = true;
        this.timerText.visible = true;
        this.progressTrack.visible = true;
        this.progressFill.visible = true;
        this.resultText.visible = false;

        this.titleText.text = quest.name;
        this.starsText.text = "\u2605".repeat(quest.difficulty) + "\u2606".repeat(5 - quest.difficulty);

        const remaining = quest.expiresAt - Date.now();
        const urgent = remaining < 60000;
        const critical = remaining < 10000;
        this.timerText.text = formatRemaining(remaining);
        this.timerText.style.fill = critical ? 0xff4444 : (urgent ? 0xffaa44 : COLORS.gold);
        this.timerText.alpha = critical ? (0.6 + (0.5 + Math.sin(Date.now() / 120) * 0.5) * 0.4) : 1;

        // Fortschritts-Fraktion: echte Distanz-Quests nutzen quest.progress
        // direkt, city-Ziel-Quests approximieren ueber die Luftlinien-
        // distanz aus quest.data.distance, RACE hat keine sinnvolle 0..1-
        // Metrik und zeigt stattdessen einen wandernden Puls-Block
        let fraction = 0, indeterminate = false;
        if (quest.type === QUEST_TYPES.DRIVE_DISTANCE || quest.type === QUEST_TYPES.DRIVE_DISTANCE_NO_CRASH) {
            fraction = Math.min(1, (quest.progress ?? 0) / quest.data.targetDistance);
        } else if (quest.data?.distance) {
            fraction = Math.min(1, (quest.progress ?? 0) / quest.data.distance);
        } else {
            indeterminate = true;
        }

        this._drawProgress(fraction, indeterminate, urgent, critical);
        const accentColor = critical ? 0xff4444 : (urgent ? 0xffaa44 : COLORS.gold);
        this._redrawBg(0x14161f, 1, accentColor);
    }

    _updateDropdownContent() {
        const quest = GAMESTATE.activeQuest;
        if (!quest) return;
        this.dropdownDesc.text = quest.fullDesc;
        this.dropdownReward.text = `Reward: $${quest.reward}`;
        this._layoutDropdown(); // Hoehe haengt vom Wordwrap ab -> neu berechnen
    }

    // -------------------------------------------------------------
    _redrawBg(baseColor, alpha, accentColor = COLORS.gold) {
        const w = this._panelW, h = this._panelH, r = this._panelH * 0.22;
        this.bg.clear();
        this.bg.roundRect(0, 0, w, h, r).fill({ color: baseColor, alpha: 0.88 * alpha });
        this.bg.roundRect(0, 0, w, h, r).stroke({ width: Math.max(1.5, h * 0.02), color: accentColor, alpha: 0.7 * alpha });

        this.accentBar.clear();
        const barW = w * 0.012;
        this.accentBar.roundRect(0, h * 0.15, barW, h * 0.7, barW / 2).fill({ color: accentColor, alpha: 0.9 * alpha });
    }

    _drawProgress(fraction, indeterminate, urgent, critical) {
        const w = this._panelW, h = this._panelH;
        const barX = w * 0.06, barY = h * 0.74, barW = w * 0.88, barH = h * 0.10, r = barH / 2;

        this.progressTrack.clear();
        this.progressTrack.roundRect(barX, barY, barW, barH, r).fill({ color: 0x000000, alpha: 0.35 });

        this.progressFill.clear();
        const fillColor = critical ? 0xff4444 : (urgent ? 0xffaa44 : COLORS.gold);

        if (indeterminate) {
            const cyclePos = (Date.now() / 2400) % 1;
            const blockW = barW * 0.32;
            const travel = barW - blockW;
            const x = barX + travel * (0.5 - 0.5 * Math.cos(cyclePos * Math.PI * 2));
            this.progressFill.roundRect(x, barY, blockW, barH, r).fill({ color: fillColor, alpha: 0.85 });
        } else {
            const fillW = Math.max(barH, barW * fraction);
            this.progressFill.roundRect(barX, barY, fillW, barH, r).fill(fillColor);
        }
    }

    _layoutDropdown() {
        const w = this._panelW;
        const padX = w * 0.06;
        const padY = w * 0.05;

        this.dropdownDesc.style.fontSize = this._panelH * 0.14;
        this.dropdownDesc.style.wordWrapWidth = w - padX * 2;
        this.dropdownDesc.position.set(padX, padY);

        const descH = this.dropdownDesc.height;
        const dropdownH = padY + descH + padY * 0.8 + this._panelH * 0.22 + padY * 0.6;

        this.dropdownReward.style.fontSize = this._panelH * 0.16;
        this.dropdownReward.position.set(padX, dropdownH - padY * 0.5);

        this._dropdownH = dropdownH;

        this.dropdownBg.clear();
        this.dropdownBg.roundRect(0, 0, w, dropdownH, this._panelH * 0.18).fill({ color: 0x14161f, alpha: 0.92 });
        this.dropdownBg.roundRect(0, 0, w, dropdownH, this._panelH * 0.18).stroke({ width: 1.5, color: COLORS.gold, alpha: 0.4 });

        // Dropdown sitzt UEBER der Karte (Toast ist unten rechts), also
        // negativer Y-Offset in Root-Koordinaten, mit kleinem Gap
        const gap = this._panelH * 0.12;
        this.dropdown.position.set(0, -dropdownH - gap);
    }

    // -------------------------------------------------------------
    layout() {
        const h = this.app.renderer.height;
        const w = this.app.renderer.width;

        this._panelW = Math.min(420, w * 0.34);
        this._panelH = h * 0.13;

        const margin = h * 0.025;
        const targetX = w - this._panelW - margin;
        const targetY = h - this._panelH - margin;
        this.uiScene.position.set(targetX, targetY);

        this.titleText.style.fontSize = this._panelH * 0.17;
        this.titleText.position.set(this._panelW * 0.06, this._panelH * 0.28);

        this.starsText.style.fontSize = this._panelH * 0.12;
        this.starsText.position.set(this._panelW * 0.06, this._panelH * 0.46);

        this.timerText.style.fontSize = this._panelH * 0.20;
        this.timerText.position.set(this._panelW * 0.94, this._panelH * 0.26);

        this.resultText.style.fontSize = this._panelH * 0.16;
        this.resultText.position.set(this._panelW / 2, this._panelH / 2);

        if (this._dropdownOpen) this._layoutDropdown();

        if (GAMESTATE.activeQuest || this._state === "result") this._updateContent();
        else this._redrawBg(0x14161f, 1);
    }

    destroy() {
        window.removeEventListener("resize", this._resizeHandler);
        this.app.ticker.remove(this._tickerFn);
        this.uiScene.off("pointerdown", this._onPointerDown);
        this.uiScene.destroy({ children: true });
        ToastManager._instance = null;
    }
}