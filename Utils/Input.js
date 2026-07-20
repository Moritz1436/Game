export class Input {
    static keys = {};

    static init() {
        window.addEventListener("keydown", e => {
            Input.keys[e.code] = true;
        });

        window.addEventListener("keyup", e => {
            Input.keys[e.code] = false;
        });
    }

    //call with "KeyW"
    static isKeyDown(key){
        return Input.keys[key];
    }
}