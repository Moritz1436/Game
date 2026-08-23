


export class UIScene {
    
    constructor(app, sceneName = "UIScene") {
        this.app = app;
        this.label = sceneName;

        this.topMost = false;

        //will be rendered with a z-index
        this.world3dScene = null;

        //will be rendered on top of the world3dScene without any z-index based on the order of adding children
        this.uiScene = null;
    }

}