

MapScene:
    - more bioms (more forest types, ice, jungle) + specific things like trees, flowers
    - improve loading speed
    - something that tells you that a gear is a workshop

Rendering:
    - add light to the ground and road (use lit Shader)

HTML:
    - save and load settings
    - profile
    - insane loading times for models (only load used pieces for cars and preload everything at the start??)

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
    -exaust getting red at boost
    - Car spawning, not via waves with 1 empty, but pre made patterns
    - car behaviour, maybe change lanes, different speed & changing speed -> front & brake lights and indicators?
    - straßenschilder (über straße und seite) + laternen (light source!)
    - meshes runterkriegen!! tris sind egal und dann light_sources (tris bis 10mio ok)
        main problem are objects: 35 (objects per side) * 12 (chunks per side) * 2 (sides) = 840 Meshes!!
        solution: 
            - 5 tree_clusters with 4-6 trees @ lod med and high
            - random rotate and scale clusters
            - remove lod low
            - objectperchunk in der ferne auch weniger

    LATER:
    - bioms (+ biom specific surrounding models)
    - street has curves and ground not always being flat -> little elevations

GarageScene:
    - Environment world walls, maybe timesquare at night model, that your in the middle of a street and all sides are buildings
    - many more car partsr
    - brakes turn as well on tires ...
    - motorhaube
    - bmw_front_lights as a part for different light shapes
    - unterbodenbeleuchtung -> probably as a mesh and then same as back_lights and front_lights
    - front of car as part
    - exaust