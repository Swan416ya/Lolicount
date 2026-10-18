"""Merge unnamed Princess Connect NPC outfits into mutually exclusive themes."""

import argparse
import hashlib
import json
import re
import shutil
import tempfile
from pathlib import Path


MODEL = re.compile(r"^pcr-(\d{6})$")


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


def range_variants(ranges):
    variants = 1
    for span in ranges.values():
        variants *= span["last"] - span["first"] + 1
    return variants


def theme_variants(theme_dir):
    config = read_json(theme_dir / "config.json")
    if config.get("sets"):
        return sum(range_variants(configured["ranges"]) for configured in config["sets"])
    return range_variants(config["ranges"])


def merge_group(repo, stage, key, source_names):
    theme_root = repo / "assets/theme"
    destination_name = f"pcr-npc-{key}"
    destination = stage / destination_name
    ren_dir = destination / "ren"
    ren_dir.mkdir(parents=True)
    manifest = [{"layer_id": 0}]
    sets = []

    for source_name in sorted(source_names):
        source = theme_root / source_name
        source_manifest = read_json(source / "ren.json")
        source_config = read_json(source / "config.json")
        offset = len(manifest) - 1
        for entry in source_manifest[1:]:
            copied = dict(entry)
            copied["layer_id"] = len(manifest)
            shutil.copy2(source / "ren" / f"{entry['layer_id']}.webp", ren_dir / f"{copied['layer_id']}.webp")
            manifest.append(copied)
        sets.append({
            "name": source_name.removeprefix("pcr-"),
            "canvasW": source_config["canvasW"],
            "canvasH": source_config["canvasH"],
            "ranges": {
                category: {"first": span["first"] + offset, "last": span["last"] + offset}
                for category, span in source_config["ranges"].items()
            },
        })

    write_json(destination / "ren.json", manifest)
    write_json(destination / "config.json", {"sets": sets})
    write_json(destination / "display.json", {"size": 400})
    write_json(destination / "meta.json", {
        "name": destination_name,
        "description": f"Princess Connect! Re:Dive / Story {key}; {len(sets)} mutually exclusive NPC outfit(s), with expressions selected inside the chosen outfit.",
        "tags": ["princess-connect", "priconne", "公主连结", "プリコネ", f"Story {key}", "NPC"],
        "version": "1.1.0",
    })
    return destination_name


def deduplicate_sets(theme_dir):
    config = read_json(theme_dir / "config.json")
    manifest = read_json(theme_dir / "ren.json")
    seen = set()
    kept = []
    for configured in config["sets"]:
        categories = []
        for category, span in sorted(configured["ranges"].items(), key=lambda item: item[1]["first"]):
            candidates = []
            for index in range(span["first"], span["last"] + 1):
                layer = manifest[index]
                digest = hashlib.sha256((theme_dir / "ren" / f"{layer['layer_id']}.webp").read_bytes()).hexdigest()
                candidates.append((layer.get("left", 0), layer.get("top", 0), layer.get("width", 0), layer.get("height", 0), digest))
            categories.append((category, tuple(candidates)))
        signature = (configured["canvasW"], configured["canvasH"], tuple(categories))
        if signature not in seen:
            seen.add(signature)
            kept.append(configured)
    if len(kept) == len(config["sets"]):
        return 0

    temporary = theme_dir / "ren-deduplicated"
    temporary.mkdir()
    rebuilt_manifest = [{"layer_id": 0}]
    rebuilt_sets = []
    for configured in kept:
        ranges = {}
        for category, span in sorted(configured["ranges"].items(), key=lambda item: item[1]["first"]):
            first = len(rebuilt_manifest)
            for index in range(span["first"], span["last"] + 1):
                layer = dict(manifest[index])
                old_id = layer["layer_id"]
                layer["layer_id"] = len(rebuilt_manifest)
                shutil.copy2(theme_dir / "ren" / f"{old_id}.webp", temporary / f"{layer['layer_id']}.webp")
                rebuilt_manifest.append(layer)
            ranges[category] = {"first": first, "last": len(rebuilt_manifest) - 1}
        rebuilt_sets.append({**configured, "ranges": ranges})
    shutil.rmtree(theme_dir / "ren")
    temporary.rename(theme_dir / "ren")
    write_json(theme_dir / "ren.json", rebuilt_manifest)
    write_json(theme_dir / "config.json", {"sets": rebuilt_sets})
    return len(config["sets"]) - len(rebuilt_sets)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    repo = args.repo.resolve()
    theme_root = repo / "assets/theme"
    thumb_root = repo / "web/public/images/theme-thumbs"
    names = read_json(repo / "scripts/priconne-names.json")
    silhouettes = read_json(repo / "scripts/priconne-silhouettes.json")
    metadata_path = repo / "web/app/data/priconne-themes.json"
    metadata = read_json(metadata_path)
    metadata_by_name = {entry["name"]: entry for entry in metadata}

    raw = []
    for directory in theme_root.iterdir():
        match = MODEL.match(directory.name)
        if match:
            raw.append((directory.name, match.group(1)))
    if not raw:
        print("no unmerged Princess Connect model directories found")
        return

    unnamed = {}
    shadows = []
    for theme_name, model_id in raw:
        label = names.get(model_id[:4], f"Story {model_id[:4]}")
        if label.startswith("Story "):
            unnamed.setdefault(model_id[:4], []).append(theme_name)
        elif model_id in silhouettes:
            shadows.append(theme_name)

    with tempfile.TemporaryDirectory(prefix="priconne-npc-merge-", dir=repo / "assets") as temporary:
        stage = Path(temporary)
        merged_names = {}
        for key, source_names in sorted(unnamed.items()):
            merged_names[key] = merge_group(repo, stage, key, source_names)

        for key, source_names in sorted(unnamed.items()):
            destination_name = merged_names[key]
            destination = theme_root / destination_name
            if destination.exists():
                shutil.rmtree(destination)
            shutil.move(stage / destination_name, destination)
            source_thumb = thumb_root / f"{sorted(source_names)[0]}.webp"
            shutil.copy2(source_thumb, thumb_root / f"{destination_name}.webp")

        removed = [name for group in unnamed.values() for name in group] + shadows
        for theme_name in removed:
            shutil.rmtree(theme_root / theme_name)
            thumb = thumb_root / f"{theme_name}.webp"
            if thumb.exists():
                thumb.unlink()

    kept_metadata = [entry for entry in metadata if entry["name"] not in set(removed)]
    for key, source_names in sorted(unnamed.items()):
        aliases = {key, f"Story {key}", *(name.removeprefix("pcr-") for name in source_names)}
        for source_name in source_names:
            source = metadata_by_name.get(source_name)
            if source is None:
                continue
            aliases.update(source.get("aliases", []))
            aliases.add(source.get("character", ""))
        kept_metadata.append({
            "name": merged_names[key],
            "character": f"Story {key}",
            "romaji": f"Story {key}",
            "aliases": sorted(alias for alias in aliases if alias),
            "unnamed": True,
        })
    kept_metadata.sort(key=lambda entry: (entry.get("unnamed", False), entry["name"]))
    write_json(metadata_path, kept_metadata)
    duplicate_sets = sum(deduplicate_sets(directory) for directory in theme_root.glob("pcr-npc-*"))
    single_variant_path = repo / "scripts/priconne-single-variant-themes.json"
    single_variant = set(read_json(single_variant_path)) if single_variant_path.exists() else set()
    newly_single_variant = []
    for directory in sorted(theme_root.glob("pcr-*")):
        if theme_variants(directory) != 1:
            continue
        newly_single_variant.append(directory.name)
        single_variant.add(directory.name)
        shutil.rmtree(directory)
        thumb = thumb_root / f"{directory.name}.webp"
        if thumb.exists():
            thumb.unlink()
    write_json(single_variant_path, sorted(single_variant))
    if newly_single_variant:
        metadata = [entry for entry in read_json(metadata_path) if entry["name"] not in set(newly_single_variant)]
        write_json(metadata_path, metadata)
    orphan_thumbs = []
    for thumb in thumb_root.glob("pcr-*.webp"):
        if not (theme_root / thumb.stem).is_dir():
            orphan_thumbs.append(thumb)
            thumb.unlink()
    print(f"merged {sum(len(group) for group in unnamed.values())} outfits into {len(unnamed)} NPC themes")
    print(f"removed {len(shadows)} single-variation named silhouette themes")
    print(f"removed {duplicate_sets} visually duplicate NPC outfit sets")
    print(f"removed {len(newly_single_variant)} remaining single-variation themes")
    print(f"removed {len(orphan_thumbs)} orphaned thumbnails")


if __name__ == "__main__":
    main()
