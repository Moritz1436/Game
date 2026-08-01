import * as PIXI from "pixi.js";



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

// Eckige Box ohne abgerundete Ecken - Rundungen wirken "modern UI",
// nicht Pixel-Art.
function drawBox(g, w, h, bg, border, borderWidth) {
    g.clear();
    g.rect(0, 0, w, h).fill(bg);
    g.rect(0, 0, w, h).stroke({ width: borderWidth, color: border });
}

// ---------------------------------------------------------------------------
// Generische horizontale Scroll-Liste - für Part-Type-Reihe UND
// Options-Reihe genutzt. Maskierter Container + Pointer-Drag-Scroll,
// geclamped gegen Überscrollen.
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

    ///@param items - Array von bereits fertig dimensionierten PIXI.Container
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
// Einzelne klickbare Box (Part-Type-Boxen UND Varianten-Boxen nutzen diese).
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
// GarageOverlay - Geld/Exit oben, Part-Type-Scroller unten, Options-Reihe
// klappt darüber auf. Layout wird komplett aus app.renderer.width/height
// berechnet - bei Resize einfach layout() erneut aufrufen.
// ---------------------------------------------------------------------------
export class GarageOverlay extends PIXI.Container {

    ///@param app - PIXI Application
    ///@param assetManager - CarPieceAssetManager (liefert Part-Types + Varianten)
    ///@param callbacks - { onExit, onPartVariantSelect(type, pieceName) }
    constructor(app, assetManager, callbacks = {}) {
        super();

        this.app = app;
        this.assetManager = assetManager;
        this.callbacks = callbacks;

        this.money = 0;
        this.openType = null;

        this.eventMode = "static"; // fängt Klicks ab, damit sie nicht in die 3D-Szene durchfallen

        this._buildTopBar();
        this._buildOptionsRow();
        this._buildTypeBar();

        this.layout();

        this._resizeHandler = () => this.layout();
        window.addEventListener("resize", this._resizeHandler);
    }

    destroy(options) {
        window.removeEventListener("resize", this._resizeHandler);
        super.destroy(options);
    }

    setMoney(value) {
        this.money = value;
        this.moneyText.text = `$ ${value.toLocaleString()}`;
    }

    // -----------------------------------------------------------------
    // Top bar: Geld (grauer Panel, oben links) + Exit-Button (oben rechts)
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
    // Bottom bar: Part-Type-Boxen (Base, Tire, Spoiler, ...)
    // -----------------------------------------------------------------
    _buildTypeBar() {
        this.typeBarBg = new PIXI.Graphics();
        this.addChild(this.typeBarBg);

        this.typeScroller = new HorizontalScroller(100, 100);
        this.addChild(this.typeScroller);
    }

    _populateTypeBar(boxSize, gap) {
        const types = Array.from(this.assetManager.assetsByType.keys());

        const items = types.map((type) => {
            const box = createSelectableBox(boxSize, type.toUpperCase(), () => this._toggleType(type, box));
            box._type = type;
            if (type === this.openType) box.setSelected(true);
            return box;
        });

        this.typeScroller.setItems(items, gap);
        this._typeBoxes = items;
    }

    _toggleType(type) {
        if (this.openType === type) {
            this._closeOptions();
            return;
        }

        this.openType = type;
        for (const b of this._typeBoxes) b.setSelected(b._type === type);

        this._openOptionsFor(type);
    }

    _closeOptions() {
        this.openType = null;
        for (const b of this._typeBoxes ?? []) b.setSelected(false);
        this.optionsRow.visible = false;
    }

    // -----------------------------------------------------------------
    // Options row: klappt über der Type-Bar auf, zeigt Varianten des
    // gerade ausgewählten Part-Types.
    // -----------------------------------------------------------------
    _buildOptionsRow() {
        this.optionsRow = new PIXI.Container();
        this.optionsRow.visible = false;
        this.addChild(this.optionsRow);

        this.optionsRowBg = new PIXI.Graphics();
        this.optionsRow.addChild(this.optionsRowBg);

        this.optionsScroller = new HorizontalScroller(100, 100);
        this.optionsRow.addChild(this.optionsScroller);
    }

    _openOptionsFor(type) {
        const assets = this.assetManager.getAllAssetsOfType(type);
        const gap = this._gap;

        const items = assets.map((asset) => {
            const box = createSelectableBox(this._optionBoxSize, asset.pieceName, () => {
                this.callbacks.onPartVariantSelect && this.callbacks.onPartVariantSelect(type, asset.pieceName);
                for (const b of items) b.setSelected(b === box);
            });
            return box;
        });

        this.optionsScroller.setItems(items, gap);
        this.optionsRow.visible = true;
    }

    // -----------------------------------------------------------------
    // Layout - komplett aus aktueller Renderer-Größe neu berechnet.
    // -----------------------------------------------------------------
    layout() {
        const w = this.app.renderer.width;
        const h = this.app.renderer.height;

        // ---- top bar ----
        const margin = w * 0.02;

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

        // ---- bottom bar (Part-Types) ----
        const barHeight = h * 0.16;
        const barY = h - barHeight - margin;

        drawBox(this.typeBarBg, w - margin * 2, barHeight, COLORS.panelBg, COLORS.panelBorder, Math.max(2, h * 0.004));
        this.typeBarBg.position.set(margin, barY);

        const boxSize = barHeight * 0.72;
        const gap = w * 0.015;
        this._gap = gap;

        this.typeScroller.setSize(w - margin * 2 - gap * 2, boxSize);
        this.typeScroller.position.set(margin + gap, barY + (barHeight - boxSize) / 2);

        this._populateTypeBar(boxSize, gap);

        // ---- options row (über der Type-Bar) ----
        const optBarHeight = h * 0.16;
        const optBarY = barY - optBarHeight - margin * 0.5;

        drawBox(this.optionsRowBg, w - margin * 2, optBarHeight, COLORS.panelBg, COLORS.panelBorderLight, Math.max(2, h * 0.004));
        this.optionsRow.position.set(margin, optBarY);

        this._optionBoxSize = optBarHeight * 0.72;
        this.optionsScroller.setSize(w - margin * 2 - gap * 2, this._optionBoxSize);
        this.optionsScroller.position.set(gap, (optBarHeight - this._optionBoxSize) / 2);

        if (this.openType) {
            this._openOptionsFor(this.openType); // an neue Größe anpassen
        }
    }
}