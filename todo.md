

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
        - random movements so its not fix infront of cam
        - base speed
        - add max x coords
        - turning wheels sidewise when side drive
        - turning wheels in general
        - wind effect?
    - forest background something
    - better ground texture
    - clouds behind mountain
    - improve transition between horizon and mountainsSprite
    - add other cars (spawning, collisions, movement (only z), etc.)
    - finish somehow (drive into a city??)
    - overlay Layer for distance, speed, boost, compass etc.
    - cam movement bounds in x direction
    - Load all carPieceModels and Objects before the whole game inside a loadingscreen

    LATER:
    - bioms (+ biom specific surrounding models)
    - street has curves and ground not always being flat -> little elevations

GarageScene:
    - Environtment world walls
    - many more car parts and colors
    - work on overlay -> do parts and colors section
    - store car config globally

LoadingScreen:
    - before the game starts to load CarPieceModels and ObjectModels (forrest on the sides)