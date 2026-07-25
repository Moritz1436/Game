

MapScene:
    - Nonkki
    - rework in general
    - restructure code into a class that extends PIXI.Container with a static func create for 
        async init work and constructor for construction of the view


DriveScene:
    - ObjectManager: LOD!!! Performance!!!
    - clouds behind mountain
    - improve transition between ground and mountains
    - add other cars (spawning, collisions, movement (only z), etc.)
    - add your own car (custom imported 3d model that is put together from pieces quipped by the player)
    - finish somehow (drive into a city??)

    - (maybe) own 3d vertex shader to render on gpu (currently using cpu)

GarageScene:
    - create it
