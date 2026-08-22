import { PAL, CITY_FEATURE_COLORS } from "./Palette.js";
import { FULL_W, FULL_H, clamp01, lerpColor } from "./Utils.js";


export function strokePolyline(ctx, pts) {
    if (pts.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
}

export function drawRoadsVector(ctx, roads, width) {
    if (roads.length === 0) return;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = `rgba(${PAL.roadShoulder.join(',')},0.55)`;
    ctx.lineWidth = width * 1.55;
    for (const pts of roads) strokePolyline(ctx, pts);
    ctx.strokeStyle = `rgb(${PAL.roadAsphalt.join(',')})`;
    ctx.lineWidth = width;
    for (const pts of roads) strokePolyline(ctx, pts);
    ctx.strokeStyle = `rgba(${PAL.roadAsphaltLight.join(',')},0.5)`;
    ctx.lineWidth = width * 0.55;
    for (const pts of roads) strokePolyline(ctx, pts);
    ctx.setLineDash([width * 0.9, width * 0.9]);
    ctx.strokeStyle = `rgba(${PAL.roadLine.join(',')},0.85)`;
    ctx.lineWidth = Math.max(1, width * 0.09);
    for (const pts of roads) strokePolyline(ctx, pts);
    ctx.setLineDash([]);
}

// ---- Stadt-Merkmal-Abzeichen: kleines Schild auf einem Pfahl ueber dem
// Stadtzentrum, mit einem einfachen Icon pro Merkmal. Nutzt nur bestehende
// Canvas-Primitiven, keine externen Assets. ----
export function drawCityFeatureIcon(ctx, feature, r, rand) {
    if (feature === 'werkstatt') {
        ctx.fillStyle = '#f0ece0';
        ctx.strokeStyle = '#2a221a';
        ctx.lineWidth = 1.1;
        const teeth = 8, innerR = r * 0.34, outerR = r * 0.6;
        ctx.beginPath();
        for (let i = 0; i < teeth; i++) {
            const a0 = (i / teeth) * Math.PI * 2, a1 = a0 + (Math.PI * 2 / teeth) * 0.5;
            const a2 = a1 + (Math.PI * 2 / teeth) * 0.5;
            ctx.lineTo(Math.cos(a0) * outerR, Math.sin(a0) * outerR);
            ctx.lineTo(Math.cos(a1) * outerR, Math.sin(a1) * outerR);
            ctx.lineTo(Math.cos(a1) * innerR, Math.sin(a1) * innerR);
            ctx.lineTo(Math.cos(a2) * innerR, Math.sin(a2) * innerR);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = `rgb(${CITY_FEATURE_COLORS.werkstatt.join(',')})`;
        ctx.beginPath();
        ctx.arc(0, 0, innerR * 0.55, 0, Math.PI * 2);
        ctx.fill();
    } else if (feature === 'quest') {
        ctx.fillStyle = '#3a2e1a';
        ctx.fillRect(-r * 0.10, -r * 0.55, r * 0.20, r * 0.60);
        ctx.beginPath();
        ctx.arc(0, r * 0.42, r * 0.13, 0, Math.PI * 2);
        ctx.fill();
    } else if (feature === 'shop') {
        ctx.fillStyle = '#f4d35e';
        ctx.strokeStyle = '#7a5a10';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(-r * 0.18, r * 0.12, r * 0.30, r * 0.20, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(r * 0.16, -r * 0.08, r * 0.30, r * 0.20, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (feature === 'tankstelle') {
        ctx.fillStyle = '#f0ece0';
        ctx.strokeStyle = '#2a221a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.rect(-r * 0.28, -r * 0.5, r * 0.5, r * 0.85);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(r * 0.22, -r * 0.3);
        ctx.lineTo(r * 0.5, -r * 0.14);
        ctx.lineTo(r * 0.5, r * 0.24);
        ctx.stroke();
        ctx.fillStyle = '#c23c32';
        ctx.fillRect(-r * 0.22, -r * 0.4, r * 0.34, r * 0.15);
    } else if (feature === 'rennen') {
        const fw = r * 0.72, fh = r * 0.5;
        ctx.strokeStyle = '#2a221a';
        ctx.lineWidth = 0.8;
        ctx.fillStyle = '#fff';
        ctx.fillRect(-fw / 2, -fh / 2, fw, fh);
        const cell = fw / 4, half = fh / 2;
        ctx.fillStyle = '#222';
        for (let row = 0; row < 2; row++) {
            for (let col = 0; col < 4; col++) {
                if ((row + col) % 2 === 0) ctx.fillRect(-fw / 2 + col * cell, -fh / 2 + row * half, cell, half);
            }
        }
        ctx.strokeRect(-fw / 2, -fh / 2, fw, fh);
    }
}

export function drawCityBadge(ctx, x, y, feature, rand) {
    const badgeR = 24; // deutlich groesser als vorher
    const floatY = y - 42;
    // Bodenschatten, damit das Icon sichtbar "ueber" der Stadt schwebt
    ctx.fillStyle = 'rgba(20,16,10,0.22)';
    ctx.beginPath();
    ctx.ellipse(x, y - 2, 15, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    const color = CITY_FEATURE_COLORS[feature] || [200, 200, 200];
    ctx.fillStyle = `rgb(${color.join(',')})`;
    ctx.strokeStyle = `rgb(${PAL.outline.join(',')})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, floatY, badgeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.save();
    ctx.translate(x, floatY);
    drawCityFeatureIcon(ctx, feature, badgeR, rand);
    ctx.restore();
}

export function drawPineTree(ctx, x, y, size, hueVariant) {
    const trunkH = size * 0.28;
    const trunkW = size * 0.09;
    const canopyH = size * 0.95;
    const canopyW = size * 0.55;

    const green = hueVariant < 0.33 ? PAL.pineDark : (hueVariant < 0.66 ? PAL.pineMid : PAL.pineLight);
    const [gr, gg, gb] = green;

    // Stamm
    ctx.fillStyle = `rgb(${PAL.trunkBrown.join(',')})`;
    ctx.fillRect(x - trunkW / 2, y - trunkH, trunkW, trunkH);

    // 3 Etagen, von unten nach oben kleiner werdend (Tannen-Silhouette)
    const tiers = 3;
    ctx.strokeStyle = `rgb(${PAL.outline.join(',')})`;
    ctx.lineWidth = Math.max(1, size * 0.02);
    for (let t = 0; t < tiers; t++) {
        const tierY = y - trunkH - canopyH * (t / tiers) * 0.85;
        const tierW = canopyW * (1 - t * 0.28);
        const tierH = canopyH * 0.42;

        ctx.beginPath();
        ctx.moveTo(x, tierY - tierH);
        ctx.lineTo(x - tierW / 2, tierY + tierH * 0.3);
        ctx.lineTo(x + tierW / 2, tierY + tierH * 0.3);
        ctx.closePath();
        ctx.fillStyle = `rgb(${Math.max(0, gr - t * 6)},${Math.max(0, gg - t * 4)},${Math.max(0, gb - t * 4)})`;
        ctx.fill();
        ctx.stroke();
    }
}

export function drawBirchTree(ctx, x, y, size) {
    const trunkH = size * 0.9;
    const trunkW = size * 0.07;

    ctx.strokeStyle = `rgb(${PAL.outline.join(',')})`;
    ctx.lineWidth = Math.max(1, size * 0.02);

    ctx.fillStyle = `rgb(${PAL.birchTrunk.join(',')})`;
    ctx.fillRect(x - trunkW / 2, y - trunkH, trunkW, trunkH);
    ctx.strokeRect(x - trunkW / 2, y - trunkH, trunkW, trunkH);

    // kleine dunkle Astringe am Stamm
    ctx.fillStyle = `rgb(${PAL.outline.join(',')})`;
    for (let i = 0; i < 3; i++) {
        ctx.fillRect(x - trunkW / 2, y - trunkH * (0.3 + i * 0.22), trunkW, trunkW * 0.5);
    }

    // Krone als weiche, unregelmaessige Wolke aus ueberlappenden Kreisen
    const cx = x, cy = y - trunkH - size * 0.18;
    ctx.fillStyle = `rgb(${PAL.birchLeaves.join(',')})`;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.28, 0, Math.PI * 2);
    ctx.arc(cx - size * 0.18, cy + size * 0.08, size * 0.2, 0, Math.PI * 2);
    ctx.arc(cx + size * 0.18, cy + size * 0.08, size * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
}

export function drawBush(ctx, x, y, size) {
    ctx.strokeStyle = `rgb(${PAL.outline.join(',')})`;
    ctx.lineWidth = Math.max(1, size * 0.06);
    ctx.fillStyle = `rgb(${PAL.bushGreen.join(',')})`;
    ctx.beginPath();
    ctx.ellipse(x, y, size * 0.5, size * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
}

export function drawGrassTuft(ctx, x, y, size, seedRand) {
    ctx.strokeStyle = `rgba(${PAL.grassShade.join(',')},0.85)`;
    ctx.lineWidth = Math.max(1, size * 0.15);
    const blades = 3;
    for (let i = 0; i < blades; i++) {
        const angle = -Math.PI / 2 + (i - 1) * 0.5 + (seedRand() - 0.5) * 0.3;
        const len = size * (0.7 + seedRand() * 0.5);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(
            x + Math.cos(angle) * len * 0.5, y + Math.sin(angle) * len * 0.5,
            x + Math.cos(angle) * len, y + Math.sin(angle) * len
        );
        ctx.stroke();
    }
}

export function drawFlower(ctx, x, y, size, color) {
    ctx.fillStyle = `rgb(${color.join(',')})`;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
}

// ---- Gebirge: gezackte Gipfel-Silhouette mit optionaler Schneekappe ----
export function drawMountainPeak(ctx, x, y, size, snowT, rand) {
    const hueVariant = rand();
    const asym = (rand() - 0.5) * 0.5;           // Peak-Versatz nach links/rechts
    const w = size * (1.0 + rand() * 0.3);
    const h = size * (1.2 + rand() * 0.35);
    const jag = size * 0.14;

    const rock = hueVariant < 0.5 ? PAL.mountainRock : PAL.mountainRockLight;
    const rockDark = lerpColor(PAL.mountainRock, [0, 0, 0], 0.22);

    ctx.strokeStyle = `rgb(${PAL.outline.join(',')})`;
    ctx.lineWidth = Math.max(0.8, size * 0.035);

    // Bodenkontakt-Schatten - verankert den Berg optisch im Terrain statt
    // "schwebend" zu wirken
    ctx.fillStyle = `rgba(${PAL.outline.join(',')},0.15)`;
    ctx.beginPath();
    ctx.ellipse(x, y + h * 0.015, w * 0.56, h * 0.05, 0, 0, Math.PI * 2);
    ctx.fill();

    const peakX = x + asym * w * 0.3;
    const peakY = y - h;
    // optionale kleine Nebenschulter - macht die Silhouette weniger
    // symmetrisch-dreieckig, wirkt wie ein Vorgipfel/Grat
    const hasShoulder = rand() < 0.5;
    const shoulderSide = asym > 0 ? -1 : 1;
    const shoulderX = x + shoulderSide * w * (0.32 + rand() * 0.1);
    const shoulderY = y - h * (0.45 + rand() * 0.15);

    ctx.beginPath();
    ctx.moveTo(peakX, peakY);
    ctx.lineTo(x - w * 0.14 + asym * w * 0.1, y - h * 0.6 + jag * (rand() - 0.5));
    if (hasShoulder && shoulderSide < 0) ctx.lineTo(shoulderX, shoulderY);
    ctx.lineTo(x - w * 0.5, y);
    ctx.lineTo(x + w * 0.5, y);
    if (hasShoulder && shoulderSide > 0) ctx.lineTo(shoulderX, shoulderY);
    ctx.lineTo(x + w * 0.16 + asym * w * 0.1, y - h * 0.55 - jag * (rand() - 0.5));
    ctx.closePath();
    ctx.fillStyle = `rgb(${rock.join(',')})`;
    ctx.fill();
    ctx.stroke();

    // beschattete rechte Flanke fuers Volumen
    ctx.beginPath();
    ctx.moveTo(peakX, peakY);
    ctx.lineTo(x + w * 0.16 + asym * w * 0.1, y - h * 0.55 - jag * 0.2);
    ctx.lineTo(x + w * 0.5, y);
    ctx.lineTo(peakX, y);
    ctx.closePath();
    ctx.fillStyle = `rgba(${PAL.mountainRock.join(',')},0.55)`;
    ctx.fill();

    // Gesteinsschichten - ein paar leicht schraege, unterbrochene Linien
    // statt einer glatten Flaeche, deutet Fels-Straten an
    ctx.strokeStyle = `rgba(${rockDark.join(',')},0.5)`;
    ctx.lineWidth = Math.max(0.5, size * 0.02);
    const strataCount = 2 + Math.floor(rand() * 2);
    for (let i = 0; i < strataCount; i++) {
        const t = 0.3 + (i / strataCount) * 0.6 + rand() * 0.08;
        const sy = y - h * t;
        const spread = w * (0.5 - t * 0.32);
        ctx.beginPath();
        ctx.moveTo(x - spread * (0.5 + rand() * 0.3), sy + jag * 0.15);
        ctx.lineTo(x + spread * (0.3 + rand() * 0.3), sy - jag * 0.1);
        ctx.stroke();
    }

    // Schneekappe - unregelmaessige untere Kante statt festem Zickzack
    if (snowT > 0.05) {
        const snowLine = 0.78 - snowT * 0.14;
        ctx.strokeStyle = `rgb(${PAL.outline.join(',')})`;
        ctx.lineWidth = Math.max(0.8, size * 0.035);
        ctx.beginPath();
        ctx.moveTo(peakX, peakY);
        ctx.lineTo(x - w * 0.15, y - h * (snowLine + (rand() - 0.5) * 0.08));
        ctx.lineTo(x - w * 0.05, y - h * (snowLine + 0.09 + (rand() - 0.5) * 0.05));
        ctx.lineTo(x + w * 0.08, y - h * (snowLine + 0.02 + (rand() - 0.5) * 0.06));
        ctx.lineTo(x + w * 0.17, y - h * (snowLine + 0.08 + (rand() - 0.5) * 0.05));
        ctx.closePath();
        ctx.fillStyle = `rgb(${PAL.mountainSnow.join(',')})`;
        ctx.fill();
        ctx.stroke();

        // duenner Schneeschatten auf der beschatteten Flanke fuer Tiefe
        ctx.fillStyle = `rgba(${lerpColor(PAL.mountainSnow, PAL.mountainRock, 0.3).join(',')},0.6)`;
        ctx.beginPath();
        ctx.moveTo(peakX, peakY);
        ctx.lineTo(x + w * 0.08, y - h * (snowLine + 0.02));
        ctx.lineTo(x + w * 0.17, y - h * (snowLine + 0.08));
        ctx.lineTo(peakX + w * 0.05, y - h * (snowLine + 0.1));
        ctx.closePath();
        ctx.fill();
    }
}

// ---- Felsbrocken: fuer Gebirgsfuss & Wueste nutzbar ----
export function drawBoulder(ctx, x, y, size) {
    ctx.strokeStyle = `rgb(${PAL.outline.join(',')})`;
    ctx.lineWidth = Math.max(1, size * 0.08);
    ctx.fillStyle = `rgb(${PAL.mountainRock.join(',')})`;
    ctx.beginPath();
    ctx.moveTo(x - size * 0.5, y);
    ctx.lineTo(x - size * 0.35, y - size * 0.45);
    ctx.lineTo(x + size * 0.1, y - size * 0.55);
    ctx.lineTo(x + size * 0.5, y - size * 0.1);
    ctx.lineTo(x + size * 0.4, y + size * 0.15);
    ctx.lineTo(x - size * 0.2, y + size * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Lichtkante fuer etwas Volumen
    ctx.beginPath();
    ctx.moveTo(x - size * 0.35, y - size * 0.45);
    ctx.lineTo(x + size * 0.1, y - size * 0.55);
    ctx.lineTo(x - size * 0.05, y - size * 0.2);
    ctx.closePath();
    ctx.fillStyle = `rgb(${PAL.mountainRockLight.join(',')})`;
    ctx.fill();
}

// ---- Kaktus: Saguaro-Silhouette mit 0-2 Armen ----
export function drawCactus(ctx, x, y, size, rand) {
    ctx.strokeStyle = `rgb(${PAL.outline.join(',')})`;
    ctx.lineWidth = Math.max(1, size * 0.09);

    const trunkW = size * 0.34;
    const trunkH = size;

    function stem(cx, topY, botY, w) {
        const r = w / 2;
        ctx.beginPath();
        ctx.moveTo(cx - r, botY);
        ctx.lineTo(cx - r, topY + r);
        ctx.arc(cx, topY + r, r, Math.PI, 2 * Math.PI);
        ctx.lineTo(cx + r, botY);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    ctx.fillStyle = `rgb(${PAL.cactusGreen.join(',')})`;
    stem(x, y - trunkH, y, trunkW);

    const armCount = rand() < 0.75 ? (1 + Math.floor(rand() * 2)) : 0;
    for (let i = 0; i < armCount; i++) {
        const side = armCount === 2 ? (i === 0 ? -1 : 1) : (rand() < 0.5 ? -1 : 1);
        const armBaseY = y - trunkH * (0.35 + rand() * 0.25);
        const armTopY = armBaseY - size * (0.3 + rand() * 0.2);
        const armW = trunkW * 0.7;
        const armOutX = x + side * (trunkW * 0.55 + armW * 0.5);

        ctx.fillStyle = `rgb(${PAL.cactusGreenDark.join(',')})`;
        // horizontaler Verbindungsarm
        const rectX = Math.min(x, armOutX);
        const rectW = Math.abs(armOutX - x);
        ctx.fillRect(rectX, armBaseY - armW / 2, rectW, armW);
        ctx.strokeRect(rectX, armBaseY - armW / 2, rectW, armW);
        // vertikaler Aufwaertsteil
        stem(armOutX, armTopY, armBaseY + armW / 2, armW);
    }

    // Rippen-Andeutung
    ctx.strokeStyle = `rgba(${PAL.outline.join(',')},0.35)`;
    ctx.lineWidth = Math.max(0.5, size * 0.025);
    for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(x + i * trunkW * 0.26, y);
        ctx.lineTo(x + i * trunkW * 0.26, y - trunkH + trunkW * 0.6);
        ctx.stroke();
    }
}

// ---- Duerrstrauch: duenne, verzweigte Aeste ohne Laub ----
export function drawDeadBush(ctx, x, y, size, rand) {
    ctx.strokeStyle = `rgb(${PAL.deadWood.join(',')})`;
    ctx.lineWidth = Math.max(1, size * 0.08);
    const branches = 5 + Math.floor(rand() * 3);
    for (let i = 0; i < branches; i++) {
        const angle = -Math.PI / 2 + (rand() - 0.5) * Math.PI * 0.9;
        const len = size * (0.5 + rand() * 0.5);
        const midAngle = angle + (rand() - 0.5) * 0.4;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(
            x + Math.cos(angle) * len * 0.5, y + Math.sin(angle) * len * 0.5,
            x + Math.cos(midAngle) * len, y + Math.sin(midAngle) * len
        );
        ctx.stroke();
    }
}


// Baukoerper mit Seitenwand (Schattenflanke) fuer ein wenig Volumen,
// genau wie bei den Gebirgsgipfeln
function drawBoxVolume(ctx, x, y, w, h, depth, frontColor, sideColor) {
    ctx.strokeStyle = `rgb(${PAL.outline.join(',')})`;
    ctx.lineWidth = Math.max(1, w * 0.03);
    ctx.fillStyle = `rgb(${sideColor.join(',')})`;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y - h);
    ctx.lineTo(x + w / 2 + depth, y - h - depth * 0.5);
    ctx.lineTo(x + w / 2 + depth, y - depth * 0.5);
    ctx.lineTo(x + w / 2, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = `rgb(${frontColor.join(',')})`;
    ctx.beginPath();
    ctx.rect(x - w / 2, y - h, w, h);
    ctx.fill();
    ctx.stroke();
}

function drawFlatRoofCap(ctx, x, y, h, w, depth, roofColor, roofDark) {
    const topY = y - h;
    ctx.strokeStyle = `rgb(${PAL.outline.join(',')})`;
    ctx.lineWidth = 1;
    ctx.fillStyle = `rgb(${roofDark.join(',')})`;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, topY);
    ctx.lineTo(x + w / 2, topY);
    ctx.lineTo(x + w / 2 + depth, topY - depth * 0.5);
    ctx.lineTo(x - w / 2 + depth, topY - depth * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = `rgb(${roofColor.join(',')})`;
    ctx.fillRect(x - w / 2, topY - Math.max(2, h * 0.03), w, Math.max(2, h * 0.05));
}

function drawGableRoof(ctx, x, y, h, w, depth, roofColor, roofDark) {
    const topY = y - h;
    const ridgeY = topY - w * 0.34;
    ctx.strokeStyle = `rgb(${PAL.outline.join(',')})`;
    ctx.lineWidth = 1;
    ctx.fillStyle = `rgb(${roofColor.join(',')})`;
    ctx.beginPath();
    ctx.moveTo(x - w / 2 - w * 0.06, topY);
    ctx.lineTo(x, ridgeY);
    ctx.lineTo(x + w / 2 + w * 0.06, topY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = `rgb(${roofDark.join(',')})`;
    ctx.beginPath();
    ctx.moveTo(x + w / 2 + w * 0.06, topY);
    ctx.lineTo(x, ridgeY);
    ctx.lineTo(x + depth, ridgeY - depth * 0.5);
    ctx.lineTo(x + w / 2 + w * 0.06 + depth, topY - depth * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
}

function drawWindows(ctx, x, y, w, h, cols, rows, topPad, bottomPad, palette, rand) {
    const sidePad = w * 0.14;
    const usableW = w - sidePad * 2;
    const usableH = Math.max(1, h - topPad - bottomPad);
    const cellW = usableW / cols, cellH = usableH / rows;
    const winW = cellW * 0.56, winH = cellH * 0.62;
    ctx.strokeStyle = `rgb(${PAL.outline.join(',')})`;
    ctx.lineWidth = 0.8;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const wx = x - w / 2 + sidePad + c * cellW + (cellW - winW) / 2;
            const wy = y - h + topPad + r * cellH + (cellH - winH) / 2;
            const lit = rand() < 0.3;
            ctx.fillStyle = `rgb(${(lit ? palette.windowLit : palette.window).join(',')})`;
            ctx.fillRect(wx, wy, winW, winH);
            ctx.strokeRect(wx, wy, winW, winH);
        }
    }
}

function drawDoor(ctx, x, y, w, h, palette) {
    const dw = Math.max(3, w * 0.15), dh = Math.max(4, h * 0.20);
    ctx.strokeStyle = `rgb(${PAL.outline.join(',')})`;
    ctx.lineWidth = 0.8;
    ctx.fillStyle = `rgb(${palette.door.join(',')})`;
    ctx.fillRect(x - dw / 2, y - dh, dw, dh);
    ctx.strokeRect(x - dw / 2, y - dh, dw, dh);
}

// kleines freistehendes Haus - Satteldach, 1 Fensterreihe, Tuer, ggf. Schornstein
function drawCottageSprite(ctx, x, y, palette, rand) {
    const w = 22 + rand() * 12, h = 15 + rand() * 8, depth = w * 0.22;
    const wallC = lerpColor(palette.wall, palette.wallDark, rand() * 0.5);
    const sideC = lerpColor(palette.wallDark, [30, 24, 18], 0.25);
    drawBoxVolume(ctx, x, y, w, h, depth, wallC, sideC);
    drawGableRoof(ctx, x, y, h, w, depth, palette.roof, palette.roofDark);
    drawWindows(ctx, x, y, w, h, 2, 1, h * 0.18, h * 0.36, palette, rand);
    drawDoor(ctx, x, y, w, h, palette);
    if (rand() < 0.45) {
        ctx.fillStyle = `rgb(${PAL.outline.join(',')})`;
        ctx.fillRect(x + w * 0.20, y - h - w * 0.30, Math.max(2, w * 0.07), w * 0.16);
    }
}

// schmales, mehrstoeckiges Reihen-/Stadthaus - Flach- oder Satteldach
function drawTownhouseSprite(ctx, x, y, palette, rand) {
    const w = 18 + rand() * 8, h = 30 + rand() * 14, depth = w * 0.20;
    const wallC = lerpColor(palette.wall, palette.wallDark, rand() * 0.5);
    const sideC = lerpColor(palette.wallDark, [30, 24, 18], 0.25);
    drawBoxVolume(ctx, x, y, w, h, depth, wallC, sideC);
    if (rand() < 0.5) drawFlatRoofCap(ctx, x, y, h, w, depth, palette.roof, palette.roofDark);
    else drawGableRoof(ctx, x, y, h, w, depth, palette.roof, palette.roofDark);
    const rows = 2 + Math.floor(rand() * 2);
    drawWindows(ctx, x, y, w, h, 2, rows, h * 0.10, h * 0.24, palette, rand);
    drawDoor(ctx, x, y, w, h, palette);
}

// breiter Wohnblock - Flachdach, Fenstergitter, Balkone, Technik-Aufbauten
function drawApartmentSprite(ctx, x, y, palette, rand) {
    const w = 40 + rand() * 22, h = 42 + rand() * 22, depth = w * 0.16;
    const wallC = lerpColor(palette.blockWall, palette.blockWallDark, rand() * 0.5);
    const sideC = lerpColor(palette.blockWallDark, [20, 20, 22], 0.3);
    drawBoxVolume(ctx, x, y, w, h, depth, wallC, sideC);
    drawFlatRoofCap(ctx, x, y, h, w, depth, palette.blockRoof, lerpColor(palette.blockRoof, [0, 0, 0], 0.25));
    const cols = 3 + Math.floor(rand() * 2), rows = 3 + Math.floor(rand() * 2);
    drawWindows(ctx, x, y, w, h, cols, rows, h * 0.08, h * 0.10, palette, rand);
    ctx.strokeStyle = `rgb(${PAL.outline.join(',')})`;
    ctx.lineWidth = 0.8;
    const balconyCount = Math.floor(rand() * 3);
    for (let i = 0; i < balconyCount; i++) {
        const bx = x - w * 0.3 + rand() * w * 0.6;
        const by = y - h * (0.25 + rand() * 0.5);
        const bw = w * 0.14, bh = h * 0.04;
        ctx.fillStyle = `rgba(${palette.blockRoof.join(',')},0.8)`;
        ctx.fillRect(bx - bw / 2, by, bw, bh);
        ctx.strokeRect(bx - bw / 2, by, bw, bh);
    }
    const units = Math.floor(rand() * 3);
    for (let i = 0; i < units; i++) {
        const ux = x - w * 0.3 + rand() * w * 0.6;
        const uy = y - h - w * 0.06 - rand() * w * 0.05;
        const us = w * 0.07;
        ctx.fillStyle = `rgb(${palette.blockRoof.join(',')})`;
        ctx.fillRect(ux - us / 2, uy - us, us, us);
        ctx.strokeRect(ux - us / 2, uy - us, us, us);
    }
}

// schmaler Hochhaus-Turm fuers Stadtzentrum - viele Fensterreihen, Antenne/Tank
function drawTowerSprite(ctx, x, y, palette, rand) {
    const w = 20 + rand() * 8, h = 60 + rand() * 30, depth = w * 0.20;
    const wallC = lerpColor(palette.blockWall, palette.blockWallDark, rand() * 0.5);
    const sideC = lerpColor(palette.blockWallDark, [20, 20, 22], 0.3);
    drawBoxVolume(ctx, x, y, w, h, depth, wallC, sideC);
    drawFlatRoofCap(ctx, x, y, h, w, depth, palette.blockRoof, lerpColor(palette.blockRoof, [0, 0, 0], 0.25));
    const rows = 6 + Math.floor(rand() * 3);
    drawWindows(ctx, x, y, w, h, 2, rows, h * 0.05, h * 0.05, palette, rand);
    ctx.strokeStyle = `rgb(${PAL.outline.join(',')})`;
    if (rand() < 0.5) {
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(x, y - h - w * 0.08);
        ctx.lineTo(x, y - h - w * 0.5);
        ctx.stroke();
    } else {
        ctx.fillStyle = `rgb(${palette.blockRoof.join(',')})`;
        ctx.beginPath();
        ctx.ellipse(x, y - h - w * 0.16, w * 0.14, w * 0.10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }
}

// Gebaeudetyp abhaengig von der Naehe zum Stadtzentrum: Kern = Tuerme/
// Wohnbloecke, Rand = kleine Cottages - wie in einer echten Stadt
function pickBuildingType(t, rand) {
    if (t < 0.30) {
        const r = rand();
        if (r < 0.45) return 'apartment';
        if (r < 0.68) return 'tower';
        if (r < 0.90) return 'townhouse';
        return 'cottage';
    } else if (t < 0.62) {
        const r = rand();
        if (r < 0.40) return 'townhouse';
        if (r < 0.70) return 'apartment';
        return 'cottage';
    } else {
        return rand() < 0.72 ? 'cottage' : 'townhouse';
    }
}

// Haupt-Bebauungsraster: deckt die ganze Stadtflaeche ab, ausgerichtet an
// city.angle (dadurch stehen die Haeuser in erkennbaren Reihen/Bloecken statt
// wild verstreut). Staedte haben keine eigenen Strassen mehr, daher ist dies
// die alleinige Grundlage der Bebauung - die Dichte wird ueber
// placeBuildingsOnLots' Distanz-Gradient gesteuert (Zentrum dicht, Rand
// locker, siehe cityGapProbability).
function generateInteriorLots(world, city, network) {
    const rand = city.rand;
    const ccx = city.cx, ccy = city.cy;
    const radiusPx = city.radius;
    const spacing = (26 + rand() * 8) * (city.blockSpacing / 65);
    const cosA = Math.cos(city.angle), sinA = Math.sin(city.angle);
    const steps = Math.ceil(radiusPx / spacing) + 1;
    const lots = [];
    for (let iy = -steps; iy <= steps; iy++) {
        for (let ix = -steps; ix <= steps; ix++) {
            const jx = ix * spacing + (rand() - 0.5) * spacing * 0.4;
            const jy = iy * spacing + (rand() - 0.5) * spacing * 0.4;
            const distNorm = Math.hypot(jx, jy) / radiusPx;
            if (distNorm > 1.0) continue;
            const x = ccx + jx * cosA - jy * sinA;
            const y = ccy + jx * sinA + jy * cosA;
            lots.push({ x, y, distNorm });
        }
    }
    return lots;
}

function generateLots(world, city, network) {
    return generateInteriorLots(world, city, network);
}

// grobe Kollisionsradien pro Haustyp (fuer den Mindestabstand zwischen
// Gebaeuden) - unabhaengig von den tatsaechlichen Sprite-Zeichenfunktionen,
// die unveraendert bleiben
const BUILDING_FOOTPRINT = { cottage: 20, townhouse: 16, apartment: 34, tower: 18 };

// Dichte-Gradient: Wahrscheinlichkeit, ein Grundstueck NICHT zu bebauen
// (Garten/Luecke/Gruenflaeche), steigt kontinuierlich mit dem Abstand vom
// Zentrum - im Zentrum fast immer bebaut, am Rand deutlich lockerer
function cityGapProbability(distNorm) {
    return clamp01(0.09 + Math.pow(clamp01(distNorm), 1.6) * 0.58);
}

// platziert Haeuser auf den Grundstuecken: Dichte-Gradient zuerst (Kern vor
// Rand), dann Kollisions-/Untergrundpruefung mit ein paar Alternativ-
// Positionen, bevor ein Grundstueck aufgegeben wird (kontrollierte
// Variation statt harter Luecken oder Ueberlappung)
function placeBuildingsOnLots(world, city, network, lots) {
    const rand = city.rand;
    const placed = [];
    const sorted = lots.slice().sort((a, b) => a.distNorm - b.distNorm);
    for (const lot of sorted) {
        if (lot.distNorm > 1.06) continue;
        if (rand() < cityGapProbability(lot.distNorm)) continue;
        let inPlaza = false;
        for (const pl of network.plazas) {
            if (Math.hypot(lot.x - pl.x, lot.y - pl.y) < pl.r) { inPlaza = true; break; }
        }
        if (inPlaza) continue;
        for (let attempt = 0; attempt < 3; attempt++) {
            const ox = attempt === 0 ? 0 : (rand() - 0.5) * 16;
            const oy = attempt === 0 ? 0 : (rand() - 0.5) * 16;
            const x = lot.x + ox, y = lot.y + oy;
            if (x < FULL_W * 0.01 || x > FULL_W * 0.99 || y < FULL_H * 0.01 || y > FULL_H * 0.99) break;
            const info = world.classify(x, y);
            if (!world.terrainOkForCity(info)) continue;
            const type = pickBuildingType(lot.distNorm, rand);
            const footprint = BUILDING_FOOTPRINT[type];
            let collides = false;
            for (const p of placed) {
                if (Math.hypot(x - p.x, y - p.y) < (footprint + p.r) * 0.58) { collides = true; break; }
            }
            if (collides) continue;
            placed.push({ x, y, type, r: footprint });
            break;
        }
    }
    return placed;
}

// orchestriert eine Stadt: Grundstuecke aus dem (bereits erzeugten)
// Strassennetz ableiten, Haeuser platzieren, nach y sortieren und mit den
// bestehenden, unveraenderten Sprite-Funktionen zeichnen
export function generateAndDrawCityBuildings(ctx, world, city, network) {
    const lots = generateLots(world, city, network);
    const buildings = placeBuildingsOnLots(world, city, network, lots);
    buildings.sort((a, b) => a.y - b.y); // simples Painter's-Algorithm-Tiefengefuehl
    for (const b of buildings) {
        const r = city.rand;
        if (b.type === 'apartment') drawApartmentSprite(ctx, b.x, b.y, city.palette, r);
        else if (b.type === 'tower') drawTowerSprite(ctx, b.x, b.y, city.palette, r);
        else if (b.type === 'townhouse') drawTownhouseSprite(ctx, b.x, b.y, city.palette, r);
        else drawCottageSprite(ctx, b.x, b.y, city.palette, r);
    }
}
