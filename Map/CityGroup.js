import * as PIXI from "pixi.js";
import { generateAndDrawCityBuildings } from "./draw.js";
import { CityMarker } from "./CityMarker.js";


export class CityGroup extends PIXI.Container {
    static _footprintPadding = 1.6; // wie viel Rand ums Gebaeude-Areal fuer Schatten/Ueberstand

    constructor(city, world, cityNetwork) {
        super();
        this.city = city;

        // Canvas-Groesse aus dem Stadt-Radius ableiten (Weltpixel), plus Puffer
        const worldRadiusPx = city.radius;
        const size = Math.ceil(worldRadiusPx * 2 * CityGroup._footprintPadding);
        const localCx = size / 2, localCy = size / 2;

        const buildCanvas = document.createElement('canvas');
        buildCanvas.width = buildCanvas.height = size;
        const bctx = buildCanvas.getContext('2d');
        bctx.translate(localCx - city.cx, localCy - city.cy); // city.cx/cy bereits absolute Pixel
        generateAndDrawCityBuildings(bctx, world, city, cityNetwork);

        this.buildingsSprite = new PIXI.Sprite(PIXI.Texture.from(buildCanvas));
        this.buildingsSprite.anchor.set(0.5);

        // Hintergrund: weicher Untergrund hinter den Gebaeuden, standardmaessig
        // unsichtbar, faehrt beim Hover sanft ein
        this.background = new PIXI.Sprite(CityGroup.getBackgroundTexture());
        this.background.anchor.set(0.5);
        this.background.width = size * 1.15;
        this.background.height = size * 1.15;
        this.background.alpha = 0;

        this.badge = new PIXI.Sprite(CityMarker.getBadgeTexture(city.feature, city.rand));
        // Badge-Textur hat eigenen Bodenanker (siehe vorherige Antwort) -
        // hier relativ zur Gruppen-Mitte positionieren statt absolut
        const anchor = this.badge.texture._groundAnchor;
        this.badge.anchor.set(anchor.x, anchor.y);
        this.badge.y = -worldRadiusPx * 0.15; // grob ueber dem Stadtzentrum, ggf. anpassen

        // Reihenfolge wichtig: Hintergrund unterste Ebene, dann Gebaeude, dann Badge
        this.addChild(this.background, this.buildingsSprite, this.badge);

        this.x = city.cx;
        this.y = city.cy;

        this.hitArea = new PIXI.Circle(0, 0, worldRadiusPx * 1.1);
        this.eventMode = 'static';
        this.cursor = 'pointer';

        this._bindEvents();
    }

    _bindEvents() {
        this.on('pointerover', () => {
            this._animateScaleTo(1.15, 200);
            this._animateAlphaTo(this.background, 0.8, 200);
        });
        this.on('pointerout', () => {
            this._animateScaleTo(1.0, 200);
            this._animateAlphaTo(this.background, 0, 200);
        });
        this.on('pointertap', () => this.emit('cityclick', this.city));
    }

    _animateScaleTo(target, durationMs) {
        const start = this.scale.x;
        const t0 = performance.now();
        const step = (now) => {
            if (this.destroyed) return;
            const t = Math.min(1, (now - t0) / durationMs);
            const eased = 1 - Math.pow(1 - t, 3);
            this.scale.set(start + (target - start) * eased);
            if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }

    _animateAlphaTo(obj, target, durationMs) {
        const start = obj.alpha;
        const t0 = performance.now();
        const step = (now) => {
            if (this.destroyed) return;
            const t = Math.min(1, (now - t0) / durationMs);
            obj.alpha = start + (target - start) * t;
            if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }

    static getBackgroundTexture() {
        if (CityGroup._bgTex) return CityGroup._bgTex;
        const size = 256;
        const c = document.createElement('canvas');
        c.width = c.height = size;
        const gctx = c.getContext('2d');
        const grad = gctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        grad.addColorStop(0, 'rgba(255, 244, 214, 0.85)');
        grad.addColorStop(0.7, 'rgba(255, 244, 214, 0.35)');
        grad.addColorStop(1, 'rgba(255, 244, 214, 0)');
        gctx.fillStyle = grad;
        gctx.fillRect(0, 0, size, size);
        CityGroup._bgTex = PIXI.Texture.from(c);
        return CityGroup._bgTex;
    }
}