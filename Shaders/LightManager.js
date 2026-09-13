import * as PIXI from 'pixi.js';


// Zentrale Verwaltung dynamischer Punktlichter (Scheinwerfer etc.) und
// welche Objekte davon beleuchtet werden. Objekte (ModelInstance) melden
// sich beim Erzeugen/Zerstoeren an/ab, Lichter werden pro Frame aktualisiert
// und nur an Objekte innerhalb einer Reichweite verteilt - vermeidet, dass
// bei hunderten aktiven Instanzen (ObjectManager streamt viele Baeume/
// Haeuser) jedes einzelne jeden Frame unnoetig einen Shader-Uniform-Write
// bekommt.
export class LightManager {
    constructor(app, camera, debugLayer = null) {
        this.app = app;
        this.camera = camera;
        this.debugLayer = debugLayer;

        this.lights = [];       // aktuelle Lichtquellen, siehe setLights()
        this.instances = new Set(); // alle registrierten ModelInstance-Objekte
        this.maxRangeZ = 900;   // Z-Distanz, ab der ein Objekt garantiert nicht mehr beleuchtet wird
        this.maxRangeSq = 1400 * 1400; // 2D-Radius (X/Z) fuer den Fein-Check

        this.debugGraphics = null;
        if (this.debugLayer) {
            this.debugGraphics = new PIXI.Graphics();
            this.debugLayer.addChild(this.debugGraphics);
        }
    }

    register(instance) {
        this.instances.add(instance);
    }

    unregister(instance) {
        this.instances.delete(instance);
    }

    // lights: Array von { pos, color, intensity } - wird i.d.R. jeden Frame
    // von DriveScene aus neu gesetzt (Scheinwerferposition aendert sich
    // staendig)
    setLights(lights) {
        this.lights = lights;
    }

    // Muss einmal pro Frame aufgerufen werden. camZ dient als grober
    // Vor-Filter (Z-Distanz), um bei vielen Instanzen nicht jedes Mal den
    // vollen 2D-Abstand berechnen zu muessen.
    update(camZ) {
        this._updateDebugVisuals();

        if (this.lights.length === 0) return;

        // Referenzpunkt fuer den Vor-Filter: Mittelwert aller Lichtpositionen
        // reicht, da Scheinwerfer eng beieinander liegen
        let refX = 0, refZ = 0;
        for (const l of this.lights) { refX += l.pos.x; refZ += l.pos.z; }
        refX /= this.lights.length;
        refZ /= this.lights.length;

        for (const instance of this.instances) {
            const dz = instance.pos3d.z - refZ;
            if (Math.abs(dz) > this.maxRangeZ) {
                // ausserhalb Reichweite -> explizit "aus" setzen, falls es
                // vorher beleuchtet war (sonst bleibt ein altes Licht haften,
                // wenn das Objekt aus der Reichweite raus-, aber nicht
                // entladen wurde)
                if (instance._litByLightManager) {
                    instance.setPointLights([]);
                    instance._litByLightManager = false;
                }
                continue;
            }

            const dx = instance.pos3d.x - refX;
            const distSq = dx * dx + dz * dz;
            if (distSq > this.maxRangeSq) {
                if (instance._litByLightManager) {
                    instance.setPointLights([]);
                    instance._litByLightManager = false;
                }
                continue;
            }

            instance.setPointLights(this.lights);
            instance._litByLightManager = true;
        }
    }

    _updateDebugVisuals() {
        if (!this.debugGraphics) return;
        this.debugGraphics.clear();

        if (!window.DEBUG.enabled || !window.DEBUG.showLights || this.lights.length === 0) return;

        const w = this.app.renderer.width;
        const h = this.app.renderer.height;

        for (const light of this.lights) {
            const p = this.camera.project(light.pos, w, h);
            if (!p) continue;

            this.debugGraphics
                .circle(p.x, p.y, 6)
                .fill({ color: 0x3399ff, alpha: 0.85 })
                .circle(p.x, p.y, 6)
                .stroke({ width: 1, color: 0xffffff, alpha: 0.9 });
        }
    }

    clear() {
        this.instances.clear();
        this.lights = [];
        if (this.debugGraphics) {
            this.debugGraphics.clear();
            this.debugGraphics.destroy();
            this.debugLayer?.removeChild(this.debugGraphics);
            this.debugGraphics = null;
        }
    }
}