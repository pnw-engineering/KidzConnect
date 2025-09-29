import assert from "assert";
import { checkSelection, getPuzzle, shuffle } from "./game.mjs";

import { getNextPuzzleId, getRandomPuzzleId } from "./game.mjs";

// Test shuffle returns same items
const arr = [1, 2, 3, 4, 5];
const s = shuffle(arr);
assert.deepEqual(
  arr.slice().sort(),
  s.slice().sort(),
  "shuffle should preserve items"
);

// Test getPuzzle
const p = getPuzzle(1, { shuffleChoices: false });
assert.strictEqual(p.id, 1, "puzzle id");
assert.ok(Array.isArray(p.choices) && p.choices.length >= 4, "choices present");

// test checkSelection
const good = ["Dog", "Cat", "Rabbit", "Hamster"];
const bad = ["Dog", "Cat", "Apple", "Car"];
assert.strictEqual(
  checkSelection(good, p.groups),
  true,
  "good selection should pass"
);
assert.strictEqual(
  checkSelection(bad, p.groups),
  false,
  "bad selection should fail"
);

console.log("All tests passed");

// test next/random puzzle id
const nextId = getNextPuzzleId(1);
console.log("nextId for 1 =>", nextId);
const randId = getRandomPuzzleId(1);
console.log("random id (not 1) =>", randId);
