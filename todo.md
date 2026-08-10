

MapScene:
    - Nonkki
    - rework in general
    - restructure code into a class that extends PIXI.Container with a static func create for 
        async init work and constructor for construction of the view

Rendering:
    - maybe get some kind of lightsource so car_lights can shine a little

HTML:
    - might go to fullscreen idk
    - save and load settings

DriveScene:
    - own Car:
        - wind effect?
    - forest background something
    - better ground texture
    - clouds behind mountain
    - improve transition between horizon and mountainsSprite
    - add other cars (spawning, collisions, movement (only z), etc.)
    - finish somehow (drive into a city??)
    - overlay Layer for distance, speed, boost, compass, close etc.

    LATER:
    - bioms (+ biom specific surrounding models)
    - street has curves and ground not always being flat -> little elevations

GarageScene:
    - Environment world walls
    - many more car parts and colors
    - better design for overlay
    - implement non visual settings. Cars properties like speed, boost_value, boost_time (indirect via engine, turbo)
    - turn car via drag
    - recolor icons on the side