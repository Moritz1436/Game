import * as PIXI from "pixi.js"
import { pixelText, drawBox } from "../Utils/UI.js";
import { COLORS } from "../Colors.js";
import { GAMESTATE } from "../GameState.js";
import { cityDistance } from "./Roads.js";
import { QUEST_TYPES } from "../Quest/Quests.js";


const MARKER_EDGE_MARGIN = 46;

//overlay for MapScene
export class MapOverlay extends PIXI.Container {

    ///@param app - PIXI Application
    ///@param callbacks - { onMenu }
    constructor(app, callbacks = {}) {
        super();
        this.app = app;
        this.callbacks = callbacks;
        this.eventMode = "static";

        this._buildTopBar();
        this._buildQuestMarkers();

        // Reagiert automatisch auf Stadt-Wechsel & Geld-Änderungen,
        // damit man setCity()/setMoney() nicht manuell nachziehen muss.
        this.gamestateListener = GAMESTATE.onChange((field, gameState) => {
            if (field === "currentCityIndex") {
                this._refreshCity(gameState);
            }
            if (field === "money") {
                this.setMoney(gameState.money);
            }
        });

        this._refreshCity(GAMESTATE);
        this.setMoney(GAMESTATE.money ?? 0);

        this.layout();

        this._resizeHandler = () => this.layout();
        window.addEventListener("resize", this._resizeHandler);
    }

    destroy(options) {
        window.removeEventListener("resize", this._resizeHandler);
        this.gamestateListener();
        super.destroy(options);
    }

    // -----------------------------------------------------------------
    // Top bar: Stadt (links), Geld (mitte-rechts), Menu (rechts)
    // -----------------------------------------------------------------
    _buildTopBar() {
        // ---- current city ----
        this.cityPanel = new PIXI.Container();
        this.addChild(this.cityPanel);

        this.cityPanelBg = new PIXI.Graphics();
        this.cityPanel.addChild(this.cityPanelBg);

        this.cityLabel = pixelText("CURRENT CITY", 10, COLORS.textDim);
        this.cityPanel.addChild(this.cityLabel);

        this.cityText = pixelText("", 15, COLORS.textLight);
        this.cityPanel.addChild(this.cityText);

        // ---- money ----
        this.moneyPanel = new PIXI.Container();
        this.addChild(this.moneyPanel);

        this.moneyPanelBg = new PIXI.Graphics();
        this.moneyPanel.addChild(this.moneyPanelBg);

        this.moneyLabel = pixelText("$", 18, COLORS.gold);
        this.moneyPanel.addChild(this.moneyLabel);

        this.moneyText = pixelText("0", 16, COLORS.gold);
        this.moneyPanel.addChild(this.moneyText);

        // ---- menu button ----
        this.menuButton = new PIXI.Container();
        this.menuButton.eventMode = "static";
        this.menuButton.cursor = "pointer";
        this.addChild(this.menuButton);

        this.menuButtonBg = new PIXI.Graphics();
        this.menuButton.addChild(this.menuButtonBg);

        this.menuButtonText = pixelText("Menu", 18, COLORS.textLight);
        this.menuButtonText.anchor.set(0.5);
        this.menuButton.addChild(this.menuButtonText);

        this.menuButton.on("pointerover", () => this._drawmenuButton(true));
        this.menuButton.on("pointerout", () => this._drawmenuButton(false));
        this.menuButton.on("pointerdown", () => {
            this.callbacks.onMenu && this.callbacks.onMenu();
        });
    }

    _drawmenuButton(hover) {
        const size = this._menuSize;
        drawBox(
            this.menuButtonBg,
            size, size,
            hover ? (COLORS.panelBgHover ?? COLORS.panelBorder) : COLORS.panelBg,
            COLORS.panelBorder,
            Math.max(2, size * 0.06)
        );
        this.menuButtonText.position.set(size / 2, size / 2);
    }

    // -----------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------
    _refreshCity(gameState) {
        this.setCity(gameState.currentCityName ?? "");
    }

    setCity(name) {
        this.cityText.text = name ?? "";
        this.layout();
    }

    setMoney(amount) {
        this.moneyText.text = `${Math.max(0, Math.round(amount))}`;
        this.layout();
    }

    _buildQuestMarkers() {
        this.questMarkerLayer = new PIXI.Container();
        this.addChild(this.questMarkerLayer);

        this._world = null;
        this._markerPool = new Map(); // cityIndex -> { container, arrow, label }
    }

    setWorld(world) {
        this._world = world;
    }

    updateQuestMarkers(cameraX, cameraY) {
        if (!this._world) return;

        const targets = this._collectMarkerTargets();
        const usedIndices = new Set();
        const screenW = this.app.screen.width;
        const screenH = this.app.screen.height;

        for (const { cityIndex, city } of targets) {
            usedIndices.add(cityIndex);

            const dx = city.cx - cameraX;
            const dy = city.cy - cameraY;
            const cityScreenX = screenW / 2 + dx;
            const cityScreenY = screenH / 2 + dy;

            const onScreen = cityScreenX > 0 && cityScreenX < screenW && cityScreenY > 0 && cityScreenY < screenH;

            const marker = this._getOrCreateMarker(cityIndex);
            marker.container.visible = true;

            const distance = cityDistance({ cx: cameraX, cy: cameraY }, city);
            marker.label.text = `${Math.round(distance)}m`;

            if (onScreen) {
                const hoverOffset = 200;
                marker.container.position.set(cityScreenX, cityScreenY - hoverOffset);
                marker.arrow.rotation = Math.PI;
                marker.label.position.set(-marker.label.width / 2, -34);
            } else {
                const edge = this._computeEdgePosition(dx, dy, screenW, screenH, MARKER_EDGE_MARGIN);
                marker.container.position.set(edge.x, edge.y);
                marker.arrow.rotation = edge.angle + Math.PI / 2;
                marker.label.position.set(-marker.label.width / 2, 28);
            }
        }

        for (const [cityIndex, marker] of this._markerPool) {
            if (!usedIndices.has(cityIndex)) marker.container.visible = false;
        }
    }

    _collectMarkerTargets() {
        const quest = GAMESTATE.activeQuest;
        if (!quest) return [];

        const targets = [];

        if (
            quest.type === QUEST_TYPES.DRIVE_TO_CITY ||
            quest.type === QUEST_TYPES.DELIVER_HEAVY ||
            quest.type === QUEST_TYPES.DRIVE_TO_CITY_TIMED
        ) {
            const idx = quest.data?.targetCityIndex;
            if (idx != null && this._world.cities[idx] && idx !== GAMESTATE.currentCityIndex) {
                targets.push({ cityIndex: idx, city: this._world.cities[idx] });
            }
        } else if (quest.type === QUEST_TYPES.RACE) {
            // Keine feste Ziel-Stadt bei RACE-Quests - stattdessen zu
            // JEDER Stadt mit Renn-Feature zeigen (siehe FEATURE_ACTIONS
            // in MapScene, city.feature === 'rennen')
            this._world.cities.forEach((city, idx) => {
                if (city.feature === 'rennen' && idx !== GAMESTATE.currentCityIndex) {
                    targets.push({ cityIndex: idx, city });
                }
            });
        }

        return targets;
    }

    _getOrCreateMarker(cityIndex) {
        let marker = this._markerPool.get(cityIndex);
        if (marker) return marker;

        const container = new PIXI.Container();
        container.eventMode = 'static';   // NEU
        container.cursor = 'pointer';     // NEU
        container.on('pointertap', () => {  // NEU
            const city = this._world?.cities[cityIndex];
            if (city) this.callbacks.onMarkerClick?.(city);
        });

        const bg = new PIXI.Graphics();
        bg.circle(0, 0, 24).fill({ color: 0x14161f, alpha: 0.85 });
        bg.circle(0, 0, 24).stroke({ width: 3, color: COLORS.gold, alpha: 0.9 });
        container.addChild(bg);

        const arrow = new PIXI.Graphics();
        arrow.poly([0, -15, 12, 10, -12, 10]).fill(COLORS.gold);
        container.addChild(arrow);

        const label = pixelText("", 19, COLORS.textLight);
        container.addChild(label);

        this.questMarkerLayer.addChild(container);
        marker = { container, arrow, label };
        this._markerPool.set(cityIndex, marker);
        return marker;
    }


    // Schneidet den Richtungsvektor (dx,dy) mit dem um margin verkleinerten
    // Bildschirmrechteck - liefert Position + Rotationswinkel fuer das Badge
    _computeEdgePosition(dx, dy, screenW, screenH, margin) {
        const halfW = screenW / 2 - margin;
        const halfH = screenH / 2 - margin;
        if (dx === 0 && dy === 0) return { x: screenW / 2, y: screenH / 2, angle: 0 };
        const scaleX = dx !== 0 ? halfW / Math.abs(dx) : Infinity;
        const scaleY = dy !== 0 ? halfH / Math.abs(dy) : Infinity;
        const scale = Math.min(scaleX, scaleY);
        return {
            x: screenW / 2 + dx * scale,
            y: screenH / 2 + dy * scale,
            angle: Math.atan2(dy, dx),
        };
    }

    // -----------------------------------------------------------------
    // Layout - alles relativ zu app.renderer.width/height
    // -----------------------------------------------------------------
    layout() {
        const w = this.app.renderer.width;
        const h = this.app.renderer.height;
        const margin = w * 0.02;

        this._menuSize = h * 0.06;

        // ---- city panel (top-left) ----
        const cityW = w * 0.2;
        const cityH = h * 0.06;
        drawBox(this.cityPanelBg, cityW, cityH, COLORS.panelBg, COLORS.panelBorder, Math.max(2, h * 0.004));
        this.cityPanel.position.set(margin, margin);

        this.cityLabel.style.fontSize = cityH * 0.22;
        this.cityLabel.position.set(cityH * 0.25, cityH * 0.10);

        this.cityText.style.fontSize = cityH * 0.34;
        this.cityText.position.set(cityH * 0.25, cityH * 0.44);

        // ---- money panel (top-right, links vom Menu-Button) ----
        const moneyW = w * 0.16;
        const moneyH = h * 0.06;
        drawBox(this.moneyPanelBg, moneyW, moneyH, COLORS.panelBg, COLORS.panelBorder, Math.max(2, h * 0.004));
        this.moneyPanel.position.set(w - margin - this._menuSize - margin * 0.5 - moneyW, margin);

        this.moneyLabel.style.fontSize = moneyH * 0.42;
        this.moneyLabel.position.set(moneyH * 0.25, moneyH * 0.5 - this.moneyLabel.height * 0.5);

        this.moneyText.style.fontSize = moneyH * 0.36;
        this.moneyText.position.set(this.moneyLabel.x + this.moneyLabel.width + moneyH * 0.15, moneyH * 0.5 - this.moneyText.height * 0.5);

        // ---- menu button (top-right) ----
        this._drawmenuButton(false);
        this.menuButton.position.set(w - margin - this._menuSize, margin);
    }

}