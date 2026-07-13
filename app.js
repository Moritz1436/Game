/* =========================================================================
   AUTO GAME - DEMO
   Einzelne HTML-Datei, PixiJS, alles vektor-gezeichnet (kein Spritesheet noetig).
   Struktur: SceneManager + mehrere Szenen (Map, TravelInfo, Drive, Workshop, Job, Race)
   ========================================================================= */

// ---- Basis-Setup: kleine interne Aufloesung, hochskaliert -> Pixel-Look ----
const W = 480, H = 270;
const app = new PIXI.Application({ width: W, height: H, backgroundColor: 0x2e9e4f, antialias:false });
document.getElementById('game').appendChild(app.view);
app.view.style.width = (W*2) + 'px';
app.view.style.height = (H*2) + 'px';

// ---- Globaler Spielzustand ----
const state = {
  money: 5000,
  gems: 8,
  currentNode: 'werkstatt',
  car: {
    color: 0xd35400,
    speedLevel: 1,   // erhoeht maxSpeed
    tireLevel: 1,    // rein kosmetisch (Felgenfarbe)
    spoiler: false
  }
};

const CAR_COLORS = [0xd35400, 0x2980b9, 0x27ae60, 0xf1c40f, 0xe74c3c, 0x8e44ad, 0xecf0f1];

// ---- Karten-Knoten & Kanten (Distanzen in Metern) ----
const nodes = {
  werkstatt:  { x: 68,  y: 57,  label: 'Werkstatt',   type: 'workshop' },
  auftrag1:   { x: 133, y: 137, label: 'Auftrag',     type: 'job' },
  rennen:     { x: 68,  y: 193, label: 'Auto Rennen', type: 'race' },
  auftrag2:   { x: 229, y: 61,  label: 'Auftrag',     type: 'job' },
  waypoint:   { x: 289, y: 175, label: 'Kreuzung',    type: 'waypoint' },
  werkstatt2: { x: 341, y: 79,  label: 'Werkstatt 2', type: 'workshop' },
};

const edges = [
  ['werkstatt', 'auftrag1', 600],
  ['auftrag1',  'rennen',   400],
  ['auftrag1',  'auftrag2', 800],
  ['auftrag2',  'waypoint', 500],
  ['waypoint',  'werkstatt2', 700],
];

function edgesFor(nodeKey){
  const out = [];
  for(const [a,b,d] of edges){
    if(a === nodeKey) out.push({ other: b, distance: d });
    if(b === nodeKey) out.push({ other: a, distance: d });
  }
  return out;
}

function fmt(n){ return Math.max(0, Math.round(n)).toLocaleString('de-DE'); }

// ---- Kleine UI-Helfer ----
function makeButton(label, w, h, opts={}){
  const c = new PIXI.Container();
  c.eventMode = 'static';
  c.cursor = 'pointer';

  const bg = new PIXI.Graphics();
  const draw = (fillColor) => {
    bg.clear();
    bg.beginFill(fillColor, 1);
    bg.lineStyle(1, 0x000000, 0.6);
    bg.drawRoundedRect(0, 0, w, h, 3);
    bg.endFill();
  };
  const baseColor = opts.color ?? 0x3d8b3d;
  const hoverColor = opts.hoverColor ?? 0x4da84d;
  draw(baseColor);
  c.addChild(bg);

  const txt = new PIXI.Text(label, {
    fontFamily: 'Courier New', fontSize: opts.fontSize ?? 11, fill: opts.textColor ?? 0xffffff, fontWeight: 'bold'
  });
  txt.anchor.set(0.5);
  txt.position.set(w/2, h/2);
  c.addChild(txt);

  c.on('pointerover', () => draw(hoverColor));
  c.on('pointerout', () => draw(baseColor));
  c.on('pointerdown', () => { if(opts.onClick) opts.onClick(); });

  return c;
}

function makeLabel(text, size, color=0xffffff){
  return new PIXI.Text(text, { fontFamily:'Courier New', fontSize:size, fill:color, fontWeight:'bold' });
}

// ---- Auto-Zeichnungen (platzhalter "Pixel-Look" per Vektor) ----
function drawCarTopDown(g, color){
  g.clear();
  // Schatten
  g.beginFill(0x000000, 0.25);
  g.drawRoundedRect(-13, -20, 26, 42, 6);
  g.endFill();
  // Karosserie
  g.beginFill(color);
  g.lineStyle(1, 0x000000, 0.5);
  g.drawRoundedRect(-12, -22, 24, 40, 6);
  g.endFill();
  // Frontscheibe
  g.beginFill(0x1b1b2a, 0.9);
  g.drawRoundedRect(-8, -16, 16, 10, 2);
  g.endFill();
  // Heckscheibe
  g.beginFill(0x1b1b2a, 0.9);
  g.drawRoundedRect(-8, 10, 16, 8, 2);
  g.endFill();
  // Scheinwerfer
  g.beginFill(0xffe98a);
  g.drawRect(-10, -22, 4, 3);
  g.drawRect(6, -22, 4, 3);
  g.endFill();
}

function drawCarSide(g, color, car){
  g.clear();
  // Boden-Schatten
  g.beginFill(0x000000, 0.25);
  g.drawEllipse(0, 46, 60, 8);
  g.endFill();

  // Karosserie (Unterbau + Kabine)
  g.beginFill(color);
  g.lineStyle(2, 0x1a1a1a, 1);
  g.drawRoundedRect(-60, 0, 120, 28, 8);
  g.endFill();

  g.beginFill(color);
  g.lineStyle(2, 0x1a1a1a, 1);
  g.moveTo(-35, 0);
  g.lineTo(-22, -22);
  g.lineTo(28, -22);
  g.lineTo(40, 0);
  g.closePath();
  g.endFill();

  // Fenster
  g.beginFill(0x1b1b2a, 0.9);
  g.moveTo(-18, -3);
  g.lineTo(-10, -18);
  g.lineTo(10, -18);
  g.lineTo(14, -3);
  g.closePath();
  g.endFill();
  g.beginFill(0x1b1b2a, 0.9);
  g.drawPolygon([16,-3, 20,-18, 26,-18, 22,-3]);
  g.endFill();

  // Spoiler
  if(car.spoiler){
    g.beginFill(0x1a1a1a);
    g.drawRect(-58, -30, 6, 14);
    g.drawRect(-64, -32, 22, 5);
    g.endFill();
  }

  // Felgenfarbe je nach Reifen-Level
  const rimColor = car.tireLevel >= 3 ? 0xf1c40f : (car.tireLevel >= 2 ? 0xecf0f1 : 0x888888);

  [-38, 34].forEach(wx => {
    g.beginFill(0x111111);
    g.drawCircle(wx, 28, 15);
    g.endFill();
    g.beginFill(rimColor);
    g.drawCircle(wx, 28, 7);
    g.endFill();
  });
}

// =========================================================================
// SCENE MANAGER
// =========================================================================
let currentScene = null;

function setScene(container){
  if(currentScene){
    if(currentScene._tickerFn) app.ticker.remove(currentScene._tickerFn);
    if(currentScene._keyHandlers) removeKeyHandlers(currentScene._keyHandlers);
    app.stage.removeChild(currentScene);
    currentScene.destroy({ children: true });
  }
  currentScene = container;
  app.stage.addChildAt(container, 0);
  updateHUD();
}

// ---- Persistenter HUD (immer oben) ----
const hud = new PIXI.Container();
const hudBg = new PIXI.Graphics();
hud.addChild(hudBg);
const hudText = new PIXI.Text('', { fontFamily:'Courier New', fontSize:11, fill:0xffffff, fontWeight:'bold' });
hud.addChild(hudText);
app.stage.addChild(hud);

function updateHUD(){
  hudBg.clear();
  hudBg.beginFill(0x111111, 0.85);
  hudBg.drawRect(0, 0, W, 16);
  hudBg.endFill();
  const loc = nodes[state.currentNode] ? nodes[state.currentNode].label : '?';
  hudText.text = `$ ${fmt(state.money)}    Standort: ${loc}`;
  hudText.position.set(5, 3);
}

// keep HUD above whatever scene got added
app.ticker.add(() => { app.stage.setChildIndex(hud, app.stage.children.length - 1); });

// ---- Keyboard handling (nur waehrend Drive-Szene aktiv) ----
const heldKeys = new Set();
function addKeyHandlers(handlers){
  window.addEventListener('keydown', handlers.down);
  window.addEventListener('keyup', handlers.up);
}
function removeKeyHandlers(handlers){
  window.removeEventListener('keydown', handlers.down);
  window.removeEventListener('keyup', handlers.up);
}

// =========================================================================
// MAP SCENE
// =========================================================================
function MapScene(){
  const c = new PIXI.Container();

  // Kanten zeichnen
  const edgeGfx = new PIXI.Graphics();
  c.addChild(edgeGfx);
  edgeGfx.lineStyle(4, 0x1e1e1e, 1);
  for(const [a,b] of edges){
    edgeGfx.moveTo(nodes[a].x, nodes[a].y);
    edgeGfx.lineTo(nodes[b].x, nodes[b].y);
  }

  const reachable = new Set(edgesFor(state.currentNode).map(e => e.other));

  for(const key in nodes){
    const n = nodes[key];
    const isCurrent = key === state.currentNode;
    const isReachable = reachable.has(key);

    const dot = new PIXI.Graphics();
    let fill = 0x555555;
    if(isReachable) fill = 0xaaaaaa;
    if(isCurrent) fill = 0xffcc00;
    dot.beginFill(fill);
    dot.lineStyle(2, 0x000000, 0.6);
    dot.drawCircle(0, 0, 9);
    dot.endFill();
    dot.position.set(n.x, n.y);

    if(isCurrent || isReachable){
      dot.eventMode = 'static';
      dot.cursor = 'pointer';
      dot.on('pointerdown', () => {
        if(isCurrent){
          openFacility(key);
        } else {
          const edge = edgesFor(state.currentNode).find(e => e.other === key);
          setScene(TravelInfoScene(key, edge.distance));
        }
      });
      dot.on('pointerover', () => dot.scale.set(1.2));
      dot.on('pointerout', () => dot.scale.set(1));
    }
    c.addChild(dot);

    if(n.label){
      const lbl = makeLabel(n.label, 9, isCurrent ? 0xffcc00 : 0xffffff);
      lbl.anchor.set(0.5, 1);
      lbl.position.set(n.x, n.y - 12);
      c.addChild(lbl);
    }
  }

  const title = makeLabel('KARTE - klicke auf deinen Standort oder eine verbundene Stadt', 8, 0xffffff);
  title.position.set(6, 254);
  c.addChild(title);

  return c;
}

function openFacility(key){
  const type = nodes[key].type;
  if(type === 'workshop') setScene(WorkshopScene(key));
  else if(type === 'job') setScene(JobScene(key));
  else if(type === 'race') setScene(RaceIntroScene(key));
  else setScene(WaypointScene(key));
}

// =========================================================================
// TRAVEL INFO SCENE (Vor dem Losfahren)
// =========================================================================
function TravelInfoScene(destKey, distance){
  const c = new PIXI.Container();

  const panel = new PIXI.Graphics();
  panel.beginFill(0xffffff);
  panel.lineStyle(3, 0x555555);
  panel.drawRoundedRect(60, 40, 360, 180, 16);
  panel.endFill();
  c.addChild(panel);

  const title = makeLabel(`${nodes[destKey].label} - ${distance}m`, 14, 0x111111);
  title.anchor.set(0.5);
  title.position.set(240, 90);
  c.addChild(title);

  const info = makeLabel('Bleib unter dem Tempolimit und weiche anderen Autos aus!', 9, 0x333333);
  info.anchor.set(0.5);
  info.position.set(240, 120);
  c.addChild(info);

  const goBtn = makeButton('Losfahren', 140, 34, {
    color: 0x27ae60, hoverColor: 0x2ecc71,
    onClick: () => setScene(DriveScene({ distance, destKey, isRace: false }))
  });
  goBtn.position.set(240 - 70, 150);
  c.addChild(goBtn);

  const cancelBtn = makeButton('Abbrechen', 100, 26, {
    color: 0x888888, hoverColor: 0xaaaaaa,
    onClick: () => setScene(MapScene())
  });
  cancelBtn.position.set(240 - 50, 195);
  c.addChild(cancelBtn);

  return c;
}

// =========================================================================
// WAYPOINT SCENE (Kreuzung ohne Funktion)
// =========================================================================
function WaypointScene(key){
  const c = new PIXI.Container();
  const txt = makeLabel('Nur eine Kreuzung - hier gibt es nichts zu tun.', 11, 0xffffff);
  txt.anchor.set(0.5);
  txt.position.set(240, 130);
  c.addChild(txt);

  const back = makeButton('Zurueck zur Karte', 160, 30, {
    onClick: () => setScene(MapScene())
  });
  back.position.set(240-80, 160);
  c.addChild(back);
  return c;
}

// =========================================================================
// WORKSHOP / GARAGE SCENE
// =========================================================================
function WorkshopScene(key){
  const c = new PIXI.Container();

  const label = makeLabel(nodes[key].label, 14, 0xffffff);
  label.position.set(10, 22);
  c.addChild(label);

  // Auto-Vorschau (Seitenansicht)
  const carPreview = new PIXI.Graphics();
  carPreview.position.set(150, 130);
  c.addChild(carPreview);
  drawCarSide(carPreview, state.car.color, state.car);

  const statsTxt = makeLabel('', 9, 0xffffff);
  statsTxt.position.set(300, 60);
  c.addChild(statsTxt);
  function refreshStats(){
    statsTxt.text =
      `Speed-Level: ${state.car.speedLevel}\n` +
      `Reifen-Level: ${state.car.tireLevel}\n` +
      `Spoiler: ${state.car.spoiler ? 'ja' : 'nein'}`;
  }
  refreshStats();

  function refreshCar(){ drawCarSide(carPreview, state.car.color, state.car); }

  const btnW = 150, btnH = 26, startY = 30, gapY = 34;

  const colorBtn = makeButton('Lackierung wechseln ($50)', btnW, btnH, {
    onClick: () => {
      if(state.money < 50) return flashMsg(c, 'Zu wenig Geld!');
      state.money -= 50;
      const idx = CAR_COLORS.indexOf(state.car.color);
      state.car.color = CAR_COLORS[(idx + 1) % CAR_COLORS.length];
      refreshCar(); updateHUD();
    }
  });
  colorBtn.position.set(300, startY);
  c.addChild(colorBtn);

  const speedBtn = makeButton('Speed-Upgrade ($500)', btnW, btnH, {
    onClick: () => {
      if(state.money < 500) return flashMsg(c, 'Zu wenig Geld!');
      state.money -= 500;
      state.car.speedLevel += 1;
      refreshStats(); updateHUD();
    }
  });
  speedBtn.position.set(300, startY + gapY);
  c.addChild(speedBtn);

  const tireBtn = makeButton('Reifen-Upgrade ($300)', btnW, btnH, {
    onClick: () => {
      if(state.money < 300) return flashMsg(c, 'Zu wenig Geld!');
      state.money -= 300;
      state.car.tireLevel += 1;
      refreshStats(); refreshCar(); updateHUD();
    }
  });
  tireBtn.position.set(300, startY + gapY*2);
  c.addChild(tireBtn);

  const spoilerBtn = makeButton('Spoiler ($800)', btnW, btnH, {
    onClick: () => {
      if(state.car.spoiler) return;
      if(state.money < 800) return flashMsg(c, 'Zu wenig Geld!');
      state.money -= 800;
      state.car.spoiler = true;
      refreshStats(); refreshCar(); updateHUD();
    }
  });
  spoilerBtn.position.set(300, startY + gapY*3);
  c.addChild(spoilerBtn);

  const back = makeButton('Zurueck zur Karte', 150, 28, {
    color: 0x888888, hoverColor: 0xaaaaaa,
    onClick: () => setScene(MapScene())
  });
  back.position.set(10, 230);
  c.addChild(back);

  return c;
}

function flashMsg(container, text){
  const t = makeLabel(text, 10, 0xff5555);
  t.position.set(150, 40);
  container.addChild(t);
  setTimeout(() => { if(t.parent) t.parent.removeChild(t); }, 1200);
}

// =========================================================================
// JOB SCENE (Auftrag)
// =========================================================================
function JobScene(key){
  const c = new PIXI.Container();

  const title = makeLabel('Auftrag: Ladung ausliefern', 13, 0xffffff);
  title.position.set(20, 30);
  c.addChild(title);

  const desc = makeLabel('Bring die Kiste zum markierten Lagerplatz\nund verdiene dir etwas Geld.', 10, 0xdddddd);
  desc.position.set(20, 55);
  c.addChild(desc);

  let done = false;
  const resultTxt = makeLabel('', 11, 0x2ecc71);
  resultTxt.position.set(20, 120);
  c.addChild(resultTxt);

  const doBtn = makeButton('Auftrag erledigen', 160, 30, {
    onClick: () => {
      if(done) return;
      done = true;
      const reward = 150 + Math.floor(Math.random()*250);
      state.money += reward;
      resultTxt.text = `Fertig! +$${reward}`;
      updateHUD();
    }
  });
  doBtn.position.set(20, 90);
  c.addChild(doBtn);

  const back = makeButton('Zurueck zur Karte', 150, 28, {
    color: 0x888888, hoverColor: 0xaaaaaa,
    onClick: () => setScene(MapScene())
  });
  back.position.set(20, 230);
  c.addChild(back);

  return c;
}

// =========================================================================
// RACE INTRO SCENE
// =========================================================================
function RaceIntroScene(key){
  const c = new PIXI.Container();
  const title = makeLabel('Auto Rennen', 14, 0xffffff);
  title.position.set(20, 30);
  c.addChild(title);

  const desc = makeLabel('Einsatz: $200  -  Gewinn bei Sieg: $600\nSchlage den Rivalen ueber 500m!', 10, 0xdddddd);
  desc.position.set(20, 55);
  c.addChild(desc);

  const startBtn = makeButton('Rennen starten ($200 Einsatz)', 200, 30, {
    color: 0xc0392b, hoverColor: 0xe74c3c,
    onClick: () => {
      if(state.money < 200) return flashMsg(c, 'Zu wenig Geld fuer den Einsatz!');
      state.money -= 200;
      updateHUD();
      setScene(DriveScene({ distance: 500, destKey: key, isRace: true }));
    }
  });
  startBtn.position.set(20, 90);
  c.addChild(startBtn);

  const back = makeButton('Zurueck zur Karte', 150, 28, {
    color: 0x888888, hoverColor: 0xaaaaaa,
    onClick: () => setScene(MapScene())
  });
  back.position.set(20, 230);
  c.addChild(back);

  return c;
}

// =========================================================================
// DRIVE SCENE (Kern-Minigame)
// =========================================================================
function DriveScene(opts){
  const { distance, destKey, isRace } = opts;
  const c = new PIXI.Container();

  // --- Strasse Hintergrund ---
  const roadLeft = 135, roadRight = 345;
  const bg = new PIXI.Graphics();
  bg.beginFill(0x2e9e4f);
  bg.drawRect(0, 0, W, H);
  bg.endFill();
  bg.beginFill(0x2b2b2b);
  bg.drawRect(roadLeft, 0, roadRight - roadLeft, H);
  bg.endFill();
  bg.beginFill(0xffffff);
  bg.drawRect(roadLeft, 0, 3, H);
  bg.drawRect(roadRight - 3, 0, 3, H);
  bg.endFill();
  c.addChild(bg);

  const laneX = [170, 240, 310];
  const dividerX = [205, 275];

  // Fahrbahn-Striche (wiederverwendete Objekte, nur Position aendert sich)
  const dashCountPerLine = 8, dashSpacing = 40;
  const dashes = [];
  dividerX.forEach(dx => {
    for(let i=0;i<dashCountPerLine;i++){
      const d = new PIXI.Graphics();
      d.beginFill(0xffffff);
      d.drawRect(-2, -12, 4, 24);
      d.endFill();
      d.position.set(dx, -40 + i*dashSpacing);
      c.addChild(d);
      dashes.push(d);
    }
  });

  // --- Spieler ---
  const player = { lane: 1, speed: 90, x: laneX[1] };
  const maxSpeed = 140 + state.car.speedLevel * 20;
  const minSpeed = 40;
  const baseSpeed = 90;
  const speedLimit = 130;
  const playerScreenY = 215;

  const playerGfx = new PIXI.Graphics();
  drawCarTopDown(playerGfx, state.car.color);
  playerGfx.position.set(player.x, playerScreenY);
  c.addChild(playerGfx);

  // --- Rivale (nur beim Rennen) ---
  let rivalMeters = 0;
  const rivalSpeed = 95 + Math.random()*20;
  let rivalGfx = null;
  if(isRace){
    rivalGfx = new PIXI.Graphics();
    drawCarTopDown(rivalGfx, 0x3355ff);
    rivalGfx.position.set(laneX[0], playerScreenY);
    c.addChild(rivalGfx);
  }

  // --- Andere Autos ---
  const otherCars = [];
  const otherColors = [0x555555, 0x999999, 0xcccccc, 0xaa3333, 0x336699];
  let spawnTimer = 0;
  function spawnCar(){
    const lane = Math.floor(Math.random()*3);
    const speed = 60 + Math.random()*90;
    const g = new PIXI.Graphics();
    drawCarTopDown(g, otherColors[Math.floor(Math.random()*otherColors.length)]);
    g.rotation = Math.PI; // entgegen der Blickrichtung (kommt von vorne)
    g.position.set(laneX[lane], -30);
    c.addChild(g);
    otherCars.push({ lane, speed, gfx: g, y: -30 });
  }

  // --- HUD Elemente der Drive-Szene ---
  const progressBg = new PIXI.Graphics();
  progressBg.beginFill(0x000000, 0.6);
  progressBg.drawRect(20, 22, W-40, 10);
  progressBg.endFill();
  c.addChild(progressBg);
  const progressBar = new PIXI.Graphics();
  c.addChild(progressBar);
  const progressTxt = makeLabel('', 8, 0xffffff);
  progressTxt.position.set(20, 34);
  c.addChild(progressTxt);

  const speedTxt = makeLabel('', 12, 0xffffff);
  speedTxt.position.set(W-90, 22);
  c.addChild(speedTxt);

  const policeBarBg = new PIXI.Graphics();
  policeBarBg.beginFill(0x000000, 0.6);
  policeBarBg.drawRect(20, 46, 100, 6);
  policeBarBg.endFill();
  c.addChild(policeBarBg);
  const policeBar = new PIXI.Graphics();
  c.addChild(policeBar);
  const policeTxt = makeLabel('Tempolimit: ' + speedLimit, 7, 0xff8888);
  policeTxt.position.set(124, 44);
  c.addChild(policeTxt);

  let rivalTxt = null;
  if(isRace){
    rivalTxt = makeLabel('', 8, 0x88aaff);
    rivalTxt.position.set(20, 58);
    c.addChild(rivalTxt);
  }

  const overlay = new PIXI.Container();
  overlay.visible = false;
  c.addChild(overlay);
  const overlayBg = new PIXI.Graphics();
  overlayBg.beginFill(0x000000, 0.75);
  overlayBg.drawRect(0, 0, W, H);
  overlayBg.endFill();
  overlay.addChild(overlayBg);
  const overlayTxt = makeLabel('', 14, 0xffffff);
  overlayTxt.anchor.set(0.5);
  overlayTxt.position.set(W/2, H/2);
  overlay.addChild(overlayTxt);

  // --- State ---
  let metersTraveled = 0;
  let timeOverLimit = 0;
  let ended = false;
  let roadScroll = 0;
  const pixelsPerMeter = 0.4;

  function endDrive(cb, delay=1600){
    if(ended) return;
    ended = true;
    setTimeout(cb, delay);
  }

  function showOverlay(text, color=0xffffff){
    overlayTxt.text = text;
    overlayTxt.style.fill = color;
    overlay.visible = true;
  }

  // --- Keyboard ---
  function changeLane(dir){
    if(ended) return;
    player.lane = Math.max(0, Math.min(2, player.lane + dir));
  }
  const keyHandlers = {
    down: (e) => {
      const k = e.key.toLowerCase();
      if(k === 'a' || k === 'arrowleft') changeLane(-1);
      if(k === 'd' || k === 'arrowright') changeLane(1);
      heldKeys.add(k);
    },
    up: (e) => { heldKeys.delete(e.key.toLowerCase()); }
  };
  addKeyHandlers(keyHandlers);
  c._keyHandlers = keyHandlers;

  // --- Ticker ---
  function tick(){
    if(ended){
      // waehrend Overlay: nichts mehr updaten
      return;
    }
    const dt = app.ticker.deltaMS / 1000;

    // Beschleunigung / Bremsen
    const accel = 60, brake = 90, ease = 40;
    if(heldKeys.has('w') || heldKeys.has('arrowup')){
      player.speed += accel * dt;
    } else if(heldKeys.has('s') || heldKeys.has('arrowdown')){
      player.speed -= brake * dt;
    } else {
      player.speed += (baseSpeed - player.speed) * Math.min(1, ease*dt/60);
    }
    player.speed = Math.max(minSpeed, Math.min(maxSpeed, player.speed));

    // Position (glatt zur Ziel-Spur bewegen)
    const targetX = laneX[player.lane];
    player.x += (targetX - player.x) * Math.min(1, 10*dt);
    playerGfx.position.set(player.x, playerScreenY);

    // Distanz
    metersTraveled += player.speed * dt / 3.6;
    const pct = Math.min(1, metersTraveled/distance);
    progressBar.clear();
    progressBar.beginFill(0x2ecc71);
    progressBar.drawRect(20, 22, (W-40)*pct, 10);
    progressBar.endFill();
    progressTxt.text = `${fmt(metersTraveled)} / ${distance}m`;
    speedTxt.text = `${Math.round(player.speed)} km/h`;
    speedTxt.style.fill = player.speed > speedLimit ? 0xff5555 : 0xffffff;

    // Polizei-Logik
    if(player.speed > speedLimit){
      timeOverLimit += dt;
    } else {
      timeOverLimit = Math.max(0, timeOverLimit - dt*2);
    }
    policeBar.clear();
    policeBar.beginFill(0xff3333);
    policeBar.drawRect(20, 46, 100*Math.min(1,timeOverLimit/3), 6);
    policeBar.endFill();

    if(timeOverLimit >= 3){
      timeOverLimit = 0;
      player.speed = speedLimit * 0.7;
      state.money = Math.max(0, state.money - 200);
      updateHUD();
      showOverlay('Von der Polizei geblitzt!\n-$200', 0xff6666);
      setTimeout(() => { if(overlay.visible && !ended) overlay.visible = false; }, 1200);
    }

    // Strasse scrollen
    roadScroll += player.speed/3.6*dt*pixelsPerMeter;
    dashes.forEach(d => {
      d.y += player.speed/3.6*dt*pixelsPerMeter;
      if(d.y > H+20) d.y -= dashCountPerLine*dashSpacing;
    });

    // Andere Autos
    spawnTimer -= dt;
    if(spawnTimer <= 0){
      spawnCar();
      spawnTimer = 0.8 + Math.random()*1.4;
    }
    for(let i = otherCars.length-1; i>=0; i--){
      const oc = otherCars[i];
      oc.y += (player.speed - oc.speed)/3.6*dt*pixelsPerMeter*60/60;
      // (Skalierung bereits in pixelsPerMeter enthalten, dt liefert reale Rate)
      oc.gfx.position.set(laneX[oc.lane], oc.y);

      // Kollision
      if(!ended && oc.lane === player.lane && Math.abs(oc.y - playerScreenY) < 22){
        const fee = 150 + Math.floor(Math.random()*100);
        state.money = Math.max(0, state.money - fee);
        updateHUD();
        showOverlay(`Unfall! Abschleppkosten: -$${fee}`, 0xff5555);
        endDrive(() => setScene(MapScene()));
      }

      if(oc.y > H+40 || oc.y < -60){
        c.removeChild(oc.gfx);
        oc.gfx.destroy();
        otherCars.splice(i,1);
      }
    }

    // Rivale (Rennen)
    if(isRace && !ended){
      rivalMeters += rivalSpeed * dt / 3.6;
      const rivalScreenY = playerScreenY - (metersTraveled - rivalMeters) * pixelsPerMeter;
      rivalGfx.position.set(laneX[0], Math.max(-30, Math.min(H+30, rivalScreenY)));
      rivalTxt.text = `Du: ${fmt(metersTraveled)}m   Rivale: ${fmt(rivalMeters)}m`;

      if(rivalMeters >= distance && metersTraveled < distance){
        showOverlay('Verloren! Der Rivale war schneller.', 0xff8888);
        endDrive(() => setScene(MapScene()));
      }
    }

    // Ankunft
    if(!ended && metersTraveled >= distance){
      if(isRace){
        const prize = 600;
        state.money += prize;
        updateHUD();
        showOverlay(`Gewonnen! +$${prize}`, 0x66ff66);
      } else {
        state.currentNode = destKey;
        updateHUD();
        showOverlay(`Angekommen in\n${nodes[destKey].label}!`, 0x66ff66);
      }
      endDrive(() => setScene(MapScene()));
    }
  }

  app.ticker.add(tick);
  c._tickerFn = tick;

  return c;
}

// =========================================================================
// START
// =========================================================================
setScene(MapScene());