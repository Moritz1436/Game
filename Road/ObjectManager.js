import { RoadManager } from "./RoadManager.js";
import { ModelInstance } from "../Models/ModelInstance.js";
import { rotationY, IDENTITY_MAT3 } from "../World3D/Utils/Mat3Utils.js";

function clamp01(v) { return Math.max(0, Math.min(1, v)); }
function smoothstep(edge0, edge1, x) {
    const t = clamp01((x - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
}

//manages trees, stones, grass etc.
// just dont drive through objects, could get ugly lol
export class ObjectManager {

    constructor(app, camera, layer, distance, assets, lanes) {
 
        this.app = app;
        this.camera = camera;
        this.layer = layer;
        this.layer.sortableChildren = true;
        this.assets = assets;
        this.lanes = lanes;
 
        this.chunkLength = 500;
 
        this.distance = distance;
 
        // Loading distance in chunks in z direction
        this.frontChunks = Math.ceil(camera.far / this.chunkLength);
        this.backChunks = 0;
 
        //loading distance in world units in x direction
        this.loadingDistanceX = 300;
 
        this.objectsPerChunkPerSide = 35;
 
        this.loadedChunks = new Map();
        this.creationQueue = [];
        this.maxCreationsPerFrame = 20;
 
        this.roadHalf = RoadManager.computeTotalWidth(this.lanes) * 0.5;
        this.forestWallDistanceX = this.loadingDistanceX + 50;
        this.forestScale = 37.5;
        this.maxX = this.assets.forest.low[0].size.x * this.forestScale * 0.5 + this.forestWallDistanceX;
 
        this.guardRailScale = 9;
        this.guardRailOffsetX = 30;      // Abstand Fahrbahnrand -> Guard-Rail-Pivot
        this.guardRailClearanceX = 40;   // Abstand Fahrbahnrand -> restliche Objekte (muss > guardRailOffsetX + halbe Rail-Breite sein)
 
        this.cityStartFraction = 0.80;
        this.cityStartZ = this.distance * this.cityStartFraction;
        this.cityEndZ = this.distance + camera.far;
 
        // Uebergangszone Wald -> Stadt (Dichte), unabhaengig von cityT (Haus-Groesse)
        this.wallFadeZoneLength = 700;   // vorher 3000 - deutlich sanfter
        this.wallDisappearAt = 0.9;
        this.citySideOffsetZ = {
            left: 0,
            right: (Math.random() - 0.5) * this.wallFadeZoneLength * 0.6,
        };

        this.treeRowSize = 80;
        this.treeRowStart = this.guardRailClearanceX;

        this.treeMarginNear = 5;   // Abstand von der Straße (damit Objekte nicht auf der Straße stehen)
        this.treeMarginFar = 35;    // Abstand von den Häusern (damit Objekte nicht in Häusern stehen)
 
        this.houseRowDistanceX = this.guardRailClearanceX + this.treeRowSize; // naeher an der Strasse
        this.houseRowSpacingX = 250;
        this.houseRowCount = 2;
        this.houseGapZMin = 40;
        this.houseGapZMax = 100;
        // Puffer links/rechts der Haus-Zone, in dem KEINE normale
        // Wald-Vegetation (Baeume/Buesche/Gras/Steine) mehr gespawnt wird -
        // verhindert, dass Baeume in Haeusern "stehen".
        this._houseCursorZ = { left: [], right: [] };
 
        this.maxChunk = Math.ceil(this.cityEndZ / this.chunkLength);
    }
 
    update() {
        const currentChunk = Math.floor(
            -this.camera.pos3d.z / this.chunkLength
        );
        this._currentChunkForPriority = currentChunk;
 
        // load chunks
        for (
            let i = currentChunk - this.backChunks;
            i <= currentChunk + this.frontChunks;
            i++
        ) {
 
            if (i < 0 || i >= this.maxChunk) {
                continue;
            }
 
            const wantedLOD = this.getLOD(i - currentChunk);
 
            const chunk = this.loadedChunks.get(i);
 
            if (!chunk) {
                this.loadChunk(i, wantedLOD);
            }
            else if (chunk.lod !== wantedLOD) {
                this.destroyInstances(chunk);
                chunk.lod = wantedLOD;
                this.queueInstanceCreation(chunk);
            }
        }
 
        // remove chunks
        for (const id of this.loadedChunks.keys()) {
            if (
                id < currentChunk - this.backChunks ||
                id > currentChunk + this.frontChunks
            ) {
                this.unloadChunk(id);
            }
        }
 
        this.processCreationQueue();
    }
 
    queueInstanceCreation(chunk) {
        for (const obj of chunk.objects) {
            this.creationQueue.push({ chunk, obj });
        }
    }
 
    processCreationQueue() {
        if (this.creationQueue.length === 0) return;
 
        //sort list for priority (= closest to cam gets highest priority)
        this.creationQueue.sort((a, b) => {
            const distA = Math.abs(a.chunk.id - this._currentChunkForPriority);
            const distB = Math.abs(b.chunk.id - this._currentChunkForPriority);
            return distA - distB;
        });
 
        let count = 0;
        while (count < this.maxCreationsPerFrame && this.creationQueue.length > 0) {
            const { chunk, obj } = this.creationQueue.shift();
 
            if (!this.loadedChunks.has(chunk.id)) continue;
 
            let asset;
            if (obj.type === 'houses') {
                asset = this.assets.houses[obj.sizeTier][obj.variant];
            } else {
                const lod = this.getObjectLOD(obj.type, chunk.lod);
                if (lod === null) { obj.instance = null; count++; continue; }
                asset = this.assets[obj.type][chunk.lod][obj.variant];
            }
 
            // obj.rotation ist bei Nicht-Haus-Objekten undefined -> ModelInstance
            // faellt dann auf die Standard-Rotation zurueck (wie vorher).
            obj.instance = new ModelInstance(asset, this.layer, obj.pos3d, obj.scale, obj.rotation);
            count++;
        }
    }
 
    //gets id of a random asset
    randomVariant(type) {
        return Math.floor(
            Math.random() *
            this.assets[type].high.length
        );
    }
 
    ///@param t - how far the objects center will be from the road, closer -> small objects more likely, 0=close...1=far
    // near road:
    // trees 40%
    // bushes 20%
    // grass 30%
    // rocks 10%
    //
    // far away:
    // trees 85%
    // bushes 10%
    // grass 3%
    // rocks 2%
    chooseType(t) {
        const treeChance = 0.40 + t * (0.85 - 0.40);
        const bushChance = treeChance + (0.20 + t * (0.10 - 0.20));
        const grassChance = bushChance + (0.30 + t * (0.03 - 0.30));
 
        const r = Math.random();
        if (r < treeChance)
            return "trees";
 
        if (r < bushChance)
            return "bushes";
 
        if (r < grassChance)
            return "grass";
 
        return "rocks";
    }
 
    ///@brief liefert einen zufaelligen t-Wert (Anteil von loadingDistanceX,
    /// 0 = an der Strasse, 1 = ganz aussen). Optional eingeschraenkt auf
    /// einen Bereich [min, max], z.B. um die Haus-Zone auszusparen.
    randomT(tRange) {
        if (!tRange) return Math.random();
        const [min, max] = tRange;
        return min + Math.random() * (max - min);
    }
 
    ///@brief creates a random pseudo object of a random type at a random position inside a chunk
    ///@param id - chunk id
    ///@param isLeft - wether the object is to be created on the left side, otherwise on the right
    createObject(id, isLeft, inCityZone) {
        const t = Math.random();
        const type = this.chooseType(t);
        const distToRoadX = inCityZone ? t * this.treeRowSize : t * this.loadingDistanceX;
        const variant = this.randomVariant(type);
 
        let scale;
 
        switch(type) {
 
            case "trees":
                scale = 30 + Math.random() * 15;
                break;
 
            case "rocks":
                scale = 25 + Math.random() * 10;
                break;
 
            case "grass":
                scale = 80 + Math.random() * 40;
                break;
 
            case "bushes":
                scale = 50 + Math.random() * 20;
                break;
        }
 
        const asset = this.assets[type].high[variant];
 
        const halfSize = asset.size.x * scale * 0.5;
 
        const x = isLeft
            ? -this.roadHalf - this.guardRailClearanceX - halfSize - distToRoadX
            :  this.roadHalf + this.guardRailClearanceX + halfSize + distToRoadX;
 
        const startZ = -id * this.chunkLength;
 
        return {
            type,
            variant,
            pos3d: {
                x,
                y: 0,
                z: startZ - Math.random() * this.chunkLength
            },
            scale,
            instance: null
        };
    }

    ///@brief waehlt Groessen-Tier + Variante, berechnet Laenge entlang der
    /// Strasse (Packing) und Abstand von der Strasse aus dem tatsaechlichen
    /// Asset. Haeuser zeigen standardmaessig mit ihrer Front in Richtung -z
    /// (also entlang der Strasse) - wir drehen sie 90°, damit die Front zur
    /// Strasse zeigt. Dadurch aendern sich die relevanten Achsen:
    ///  - Laenge entlang der Strasse (Welt-Z, fuer das Packing)  = asset.size.x
    ///  - Abstand von der Strasse   (Welt-X, Reihen-Versatz)     = asset.size.z (Haustiefe)
    /// Falls Haeuser nach dem Testen seitenverkehrt/falsch rum stehen, hier
    /// einfach das Vorzeichen von rotY tauschen.
    createHouseAt(id, isLeft, progressT, row) {
        const r = Math.random();
        let sizeTier;
        let scale;
        if (progressT < 0.2 && r > progressT / 0.75) {
            scale = 25 + Math.random() * 5;
            sizeTier = 'low';
        } else if (progressT < 0.5 && r > (progressT - 0.35) / 0.55) {
            scale = 15 + Math.random() * 5;
            sizeTier = 'medium';
        } else {
            scale = 10 + Math.random() * 5;
            sizeTier = 'high';
        }
 
        const variants = this.assets.houses[sizeTier];
        const variant = Math.floor(Math.random() * variants.length);
        const asset = variants[variant];
 
        const rotY = isLeft ? -Math.PI / 2 : Math.PI / 2;
        const rotation = rotationY(rotY);
 
        const lengthAlongRoad = asset.size.x * scale;
        const depthFromRoad = (asset.size.z) * scale;
 
        const rowOffset = this.houseRowDistanceX + row * this.houseRowSpacingX;
 
        const x = isLeft
            ? -this.roadHalf - rowOffset - depthFromRoad * 0.5
            :  this.roadHalf + rowOffset + depthFromRoad * 0.5;
 
        // kleiner, leicht zufaelliger Abstand zum naechsten Haus in der Reihe,
        // damit sie nicht mehr nahtlos/überlappend aneinanderkleben
        const gap = this.houseGapZMin + Math.random() * (this.houseGapZMax - this.houseGapZMin);
 
        return {
            lengthAlongRoad,
            gap,
            obj: {
                type: 'houses',
                sizeTier,
                variant,
                pos3d: { x, y: 0, z: 0 }, // wird gleich von placeHouseRow gesetzt
                scale,
                rotation,
                instance: null
            }
        };
    }

    ///@brief Packt eine Haeuserreihe direkt aneinander (echte Breite pro Haus
    /// plus kleinem Gap, kein Slot-Raster). Der Cursor lebt auf der Instanz
    /// und laeuft ueber Chunk-Grenzen kontinuierlich weiter -> garantiert
    /// lueckenlos (bis auf den gewollten Gap) und ueberlappungsfrei, solange
    /// Chunks aufsteigend geladen werden (gegeben durch backChunks = 0).
    placeHouseRow(id, isLeft, progressT, row, objects) {
        const chunkEndZ = -id * this.chunkLength - this.chunkLength;
        const sideKey = isLeft ? 'left' : 'right';
 
        if (this._houseCursorZ[sideKey][row] === undefined) {
            // Reihe wird zum ersten Mal aktiv - am Chunk-Anfang beginnen
            this._houseCursorZ[sideKey][row] = -id * this.chunkLength;
        }
 
        while (this._houseCursorZ[sideKey][row] > chunkEndZ) {
            const { lengthAlongRoad, gap, obj } = this.createHouseAt(id, isLeft, progressT, row);
            obj.pos3d.z = this._houseCursorZ[sideKey][row] - lengthAlongRoad * 0.5;
            objects.push(obj);
            this._houseCursorZ[sideKey][row] -= (lengthAlongRoad + gap);
        }
    }

    createGuardRailSegments(id, isLeft) {
        const asset = this.assets.guard_rail?.low?.[0];
        if (!asset) {
            console.warn(`ObjectManager: assets.guard_rail.low[0] nicht gefunden - Guard-Rail wird übersprungen.`);
            return [];
        }
 
        const x = isLeft
            ? -this.roadHalf - this.guardRailOffsetX
            :  this.roadHalf + this.guardRailOffsetX;
 
        const rotation = isLeft ? IDENTITY_MAT3 : rotationY(Math.PI);
 
        const segLength = asset.size.z * this.guardRailScale;
 
        const iStart = Math.ceil(id * this.chunkLength / segLength);
        const iEnd = Math.ceil((id + 1) * this.chunkLength / segLength) - 1;
 
        const instances = [];
        for (let i = iStart; i <= iEnd; i++) {
            const zNear = -i * segLength;       // nahe Kante des Intervalls (Welt-Raster)
            const zFar = zNear - segLength;      // ferne Kante (Richtung Horizont)
 
            const z = isLeft ? zNear : zFar;
 
            instances.push(
                new ModelInstance(asset, this.layer, { x, y: 0, z }, this.guardRailScale, rotation)
            );
        }
 
        return instances;
    }

    getObjectLOD(type, chunkLOD) {
        switch (type) {

            case "trees":
                // trees: high / medium / low
                return chunkLOD;

            case "bushes":
            case "rocks":
                // bushes + rocks: only high + medium
                if (chunkLOD === "low")
                    return null;

                return chunkLOD;

            case "grass":
                // grass: only high
                if (chunkLOD !== "high")
                    return null;

                return "high";
        }

        return null;
    }

    getLOD(chunkOffset) {

        const d = Math.abs(chunkOffset);

        if (d <= 2)
            return "high";

        if (d <= 5)
            return "medium";

        return "low";
    }

    destroyInstances(chunk) {
        for (const obj of chunk.objects) {
            if (obj.instance) {
                obj.instance.destroy();
                obj.instance = null;
            }
        }

        this.creationQueue = this.creationQueue.filter(entry => entry.chunk !== chunk);
    }

    createForestWall(id, isLeft) {
        const asset = this.assets.forest.low[0];
        if (!asset) {
            console.warn(`ObjectManager: assets.forest.low[0] nicht gefunden - Forest-Wall wird übersprungen.`);
            return null;
        }

        const x = isLeft
            ? -this.roadHalf - this.forestWallDistanceX
            :  this.roadHalf + this.forestWallDistanceX;

        const z = -id * this.chunkLength - this.chunkLength * 0.5; // Chunk-Mitte

        const rotation = isLeft ? IDENTITY_MAT3 : rotationY(Math.PI);

        return new ModelInstance(asset, this.layer, { x, y: 0, z }, this.forestScale, rotation);
    }

    computeTransitionT(chunkZ, isLeft) {
        const sideOffset = isLeft ? this.citySideOffsetZ.left : this.citySideOffsetZ.right;
        return smoothstep(this.cityStartZ + sideOffset, this.cityStartZ + sideOffset + this.wallFadeZoneLength, chunkZ);
    }

    loadChunk(id, lod) {
        const chunkZ = id * this.chunkLength + this.chunkLength * 0.5;
        const cityT = clamp01((chunkZ - this.cityStartZ) / (this.cityEndZ - this.cityStartZ));

        const objects = [];
        let forestWallLeft = null;
        let forestWallRight = null;
        const transitionBySide = {};

        // Definiere die Margins
        const treeMarginNear = 3;   // Abstand von der Straße
        const treeMarginFar = 8;    // Abstand von den Häusern

        for (const isLeft of [true, false]) {
            const sideKey = isLeft ? 'left' : 'right';
            const transitionT = this.computeTransitionT(chunkZ, isLeft);
            transitionBySide[sideKey] = transitionT;

            const inCityZone = transitionT > 0;

            // --- BÄUME SPAWNEN ---
            let treeStartT, treeEndT;
            
            if (inCityZone) {
                // STADT: Von der Straße (mit kleinem Abstand) bis kurz vor die Häuser
                // Der gesamte Bereich wird befüllt (inklusive guardRailClearance!)
                const treeZoneStart = 0 + treeMarginNear;
                const treeZoneEnd = this.guardRailClearanceX + this.treeRowSize - treeMarginFar;
                treeStartT = clamp01(treeZoneStart / this.loadingDistanceX);
                treeEndT = clamp01(treeZoneEnd / this.loadingDistanceX);
            } else {
                // WALD: Nur außerhalb des Guard Rail Bereichs
                // Der Bereich zwischen Straße und Guard Rail bleibt leer
                const treeZoneStart = this.guardRailClearanceX + treeMarginNear;
                const treeZoneEnd = this.loadingDistanceX;
                treeStartT = clamp01(treeZoneStart / this.loadingDistanceX);
                treeEndT = clamp01(treeZoneEnd / this.loadingDistanceX);
            }
            
            // Anzahl der Objekte
            const objCount = inCityZone 
                ? Math.floor(Math.random() * this.objectsPerChunkPerSide * 0.1)  // Stadt: etwas weniger
                : this.objectsPerChunkPerSide;  // Wald: normale Dichte

            // Nur spawnen, wenn der Bereich gültig ist
            if (treeStartT < treeEndT) {
                for (let i = 0; i < objCount; i++) {
                    // Zufällige Position innerhalb des gültigen Bereichs
                    const t = treeStartT + Math.random() * (treeEndT - treeStartT);
                    
                    const type = this.chooseType(t);
                    const distToRoadX = t * this.loadingDistanceX;
                    const variant = this.randomVariant(type);

                    let scale;
                    switch(type) {
                        case "trees": scale = 30 + Math.random() * 15; break;
                        case "rocks": scale = 25 + Math.random() * 10; break;
                        case "grass": scale = 80 + Math.random() * 40; break;
                        case "bushes": scale = 50 + Math.random() * 20; break;
                    }

                    const asset = this.assets[type].high[variant];
                    const halfSize = asset.size.x * scale * 0.5;

                    // In der Stadt: Kein guardRailClearance Abzug!
                    // Im Wald: Mit guardRailClearance Abzug (weil die Guard Rail da ist)
                    let x;
                    if (inCityZone) {
                        // Stadt: Direkt an der Straße (mit Abstand)
                        x = isLeft
                            ? -this.roadHalf - halfSize - distToRoadX
                            :  this.roadHalf + halfSize + distToRoadX;
                    } else {
                        // Wald: Hinter der Guard Rail
                        x = isLeft
                            ? -this.roadHalf - this.guardRailClearanceX - halfSize - distToRoadX
                            :  this.roadHalf + this.guardRailClearanceX + halfSize + distToRoadX;
                    }

                    const startZ = -id * this.chunkLength;

                    objects.push({
                        type,
                        variant,
                        pos3d: {
                            x,
                            y: 0,
                            z: startZ - Math.random() * this.chunkLength
                        },
                        scale,
                        instance: null
                    });
                }
            }

            // Waldwand (unverändert)
            const wallPresent = transitionT < this.wallDisappearAt;
            if (wallPresent) {
                const wall = this.createForestWall(id, isLeft);
                if (isLeft) forestWallLeft = wall; else forestWallRight = wall;
            }

            // Häuser spawnen (unverändert)
            for (let row = 0; row < this.houseRowCount; row++) {
                const rowThreshold = row / this.houseRowCount;
                if (transitionT > rowThreshold) {
                    this.placeHouseRow(id, isLeft, cityT, row, objects);
                }
            }
        }

        // Guard-Rails: NUR außerhalb der Stadt (wenn transitionT <= 0)
        const guardRailLeft = transitionBySide.left <= 0
            ? this.createGuardRailSegments(id, true) : [];
        const guardRailRight = transitionBySide.right <= 0
            ? this.createGuardRailSegments(id, false) : [];

        const chunk = {
            id, lod, objects,
            forestWallLeft, forestWallRight,
            guardRailLeft, guardRailRight
        };
        this.loadedChunks.set(id, chunk);
        this.queueInstanceCreation(chunk);
    }

    unloadChunk(id) {
        const chunk = this.loadedChunks.get(id);
        if (!chunk) return;

        this.destroyInstances(chunk);

        if (chunk.forestWallLeft) chunk.forestWallLeft.destroy();
        if (chunk.forestWallRight) chunk.forestWallRight.destroy();

        if (chunk.guardRailLeft) for (const inst of chunk.guardRailLeft) inst.destroy();
        if (chunk.guardRailRight) for (const inst of chunk.guardRailRight) inst.destroy();

        this.loadedChunks.delete(id);
    }

    destroy() {
        for (const id of this.loadedChunks.keys()) {
            this.unloadChunk(id);
        }

        this.loadedChunks.clear();
        this.creationQueue.length = 0;
    }
}