export function transformBounds(localBounds, worldPos, worldScale) {
    return {
        min: {
            x: worldPos.x + localBounds.min.x * worldScale,
            y: worldPos.y + localBounds.min.y * worldScale,
            z: worldPos.z + localBounds.min.z * worldScale,
        },
        max: {
            x: worldPos.x + localBounds.max.x * worldScale,
            y: worldPos.y + localBounds.max.y * worldScale,
            z: worldPos.z + localBounds.max.z * worldScale,
        },
    };
}

export function mergeBounds(a, b) {
    if (!a) return b;
    if (!b) return a;
    return {
        min: {
            x: Math.min(a.min.x, b.min.x),
            y: Math.min(a.min.y, b.min.y),
            z: Math.min(a.min.z, b.min.z),
        },
        max: {
            x: Math.max(a.max.x, b.max.x),
            y: Math.max(a.max.y, b.max.y),
            z: Math.max(a.max.z, b.max.z),
        },
    };
}

export function aabbOverlap(a, b) {
    return (
        a.min.x <= b.max.x && a.max.x >= b.min.x &&
        a.min.y <= b.max.y && a.max.y >= b.min.y &&
        a.min.z <= b.max.z && a.max.z >= b.min.z
    );
}


export function getAABBCorners(aabb) {
    const min = aabb.min;
    const max = aabb.max;

    return [
        { x: min.x, y: min.y, z: min.z },
        { x: max.x, y: min.y, z: min.z },
        { x: min.x, y: max.y, z: min.z },
        { x: max.x, y: max.y, z: min.z },

        { x: min.x, y: min.y, z: max.z },
        { x: max.x, y: min.y, z: max.z },
        { x: min.x, y: max.y, z: max.z },
        { x: max.x, y: max.y, z: max.z },
    ];
}