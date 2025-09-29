// Core game logic exported as a small ES module
export function shuffle(array) {
  const arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const puzzles = [
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
  const choices = shuffleChoices ? shuffle(p.choices) : p.choices.slice();
  return {
    id: p.id,
    title: p.title,
    choices,
    groups: p.groups.map((g) => g.slice()),
  };
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
