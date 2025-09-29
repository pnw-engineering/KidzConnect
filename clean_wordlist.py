import json


def clean_wordlist(filepath: str) -> None:
    """
    Removes duplicate entries from the wordlist while preserving the most detailed categorization.
    """
    # Read the current wordlist
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Create a dictionary to store unique words with their best entries
    unique_words = {}

    for entry in data:
        word = entry["word"]
        if word not in unique_words:
            unique_words[word] = entry
        else:
            # If we already have this word, keep the entry with more categories
            existing_categories = len(unique_words[word]["categories"])
            new_categories = len(entry["categories"])
            if new_categories > existing_categories:
                unique_words[word] = entry
            elif new_categories == existing_categories:
                # If same number of categories, merge POS if different
                existing_pos = set(unique_words[word]["pos"])
                new_pos = set(entry["pos"])
                unique_words[word]["pos"] = sorted(list(existing_pos | new_pos))

    # Convert back to list and sort by word
    cleaned_data = sorted(unique_words.values(), key=lambda x: x["word"])

    # Write the cleaned data back to the file
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(cleaned_data, f, indent=2)


if __name__ == "__main__":
    filepath = "master_wordlist.json"
    clean_wordlist(filepath)
    print("Wordlist has been cleaned of duplicates.")
