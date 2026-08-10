import * as PIXI from "pixi.js";



export class HorizontalScroller extends PIXI.Container {
    constructor(width, height) {
        super();

        this.content = new PIXI.Container();
        this.addChild(this.content);

        this.maskGfx = new PIXI.Graphics();
        this.addChild(this.maskGfx);
        this.content.mask = this.maskGfx;

        this.eventMode = "static";
        this.cursor = "grab";

        this._dragging = false;
        this._dragStartX = 0;
        this._contentStartX = 0;
        this._contentWidth = 0;

        this.setSize(width, height);
    }

    setSize(width, height) {
        this.viewWidth = width;
        this.viewHeight = height;

        this.itemSize = height;

        this.maskGfx.clear();
        this.maskGfx.rect(0, 0, width, height).fill(0xffffff);

        this._clampContentX();
    }

    setItems(items, gap, itemSize) {
        this.content.removeChildren();
        this.content.x = 0;

        let x = 0;
        for (const item of items) {
            item.x = x;
            item.y = 0;
            this.content.addChild(item);
            x += itemSize + gap;
        }
        this._contentWidth = Math.max(0, x - gap);
    }

    _onDragStart(e) {
        this._dragging = true;
        this._dragStartX = e.global.x;
        this._contentStartX = this.content.x;
        this.cursor = "grabbing";
    }

    _onDragMove(e) {
        if (!this._dragging) return;
        const dx = e.global.x - this._dragStartX;
        this.content.x = this._contentStartX + dx;
        this._clampContentX();
    }

    _onDragEnd() {
        this._dragging = false;
        this.cursor = "grab";
    }

    _onWheel(e) {
        this.content.x -= e.deltaY;
        this.content.x -= e.deltaX;

        this._clampContentX();
    }

    _clampContentX() {
        const overflow = Math.max(0, this._contentWidth - this.viewWidth);
        this.content.x = Math.min(0, Math.max(-overflow, this.content.x));
    }
}