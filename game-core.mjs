// Core game state
let puzzles = [];
let initialized = false;

// Initial built-in puzzles
const builtInPuzzles = [
  {
    id: 1,
    title: "Pets & Playground",
    choices: [
      "Dog",
      "Cat",
      "Rabbit",
      "Hamster",
      "Slide",
      "Swing",
      "See-saw",
      "Sandbox",
      "Apple",
      "Banana",
      "Orange",
      "Grapes",
      "Car",
      "Bus",
      "Bike",
      "Truck",
    ],
    groups: [
      ["Dog", "Cat", "Rabbit", "Hamster"],
      ["Slide", "Swing", "See-saw", "Sandbox"],
      ["Apple", "Banana", "Orange", "Grapes"],
      ["Car", "Bus", "Bike", "Truck"],
    ],
    groupLabels: ["Pets", "Playground Equipment", "Fruits", "Vehicles"],
  },
];

// Initialize the game module
export async function initializeGame() {
  if (initialized) return;

  // Start with built-in puzzles
  puzzles = [...builtInPuzzles];

  // Load generated puzzles if available
  try {
    const response = await fetch("puzzles.generated.json");
    if (response.ok) {
      const generatedPuzzles = await response.json();

      // Ensure generated puzzles have unique IDs
      const maxBuiltInId = Math.max(...puzzles.map((p) => p.id));
      const offsetGeneratedPuzzles = generatedPuzzles.map((p, index) => ({
        ...p,
        id: maxBuiltInId + index + 1,
        title: `Generated Puzzle ${index + 1}`,
      }));

      // Add generated puzzles to the collection
      puzzles.push(...offsetGeneratedPuzzles);
    }
  } catch (e) {
    console.warn("Failed to load generated puzzles:", e);
  }

  initialized = true;
  return puzzles;
}

export function shuffle(array) {
  const arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function getAllPuzzles() {
  if (!initialized) {
    throw new Error("Game not initialized. Call initializeGame() first.");
  }
  return puzzles;
}

export function getPuzzle(id = 1, { shuffleChoices = true } = {}) {
  if (!initialized) {
    throw new Error("Game not initialized. Call initializeGame() first.");
  }
  const puzzle = puzzles.find((p) => p.id === id);
  if (!puzzle) return null;

  return {
    ...puzzle,
    choices: shuffleChoices ? shuffle(puzzle.choices) : puzzle.choices,
  };
}

export function getNextPuzzleId(currentId) {
  if (!initialized) {
    throw new Error("Game not initialized. Call initializeGame() first.");
  }
  const ids = puzzles.map((p) => p.id).sort((a, b) => a - b);
  const currentIndex = ids.indexOf(currentId);
  if (currentIndex === -1 || currentIndex === ids.length - 1) return ids[0];
  return ids[currentIndex + 1];
}

export function getRandomPuzzleId(exceptId = null) {
  if (!initialized) {
    throw new Error("Game not initialized. Call initializeGame() first.");
  }
  const ids = puzzles.map((p) => p.id).filter((id) => id !== exceptId);
  if (ids.length === 0) return exceptId || puzzles[0].id;
  const i = Math.floor(Math.random() * ids.length);
  return ids[i];
}

export function checkGroupMatch(selected, groups) {
  if (!Array.isArray(selected) || !Array.isArray(groups)) return false;
  if (selected.length === 0) return false;

  // normalize and check if selected matches any provided group (order-insensitive)
  const s = selected.map((x) => String(x).trim());
  return groups.some((group) => {
    if (group.length !== s.length) return false;
    const copy = group.map((x) => String(x).trim());
    return s.every((item) => copy.includes(item));
  });
}
