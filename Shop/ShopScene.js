import * as PIXI from "pixi.js";
import { UIScene } from "../Utils/UIScene.js";
import { pixelText, drawBox } from "../Utils/UI.js";
import { COLORS } from "../Colors.js";
import { GAMESTATE } from "../GameState.js";
import { MapScene } from "../Map/MapScene.js";
import { SceneStack } from "../Utils/SceneStack.js";
import { MAP_SEED, HIDDEN_MANIFEST, DEFAULT_CAR_CONFIG, loadGlobalAssetEntry } from "../GlobalAssets.js";
import { LoadingScreen } from "../LoadingScreen.js";

const CRATE_ITEM_W = 150;
const REEL_VISIBLE_COUNT = 7;      // mehr Platz durch Fullscreen -> mehr sichtbare Slots
const REEL_LEADING_ITEMS = 26;     // Fueller VOR dem Gewinner
const REEL_TRAILING_MIN = 4;       // Fueller NACH dem Gewinner (Range, damit Distanz zum Stripende variiert)
const REEL_TRAILING_MAX = 9;
const REEL_SPIN_DURATION = 3400;

function rewardLabel(reward) {
    if (reward.type === "money") {
        return reward.amount >= 0 ? `+$${reward.amount}` : `-$${Math.abs(reward.amount)}`;
    }
    return reward.label ?? reward.pieceName;
}

function rewardColor(reward) {
    if (reward.type === "money") return reward.amount >= 0 ? COLORS.gold : COLORS.exitRed;
    if (reward.type === "part") return COLORS.blue;
    return COLORS.textLight;
}

function pickWeightedReward(rewards) {
    const total = rewards.reduce((sum, r) => sum + r.weight, 0);
    let roll = Math.random() * total;
    for (const r of rewards) {
        if (roll < r.weight) return r;
        roll -= r.weight;
    }
    return rewards[rewards.length - 1];
}

function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

//ShopScene - Kisten gegen Ingame-Geld kaufen, mit Reel-Öffnungsanimation. Fullscreen.
export class ShopScene extends UIScene {

    ///@param app - PIXI Application
    ///@param callbacks - { onClose }
    constructor(app) {
        super(app, "ShopScene");

        this.world3dScene = null;
        this.uiScene = new PIXI.Container();
        this.uiScene.eventMode = "static";

        //when unlocking a new piece it has to be loaded as asset
        this.piecesToLoadOnExit = [];

        this._crateCards = [];
        this._spinning = false;

        this.crates = [];
        this.createCrates();

        this._buildBackdrop();
        this._buildPanel();
        this._buildTitle();
        this._buildMoneyPanel();
        this._buildCloseButton();
        this._buildCrateList();
        this._buildReel();
        this._buildStatusText();

        this.gamestateListener = GAMESTATE.onChange((field) => {
            if (field === "money") this._refreshMoney();
        });
        this._refreshMoney();

        this._showList();
        this.layout();

        this._resizeHandler = () => this.layout();
        window.addEventListener("resize", this._resizeHandler);
    }

    destroy(options) {
        window.removeEventListener("resize", this._resizeHandler);
        this.gamestateListener();
        if (this._reelTicker) this.app.ticker.remove(this._reelTicker);
        clearTimeout(this._statusTimeout);
        this.uiScene.destroy(options);
    }

    createCrates() {
        //probabilities:
        // money:    50%
        // part:     30%
        // property: 20%
        const basic = {
            id: "basic",
            name: "Basic Crate",
            cost: 500,
            rewards: [
                { type: "money", amount: -200, weight: 15 },
                { type: "money", amount: 300, weight: 20 },
                { type: "money", amount: 900, weight: 10 },
                { type: "money", amount: 2500, weight: 5 },
            ],
        };

        //probabilities:
        // money:    40%
        // part:     35%
        // property: 25%
        const premium = {
            id: "premium",
            name: "Premium Crate",
            cost: 2000,
            rewards: [
                { type: "money", amount: -800, weight: 10 },
                { type: "money", amount: 1500, weight: 18 },
                { type: "money", amount: 4000, weight:  9 },
                { type: "money", amount: 10000, weight: 3 },
            ],
        };

        //parts
        for (const item of HIDDEN_MANIFEST) {
            basic.rewards.push({
                type: "part",
                pieceName: item.name,
                label: "New " + item.name,
                weight: Math.round(item.chance * 0.01 * 30)
            });
            premium.rewards.push({
                type: "part",
                pieceName: item.name,
                label: "New " + item.name,
                weight: Math.round(item.chance * 0.01 * 35)
            });
        }

        //properties
        const propertyCount = Object.values(DEFAULT_CAR_CONFIG.properties)
            .filter(property => property.level < property.maxLevel)
            .length;
        for (const [name, property] of Object.entries(DEFAULT_CAR_CONFIG.properties)) {
            if (property.level >= property.maxLevel) continue;
            basic.rewards.push({
                type: "property",
                kind: name,
                label: name,
                weight: Math.round(20 / propertyCount)
            });
            premium.rewards.push({
                type: "property",
                kind: name,
                label: name,
                weight: Math.round(25 / propertyCount)
            });
        }

        this.crates.push(basic, premium);
    }

    // -----------------------------------------------------------------
    // Aufbau
    // -----------------------------------------------------------------
    _buildBackdrop() {
        this.backdrop = new PIXI.Graphics();
        this.uiScene.addChild(this.backdrop);
    }

    _buildPanel() {
        this.panel = new PIXI.Container();
        this.uiScene.addChild(this.panel);

        this.panelBg = new PIXI.Graphics();
        this.panel.addChild(this.panelBg);
    }

    _buildTitle() {
        this.titleText = pixelText("SHOP", 15, COLORS.gold);
        this.titleText.anchor.set(0.5, 0);
        this.panel.addChild(this.titleText);
    }

    _buildMoneyPanel() {
        this.moneyPanel = new PIXI.Container();
        this.panel.addChild(this.moneyPanel);

        this.moneyPanelBg = new PIXI.Graphics();
        this.moneyPanel.addChild(this.moneyPanelBg);

        this.moneyLabel = pixelText("$", 18, COLORS.gold);
        this.moneyPanel.addChild(this.moneyLabel);

        this.moneyText = pixelText("0", 16, COLORS.gold);
        this.moneyPanel.addChild(this.moneyText);
    }

    _refreshMoney() {
        this.moneyText.text = `${Math.max(0, Math.round(GAMESTATE.money))}`;
        this._layoutMoneyPanel();
        this._refreshAffordability();
    }

    _refreshAffordability() {
        for (const card of this._crateCards) {
            const affordable = GAMESTATE.money >= card.def.cost;
            card.buyText.text = affordable ? "BUY" : "TOO EXPENSIVE";
            this._drawCardBuyBtn(card, false, affordable);
        }
    }

    _buildCloseButton() {
        this.closeButton = new PIXI.Container();
        this.closeButton.eventMode = "static";
        this.closeButton.cursor = "pointer";
        this.panel.addChild(this.closeButton);

        this.closeButtonBg = new PIXI.Graphics();
        this.closeButton.addChild(this.closeButtonBg);

        this.closeButtonText = pixelText("X", 16, COLORS.textLight);
        this.closeButtonText.anchor.set(0.5);
        this.closeButton.addChild(this.closeButtonText);

        this.closeButton.on("pointerover", () => this._drawCloseButton(true));
        this.closeButton.on("pointerout", () => this._drawCloseButton(false));
        this.closeButton.on("pointertap", async () => {
            if (this._spinning) return; // waehrend Animation nicht schliessbar
            await this._close();
        });
    }

    async _close() {
        SceneStack.popScene();
        const loadingScreen = new LoadingScreen(this.app);
        SceneStack.pushScene(loadingScreen);
        await loadingScreen.run(
            this.piecesToLoadOnExit.map((piece, i) => async () => {
                await loadGlobalAssetEntry(piece);
            }),
            null,
            this.piecesToLoadOnExit.map(e => `Loading ${e.name}`)
        );
        const scene = await MapScene.create(this.app, MAP_SEED, loadingScreen);
        SceneStack.pushScene(scene);
    }

    _drawCloseButton(hover) {
        const size = this._closeSize;
        drawBox(
            this.closeButtonBg,
            size, size,
            hover ? COLORS.exitRedHover : COLORS.exitRed,
            COLORS.panelBorder,
            Math.max(2, size * 0.06)
        );
        this.closeButtonText.position.set(size / 2, size / 2);
    }

    _buildCrateList() {
        this.listContainer = new PIXI.Container();
        this.panel.addChild(this.listContainer);

        for (const def of this.crates) {
            const card = new PIXI.Container();

            const bg = new PIXI.Graphics();
            card.addChild(bg);

            const nameText = pixelText(def.name, 15, COLORS.textLight);
            card.addChild(nameText);

            const costText = pixelText(`$${def.cost}`, 14, COLORS.gold);
            card.addChild(costText);

            const buyBtn = new PIXI.Container();
            buyBtn.eventMode = "static";
            buyBtn.cursor = "pointer";
            card.addChild(buyBtn);

            const buyBg = new PIXI.Graphics();
            buyBtn.addChild(buyBg);

            const buyText = pixelText("BUY", 13, COLORS.textLight);
            buyText.anchor.set(0.5);
            buyBtn.addChild(buyText);

            const cardObj = { def, card, bg, nameText, costText, buyBtn, buyBg, buyText };

            buyBtn.on("pointerover", () => this._drawCardBuyBtn(cardObj, true, GAMESTATE.money >= def.cost));
            buyBtn.on("pointerout", () => this._drawCardBuyBtn(cardObj, false, GAMESTATE.money >= def.cost));
            buyBtn.on("pointertap", () => this._onBuyCrate(cardObj));

            this.listContainer.addChild(card);
            this._crateCards.push(cardObj);
        }
    }

    _drawCardBuyBtn(card, hover, affordable) {
        let color = COLORS.boxBg;
        if (affordable && hover) color = COLORS.boxBgHover;
        if (!affordable) color = COLORS.exitRed;
        drawBox(card.buyBg, this._buyBtnW, this._buyBtnH, color, COLORS.boxBorder, Math.max(2, this._buyBtnH * 0.1));
        card.buyText.position.set(this._buyBtnW / 2, this._buyBtnH / 2);
        card.buyBtn.eventMode = affordable ? "static" : "none";
        card.buyBtn.cursor = affordable ? "pointer" : "default";
    }

    _onBuyCrate(card) {
        if (this._spinning) return;
        const def = card.def;

        const success = GAMESTATE.spendMoney(def.cost, false);
        if (!success) {
            this._flashStatus("Not enough money!", COLORS.exitRed);
            return;
        }

        const reward = pickWeightedReward(def.rewards);
        this._startSpin(def, reward);
    }

    _buildReel() {
        this.reelContainer = new PIXI.Container();
        this.panel.addChild(this.reelContainer);

        this.reelViewport = new PIXI.Container();
        this.reelContainer.addChild(this.reelViewport);

        this.reelViewportBg = new PIXI.Graphics();
        this.reelViewport.addChild(this.reelViewportBg);

        this.reelMask = new PIXI.Graphics();
        this.reelViewport.addChild(this.reelMask);

        this.reelStrip = new PIXI.Container();
        this.reelStrip.mask = this.reelMask;
        this.reelViewport.addChild(this.reelStrip);

        this.reelMarkerTop = new PIXI.Graphics();
        this.reelViewport.addChild(this.reelMarkerTop);
        this.reelMarkerBottom = new PIXI.Graphics();
        this.reelViewport.addChild(this.reelMarkerBottom);

        // Ergebnis-Bereich - fest positioniert, unabhaengig vom Spin-Status
        this.reelResultText = pixelText("", 17, COLORS.gold);
        this.reelResultText.anchor.set(0.5);
        this.reelContainer.addChild(this.reelResultText);

        this.reelContinueBtn = new PIXI.Container();
        this.reelContinueBtn.eventMode = "static";
        this.reelContinueBtn.cursor = "pointer";
        this.reelContainer.addChild(this.reelContinueBtn);

        this.reelContinueBg = new PIXI.Graphics();
        this.reelContinueBtn.addChild(this.reelContinueBg);

        this.reelContinueText = pixelText("CONTINUE", 18, COLORS.textLight);
        this.reelContinueText.anchor.set(0.5);
        this.reelContinueBtn.addChild(this.reelContinueText);

        this.reelContinueBtn.on("pointerover", () => this._drawContinueBtn(true));
        this.reelContinueBtn.on("pointerout", () => this._drawContinueBtn(false));
        this.reelContinueBtn.on("pointertap", () => this._showList());

        this.reelContinueBtn.visible = false;
        this.reelResultText.visible = false;
    }

    _drawContinueBtn(hover) {
        drawBox(
            this.reelContinueBg,
            this._continueBtnW, this._continueBtnH,
            hover ? COLORS.boxBgHover : COLORS.boxBg,
            COLORS.boxBorder,
            Math.max(2, this._continueBtnH * 0.08)
        );
        this.reelContinueText.position.set(this._continueBtnW / 2, this._continueBtnH / 2);
    }

    _buildStatusText() {
        this.statusText = pixelText("", 13, COLORS.exitRed);
        this.statusText.anchor.set(0.5, 0);
        this.panel.addChild(this.statusText);
        this.statusText.alpha = 0;
    }

    _flashStatus(msg, color) {
        this.statusText.text = msg;
        this.statusText.style.fill = color;
        this.statusText.position.set(this._panelW / 2, this._statusY ?? 0);
        this.statusText.alpha = 1;
        clearTimeout(this._statusTimeout);
        this._statusTimeout = setTimeout(() => { this.statusText.alpha = 0; }, 1500);
    }

    // -----------------------------------------------------------------
    // View-Switching
    // -----------------------------------------------------------------
    _showList() {
        this.listContainer.visible = true;
        this.reelContainer.visible = false;
        this.closeButton.eventMode = "static";
        this.closeButtonBg.alpha = 1;
        this._refreshAffordability();
    }

    _showReel() {
        this.listContainer.visible = false;
        this.reelContainer.visible = true;
    }

    // -----------------------------------------------------------------
    // Öffnungsanimation
    // -----------------------------------------------------------------
    _startSpin(def, finalReward) {
        this._spinning = true;
        this.closeButton.eventMode = "none";
        this.closeButtonBg.alpha = 0.4;
        this.reelResultText.visible = false;
        this.reelContinueBtn.visible = false;
        this._showReel();

        const trailingCount = REEL_TRAILING_MIN + Math.floor(Math.random() * (REEL_TRAILING_MAX - REEL_TRAILING_MIN + 1));
        const finalIndex = REEL_LEADING_ITEMS;
        const totalItems = REEL_LEADING_ITEMS + 1 + trailingCount;

        this.reelStrip.removeChildren();
        this._stripItems = [];
        for (let i = 0; i < totalItems; i++) {
            const reward = (i === finalIndex) ? finalReward : pickWeightedReward(def.rewards);
            this._stripItems.push(reward);

            const slot = new PIXI.Container();
            slot.position.set(i * CRATE_ITEM_W, 0);
            this.reelStrip.addChild(slot);

            const slotBg = new PIXI.Graphics();
            slot.addChild(slotBg);

            const label = pixelText(rewardLabel(reward), 13, rewardColor(reward));
            label.anchor.set(0.5);
            slot.addChild(label);

            slot._bg = slotBg;
            slot._label = label;
        }
        this._drawReelSlots();

        const viewportH = this._reelViewportH ?? (this._reelItemH + 20);
        for (const slot of this.reelStrip.children) {
            slot.position.y = viewportH / 2;
        }

        this._spinFinalIndex = finalIndex;
        this._spinElapsed = 0;
        this._recomputeSpinTargets(); // berechnet this._spinStartX/this._spinEndX aus dem AKTUELLEN viewportW

        this.reelStrip.position.set(this._spinStartX, 0);

        this._reelTicker = (ticker) => {
            this._spinElapsed += ticker.deltaMS;
            const t = Math.min(1, this._spinElapsed / REEL_SPIN_DURATION);
            const eased = easeOutCubic(t);
            this.reelStrip.x = this._spinStartX + (this._spinEndX - this._spinStartX) * eased;

            if (t >= 1) {
                this.app.ticker.remove(this._reelTicker);
                this._reelTicker = null;
                this._onSpinDone(finalReward);
            }
        };
        this.app.ticker.add(this._reelTicker);
    }

    _recomputeSpinTargets() {
        const viewportW = REEL_VISIBLE_COUNT * CRATE_ITEM_W;
        this._spinStartX = viewportW / 2 - CRATE_ITEM_W / 2;
        this._spinEndX = viewportW / 2 - (this._spinFinalIndex * CRATE_ITEM_W + CRATE_ITEM_W / 2);
    }

    _onSpinDone(reward) {
        this._applyReward(reward);

        this.reelResultText.text = `YOU GOT: ${rewardLabel(reward)}`;
        this.reelResultText.style.fill = rewardColor(reward);
        this.reelResultText.visible = true;
        this.reelContinueBtn.visible = true;

        this._spinning = false;
        this.closeButton.eventMode = "static";
        this.closeButtonBg.alpha = 1;

        // NUR den Ergebnis-Bereich neu positionieren - Viewport bleibt unangetastet,
        // damit die Reel-Leiste nicht "springt".
        this._layoutReelResult();
    }

    _applyReward(reward) {
        if (reward.type === "money") {
            GAMESTATE.addMoney(reward.amount);
            return;
        }
        else if (reward.type === "part") {
            const index = HIDDEN_MANIFEST.findIndex(piece => piece.name === reward.pieceName);
            if (index === -1) {
                console.warn("Part doesnt exist anymore?");
                GAMESTATE.addMoney(1000); // sorry
                return;
            }
            GAMESTATE.unlockPart(reward.pieceName);
            this.piecesToLoadOnExit.push({...HIDDEN_MANIFEST[index]});
            HIDDEN_MANIFEST.splice(index, 1);
            return;
        }
        //property

        const config = GAMESTATE.getCurrentCarConfig();
        const property = config.properties[reward.kind];
        if (property.level >= property.maxLevel){
            console.warn("Property is already maxed?");
            GAMESTATE.addMoney(1000); // sorry
            return;
        }
        property.value += property.increase;
        property.level++;

        GAMESTATE.updateCarConfig(config);
    }

    _drawReelSlots() {
        const boxW = CRATE_ITEM_W - 10;
        const boxH = this._reelItemH;

        for (const slot of this.reelStrip.children) {
            slot._bg.clear();
            slot._bg
                .rect(0, -boxH / 2, boxW, boxH)
                .fill(COLORS.boxBg)
                .stroke({ width: 2, color: COLORS.boxBorder });

            // Label-Anchor ist 0.5/0.5 -> X-Position bei boxW/2 (Boxmitte),
            // Y-Position bei 0 (da slot.position.y bereits die Slot-Mitte ist)
            slot._label.position.set(boxW / 2, 0);
        }
    }

    // -----------------------------------------------------------------
    // Layout
    // -----------------------------------------------------------------
    layout() {
        const w = this.app.renderer.width;
        const h = this.app.renderer.height;

        this.backdrop.clear();
        this.backdrop.rect(0, 0, w, h).fill({ color: COLORS.overlayDim, alpha: 0.001 });

        // ---- Fullscreen-Panel ----
        const panelW = w;
        const panelH = h;
        this._panelW = panelW;
        this._panelH = panelH;

        drawBox(this.panelBg, panelW, panelH, COLORS.panelBg, COLORS.panelBorder, Math.max(2, h * 0.004));
        this.panel.position.set(0, 0);

        // ---- Titel ----
        this.titleText.style.fontSize = panelH * 0.045;
        this.titleText.position.set(panelW / 2, panelH * 0.03);

        // ---- Close-Button ----
        this._closeSize = panelH * 0.05;
        this._drawCloseButton(false);
        this.closeButton.position.set(panelW - panelW * 0.02 - this._closeSize, panelH * 0.02);

        // ---- Money-Panel ----
        this._layoutMoneyPanel();

        this._statusY = panelH * 0.14;

        // ---- Crate-Liste: untereinander, volle Breite ----
        const cardW = panelW * 0.5;
        const cardH = panelH * 0.11;
        const cardGap = panelH * 0.025;
        const listX = panelW / 2 - cardW / 2;
        const listStartY = panelH * 0.22;

        this._buyBtnW = cardW * 0.2;
        this._buyBtnH = cardH * 0.45;

        this._crateCards.forEach((card, i) => {
            drawBox(card.bg, cardW, cardH, COLORS.boxBg, COLORS.boxBorder, Math.max(2, cardH * 0.04));

            card.nameText.style.fontSize = cardH * 0.2;
            card.nameText.position.set(cardW * 0.05, cardH * 0.2);

            card.costText.style.fontSize = cardH * 0.16;
            card.costText.position.set(cardW * 0.05, cardH * 0.55);

            card.buyBtn.position.set(cardW - cardW * 0.05 - this._buyBtnW, cardH / 2 - this._buyBtnH / 2);

            card.card.position.set(listX, listStartY + i * (cardH + cardGap));
        });
        this._refreshAffordability();

        // ---- Reel-Viewport: feste Position, aendert sich NIE zwischen Spin/Result ----
        const viewportW = REEL_VISIBLE_COUNT * CRATE_ITEM_W;
        this._reelItemH = CRATE_ITEM_W - 10;
        const viewportH = this._reelItemH + 20;
        this._reelViewportY = panelH * 0.4; // <- einzige Quelle fuer die Y-Position der Leiste

        this.reelViewport.position.set(panelW / 2 - viewportW / 2, this._reelViewportY);

        drawBox(this.reelViewportBg, viewportW, viewportH, COLORS.boostBg, COLORS.panelBorder, 3);

        this.reelMask.clear();
        this.reelMask.rect(0, 0, viewportW, viewportH).fill(0xffffff);

        this._drawReelSlots();
        for (const slot of this.reelStrip.children) {
            slot.position.y = viewportH / 2;
        }

        const markerX = viewportW / 2;
        this.reelMarkerTop.clear();
        this.reelMarkerTop.poly([markerX - 10, -4, markerX + 10, -4, markerX, 14]).fill(COLORS.gold);
        this.reelMarkerBottom.clear();
        this.reelMarkerBottom.poly([markerX - 10, viewportH + 4, markerX + 10, viewportH + 4, markerX, viewportH - 14]).fill(COLORS.gold);

        this._reelViewportH = viewportH;
        this._layoutReelResult();

        if (this._spinning && this._spinFinalIndex != null) {
            this._recomputeSpinTargets();
            const t = Math.min(1, this._spinElapsed / REEL_SPIN_DURATION);
            const eased = easeOutCubic(t);
            this.reelStrip.x = this._spinStartX + (this._spinEndX - this._spinStartX) * eased;
        }
    }

    // Positioniert NUR Ergebnis-Text + Continue-Button, relativ zum (fixen) Viewport.
    // Wird separat von layout() UND von _onSpinDone() aufgerufen, ohne den
    // Viewport selbst neu zu berechnen -> kein Sprung mehr beim Ergebnis.
    _layoutReelResult() {
        const panelW = this._panelW;
        const resultY = this._reelViewportY + this._reelViewportH + this._panelH * 0.06;

        this.reelResultText.style.fontSize = this._panelH * 0.04;
        this.reelResultText.position.set(panelW / 2, resultY);

        this._continueBtnW = panelW * 0.2;
        this._continueBtnH = this._panelH * 0.07;
        this._drawContinueBtn(false);
        this.reelContinueBtn.position.set(
            panelW / 2 - this._continueBtnW / 2,
            resultY + this._panelH * 0.08
        );
    }

    _layoutMoneyPanel() {
        const panelW = this._panelW;
        const panelH = this._panelH;

        const moneyW = panelW * 0.16;
        const moneyH = panelH * 0.05;
        drawBox(this.moneyPanelBg, moneyW, moneyH, COLORS.panelBg, COLORS.panelBorder, Math.max(2, panelH * 0.004));
        this.moneyPanel.position.set(panelW * 0.02, panelH * 0.02);

        this.moneyLabel.style.fontSize = moneyH * 0.42;
        this.moneyLabel.position.set(moneyH * 0.25, moneyH * 0.5 - this.moneyLabel.height * 0.5);

        this.moneyText.style.fontSize = moneyH * 0.36;
        this.moneyText.position.set(this.moneyLabel.x + this.moneyLabel.width + moneyH * 0.15, moneyH * 0.5 - this.moneyText.height * 0.5);
    }
}