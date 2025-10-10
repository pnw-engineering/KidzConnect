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


def is_word_in_any_category(word: str, bank: dict, exclude_cats: List[str] = None) -> bool:
    """Check if a word appears in any category (except excluded ones)."""
    word = word.lower()
    for cat, words in bank.items():
        if exclude_cats and cat in exclude_cats:
            continue
        if word in [w.lower() for w in words]:
            return True
    return False

def pick_categories(bank: dict, count: int = 4) -> List[str]:
    """Pick unique categories, with at most one being a part of speech."""
    pos_categories = {cat for cat in bank if cat.lower() in ['nouns', 'verbs', 'adjectives', 'adverbs']}
    regular_categories = {cat for cat in bank if cat not in pos_categories}
    
    # Decide if we'll use a POS category
    use_pos = random.random() < 0.25 and pos_categories  # 25% chance if POS categories exist
    
    result = []
    if use_pos:
        # Add one POS category
        pos_cat = random.choice(list(pos_categories))
        result.append(pos_cat)
        # Add remaining regular categories
        result.extend(random.sample(list(regular_categories), count - 1))
    else:
        # All regular categories
        result.extend(random.sample(list(regular_categories), count))
    
    return result

def build_puzzle(puzzle_id: int, bank: dict) -> dict:
    categories = pick_categories(bank, 4)
    groups = []
    choices = []
    used_words = set()  # Track all used words across categories
    
    # Build each group ensuring no word overlap with previous categories
    for cat in categories:
        available_words = []
        for word in bank[cat]:
            word = word.capitalize()
            # Only use words that aren't in any previous category and haven't been used
            if word not in used_words and not is_word_in_any_category(word, bank, exclude_cats=[cat]):
                available_words.append(word)
        
        if len(available_words) < 4:
            # If we don't have enough unique words, try a different category
            continue
            
        group_words = random.sample(available_words, 4)
        groups.append(group_words)
        choices.extend(group_words)
        used_words.update(group_words)

    # If we don't have 4 complete groups, raise an exception to trigger retry
    if len(groups) < 4:
        raise ValueError("Could not generate 4 complete groups with unique words")

    # Fill remaining choices to reach 16 unique words
    all_words = [w for cat in bank.values() for w in cat]
    while len(choices) < 16:
        cand = random.choice(all_words).capitalize()
        if cand not in used_words:
            choices.append(cand)
            used_words.add(cand)

    # Shuffle final choices
    random.shuffle(choices)

    # Format category names for hints
    formatted_labels = []
    for cat in categories:
        # Convert from snake_case or kebab-case to Title Case
        label = cat.replace('_', ' ').replace('-', ' ').strip()
        label = ' '.join(word.capitalize() for word in label.split())
        formatted_labels.append(label)
        
    print(f"Generated puzzle {puzzle_id}:")
    print(f"Categories: {categories}")
    print(f"Formatted labels: {formatted_labels}")
    print("Groups:", json.dumps(groups, indent=2))

    return {
        "id": puzzle_id,
        "title": f"Puzzle {puzzle_id}",
        "choices": choices,
        "groups": groups,
        "groupLabels": formatted_labels  # Store the formatted category names for hints
    }

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

    puzzles = []
    attempt = 0
    max_attempts = count * 3  # Allow some retries per puzzle

    while len(puzzles) < count and attempt < max_attempts:
        try:
            puzzle = build_puzzle(len(puzzles) + 1, bank)
            if puzzle["groups"] and len(puzzle["groups"]) == 4:  # Verify we got 4 valid groups
                puzzles.append(puzzle)
        except Exception as e:
            print(f"Failed to generate puzzle: {e}")
        attempt += 1

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
