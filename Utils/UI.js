import * as PIXI from "pixi.js"
import { COLORS } from "../Colors.js";

export function pixelText(str, size, color = COLORS.textLight, strokeColor = null) {
    const style = { fontFamily: "monospace", fontSize: size, fill: color, fontWeight: "bold" };
    if (strokeColor) style.stroke = { color: strokeColor, width: 3, join: 'round' };
    const t = new PIXI.Text({ text: str, style });
    t.resolution = 2;
    return t;
}

export function drawBox(g, w, h, bg, border, borderWidth, radius = 0) {
    g.clear();
    if (radius > 0) {
        g.roundRect(0, 0, w, h, radius).fill(bg);
        g.roundRect(0, 0, w, h, radius).stroke({ width: borderWidth, color: border, alignment: 0.5 });
    } else {
        g.rect(0, 0, w, h).fill(bg);
        g.rect(0, 0, w, h).stroke({ width: borderWidth, color: border, alignment: 0.5 });
    }
}