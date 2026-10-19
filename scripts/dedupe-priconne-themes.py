"""Drop Princess Connect themes whose artwork already ships under another costume.

The story takes place inside a VR game, so one character's real-world portrait (the
`31` skin) is drawn once and reused by every costume unit of that character: the
costume only changes the in-game avatar. Those themes are byte-for-byte identical
apart from the costume in their title, so one of them survives and the others are
dropped, with their titles kept as search aliases by the catalog script.

The survivor is chosen deterministically: a named theme beats an unnamed one, a
theme whose character name carries no costume beats a costume entry, and the
smallest model id breaks the remaining ties. `scripts/priconne-deduped-themes.json`
records the result, and every dropped model id is added to
`scripts/priconne-excluded-themes.json` so the asset test and the coverage
snapshot keep deriving from the checked-in lists.
"""

import argparse
import hashlib
import json
import pathlib
import shutil
import sys
from collections import defaultdict


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


def set_signature(directory, manifest, configured):
    """Fingerprint one outfit: canvas plus every layer's placement and content."""
    layers = []
    for category in sorted(configured["ranges"]):
        span = configured["ranges"][category]
        entries = []
        for index in range(span["first"], span["last"] + 1):
            entry = manifest[index]
            digest = hashlib.sha256(
                (directory / "ren" / f"{entry['layer_id']}.webp").read_bytes()
            ).hexdigest()
            entries.append((
                entry.get("name", ""), entry.get("left", 0), entry.get("top", 0),
                entry.get("width", 0), entry.get("height", 0), digest,
            ))
        layers.append((category, tuple(entries)))
    return (configured["canvasW"], configured["canvasH"], tuple(layers))


def theme_signature(directory):
    manifest = read_json(directory / "ren.json")
    config = read_json(directory / "config.json")
    sets = config.get("sets")
    if sets:
        return tuple(sorted(set_signature(directory, manifest, configured) for configured in sets))
    return (set_signature(directory, manifest, config),)


def theme_models(directory):
    config = read_json(directory / "config.json")
    if config.get("sets"):
        return [configured["name"] for configured in config["sets"]]
    return [directory.name.removeprefix("pcr-")]


def survivor_rank(model, names):
    """Sort key for the theme that keeps the artwork: base name first, then id."""
    character = names.get(model[:4], f"Story {model[:4]}")
    unnamed = character.startswith("Story ")
    costume = "（" in character or "(" in character
    return (unnamed, costume, model)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=pathlib.Path, default=pathlib.Path(__file__).resolve().parents[1])
    parser.add_argument("--dry-run", action="store_true", help="report the duplicates without deleting")
    args = parser.parse_args()
    repo = args.repo.resolve()
    theme_root = repo / "assets/theme"
    thumb_root = repo / "web/public/images/theme-thumbs"
    names = read_json(repo / "scripts/priconne-names.json")

    directories = sorted(
        directory for directory in theme_root.iterdir()
        if directory.is_dir() and directory.name.startswith("pcr-") and len(directory.name) == 10
    )
    groups = defaultdict(list)
    for directory in directories:
        groups[theme_signature(directory)].append(directory)

    plan = {}
    dropped_models = []
    merged_dropped = []
    for signature, members in groups.items():
        if len(members) < 2:
            continue
        ordered = sorted(members, key=lambda directory: survivor_rank(directory.name.removeprefix("pcr-"), names))
        survivor, duplicates = ordered[0], ordered[1:]
        plan[survivor.name] = sorted(directory.name.removeprefix("pcr-") for directory in duplicates)
        for directory in duplicates:
            models = theme_models(directory)
            if len(models) > 1:
                merged_dropped.append(directory.name)
            dropped_models.extend(models)

    print(f"shipped themes: {len(directories)}")
    print(f"duplicate groups: {len(plan)}; themes dropped: {sum(len(v) for v in plan.values())}"
          f" ({len(dropped_models)} portraits)")
    print(f"dropped themes that were merged: {merged_dropped}")
    if args.dry_run:
        for survivor, duplicates in sorted(plan.items())[:10]:
            print(f"  keep {survivor} <- {duplicates}")
        return

    for survivor_name, duplicates in sorted(plan.items()):
        for model in duplicates:
            shutil.rmtree(theme_root / f"pcr-{model}")
            thumb = thumb_root / f"pcr-{model}.webp"
            if thumb.exists():
                thumb.unlink()

    write_json(repo / "scripts/priconne-deduped-themes.json", plan)

    excluded_path = repo / "scripts/priconne-excluded-themes.json"
    excluded = set(read_json(excluded_path))
    excluded.update(f"pcr-{model}" for model in dropped_models)
    write_json(excluded_path, sorted(excluded))
    print(f"recorded {len(excluded)} excluded themes")


if __name__ == "__main__":
    main()
