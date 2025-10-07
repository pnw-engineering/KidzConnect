// Client-side puzzle generator that uses master_wordlist.json
// Exports: loadMasterWordlist(), generatePuzzle({seed, title})

let master = null; // array of {word, categories, pos}
let categoryMap = null; // category -> [word,...]
let categoryOriginal = null; // key -> original category string as found
let categoryPosMap = new Map(); // category -> Set of POS

export async function loadMasterWordlist(url = "master_wordlist.json") {
  if (master) return { master, categoryMap };
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    master = await resp.json();
  } catch (e) {
    console.warn(
      "Could not load master_wordlist.json, falling back to empty list",
      e
    );
    master = [];
  }
  // build category map with normalization and deduplication
  // We'll normalize category keys to lowercase trimmed strings and
  // preserve a single canonical display label (first-seen) in categoryOriginal.
  categoryMap = new Map();
  categoryOriginal = new Map();

  categoryPosMap.clear(); // Reset POS map on reload

  for (const entry of master) {
    const w = String(entry.word).trim();
    // gather categories from both `categories` and `pos` fields
    const cats = Array.isArray(entry.categories) ? entry.categories : [];
    // pos may be a string or an array; normalize to array
    const posArr = entry.pos
      ? Array.isArray(entry.pos)
        ? entry.pos
        : [entry.pos]
      : [];

    for (const c of cats) {
      // Only use non-POS categories
      if (c == null) continue;
      const raw = String(c).trim();
      if (raw === "") continue;
      const key = raw.toLowerCase();
      // store the first-seen original label for display
      if (!categoryOriginal.has(key)) categoryOriginal.set(key, raw);
      if (!categoryMap.has(key)) categoryMap.set(key, new Set());
      if (!categoryPosMap.has(key)) categoryPosMap.set(key, new Set());
      categoryMap.get(key).add(w);
      // Track POS for each category
      for (const pos of posArr) {
        categoryPosMap.get(key).add(pos.toLowerCase());
      }
    }
  }

  // convert sets to arrays and filter out categories with fewer than 4 or more than 4 unique words
  for (const [k, set] of Array.from(categoryMap.entries())) {
    const arr = Array.from(set.values());
    if (arr.length < 4 || arr.length > 4) {
      // If we have more than 4 words, take a random sample of exactly 4
      if (arr.length > 4) {
        // Use stable seed for consistent sampling
        const rng = seededRng(
          k.split("").reduce((a, c) => a + c.charCodeAt(0), 0)
        );
        const sampledArr = chooseRandom(arr, rng, 4);
        categoryMap.set(k, sampledArr);
        continue;
      }
      categoryMap.delete(k);
      categoryOriginal.delete(k);
    } else {
      categoryMap.set(k, arr);
    }
  }
  return { master, categoryMap };
}

function seededRng(seed) {
  // simple xorshift32-ish
  let s = seed >>> 0 || 123456789;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967295;
  };
}

function chooseRandom(arr, rng, k = 1) {
  const copy = arr.slice();
  const out = [];
  for (let i = 0; i < k && copy.length; i++) {
    const idx = Math.floor(rng() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}

export function generatePuzzle({ seed = null, title = null } = {}) {
  // categoryMap must have been built (or be empty)
  const rng = seed == null ? Math.random : seededRng(Number(seed));

  // Filter out categories with more than one POS
  const validCats = Array.from(
    (categoryMap && categoryMap.keys()) || []
  ).filter((cat) => {
    const posSet = categoryPosMap.get(cat);
    return posSet && posSet.size <= 1; // Keep categories with 0 or 1 POS types
  });

  // Try to generate puzzle with valid categories
  if (validCats.length < 4) {
    // fallback: try to build some simple categories from common POS or use words directly
    const words = (master || []).map((e) => e.word).slice();
    // if not enough words, return null
    if (words.length < 16) return null;
    // pick 16 random words and divide into 4 groups of 4 (no semantic grouping)
    const chosen = chooseRandom(words, rng, 16);
    const groups = [];
    for (let i = 0; i < 4; i++) groups.push(chosen.slice(i * 4, i * 4 + 4));
    const choices = chosen.slice().sort(() => (rng() > 0.5 ? 1 : -1));
    return {
      id: Date.now(),
      title: title || `Generated Puzzle ${new Date().toLocaleString()}`,
      choices,
      groups,
    };
  }

  // Group category keys by a normalized display label so we don't pick
  // two distinct internal keys that would show up as the same hint.
  const displayGroupMap = new Map();
  for (const k of cats) {
    const rawLabel = categoryOriginal.get(k) || k;
    // normalization for display-grouping: replace dashes with spaces, lower-case and trim
    const displayKey = String(rawLabel).replace(/-/g, " ").toLowerCase().trim();
    if (!displayGroupMap.has(displayKey))
      displayGroupMap.set(displayKey, {
        label: rawLabel,
        keys: [],
        words: new Set(),
      });
    const entry = displayGroupMap.get(displayKey);
    entry.keys.push(k);
    const pool = categoryMap.get(k) || [];
    for (const w of pool) entry.words.add(w);
  }

  // Convert display groups to array and filter out groups with fewer than 4 unique words
  const displayGroups = Array.from(displayGroupMap.values())
    .map((g) => ({
      label: g.label,
      keys: g.keys.slice(),
      pool: Array.from(g.words),
    }))
    .filter((g) => (g.pool || []).length >= 4);

  if (displayGroups.length < 4) {
    // fallback to earlier behavior if not enough distinct display groups
    const chosenCats = chooseRandom(cats, rng, 4);
    const groups = [];
    const allWords = [];
    for (const c of chosenCats) {
      const pool = categoryMap.get(c).slice();
      const words = chooseRandom(pool, rng, 4);
      groups.push(words);
      allWords.push(...words);
    }
    const choices = allWords.slice().sort(() => (rng() > 0.5 ? 1 : -1));
    return {
      id: Date.now(),
      title: title || `Generated: ${chosenCats.join(", ")}`,
      choices,
      groups,
    };
  }

  // Track used categories and their POS
  const usedCats = new Set();
  const usedPos = new Set();

  // Choose display groups one at a time to ensure category and POS uniqueness
  const chosenDisplayGroups = [];
  const shuffledGroups = displayGroups.sort(() => (rng() > 0.5 ? 1 : -1));

  for (const group of shuffledGroups) {
    const catKey = group.key.toLowerCase();
    const catPos = categoryPosMap.get(catKey)?.values().next().value; // Get the single POS if it exists

    // Skip if category was already used
    if (usedCats.has(catKey)) continue;

    // Skip if this POS was already used and the category has a POS
    if (catPos && usedPos.has(catPos)) continue;

    // Accept this category
    chosenDisplayGroups.push(group);
    usedCats.add(catKey);
    if (catPos) usedPos.add(catPos);

    // Break if we have enough groups
    if (chosenDisplayGroups.length === 4) break;
  }

  // If we couldn't find 4 valid groups, fall back to default behavior
  if (chosenDisplayGroups.length < 4) {
    return generatePuzzle({ seed: Number(seed) + 1, title }); // Try again with next seed
  }

  const groups = [];
  const allWords = [];
  for (const dg of chosenDisplayGroups) {
    const pool = dg.pool.slice();
    const words = chooseRandom(pool, rng, 4);
    groups.push(words);
    allWords.push(...words);
  }
  // shuffle choices
  const choices = allWords.slice().sort(() => (rng() > 0.5 ? 1 : -1));
  const chosenGroupLabels = chosenDisplayGroups.map((g) => g.label);
  return {
    id: Date.now(),
    title: title || `Generated: ${chosenGroupLabels.join(", ")}`,
    choices,
    groups,
    groupLabels: chosenGroupLabels, // Store the chosen category labels
  };
}

// Given groups (array of arrays of words), try to guess the category name for each group
// Returns array of strings (same length as groups) with category keys or null.
export function guessCategoriesForGroups(groups) {
  if (!categoryMap) return groups.map(() => null);
  const keys = Array.from(categoryMap.keys());
  // build lowercase pools for comparison
  const lowerPools = new Map();
  for (const k of keys) {
    const pool = categoryMap.get(k) || [];
    lowerPools.set(
      k,
      new Set(
        pool.map((w) =>
          String(w)
            .toLowerCase()
            .trim()
            .replace(/[-\s]+/g, " ")
        )
      )
    );
  }

  return groups.map((g) => {
    const gLower = g.map((w) =>
      String(w)
        .toLowerCase()
        .trim()
        .replace(/[-\s]+/g, " ")
    );
    const scores = new Map();
    for (const k of keys) {
      const poolSet = lowerPools.get(k);
      // score category match:
      // - exact word matches count as 2 points (normalized)
      // - bonus for matching half or more of the group (prefer categories that explain multiple words)
      // - small bonus for categories with more total words (tie break toward common categories)
      let exactMatches = 0;
      for (const gw of gLower) {
        if (poolSet.has(gw)) exactMatches++;
      }
      let score = exactMatches * 2;
      if (exactMatches >= g.length / 2) score += 1; // bonus for explaining multiple words
      const totalSize = (categoryMap.get(k) || []).length;
      score += totalSize / 1000; // tiny size bonus (0.004 to 0.064) to break ties
      if (score > 0) scores.set(k, score);
    }
    if (scores.size === 0) return null;
    // choose the key with the highest score, ties broken by pool size
    let best = null;
    let bestScore = -1;
    for (const [k, s] of scores) {
      const poolSize = (categoryMap.get(k) || []).length;
      if (s > bestScore) {
        best = k;
        bestScore = s;
      } else if (
        s === bestScore &&
        poolSize > (categoryMap.get(best)?.length || 0)
      ) {
        // on exact score tie, prefer the category with more total words
        best = k;
      }
    }
    // if we found any category with a non-trivial score, return its label
    return bestScore >= 1 ? categoryOriginal.get(best) || best : null;
  });
}
