
//matrix for rotating from x to -z
export const ROT_X_TO_NEGZ = [
    0, 0, -1,
    0, 1,  0,
    1, 0,  0
];

export function rotationY(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);

    return [
         c, 0,  s,
         0, 1,  0,
        -s, 0,  c
    ];
}

export function rotationX(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);

    return [
        1,  0,  0,
        0,  c,  s,
        0, -s,  c
    ];
}

export function rotationZ(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);

    return [
        c,  s,  0,
        -s, c,  0,
        0,  0,  1
    ];
}


export function computeScaleForWidth(baseAsset, desiredWorldWidth) {
    const baseWidth = baseAsset.size.x;
    if (baseWidth <= 0) {
        console.warn(`computeScaleForWidth: base asset "${baseAsset.pieceName}" has zero/invalid width, falling back to scale 1`);
        return 1;
    }
    return desiredWorldWidth / baseWidth;
}