

MapScene:
    - more bioms (more forest types, ice, jungle) + specific things like trees, flowers

Rendering:
    - maybe get some kind of lightsource so car_lights can shine a little (kills performance, especially in DriveScene, optimize objects, tris and meshes first)

HTML:
    - might go to fullscreen idk
    - save and load settings
    - profile

RaceScene -> invest and then money making:
    - todo
Casino -> straight up gambling your money (ingame)
ShopScene:
    - design
    - more crates
    - infos on crate for chances
    - mehr sucht: pulsierende Boxen und ZielItem nicht mittig treffen sondern so knapp und mit zurückbouncen
    - more rewards: "maybe double money for 10min", "double speed for 10min"
    - also add parts as rewards that can also be bought, random parts that i dont own

QuestScene:
    - more tasks

GasStationScene -> viewing other peoples car (online)
    - todo

DriveScene:
    - better ground texture
    - finish somehow (drive into a city??)
    - Car spawning, not via waves with 1 empty, but pre made patterns
    - wind looks ugly
    - straßenschilder (über straße und seite) + laternen (light source!)
    - meshes runterkriegen!! tris sind egal und dann light_sources (tris bis 10mio ok)
        main problem are objects: 35 (objects per side) * 12 (chunks per side) * 2 (sides) * 2 (meshes per obj on avg) = 1680 Meshes!!
        solution: low res -> tree-groups; image texture for each obj instead of base color -> meshes / 2
    - fade out at the end
    - city: trees are inside buildings grr

    LATER:
    - bioms (+ biom specific surrounding models)
    - street has curves and ground not always being flat -> little elevations
    - kreuzungen mit kreuzverkehr + ampeln

GarageScene:
    - Environment world walls
    - many more car parts
    - brakes turn as well on tires ...