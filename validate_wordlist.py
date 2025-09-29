import json
from typing import List


def validate_wordlist(filepath: str) -> tuple[bool, List[str], int]:
    """
    Validates the master wordlist JSON file.
    Returns (is_valid, error_messages, word_count)
    """
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        return False, [f"Invalid JSON format: {str(e)}"], 0
    except Exception as e:
        return False, [f"Error reading file: {str(e)}"], 0

    if not isinstance(data, list):
        return False, ["Root element must be an array"], 0

    valid_pos = {
        "noun",
        "verb",
        "adjective",
        "adverb",
        "preposition",
        "conjunction",
        "interjection",
    }
    errors = []
    word_count = len(data)
    unique_words = set()
    all_categories = set()

    for idx, entry in enumerate(data, 1):
        # Check entry structure
        if not isinstance(entry, dict):
            errors.append(f"Entry {idx} is not an object")
            continue

        # Check required fields
        if "word" not in entry:
            errors.append(f"Entry {idx} missing 'word' field")
        if "categories" not in entry:
            errors.append(f"Entry {idx} missing 'categories' field")
        if "pos" not in entry:
            errors.append(f"Entry {idx} missing 'pos' field")

        # Validate word
        if "word" in entry:
            word = entry["word"]
            if not isinstance(word, str):
                errors.append(f"Entry {idx}: 'word' must be a string")
            elif word in unique_words:
                errors.append(f"Entry {idx}: Duplicate word '{word}'")
            elif not word.strip():
                errors.append(f"Entry {idx}: Empty word")
            else:
                unique_words.add(word)

        # Validate categories
        if "categories" in entry:
            if not isinstance(entry["categories"], list):
                errors.append(f"Entry {idx}: 'categories' must be an array")
            elif not entry["categories"]:
                errors.append(f"Entry {idx}: 'categories' cannot be empty")
            else:
                for cat in entry["categories"]:
                    if not isinstance(cat, str):
                        errors.append(f"Entry {idx}: category must be a string")
                    elif not cat.strip():
                        errors.append(f"Entry {idx}: empty category")
                    else:
                        all_categories.add(cat)

        # Validate parts of speech
        if "pos" in entry:
            if not isinstance(entry["pos"], list):
                errors.append(f"Entry {idx}: 'pos' must be an array")
            elif not entry["pos"]:
                errors.append(f"Entry {idx}: 'pos' cannot be empty")
            else:
                invalid_pos = [pos for pos in entry["pos"] if pos not in valid_pos]
                if invalid_pos:
                    errors.append(
                        f"Entry {idx}: Invalid parts of speech: {invalid_pos}"
                    )

    return len(errors) == 0, errors, word_count


def main():
    filepath = "master_wordlist.json"
    is_valid, errors, word_count = validate_wordlist(filepath)

    print(f"\nValidation Results for {filepath}:")
    print(f"Total words: {word_count}")
    print(f"Valid: {'Yes' if is_valid else 'No'}")

    if errors:
        print("\nErrors found:")
        for error in errors:
            print(f"- {error}")
    else:
        print("\nNo errors found. JSON structure is valid.")


if __name__ == "__main__":
    main()
