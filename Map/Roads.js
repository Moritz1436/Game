import { fbm, clampInt, FULL_W, FULL_H, TERRAIN_W, TERRAIN_H, clamp01 } from "./Utils.js";



class MinHeap {
    constructor() { this.a = []; }
    push(item, priority) {
        this.a.push([priority, item]);
        let i = this.a.length - 1;
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (this.a[p][0] <= this.a[i][0]) break;
            [this.a[p], this.a[i]] = [this.a[i], this.a[p]];
            i = p;
        }
    }
    pop() {
        const top = this.a[0];
        const last = this.a.pop();
        if (this.a.length) {
            this.a[0] = last;
            let i = 0;
            while (true) {
                const l = i * 2 + 1, r = i * 2 + 2;
                let smallest = i;
                if (l < this.a.length && this.a[l][0] < this.a[smallest][0]) smallest = l;
                if (r < this.a.length && this.a[r][0] < this.a[smallest][0]) smallest = r;
                if (smallest === i) break;
                [this.a[smallest], this.a[i]] = [this.a[i], this.a[smallest]];
                i = smallest;
            }
        }
        return top;
    }
    isEmpty() { return this.a.length === 0; }
}
 
function buildRoadCostGrid(world, gw, gh) {
    const cost = new Float32Array(gw * gh);
    for (let gy = 0; gy < gh; gy++) {
        for (let gx = 0; gx < gw; gx++) {
            const px = (gx + 0.5) / gw * FULL_W, py = (gy + 0.5) / gh * FULL_H;
            const info = world.classify(px, py);
            let c;
            if (info.type === 'water') {
                c = Infinity; // Strassen koennen nicht durchs Wasser
            } else if (info.type === 'mountain') {
                // nur die hohen/steilen Kernzonen sind unpassierbar - sanfte
                // Haenge bleiben begehbar, aber weiterhin teuer
                c = info.depthT > 0.55 ? Infinity : (1.2 + info.mountainStrength * 1.5);
            } else {
                c = 1.0;
            }

            if (c !== Infinity) {
                const wobble = fbm(world.hRoad, gx, gy, 3, 32, 0.5, 2.0);
                c += wobble * 0.4;
            }

            cost[gy * gw + gx] = c;
        }
    }
    return cost;
}
 
// NEU: Heuristik-Gewicht von 0.9 auf 0.55 gesenkt - vorher war die Suche so
// zielgerichtet/greedy, dass sie das (jetzt vorhandene) Kostenrauschen
// weitgehend ignorierte und trotzdem fast schnurgerade lief. Mit
// niedrigerem Gewicht folgt A* dem Kostenfeld tatsaechlich, statt nur grob
// in Zielrichtung zu drängen.
function astarPath(cost, gw, gh, sx, sy, tx, ty) {
    const idx = (x, y) => y * gw + x;
    const dist = new Float32Array(gw * gh).fill(Infinity);
    const prev = new Int32Array(gw * gh).fill(-1);
    const visited = new Uint8Array(gw * gh);
    const startIdx = idx(sx, sy);
    dist[startIdx] = 0;
    const heap = new MinHeap();
    const heuristic = (x, y) => Math.hypot(x - tx, y - ty);
    heap.push(startIdx, heuristic(sx, sy));
    const neighbors = [[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,Math.SQRT2],[1,-1,Math.SQRT2],[-1,1,Math.SQRT2],[-1,-1,Math.SQRT2]];
    const targetIdx = idx(tx, ty);
    while (!heap.isEmpty()) {
        const [, curIdx] = heap.pop();
        if (visited[curIdx]) continue;
        visited[curIdx] = 1;
        if (curIdx === targetIdx) break;
        const cx = curIdx % gw, cy = (curIdx / gw) | 0;
        for (const [dx, dy, base] of neighbors) {
            const nx = cx + dx, ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
            const nIdx = idx(nx, ny);
            if (visited[nIdx]) continue;
            const stepCost = base * (cost[nIdx] + cost[curIdx]) * 0.5;
            const nd = dist[curIdx] + stepCost;
            if (nd < dist[nIdx]) {
                dist[nIdx] = nd;
                prev[nIdx] = curIdx;
                heap.push(nIdx, nd + heuristic(nx, ny) * 0.72);
            }
        }
    }
    if (dist[targetIdx] === Infinity) return null;
    const path = [];
    let cur = targetIdx;
    while (cur !== -1) {
        path.push([cur % gw, (cur / gw) | 0]);
        cur = prev[cur];
    }
    path.reverse();
    return path;
}

function removeSelfLoops(pts, minGapIndices, threshold) {
    if (pts.length < 3) return pts;
    const out = [pts[0]];
    let i = 0;
    const thresholdSq = threshold * threshold;
    while (i < pts.length - 1) {
        let jumpTo = i + 1;
        for (let j = pts.length - 1; j > i + minGapIndices; j--) {
            const dx = pts[j].x - pts[i].x, dy = pts[j].y - pts[i].y;
            if (dx * dx + dy * dy < thresholdSq) {
                jumpTo = j; // spaetestmoeglicher Ruecksprungpunkt = ganze Schleife weg
                break;
            }
        }
        out.push(pts[jumpTo]);
        i = jumpTo;
    }
    return out;
}
 
function buildMST(cities) {
    const n = cities.length;
    if (n <= 1) return [];
    const inTree = new Array(n).fill(false);
    inTree[0] = true;
    const edges = [];
    for (let e = 0; e < n - 1; e++) {
        let best = null, bestD = Infinity;
        for (let i = 0; i < n; i++) if (inTree[i]) {
            for (let j = 0; j < n; j++) if (!inTree[j]) {
                const d = Math.hypot(cities[i].cx - cities[j].cx, cities[i].cy - cities[j].cy);
                if (d < bestD) { bestD = d; best = [i, j]; }
            }
        }
        if (!best) break;
        inTree[best[1]] = true;
        edges.push(best);
    }
    return edges;
}
 
function simplifyPath(path, step) {
    const out = [];
    for (let i = 0; i < path.length; i += step) out.push(path[i]);
    if (out[out.length - 1] !== path[path.length - 1]) out.push(path[path.length - 1]);
    return out;
}
 
function chaikinSmooth(points, iterations) {
    let pts = points;
    for (let it = 0; it < iterations; it++) {
        const newPts = [pts[0]];
        for (let i = 0; i < pts.length - 1; i++) {
            const p0 = pts[i], p1 = pts[i + 1];
            newPts.push({ x: p0.x * 0.75 + p1.x * 0.25, y: p0.y * 0.75 + p1.y * 0.25 });
            newPts.push({ x: p0.x * 0.25 + p1.x * 0.75, y: p0.y * 0.25 + p1.y * 0.75 });
        }
        newPts.push(pts[pts.length - 1]);
        pts = newPts;
    }
    return pts;
}
 
// verschiebt Zwischenpunkte eines Polygonzugs leicht senkrecht zur
// Laufrichtung anhand eines glatten Rauschfelds - macht A*-Pfade (die auf
// einem Raster sonst wie gerade Diagonalen aussehen) organisch verschwungen.
// NEU: noiseScale ist jetzt Parameter statt fest verdrahtet (260), damit
// computeCurvedRoadBetweenCities zwei Durchgaenge mit unterschiedlicher
// Wellenlaenge fahren kann (grosse Schwuenge + feines Wackeln).
function meanderPath(pts, hashFn, amplitude, noiseScale) {
    if (pts.length < 3) return pts;
    const out = pts.map(p => ({ x: p.x, y: p.y }));
    for (let i = 1; i < pts.length - 1; i++) {
        const prev = pts[i - 1], next = pts[i + 1];
        const dirX = next.x - prev.x, dirY = next.y - prev.y;
        const len = Math.hypot(dirX, dirY) || 1;
        const perpX = -dirY / len, perpY = dirX / len;
        const noiseVal = (fbm(hashFn, pts[i].x, pts[i].y, 3, noiseScale, 0.5, 2.0) - 0.5) * 2;
        out[i].x += perpX * noiseVal * amplitude;
        out[i].y += perpY * noiseVal * amplitude;
    }
    return out;
}
 
// NEU: erzwingt 0-2 seitliche Zwischenpunkte zwischen zwei Staedten, bevor
// A* laeuft. Das garantiert einen echten Bogen unabhaengig vom Zufall des
// Kostenrauschens - ohne das wuerde manche Verbindung (besonders kurze)
// trotz Rauschen/niedrigerer Heuristik im Mittel doch fast gerade bleiben.
// A* laeuft dann jeweils zwischen den Etappen (Start->Zwischenpunkt(e)->Ziel),
// die Segmente werden nahtlos aneinandergehaengt.
function computeCurvedRoadBetweenCities(world, cost, GW, GH, a, b) {
    const sx = clampInt(Math.round(a.cx / FULL_W * GW), 0, GW - 1), sy = clampInt(Math.round(a.cy / FULL_H * GH), 0, GH - 1);
    const tx = clampInt(Math.round(b.cx / FULL_W * GW), 0, GW - 1), ty = clampInt(Math.round(b.cy / FULL_H * GH), 0, GH - 1);
 
    const dist = Math.hypot(tx - sx, ty - sy);
    const waypoints = [];
    const waypointCount = dist > 12 ? (world.rand() < 0.5 ? 2 : 1) : (world.rand() < 0.6 ? 1 : 0);
 
    for (let w = 0; w < waypointCount; w++) {
        const t = (w + 1) / (waypointCount + 1) + (world.rand() - 0.5) * 0.12;
        const midX = sx + (tx - sx) * t, midY = sy + (ty - sy) * t;
        const dirX = tx - sx, dirY = ty - sy;
        const len = Math.hypot(dirX, dirY) || 1;
        const perpX = -dirY / len, perpY = dirX / len;
        const side = world.rand() < 0.5 ? -1 : 1;
        const offset = dist * (0.12 + world.rand() * 0.16) * side;
        waypoints.push({
            x: clampInt(Math.round(midX + perpX * offset), 2, GW - 3),
            y: clampInt(Math.round(midY + perpY * offset), 2, GH - 3),
        });
    }
 
    const stops = [{ x: sx, y: sy }, ...waypoints, { x: tx, y: ty }];
    let fullPath = [];
    for (let k = 0; k < stops.length - 1; k++) {
        const leg = astarPath(cost, GW, GH, stops[k].x, stops[k].y, stops[k + 1].x, stops[k + 1].y);
        if (!leg) return null;
        fullPath = k === 0 ? leg : fullPath.concat(leg.slice(1)); // ersten Punkt jeder weiteren Etappe nicht doppelt uebernehmen
    }
 
    const simplified = simplifyPath(fullPath, Math.max(1, Math.floor(fullPath.length / 70)));
    let pts = simplified.map(([gx, gy]) => ({ x: (gx + 0.5) / GW * FULL_W, y: (gy + 0.5) / GH * FULL_H }));

    pts = removeSelfLoops(pts, 3, Math.max(FULL_W, FULL_H) * 0.012);
    pts = relaxSharpTurns(pts, 55, 40);
 
    // zwei Meander-Durchgaenge: grobwellig (grosse Schwuenge, Amplitude
    // skaliert mit der Streckenlaenge) + fein (kleines Wackeln obendrauf)
    let pathLenPx = 0;
    for (let idx = 1; idx < pts.length; idx++) {
        pathLenPx += Math.hypot(pts[idx].x - pts[idx - 1].x, pts[idx].y - pts[idx - 1].y);
    }
    const coarseAmp = clampInt(pathLenPx * 0.02, 20, 80);
    pts = meanderPath(pts, world.hRoad, coarseAmp, 900);
    pts = meanderPath(pts, world.hRoad, coarseAmp * 0.35, 220);

    pts = removeSelfLoops(pts, 3, coarseAmp * 1.5);
    pts = relaxSharpTurns(pts, 70, 20);

    pts = chaikinSmooth(pts, 3);
    return pts;
}

// Winkelaenderung an p1 in Grad: 0 = geradeaus, 90 = rechtwinklige Kurve,
// 180 = Kehrtwende. Ueber das Skalarprodukt der (normierten) Richtungs-
// vektoren vor/nach p1.
function turnAngleDeg(p0, p1, p2) {
    const v1x = p1.x - p0.x, v1y = p1.y - p0.y;
    const v2x = p2.x - p1.x, v2y = p2.y - p1.y;
    const len1 = Math.hypot(v1x, v1y) || 1e-6;
    const len2 = Math.hypot(v2x, v2y) || 1e-6;
    const dot = Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / (len1 * len2)));
    return Math.acos(dot) * 180 / Math.PI;
}

// Rundet gezielt nur die schaerfste verbliebene Kurve pro Iteration ab
// (lokaler Chaikin-Schnitt NUR an diesem Knick, nicht am ganzen Pfad),
// bis kein Punkt mehr staerker als maxTurnDeg abbiegt. Faengt damit
// Etappen-Naehte (Wegpunkte), Raster-Jitter und Loop-Cut-Stellen
// gleichermassen ab, egal woher der scharfe Winkel stammt.
function relaxSharpTurns(pts, maxTurnDeg, maxIterations) {
    let arr = pts.map(p => ({ x: p.x, y: p.y }));
    for (let iter = 0; iter < maxIterations; iter++) {
        let worstIdx = -1, worstTurn = maxTurnDeg;
        for (let i = 1; i < arr.length - 1; i++) {
            const turn = turnAngleDeg(arr[i - 1], arr[i], arr[i + 1]);
            if (turn > worstTurn) { worstTurn = turn; worstIdx = i; }
        }
        if (worstIdx === -1) break; // keine scharfe Kurve mehr uebrig
        const prev = arr[worstIdx - 1], cur = arr[worstIdx], next = arr[worstIdx + 1];
        const a = { x: prev.x * 0.5 + cur.x * 0.5, y: prev.y * 0.5 + cur.y * 0.5 };
        const b = { x: cur.x * 0.5 + next.x * 0.5, y: cur.y * 0.5 + next.y * 0.5 };
        arr.splice(worstIdx, 1, a, b); // Knick durch zwei "abgeschnittene" Punkte ersetzen
    }
    return arr;
}

// Jede Stadt verbindet sich zusaetzlich zu den naechsten K Staedten in
// Reichweite - nicht nur zum naechsten MST-Nachbarn. maxPerCity begrenzt
// das, damit bei vielen Staedten kein unuebersichtliches Liniengewirr
// entsteht.
function buildProximityEdges(cities, maxDist, maxPerCity) {
    const edges = [];
    const seen = new Set();
    for (let i = 0; i < cities.length; i++) {
        const candidates = [];
        for (let j = 0; j < cities.length; j++) {
            if (j === i) continue;
            const d = Math.hypot(cities[i].cx - cities[j].cx, cities[i].cy - cities[j].cy);
            if (d <= maxDist) candidates.push([j, d]);
        }
        candidates.sort((a, b) => a[1] - b[1]);
        for (let k = 0; k < Math.min(maxPerCity, candidates.length); k++) {
            const j = candidates[k][0];
            const key = i < j ? `${i}-${j}` : `${j}-${i}`;
            if (!seen.has(key)) {
                seen.add(key);
                edges.push([Math.min(i, j), Math.max(i, j)]);
            }
        }
    }
    return edges;
}
 
export function computeRoadNetwork(world) {
    if (world.cities.length < 2) return { roads: [] };
    const GW = 150, GH = Math.round(GW * FULL_H / FULL_W);
    const cost = buildRoadCostGrid(world, GW, GH);

    // MST als Rueckgrat - garantiert, dass JEDE Stadt erreichbar ist, auch
    // solche ohne nahe Nachbarn innerhalb des Proximity-Radius
    const mstEdges = buildMST(world.cities);

    // Zusaetzliche Nachbarschafts-Kanten: jede Stadt versucht aktiv, alle
    // nahegelegenen Staedte zu verbinden, statt nur den minimal noetigen Baum
    const proximityRadius = Math.min(FULL_W, FULL_H) * 0.35;
    const proximityEdges = buildProximityEdges(world.cities, proximityRadius, 3);

    const edgeKey = (i, j) => (i < j ? `${i}-${j}` : `${j}-${i}`);
    const usedKeys = new Set();
    const allEdges = [];
    for (const [i, j] of [...mstEdges, ...proximityEdges]) {
        const k = edgeKey(i, j);
        if (!usedKeys.has(k)) { usedKeys.add(k); allEdges.push([i, j]); }
    }

    const roads = [];
    for (const [i, j] of allEdges) {
        const a = world.cities[i], b = world.cities[j];
        const pts = computeCurvedRoadBetweenCities(world, cost, GW, GH, a, b);
        if (pts) roads.push(pts);
    }
    return { roads };
}
 
// Staedte selbst bekommen KEINE eigenen Strassen mehr (die sahen als duennes
// Liniengewirr schlecht aus) - nur die Fernstrassen zwischen Staedten
// existieren noch (siehe computeRoadNetwork oben). Die Bebauungsstruktur
// (Bloecke/Reihen) entsteht stattdessen komplett ueber ein am Stadtwinkel
// ausgerichtetes Raster in generateInteriorLots (08-sprites-buildings.js).
export function generateCityRoadNetwork(world, city) {
    return { roads: [], plazas: [] };
}
 
// Rendert die Fernstrassen zwischen Staedten in ein niedrig aufgeloestes
// Masken-Canvas, damit Vegetation/Felsen sie zuverlaessig meiden koennen
export function buildRoadMask(interCityRoads, mainWidthPx) {
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = TERRAIN_W; maskCanvas.height = TERRAIN_H;
    const mctx = maskCanvas.getContext('2d');
    mctx.fillStyle = '#000'; mctx.fillRect(0, 0, TERRAIN_W, TERRAIN_H);
    mctx.strokeStyle = '#fff';
    mctx.lineCap = 'round'; mctx.lineJoin = 'round';
    const sx = TERRAIN_W / FULL_W, sy = TERRAIN_H / FULL_H;
    const s = (sx + sy) / 2;
    mctx.lineWidth = Math.max(1.4, mainWidthPx * s * 1.6);
    for (const pts of interCityRoads) {
        mctx.beginPath();
        pts.forEach((p, i) => { const x = p.x * sx, y = p.y * sy; i === 0 ? mctx.moveTo(x, y) : mctx.lineTo(x, y); });
        mctx.stroke();
    }
    const data = mctx.getImageData(0, 0, TERRAIN_W, TERRAIN_H).data;
    const mask = new Uint8Array(TERRAIN_W * TERRAIN_H);
    for (let i = 0; i < TERRAIN_W * TERRAIN_H; i++) mask[i] = data[i * 4] > 40 ? 1 : 0;
    return mask;
}
 
function sampleRoadMask(mask, nx, ny) {
    const mx = clampInt(Math.floor(nx * TERRAIN_W), 0, TERRAIN_W - 1);
    const my = clampInt(Math.floor(ny * TERRAIN_H), 0, TERRAIN_H - 1);
    return mask[my * TERRAIN_W + mx] === 1;
}
 
// true, wenn an dieser Stelle keine Vegetation/Felsen platziert werden
// sollen. Im Stadtkern immer blockiert; zum Stadtrand hin (t zwischen 0.6
// und 1) wird das Blockieren zunehmend unwahrscheinlicher, wodurch Baeume
// weich zwischen die aeusseren Haeuser einstreuen koennen, statt dass die
// Stadt hart an einer Kante endet.
export function isBlocked(world, mask, px, py) {
    if (sampleRoadMask(mask, px / FULL_W, py / FULL_H)) return true;
    const ci = world.cityInfluence(px, py);
    if (ci === null) return false;
    if (ci.t < 0.60) return true;
    const edgeT = clamp01((ci.t - 0.60) / 0.40);
    const nx0 = world.toNoiseX(px), ny0 = world.toNoiseY(py);
    const noise = fbm(world.hCity, nx0 * 26 + 17, ny0 * 26 + 17, 2, 0.07, 0.5, 2.0);
    return noise > edgeT;
}