

//handles the scenes of the app
//each scene (Pixi.Container) has its own name stored in scene.label
export class SceneStack {

    //PIXI.Container
    static sceneStack = [];

    ///@param app - Pixi Application
    ///@param scene - scene to be added (Pixi.Container required)
    ///@param replace - the current top scene will be removed and the new 
    //                  scene will be added to the top of the stack, otherwise the 
    //                  new scene will just be put ontop of the stack
    static pushScene(app, scene, replace = true) {

        if (replace && this.sceneStack.length > 0) {
            const oldScene = this.sceneStack.pop();

            app.stage.removeChild(oldScene);
        }

        this.sceneStack.push(scene);
        app.stage.addChild(scene);
    }

    static popScene(app) {
        if (this.sceneStack.length === 0) {
            return null;
        }
        const oldScene = this.sceneStack.pop();

        app.stage.removeChild(oldScene);
        return oldScene;
    }

    static getTopScene() {
        if (this.sceneStack.length === 0) {
            return null;
        }

        return this.sceneStack[this.sceneStack.length - 1];
    }

    static getTopSceneName() {
        const scene = this.getTopScene();

        if (!scene) {
            return null;
        }

        return scene.label;
    }

}