
//matrix for rotating from x to -z
export const ROT_X_TO_NEGZ = [
    0, 0, -1,
    0, 1,  0,
    1, 0,  0
];


export function computeScaleForWidth(baseAsset, desiredWorldWidth, axis = "x") {
    const baseWidth = baseAsset.size[axis];
    if (baseWidth <= 0) {
        console.warn(`computeScaleForWidth: base asset "${baseAsset.pieceName}" has zero/invalid width, falling back to scale 1`);
        return 1;
    }
    return desiredWorldWidth / baseWidth;
}


///@brief shrinks an AABB toward its own center by a given factor: bounds *= factor
export function shrinkBounds(bounds, factor) {
    const center = {
        x: (bounds.min.x + bounds.max.x) * 0.5,
        y: (bounds.min.y + bounds.max.y) * 0.5,
        z: (bounds.min.z + bounds.max.z) * 0.5,
    };
    const half = {
        x: (bounds.max.x - bounds.min.x) * 0.5 * factor,
        y: (bounds.max.y - bounds.min.y) * 0.5 * factor,
        z: (bounds.max.z - bounds.min.z) * 0.5 * factor,
    };
    return {
        min: { x: center.x - half.x, y: center.y - half.y, z: center.z - half.z },
        max: { x: center.x + half.x, y: center.y + half.y, z: center.z + half.z },
    };
}