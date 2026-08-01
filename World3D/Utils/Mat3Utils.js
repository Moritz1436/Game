
function rotX(a) {
    const c = Math.cos(a), s = Math.sin(a);
    return [1,0,0,  0,c,s,  0,-s,c]; // column-major
}
function rotY(a) {
    const c = Math.cos(a), s = Math.sin(a);
    return [c,0,-s,  0,1,0,  s,0,c];
}
function rotZ(a) {
    const c = Math.cos(a), s = Math.sin(a);
    return [c,s,0,  -s,c,0,  0,0,1];
}

export function mirrorX() {
    return [-1,0,0,  0,1,0,  0,0,1];
}

export function mirrorZ() {
    return [1,0,0,  0,1,0,  0,0,-1];
}

export function mat3Mul(A, B) {
    const out = new Array(9);
    for (let c = 0; c < 3; c++) {
        for (let r = 0; r < 3; r++) {
            let sum = 0;
            for (let k = 0; k < 3; k++) sum += A[k*3+r] * B[c*3+k];
            out[c*3+r] = sum;
        }
    }
    return out;
}

// rot3d: {x, y, z} in Radiant. Reihenfolge hier: erst Z (Roll), dann X (Pitch), dann Y (Yaw).
// Passe die Reihenfolge an dein Bedürfnis an (z.B. für Autos reicht meist nur Y = Lenkwinkel/Heading).
export function eulerToMat3(rot3d) {
    const Rz = rotZ(rot3d.z);
    const Rx = rotX(rot3d.x);
    const Ry = rotY(rot3d.y);
    return mat3Mul(mat3Mul(Ry, Rx), Rz);
}

export const IDENTITY_MAT3 = [1,0,0, 0,1,0, 0,0,1];


export function mat3Transpose(m) {
    return [
        m[0], m[3], m[6],
        m[1], m[4], m[7],
        m[2], m[5], m[8],
    ];
}

export function mat3TransformVec3(m, v) {
    return {
        x: m[0]*v.x + m[3]*v.y + m[6]*v.z,
        y: m[1]*v.x + m[4]*v.y + m[7]*v.z,
        z: m[2]*v.x + m[5]*v.y + m[8]*v.z,
    };
}