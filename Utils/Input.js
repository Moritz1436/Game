export class Input {
    static keys = {};
    static mouseButtons = {};

    static init() {
        window.addEventListener("keydown", e => {
            Input.keys[e.code] = true;
        });

        window.addEventListener("keyup", e => {
            Input.keys[e.code] = false;
        });

        window.addEventListener("mousedown", e => {
            Input.mouseButtons[e.button] = true;
        });

        window.addEventListener("mouseup", e => {
            Input.mouseButtons[e.button] = false;
        });
    }

    //call with "KeyW"
    static isKeyDown(key){
        return Input.keys[key];
    }

    // 0 = left, 1 = middle, 2 = right
    static isMouseDown(button) {
        return Input.mouseButtons[button] ?? false;
    }
}