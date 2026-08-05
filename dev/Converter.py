"""
glb_to_json.py — Convert a .glb (binary glTF) file into a simple custom JSON
format for a hand-rolled model loader.

Output shape:
{
    "meshes": [
        {
            "texture": "assets/models/foo_BaseColor.jpg" | null,
            "vertices": [x, y, z,  x, y, z, ...],
            "uvs":      [u, v,  u, v, ...],
            "indices":  [i0, i1, i2, ...],
            "normals":  [n0, n1, n2, ...]
        },
        ...
    ]
}

No external glTF libraries are used (pygltflib/trimesh are not available in
every environment) — this parses the GLB container and accessors by hand
using only the standard library + numpy.

Usage:
    python3 Converter.py model.glb output.json
    python3 Converter.py model.glb output.json --texture-dir assets/models
    python3 Converter.py model.glb output.json --no-transform
"""

import sys
import os
import json
import struct
import base64
import argparse
import numpy as np
import random
import string

# --------------------------------------------------------------------------
# GLB container parsing
# --------------------------------------------------------------------------

GLB_MAGIC = 0x46546C67          # "glTF"
CHUNK_TYPE_JSON = 0x4E4F534A    # "JSON"
CHUNK_TYPE_BIN = 0x004E4942     # "BIN\0"


def read_glb(path):
    with open(path, 'rb') as f:
        data = f.read()

    magic, version, length = struct.unpack_from('<III', data, 0)
    if magic != GLB_MAGIC:
        raise ValueError(f"'{path}' is not a valid .glb file (bad magic).")

    offset = 12
    json_chunk = None
    bin_chunk = None

    while offset < length:
        chunk_len, chunk_type = struct.unpack_from('<II', data, offset)
        chunk_start = offset + 8
        chunk_data = data[chunk_start:chunk_start + chunk_len]

        if chunk_type == CHUNK_TYPE_JSON:
            json_chunk = chunk_data
        elif chunk_type == CHUNK_TYPE_BIN:
            bin_chunk = chunk_data
        # unknown chunk types are skipped

        offset = chunk_start + chunk_len

    if json_chunk is None:
        raise ValueError("No JSON chunk found in .glb file.")

    gltf = json.loads(json_chunk.decode('utf-8'))
    return gltf, bin_chunk


# --------------------------------------------------------------------------
# Buffer / accessor reading
# --------------------------------------------------------------------------

COMPONENT_TYPES = {
    5120: ('b', 1),   # BYTE
    5121: ('B', 1),   # UNSIGNED_BYTE
    5122: ('h', 2),   # SHORT
    5123: ('H', 2),   # UNSIGNED_SHORT
    5125: ('I', 4),   # UNSIGNED_INT
    5126: ('f', 4),   # FLOAT
}

TYPE_COMPONENTS = {
    'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4,
    'MAT2': 4, 'MAT3': 9, 'MAT4': 16,
}


def load_external_buffer(uri, base_dir):
    if uri.startswith('data:'):
        header, b64data = uri.split(',', 1)
        return base64.b64decode(b64data)
    path = os.path.join(base_dir, uri)
    with open(path, 'rb') as f:
        return f.read()


def get_buffer_bytes(gltf, glb_bin_chunk, buffer_index, base_dir):
    buf = gltf['buffers'][buffer_index]
    if 'uri' in buf:
        return load_external_buffer(buf['uri'], base_dir)
    # No uri -> refers to the embedded GLB binary chunk
    if glb_bin_chunk is None:
        raise ValueError(f"Buffer {buffer_index} has no uri and no BIN chunk was found.")
    return glb_bin_chunk


def read_accessor(gltf, glb_bin_chunk, base_dir, accessor_index):
    accessor = gltf['accessors'][accessor_index]
    count = accessor['count']
    num_comp = TYPE_COMPONENTS[accessor['type']]
    fmt_char, comp_size = COMPONENT_TYPES[accessor['componentType']]
    normalized = accessor.get('normalized', False)

    if accessor.get('bufferView') is None:
        # Accessor has no data (rare, sparse-only); return zeros.
        return np.zeros((count, num_comp), dtype='float32')

    buffer_view = gltf['bufferViews'][accessor['bufferView']]
    buffer_bytes = get_buffer_bytes(gltf, glb_bin_chunk, buffer_view['buffer'], base_dir)

    bv_offset = buffer_view.get('byteOffset', 0)
    acc_offset = accessor.get('byteOffset', 0)
    start = bv_offset + acc_offset

    element_size = num_comp * comp_size
    stride = buffer_view.get('byteStride', element_size)

    dtype = np.dtype(fmt_char if fmt_char != 'b' else 'i1')
    dtype_map = {'b': 'i1', 'B': 'u1', 'h': 'i2', 'H': 'u2', 'I': 'u4', 'f': 'f4'}
    np_dtype = np.dtype(dtype_map[fmt_char])

    out = np.empty((count, num_comp), dtype=np_dtype)
    for i in range(count):
        elem_start = start + i * stride
        raw = buffer_bytes[elem_start: elem_start + element_size]
        out[i] = np.frombuffer(raw, dtype=np_dtype, count=num_comp)

    out = out.astype('float64')

    if normalized:
        if fmt_char == 'B':
            out /= 255.0
        elif fmt_char == 'b':
            out = np.maximum(out / 127.0, -1.0)
        elif fmt_char == 'H':
            out /= 65535.0
        elif fmt_char == 'h':
            out = np.maximum(out / 32767.0, -1.0)

    # NOTE: sparse accessor overrides are not implemented (rare in practice
    # for simple exported models). Extend here if you hit one.
    return out


# --------------------------------------------------------------------------
# Node transforms (scene graph)
# --------------------------------------------------------------------------

def quat_to_matrix(x, y, z, w):
    xx, yy, zz = x*x, y*y, z*z
    xy, xz, yz = x*y, x*z, y*z
    wx, wy, wz = w*x, w*y, w*z
    return np.array([
        [1-2*(yy+zz),   2*(xy-wz),   2*(xz+wy), 0],
        [  2*(xy+wz), 1-2*(xx+zz),   2*(yz-wx), 0],
        [  2*(xz-wy),   2*(yz+wx), 1-2*(xx+yy), 0],
        [0, 0, 0, 1],
    ], dtype='float64')


def node_local_matrix(node):
    if 'matrix' in node:
        # glTF matrices are column-major
        m = np.array(node['matrix'], dtype='float64').reshape(4, 4).T
        return m

    t = node.get('translation', [0, 0, 0])
    r = node.get('rotation', [0, 0, 0, 1])
    s = node.get('scale', [1, 1, 1])

    T = np.eye(4)
    T[0, 3], T[1, 3], T[2, 3] = t

    R = quat_to_matrix(*r)

    S = np.eye(4)
    S[0, 0], S[1, 1], S[2, 2] = s

    return T @ R @ S


def transform_points(matrix, points):
    n = points.shape[0]
    homog = np.hstack([points, np.ones((n, 1))])
    transformed = (matrix @ homog.T).T
    return transformed[:, :3]


def transform_normals(matrix, normals):
    # Normals must be transformed by the inverse-transpose of the 3x3
    # linear part (not the full 4x4 with translation), otherwise they get
    # skewed under non-uniform scale and shifted by translation.
    linear = matrix[:3, :3]
    try:
        normal_matrix = np.linalg.inv(linear).T
    except np.linalg.LinAlgError:
        # degenerate matrix (e.g. zero scale) -> fall back to raw linear part
        normal_matrix = linear

    transformed = (normal_matrix @ normals.T).T

    lengths = np.linalg.norm(transformed, axis=1, keepdims=True)
    lengths[lengths == 0] = 1.0
    return transformed / lengths


def z_up_to_y_up(points):
    # Works for both points AND direction vectors (normals), since this is
    # a pure axis swap with no translation involved.
    # (x, y, z)_z-up  ->  (x, z, -y)_y-up   (a -90 deg rotation around X)
    out = points.copy()
    out[:, 1] = points[:, 2]
    out[:, 2] = -points[:, 1]
    return out


# --------------------------------------------------------------------------
# Texture resolution
# --------------------------------------------------------------------------

MIME_EXT = {'image/jpeg': 'jpg', 'image/png': 'png'}


def resolve_material_info(gltf, glb_bin_chunk, base_dir, material_index,
                     texture_dir, out_dir, mesh_label):
    if material_index is None:
        return None, [1.0, 1.0, 1.0, 1.0], 1.0, 1.0
    material = gltf.get('materials', [])[material_index]
    pbr = material.get('pbrMetallicRoughness', {})

    base_color_factor = pbr.get('baseColorFactor', [1.0, 1.0, 1.0, 1.0])
    metallic = pbr.get('metallicFactor', 1.0)
    roughness = pbr.get('roughnessFactor', 1.0)

    tex_ref = pbr.get('baseColorTexture')
    if tex_ref is None:
        return None, base_color_factor, metallic, roughness

    texture = gltf['textures'][tex_ref['index']]
    image_index = texture.get('source')
    if image_index is None:
        return None, base_color_factor, metallic, roughness
    image = gltf['images'][image_index]


    if 'uri' in image:
        uri = image['uri']
        if uri.startswith('data:'):
            header, b64data = uri.split(',', 1)
            mime = header.split(';')[0].replace('data:', '')
            ext = MIME_EXT.get(mime, 'bin')
            raw = base64.b64decode(b64data)
            path = _write_texture(raw, ext, texture_dir, out_dir, mesh_label)
            return path, base_color_factor, metallic, roughness
        filename = os.path.basename(uri)
        path = f"{texture_dir.rstrip('/')}/{filename}"
        return path, base_color_factor, metallic, roughness

    bv = gltf['bufferViews'][image['bufferView']]
    buffer_bytes = get_buffer_bytes(gltf, glb_bin_chunk, bv['buffer'], base_dir)
    start = bv.get('byteOffset', 0)
    raw = buffer_bytes[start: start + bv['byteLength']]
    mime = image.get('mimeType', 'image/png')
    ext = MIME_EXT.get(mime, 'bin')
    path = _write_texture(raw, ext, texture_dir, out_dir, mesh_label)
    return path, base_color_factor, metallic, roughness


def _write_texture(raw_bytes, ext, texture_dir, out_dir, mesh_label):
    random_id = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    fname = f"{mesh_label}_{random_id}.{ext}"
    with open(os.path.join(out_dir, fname), 'wb') as f:
        f.write(raw_bytes)
    return f"{texture_dir.rstrip('/')}/{fname}"


# --------------------------------------------------------------------------
# Primitive -> mesh entry
# --------------------------------------------------------------------------

def triangulate_indices(indices, mode):
    # mode: 4 = TRIANGLES (default), 5 = TRIANGLE_STRIP, 6 = TRIANGLE_FAN
    if mode in (None, 4):
        return indices
    tris = []
    if mode == 5:  # strip
        for i in range(len(indices) - 2):
            a, b, c = indices[i], indices[i+1], indices[i+2]
            if i % 2 == 0:
                tris += [a, b, c]
            else:
                tris += [b, a, c]
    elif mode == 6:  # fan
        for i in range(1, len(indices) - 1):
            tris += [indices[0], indices[i], indices[i+1]]
    else:
        raise ValueError(f"Unsupported primitive mode: {mode} (only triangle-based modes are supported)")
    return tris


def convert_primitive(gltf, glb_bin_chunk, base_dir, primitive, world_matrix,
                       texture_dir, out_dir, mesh_label, apply_transform,
                       source_z_up=False):
    attrs = primitive['attributes']
    if 'POSITION' not in attrs:
        return None

    positions = read_accessor(gltf, glb_bin_chunk, base_dir, attrs['POSITION'])[:, :3]
    if apply_transform:
        positions = transform_points(world_matrix, positions)
    if source_z_up:
        positions = z_up_to_y_up(positions)

    if 'TEXCOORD_0' in attrs:
        uvs = read_accessor(gltf, glb_bin_chunk, base_dir, attrs['TEXCOORD_0'])[:, :2]
    else:
        uvs = np.zeros((positions.shape[0], 2))

    # Normalen lesen (optional, glTF-Attribut ist nicht garantiert vorhanden)
    if 'NORMAL' in attrs:
        normals = read_accessor(gltf, glb_bin_chunk, base_dir, attrs['NORMAL'])[:, :3]
        if apply_transform:
            normals = transform_normals(world_matrix, normals)
        if source_z_up:
            normals = z_up_to_y_up(normals)
    else:
        normals = None

    assert positions.shape[0] == uvs.shape[0], (
        f"Mismatched vertex/uv count in '{mesh_label}': "
        f"{positions.shape[0]} positions vs {uvs.shape[0]} uvs. "
        f"This should never happen for a valid glTF primitive."
    )
    if normals is not None:
        assert positions.shape[0] == normals.shape[0], (
            f"Mismatched vertex/normal count in '{mesh_label}': "
            f"{positions.shape[0]} positions vs {normals.shape[0]} normals."
        )

    if 'indices' in primitive:
        idx = read_accessor(gltf, glb_bin_chunk, base_dir, primitive['indices'])[:, 0].astype('int64').tolist()
    else:
        idx = list(range(positions.shape[0]))

    idx = triangulate_indices(idx, primitive.get('mode', 4))
    triangle_count = len(idx) // 3

    texture, base_color, metallic, roughness = resolve_material_info(
        gltf, glb_bin_chunk, base_dir, primitive.get('material'),
        texture_dir, out_dir, mesh_label
    )

    return {
        "name": mesh_label,
        "texture": texture,
        "baseColor": [round(float(c), 4) for c in base_color],
        "metallic": round(float(metallic), 4),
        "roughness": round(float(roughness), 4),
        "vertices": [round(float(v), 6) for v in positions.flatten().tolist()],
        "uvs": [round(float(v), 6) for v in uvs.flatten().tolist()],
        "indices": [int(i) for i in idx],
        "normals": (
            [round(float(v), 6) for v in normals.flatten().tolist()]
            if normals is not None else None
        ),
        "triangles": triangle_count
    }


# --------------------------------------------------------------------------
# Main conversion
# --------------------------------------------------------------------------

def convert(input_path, output_path, texture_dir='assets/models', apply_transform=True,
            source_z_up=False):
    base_dir = os.path.dirname(os.path.abspath(input_path))
    out_dir = os.path.dirname(os.path.abspath(output_path)) or '.'
    gltf, glb_bin_chunk = read_glb(input_path)

    asset_name = os.path.splitext(os.path.basename(output_path))[0]

    meshes_out = []
    sockets_out = []
    mesh_counter = 0
    used_mesh_names = {}

    def make_unique(label):
        if label not in used_mesh_names:
            used_mesh_names[label] = 0
            return label
        else:
            count = used_mesh_names[label] + 1
            used_mesh_names[label] = count
            return f"{label}_{count}"

    def visit(node_index, parent_matrix):
        nonlocal mesh_counter
        node = gltf['nodes'][node_index]
        local = node_local_matrix(node)
        world = parent_matrix @ local

        if 'mesh' in node:
            mesh = gltf['meshes'][node['mesh']]
            mesh_name = mesh.get('name', 'mesh')

            for prim_i, primitive in enumerate(mesh.get('primitives', [])):
                label = node.get('name', mesh_name)
                unique_label = make_unique(label)
                entry = convert_primitive(
                    gltf, glb_bin_chunk, base_dir, primitive, world,
                    texture_dir, out_dir, unique_label, apply_transform,
                    source_z_up=source_z_up
                )
                if entry is not None:
                    meshes_out.append(entry)
            mesh_counter += 1

        else:
            #Empty-Node without Mesh, called "socket_<typ>[_<suffix>]" -> socket
            # "socket_tire_FL" -> name="tire_FL", type="tire"
            # "socket_spoiler" -> name="spoiler", type="spoiler"
            name = node.get('name', '')
            if name.startswith('socket_'):
                translation = world[:3, 3].copy()
                if source_z_up:
                    translation = z_up_to_y_up(translation.reshape(1, 3))[0]

                type_and_suffix = name[len('socket_'):]
                socket_type = type_and_suffix.split('_')[0]

                sockets_out.append({
                    "name": name,
                    "type": socket_type,
                    "pos": {
                        "x": round(float(translation[0]), 6),
                        "y": round(float(translation[1]), 6),
                        "z": round(float(translation[2]), 6),
                    }
                })

        for child in node.get('children', []):
            visit(child, world)

    if 'scenes' in gltf and gltf.get('scenes'):
        scene_index = gltf.get('scene', 0)
        scene = gltf['scenes'][scene_index]
        for root in scene.get('nodes', []):
            visit(root, np.eye(4))
    else:
        # no scene graph -> just walk raw meshes with identity transform
        for mesh_i, mesh in enumerate(gltf.get('meshes', [])):
            for prim_i, primitive in enumerate(mesh.get('primitives', [])):
                label = f"{mesh.get('name', 'mesh')}_{mesh_i}_{prim_i}"
                entry = convert_primitive(
                    gltf, glb_bin_chunk, base_dir, primitive, np.eye(4),
                    texture_dir, out_dir, label, apply_transform,
                    source_z_up=source_z_up
                )
                if entry is not None:
                    meshes_out.append(entry)

    required_socket_types = list()
    result = {"name": asset_name, "meshes": meshes_out, "sockets": sockets_out, "requiredSocketTypes": required_socket_types}
    with open(output_path, 'w') as f:
        json.dump(result, f, indent=4)

    total_triangles = sum(
        mesh["triangles"]
        for mesh in meshes_out
    )
    print(f"Wrote {len(meshes_out)} mesh(es) with {total_triangles} total triangles to {output_path}")
    return result


def main():
    parser = argparse.ArgumentParser(description="Convert a .glb file to a custom JSON model format.")
    parser.add_argument('input', help="Path to input .glb file")
    parser.add_argument('output', help="Path to output .json file")
    parser.add_argument('--texture-dir', default='assets/models',
                         help="Folder prefix used for texture paths in the JSON (default: assets/models)")
    parser.add_argument('--no-transform', action='store_true',
                         help="Don't bake node world transforms into vertex positions (use raw local mesh-space coords)")
    parser.add_argument('--source-z-up', action='store_true',
                         help="Source asset is Z-up (non-compliant glTF export) and needs converting to Y-up. "
                              "glTF is Y-up by spec, so this is normally NOT needed.")
    args = parser.parse_args()

    convert(args.input, args.output, texture_dir=args.texture_dir,
            apply_transform=not args.no_transform, source_z_up=args.source_z_up)


if __name__ == '__main__':
    main()