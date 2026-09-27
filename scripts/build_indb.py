"""Build public/data/indb.json from the Indian Nutrient Databank (INDB).

Source: https://github.com/lindsayjaacks/Indian-Nutrient-Databank-INDB- (CC BY 4.0).
Usage: python3 scripts/build_indb.py path/to/INDB.xlsx
Output: compact list of dishes with macros per 100 g and a sensible single serving.
"""
import json
import re
import sys

import openpyxl

WHOLE_DISH_UNITS = {"dish", "jar", "chicken", "souffle dish", "pie", "cake", "loaf", "tray", "gm", "g", "ml", ""}
MAX_SERVING_G = 700  # anything bigger is a whole dish, not one person's portion

# Known INDB issue: many deep-fried recipes count all the frying oil as eaten
# (e.g. poori ~740 kcal and ~78 g fat per 100 g). Leave out entries whose fat is
# implausible for the dish, except genuinely fat-based foods.
MAX_FAT_G = 45
FAT_BASED = re.compile(r"mayonnaise|dressing|tartare", re.I)
# Also leave out entries whose calories don't match their own protein/carbs/fat.
MAX_ATWATER_GAP = 0.25


def r1(x):
    return round(float(x or 0), 1)


def main(path):
    ws = openpyxl.load_workbook(path, read_only=True).worksheets[0]
    rows = list(ws.iter_rows(values_only=True))
    ix = {k: i for i, k in enumerate(rows[0])}
    out = []
    global skipped
    skipped = {"fat": [], "mismatch": []}
    for r in rows[1:]:
        code, name = r[ix["food_code"]], (r[ix["food_name"]] or "").strip()
        kcal = float(r[ix["energy_kcal"]] or 0)
        if not code or not name or kcal <= 0:
            continue
        item = {
            "id": f"indb:{code}",
            "name": re.sub(r"\s+", " ", name),
            "src": "INDB",
            "kcal": r1(kcal),
            "p": r1(r[ix["protein_g"]]),
            "c": r1(r[ix["carb_g"]]),
            "f": r1(r[ix["fat_g"]]),
            "fib": r1(r[ix["fibre_g"]]),
        }
        if item["f"] > MAX_FAT_G and not FAT_BASED.search(name):
            skipped["fat"].append(name)
            continue
        atwater = 4 * item["p"] + 4 * item["c"] + 9 * item["f"]
        if kcal > 20 and abs(atwater - kcal) / kcal > MAX_ATWATER_GAP:
            skipped["mismatch"].append(name)
            continue
        unit = (r[ix["servings_unit"]] or "").strip().lower()
        kcal_serving = float(r[ix["unit_serving_energy_kcal"]] or 0)
        if kcal_serving > 0 and unit not in WHOLE_DISH_UNITS:
            grams = kcal_serving / kcal * 100
            if 5 <= grams <= MAX_SERVING_G:
                item["sv"] = {"u": unit, "g": round(grams)}
        out.append(item)
    out.sort(key=lambda x: x["name"].lower())
    return out


if __name__ == "__main__":
    data = main(sys.argv[1])
    with open("public/data/indb.json", "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, separators=(",", ":"))
    with_serving = sum(1 for d in data if "sv" in d)
    print(f"{len(data)} dishes kept, {with_serving} with a per-person serving")
    print(f"left out: {len(skipped['fat'])} with implausible fat, {len(skipped['mismatch'])} with inconsistent numbers")
