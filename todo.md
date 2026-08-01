

MapScene:
    - Nonkki
    - rework in general
    - restructure code into a class that extends PIXI.Container with a static func create for 
        async init work and constructor for construction of the view

Rendering:
    - get overlays/uis over the 3d world stuff (might have to separate both renderers) (in both garageScene and DriveScene)

HTML:
    - might go to fullscreen idk

DriveScene:
    - forest background something
    - better ground texture
    - clouds behind mountain
    - improve transition between horizon and mountainsSprite
    - add other cars (spawning, collisions, movement (only z), etc.)
    - add your own car (custom imported 3d model that is put together from pieces equipped by the player)
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
    - work on overlay

LoadingScreen:
    - before the game starts to load CarPieceModels and ObjectModels (forrest on the sides)