import * as PIXI from "pixi.js";


export function hsvToRgb(h, s, v) {
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    let r, g, b;
    if (h < 60)       [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else              [r, g, b] = [c, 0, x];
    return [
        Math.round((r + m) * 255),
        Math.round((g + m) * 255),
        Math.round((b + m) * 255),
    ];
}

export function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    if (d !== 0) {
        if (max === r) h = 60 * (((g - b) / d) % 6);
        else if (max === g) h = 60 * ((b - r) / d + 2);
        else h = 60 * ((r - g) / d + 4);
    }
    if (h < 0) h += 360;
    const s = max === 0 ? 0 : d / max;
    return [h, s, max];
}

export function rgbToHex(r, g, b) {
    return "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");
}

export function hexToRgb(hex) {
    const n = parseInt(hex.replace("#", ""), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function clamp01(v) { return Math.max(0, Math.min(1, v)); }

export class HSVColorPicker extends PIXI.Container {
    constructor(size, onChange, onMaterialChange = null) {
        super();
        this.onChange = onChange;
        this.onMaterialChange = onMaterialChange;
        
        this.hue = 0;
        this.sat = 1;
        this.val = 1;
        
        //internal 0..1, UI 0..100
        this.metallic = 0;
        this.roughness = 1;

        this.svSize = size * 0.82;
        this.hueWidth = size * 0.14;
        this.gap = size * 0.05;

        this._createRGBInputs();
        this._createMaterialSliders();

        // SV square (canvas-based, redrawn on hue change)
        this.svCanvas = document.createElement("canvas");
        this.svCanvas.width = 64;
        this.svCanvas.height = 64;
        this.svTexture = PIXI.Texture.from(this.svCanvas);
        this.svSprite = new PIXI.Sprite(this.svTexture);
        this.svSprite.width = this.svSize;
        this.svSprite.height = this.svSize;
        this.svSprite.eventMode = "static";
        this.svSprite.cursor = "crosshair";
        this.addChild(this.svSprite);

        this.svCursor = new PIXI.Graphics();
        this.addChild(this.svCursor);

        // Hue strip (static rainbow gradient)
        this.hueCanvas = document.createElement("canvas");
        this.hueCanvas.width = 16;
        this.hueCanvas.height = 256;
        this._drawHueStrip();
        this.hueTexture = PIXI.Texture.from(this.hueCanvas);
        this.hueSprite = new PIXI.Sprite(this.hueTexture);
        this.hueSprite.x = this.svSize + this.gap;
        this.hueSprite.width = this.hueWidth;
        this.hueSprite.height = this.svSize;
        this.hueSprite.eventMode = "static";
        this.hueSprite.cursor = "pointer";
        this.addChild(this.hueSprite);

        this.hueCursor = new PIXI.Graphics();
        this.addChild(this.hueCursor);

        this._redrawSV();
        this._updateCursors();
        this._updateRGBInputs();
        this._updateMaterialSliders();

        this._setupDrag(this.svSprite, (local) => {
            const x = local.x - this.svSprite.x;
            const y = local.y - this.svSprite.y;

            this.sat = clamp01(x / this.svSize);
            this.val = 1 - clamp01(y / this.svSize);

            this._updateCursors();
            this._emit();
        });

        this._setupDrag(this.hueSprite, (local) => {
            const y = local.y - this.hueSprite.y;

            this.hue = clamp01(y / this.svSize) * 359.999;

            this._redrawSV();
            this._updateCursors();
            this._emit();
        });
    }

    _createRGBInputs() {
        this.rgbFields = {};

        const fields = [
            ["r", "R"],
            ["g", "G"],
            ["b", "B"],
        ];

        // Alles relativ zur Picker-Größe
        const fieldWidth = (this.svSize + this.hueWidth) * 0.30;
        const fieldHeight = (this.svSize + this.hueWidth) * 0.075;
        const gap = (this.svSize + this.hueWidth) * 0.035;

        const totalWidth =
            fieldWidth * fields.length +
            gap * (fields.length - 1);

        const startX =
            ((this.svSize + this.gap + this.hueWidth) - totalWidth) * 0.5;

        for (let i = 0; i < fields.length; i++) {
            const [channel, label] = fields[i];

            const container = new PIXI.Container();

            container.x = startX + i * (fieldWidth + gap);
            container.y = this.svSize + this.svSize * 0.04;

            const bg = new PIXI.Graphics();

            const drawBackground = (active = false) => {
                bg.clear()
                    .roundRect(
                        0,
                        0,
                        fieldWidth,
                        fieldHeight,
                        fieldHeight * 0.18
                    )
                    .fill(active ? 0x303030 : 0x202020)
                    .stroke({
                        width: Math.max(1, this.svSize * 0.008),
                        color: active ? 0x888888 : 0x505050,
                    });
            };

            drawBackground();

            container.addChild(bg);

            const labelText = new PIXI.Text({
                text: label,
                style: {
                    fontSize: Math.max(10, fieldHeight * 0.48),
                    fill: 0xffffff,
                    fontWeight: "bold",
                },
            });

            labelText.x = fieldWidth * 0.10;
            labelText.y = fieldHeight * 0.5;
            labelText.anchor.set(0, 0.5);

            container.addChild(labelText);

            const valueText = new PIXI.Text({
                text: "255",
                style: {
                    fontSize: Math.max(10, fieldHeight * 0.48),
                    fill: 0xffffff,
                },
            });

            valueText.anchor.set(1, 0.5);
            valueText.x = fieldWidth * 0.90;
            valueText.y = fieldHeight * 0.5;

            container.addChild(valueText);

            container.eventMode = "static";
            container.cursor = "text";
            container.hitArea = new PIXI.Rectangle(
                0,
                0,
                fieldWidth,
                fieldHeight
            );

            container.on("pointerdown", () => {
                this._activateRGBField(channel);

                drawBackground(true);
            });

            this.addChild(container);

            this.rgbFields[channel] = {
                container,
                valueText,
                bg,
                drawBackground,
                fieldWidth,
                fieldHeight,
            };
        }

        this._updateRGBInputs();
    }

    _activateRGBField(channel) {
        const field = this.rgbFields[channel];

        if (!field) return;

        this._deactivateRGBField();

        this._activeRGBField = channel;
        this._rgbEditValue = "";

        field.valueText.text = "|";

        field.drawBackground(true);

        // Blinkender Cursor
        let cursorVisible = true;

        this._rgbCursorInterval = setInterval(() => {
            if (this._activeRGBField !== channel) return;

            cursorVisible = !cursorVisible;

            field.valueText.text =
                this._rgbEditValue +
                (cursorVisible ? "|" : "");
        }, 500);

        const keydown = (e) => {
            if (this._activeRGBField !== channel) return;

            // Nur einzelne Ziffern akzeptieren
            if (/^[0-9]$/.test(e.key)) {
                if (this._rgbEditValue.length >= 3) {
                    return;
                }

                this._rgbEditValue += e.key;

                let value = Number(this._rgbEditValue);

                if (value > 255) {
                    value = 255;
                    this._rgbEditValue = "255";
                }

                this._updateActiveRGBText();

                // SOFORT anwenden
                this._applyRGBField(channel, value);

                return;
            }

            if (e.key === "Backspace") {
                this._rgbEditValue =
                    this._rgbEditValue.slice(0, -1);

                this._updateActiveRGBText();

                // Leeres Feld = 0
                const value = this._rgbEditValue === ""
                    ? 0
                    : Number(this._rgbEditValue);

                // Auch beim Löschen sofort anwenden
                this._applyRGBField(channel, value);

                return;
            }

            if (e.key === "Enter") {
                this._applyRGBField(
                    channel,
                    this._rgbEditValue === ""
                        ? 0
                        : Number(this._rgbEditValue)
                );

                this._deactivateRGBField();
                return;
            }

            if (e.key === "Escape") {
                this._deactivateRGBField();
            }
        };

        this._rgbKeydown = keydown;

        window.addEventListener("keydown", keydown);
    }

    _updateActiveRGBText() {
        if (!this._activeRGBField) return;

        const field = this.rgbFields[this._activeRGBField];

        if (!field) return;

        // Cursor wird vom Blink-Interval ebenfalls gesetzt.
        // Hier direkt sichtbar halten.
        field.valueText.text = this._rgbEditValue + "|";
    }

    _applyRGBField(channel, value = null) {
        if (value === null) {
            value = this._rgbEditValue === ""
                ? 0
                : Number(this._rgbEditValue);
        }

        value = Math.max(
            0,
            Math.min(255, Math.round(value))
        );

        const [r, g, b] = hsvToRgb(
            this.hue,
            this.sat,
            this.val
        );

        const rgb = { r, g, b };

        rgb[channel] = value;

        const hex = rgbToHex(
            rgb.r,
            rgb.g,
            rgb.b
        );

        this.setColorHex(hex);

        this._emit();
    }

    _deactivateRGBField() {
        if (this._rgbKeydown) {
            window.removeEventListener(
                "keydown",
                this._rgbKeydown
            );

            this._rgbKeydown = null;
        }

        if (this._rgbCursorInterval) {
            clearInterval(this._rgbCursorInterval);
            this._rgbCursorInterval = null;
        }

        this._activeRGBField = null;
        this._rgbEditValue = null;

        for (const field of Object.values(this.rgbFields ?? {})) {
            field.drawBackground(false);
        }

        this._updateRGBInputs();
    }

    _updateRGBInputs() {
        if (!this.rgbFields) return;

        const [r, g, b] = hsvToRgb(
            this.hue,
            this.sat,
            this.val
        );

        if (this._activeRGBField !== "r") {
            this.rgbFields.r.valueText.text = String(r);
        }

        if (this._activeRGBField !== "g") {
            this.rgbFields.g.valueText.text = String(g);
        }

        if (this._activeRGBField !== "b") {
            this.rgbFields.b.valueText.text = String(b);
        }
    }

    _drawHueStrip() {
        const ctx = this.hueCanvas.getContext("2d");
        const grad = ctx.createLinearGradient(0, 0, 0, this.hueCanvas.height);
        for (let i = 0; i <= 360; i += 30) {
            const [r, g, b] = hsvToRgb(i, 1, 1);
            grad.addColorStop(i / 360, `rgb(${r},${g},${b})`);
        }
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, this.hueCanvas.width, this.hueCanvas.height);
    }

    _redrawSV() {
        const ctx = this.svCanvas.getContext("2d");
        const w = this.svCanvas.width, h = this.svCanvas.height;
        const [r, g, b] = hsvToRgb(this.hue, 1, 1);

        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(0, 0, w, h);

        const satGrad = ctx.createLinearGradient(0, 0, w, 0);
        satGrad.addColorStop(0, "rgba(255,255,255,1)");
        satGrad.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = satGrad;
        ctx.fillRect(0, 0, w, h);

        const valGrad = ctx.createLinearGradient(0, h, 0, 0);
        valGrad.addColorStop(0, "rgba(0,0,0,1)");
        valGrad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = valGrad;
        ctx.fillRect(0, 0, w, h);

        this.svTexture.source.update();
    }

    _updateCursors() {
        this.svCursor.clear();

        const cx = this.svSprite.x + this.sat * this.svSize;
        const cy = this.svSprite.y + (1 - this.val) * this.svSize;

        this.svCursor
            .circle(cx, cy, 5)
            .stroke({ width: 2, color: 0xffffff })
            .circle(cx, cy, 5)
            .stroke({ width: 1, color: 0x000000 });

        this.hueCursor.clear();

        const hy = this.hueSprite.y + (this.hue / 360) * this.svSize;

        this.hueCursor
            .rect(
                this.hueSprite.x - 2,
                hy - 2,
                this.hueWidth + 4,
                4
            )
            .stroke({ width: 2, color: 0xffffff })
            .rect(
                this.hueSprite.x - 2,
                hy - 2,
                this.hueWidth + 4,
                4
            )
            .stroke({ width: 1, color: 0x000000 });
    }

    _setupDrag(target, onMove) {
        let dragging = false;
        const update = (e) => {
            const local = this.toLocal(e.global);
            onMove(local);
        };
        target.on("pointerdown", (e) => { dragging = true; update(e); });
        target.on("globalpointermove", (e) => { if (dragging) update(e); });
        target.on("pointerup", () => dragging = false);
        target.on("pointerupoutside", () => dragging = false);
    }

    _emit() {
        const [r, g, b] = hsvToRgb(this.hue, this.sat, this.val);
        this._updateRGBInputs();
        this.onChange && this.onChange(rgbToHex(r, g, b));
    }

    setColorHex(hex) {
        const [r, g, b] = hexToRgb(hex);
        const [h, s, v] = rgbToHsv(r, g, b);
        this.hue = h; this.sat = s; this.val = v;
        this._redrawSV();
        this._updateCursors();
        this._updateRGBInputs();
    }

    _createMaterialSliders() {
        this.materialSliders = {};

        const totalWidth = this.svSize + this.gap + this.hueWidth;
        const startX = 0;

        // Y-Start direkt unterhalb der RGB-Zeile. RGB-Container.y war
        // this.svSize + this.svSize*0.04, Feldhoehe war
        // (this.svSize + this.hueWidth) * 0.075 - dieselbe Referenz hier
        // wiederverwendet, um konsistent zu bleiben.
        const rgbFieldHeight = (this.svSize + this.hueWidth) * 0.075;
        const rgbY = this.svSize + this.svSize * 0.04;
        let cursorY = rgbY + rgbFieldHeight + this.svSize * 0.06;

        const sliderRowGap = this.svSize * 0.09;
        const labelHeight = this.svSize * 0.05;
        const trackHeight = this.svSize * 0.06;
        const valueBoxWidth = totalWidth * 0.16;
        const valueBoxGap = totalWidth * 0.03;

        const defs = [
            { key: "metallic", label: "METALLIC" },
            { key: "roughness", label: "ROUGHNESS" },
        ];

        for (const { key, label } of defs) {
            const row = new PIXI.Container();
            row.x = startX;
            row.y = cursorY;
            this.addChild(row);

            // ---- Label ----
            const labelText = new PIXI.Text({
                text: label,
                style: {
                    fontSize: Math.max(9, labelHeight * 0.9),
                    fill: 0xaaaaaa,
                    fontWeight: "bold",
                },
            });
            labelText.x = 0;
            labelText.y = 0;
            row.addChild(labelText);

            const trackY = labelHeight + this.svSize * 0.015;

            // ---- Value-Box (links) ----
            const valueBox = new PIXI.Container();
            valueBox.x = 0;
            valueBox.y = trackY;
            row.addChild(valueBox);

            const valueBg = new PIXI.Graphics();
            valueBg
                .roundRect(0, 0, valueBoxWidth, trackHeight, trackHeight * 0.18)
                .fill(0x202020)
                .stroke({ width: Math.max(1, this.svSize * 0.008), color: 0x505050 });
            valueBox.addChild(valueBg);

            const valueText = new PIXI.Text({
                text: "0",
                style: {
                    fontSize: Math.max(10, trackHeight * 0.5),
                    fill: 0xffffff,
                },
            });
            valueText.anchor.set(0.5);
            valueText.x = valueBoxWidth / 2;
            valueText.y = trackHeight / 2;
            valueBox.addChild(valueText);

            // ---- Slider-Track (rechts, restliche Breite) ----
            const trackX = valueBoxWidth + valueBoxGap;
            const trackWidth = totalWidth - trackX;

            const track = new PIXI.Container();
            track.x = trackX;
            track.y = trackY;
            row.addChild(track);

            const trackBg = new PIXI.Graphics();
            trackBg
                .roundRect(0, trackHeight * 0.35, trackWidth, trackHeight * 0.3, trackHeight * 0.15)
                .fill(0x202020)
                .stroke({ width: Math.max(1, this.svSize * 0.008), color: 0x505050 });
            track.addChild(trackBg);

            const trackFill = new PIXI.Graphics();
            track.addChild(trackFill);

            const handle = new PIXI.Graphics();
            track.addChild(handle);

            track.eventMode = "static";
            track.cursor = "pointer";
            track.hitArea = new PIXI.Rectangle(0, 0, trackWidth, trackHeight);

            this.materialSliders[key] = {
                row, valueBox, valueBg, valueText,
                track, trackBg, trackFill, handle,
                trackWidth, trackHeight,
            };

            this._setupSliderDrag(track, trackWidth, (t) => {
                this[key] = clamp01(t);
                this._updateMaterialSliders();
                this._emitMaterial();
            });

            cursorY += labelHeight + this.svSize * 0.015 + trackHeight + sliderRowGap;
        }

        this._totalHeight = cursorY - sliderRowGap;
    }

    // Zeichnet Fill + Handle-Position fuer beide Slider anhand von
    // this.metallic/this.roughness, und aktualisiert den Zahlenwert (0-100,
    // gerundet) in der Value-Box.
    _updateMaterialSliders() {
        if (!this.materialSliders) return;

        for (const key of ["metallic", "roughness"]) {
            const s = this.materialSliders[key];
            const t = clamp01(this[key]);

            s.trackFill.clear();
            if (t > 0) {
                s.trackFill
                    .roundRect(0, s.trackHeight * 0.35, s.trackWidth * t, s.trackHeight * 0.3, s.trackHeight * 0.15)
                    .fill(0x6a8fd1);
            }

            const handleX = s.trackWidth * t;
            s.handle.clear();
            s.handle
                .circle(handleX, s.trackHeight * 0.5, s.trackHeight * 0.45)
                .fill(0xffffff)
                .stroke({ width: 1, color: 0x000000 });

            s.valueText.text = String(Math.round(t * 100));
        }
    }

    // Generischer Drag-Handler fuer einen horizontalen Slider-Track -
    // liefert t (0..1) an den Callback, basierend auf lokaler X-Position
    // relativ zum Track, geclamped.
    _setupSliderDrag(track, trackWidth, onChange) {
        let dragging = false;
        const update = (e) => {
            const local = track.toLocal(e.global);
            const t = clamp01(local.x / trackWidth);
            onChange(t);
        };
        track.on("pointerdown", (e) => { dragging = true; update(e); });
        track.on("globalpointermove", (e) => { if (dragging) update(e); });
        track.on("pointerup", () => dragging = false);
        track.on("pointerupoutside", () => dragging = false);
    }

    _emitMaterial() {
        this.onMaterialChange && this.onMaterialChange(this.metallic, this.roughness);
    }

    // Oeffentlicher Setter, analog zu setColorHex - erlaubt es dem Aufrufer,
    // die Slider programmatisch auf einen bestehenden Wert zu setzen (z.B.
    // beim Oeffnen des Pickers fuer ein bereits vorhandenes Material)
    setMetallicRoughness(metallic, roughness) {
        this.metallic = clamp01(metallic);
        this.roughness = clamp01(roughness);
        this._updateMaterialSliders();
    }


    destroy(options) {
        this.svTexture.destroy(true);
        this.hueTexture.destroy(true);
        super.destroy(options);
    }
}