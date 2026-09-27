"""Build public/data/exercises.json from free-exercise-db (public domain / Unlicense).

Source: https://github.com/yuhonas/free-exercise-db  (dist/exercises.json)
Usage: python3 scripts/build_exercises.py path/to/exercises.json
Images are not copied; the app loads them from the repo as its README describes.
"""
import json
import sys


def main(path):
    src = json.load(open(path, encoding="utf-8"))
    out = []
    for e in src:
        if not e.get("primaryMuscles"):
            continue
        item = {
            "id": e["id"],
            "n": e["name"].strip(),
            "lv": e.get("level") or "beginner",
            "eq": e.get("equipment") or "other",
            "cat": e.get("category") or "strength",
            "pm": e["primaryMuscles"],
            "sm": e.get("secondaryMuscles") or [],
            "steps": [s.strip() for s in e.get("instructions") or [] if s.strip()],
            "img": e.get("images") or [],
        }
        if e.get("force"):
            item["force"] = e["force"]
        if e.get("mechanic"):
            item["mech"] = e["mechanic"]
        out.append(item)
    out.sort(key=lambda x: x["n"].lower())
    return out


if __name__ == "__main__":
    data = main(sys.argv[1])
    with open("public/data/exercises.json", "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, separators=(",", ":"))
    print(f"{len(data)} exercises, {sum(1 for d in data if d['img'])} with photos")
