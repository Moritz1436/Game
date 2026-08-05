

//handles the scenes of the app
//each scene (UIScene) has its own name stored in scene.label
export class SceneStack {

    //Objects extending UIScene
    static sceneStack = [];

    ///@param scene - scene to be added (extends UIScene)
    ///@param replace - the current top scene will be removed and the new 
    //                  scene will be added to the top of the stack, otherwise the 
    //                  new scene will just be put ontop of the stack
    static pushScene(scene, replace = true) {

        if (replace && this.sceneStack.length > 0) {
            const oldScene = this.sceneStack.pop();

            oldScene.destroy();
        }

        this.sceneStack.push(scene);
    }

    static popScene() {
        if (this.sceneStack.length === 0) {
            return null;
        }
        const oldScene = this.sceneStack.pop();

        oldScene.destroy();
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

    static render(app) {
        const gl = app.renderer.gl;
        let c = true;

        for (const scene of this.sceneStack) {
            if (scene.world3dScene != null) {
                gl.enable(gl.DEPTH_TEST);
                app.renderer.render({container: scene.world3dScene, clear: c});
                c = false;
            }
            if (scene.uiScene != null) {
                gl.disable(gl.DEPTH_TEST);
                app.renderer.render({container: scene.uiScene, clear: c});
                c = false;
            }
        }
    }

}