import * as PIXI from "pixi.js";
import { GAMESTATE } from "../GameState";



const COLORS = {
    panelBg: 0x2b2b2b,
    panelBorder: 0x111111,
    panelBorderLight: 0x555555,
    gold: 0xf4c542,
    goldDark: 0xa9791b,
    boxBg: 0x3a3a3a,
    boxBgHover: 0x4a4a4a,
    boxBgSelected: 0x5a5a3a,
    boxBorder: 0x111111,
    textLight: 0xffffff,
    textDim: 0xaaaaaa,
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
// Generischer horizontaler Scroller (unverändert)
// ---------------------------------------------------------------------------
class HorizontalScroller extends PIXI.Container {
    constructor(width, height) {
        super();

        this.content = new PIXI.Container();
        this.addChild(this.content);

        this.maskGfx = new PIXI.Graphics();
        this.addChild(this.maskGfx);
        this.content.mask = this.maskGfx;

        this.eventMode = "static";
        this.cursor = "grab";

        this._dragging = false;
        this._dragStartX = 0;
        this._contentStartX = 0;
        this._contentWidth = 0;

        this.on("pointerdown", this._onDragStart, this);
        this.on("globalpointermove", this._onDragMove, this);
        this.on("pointerup", this._onDragEnd, this);
        this.on("pointerupoutside", this._onDragEnd, this);

        this.setSize(width, height);
    }

    setSize(width, height) {
        this.viewWidth = width;
        this.viewHeight = height;

        this.maskGfx.clear();
        this.maskGfx.rect(0, 0, width, height).fill(0xffffff);

        this._clampContentX();
    }

    setItems(items, gap) {
        this.content.removeChildren();
        this.content.x = 0;

        let x = 0;
        for (const item of items) {
            item.x = x;
            item.y = 0;
            this.content.addChild(item);
            x += item.width + gap;
        }
        this._contentWidth = Math.max(0, x - gap);
    }

    _onDragStart(e) {
        this._dragging = true;
        this._dragStartX = e.global.x;
        this._contentStartX = this.content.x;
        this.cursor = "grabbing";
    }

    _onDragMove(e) {
        if (!this._dragging) return;
        const dx = e.global.x - this._dragStartX;
        this.content.x = this._contentStartX + dx;
        this._clampContentX();
    }

    _onDragEnd() {
        this._dragging = false;
        this.cursor = "grab";
    }

    _clampContentX() {
        const overflow = Math.max(0, this._contentWidth - this.viewWidth);
        this.content.x = Math.min(0, Math.max(-overflow, this.content.x));
    }
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

// ---------------------------------------------------------------------------
// GarageOverlay – vereinfacht:
// - Oben: Geld + Exit
// - Unten: eine Reihe mit BASE + allen Socket‑Typen der Base (Kategorien)
// - Bei Klick auf eine Kategorie öffnet sich darüber eine Options-Reihe
// - Base hat requiredSocketTypes → Pflichtfelder (kein "NONE")
// - Andere Sockets optional ("NONE" vorhanden)
// - Bei Base‑Wechsel werden alle required Sockets automatisch mit dem ersten verfügbaren Teil gefüllt
// - Die untere Reihe zeigt keine Auswahl an (kein Highlight, keine Klammern)
// ---------------------------------------------------------------------------
export class GarageOverlay extends PIXI.Container {

    constructor(app, assetManager, carConfigState, callbacks = {}) {
        super();

        this.app = app;
        this.assetManager = assetManager;
        this.carConfigState = carConfigState;
        this.callbacks = callbacks;

        this.selectedType = null;          // aktuell geöffneter Kategorien‑Typ (oder null)
        this.currentBaseAsset = null;      // Base‑Objekt für schnellen Zugriff

        this.eventMode = "static";

        // Top‑Bar
        this._buildTopBar();

        // Zwei Reihen: untere (Kategorien) und obere (Optionen)
        const rowHeight = this.app.renderer.height * 0.16;
        const boxSize = rowHeight * 0.72;
        this._gap = 0;
        this._boxSize = boxSize;

        // Container für die untere Reihe (immer sichtbar)
        this.bottomContainer = new PIXI.Container();
        this.addChild(this.bottomContainer);
        this.bottomBg = new PIXI.Graphics();
        this.bottomContainer.addChild(this.bottomBg);
        this.bottomScroller = new HorizontalScroller(100, boxSize);
        this.bottomContainer.addChild(this.bottomScroller);

        // Container für die Options-Reihe (anfangs unsichtbar)
        this.optionsContainer = new PIXI.Container();
        this.optionsContainer.visible = false;
        this.addChild(this.optionsContainer);
        this.optionsBg = new PIXI.Graphics();
        this.optionsContainer.addChild(this.optionsBg);
        this.optionsScroller = new HorizontalScroller(100, boxSize);
        this.optionsContainer.addChild(this.optionsScroller);

        // Initial befüllen und required Sockets sicherstellen
        this._updateBottomRow();

        // Resize‑Handler
        this._resizeHandler = () => this.layout();
        window.addEventListener("resize", this._resizeHandler);

        this.layout();
    }

    destroy(options) {
        window.removeEventListener("resize", this._resizeHandler);
        this.removeMoneyListener();
        super.destroy(options);
    }

    // -----------------------------------------------------------------
    // Top‑Bar (unverändert)
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
            this.callbacks.onExit && this.callbacks.onExit();
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
                    console.warn(`Kein Asset für required Socket-Typ "${type}" verfügbar.`);
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

        this.bottomScroller.setItems(items, this._gap);

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

    // -----------------------------------------------------------------
    // Klick auf eine Kategorie der unteren Reihe
    // -----------------------------------------------------------------
    _onBottomItemClick(type) {
        if (this.selectedType === type) {
            // Gleiche Kategorie → schließen
            this._closeOptions();
            return;
        }

        // Andere Kategorie → alte schließen, neue öffnen
        this.selectedType = type;
        this._updateOptionsRow(type);
        this.optionsContainer.visible = true;
        this.layout();
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

        this.optionsScroller.setItems(items, this._gap);
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

            // Untere Reihe neu aufbauen (weil sich die Socket‑Liste geändert hat)
            this._updateBottomRow();
            // Options‑Reihe schließen
            this._closeOptions();
            this._notifyChange();
            this.layout();
            return;
        }

        // Socket‑Teil setzen (oder entfernen bei "NONE")
        const pieceName = asset ? asset.pieceName : null;
        this.carConfigState.setPartsForType(type, pieceName, baseAsset);

        // Untere Reihe aktualisieren (nur um die required‑Füllung zu prüfen – hier nicht nötig)
        // Aber wir müssen die Options-Reihe aktualisieren, um die Markierungen zu ändern
        this._updateOptionsRow(type);
        // Offen lassen
        this._notifyChange();
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

    _notifyChange() {
        this.callbacks.onChange && this.callbacks.onChange(this.carConfigState);
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

        // ---- Untere Reihe (immer sichtbar) ----
        const bottomY = h - rowHeight - margin;
        drawBox(this.bottomBg, w - margin * 2, rowHeight, COLORS.panelBg, COLORS.panelBorder, Math.max(2, h * 0.004));
        this.bottomContainer.position.set(margin, bottomY);
        this.bottomScroller.setSize(w - margin * 2 - this._gap * 2, boxSize);
        this.bottomScroller.position.set(this._gap, (rowHeight - boxSize) / 2);

        // ---- Options‑Reihe (nur sichtbar wenn selectedType != null) ----
        if (this.selectedType !== null) {
            const optY = bottomY - rowHeight - margin * 0.5;
            drawBox(this.optionsBg, w - margin * 2, rowHeight, COLORS.panelBg, COLORS.panelBorder, Math.max(2, h * 0.004));
            this.optionsContainer.position.set(margin, optY);
            this.optionsContainer.visible = true;
            this.optionsScroller.setSize(w - margin * 2 - this._gap * 2, boxSize);
            this.optionsScroller.position.set(this._gap, (rowHeight - boxSize) / 2);
        } else {
            this.optionsContainer.visible = false;
        }
    }
}