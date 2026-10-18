"""Name every Princess Connect story portrait after its story model row."""

import argparse
import ctypes
import hashlib
import json
import pathlib
import re

def split_model(theme):
    """Split a six-digit story model into character, costume and pose parts."""
    if len(theme) != 6 or not theme.isdigit() or not theme.isascii():
        return None
    return theme[:4], theme[4:6], theme[6:] or "00"


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


def select_encoding(repo):
    """Prefer UTF-8; fall back to ASCII when the file is pure escapes."""
    for encoding in ("utf-8", "ascii"):
        if read_names(repo, encoding) is not None:
            return encoding
    raise SystemExit("scripts/priconne-names.json is not valid UTF-8 text")


def read_names(repo, encoding):
    try:
        return json.loads((repo / "scripts/priconne-names.json").read_bytes().decode(encoding))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return None


def console(text):
    try:
        print(text)
    except UnicodeEncodeError:
        ctypes.windll.kernel32.WriteConsoleW(ctypes.windll.kernel32.GetStdHandle(-11), text + "\n", len(text) + 1, None, None)


def display_romaji(name):
    """Romanize for display while keeping candidate search terms."""
    latin = "".join(character if character.isascii() else "" for character in name).strip()
    if latin and latin.isalpha() and re.fullmatch(r"[A-Za-z ]+", latin):
        return latin
    return name if name.isascii() else ""


NPC = "npc-"


def npc_row(repo, name, names, silhouettes, chinese, language, aliases):
    """Describe one consolidated story portrait theme; every source outfit stays searchable.

    Consolidation happens before the names are frozen, so a theme that later gains a
    reliable name keeps its merged shape and switches from the placeholder label to
    the character name instead of being split back into one theme per outfit.
    """
    key = name.removeprefix(NPC)
    outfits = sorted(
        configured["name"]
        for configured in read_json(repo / "assets/theme" / f"pcr-{name}" / "config.json").get("sets", [])
    )
    japanese = names.get(key, f"Story {key}")
    if japanese.startswith("Story "):
        # Story nameplates such as 男孩 or 村长 describe a nameless extra; they
        # stay searchable aliases instead of becoming the theme title.
        terms = [key, japanese, *outfits, *aliases.get(key, [])]
        return {
            "name": f"pcr-{name}",
            "character": japanese,
            "romaji": japanese,
            "aliases": list(dict.fromkeys(term for term in terms if term)),
            "unnamed": True,
            "storyCharacter": key,
        }
    chinese_name = chinese.get(key, japanese)
    terms = [japanese, chinese_name, key, f"Story {key}", *outfits, *aliases.get(key, [])]
    return {
        "name": f"pcr-{name}",
        "character": chinese_name,
        "romaji": language.get(key, ""),
        "aliases": list(dict.fromkeys(term for term in terms if term)),
        "unnamed": False,
        "storyCharacter": key,
    }


def named_row(name, names, chinese, language, aliases):
    """Describe one named outfit: the story model is an independent theme."""
    stem = name[:4]
    ja = names.get(stem) or f"Story {stem}"
    chinese_name = chinese.get(stem, ja)
    unnamed = ja.startswith("Story ")
    label = f"{chinese_name}, {name[4:]}" if not unnamed else f"Story {stem}, {name[4:]}"
    terms = [ja, chinese_name, stem, name] + aliases.get(stem, [])
    if unnamed:
        terms.append(f"Story {stem}")
    row = {
        "name": f"pcr-{name}",
        "character": label,
        "romaji": language.get(stem, ""),
        "aliases": list(dict.fromkeys(term for term in terms if term)),
        "unnamed": unnamed,
        "storyModel": name,
        "storyCharacter": stem,
    }
    return row


def build_catalog(repo):
    """Rebuild the Princess Connect theme metadata from the theme tree."""
    names = read_names(repo, select_encoding(repo))
    silhouettes = read_json(repo / "scripts/priconne-silhouettes.json")
    chinese = read_json(repo / "scripts/priconne-zh-names.json")
    language = read_json(repo / "scripts/priconne-romaji.json")
    aliases = read_json(repo / "scripts/priconne-english-aliases.json")
    rows = []
    for path in sorted((repo / "assets/theme").glob("pcr-*")):
        name = path.name.removeprefix("pcr-")
        if name.startswith(NPC):
            rows.append(npc_row(repo, name, names, silhouettes, chinese, language, aliases))
            continue
        if split_model(name) is None:
            raise SystemExit(f"unexpected theme name {name}")
        rows.append(named_row(name, names, chinese, language, aliases))
    rows.sort(key=lambda row: (row["unnamed"], row["name"]))
    return rows


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=pathlib.Path, default=pathlib.Path(__file__).resolve().parents[1])
    parser.add_argument("--check", action="store_true", help="fail if the catalog is not up to date")
    args = parser.parse_args()
    repo = args.repo.resolve()
    rows = build_catalog(repo)
    payload = json.dumps(rows, ensure_ascii=False, indent=2) + "\n"
    digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()
    target = repo / "web/app/data/priconne-themes.json"
    if args.check:
        if not target.exists() or target.read_text(encoding="utf-8") != payload:
            raise SystemExit("priconne theme catalog is stale; rerun this script")
        console(f"catalog up to date: {len(rows)} entries, sha256 {digest}")
        return
    target.write_text(payload, encoding="utf-8", newline="\n")
    console(f"catalog: {len(rows)} entries ({sum(row['unnamed'] for row in rows)} unnamed), sha256 {digest}")


if __name__ == "__main__":
    main()
