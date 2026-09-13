import * as PIXI from "pixi.js";

//handles the scenes of the app
//each scene (UIScene) has its own name stored in scene.label
export class SceneStack {

    //Objects extending UIScene
    static sceneStack = [];
    static _eventRoot = null;
    static _eventRootDirty = true;

    ///@param scene - scene to be added (extends UIScene)
    ///@param replace - the current top scene will be removed and the new 
    //                  scene will be added to the top of the stack, otherwise the 
    //                  new scene will just be put ontop of the stack
    static pushScene(scene, replace = true) {
        if (scene.topMost) {
            if (replace && this.sceneStack.length > 0 && this.sceneStack[this.sceneStack.length - 1].topMost) {
                const oldScene = this.sceneStack.pop();
                oldScene.destroy();
            }
            this.sceneStack.push(scene);
            this._eventRootDirty = true;
            return;
        }

        let insertIdx = this.sceneStack.length;
        while (insertIdx > 0 && this.sceneStack[insertIdx - 1].topMost) insertIdx--;

        if (replace && insertIdx > 0) {
            const [oldScene] = this.sceneStack.splice(insertIdx - 1, 1, scene);
            oldScene.destroy();
            this._eventRootDirty = true;
            return;
        }

        this.sceneStack.splice(insertIdx, 0, scene);
        this._eventRootDirty = true;
    }

    ///@param topMost - true: pops first topMost scene, otherwise first normal scene
    static popScene(topMost = false) {
        if (this.sceneStack.length === 0) {
            return null;
        }

        if (topMost) {
            const last = this.sceneStack[this.sceneStack.length - 1];
            if (!last.topMost) return null;
            const oldScene = this.sceneStack.pop();
            oldScene.destroy();
            this._eventRootDirty = true;
            return oldScene;
        }

        let idx = this.sceneStack.length - 1;
        while (idx >= 0 && this.sceneStack[idx].topMost) idx--;
        if (idx < 0) return null;

        const [oldScene] = this.sceneStack.splice(idx, 1);
        oldScene.destroy();
        this._eventRootDirty = true;
        return oldScene;
    }

    static getTopScene(topMost = false) {
        if (this.sceneStack.length === 0) {
            return null;
        }

        if (topMost) {
            const last = this.sceneStack[this.sceneStack.length - 1];
            return last.topMost ? last : null;
        }

        let idx = this.sceneStack.length - 1;
        while (idx >= 0 && this.sceneStack[idx].topMost) idx--;
        if (idx < 0) return null;

        return this.sceneStack[idx];
    }

    static getTopSceneName(topMost = false) {
        const scene = this.getTopScene(topMost);

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

        if (!this._eventRoot) {
            this._eventRoot = new PIXI.Container();
            this._eventRoot.eventMode = 'passive';
        }
        if (this._eventRootDirty) {
            this._eventRoot.removeChildren();
            for (const scene of this.sceneStack) {
                if (scene.uiScene != null) this._eventRoot.addChild(scene.uiScene);
            }
            this._eventRootDirty = false;
        }
        app.renderer._lastObjectRendered = this._eventRoot;
        app.renderer.events.rootBoundary.rootTarget = this._eventRoot;
    }

}