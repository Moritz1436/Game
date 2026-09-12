import * as PIXI from "pixi.js";
import { GAMESTATE } from "../GameState";
import { HorizontalScroller } from "./HorizonalScroller.js";
import { HSVColorPicker } from "./HSVColorPicker.js";
import { rgbToHex, rgbToHsv, hsvToRgb } from "./HSVColorPicker.js";
import { COLOR_CHANGE_COST} from "../GlobalAssets.js";
import { NotifScreen } from "../NotifScreen.js";
import { SceneStack } from "../Utils/SceneStack.js";
import { COLORS } from "../Colors.js";
import { pixelText, drawBox } from "../Utils/UI.js";

function formatPropValue(v) {
    return Number.isInteger(v) ? v.toString() : v.toFixed(1);
}

function formatSliderValue(v) {
    return Number.isInteger(v) ? v.toString() : v.toFixed(2);
}

const MODIFIER_CHANGE_COST = 500;

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
        this.isPointerOverOverlay = false;
        this.on("pointerover", () => {
            this.isPointerOverOverlay = true;
        });

        this.on("pointerout", () => {
            this.isPointerOverOverlay = false;
        });

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
        const upgradesTexture = PIXI.Sprite.from("assets/upgrades.png");
        const modifiersTexture = PIXI.Sprite.from("assets/modifiers.png");

        this.wrenchButton = this._createModeButton(wrenchTexture, () => this._setMode("parts"));
        this.colorButton = this._createModeButton(colorPickerTexture, () => this._setMode("color"));
        this.upgradesButton = this._createModeButton(upgradesTexture, () => this._setMode("upgrades"));
        this.modifiersButton = this._createModeButton(modifiersTexture, () => this._setMode("modifiers"));

        this.modeButtonsContainer.addChild(this.wrenchButton);
        this.modeButtonsContainer.addChild(this.colorButton);
        this.modeButtonsContainer.addChild(this.upgradesButton);
        this.modeButtonsContainer.addChild(this.modifiersButton);

        this._refreshModeButtonHighlight();
    }

    _refreshModeButtonHighlight() {
        const size = this._modeBtnSize ?? 40;
        for (const [btn, active] of [
            [this.wrenchButton, this.mode === "parts"],
            [this.colorButton, this.mode === "color"],
            [this.upgradesButton, this.mode === "upgrades"],
            [this.modifiersButton, this.mode === "modifiers"],
        ]) {
            drawBox(btn._bg, size, size, active ? COLORS.boxBgSelected : COLORS.boxBg, COLORS.boxBorder, Math.max(2, size * 0.06));
        }
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
        this._updateBottomRow();
        this.layout();
    }

    // -----------------------------------------------------------------
    // Klick auf Kategorie: verzweigt je nach Modus
    // -----------------------------------------------------------------
    _onBottomItemClick(type) {
        if (this.mode === "color") {
            this._onColorCategoryClick(type);
            return;
        }
        if (this.mode === "modifiers") {
            this._onModifierCategoryClick(type);
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

    _updateModifiersOptionsRow(type) {
        const modifierDef = this.car.rootPiece.modifiers?.[type];
        const items = [];

        if (modifierDef) {
            for (const group of ["pos", "rot"]) {
                const axesRanges = modifierDef[group] ?? {};
                for (const axis of ["x", "y", "z"]) {
                    const range = axesRanges[axis];
                    if (!range) continue;

                    const label = `${group.toUpperCase()} ${axis.toUpperCase()}`;
                    const currentValue = this._pendingModifierValues[group]?.[axis] ?? 0;

                    const box = this._createModifierSliderBox(this._boxSize, label, range.min, range.max, currentValue, (value) => {
                        this._pendingModifierValues[group] ??= {};
                        this._pendingModifierValues[group][axis] = value;

                        for (const piece of this.car.getPiecesByType(type)) {
                            piece.setModifierValue(group, axis, value);
                        }
                    });
                    items.push(box);
                }
            }
        }

        this.optionsScroller.setItems(items, this._gap, this._boxSize);
    }

    _createModifierSliderBox(size, label, min, max, value, onChange) {
        const c = new PIXI.Container();
        c.width = size;
        c.height = size;

        const bg = new PIXI.Graphics();
        c.addChild(bg);
        drawBox(bg, size, size, COLORS.boxBg, COLORS.boxBorder, Math.max(2, size * 0.03));

        const txt = pixelText(label, size * 0.14, COLORS.textLight);
        txt.anchor.set(0.5, 0);
        txt.position.set(size / 2, size * 0.08);
        c.addChild(txt);

        const valueText = pixelText(formatSliderValue(value), size * 0.16, COLORS.gold);
        valueText.anchor.set(0.5, 0);
        valueText.position.set(size / 2, size * 0.26);
        c.addChild(valueText);

        const trackY = size * 0.62;
        const trackW = size * 0.76;
        const trackX0 = (size - trackW) / 2;

        const track = new PIXI.Graphics();
        track.rect(trackX0, trackY - 2, trackW, 4).fill(COLORS.boxBorder);
        c.addChild(track);

        const handleR = size * 0.09;
        const handleHitR = handleR * 1.6;
        const handle = new PIXI.Graphics();
        handle.circle(0, 0, handleR).fill(COLORS.gold).stroke({ width: 1, color: COLORS.panelBorder });
        handle.eventMode = "static";
        handle.cursor = "pointer";
        handle.hitArea = new PIXI.Circle(0, 0, handleHitR);
        c.addChild(handle);

        const valueToX = (v) => trackX0 + ((v - min) / (max - min || 1)) * trackW;
        const xToValue = (x) => min + Math.min(1, Math.max(0, (x - trackX0) / trackW)) * (max - min);

        handle.position.set(valueToX(value), trackY);

        let dragging = false;

        handle.on("pointerdown", (e) => {
            e.stopPropagation(); // verhindert, dass der Scroller den Drag als Pan interpretiert
            dragging = true;
        });

        handle.on("globalpointermove", (e) => {
            if (!dragging) return;
            const local = c.toLocal(e.global);
            const newValue = xToValue(local.x);
            handle.position.set(valueToX(newValue), trackY);
            valueText.text = formatSliderValue(newValue);
            onChange && onChange(newValue);
        });

        const endDrag = () => { dragging = false; };
        handle.on("pointerup", endDrag);
        handle.on("pointerupoutside", endDrag);

        return c;
    }

    _closeOptions() {
        this.selectedType = null;
        this.optionsContainer.visible = false;
        this._closeColorPicker();
        this._closeModifierOptions();
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
        const meshDef = this.assetManager.getAssetByName(
            type === "base" ? this.carConfigState.data.base : this.carConfigState.getPartForType(type, baseAsset)
        )?.meshes.find(m => m.name === meshName);

        const savedMaterial = this.carConfigState.getMeshMaterial(type, meshName);
        const startMetallic = savedMaterial?.metallic ?? meshDef?.metallic ?? 1.0;
        const startRoughness = savedMaterial?.roughness ?? meshDef?.roughness ?? 1.0;

        this.colorPickerTarget = {
            type, meshName, baseAsset, boxRef,
            originalHex: currentHex, previewHex: currentHex,
            originalMetallic: startMetallic, previewMetallic: startMetallic,
            originalRoughness: startRoughness, previewRoughness: startRoughness,
        };

        if (!this.colorPicker) {
            this.colorPicker = new HSVColorPicker(
                this._boxSize * 3,
                (hex) => {
                    const t = this.colorPickerTarget;
                    if (!t) return;
                    t.previewHex = hex;
                    const pieces = t.type === "base" ? [this.car.rootPiece] : this.car.getPiecesByType(t.type);
                    for (const piece of pieces) {
                        piece.setMeshBaseColor(t.meshName, hex);
                    }
                    t.boxRef._updateSwatch(hex);
                },
                (metallic, roughness) => {
                    console.log("Material changed:", metallic, roughness);
                    const t = this.colorPickerTarget;
                    if (!t) return;
                    t.previewMetallic = metallic;
                    t.previewRoughness = roughness;
                    const pieces = t.type === "base" ? [this.car.rootPiece] : this.car.getPiecesByType(t.type);
                    for (const piece of pieces) {
                        piece.setMeshMetallic(t.meshName, metallic);
                        piece.setMeshRoughness(t.meshName, roughness);
                    }
                }
            );
            this.colorPickerPanel.addChild(this.colorPicker);
        }

        const savedHex = this.carConfigState.getMeshColor(type, meshName) ?? currentHex;
        this.colorPicker.setColorHex(savedHex);
        this.colorPicker.setMetallicRoughness(startMetallic, startRoughness); // NEU

        this.colorPickerOutside.visible = true;
        this.colorPickerOutside.clear();
        this.colorPickerOutside
            .rect(0, 0, this.app.renderer.width, this.app.renderer.height)
            .fill({ color: 0x000000, alpha: 0.001 });

        this.colorPickerOutside.off("pointerdown");
        this.colorPickerOutside.on("pointerdown", () => this._closeColorPicker());

        this.colorPickerPanel.visible = true;
        this.layout();
    }

    _closeColorPicker() {
        const t = this.colorPickerTarget;

        if (t) {
            const colorChanged = t.previewHex !== t.originalHex;
            const materialChanged = t.previewMetallic !== t.originalMetallic || t.previewRoughness !== t.originalRoughness;

            if (colorChanged || materialChanged) {
                GAMESTATE.spendMoney(COLOR_CHANGE_COST, false, this.app, (success) => {
                    const pieces = t.type === "base" ? [this.car.rootPiece] : this.car.getPiecesByType(t.type);

                    if (success) {
                        if (colorChanged) {
                            this.carConfigState.setMeshColor(t.type, t.meshName, t.previewHex);
                            t.boxRef._updateSwatch(t.previewHex);
                        }
                        if (materialChanged) {
                            this.carConfigState.setMeshMaterial(t.type, t.meshName, {
                                metallic: t.previewMetallic,
                                roughness: t.previewRoughness,
                            });
                        }
                    } else {
                        // Kauf fehlgeschlagen -> ALLES zuruecksetzen (Farbe UND Material)
                        for (const piece of pieces) {
                            piece.setMeshBaseColor(t.meshName, t.originalHex);
                            piece.setMeshMetallic(t.meshName, t.originalMetallic);
                            piece.setMeshRoughness(t.meshName, t.originalRoughness);
                        }
                        t.boxRef._updateSwatch(t.originalHex);
                        this._createNoMoneyScreen();
                    }
                });
            }
        }

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
            this._closeOptions();
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
        if (this.mode === "upgrades") {
            this._updateUpgradesRow();
            return;
        }
        if (this.mode === "modifiers") {
            this._updateModifiersBottomRow();
            return;
        }

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

    _updateModifiersBottomRow() {
        const baseName = this.carConfigState.data.base;
        const baseAsset = this.assetManager.getAssetByName(baseName);
        this.currentBaseAsset = baseAsset;

        const items = [];

        if (baseAsset && baseAsset.sockets) {
            const equippedTypes = new Set();
            for (const socket of baseAsset.sockets) {
                if (this.carConfigState.data.parts[socket.name]) equippedTypes.add(socket.type);
            }

            for (const type of equippedTypes) {
                if (!this.car.rootPiece.modifiers?.[type]) continue; // kein Modifier definiert -> nicht anzeigen

                const box = createCategoryBox(this._boxSize, type.toUpperCase(), () => this._onBottomItemClick(type));
                box._type = type;
                items.push(box);
            }
        }

        this.bottomScroller.setItems(items, this._gap, this._boxSize);

        if (this.selectedType) {
            const stillEquipped = items.some(i => i._type === this.selectedType);
            if (!stillEquipped) {
                this._closeOptions();
            } else {
                this._updateModifiersOptionsRow(this.selectedType);
            }
        }
    }

    _updateUpgradesRow() {
        this.selectedType = null;
        this.optionsContainer.visible = false;

        const items = [];
        for (const [key, prop] of Object.entries(this.car.properties)) {
            const box = this._createUpgradeBox(this._boxSize, key, prop, () => {
                const cost = prop.cost ?? 0;
                GAMESTATE.spendMoney(cost, false, this.app, (success) => {
                    if (!success){
                        this._createNoMoneyScreen();
                        return;
                    }
                    if (this.car.upgradeProperty(key)) {
                        this.carConfigState.data.properties = this.car.properties;
                        this._updateUpgradesRow();
                        this.layout();
                    }
                });
            });
            items.push(box);
        }

        this.bottomScroller.setItems(items, this._gap, this._boxSize);
    }

    _createUpgradeBox(size, key, prop, onClick) {
        const c = new PIXI.Container();
        c.eventMode = "static";
        c.width = size;
        c.height = size;

        const bg = new PIXI.Graphics();
        c.addChild(bg);

        const label = pixelText(key.replace(/_/g, " ").toUpperCase(), size * 0.13, COLORS.textLight);
        label.anchor.set(0.5, 0);
        label.position.set(size / 2, size * 0.08);
        label.style.wordWrap = true;
        label.style.wordWrapWidth = size * 0.9;
        label.style.align = "center";
        c.addChild(label);

        const isMaxed = prop.level >= prop.maxLevel;
        const cost = prop.cost ?? 0;
        const canAfford = isMaxed || GAMESTATE.money >= cost;

        const nextValue = this.car.getPropertyNextValue(key);

        const currentText = pixelText(formatPropValue(prop.value), size * 0.18, 0xd04040); // red
        currentText.anchor.set(1, 0.5);
        c.addChild(currentText);

        let arrowText = null;
        let nextText = null;
        let maxValueText = null;

        if (!isMaxed) {
            arrowText = pixelText("\u2192", size * 0.16, COLORS.textDim);
            arrowText.anchor.set(0.5, 0.5);
            c.addChild(arrowText);

            nextText = pixelText(formatPropValue(nextValue), size * 0.18, 0x4caf50); // green
            nextText.anchor.set(0, 0.5);
            c.addChild(nextText);
        } else {
            nextText = pixelText("MAX", size * 0.15, COLORS.gold);
            nextText.anchor.set(0.5, 0.5);
            c.addChild(nextText);

            maxValueText = pixelText(formatPropValue(prop.value), size * 0.14, COLORS.gold);
            maxValueText.anchor.set(0.5, 0);
            c.addChild(maxValueText);
        }

        const valueY = size * 0.55;
        if (!isMaxed) {
            currentText.position.set(size * 0.42, valueY);
            arrowText.position.set(size * 0.5, valueY);
            nextText.position.set(size * 0.58, valueY);
        } else {
            currentText.visible = false;
            nextText.position.set(size / 2, valueY);
            maxValueText.position.set(size / 2, valueY + nextText.height * 0.5 + size * 0.01);
        }

        const levelText = pixelText(`Lv. ${prop.level}/${prop.maxLevel}`, size * 0.14, COLORS.textDim);
        levelText.anchor.set(0.5, 1);
        levelText.position.set(size / 2, size * 0.92);
        c.addChild(levelText);

        if (!isMaxed) {
            const priceColor = canAfford ? COLORS.gold : 0xd04040;
            const priceText = pixelText(`$${cost}`, size * 0.12, priceColor);
            priceText.anchor.set(0.5, 1);
            priceText.position.set(size / 2, size * 0.82);
            c.addChild(priceText);
        }

        const isLocked = isMaxed || !canAfford;

        function redraw() {
            drawBox(bg, size, size, isLocked ? COLORS.boxBg : COLORS.boxBgSelected, COLORS.boxBorder, Math.max(2, size * 0.03));
        }
        redraw();

        if (!isLocked) {
            c.cursor = "pointer";
            c.on("pointerover", () => drawBox(bg, size, size, COLORS.boxBgHover, COLORS.boxBorder, Math.max(2, size * 0.03)));
            c.on("pointerout", redraw);
            c.on("pointerdown", () => onClick && onClick());
        } else {
            c.cursor = "default";
            if (!isMaxed) {
                c.on("pointerdown", () => onClick && onClick());
            }
        }

        return c;
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
            const unlocked = GAMESTATE.isPartUnlocked(asset.pieceName);
            const box = unlocked
                ? createSelectableBox(this._boxSize, asset.pieceName, () => this._onOptionClick(type, asset))
                : this._createLockedPartBox(this._boxSize, asset, () => this._onLockedPartClick(type, asset));
            if (unlocked) box.setSelected(asset.pieceName === currentPieceName);
            items.push(box);
        }

        this.optionsScroller.setItems(items, this._gap, this._boxSize);
    }

    _onModifierCategoryClick(type) {
        if (this.selectedType === type && this.optionsContainer.visible) {
            this._closeOptions();
            return;
        }
        this._closeModifierOptions();
        this.selectedType = type;
        this._openModifierOptions(type);
        this.optionsContainer.visible = true;
        this._closeColorPicker();
        this.layout();
    }

    _openModifierOptions(type) {
        const original = structuredClone(this.carConfigState.getModifierValues(type) ?? { pos: {}, rot: {} });
        this._modifierEditTarget = { type, original };
        this._pendingModifierValues = structuredClone(original);
        this._updateModifiersOptionsRow(type);
    }

    _countChangedModifiers(pending, original) {
        let count = 0;
        for (const group of ["pos", "rot"]) {
            const pendingAxes = pending?.[group] ?? {};
            const originalAxes = original?.[group] ?? {};
            const axes = new Set([...Object.keys(pendingAxes), ...Object.keys(originalAxes)]);
            for (const axis of axes) {
                const pv = pendingAxes[axis] ?? 0;
                const ov = originalAxes[axis] ?? 0;
                if (pv !== ov) count++;
            }
        }
        return count;
    }

    _closeModifierOptions() {
        const target = this._modifierEditTarget;
        if (!target) return;

        const pending = this._pendingModifierValues;
        const changedCount = this._countChangedModifiers(pending, target.original);

        if (changedCount > 0) {
            const totalCost = changedCount * MODIFIER_CHANGE_COST;
            GAMESTATE.spendMoney(totalCost, false, this.app, (success) => {
                const pieces = this.car.getPiecesByType(target.type);
                if (success) {
                    this.carConfigState.setModifierValues(target.type, pending);
                } else {
                    for (const piece of pieces) piece.importModifierValues(target.original);
                    this._createNoMoneyScreen();
                }
            });
        }

        this._modifierEditTarget = null;
        this._pendingModifierValues = null;
    }

    _createNoMoneyScreen() {
        const scene = new NotifScreen(this.app, "WARNING!\nYou don't have enough money to buy this.", "OK", () => {
            SceneStack.popScene();
        });
        SceneStack.pushScene(scene, false);
    }

    _createLockedPartBox(size, asset, onClick) {
        const c = new PIXI.Container();
        c.eventMode = "static";
        c.cursor = "pointer";
        c.width = size;
        c.height = size;

        const bg = new PIXI.Graphics();
        c.addChild(bg);

        const lockIcon = pixelText("\u{1F512}", size * 0.22, COLORS.textDim);
        lockIcon.anchor.set(0.5);
        lockIcon.position.set(size / 2, size * 0.35);
        c.addChild(lockIcon);

        const txt = pixelText(asset.pieceName, size * 0.13, COLORS.textLight);
        txt.anchor.set(0.5, 0);
        txt.position.set(size / 2, size * 0.55);
        txt.style.wordWrap = true;
        txt.style.wordWrapWidth = size * 0.9;
        txt.style.align = "center";
        c.addChild(txt);

        const priceText = pixelText(`$${asset.price ?? 0}`, size * 0.14, COLORS.gold);
        priceText.anchor.set(0.5, 1);
        priceText.position.set(size / 2, size * 0.92);
        c.addChild(priceText);

        function redraw() {
            drawBox(bg, size, size, COLORS.boxBg, COLORS.boxBorder, Math.max(2, size * 0.03));
        }
        redraw();

        c.on("pointerover", () => drawBox(bg, size, size, COLORS.boxBgHover, COLORS.boxBorder, Math.max(2, size * 0.03)));
        c.on("pointerout", redraw);
        c.on("pointerdown", () => onClick && onClick());

        return c;
    }

    _onLockedPartClick(type, asset) {
        GAMESTATE.spendMoney(asset.price ?? 0, false, this.app, (success) => {
            if (!success){
                this._createNoMoneyScreen();
                return;
            }
            GAMESTATE.unlockPart(asset.pieceName);
            this._onOptionClick(type, asset);
        });
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
        const modifierValues = this.carConfigState.getModifierValues(type);
        this.car.replacePart(type, pieceName, modifierValues);

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
        for (const btn of [this.wrenchButton, this.colorButton, this.upgradesButton, this.modifiersButton]) {
            btn._sprite.width = this._modeBtnSize * 0.6;
            btn._sprite.height = this._modeBtnSize * 0.6;
            btn._sprite.position.set(this._modeBtnSize / 2, this._modeBtnSize / 2);
        }

        const btnGap = margin * 0.5;
        const totalBtnH = this._modeBtnSize * 4 + btnGap * 3;
        const startY = h * 0.5 - totalBtnH / 2;
        this.wrenchButton.position.set(margin, startY);
        this.colorButton.position.set(margin, startY + this._modeBtnSize + btnGap);
        this.upgradesButton.position.set(margin, startY + (this._modeBtnSize + btnGap) * 2);
        this.modifiersButton.position.set(margin, startY + (this._modeBtnSize + btnGap) * 3);

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
            const panelW = boxSize * 3 + margin;
            const panelH = (this.colorPicker?._totalHeight ?? boxSize * 3) + margin;

            drawBox(this.colorPickerBg, panelW, panelH, COLORS.panelBg, COLORS.panelBorder, Math.max(2, h * 0.004));
            this.colorPickerPanel.position.set(margin, optY - panelH - margin * 0.5);
            this.colorPicker.position.set(margin * 0.5, margin * 0.5);
        }
    }
}