import * as PIXI from "pixi.js";
import { pixelText } from "./DriveOverlay.js";

const COLORS = {
    textDim: 0xaaaaaa,
    textLight: 0xffffff,
    needleRed: 0xe03030,
    redlineZone: 0xd04040,
    faceRing: 0x1a1a1a,
    tickMinor: 0x888888,
};


// ---------------------------------------------------------------------------
// Rundes Tacho: 240° Sweep, Haupt-/Nebenstriche, Zahlen, roter Zeiger.
// Zeichnet sich um seinen eigenen (0,0)-Mittelpunkt herum - position.set()
// setzt also das ZENTRUM der Anzeige, nicht die obere linke Ecke.
// ---------------------------------------------------------------------------
export class CircularGauge extends PIXI.Container {
    ///@param label - z.B. "SPEED"
    ///@param maxValue - oberes Ende der Skala
    ///@param majorStep - Abstand zwischen beschrifteten Hauptstrichen
    ///@param redlineFrom - optional: ab diesem Wert wird der äußere Ring rot (Redline-Zone)
    constructor(label, maxValue, majorStep, redlineFrom = null) {
        super();
        this.label = label;
        this.maxValue = maxValue;
        this.majorStep = majorStep;
        this.redlineFrom = redlineFrom;
        this.value = 0;
        this.displayValue = 0;
        this.needleFollowSpeed = 10;

        this.startAngle = -120; // Grad, gemessen von "oben" (12 Uhr), im Uhrzeigersinn
        this.endAngle = 120;

        this.face = new PIXI.Graphics();
        this.addChild(this.face);

        this.tickLayer = new PIXI.Graphics();
        this.addChild(this.tickLayer);

        this.labelsLayer = new PIXI.Container();
        this.addChild(this.labelsLayer);

        this.needle = new PIXI.Graphics();
        this.addChild(this.needle);

        this.cap = new PIXI.Graphics();
        this.addChild(this.cap);

        this.labelText = pixelText(label, 10, COLORS.textDim);
        this.labelText.anchor.set(0.5);
        this.addChild(this.labelText);

        this.valueText = pixelText("0", 14, COLORS.textLight);
        this.valueText.anchor.set(0.5);
        this.addChild(this.valueText);
    }

    setValue(v) {
        this.value = Math.max(0, Math.min(this.maxValue, v));
        this.valueText.text = Math.round(this.value).toString();
    }

    update(dt) {
        const followT = 1 - Math.exp(-this.needleFollowSpeed * dt);
        this.displayValue += (this.value - this.displayValue) * followT;

        const t = this.displayValue / this.maxValue;
        const angleDeg = this.startAngle + (this.endAngle - this.startAngle) * t;
        this.needle.rotation = angleDeg * Math.PI / 180;
    }

    setSize(diameter) {
        this.diameter = diameter;
        const r = diameter / 2;
        const [csA, ceA] = this._canvasAngles();

        // ---- Gehäusering + Skalenring ----
        this.face.clear();
        this.face
            .arc(0, 0, r, csA, ceA, false)
            .stroke({ width: Math.max(2, r * 0.08), color: COLORS.faceRing });
        this.face
            .arc(0, 0, r * 0.94, csA, ceA, false)
            .stroke({ width: Math.max(1, r * 0.02), color: 0x444444 });

        // Redline-Zone als farbiger Abschnitt über dem äußeren Ring
        if (this.redlineFrom != null) {
            const tStart = this.redlineFrom / this.maxValue;
            const angleFrom = this.startAngle + (this.endAngle - this.startAngle) * tStart;
            const [rsA, reA] = this._canvasAngles(angleFrom, this.endAngle);
            this.face
                .arc(0, 0, r * 0.94, rsA, reA, false)
                .stroke({ width: Math.max(2, r * 0.05), color: COLORS.redlineZone });
        }

        // ---- Striche + Zahlen ----
        this.tickLayer.clear();
        this.labelsLayer.removeChildren();

        const numMajor = Math.round(this.maxValue / this.majorStep);
        const minorPerMajor = 5;

        for (let i = 0; i <= numMajor * minorPerMajor; i++) {
            const t = i / (numMajor * minorPerMajor);
            const angleRad = (this.startAngle + (this.endAngle - this.startAngle) * t) * Math.PI / 180;
            const isMajor = i % minorPerMajor === 0;

            const outerR = r * 0.86;
            const innerR = isMajor ? r * 0.72 : r * 0.78;

            const x1 = outerR * Math.sin(angleRad), y1 = -outerR * Math.cos(angleRad);
            const x2 = innerR * Math.sin(angleRad), y2 = -innerR * Math.cos(angleRad);

            this.tickLayer
                .moveTo(x1, y1)
                .lineTo(x2, y2)
                .stroke({
                    width: isMajor ? Math.max(2, r * 0.035) : Math.max(1, r * 0.015),
                    color: isMajor ? COLORS.textLight : COLORS.tickMinor,
                });

            if (isMajor) {
                const labelR = r * 0.58;
                const lx = labelR * Math.sin(angleRad), ly = -labelR * Math.cos(angleRad);
                const val = Math.round(this.maxValue * t);
                const txt = pixelText(val.toString(), Math.max(8, r * 0.15), COLORS.textLight);
                txt.anchor.set(0.5);
                txt.position.set(lx, ly);
                this.labelsLayer.addChild(txt);
            }
        }

        // ---- Zeiger (rot, spitz zulaufend, mit kurzem Gegengewicht) ----
        const needleLen = r * 0.68;
        const tailLen = r * 0.16;
        const needleW = Math.max(2, r * 0.06);

        this.needle.clear();
        this.needle
            .moveTo(-needleW * 0.5, 0).lineTo(needleW * 0.5, 0)
            .lineTo(needleW * 0.12, -needleLen).lineTo(-needleW * 0.12, -needleLen)
            .closePath().fill(COLORS.needleRed)
            .moveTo(-needleW * 0.5, 0).lineTo(needleW * 0.5, 0)
            .lineTo(0, tailLen).closePath().fill(COLORS.needleRed);

        const t = this.displayValue / this.maxValue;
        const angleDeg = this.startAngle + (this.endAngle - this.startAngle) * t;
        this.needle.rotation = angleDeg * Math.PI / 180;

        // ---- Mittelkappe ----
        this.cap.clear();
        this.cap.circle(0, 0, r * 0.1).fill(0x222222).stroke({ width: Math.max(1, r * 0.015), color: COLORS.faceRing });

        // ---- Texte ----
        this.labelText.style.fontSize = Math.max(8, r * 0.15);
        this.labelText.position.set(0, r * 0.4);

        this.valueText.style.fontSize = Math.max(10, r * 0.24);
        this.valueText.position.set(0, r * 0.16);
    }

    _canvasAngles(startDeg = this.startAngle, endDeg = this.endAngle) {
        const toCanvas = (deg) => (deg - 90) * Math.PI / 180;
        return [toCanvas(startDeg), toCanvas(endDeg)];
    }
}