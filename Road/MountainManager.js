import * as PIXI from "pixi.js";



// ---------------------------------------------------------------------
// Kleine, lokale Helper (bewusst self-contained gehalten statt aus world.js
// zu importieren, damit diese Datei unabhaengig bleibt)
// ---------------------------------------------------------------------
function _mulberry32(seed) {
    return function () {
        seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function _clamp01(v) { return Math.max(0, Math.min(1, v)); }

function _smoothstep(edge0, edge1, x) {
    const t = _clamp01((x - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
}

function _lerpHexColor(a, b, t) {
    const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
    const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
    return (Math.round(ar + (br - ar) * t) << 16)
         | (Math.round(ag + (bg - ag) * t) << 8)
         | Math.round(ab + (bb - ab) * t);
}

function _darkenHex(hex, factor) {
    const r = Math.round(((hex >> 16) & 0xff) * factor);
    const g = Math.round(((hex >> 8) & 0xff) * factor);
    const b = Math.round((hex & 0xff) * factor);
    return (r << 16) | (g << 8) | b;
}

function _rgba(hex, alpha) {
    const r = (hex >> 16) & 0xff, g = (hex >> 8) & 0xff, b = hex & 0xff;
    return `rgba(${r},${g},${b},${alpha})`;
}

// ---------------------------------------------------------------------
// MountainManager - jetzt komplett prozedural: Himmel-Gradient mit Day-
// Night-Cycle, Sonne/Mond auf Bogenbahn, Sterne mit Twinkle, gelegentliche
// Sternschnuppen, und parallaxe, weich geblurrte Bergketten statt eines
// starren, hart abgeschnittenen Sprites.
// ---------------------------------------------------------------------
export class MountainManager {

    constructor(app, cam, layer, cycleDurationMs = 180000) {
        this.app = app;
        this.cam = cam;
        this.layer = layer;

        this.nightFactor = 0;

        // Volle Zykluslaenge (Sonnenaufgang -> Mittag -> Sonnenuntergang ->
        // Mitternacht -> zurueck). Frei anpassbar.
        this.cycleDurationMs = cycleDurationMs;
        this._startTime = performance.now();

        this.horizonSpriteOffset = 40;

        // ---- Himmel: 2 grosse Gradient-Sprites (Tag/Nacht), per Alpha
        // gegeneinander ueberblendet statt jeden Frame neu zu rendern -
        // guenstig, da nur Alpha-Blending auf der GPU statt Canvas-Redraw
        // pro Frame ----
        this.skyDayTexture = this._createSkyTexture(0x3d7fd6, 0xbfe0f5);
        this.skyNightTexture = this._createSkyTexture(0x02030a, 0x121a33);

        this.skyDaySprite = new PIXI.Sprite(this.skyDayTexture);
        this.skyDaySprite.anchor.set(0.5, 1);
        layer.addChild(this.skyDaySprite);

        this.skyNightSprite = new PIXI.Sprite(this.skyNightTexture);
        this.skyNightSprite.anchor.set(0.5, 1);
        layer.addChild(this.skyNightSprite);

        // Warmes Glühen am Horizont fuer Sonnenauf-/untergang
        this.sunsetGlowTexture = this._createHorizonGlowTexture(0xff9a4d, 0xffce9e);
        this.sunsetGlow = new PIXI.Sprite(this.sunsetGlowTexture);
        this.sunsetGlow.anchor.set(0.5, 1);
        layer.addChild(this.sunsetGlow);

        // ---- Sterne ----
        this.starLayer = new PIXI.Container();
        layer.addChild(this.starLayer);
        this.stars = this._createStars(150);
        for (const s of this.stars) this.starLayer.addChild(s.gfx);

        // ---- Sternschnuppen ----
        this.shootingStarLayer = new PIXI.Container();
        layer.addChild(this.shootingStarLayer);
        this._activeShootingStars = [];
        this._nextShootingStarAt = this._startTime + this._randomShootingStarDelay();

        // ---- Sonne / Mond ----
        this.sunTexture = this._createGlowTexture(0xfff6d5, 0xffb84d);
        this.moonTexture = this._createGlowTexture(0xf3f7ff, 0xaebedd);
        this.sun = new PIXI.Sprite(this.sunTexture);
        this.sun.anchor.set(0.5);
        this.moon = new PIXI.Sprite(this.moonTexture);
        this.moon.anchor.set(0.5);
        layer.addChild(this.sun);
        layer.addChild(this.moon);

        // ---- Berg-Layer: 3 parallaxe, prozedural erzeugte Silhouetten,
        // hinten hell/verwaschen (Luftperspektive), vorne dunkler/schaerfer
        // konturiert. Jeder Layer hat einen eigenen festen Seed - die Form
        // bleibt also stabil ueber die Zeit, nur Farbe (Day/Night) und
        // Parallax-Offset aendern sich pro Frame.
        this.mountainLayers = [
            this._createMountainLayer({ seed: 1337, parallax: 0.02, dayColor: 0x9fb2c4, jag: 0.10, heightFrac: 0.42, blur: 3.0 }),
            this._createMountainLayer({ seed: 4242, parallax: 0.05, dayColor: 0x74889a, jag: 0.16, heightFrac: 0.60, blur: 1.6 }),
            this._createMountainLayer({ seed: 777,  parallax: 0.09, dayColor: 0x4a5c6e, jag: 0.24, heightFrac: 0.80, blur: 0.6 }),
        ];
        for (const l of this.mountainLayers) layer.addChild(l.container);

        // Horizont-Dunst - haelt den Uebergang Berge/Himmel weich, aehnlich
        // dem urspruenglichen Fog-Trick, jetzt aber zusaetzlich zum
        // Blur-Filter auf den Bergen selbst
        this.fog = this._createFogSprite();
        layer.addChild(this.fog);

        this.update();
    }

    // -------------------------------------------------------------
    // Texturen (Canvas-Gradient-Trick, wie im urspruenglichen Fog-Code)
    // -------------------------------------------------------------
    _createSkyTexture(colorTop, colorBottom) {
        const canvas = document.createElement("canvas");
        canvas.width = 4;
        canvas.height = 256;
        const ctx = canvas.getContext("2d");
        const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        grad.addColorStop(0, _rgba(colorTop, 1));
        grad.addColorStop(1, _rgba(colorBottom, 1));
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        return PIXI.Texture.from(canvas);
    }

    _createHorizonGlowTexture(colorNear, colorFar) {
        const canvas = document.createElement("canvas");
        canvas.width = 4;
        canvas.height = 160;
        const ctx = canvas.getContext("2d");
        const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        grad.addColorStop(0, _rgba(colorFar, 0));
        grad.addColorStop(0.55, _rgba(colorFar, 0.35));
        grad.addColorStop(1, _rgba(colorNear, 0.55));
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        return PIXI.Texture.from(canvas);
    }

    _createGlowTexture(coreColor, midColor) {
        const size = 128;
        const c = document.createElement("canvas");
        c.width = c.height = size;
        const ctx = c.getContext("2d");
        const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        grad.addColorStop(0, _rgba(coreColor, 1));
        grad.addColorStop(0.35, _rgba(midColor, 0.9));
        grad.addColorStop(1, _rgba(midColor, 0));
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
        return PIXI.Texture.from(c);
    }

    _createFogSprite() {
        const canvas = document.createElement("canvas");
        canvas.width = 4;
        canvas.height = 200;
        const ctx = canvas.getContext("2d");
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, "rgba(200,220,220,0)");
        gradient.addColorStop(0.5, "rgba(200,220,220,0.18)");
        gradient.addColorStop(1, "rgba(200,220,220,0.30)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const sprite = new PIXI.Sprite(PIXI.Texture.from(canvas));
        sprite.anchor.set(0.5, 1);
        return sprite;
    }

    // -------------------------------------------------------------
    // Sterne: feste, seeded Positionen im oberen Himmelsbereich, jeder mit
    // eigenem Twinkle-Rhythmus. Alpha wird in update() ueber die
    // Nacht-Staerke UND den individuellen Twinkle multipliziert.
    // -------------------------------------------------------------
    _createStars(count) {
        const rand = _mulberry32(9001);
        const stars = [];
        for (let i = 0; i < count; i++) {
            const gfx = new PIXI.Graphics();
            const r = 0.8 + rand() * 1.6;
            gfx.circle(0, 0, r).fill(0xffffff);
            stars.push({
                gfx,
                nx: rand(),               // normierte X-Position 0..1
                ny: rand() * 0.75,        // nur oberer Bereich (nicht direkt am Horizont)
                baseAlpha: 0.5 + rand() * 0.5,
                twinkleSpeed: 0.5 + rand() * 2.0,
                twinklePhase: rand() * Math.PI * 2,
            });
        }
        return stars;
    }

    _randomShootingStarDelay() {
        return 7000 + Math.random() * 14000;
    }

    // -------------------------------------------------------------
    // Erzeugt einen prozeduralen, parallaxen Bergketten-Layer. Punkte
    // werden mit Rand-Ueberschuss (-0.15..1.15 der Breite) generiert, damit
    // der Parallax-Versatz beim Kamera-Schwenk nie eine Luecke am Rand
    // aufreisst.
    // -------------------------------------------------------------
    _createMountainLayer({ seed, parallax, dayColor, jag, heightFrac, blur }) {
        const rand = _mulberry32(seed);
        const pointCount = 48;
        const points = [];
        let h = 0.3 + rand() * 0.25;
        for (let i = 0; i <= pointCount; i++) {
            h += (rand() - 0.5) * jag;
            h = Math.max(0.06, Math.min(1, h));
            points.push(h);
        }

        const container = new PIXI.Container();
        const gfx = new PIXI.Graphics();
        container.addChild(gfx);

        // Sanfter Blur statt hartem Sprite-Rand - Staerke pro Layer
        // unterschiedlich (weiter weg = staerker verwaschen, wie in echter
        // Atmosphaere). Objekt-Syntax passt zu PIXI v8; bei aelteren
        // Versionen stattdessen new PIXI.BlurFilter(blur, 3) verwenden.
        const blurFilter = new PIXI.BlurFilter({ strength: blur, quality: 3 });
        gfx.filters = [blurFilter];

        return { container, gfx, points, parallax, dayColor, heightFrac };
    }

    _drawMountainLayer(layer, width, horizonY, movement, color) {
        const g = layer.gfx;
        const n = layer.points.length;
        const marginFrac = 0.15;
        const totalSpan = width * (1 + marginFrac * 2);
        const startX = -width * marginFrac - movement;
        const segW = totalSpan / (n - 1);
        const layerHeight = horizonY * layer.heightFrac;

        const poly = [];
        poly.push(startX, horizonY);
        for (let i = 0; i < n; i++) {
            const x = startX + i * segW;
            const y = horizonY - layer.points[i] * layerHeight;
            poly.push(x, y);
        }
        poly.push(startX + (n - 1) * segW, horizonY);

        g.clear();
        g.poly(poly).fill(color);
    }

    // -------------------------------------------------------------
    // Haupt-Update: laeuft jeden Frame, komplett selbststaendig getaktet
    // ueber performance.now() (kein dt-Parameter noetig - DriveScene ruft
    // mountains.update() ohnehin ohne Argumente auf).
    // -------------------------------------------------------------
    update() {
        const width = this.app.renderer.width;
        const height = this.app.renderer.height;
        const horizonY = this.cam.getHorizonY();
        const camMovement = this.cam.pos3d.x * 0.05;

        const now = performance.now();
        const elapsed = now - this._startTime;
        const phase = (elapsed % this.cycleDurationMs) / this.cycleDurationMs;

        // sunHeight: -1 (Mitternacht) .. 0 (Auf-/Untergang) .. 1 (Mittag)
        const sunHeight = Math.sin(phase * Math.PI * 2 - Math.PI / 2);

        const dayAlpha = _smoothstep(-0.05, 0.25, sunHeight);
        const nightAlpha = 1 - _smoothstep(-0.25, 0.05, sunHeight);
        this.nightFactor = nightAlpha;
        const horizonGlowAlpha = 1 - _smoothstep(0.05, 0.55, Math.abs(sunHeight));

        // ---- Himmel ----
        this.skyDaySprite.x = this.skyNightSprite.x = this.sunsetGlow.x = width * 0.5;
        this.skyDaySprite.y = this.skyNightSprite.y = horizonY;
        this.skyDaySprite.width = this.skyNightSprite.width = width * 1.05;
        this.skyDaySprite.height = this.skyNightSprite.height = horizonY + this.horizonSpriteOffset;
        this.skyDaySprite.alpha = dayAlpha;
        this.skyNightSprite.alpha = nightAlpha;

        this.sunsetGlow.y = horizonY + this.horizonSpriteOffset;
        this.sunsetGlow.width = width;
        this.sunsetGlow.height = height * 0.35;
        this.sunsetGlow.alpha = horizonGlowAlpha * 0.9;

        // ---- Sonne / Mond: eigene Halbkreis-Bahn ueber je ein halbes
        // Zyklus-Fenster, Hoehe folgt sunHeight (bzw. dessen Spiegelung
        // fuer den Mond) ----
        const arcMargin = width * 0.08;
        const arcHeight = horizonY * 0.85;
        const sunT = _clamp01((phase - 0.25) / 0.5);
        this.sun.x = arcMargin + sunT * (width - arcMargin * 2);
        this.sun.y = horizonY - Math.max(0, sunHeight) * arcHeight;
        this.sun.alpha = Math.max(0, sunHeight);
        const sunSize = Math.min(width, height) * 0.10;
        this.sun.width = this.sun.height = sunSize;

        const moonPhaseT = ((phase - 0.75 + 1) % 1) / 0.5;
        const moonT = _clamp01(moonPhaseT);
        this.moon.x = arcMargin + moonT * (width - arcMargin * 2);
        this.moon.y = horizonY - Math.max(0, -sunHeight) * arcHeight;
        this.moon.alpha = Math.max(0, -sunHeight);
        const moonSize = Math.min(width, height) * 0.06;
        this.moon.width = this.moon.height = moonSize;

        // ---- Sterne ----
        this.starLayer.alpha = nightAlpha;
        if (nightAlpha > 0.01) {
            for (const s of this.stars) {
                s.gfx.position.set(s.nx * width, s.ny * horizonY);
                const twinkle = 0.6 + 0.4 * Math.sin(now / 1000 * s.twinkleSpeed + s.twinklePhase);
                s.gfx.alpha = s.baseAlpha * twinkle;
            }
        }

        // ---- Sternschnuppen ----
        this._updateShootingStars(now, width, horizonY, nightAlpha);

        // ---- Berge: Farbe pro Layer interpoliert zwischen Tag-Farbe und
        // einer sehr dunklen Nacht-Silhouette derselben Farbfamilie ----
        for (const layer of this.mountainLayers) {
            const nightColor = _darkenHex(layer.dayColor, 0.05);
            const color = _lerpHexColor(nightColor, layer.dayColor, dayAlpha);
            const movement = camMovement * (1 + layer.parallax * 20); // staerkerer Parallax fuer naehere Layer
            this._drawMountainLayer(layer, width, horizonY + this.horizonSpriteOffset, movement, color);
        }

        // ---- Horizont-Dunst (unveraendert vom urspruenglichen Trick) ----
        this.fog.x = width * 0.5;
        this.fog.y = horizonY + this.horizonSpriteOffset;
        this.fog.width = width;
        this.fog.height = 120;
    }

    _updateShootingStars(now, width, horizonY, nightAlpha) {
        // Neue Sternschnuppe spawnen, nur wenn es dunkel genug ist
        if (now >= this._nextShootingStarAt && nightAlpha > 0.6) {
            this._spawnShootingStar(width, horizonY);
            this._nextShootingStarAt = now + this._randomShootingStarDelay();
        }

        for (let i = this._activeShootingStars.length - 1; i >= 0; i--) {
            const s = this._activeShootingStars[i];
            const t = (now - s.startedAt) / s.duration;
            if (t >= 1) {
                s.gfx.destroy();
                this._activeShootingStars.splice(i, 1);
                continue;
            }
            const eased = t; // linear reicht fuer den kurzen, schnellen Streak
            const x = s.fromX + (s.toX - s.fromX) * eased;
            const y = s.fromY + (s.toY - s.fromY) * eased;
            const fadeOut = 1 - Math.pow(t, 2); // schneller Fade zum Ende hin

            s.gfx.clear();
            s.gfx
                .moveTo(x - s.dirX * s.trailLen, y - s.dirY * s.trailLen)
                .lineTo(x, y)
                .stroke({ width: 2, color: 0xffffff, alpha: fadeOut * nightAlpha });
        }
    }

    _spawnShootingStar(width, horizonY) {
        const startX = Math.random() * width * 0.7;
        const startY = Math.random() * horizonY * 0.4;
        const angle = Math.PI * 0.22 + Math.random() * 0.25; // schraeg nach unten-rechts
        const dist = width * (0.15 + Math.random() * 0.15);
        const dirX = Math.cos(angle), dirY = Math.sin(angle);

        const gfx = new PIXI.Graphics();
        this.shootingStarLayer.addChild(gfx);

        this._activeShootingStars.push({
            gfx,
            fromX: startX, fromY: startY,
            toX: startX + dirX * dist, toY: startY + dirY * dist,
            dirX, dirY,
            trailLen: width * 0.05,
            startedAt: performance.now(),
            duration: 500 + Math.random() * 400,
        });
    }

    destroy() {
        this.skyDaySprite.destroy();
        this.skyNightSprite.destroy();
        this.sunsetGlow.destroy();
        this.sun.destroy();
        this.moon.destroy();
        this.fog.destroy();
        for (const s of this.stars) s.gfx.destroy();
        this.starLayer.destroy();
        for (const s of this._activeShootingStars) s.gfx.destroy();
        this.shootingStarLayer.destroy();
        for (const l of this.mountainLayers) l.container.destroy({ children: true });
    }
}