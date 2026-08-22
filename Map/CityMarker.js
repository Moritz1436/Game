import * as PIXI from "pixi.js";
import { FULL_W, FULL_H } from "./Utils.js";
import { drawCityBadge } from "./draw.js";

export class CityMarker extends PIXI.Container {
    // Textur-Cache: da drawCityFeatureIcon rein vom feature-String abhaengt
    // (rand wird darin nicht sichtbar genutzt), reicht eine Textur pro
    // Feature-Typ statt pro Stadt
    static _textureCache = new Map();
    static _groundAnchor = { x: 0, y: 0 }; // wird beim Textur-Bau mitbestimmt

    static getBadgeTexture(feature, rand) {
        if (CityMarker._textureCache.has(feature)) {
            return CityMarker._textureCache.get(feature);
        }

        // Canvas-Layout: lokaler "Bodenpunkt" (x0,y0) entspricht dem (x,y),
        // das drawCityBadge normalerweise in Weltkoordinaten bekommt.
        // Badge schwebt bei y0-42 mit Radius 24 -> reicht bis y0-66-lineWidth
        // nach oben; Schatten bei y0-2 mit ry=5.5 -> reicht bis y0+3.5+etwas
        // Puffer nach unten. Grosszuegige Raender fuer den Outline-Stroke.
        const x0 = 34, y0 = 74;
        const canvas = document.createElement('canvas');
        canvas.width = 68;
        canvas.height = 90;
        const ctx = canvas.getContext('2d');

        drawCityBadge(ctx, x0, y0, feature, rand);

        const texture = PIXI.Texture.from(canvas);
        texture._groundAnchor = { x: x0 / canvas.width, y: y0 / canvas.height };
        CityMarker._textureCache.set(feature, texture);
        return texture;
    }

    constructor(city) {
        super();
        this.city = city;

        const texture = CityMarker.getBadgeTexture(city.feature, city.rand);

        this.badge = new PIXI.Sprite(texture);
        // Anchor auf den gebackenen Bodenpunkt setzen, NICHT auf 0.5/0.5 -
        // sonst waechst/skaliert das Icon vom Canvas-Zentrum statt vom
        // Fusspunkt aus, und die Position stimmt nicht mit dem Terrain ueberein
        this.badge.anchor.set(texture._groundAnchor.x, texture._groundAnchor.y);
        this.addChild(this.badge);

        this.x = city.cx;
        this.y = city.cy;

        // Hit-Bereich um den sichtbaren Icon-Kreis herum (floatY = -42, r=24),
        // nicht um den ganzen (groesseren) Canvas-Bereich mit Schatten
        this.hitArea = new PIXI.Circle(0, -42, 30);
        this.eventMode = 'static';
        this.cursor = 'pointer';

        this._bindEvents();
    }

    _bindEvents() {
        this.on('pointerover', () => this._animateScaleTo(1.2, 150));
        this.on('pointerout', () => this._animateScaleTo(1.0, 150));
        this.on('pointertap', () => this.emit('cityclick', this.city));
    }

    _animateScaleTo(targetScale, durationMs) {
        const startScale = this.badge.scale.x;
        const startTime = performance.now();
        const step = (now) => {
            if (this.destroyed) return;
            const t = Math.min(1, (now - startTime) / durationMs);
            const eased = 1 - Math.pow(1 - t, 3);
            this.badge.scale.set(startScale + (targetScale - startScale) * eased);
            if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }

}