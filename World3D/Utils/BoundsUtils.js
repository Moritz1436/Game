import { IDENTITY_MAT3, mat3TransformVec3 } from "./Mat3Utils.js";

export function transformBounds(bounds, pos, scale, rotationMatrix = IDENTITY_MAT3) {
    const corners = [
        { x: bounds.min.x, y: bounds.min.y, z: bounds.min.z },
        { x: bounds.min.x, y: bounds.min.y, z: bounds.max.z },
        { x: bounds.min.x, y: bounds.max.y, z: bounds.min.z },
        { x: bounds.min.x, y: bounds.max.y, z: bounds.max.z },
        { x: bounds.max.x, y: bounds.min.y, z: bounds.min.z },
        { x: bounds.max.x, y: bounds.min.y, z: bounds.max.z },
        { x: bounds.max.x, y: bounds.max.y, z: bounds.min.z },
        { x: bounds.max.x, y: bounds.max.y, z: bounds.max.z },
    ];

    const first = mat3TransformVec3(rotationMatrix, corners[0]);

    const result = {
        min: {
            x: pos.x + first.x * scale,
            y: pos.y + first.y * scale,
            z: pos.z + first.z * scale,
        },
        max: {
            x: pos.x + first.x * scale,
            y: pos.y + first.y * scale,
            z: pos.z + first.z * scale,
        },
    };

    for (let i = 1; i < corners.length; i++) {
        const p = mat3TransformVec3(rotationMatrix, corners[i]);

        const x = pos.x + p.x * scale;
        const y = pos.y + p.y * scale;
        const z = pos.z + p.z * scale;

        result.min.x = Math.min(result.min.x, x);
        result.min.y = Math.min(result.min.y, y);
        result.min.z = Math.min(result.min.z, z);

        result.max.x = Math.max(result.max.x, x);
        result.max.y = Math.max(result.max.y, y);
        result.max.z = Math.max(result.max.z, z);
    }

    return result;
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