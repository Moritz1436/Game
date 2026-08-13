import * as PIXI from "pixi.js";


export class WindEffect extends PIXI.Container {

    ///@param app - PixiJs Application
    ///@param camera - Camera Instanz (nutzt camera.project)
    ///@param car - CarPieceInstance; braucht .pos3d und .getWorldAABB()
    ///@param options - { count, baseColor, boostColor, minLife, maxLife, trailLength }
    constructor(app, camera, car, options = {}) {
        super();

        this.app = app;
        this.camera = camera;
        this.car = car;

        this.count = options.count ?? 26;
        this.baseColor = options.baseColor ?? 0xffffff;
        this.boostColor = options.boostColor ?? 0xffd700; // gold
        this.minLife = options.minLife ?? 0.5;
        this.maxLife = options.maxLife ?? 1.0;
        this.trailLength = options.trailLength ?? 10; // Anzahl gespeicherter Punkte pro Strich

        this.graphics = new PIXI.Graphics();
        this.graphics.blendMode = "add";
        this.addChild(this.graphics);

        this._colorLerp = 0;

        this.particles = [];
        for (let i = 0; i < this.count; i++) {
            this.particles.push(this._spawnParticle());
        }
    }

    _spawnParticle() {
        const bounds = this.car.getWorldAABB();
        const carPos = this.car.pos3d;

        const width = bounds.max.x - bounds.min.x;
        const height = bounds.max.y - bounds.min.y;
        const length = bounds.max.z - bounds.min.z;

        const side = Math.random() < 0.5 ? -1 : 1;

        const pos3d = {
            x: carPos.x + side * width * (0.3 + Math.random() * 0.3),
            y: bounds.min.y + Math.random() * height * 0.8,
            z: carPos.z + (Math.random() - 0.2) * length,
        };

        return {
            pos3d,
            history: [{ ...pos3d }], // world-space Historie, wird pro Frame projiziert
            side,
            speedX: side * (25 + Math.random() * 25),   // stärkere Ausdrift nach außen
            speedZBase: 140 + Math.random() * 100,        // deutlich schneller nach hinten
            age: 0,
            life: this.minLife + Math.random() * (this.maxLife - this.minLife),
        };
    }

    ///@param dt - delta seconds
    ///@param speedFactor - 0..1, normalisiert von currentSpeed
    ///@param boosting - bool
    update(dt, speedFactor, boosting) {
        const targetLerp = boosting ? 1 : 0;
        this._colorLerp += (targetLerp - this._colorLerp) * Math.min(1, dt * 6);
        const color = this._lerpColor(this.baseColor, this.boostColor, this._colorLerp);

        const w = this.app.renderer.width;
        const h = this.app.renderer.height;
        const intensity = 0.4 + speedFactor * (1 + this._colorLerp * 0.7);

        this.graphics.clear();

        for (const p of this.particles) {
            p.pos3d.x += p.speedX * intensity * dt;
            p.pos3d.z += p.speedZBase * intensity * dt;
            p.age += dt;

            p.history.push({ ...p.pos3d });
            if (p.history.length > this.trailLength) p.history.shift();

            if (p.age >= p.life) {
                Object.assign(p, this._spawnParticle());
                continue;
            }

            // Historie -> Screen-Punkte projizieren, dabei ungültige (hinter Kamera) rausfiltern
            const screenPts = [];
            for (const pos of p.history) {
                const s = this.camera.project(pos, w, h);
                if (s) screenPts.push(s);
            }
            if (screenPts.length < 2) continue;

            const lifeT = p.age / p.life;
            const globalAlpha = Math.sin(Math.min(1, lifeT) * Math.PI) * Math.min(1, intensity);
            if (globalAlpha <= 0.02) continue;

            // Segmentweise zeichnen mit Taper: Kopf (neuestes Segment) dick+hell, Schweif dünn+blass
            for (let i = 1; i < screenPts.length; i++) {
                const t = i / (screenPts.length - 1); // 0 = Schweif, 1 = Kopf
                const segAlpha = globalAlpha * t;
                const segWidth = (0.8 + intensity * 2.2) * t;

                if (segAlpha <= 0.02) continue;

                this.graphics
                    .moveTo(screenPts[i - 1].x, screenPts[i - 1].y)
                    .lineTo(screenPts[i].x, screenPts[i].y)
                    .stroke({ width: segWidth, color, alpha: segAlpha });
            }
        }
    }

    _lerpColor(c1, c2, t) {
        const r1 = (c1 >> 16) & 0xff, g1 = (c1 >> 8) & 0xff, b1 = c1 & 0xff;
        const r2 = (c2 >> 16) & 0xff, g2 = (c2 >> 8) & 0xff, b2 = c2 & 0xff;
        return (Math.round(r1 + (r2 - r1) * t) << 16)
             | (Math.round(g1 + (g2 - g1) * t) << 8)
             | Math.round(b1 + (b2 - b1) * t);
    }

    destroy() {
        this.graphics.destroy();
        super.destroy();
    }
}