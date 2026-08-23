import { cityDistance } from "../Map/Roads.js";


export const QUEST_TYPES = {
    RACE: 'race',
    DELIVER_HEAVY: 'deliver_heavy',
    DRIVE_TO_CITY: 'drive_to_city',
    DRIVE_DISTANCE: 'drive_distance',
    DRIVE_TO_CITY_TIMED: 'drive_to_city_timed',
    DRIVE_DISTANCE_NO_CRASH: 'drive_distance_no_crash',
};

// Grobe Referenz-Durchschnittsgeschwindigkeit fuers Ausrechnen von
// Zeitlimits (m/s) - rein fuer die Quest-Generierung, hat nichts mit dem
// tatsaechlichen Auto-Speed-Stat zu tun.
const AVG_SPEED_MPS = 22;
const AVG_CITY_DISTANCE = 2000;

function rewardForDifficulty(difficulty, distance = AVG_CITY_DISTANCE) {
    const base = 500 + (difficulty - 1) * 1125; // 1->500, 2->1625, 3->2750, 4->3875, 5->5000
    const variance = base * (0.9 + Math.random() * 0.2); // +-10% Streuung
    const distanceBonus = Math.max(0, (distance - AVG_CITY_DISTANCE)) * 0.08;
    return Math.round(Math.min(5000, Math.max(500, variance + distanceBonus)));
}

function randomDifficulty() {
    return 1 + Math.floor(Math.random() * 5);
}

function pickRandomCityExcept(world, excludeIndex) {
    const candidates = world.cities
        .map((c, i) => i)
        .filter(i => i !== excludeIndex);
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
}

// ---- Ablaufzeit: wie lange nach Annahme Zeit bleibt, bevor die Quest
// automatisch verfaellt. Skaliert mit der voraussichtlichen Fahrzeit
// (grosszuegiger Puffer x4), mit einer Mindestzeit von 10 Minuten fuer
// Quests ohne Distanzbezug (z.B. Race).
function expiryMsForQuest(distance = AVG_CITY_DISTANCE) {
    const travelTimeMs = (distance / AVG_SPEED_MPS) * 1000;
    return Math.round(Math.max(10 * 60 * 1000, travelTimeMs * 4));
}

let _questIdCounter = 0;
function nextQuestId() {
    return `q${Date.now()}_${_questIdCounter++}`;
}

// ---- einzelne Generatoren - jeder liefert ein vollstaendiges Quest-Objekt
// oder null, falls gerade nicht genug Kontext vorhanden ist (z.B. zu wenige
// Staedte auf der Karte) ----
function generateRaceQuest(world, currentCityIndex) {
    const difficulty = randomDifficulty();
    const reward = rewardForDifficulty(difficulty);
    return {
        id: nextQuestId(),
        type: QUEST_TYPES.RACE,
        name: "Win a Race",
        difficulty,
        reward,
        expiryMs: expiryMsForQuest(), // kein Distanzbezug -> Default (10 Min)
        shortDesc: "Beat the local racers and take the prize.",
        fullDesc: `Head to a town with a race track and beat the local racers in a straight competition. \nReward: $${reward}.`,
        data: {},
    };
}

function generateDeliverHeavyQuest(world, currentCityIndex) {
    const targetCityIndex = pickRandomCityExcept(world, currentCityIndex);
    if (targetCityIndex == null) return null;
    const from = world.cities[currentCityIndex];
    const to = world.cities[targetCityIndex];
    const dist = cityDistance(from, to);
    const difficulty = randomDifficulty();
    const reward = rewardForDifficulty(difficulty, dist);
    const slowFactor = 0.65;
    return {
        id: nextQuestId(),
        type: QUEST_TYPES.DELIVER_HEAVY,
        name: "Heavy Cargo Delivery",
        difficulty,
        reward,
        expiryMs: expiryMsForQuest(dist),
        shortDesc: `Transport a heavy load to ${to.name}, ${Math.round(dist)}m away.`,
        fullDesc: `A heavy load needs transporting to ${to.name}, ${Math.round(dist)}m from here. The extra weight will slow your car down on the way there. \nReward: $${reward}.`,
        data: { targetCityIndex, distance: dist, slowFactor },
    };
}

function generateDriveToCityQuest(world, currentCityIndex) {
    const targetCityIndex = pickRandomCityExcept(world, currentCityIndex);
    if (targetCityIndex == null) return null;
    const from = world.cities[currentCityIndex];
    const to = world.cities[targetCityIndex];
    const dist = cityDistance(from, to);
    const difficulty = randomDifficulty();
    const reward = rewardForDifficulty(difficulty, dist);
    return {
        id: nextQuestId(),
        type: QUEST_TYPES.DRIVE_TO_CITY,
        name: "Road Trip",
        difficulty,
        reward,
        expiryMs: expiryMsForQuest(dist),
        shortDesc: `Drive to ${to.name}, ${Math.round(dist)}m away.`,
        fullDesc: `Simply make your way to ${to.name}, ${Math.round(dist)}m from here. No rush, no rules. \nReward: $${reward}.`,
        data: { targetCityIndex, distance: dist },
    };
}

function generateDriveDistanceQuest(world, currentCityIndex) {
    const difficulty = randomDifficulty();
    const targetDistance = Math.round(
        AVG_CITY_DISTANCE * (0.75 + difficulty * 1.2) + Math.random() * AVG_CITY_DISTANCE
    );
    const reward = rewardForDifficulty(difficulty, targetDistance);
    return {
        id: nextQuestId(),
        type: QUEST_TYPES.DRIVE_DISTANCE,
        name: "Distance Grind",
        difficulty,
        reward,
        expiryMs: expiryMsForQuest(targetDistance),
        shortDesc: `Drive a total of ${targetDistance}m.`,
        fullDesc: `Rack up ${targetDistance}m of driving, any direction, any route. \nReward: $${reward}.`,
        data: { targetDistance },
    };
}

function generateDriveToCityTimedQuest(world, currentCityIndex) {
    const targetCityIndex = pickRandomCityExcept(world, currentCityIndex);
    if (targetCityIndex == null) return null;
    const from = world.cities[currentCityIndex];
    const to = world.cities[targetCityIndex];
    const dist = cityDistance(from, to);
    const difficulty = randomDifficulty();
    const bufferFactor = 1.15 - difficulty * 0.08;
    const timeLimitSec = Math.round((dist / AVG_SPEED_MPS) * bufferFactor);
    const reward = rewardForDifficulty(difficulty, dist);
    const minutes = Math.max(1, Math.round(timeLimitSec / 60));
    return {
        id: nextQuestId(),
        type: QUEST_TYPES.DRIVE_TO_CITY_TIMED,
        name: "Against the Clock",
        difficulty,
        reward,
        expiryMs: timeLimitSec * 1000,
        shortDesc: `Reach ${to.name}, ${Math.round(dist)}m away, in ${minutes} min.`,
        fullDesc: `Get to ${to.name}, ${Math.round(dist)}m from here, within ${minutes} minutes. Cutting it close pays off. Reward: $${reward}.`,
        data: { targetCityIndex, distance: dist, timeLimitSec },
    };
}

function generateDriveDistanceNoCrashQuest(world, currentCityIndex) {
    const difficulty = randomDifficulty();
    const targetDistance = Math.round(
        AVG_CITY_DISTANCE * (0.6 + difficulty * 0.9) + Math.random() * AVG_CITY_DISTANCE * 0.6
    );
    const reward = rewardForDifficulty(difficulty, targetDistance);
    return {
        id: nextQuestId(),
        type: QUEST_TYPES.DRIVE_DISTANCE_NO_CRASH,
        name: "Clean Run",
        difficulty,
        reward,
        expiryMs: expiryMsForQuest(targetDistance),
        shortDesc: `Drive ${targetDistance}m without a single crash.`,
        fullDesc: `Drive ${targetDistance}m without crashing once. One mistake and the run is voided. \nReward: $${reward}.`,
        data: { targetDistance, noCrash: true },
    };
}

const QUEST_GENERATORS = [
    generateRaceQuest,
    generateDeliverHeavyQuest,
    generateDriveToCityQuest,
    generateDriveDistanceQuest,
    generateDriveToCityTimedQuest,
    generateDriveDistanceNoCrashQuest,
];

// Erzeugt eine Liste zufaelliger, unterschiedlicher Quests fuer die
// QuestScene. maxAttempts als Sicherheitsnetz, falls Generatoren wiederholt
// null liefern (z.B. Karte mit nur 1 Stadt).
export function generateQuestList(world, currentCityIndex, count = 10) {
    const quests = [];
    let attempts = 0;
    const maxAttempts = count * 20;
    while (quests.length < count && attempts < maxAttempts) {
        attempts++;
        const gen = QUEST_GENERATORS[Math.floor(Math.random() * QUEST_GENERATORS.length)];
        const quest = gen(world, currentCityIndex);
        if (quest) quests.push(quest);
    }
    return quests;
}