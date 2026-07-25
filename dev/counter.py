import os
import json

folder = "../assets/models"


def count_triangles(json_path):
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    total_triangles = 0

    for mesh in data.get("meshes", []):
        indices = mesh.get("indices", [])
        total_triangles += len(indices) // 3

    return total_triangles


for filename in os.listdir(folder):

    if not filename.endswith(".json"):
        continue

    path = os.path.join(folder, filename)

    try:
        triangles = count_triangles(path)

        print(
            f"{filename}: {triangles} triangles"
        )

    except Exception as e:
        print(
            f"{filename}: ERROR - {e}"
        )