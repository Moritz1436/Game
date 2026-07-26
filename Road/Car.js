

/* Plan

    class CarPieceAsset extends ModelAsset
        member type 'Base' | 'Tire'
        member name 'Base' | 'Tire_FL'
        member sockets []
            -> {name, accepts_type, position}
            -> {name, accepts_type, position}
            -> {name, accepts_type, position}

    class CarPieceInstance extends ModelInstance {
        member shared_asset
        member bool boundsChanged
        member parent
        member children []
            -> CarPieceInstance
            -> CarPieceInstance
        member update(){
            foreach(child in children) child.update()
        }
        member attachChild(socketName, piece) {
            if (this.shared_asset.sockets.has(socketName)){
                if (none of this.children.shared_asset.name == socketName){
                    this.children.add(piece)
                }
            }
        }
        member removeChild(socketName) {
            foreach (child in children) {
                if (child.shared_asset.name == socketName){
                    child.destroy();
                    children.remove(child)
                    break;
                }
            }
        }
    }

    class Car extends Object3D
        member float speed
        member CarPieceInstance rootPiece
        member checkCollision() {
            check recursive all children of rootPiece and get bounds
            maybe each CarPieceInstance gets a flag boundsChanged when a child was added/removed
        }
        member update(){
            rootPiece.update()
        }
        member move() {
            this.pos3d += delta * speed
        }
        member importConfig()
        member exportConfig()
        member changeLOD(high | med | low)


    class CarManager {
        member Car player_car
        member enemy_cars Car[]

        member spawnCar()
        member destroyCar()

        member update()
        member checkCollision()
    }

*/