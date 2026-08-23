import * as PIXI from "pixi.js";
import { UIScene } from "../Utils/UIScene.js";
import { generateQuestList } from "./Quests.js";
import { GAMESTATE } from "../GameState.js";
import { COLORS } from "../Colors.js";
import { pixelText, drawBox } from "../Utils/UI.js";
import { NotifScreen } from "../NotifScreen.js";
import { SceneStack } from "../Utils/SceneStack.js";
import { MapScene } from "../Map/MapScene.js";
import { MAP_SEED } from "../GlobalAssets.js";


export function formatRemaining(ms) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
}

// ---------------------------------------------------------------------
// createButton - simpler klickbarer Button-Container mit Label, Hover-
// Highlight und austauschbarem Label/Callback. _w/_h/_redraw() werden
// bewusst als "public" behandelt, weil aufrufender Layout-Code (siehe
// QuestScene/NotifScreen) sie direkt von aussen setzt und danach
// _redraw(w, h) aufruft, statt eine eigene resize()-Methode zu brauchen.
// ---------------------------------------------------------------------
export function createButton(label, onClick) {
    const c = new PIXI.Container();
    c.eventMode = "static";
    c.cursor = "pointer";

    const bg = new PIXI.Graphics();
    c.addChild(bg);

    const labelText = pixelText(label, 16, COLORS.textLight);
    labelText.anchor.set(0.5, 0.5);
    c.addChild(labelText);

    c._w = 100;
    c._h = 40;
    c._label = label;
    c._onClick = onClick;
    c._hovered = false;

    c._redraw = function (w, h) {
        c._w = w;
        c._h = h;
        drawBox(
            bg, w, h,
            c._hovered ? COLORS.boxBgHover : COLORS.boxBgSelected,
            COLORS.boxBorder,
            Math.max(2, h * 0.05)
        );
        labelText.style.fontSize = h * 0.4;
        labelText.position.set(w / 2, h / 2);
    };

    c.setLabel = function (newLabel) {
        c._label = newLabel;
        labelText.text = newLabel;
    };

    c.setCallback = function (newCb) {
        c._onClick = newCb;
    };

    c.on("pointerover", () => {
        c._hovered = true;
        c._redraw(c._w, c._h);
    });
    c.on("pointerout", () => {
        c._hovered = false;
        c._redraw(c._w, c._h);
    });
    c.on("pointertap", () => {
        c._onClick && c._onClick();
    });

    c._redraw(c._w, c._h);

    return c;
}

export class QuestScene extends UIScene {

    static async create(app, world, currentCityIndex){
        return new QuestScene(app, world, currentCityIndex);
    }

    ///@param app - PIXI Application
    ///@param world - aktuelle World-Instanz (fuer Quest-Generierung)
    ///@param currentCityIndex - Index der Stadt, in der der Spieler gerade steht
    constructor(app, world, currentCityIndex) {
        super(app, "QuestScene");
        this.uiScene = new PIXI.Container();
        this.world = world;
        this.currentCityIndex = currentCityIndex;

        this.quests = generateQuestList(world, currentCityIndex, 10);

        // ---- Dimmer ----
        this.dimmer = new PIXI.Graphics();
        this.dimmer.eventMode = "static";
        this.uiScene.addChild(this.dimmer);

        // ---- Panel ----
        this.panel = new PIXI.Container();
        this.uiScene.addChild(this.panel);

        this.panelBg = new PIXI.Graphics();
        this.panel.addChild(this.panelBg);

        this.title = pixelText("QUESTS", 24, COLORS.textLight);
        this.title.anchor.set(0.5, 0);
        this.panel.addChild(this.title);

        // ---- Aktive-Quest-Banner: permanent sichtbar oben im Panel,
        // solange eine Quest laeuft. Getrennt vom lockedBanner (das war nur
        // ein Warntext ohne Countdown) - dieses hier zeigt Name+Reward+Timer
        // live.
        this.activeQuestBanner = new PIXI.Container();
        this.activeQuestBannerBg = new PIXI.Graphics();
        this.activeQuestBanner.addChild(this.activeQuestBannerBg);

        this.activeQuestNameText = pixelText("", 14, COLORS.textLight);
        this.activeQuestNameText.anchor.set(0, 0.5);
        this.activeQuestBanner.addChild(this.activeQuestNameText);

        this.activeQuestTimerText = pixelText("", 14, COLORS.gold);
        this.activeQuestTimerText.anchor.set(1, 0.5);
        this.activeQuestBanner.addChild(this.activeQuestTimerText);

        this.panel.addChild(this.activeQuestBanner);
        this.activeQuestBanner.visible = !!GAMESTATE.activeQuest;

        // Hinweis-Banner, wenn bereits eine Quest aktiv ist - Liste wird
        // dann komplett gesperrt (grau, kein Klick), analog zum
        // "maxed"-Look der Upgrade-Boxen.
        this.lockedBanner = pixelText(
            "You already have an active quest. Complete or abandon it first.",
            14, 0xd04040
        );
        this.lockedBanner.anchor.set(0.5, 0);
        this.lockedBanner.visible = false;
        this.panel.addChild(this.lockedBanner);

        // ---- Scroll-Bereich (maskiert) ----
        this.listMask = new PIXI.Graphics();
        this.panel.addChild(this.listMask);

        this.listViewport = new PIXI.Container();
        this.listViewport.mask = this.listMask;
        this.panel.addChild(this.listViewport);

        this.listContent = new PIXI.Container();
        this.listViewport.addChild(this.listContent);

        this._scrollY = 0;
        this._maxScroll = 0;
        this._buildRows();
        this._bindScroll();

        // ---- Back-Button ----
        this.backButton = createButton("BACK", async () => {
            const scene = await MapScene.create(this.app, MAP_SEED);
            SceneStack.pushScene(scene);
        });
        this.panel.addChild(this.backButton);

        this.abandonButton = null;
        if (GAMESTATE.activeQuest) {
            this.abandonButton = createButton("ABANDON QUEST", () => this._confirmAbandon());
            this.panel.addChild(this.abandonButton);
        }

        this._resizeHandler = () => this.layout();
        window.addEventListener("resize", this._resizeHandler);

        this.layout();

        this._tickerFn = () => this._updateLiveTimers();
        this.app.ticker.add(this._tickerFn);
    }

    _updateLiveTimers() {
        if (!GAMESTATE.activeQuest) return;
        const remaining = GAMESTATE.activeQuest.expiresAt - Date.now();

        this.activeQuestNameText.text = GAMESTATE.activeQuest.name;
        this.activeQuestTimerText.text = remaining > 0 ? formatRemaining(remaining) : "EXPIRED";
        this.activeQuestTimerText.style.fill = remaining > 60000 ? COLORS.gold : 0xd04040; // letzte Minute rot

        const activeRow = this._rows.find(r => r._quest.id === GAMESTATE.activeQuest.id);
        if (activeRow && activeRow._clockText) {
            activeRow._clockText.text = remaining > 0 ? `\u23F1 ${formatRemaining(remaining)}` : "\u23F1 EXPIRED";
        }

        if (remaining <= 0) {
            // Quest ist abgelaufen - automatisch verwerfen, Liste/Banner
            // aktualisieren
            GAMESTATE.activeQuest = null;
            this._refreshAfterQuestChange();
        }
    }

    // -----------------------------------------------------------------
    _buildRows() {
        this.listContent.removeChildren();
        this._rows = [];

        const isLocked = GAMESTATE.activeQuest != null;
        this.lockedBanner.visible = isLocked;

        for (const quest of this.quests) {
            const row = this._createQuestRow(quest, isLocked);
            this.listContent.addChild(row);
            this._rows.push(row);
        }
    }

_createQuestRow(quest, isLocked) {
    const row = new PIXI.Container();
    row.eventMode = "static";

    const bg = new PIXI.Graphics();
    row.addChild(bg);
    row._bg = bg;

    const nameText = pixelText(quest.name, 16, COLORS.textLight);
    nameText.anchor.set(0, 0.5);
    row.addChild(nameText);
    row._nameText = nameText;

    const starsText = pixelText(
        "\u2605".repeat(quest.difficulty) + "\u2606".repeat(5 - quest.difficulty),
        14, isLocked ? COLORS.textDim : COLORS.gold
    );
    starsText.anchor.set(1, 0.5);
    row.addChild(starsText);
    row._starsText = starsText;

    const descText = pixelText(quest.shortDesc, 12, COLORS.textDim);
    descText.anchor.set(0, 0);
    descText.style.wordWrap = true;
    row.addChild(descText);
    row._descText = descText;

    const rewardText = pixelText(`$${quest.reward}`, 13, isLocked ? COLORS.textDim : COLORS.gold);
    rewardText.anchor.set(1, 1);
    row.addChild(rewardText);
    row._rewardText = rewardText;

    row._clockText = null;
    const isActiveQuestRow = GAMESTATE.activeQuest?.id === quest.id;
    if (isActiveQuestRow) {
        row._clockText = pixelText("\u23F1", 13, COLORS.gold);
        row._clockText.anchor.set(0, 1);
        row.addChild(row._clockText);
    }

    if (isLocked) {
        row.cursor = "default";
    } else {
        row.cursor = "pointer";
        row.on("pointerover", () => this._redrawRow(row, quest, true, isLocked));
        row.on("pointerout", () => this._redrawRow(row, quest, false, isLocked));
        row.on("pointertap", () => this._openQuestDetail(quest));
    }

    row._quest = quest;
    row._isLocked = isLocked;
    return row;
}

    _redrawRow(row, quest, hovered, isLocked) {
        const bgColor = isLocked ? COLORS.boxBg : (hovered ? COLORS.boxBgHover : COLORS.boxBgSelected);
        drawBox(row._bg, row._w, row._h, bgColor, COLORS.boxBorder, Math.max(2, row._h * 0.03));
    }

    // -----------------------------------------------------------------
    _openQuestDetail(quest) {
        const notif = new NotifScreen(
            this.app,
            `${quest.name}  ${"\u2605".repeat(quest.difficulty)}${"\u2606".repeat(5 - quest.difficulty)}\n\n${quest.fullDesc}`,
            "ACCEPT",
            () => {
                GAMESTATE.acceptQuest(quest, this.currentCityIndex);
                SceneStack.popScene(); // Notif schliessen
                this._refreshAfterQuestChange();
            },
            "BACK",
            () => SceneStack.popScene()
        );
        SceneStack.pushScene(notif, false);
    }

    // -----------------------------------------------------------------
    // Scroll-Handling: Pointer-Drag + Mausrad, geclamped zwischen 0 und
    // maxScroll. Bewusst simpel gehalten (kein Inertia/Momentum), reicht
    // fuer eine Liste dieser Groesse voellig aus.
    _bindScroll() {
        let dragging = false;
        let lastY = 0;

        this.listViewport.eventMode = "static";

        const onDown = (e) => {
            dragging = true;
            lastY = e.global.y;
        };
        const onMove = (e) => {
            if (!dragging) return;
            const dy = e.global.y - lastY;
            lastY = e.global.y;
            this._setScroll(this._scrollY - dy);
        };
        const onUp = () => { dragging = false; };
        const onWheel = (e) => {
            this._setScroll(this._scrollY + e.deltaY);
            e.preventDefault?.();
        };

        this.listViewport.on("pointerdown", onDown);
        this.listViewport.on("pointermove", onMove);
        this.listViewport.on("pointerup", onUp);
        this.listViewport.on("pointerupoutside", onUp);

        // PIXI-Events kennen kein natives "wheel" - direkt am Canvas
        // registrieren
        this._onWheel = onWheel;
        this.app.canvas.addEventListener("wheel", this._onWheel, { passive: false });

        this._onDown = onDown;
        this._onMove = onMove;
        this._onUp = onUp;
    }

    _setScroll(y) {
        this._scrollY = Math.max(0, Math.min(this._maxScroll, y));
        this.listContent.y = -this._scrollY;
    }

    // -----------------------------------------------------------------
    layout() {
        const w = this.app.renderer.width;
        const h = this.app.renderer.height;

        this.dimmer.clear();
        this.dimmer.rect(0, 0, w, h).fill({ color: COLORS.overlayDim, alpha: 0.65 });

        const panelW = w * 0.7;
        const panelH = h * 0.8;
        this.panel.position.set((w - panelW) / 2, (h - panelH) / 2);
        drawBox(this.panelBg, panelW, panelH, COLORS.panelBg, COLORS.panelBorder, Math.max(2, h * 0.004));

        this.title.style.fontSize = panelH * 0.045;
        this.title.position.set(panelW / 2, panelH * 0.03);

        this.activeQuestBanner.visible = !!GAMESTATE.activeQuest;
        if (GAMESTATE.activeQuest) {
            const bannerW = panelW * 0.9;
            const bannerH = panelH * 0.06;
            drawBox(this.activeQuestBannerBg, bannerW, bannerH, COLORS.boxBg, COLORS.gold, Math.max(2, bannerH * 0.06));
            this.activeQuestBanner.position.set(panelW * 0.05, panelH * 0.08);

            this.activeQuestNameText.style.fontSize = bannerH * 0.35;
            this.activeQuestNameText.position.set(bannerW * 0.04, bannerH / 2);

            this.activeQuestTimerText.style.fontSize = bannerH * 0.35;
            this.activeQuestTimerText.position.set(bannerW * 0.96, bannerH / 2);
        }

        const isLocked = GAMESTATE.activeQuest != null;
        let listTopOffset = panelH * 0.14;
        if (isLocked) {
            this.lockedBanner.style.fontSize = panelH * 0.022;
            this.lockedBanner.style.wordWrap = true;
            this.lockedBanner.style.wordWrapWidth = panelW * 0.85;
            this.lockedBanner.style.align = "center";
            this.lockedBanner.position.set(panelW / 2, panelH * 0.10);
            listTopOffset = panelH * 0.18;
        }

        // ---- Back-/Abandon-Button ----
        const btnW = panelW * (this.abandonButton ? 0.25 : 0.25);
        const btnH = panelH * 0.08;

        if (this.abandonButton) {
            const gap = panelW * 0.03;
            const totalW = btnW * 2 + gap;
            const startX = (panelW - totalW) / 2;

            this.backButton._w = btnW;
            this.backButton._h = btnH;
            this.backButton._redraw(btnW, btnH);
            this.backButton.position.set(startX, panelH * 0.90);

            this.abandonButton._w = btnW;
            this.abandonButton._h = btnH;
            this.abandonButton._redraw(btnW, btnH);
            this.abandonButton.position.set(startX + btnW + gap, panelH * 0.90);
        } else {
            this.backButton._w = btnW;
            this.backButton._h = btnH;
            this.backButton._redraw(btnW, btnH);
            this.backButton.position.set((panelW - btnW) / 2, panelH * 0.90);
        }

        // ---- Scroll-Viewport ----
        const listX = panelW * 0.05;
        const listY = listTopOffset;
        const listW = panelW * 0.9;
        const listH = panelH * 0.90 - listY - panelH * 0.02;

        this.listMask.clear();
        this.listMask.rect(listX, listY, listW, listH).fill(0xffffff);
        this.listViewport.position.set(listX, listY);
        this.listViewport.hitArea = new PIXI.Rectangle(0, 0, listW, listH);

        // ---- Rows layouten ----
        const rowH = panelH * 0.14;
        const rowGap = panelH * 0.015;
        let y = 0;
        for (const row of this._rows) {
            row._w = listW;
            row._h = rowH;
            row.position.set(0, y);

            this._redrawRow(row, row._quest, false, row._isLocked);

            row._nameText.style.fontSize = rowH * 0.18;
            row._nameText.position.set(rowW_pad(listW), rowH * 0.22);

            row._starsText.style.fontSize = rowH * 0.15;
            row._starsText.position.set(listW - rowW_pad(listW), rowH * 0.22);

            row._descText.style.fontSize = rowH * 0.13;
            row._descText.style.wordWrapWidth = listW - rowW_pad(listW) * 2;
            row._descText.position.set(rowW_pad(listW), rowH * 0.42);

            row._rewardText.style.fontSize = rowH * 0.15;
            row._rewardText.position.set(listW - rowW_pad(listW), rowH * 0.92);

            if (row._clockText) {
                row._clockText.style.fontSize = rowH * 0.13;
                row._clockText.position.set(rowW_pad(listW), rowH * 0.92);
            }

            y += rowH + rowGap;
        }

        this._maxScroll = Math.max(0, y - rowGap - listH);
        this._setScroll(Math.min(this._scrollY, this._maxScroll));

        function rowW_pad(w) { return w * 0.04; }
    }

    // Nach Abandon (oder Accept) muss die Liste neu aufgebaut werden, weil
    // sich der "isLocked"-Zustand aendert und der Abandon-Button
    // erscheinen/verschwinden muss
    _refreshAfterQuestChange() {
        if (this.abandonButton) {
            this.panel.removeChild(this.abandonButton);
            this.abandonButton.destroy();
            this.abandonButton = null;
        }
        if (GAMESTATE.activeQuest) {
            this.abandonButton = createButton("ABANDON QUEST", () => this._confirmAbandon());
            this.panel.addChild(this.abandonButton);
        }
        this._buildRows();
        this.layout();
    }

    _confirmAbandon() {
        const cost = GAMESTATE.activeQuest.reward * 2;
        const remaining = GAMESTATE.activeQuest.expiresAt - Date.now();
        const remainingText = remaining > 0 ? formatRemaining(remaining) : "EXPIRED";

        const notif = new NotifScreen(
            this.app,
            `WARNING!\nAbandon "${GAMESTATE.activeQuest.name}" for $${cost}?\nTime remaining: ${remainingText}\nThis cannot be undone.`,
            "ABANDON",
            () => {
                GAMESTATE.spendMoney(cost, false, this.app, (success) => {
                    if (!success) {
                        this._noMoneyNotif();
                        return;
                    }
                    GAMESTATE.abandonQuest();
                    SceneStack.popScene();
                    this._refreshAfterQuestChange();
                });
            },
            "CANCEL",
            () => SceneStack.popScene()
        );
        SceneStack.pushScene(notif, false);
    }


    _noMoneyNotif() {
        const remaining = GAMESTATE.activeQuest.expiresAt - Date.now();
        const remainingText = remaining > 0 ? formatRemaining(remaining) : "EXPIRED";

        const notif = new NotifScreen(
            this.app,
            `WARNING!\nYou cannot afford to abandon this Quest, wait until it expires.\nTime remaining: ${remainingText}`,
            "OK",
            () => SceneStack.popScene()
        );
        SceneStack.pushScene(notif);
    }

    // Nach Abandon (oder Accept) muss die Liste neu aufgebaut werden, weil
    // sich der "isLocked"-Zustand aendert und der Abandon-Button
    // erscheinen/verschwinden muss
    _refreshAfterQuestChange() {
        if (this.abandonButton) {
            this.panel.removeChild(this.abandonButton);
            this.abandonButton.destroy();
            this.abandonButton = null;
        }
        if (GAMESTATE.activeQuest) {
            this.abandonButton = createButton("ABANDON QUEST", () => this._confirmAbandon());
            this.panel.addChild(this.abandonButton);
        }
        this._buildRows();
        this.layout();
    }

    destroy() {
        window.removeEventListener("resize", this._resizeHandler);
        this.app.canvas.removeEventListener("wheel", this._onWheel);
        this.app.ticker.remove(this._tickerFn);
    }
}