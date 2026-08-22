
export const PAL = {
    grassLight: [141, 168, 74],
    grassDark: [108, 132, 55],
    grassShade: [90, 112, 48],
    sandLight: [238, 224, 178],
    sandDark: [216, 198, 148],
    waterShallow: [92, 189, 186],
    waterMid: [46, 130, 158],
    waterDeep: [22, 68, 96],
    pineDark: [32, 78, 46],
    pineMid: [45, 100, 58],
    pineLight: [64, 122, 70],
    trunkBrown: [92, 62, 40],
    birchTrunk: [235, 230, 220],
    birchLeaves: [162, 208, 118],
    bushGreen: [95, 138, 66],
    outline: [40, 32, 24],
    flowerColors: [[230, 220, 90], [235, 235, 245], [225, 120, 140]],

    mountainRock: [107, 96, 88],
    mountainRockLight: [151, 138, 122],
    mountainSnow: [246, 248, 250],

    desertLight: [232, 196, 132],
    desertDark: [206, 160, 96],
    desertRock: [150, 108, 74],
    cactusGreen: [90, 138, 96],
    cactusGreenDark: [70, 112, 78],
    deadWood: [120, 92, 62],

    roadShoulder: [196, 178, 138],
    roadAsphalt: [58, 58, 62],
    roadAsphaltLight: [84, 84, 90],
    roadLine: [232, 220, 180],
};

// jede Stadt bekommt eine dieser Paletten zufaellig zugewiesen, damit
// Staedte sich optisch klar unterscheiden (Ziegel-Stadt, Beton-Stadt, ...)
export const CITY_PALETTES = [
    { wall: [214, 199, 168], wallDark: [190, 174, 142], roof: [164, 58, 46], roofDark: [132, 44, 36],
      blockWall: [176, 176, 182], blockWallDark: [150, 150, 158], blockRoof: [96, 100, 108],
      window: [140, 178, 196], windowLit: [250, 224, 140], door: [90, 58, 36] },
    { wall: [223, 214, 196], wallDark: [199, 188, 166], roof: [92, 74, 56], roofDark: [70, 56, 42],
      blockWall: [158, 168, 176], blockWallDark: [132, 142, 152], blockRoof: [76, 84, 94],
      window: [150, 170, 182], windowLit: [255, 232, 160], door: [64, 46, 34] },
    { wall: [235, 222, 196], wallDark: [210, 196, 168], roof: [176, 90, 58], roofDark: [142, 70, 44],
      blockWall: [198, 190, 168], blockWallDark: [172, 164, 142], blockRoof: [112, 104, 90],
      window: [130, 168, 178], windowLit: [255, 220, 150], door: [96, 60, 32] },
    { wall: [206, 214, 220], wallDark: [180, 190, 198], roof: [120, 64, 60], roofDark: [92, 48, 46],
      blockWall: [140, 150, 166], blockWallDark: [112, 122, 138], blockRoof: [70, 78, 92],
      window: [120, 150, 168], windowLit: [248, 222, 150], door: [70, 50, 40] },
];

// Stadt-Merkmale: jede Stadt bekommt GENAU eines (Mehrfachvergabe an
// verschiedene Staedte erlaubt), sichtbar als kleines Abzeichen ueber der
// Stadt (siehe drawCityBadge)
export const CITY_FEATURES = ['werkstatt', 'quest', 'shop', 'tankstelle', 'rennen'];
export const CITY_FEATURE_COLORS = {
    werkstatt: [124, 112, 100],
    quest: [235, 196, 60],
    shop: [90, 150, 90],
    tankstelle: [190, 60, 50],
    rennen: [40, 40, 44],
};
