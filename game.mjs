// Core game logic exported as a small ES module
let puzzles = [];
const builtInPuzzles = [
  {
    id: 1,
    title: "Pets & Playground",
    // 4 groups of 4 = 16 tiles
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
  {
    id: 2,
    title: "School Day",
    choices: [
      "Pencil",
      "Eraser",
      "Crayon",
      "Notebook",
      "Teacher",
      "Student",
      "Desk",
      "Board",
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
      ["Pencil", "Eraser", "Crayon", "Notebook"],
      ["Teacher", "Student", "Desk", "Board"],
      ["Apple", "Banana", "Orange", "Grapes"],
      ["Car", "Bus", "Bike", "Truck"],
    ],
    groupLabels: ["School Supplies", "Classroom Things", "Fruits", "Vehicles"],
  },
  {
    id: 3,
    title: "Food & Transport",
    choices: [
      "Apple",
      "Banana",
      "Orange",
      "Grapes",
      "Pizza",
      "Burger",
      "Fries",
      "Milk",
      "Car",
      "Bus",
      "Bike",
      "Truck",
      "Cat",
      "Dog",
      "Rabbit",
      "Hamster",
    ],
    groups: [
      ["Apple", "Banana", "Orange", "Grapes"],
      ["Pizza", "Burger", "Fries", "Milk"],
      ["Car", "Bus", "Bike", "Truck"],
      ["Cat", "Dog", "Rabbit", "Hamster"],
    ],
  },
  {
    id: 4,
    title: "Home & Play",
    choices: [
      "Spoon",
      "Fork",
      "Plate",
      "Cup",
      "Ball",
      "Doll",
      "Blocks",
      "Book",
      "Pencil",
      "Eraser",
      "Crayon",
      "Notebook",
      "Car",
      "Bus",
      "Bike",
      "Truck",
    ],
    groups: [
      ["Spoon", "Fork", "Plate", "Cup"],
      ["Ball", "Doll", "Blocks", "Book"],
      ["Pencil", "Eraser", "Crayon", "Notebook"],
      ["Car", "Bus", "Bike", "Truck"],
    ],
  },
];

export function getPuzzle(id = 1, { shuffleChoices = true } = {}) {
  const p = puzzles.find((x) => x.id === id) || puzzles[0];
  console.log("Loading puzzle:", id);
  console.log("Original puzzle data:", JSON.stringify(p, null, 2));
  const choices = shuffleChoices ? shuffle(p.choices) : p.choices.slice();
  const result = {
    id: p.id,
    title: p.title,
    choices,
    groups: p.groups.map((g) => g.slice()),
    groupLabels: p.groupLabels ? [...p.groupLabels] : [], // Copy the groupLabels if they exist
  };
  console.log("Returned puzzle data:", JSON.stringify(result, null, 2));
  return result;
}

export function getNextPuzzleId(currentId) {
  const idx = puzzles.findIndex((p) => p.id === currentId);
  if (idx === -1) return puzzles[0].id;
  return puzzles[(idx + 1) % puzzles.length].id;
}

export function getRandomPuzzleId(exceptId = null) {
  const ids = puzzles.map((p) => p.id).filter((id) => id !== exceptId);
  if (ids.length === 0) return exceptId || puzzles[0].id;
  const i = Math.floor(Math.random() * ids.length);
  return ids[i];
}

// Initialize puzzles by loading generated ones and combining with built-in
export async function initializePuzzles() {
  // First, initialize with built-in puzzles
  puzzles = [...builtInPuzzles];
  console.log("Initialized with built-in puzzles:", puzzles.length);

  // Then load generated puzzles if available
  try {
    const response = await fetch("puzzles.generated.json");
    if (response.ok) {
      const generatedPuzzles = await response.json();
      console.log(`Loaded ${generatedPuzzles.length} generated puzzles`);

      // Ensure generated puzzles have unique IDs by offsetting them
      const maxBuiltInId = Math.max(...puzzles.map((p) => p.id));
      const offsetGeneratedPuzzles = generatedPuzzles.map((p, index) => ({
        ...p,
        id: maxBuiltInId + index + 1,
        title: `Generated Puzzle ${index + 1}`,
      }));

      // Add generated puzzles to the collection
      puzzles.push(...offsetGeneratedPuzzles);
      console.log("Total puzzles after loading generated:", puzzles.length);
    }
  } catch (e) {
    console.warn("Failed to load generated puzzles:", e);
  }
  return puzzles.length;
}

export function getAllPuzzles() {
  return puzzles.map((p) => ({ id: p.id, title: p.title }));
}

export function checkSelection(selected, groups) {
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
