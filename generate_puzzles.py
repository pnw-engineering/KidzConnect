#!/usr/bin/env python3
"""
generate_puzzles.py (local mode)

Create puzzle word lists locally using built-in category word lists.

This avoids any external LLMs and is useful for offline development and tests.

Usage:
  - Run: `python generate_puzzles.py --count 4 --out puzzles.generated.json`

The script will produce a JSON array of puzzles matching the same shape used by the
frontend (16 `choices` and 4 `groups` of 4 words each). No external network calls.
"""

import argparse
import json
import os
import random
from typing import List

CATEGORY_BANK = {
    "pets": [
        "dog",
        "cat",
        "rabbit",
        "hamster",
        "parrot",
        "turtle",
        "fish",
        "guinea",
    ],
    "playground": [
        "slide",
        "swing",
        "seesaw",
        "sandbox",
        "rope",
        "climb",
        "bench",
        "shade",
    ],
    "fruit": [
        "apple",
        "banana",
        "orange",
        "grape",
        "pear",
        "peach",
        "plum",
        "kiwi",
    ],
    "transport": [
        "car",
        "bus",
        "bike",
        "truck",
        "train",
        "boat",
        "scooter",
        "tram",
    ],
    "school": [
        "pencil",
        "eraser",
        "crayon",
        "notebook",
        "teacher",
        "student",
        "desk",
        "board",
    ],
    "food": [
        "pizza",
        "burger",
        "fries",
        "milk",
        "cookie",
        "bread",
        "cheese",
        "soup",
    ],
    "home": [
        "spoon",
        "fork",
        "plate",
        "cup",
        "bed",
        "lamp",
        "sofa",
        "table",
    ],
    "toys": [
        "ball",
        "doll",
        "blocks",
        "book",
        "puzzle",
        "toycar",
        "teddy",
        "kite",
    ],
}


def load_master_wordlist(path="master_wordlist.json"):
    """Load master_wordlist.json and return a category->words mapping.

    If the file is missing or invalid, returns None so caller can fallback to
    the built-in CATEGORY_BANK.
    """
    if not os.path.exists(path):
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        return None

    cats = {}
    for item in data:
        w = item.get("word")
        if not w:
            continue
        # normalize and capitalize for consistency with generator
        w_norm = str(w).strip()
        cat_list = item.get("categories") or []
        for c in cat_list:
            c_key = str(c).strip()
            cats.setdefault(c_key, []).append(w_norm)

    # only keep categories with at least 4 words
    cats = {k: v for k, v in cats.items() if len(v) >= 4}
    return cats


def normalize(word: str) -> str:
    return str(word).strip()


def pick_group_from_category(cat_words: List[str], count: int = 4):
    return random.sample(cat_words, count)


def build_puzzle(puzzle_id: int, categories: List[str], bank: dict) -> dict:
    # categories should be 4 category keys
    groups = []
    choices = []
    for cat in categories:
        words = pick_group_from_category(bank[cat], 4)
        groups.append([w.capitalize() for w in words])
        choices.extend([w.capitalize() for w in words])

    # Fill remaining choices by sampling from other categories to reach 16 unique
    all_pool = [w for cat in bank.values() for w in cat]
    while len(choices) < 16:
        cand = random.choice(all_pool).capitalize()
        if cand not in choices:
            choices.append(cand)

    # Shuffle choices for the puzzle
    random.shuffle(choices)

    return {
        "id": puzzle_id,
        "title": f"Puzzle {puzzle_id}",
        "choices": choices,
        "groups": groups,
    }


def generate_local_puzzles(count=4, seed: int | None = None):
    if seed is not None:
        random.seed(seed)
    # try to load master_wordlist.json and build category bank from it
    master_cats = load_master_wordlist()
    if master_cats:
        bank = master_cats
    else:
        bank = CATEGORY_BANK
    cat_keys = list(bank.keys())
    puzzles = []
    for i in range(1, count + 1):
        # Pick 4 distinct categories for each puzzle
        cats = random.sample(cat_keys, 4)
        puzzles.append(build_puzzle(i, cats, bank))
    return puzzles


def validate_puzzles(data):
    if not isinstance(data, list):
        raise ValueError("Expected top-level list of puzzles")
    for p in data:
        if not isinstance(p, dict):
            raise ValueError("Each puzzle must be an object")
        choices = p.get("choices")
        groups = p.get("groups")
        if not isinstance(choices, list) or len(choices) != 16:
            raise ValueError("Each puzzle must have 16 choices")
        if not isinstance(groups, list) or len(groups) != 4:
            raise ValueError("Each puzzle must have 4 groups")
        # check groups
        used = set()
        for g in groups:
            if not isinstance(g, list) or len(g) != 4:
                raise ValueError("Each group must be an array of 4 words")
            for w in g:
                if w not in choices:
                    raise ValueError(f'Group word "{w}" not found in choices')
                if w in used:
                    raise ValueError(f"Overlapping group word: {w}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--count", type=int, default=4, help="Number of puzzles to generate"
    )
    parser.add_argument(
        "--out", default="puzzles.generated.json", help="Output filename"
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=None,
        help="Optional RNG seed for reproducible output",
    )
    args = parser.parse_args()

    puzzles = generate_local_puzzles(count=args.count, seed=args.seed)
    validate_puzzles(puzzles)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(puzzles, f, indent=2, ensure_ascii=False)
    print(f"Wrote {len(puzzles)} puzzles to {args.out}")


if __name__ == "__main__":
    main()
