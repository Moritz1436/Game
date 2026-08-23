import * as PIXI from "pixi.js";
import { generateAndDrawCityBuildings, drawCityBadge } from "./draw.js";
import { pixelText, drawBox } from "../Utils/UI.js";
import { COLORS } from "../Colors.js";

export class CityGroup extends PIXI.Container {
    static _footprintPadding = 1.6; // wie viel Rand ums Gebaeude-Areal fuer Schatten/Ueberstand
    static _glowTex = null;
    static _textureCache = new Map();

    static getBadgeTexture(feature, rand) {
        if (CityGroup._textureCache.has(feature)) {
            return CityGroup._textureCache.get(feature);
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
        CityGroup._textureCache.set(feature, texture);
        return texture;
    }

    constructor(city, world, cityNetwork, isCurrent = false) {
        super();
        this.city = city;
        this.isCurrent = isCurrent;

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

        this.currentGlow = null;
        if (this.isCurrent) {
            this.currentGlow = new PIXI.Sprite(CityGroup.getGlowTexture());
            this.currentGlow.anchor.set(0.5);
            this.currentGlow.blendMode = 'add';
            this._glowBaseSize = worldRadiusPx * 3.2;
            this.currentGlow.width = this._glowBaseSize;
            this.currentGlow.height = this._glowBaseSize;
        }

        this.addChild(this.background);
        if (this.currentGlow) this.addChild(this.currentGlow);
        this.addChild(this.buildingsSprite);

        this.badge = null;
        if (city.feature) {
            this.badge = new PIXI.Sprite(CityGroup.getBadgeTexture(city.feature, city.rand));
            const anchor = this.badge.texture._groundAnchor;
            this.badge.anchor.set(anchor.x, anchor.y);
            this.badge.y = -worldRadiusPx * 0.15;
            this.addChild(this.badge);
        }

        this.nameText = null;
        this.nameBg = null;
        this.nameContainer = null;
        if (city.name) {
            this.nameText = pixelText(city.name, 28, COLORS.textLight);
            this.nameText.anchor.set(0.5, 0.5);

            const paddingX = 14, paddingY = 8;
            const bgW = this.nameText.width + paddingX * 2;
            const bgH = this.nameText.height + paddingY * 2;

            this.nameBg = new PIXI.Graphics();
            drawBox(this.nameBg, bgW, bgH, 0x241d16, 0x2a221a, 2, 6); // dunkler Grund, dezente Border
            this.nameBg.alpha = 0.65;
            this.nameBg.pivot.set(bgW / 2, bgH / 2); // damit Positionierung ueber x/y wie beim Text funktioniert

            const nameY = this.badge ? this.badge.y - 105 : -worldRadiusPx * 0.35;
            this.nameContainer = new PIXI.Container();
            this.nameContainer.y = nameY;
            this.nameBg.y = 0;
            this.nameText.y = 0;
            this.nameContainer.addChild(this.nameBg, this.nameText);
            this.addChild(this.nameContainer);
        }

        this.x = city.cx;
        this.y = city.cy;

        this.hitArea = new PIXI.Circle(0, 0, worldRadiusPx * 1.1);
        this.eventMode = 'static';
        this.cursor = 'pointer';

        this._bindEvents();

        if (this.isCurrent) {
            this._startGlowPulse();
        }
    }
    
    _startGlowPulse() {
        const t0 = performance.now();
        const step = (now) => {
            if (this.destroyed) return;
            const t = (now - t0) / 1000;
            // langsames, weiches Atmen statt schnellem Blinken - 2.2s Zyklus,
            // Groesse 0.9..1.15, Alpha 0.5..0.85
            const wave = Math.sin(t * (Math.PI * 2 / 2.2));
            const scale = 1 + wave * 0.12;
            this.currentGlow.width = this._glowBaseSize * scale;
            this.currentGlow.height = this._glowBaseSize * scale;
            this.currentGlow.alpha = 0.67 + wave * 0.18;
            this._glowFrame = requestAnimationFrame(step);
        };
        this._glowFrame = requestAnimationFrame(step);
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
            const s = start + (target - start) * eased;
            this.scale.set(start + (target - start) * eased);
            if (this.nameContainer) this.nameContainer.scale.set(1 / s);
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

    destroy(options) {
        if (this._pulseFrame) cancelAnimationFrame(this._pulseFrame);
        super.destroy(options);
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

    static getGlowTexture() {
        if (CityGroup._glowTex) return CityGroup._glowTex;
        const size = 256;
        const c = document.createElement('canvas');
        c.width = c.height = size;
        const gctx = c.getContext('2d');
        const grad = gctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        grad.addColorStop(0, 'rgba(255, 214, 110, 0.95)');
        grad.addColorStop(0.35, 'rgba(255, 190, 80, 0.55)');
        grad.addColorStop(0.7, 'rgba(255, 170, 60, 0.18)');
        grad.addColorStop(1, 'rgba(255, 170, 60, 0)');
        gctx.fillStyle = grad;
        gctx.fillRect(0, 0, size, size);
        CityGroup._glowTex = PIXI.Texture.from(c);
        return CityGroup._glowTex;
    }
}