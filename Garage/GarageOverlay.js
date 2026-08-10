import * as PIXI from "pixi.js";
import { GAMESTATE } from "../GameState";
import { HorizontalScroller } from "./HorizonalScroller.js";
import { HSVColorPicker } from "./HSVColorPicker.js";
import { hexToRgb, rgbToHex, rgbToHsv, hsvToRgb } from "./HSVColorPicker.js";

const COLORS = {
    panelBg: 0x2b2b2b,
    panelBorder: 0x111111,
    gold: 0xf4c542,
    goldDark: 0xa9791b,
    boxBg: 0x3a3a3a,
    boxBgHover: 0x4a4a4a,
    boxBgSelected: 0x5a5a3a,
    boxBorder: 0x111111,
    textLight: 0xffffff,
    exitRed: 0xb03030,
    exitRedHover: 0xd04040,
};

function pixelText(str, size, color = COLORS.textLight) {
    const t = new PIXI.Text({
        text: str,
        style: {
            fontFamily: "monospace",
            fontSize: size,
            fill: color,
            fontWeight: "bold",
        },
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
// Erzeugt eine klickbare Box (ohne dauerhafte Selektion, nur für Kategorien)
// ---------------------------------------------------------------------------
function createCategoryBox(size, label, onClick) {
    const c = new PIXI.Container();
    c.eventMode = "static";
    c.cursor = "pointer";
    c.width = size;
    c.height = size;

    const bg = new PIXI.Graphics();
    c.addChild(bg);

    const txt = pixelText(label, size * 0.16, COLORS.textLight);
    txt.anchor.set(0.5);
    txt.position.set(size / 2, size / 2);
    txt.style.wordWrap = true;
    txt.style.wordWrapWidth = size * 0.9;
    txt.style.align = "center";
    c.addChild(txt);

    function redraw() {
        drawBox(bg, size, size, COLORS.boxBg, COLORS.boxBorder, Math.max(2, size * 0.03));
    }
    redraw();

    c.on("pointerover", () => {
        drawBox(bg, size, size, COLORS.boxBgHover, COLORS.boxBorder, Math.max(2, size * 0.03));
    });
    c.on("pointerout", redraw);
    c.on("pointerdown", () => onClick && onClick(c));

    return c;
}

// ---------------------------------------------------------------------------
// Erzeugt eine auswählbare Box (für Optionen) – mit Highlight
// ---------------------------------------------------------------------------
function createSelectableBox(size, label, onClick) {
    const c = new PIXI.Container();
    c.eventMode = "static";
    c.cursor = "pointer";
    c.width = size;
    c.height = size;

    const bg = new PIXI.Graphics();
    c.addChild(bg);

    const txt = pixelText(label, size * 0.16, COLORS.textLight);
    txt.anchor.set(0.5);
    txt.position.set(size / 2, size / 2);
    txt.style.wordWrap = true;
    txt.style.wordWrapWidth = size * 0.9;
    txt.style.align = "center";
    c.addChild(txt);

    let selected = false;

    function redraw() {
        drawBox(bg, size, size, selected ? COLORS.boxBgSelected : COLORS.boxBg, COLORS.boxBorder, Math.max(2, size * 0.03));
    }
    redraw();

    c.on("pointerover", () => {
        if (!selected) drawBox(bg, size, size, COLORS.boxBgHover, COLORS.boxBorder, Math.max(2, size * 0.03));
    });
    c.on("pointerout", redraw);
    c.on("pointerdown", () => onClick && onClick(c));

    c.setSelected = (v) => { selected = v; redraw(); };

    return c;
}

export class GarageOverlay extends PIXI.Container {

    constructor(app, assetManager, car, carConfigState, callbacks = {}) {
        super();

        this.app = app;
        this.car = car;
        this.assetManager = assetManager;
        this.carConfigState = carConfigState;
        this.callbacks = callbacks;

        this.selectedType = null;
        this.currentBaseAsset = null;
        this.mode = "parts"; // "parts" | "color"
        this.colorPicker = null;
        this.colorPickerTarget = null; // { type, meshName, baseAsset }

        this.eventMode = "static";

        this._buildTopBar();
        this._buildModeButtons();

        const rowHeight = this.app.renderer.height * 0.16;
        const boxSize = rowHeight * 0.72;
        const w = this.app.renderer.width;
        this._gap = w * 0.015;
        this._boxSize = boxSize;

        //lower row
        [this.bottomContainer, this.bottomBg, this.bottomScroller] = this._createScroller(boxSize);
        
        //upper row
        [this.optionsContainer, this.optionsBg, this.optionsScroller] = this._createScroller(boxSize);
        this.optionsContainer.visible = false;

        //color picker
        this.colorPickerOutside = new PIXI.Graphics();
        this.colorPickerOutside.eventMode = "static";
        this.colorPickerOutside.visible = false;

        this.addChild(this.colorPickerOutside);

        this.colorPickerPanel = new PIXI.Container();
        this.colorPickerPanel.visible = false;
        this.addChild(this.colorPickerPanel);
        this.colorPickerBg = new PIXI.Graphics();
        this.colorPickerPanel.addChild(this.colorPickerBg);

        this._onKeyDown = (e) => {
            if (e.key === "Enter" && this.colorPickerPanel.visible) {
                this._closeColorPicker();
            }
        };
        window.addEventListener("keydown", this._onKeyDown);

        // init
        this._updateBottomRow();

        this._resizeHandler = () => this.layout();
        window.addEventListener("resize", this._resizeHandler);

        this.layout();
    }

    _createScroller(boxSize) {
        const container = new PIXI.Container();
        this.addChild(container);
        const bg = new PIXI.Graphics();
        container.addChild(bg);
        const scroller = new HorizontalScroller(100, boxSize);
        container.eventMode = "static";
        container.on("wheel", (e) => { scroller._onWheel(e); });
        container.on("pointerdown", (e) => { scroller._onDragStart(e); });
        container.on("globalpointermove", (e) => { scroller._onDragMove(e); });
        container.on("pointerup", (e) => { scroller._onDragEnd(e); });
        container.on("pointerupoutside", (e) => { scroller._onDragEnd(e); });
        container.addChild(scroller);

        return [container, bg, scroller];
    }

    _buildModeButtons() {
        this.modeButtonsContainer = new PIXI.Container();
        this.addChild(this.modeButtonsContainer);

        const wrenchTexture = PIXI.Sprite.from("assets/wrench.png");
        const colorPickerTexture = PIXI.Sprite.from("assets/colorpicker.png");

        this.wrenchButton = this._createModeButton(wrenchTexture, () => this._setMode("parts"));
        this.colorButton = this._createModeButton(colorPickerTexture, () => this._setMode("color"));

        this.modeButtonsContainer.addChild(this.wrenchButton);
        this.modeButtonsContainer.addChild(this.colorButton);

        this._refreshModeButtonHighlight();
    }

    _createModeButton(texture, onClick) {
        const c = new PIXI.Container();
        c.eventMode = "static";
        c.cursor = "pointer";

        const bg = new PIXI.Graphics();
        c.addChild(bg);
        c._bg = bg;

        const sprite = new PIXI.Sprite(texture);
        sprite.anchor.set(0.5);
        c.addChild(sprite);
        c._sprite = sprite;

        c.on("pointerdown", onClick);
        return c;
    }

    _setMode(mode) {
        if (this.mode === mode) return;
        this.mode = mode;
        this._closeOptions();
        this._closeColorPicker();
        this._refreshModeButtonHighlight();
        this.layout();
    }

    _refreshModeButtonHighlight() {
        const size = this._modeBtnSize ?? 40;
        for (const [btn, active] of [
            [this.wrenchButton, this.mode === "parts"],
            [this.colorButton, this.mode === "color"],
        ]) {
            drawBox(btn._bg, size, size, active ? COLORS.boxBgSelected : COLORS.boxBg, COLORS.boxBorder, Math.max(2, size * 0.06));
        }
    }

    // -----------------------------------------------------------------
    // Klick auf Kategorie: verzweigt je nach Modus
    // -----------------------------------------------------------------
    _onBottomItemClick(type) {
        if (this.mode === "color") {
            this._onColorCategoryClick(type);
            return;
        }

        if (this.selectedType === type) {
            this._closeOptions();
            return;
        }
        this.selectedType = type;
        this._updateOptionsRow(type);
        this.optionsContainer.visible = true;
        this._closeColorPicker();
        this.layout();
    }

    _onColorCategoryClick(type) {
        if (this.selectedType === type && this.optionsContainer.visible) {
            this._closeOptions();
            return;
        }
        this.selectedType = type;
        this._closeColorPicker();
        this._updateColorRow(type);
        this.optionsContainer.visible = true;
        this.layout();
    }

    _closeOptions() {
        this.selectedType = null;
        this.optionsContainer.visible = false;
        this._closeColorPicker();
        this.layout();
    }

    // -----------------------------------------------------------------
    // Mesh-Reihe für einen Typ (Farbmodus) - ersetzt Options-Reihe
    // -----------------------------------------------------------------
    _updateColorRow(type) {
        const isBase = type === "base";
        const baseAsset = this.currentBaseAsset;

        const pieceName = isBase
            ? this.carConfigState.data.base
            : this.carConfigState.getPartForType(type, baseAsset);

        const items = [];

        if (!pieceName) {
            this.optionsScroller.setItems(items, this._gap, this._boxSize);
            return;
        }

        const asset = this.assetManager.getAssetByName(pieceName);
        if (!asset || !asset.meshes) {
            this.optionsScroller.setItems(items, this._gap, this._boxSize);
            return;
        }

        for (const meshDef of asset.meshes) {
            const overrideHex = this.carConfigState.getMeshColor(type, meshDef.name);
            const currentHex = overrideHex ?? rgbToHex(...hsvToRgb(...rgbToHsv(
                Math.round(meshDef.baseColor[0] * 255),
                Math.round(meshDef.baseColor[1] * 255),
                Math.round(meshDef.baseColor[2] * 255)
            )));

            const box = this._createMeshBox(this._boxSize, meshDef.name, currentHex, () => {
                this._openColorPickerFor(type, meshDef.name, baseAsset, currentHex, box);
            });
            items.push(box);
        }

        this.optionsScroller.setItems(items, this._gap, this._boxSize);
    }

    _createMeshBox(size, label, colorHex, onClick) {
        const c = new PIXI.Container();
        c.eventMode = "static";
        c.cursor = "pointer";
        c.width = size;
        c.height = size;

        const bg = new PIXI.Graphics();
        c.addChild(bg);

        const swatch = new PIXI.Graphics();
        const swatchH = size * 0.28;
        swatch.rect(size * 0.08, size - swatchH - size * 0.08, size * 0.84, swatchH)
            .fill(parseInt(colorHex.replace("#", "0x")))
            .stroke({ width: 1, color: COLORS.boxBorder });
        c.addChild(swatch);

        const txt = pixelText(label, size * 0.14, COLORS.textLight);
        txt.anchor.set(0.5, 0);
        txt.position.set(size / 2, size * 0.1);
        txt.style.wordWrap = true;
        txt.style.wordWrapWidth = size * 0.9;
        txt.style.align = "center";
        c.addChild(txt);

        function redraw() {
            drawBox(bg, size, size, COLORS.boxBg, COLORS.boxBorder, Math.max(2, size * 0.03));
        }
        redraw();

        c.on("pointerover", () => {
            drawBox(bg, size, size, COLORS.boxBgHover, COLORS.boxBorder, Math.max(2, size * 0.03));
        });
        c.on("pointerout", redraw);
        c.on("pointerdown", () => onClick && onClick());

        c._updateSwatch = (hex) => {
            swatch.clear();
            swatch.rect(size * 0.08, size - swatchH - size * 0.08, size * 0.84, swatchH)
                .fill(parseInt(hex.replace("#", "0x")))
                .stroke({ width: 1, color: COLORS.boxBorder });
        };

        return c;
    }

    // -----------------------------------------------------------------
    // Farbwähler öffnen/schließen
    // -----------------------------------------------------------------
    _openColorPickerFor(type, meshName, baseAsset, currentHex, boxRef) {
        this.colorPickerTarget = { type, meshName, baseAsset, boxRef };

        if (!this.colorPicker) {
            this.colorPicker = new HSVColorPicker(
                this._boxSize * 3, 
                (hex) => {
                    const t = this.colorPickerTarget;
                    if (!t) return;
                    this.carConfigState.setMeshColor(t.type, t.meshName, hex);
                    const pieces = t.type === "base" ? [this.car.rootPiece] : this.car.getPiecesByType(t.type);
                    for (const piece of pieces) {
                        piece.setMeshBaseColor(t.meshName, hex);
                    }
                    t.boxRef._updateSwatch(hex);
                }
            );
            this.colorPickerPanel.addChild(this.colorPicker);
        }

        const savedHex = this.carConfigState.getMeshColor(type, meshName) ?? currentHex;
        this.colorPicker.setColorHex(savedHex);

        // Click-Catcher aktivieren
        this.colorPickerOutside.visible = true;
        this.colorPickerOutside.clear();
        this.colorPickerOutside
            .rect(
                0,
                0,
                this.app.renderer.width,
                this.app.renderer.height
            )
            .fill({ color: 0x000000, alpha: 0.001 });

        // Klick außerhalb schließt
        this.colorPickerOutside.off("pointerdown");
        this.colorPickerOutside.on("pointerdown", () => {
            this._closeColorPicker();
        });

        this.colorPickerPanel.visible = true;
        this.layout();
    }

    _closeColorPicker() {
        this.colorPickerTarget = null;
        this.colorPickerPanel.visible = false;
        this.colorPickerOutside.visible = false;
    }

    destroy(options) {
        window.removeEventListener("resize", this._resizeHandler);
        window.removeEventListener("keydown", this._onKeyDown);
        this.removeMoneyListener();
        super.destroy(options);
    }

    // -----------------------------------------------------------------
    // Top‑Bar
    // -----------------------------------------------------------------
    _buildTopBar() {
        this.moneyPanel = new PIXI.Container();
        this.addChild(this.moneyPanel);

        this.moneyPanelBg = new PIXI.Graphics();
        this.moneyPanel.addChild(this.moneyPanelBg);

        this.coinIcon = new PIXI.Graphics();
        this.moneyPanel.addChild(this.coinIcon);

        this.moneyText = pixelText("$ 0", 16, COLORS.gold);
        this.moneyPanel.addChild(this.moneyText);
        this.moneyText.text = `$ ${GAMESTATE.money.toLocaleString()}`;
        this.removeMoneyListener = GAMESTATE.onChange((cat, state) => {
            if (cat == "money") this.moneyText.text = `$ ${state.money.toLocaleString()}`;
        });

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
            this.callbacks.onExit && this.callbacks.onExit(this.carConfigState);
        });
    }

    _drawExitButton(hover) {
        const size = this._exitSize;
        drawBox(this.exitButtonBg, size, size, hover ? COLORS.exitRedHover : COLORS.exitRed, COLORS.panelBorder, Math.max(2, size * 0.06));
        this.exitButtonText.position.set(size / 2, size / 2);
    }

    // -----------------------------------------------------------------
    // Stellt sicher, dass alle required Sockets der Base gefüllt sind
    // -----------------------------------------------------------------
    _ensureRequiredSockets(baseAsset) {
        if (!baseAsset || !baseAsset.requiredSocketTypes) return;
        for (const type of baseAsset.requiredSocketTypes) {
            const current = this.carConfigState.getPartForType(type, baseAsset);
            if (!current) {
                // Nimm das erste verfügbare Asset dieses Typs
                const available = this.assetManager.getAllAssetsOfType(type);
                if (available.length > 0) {
                    this.carConfigState.setPartsForType(type, available[0].pieceName, baseAsset);
                } else {
                    console.warn(`No Asset required Socket-Typ "${type}" available.`);
                }
            }
        }
    }

    // -----------------------------------------------------------------
    // Untere Reihe – BASE + Socket‑Typen (Kategorien, ohne Auswahl)
    // -----------------------------------------------------------------
    _updateBottomRow() {
        const baseName = this.carConfigState.data.base;
        const baseAsset = this.assetManager.getAssetByName(baseName);
        this.currentBaseAsset = baseAsset;

        // Required Sockets automatisch füllen (falls noch nicht geschehen)
        if (baseAsset) {
            this._ensureRequiredSockets(baseAsset);
        }

        const items = [];

        // 1) BASE‑Box (Kategorie)
        const baseBox = createCategoryBox(this._boxSize, "BASE", () => this._onBottomItemClick("base"));
        items.push(baseBox);

        // 2) Socket‑Typen der Base
        if (baseAsset && baseAsset.sockets) {
            const types = [...new Set(baseAsset.sockets.map(s => s.type))];
            for (const type of types) {
                const label = type.toUpperCase(); // nur der Typ, ohne Klammer
                const box = createCategoryBox(this._boxSize, label, () => this._onBottomItemClick(type));
                box._type = type;
                box._isRequired = baseAsset.requiredSocketTypes?.includes(type) || false;
                items.push(box);
            }
        }

        this.bottomScroller.setItems(items, this._gap, this._boxSize);

        // Wenn eine Options-Reihe offen ist, prüfen ob der Typ noch existiert
        if (this.selectedType && this.selectedType !== "base") {
            const stillExists = baseAsset && baseAsset.sockets.some(s => s.type === this.selectedType);
            if (!stillExists) {
                this._closeOptions();
            } else {
                // aktualisiere die Options-Reihe (weil sich die Auswahl geändert haben könnte)
                this._updateOptionsRow(this.selectedType);
            }
        } else if (this.selectedType === "base") {
            // Base existiert immer, also Options-Reihe aktualisieren
            this._updateOptionsRow("base");
        }
    }

    _closeOptions() {
        this.selectedType = null;
        this.optionsContainer.visible = false;
        this.layout();
    }

    // -----------------------------------------------------------------
    // Options‑Reihe für einen bestimmten Typ füllen
    // -----------------------------------------------------------------
    _updateOptionsRow(type) {
        const isBase = type === "base";
        const baseAsset = this.currentBaseAsset;

        let availableAssets = [];
        let currentPieceName = null;
        let isRequired = false;

        if (isBase) {
            // Optionen für Base: alle Assets vom Typ "base"
            availableAssets = this.assetManager.getAllAssetsOfType("base");
            currentPieceName = this.carConfigState.data.base;
            isRequired = true; // Base immer Pflicht
        } else {
            // Optionen für Socket‑Typ
            availableAssets = this.assetManager.getAllAssetsOfType(type);
            currentPieceName = this.carConfigState.getPartForType(type, baseAsset);
            isRequired = baseAsset?.requiredSocketTypes?.includes(type) || false;
        }

        const items = [];

        // "NONE" nur bei nicht‑required und nicht‑Base
        if (!isRequired && !isBase) {
            const noneBox = createSelectableBox(this._boxSize, "NONE", () => this._onOptionClick(type, null));
            noneBox.setSelected(currentPieceName === null);
            items.push(noneBox);
        }

        for (const asset of availableAssets) {
            const box = createSelectableBox(this._boxSize, asset.pieceName, () => this._onOptionClick(type, asset));
            box.setSelected(asset.pieceName === currentPieceName);
            items.push(box);
        }

        this.optionsScroller.setItems(items, this._gap, this._boxSize);
    }

    // -----------------------------------------------------------------
    // Klick auf eine Option
    // -----------------------------------------------------------------
    _onOptionClick(type, asset) {
        const isBase = type === "base";
        const baseAsset = this.currentBaseAsset;

        if (isBase) {
            // Base wechseln
            if (!asset) return; // sollte nicht vorkommen
            const newBaseName = asset.pieceName;
            const oldBaseName = this.carConfigState.data.base;
            if (newBaseName === oldBaseName) {
                // Gleiche Base – nichts tun
                return;
            }

            // Alte Base rekursiv leeren
            const oldBase = this.assetManager.getAssetByName(oldBaseName);
            if (oldBase) this._clearAssetSubtree(oldBase);

            // Neue Base setzen
            this.carConfigState.setBase(newBaseName);

            // Required Sockets der neuen Base automatisch füllen
            const newBase = this.assetManager.getAssetByName(newBaseName);
            if (newBase) {
                this._ensureRequiredSockets(newBase);
            }

            this.carConfigState.applyTo(this.car);

            // Untere Reihe neu aufbauen (weil sich die Socket‑Liste geändert hat)
            this._updateBottomRow();
            this.selectedType = "base";
            this._updateOptionsRow("base");
            this.layout();
            return;
        }

        // Socket‑Teil setzen (oder entfernen bei "NONE")
        const pieceName = asset ? asset.pieceName : null;
        this.carConfigState.setPartsForType(type, pieceName, baseAsset);
        this.car.replacePart(type, pieceName);

        this._updateOptionsRow(type);
        this.layout();
    }

    // -----------------------------------------------------------------
    // Hilfsfunktion: rekursiv alle Sockets eines Assets leeren
    // (wird beim Base‑Wechsel verwendet)
    // -----------------------------------------------------------------
    _clearAssetSubtree(asset) {
        if (!asset.sockets) return;
        const types = [...new Set(asset.sockets.map(s => s.type))];
        for (const type of types) {
            const childName = this.carConfigState.getPartForType(type, asset);
            if (childName) {
                const child = this.assetManager.getAssetByName(childName);
                if (child) this._clearAssetSubtree(child);
            }
            this.carConfigState.setPartsForType(type, null, asset);
        }
    }

    // -----------------------------------------------------------------
    // Layout – positioniert die Reihen und passt Größen an
    // -----------------------------------------------------------------
    layout() {
        const w = this.app.renderer.width;
        const h = this.app.renderer.height;
        const margin = w * 0.02;
        const rowHeight = h * 0.16;
        const boxSize = rowHeight * 0.72;
        this._gap = w * 0.015;
        this._boxSize = boxSize;

        // ---- Top‑Bar ----
        const moneyPanelW = w * 0.18;
        const moneyPanelH = h * 0.06;
        drawBox(this.moneyPanelBg, moneyPanelW, moneyPanelH, COLORS.panelBg, COLORS.panelBorder, Math.max(2, h * 0.004));
        this.moneyPanel.position.set(margin, margin);

        const coinSize = moneyPanelH * 0.5;
        this.coinIcon.clear();
        this.coinIcon
            .circle(coinSize * 0.7, moneyPanelH * 0.5, coinSize * 0.5)
            .fill(COLORS.gold)
            .stroke({ width: Math.max(1, coinSize * 0.12), color: COLORS.goldDark });

        this.moneyText.style.fontSize = moneyPanelH * 0.32;
        this.moneyText.position.set(coinSize * 1.6, moneyPanelH * 0.5 - this.moneyText.height * 0.5);

        this._exitSize = h * 0.06;
        this._drawExitButton(false);
        this.exitButton.position.set(w - margin - this._exitSize, margin);

        // ---- Mode-Buttons (links) ----
        this._modeBtnSize = h * 0.07;
        this._refreshModeButtonHighlight();
        this.wrenchButton._sprite.width = this._modeBtnSize * 0.6;
        this.wrenchButton._sprite.height = this._modeBtnSize * 0.6;
        this.wrenchButton._sprite.position.set(this._modeBtnSize / 2, this._modeBtnSize / 2);
        this.colorButton._sprite.width = this._modeBtnSize * 0.6;
        this.colorButton._sprite.height = this._modeBtnSize * 0.6;
        this.colorButton._sprite.position.set(this._modeBtnSize / 2, this._modeBtnSize / 2);

        this.wrenchButton.position.set(margin, h * 0.5 - this._modeBtnSize - margin * 0.5);
        this.colorButton.position.set(margin, h * 0.5 + margin * 0.5);

        // ---- Untere Reihe ----
        const bottomY = h - rowHeight - margin;
        drawBox(this.bottomBg, w - margin * 2, rowHeight, COLORS.panelBg, COLORS.panelBorder, Math.max(2, h * 0.004));
        this.bottomContainer.position.set(margin, bottomY);
        this.bottomScroller.setSize(w - margin * 2 - this._gap * 2, boxSize);
        this.bottomScroller.position.set(this._gap, (rowHeight - boxSize) / 2);

        // ---- Options-/Mesh-Reihe ----
        const optY = bottomY - rowHeight - margin * 0.5;
        if (this.selectedType !== null) {
            drawBox(this.optionsBg, w - margin * 2, rowHeight, COLORS.panelBg, COLORS.panelBorder, Math.max(2, h * 0.004));
            this.optionsContainer.position.set(margin, optY);
            this.optionsContainer.visible = true;
            this.optionsScroller.setSize(w - margin * 2 - this._gap * 2, boxSize);
            this.optionsScroller.position.set(this._gap, (rowHeight - boxSize) / 2);
        } else {
            this.optionsContainer.visible = false;
        }

        // ---- Color-Picker-Panel (über der Mesh-Reihe) ----
        if (this.colorPickerPanel.visible) {
            const panelSize = boxSize * 3;
            const panelW = panelSize + margin;
            const panelH = panelSize + margin;
            drawBox(this.colorPickerBg, panelW, panelH, COLORS.panelBg, COLORS.panelBorder, Math.max(2, h * 0.004));
            this.colorPickerPanel.position.set(margin, optY - panelH - margin * 0.5);
            this.colorPicker.position.set(margin * 0.5, margin * 0.5);
        }
    }
}