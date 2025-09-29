import {
  getAllPuzzles,
  getNextPuzzleId,
  getPuzzle,
  getRandomPuzzleId,
  shuffle,
} from "./game.mjs";
import {
  generatePuzzle,
  guessCategoriesForGroups,
  loadMasterWordlist,
} from "./generator.mjs";

let currentPuzzleId = 1;
let puzzle = getPuzzle(currentPuzzleId, { shuffleChoices: false });
let words = puzzle.choices;
let groups = puzzle.groups;
let selected = [];
let solvedSet = new Set(); // indexes of solved groups for current puzzle

const grid = document.getElementById("word-grid");
const result = document.getElementById("result");
const puzzleSelect = document.getElementById("puzzle-select");

// Web Audio helpers and sound/speech state
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx)
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

// Sound effects state
let soundMuted = localStorage.getItem("kc-sound-muted") === "1";
let speechMuted = localStorage.getItem("kc-speech-muted") === "1";

// debug toggle for hint/category alignment
const DEBUG_HINTS = false;

// Sound control functions
function setSoundMuted(v) {
  soundMuted = !!v;
  localStorage.setItem("kc-sound-muted", soundMuted ? "1" : "0");
  const soundBtn = document.getElementById("sound-btn");
  if (soundBtn) {
    soundBtn.setAttribute("aria-pressed", soundMuted ? "true" : "false");
    soundBtn.textContent = soundMuted ? "🔕" : "🔔";
  }
}

// Speech control functions
function setSpeechMuted(v) {
  speechMuted = !!v;
  localStorage.setItem("kc-speech-muted", speechMuted ? "1" : "0");
  const speechBtn = document.getElementById("speech-btn");
  if (speechBtn) {
    speechBtn.setAttribute("aria-pressed", speechMuted ? "true" : "false");
    speechBtn.textContent = speechMuted ? "🤫" : "�️";
  }
}
function playTone(freq = 440, dur = 0.12, type = "sine", gain = 0.12) {
  if (soundMuted) return;
  const ctx = getAudioCtx();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = gain;
  o.connect(g);
  g.connect(ctx.destination);
  o.start();
  o.stop(ctx.currentTime + dur);
}
function playSelectSound() {
  playTone(880, 0.08, "sine", 0.06);
}
function playCorrect() {
  playTone(660, 0.18, "triangle", 0.12);
  setTimeout(() => playTone(880, 0.12, "sine", 0.08), 80);
}
function playIncorrect() {
  playTone(220, 0.18, "sawtooth", 0.18);
}
function playReveal() {
  playTone(520, 0.2, "sine", 0.12);
}
function playNext() {
  playTone(740, 0.12, "sine", 0.08);
}
function playShuffle() {
  playTone(480, 0.12, "sine", 0.08);
}

function renderGrid() {
  grid.innerHTML = "";
  words.forEach((word, idx) => {
    const div = document.createElement("div");
    div.className = "word";
    div.tabIndex = 0;
    div.setAttribute("role", "listitem");
    div.dataset.word = word;

    // Create inner container for text that will be auto-scaled
    const textDiv = document.createElement("div");
    textDiv.className = "text-fit";
    textDiv.textContent = word;
    div.appendChild(textDiv);

    // Add auto-scaling after the element is added to the DOM
    requestAnimationFrame(() => fitText(textDiv));

    // visually mark solved words and disable interaction
    if (isWordSolved(word)) {
      div.classList.add("solved");
      div.tabIndex = -1;
    }

    div.addEventListener("click", () => toggleWord(div, word));
    div.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleWord(div, word);
      }
    });

    // Add a data attribute for the group indices this word belongs to
    const groupIndices = [];
    groups.forEach((g, i) => {
      if (g.includes(word)) groupIndices.push(i);
    });
    if (groupIndices.length) {
      div.dataset.groups = groupIndices.join(",");
    }

    grid.appendChild(div);
  });
}

function isWordSolved(word) {
  for (const si of solvedSet) {
    const g = groups[si] || [];
    if (g.includes(word)) return true;
  }
  return false;
}

function reorderWordsAfterSolved() {
  // Collect solved words in insertion order of solvedSet
  const solvedWords = [];
  for (const si of solvedSet) {
    const g = groups[si] || [];
    for (const w of g) {
      if (!solvedWords.includes(w)) solvedWords.push(w);
    }
  }
  // Remaining words that are not solved
  const remaining = words.filter((w) => !solvedWords.includes(w));
  const shuffledRemaining = shuffle(remaining);
  words = [...solvedWords, ...shuffledRemaining];
}

// FLIP animation helpers
function captureRects() {
  const map = new Map();
  // capture words with key prefix
  document.querySelectorAll(".word").forEach((el) => {
    const key = `w:${el.dataset.word}`;
    map.set(key, el.getBoundingClientRect());
  });
  // capture hint groups with key prefix
  document.querySelectorAll(".hint-group").forEach((el) => {
    const gi = el.dataset.groupIndex;
    if (gi == null) return;
    const key = `g:${gi}`;
    map.set(key, el.getBoundingClientRect());
  });
  return map;
}

function playFlipFromRects(oldRects) {
  // handle word tiles
  document.querySelectorAll(".word").forEach((el) => {
    const key = `w:${el.dataset.word}`;
    const old = oldRects.get(key);
    if (!old) return;
    const nl = el.getBoundingClientRect();
    const dx = old.left - nl.left;
    const dy = old.top - nl.top;
    if (dx === 0 && dy === 0) return;
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    el.style.transition = "transform 0s";
    el.getBoundingClientRect();
    requestAnimationFrame(() => {
      el.style.transition = "transform 360ms cubic-bezier(.2,.9,.2,1)";
      el.style.transform = "";
      const cleanup = () => {
        el.style.transition = "";
        el.removeEventListener("transitionend", cleanup);
      };
      el.addEventListener("transitionend", cleanup);
    });
  });
  // handle hint-group tiles
  document.querySelectorAll(".hint-group").forEach((el) => {
    const gi = el.dataset.groupIndex;
    if (gi == null) return;
    const key = `g:${gi}`;
    const old = oldRects.get(key);
    if (!old) return;
    const nl = el.getBoundingClientRect();
    const dx = old.left - nl.left;
    const dy = old.top - nl.top;
    if (dx === 0 && dy === 0) return;
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    el.style.transition = "transform 0s";
    el.getBoundingClientRect();
    requestAnimationFrame(() => {
      el.style.transition = "transform 360ms cubic-bezier(.2,.9,.2,1)";
      el.style.transform = "";
      const cleanup = () => {
        el.style.transition = "";
        el.removeEventListener("transitionend", cleanup);
      };
      el.addEventListener("transitionend", cleanup);
    });
  });
}

function reorderHintsAccordingToWords(overrides = {}) {
  const hintsList = document.getElementById("hints-list");
  if (!hintsList) return;
  const hintElems = Array.from(hintsList.querySelectorAll(".hint-group"));
  const map = new Map();
  hintElems.forEach((el) => map.set(String(el.dataset.groupIndex), el));

  // determine current number of columns in the word grid
  const gridEl = document.getElementById("word-grid");
  let cols = 4;
  if (gridEl) {
    const style = window.getComputedStyle(gridEl);
    const template = style.getPropertyValue("grid-template-columns") || "";
    const parts = template.trim().split(/\s+/).filter(Boolean);
    if (parts.length > 0) cols = parts.length;
  }

  // compute a canonical zero-based word-row for each group; respect overrides
  const groupWordRow = new Map();
  for (let gi = 0; gi < groups.length; gi++) {
    const key = String(gi);
    if (overrides && Object.prototype.hasOwnProperty.call(overrides, gi)) {
      const ov = overrides[gi];
      groupWordRow.set(key, isFinite(ov) ? Number(ov) : Infinity);
      continue;
    }
    const grp = groups[gi] || [];
    let pos = -1;
    for (const w of grp) {
      const idx = words.indexOf(w);
      if (idx >= 0 && (pos === -1 || idx < pos)) pos = idx;
    }
    groupWordRow.set(key, pos === -1 ? Infinity : Math.floor(pos / cols));
  }

  // sort groups by their computed word-row (finite rows first)
  const sorted = Array.from(groupWordRow.entries()).sort((a, b) => {
    const ra = a[1];
    const rb = b[1];
    if (!isFinite(ra) && !isFinite(rb)) return 0;
    if (!isFinite(ra)) return 1;
    if (!isFinite(rb)) return -1;
    return ra - rb;
  });

  // assign a single-column slot for each group in sorted order
  const slotIndex = new Map();
  sorted.forEach(([gi], i) => slotIndex.set(gi, i));

  for (const [gi, el] of map.entries()) {
    if (!el) continue;
    const key = String(gi);
    if (!slotIndex.has(key)) {
      // unmatched groups go below the 4 rows inside #hints-list
      el.style.gridRowStart = 5;
      el.style.gridColumnStart = 1;
      continue;
    }
    const slot = slotIndex.get(key);
    // inside #hints-list, row 1 corresponds to the top tile row; map slot 0 -> row 1
    el.style.gridRowStart = Math.max(1, Number(slot) + 1);
    el.style.gridColumnStart = 1; // force single column
  }
}

function populateHints() {
  const hintsList = document.getElementById("hints-list");
  const hintsCol = document.querySelector(".hints-column");
  if (!hintsList || !hintsCol) return;
  hintsList.innerHTML = "";
  // Use stored category labels if available from generated puzzle, otherwise try to guess
  let catNames = puzzle.groupLabels || [];
  if (!catNames.length) {
    try {
      catNames = guessCategoriesForGroups(groups) || [];
    } catch (e) {
      catNames = [];
    }
  }
  // defensive dedupe: ensure we don't display the same visible label twice
  const seenDisplay = new Set();
  groups.forEach((g, i) => {
    const div = document.createElement("div");
    div.className = "hint-group";
    div.dataset.groupIndex = String(i);
    div.setAttribute("role", "button");
    div.setAttribute("tabindex", "0");

    // Add hint interaction handlers
    div.addEventListener("click", () => toggleHintHighlight(i));
    div.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleHintHighlight(i);
      }
    });

    const cat = catNames[i];
    if (cat) {
      // nicer label: replace dashes and capitalize
      const rawLabel = String(cat).replace(/-/g, " ").trim();
      const displayKey = rawLabel.toLowerCase();
      const label = rawLabel.replace(/\b\w/g, (m) => m.toUpperCase());
      if (seenDisplay.has(displayKey)) {
        // duplicate visible label detected; fall back to word hint
        div.textContent = `${g[0]} · ${g.length - 1} more`;
      } else {
        div.textContent = label;
        seenDisplay.add(displayKey);
      }
    } else {
      div.textContent = `${g[0]} · ${g.length - 1} more`;
    }
    hintsList.appendChild(div);
  });
}

// Load a puzzle by id (either built-in or generated shape). This restores
// the previous loadPuzzle behavior used by controls and next/shuffle.
function loadPuzzle(id, { shuffleChoices = true } = {}) {
  const p = getPuzzle(id, { shuffleChoices });
  currentPuzzleId = p.id;
  puzzle = p;
  words = p.choices;
  groups = p.groups;
  selected = [];
  solvedSet = new Set();
  clearSpeechQueue();
  const titleEl = document.querySelector("h1");
  if (titleEl) titleEl.textContent = "Kids Connections";
  renderGrid();
  updateResult();
  // repopulate hints for the loaded puzzle
  populateHints();
  reorderHintsAccordingToWords();
  // Start the game timer for the new puzzle
  startGameTimer();
}

async function nextPuzzle() {
  // Always try to generate a puzzle client-side first. If generation fails
  // (insufficient categories or other error), fall back to the built-in puzzles.
  try {
    // ensure master wordlist is loaded before generating
    try {
      await loadMasterWordlist();
    } catch (e) {}
    const p = generatePuzzle({ seed: Date.now() });
    if (p) {
      // use the generated puzzle object shape directly
      currentPuzzleId = p.id;
      puzzle = p;
      words = puzzle.choices;
      groups = puzzle.groups;
      selected = [];
      solvedSet = new Set();
      const titleEl = document.querySelector("h1");
      if (titleEl) titleEl.textContent = "Kids Connections";
      renderGrid();
      updateResult();
      // populate and align hints for generated puzzle
      populateHints();
      reorderHintsAccordingToWords();
      // Start new timer for the new puzzle
      startGameTimer();
      try {
        playNext();
      } catch (e) {}
      return;
    }
  } catch (err) {
    console.warn("Generator failed, falling back to next puzzle", err);
  }
  const nextId = getNextPuzzleId(currentPuzzleId);
  loadPuzzle(nextId, { shuffleChoices: false });
  try {
    playNext();
  } catch (e) {}
}

function shufflePuzzle() {
  const randId = getRandomPuzzleId(currentPuzzleId);
  loadPuzzle(randId, { shuffleChoices: true });
  try {
    playShuffle();
  } catch (e) {}
}

// Text-to-speech system with message queue
const synth = window.speechSynthesis;
let speaking = false;
const speechQueue = [];

function processSpeechQueue() {
  if (speaking || speechQueue.length === 0 || speechMuted) return;

  speaking = true;
  const { text, options = {} } = speechQueue[0];

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = options.rate || 1.0;
  utterance.pitch = options.pitch || 1.0;
  utterance.volume = 0.8;

  utterance.onend = () => {
    speaking = false;
    speechQueue.shift(); // Remove the completed message
    processSpeechQueue(); // Process next message if any
  };

  utterance.onerror = () => {
    speaking = false;
    speechQueue.shift(); // Remove the failed message
    processSpeechQueue(); // Try next message
  };

  try {
    synth.speak(utterance);
  } catch (e) {
    speaking = false;
    speechQueue.shift();
    processSpeechQueue();
  }
}

function queueSpeech(text, options = {}) {
  if (speechMuted) return;
  speechQueue.push({ text, options });
  processSpeechQueue();
}

function speakWord(word, options = {}) {
  queueSpeech(word, options);
}

function speakCelebration(text, delay = 0) {
  if (speechMuted) return;
  setTimeout(() => {
    queueSpeech(text, { pitch: 1.2, rate: 1.1 }); // Slightly higher and faster for excitement
  }, delay);
}

// Clear speech queue (useful when resetting or changing puzzles)
function clearSpeechQueue() {
  speechQueue.length = 0;
  if (speaking) {
    try {
      synth.cancel();
    } catch (e) {
      console.warn("Failed to cancel speech:", e);
    }
    speaking = false;
  }
}

function toggleWord(el, word) {
  // ignore clicks on solved tiles
  if (el.classList.contains("solved")) return;

  if (selected.includes(word)) {
    // Always allow deselecting
    el.classList.remove("selected");
    selected = selected.filter((w) => w !== word);
  } else if (selected.length >= 4) {
    // Prevent selecting more than 4 words
    result.textContent = "You can only select 4 words!";
    speakWord("Only 4 words allowed", { pitch: 1.0 });
    return;
  } else {
    // Select the word
    el.classList.add("selected");
    selected.push(word);
    // Speak the word when it's selected
    speakWord(word);
  }

  // Clear any hint highlights when word selection changes
  clearHintHighlights();
  updateResult();
  try {
    playSelectSound();
  } catch (e) {
    /* ignore audio errors */
  }
}

function updateResult() {
  const solvedCount = solvedSet.size;
  result.textContent = `${selected.length} selected — ${solvedCount}/${groups.length} groups found`;
}

function checkAnswer() {
  if (selected.length !== 4) {
    result.textContent = "Select 4 words!";
    speakWord("Please pick 4 words", { pitch: 1.0 });
    return;
  }

  // find which group (if any) matches this selection and is not already solved
  const si = findMatchingGroupIndex(selected);
  if (si >= 0) {
    // mark solved
    solvedSet.add(si);
    markSolvedGroup(si);
    selected = [];
    updateResult();
    result.textContent = `🎉 Correct! ${solvedSet.size}/${groups.length} groups found`;
    try {
      playCorrect();
      speakCelebration("Good job!");
    } catch (e) {}
    if (solvedSet.size === groups.length) {
      result.textContent = "🎉🎉 All groups found!";
      speakCelebration("A winner! You found all the groups!", 500); // Delay to let "Good job" finish
      stopGameTimer(); // Stop the timer when puzzle is complete
    }
  } else {
    // incorrect
    result.textContent = "❌ Try again!";
    try {
      playIncorrect();
      speakWord("Try again", { pitch: 0.9 }); // Lower pitch for encouraging tone
    } catch (e) {}
    // clear current selection to let kid try again
    clearSelection();
  }
}

function findMatchingGroupIndex(selectedWords) {
  const s = selectedWords.map((x) => String(x).trim());
  for (let i = 0; i < groups.length; i++) {
    if (solvedSet.has(i)) continue;
    const g = groups[i].map((x) => String(x).trim());
    if (g.length !== s.length) continue;
    if (s.every((item) => g.includes(item))) return i;
  }
  return -1;
}

function markSolvedGroup(si) {
  // Animate: capture old positions, reorder words, render, then FLIP animate
  const oldRects = captureRects();
  // determine current columns count to compute the selected words' row
  const gridEl = document.getElementById("word-grid");
  let cols = 4;
  if (gridEl) {
    const style = window.getComputedStyle(gridEl);
    const template = style.getPropertyValue("grid-template-columns") || "";
    const parts = template.trim().split(/\s+/).filter(Boolean);
    if (parts.length > 0) cols = parts.length;
  }
  // determine the row where the selected words currently appear in the grid
  // compute first occurrence of any word from this group in the current words array
  let pos = -1;
  const grp = groups[si] || [];
  for (const w of grp) {
    const idx = words.indexOf(w);
    if (idx >= 0 && (pos === -1 || idx < pos)) pos = idx;
  }
  const selectedWordRow = pos === -1 ? null : Math.floor(pos / cols); // zero-based word-row

  reorderWordsAfterSolved();
  renderGrid();
  // reorder hints to match new words rows, but force this solved group's hint to the
  // row where the selected words were, so the category lines up with the selection.
  const overrides = {};
  if (selectedWordRow != null) overrides[si] = selectedWordRow;
  reorderHintsAccordingToWords(overrides);
  // After render and hint reorder, animate from old rects to new positions
  playFlipFromRects(oldRects);
}

function clearSelection() {
  selected = [];
  document
    .querySelectorAll(".word.selected")
    .forEach((el) => el.classList.remove("selected"));
  // Also clear any hint highlights
  clearHintHighlights();
  updateResult();
}

// Progress tracking
const playerStats = {
  gamesPlayed: 0,
  puzzlesSolved: 0,
  totalTime: 0,
  bestTimes: {},
  difficulty: "medium",
  streaks: {
    current: 0,
    best: 0,
  },
};

// Load player stats from localStorage
function loadPlayerStats() {
  const saved = localStorage.getItem("kc-stats");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      Object.assign(playerStats, parsed);
    } catch (e) {
      console.warn("Failed to load player stats:", e);
    }
  }
  updateStatsDisplay();
}

// Save player stats to localStorage
function savePlayerStats() {
  localStorage.setItem("kc-stats", JSON.stringify(playerStats));
  updateStatsDisplay();
}

// Update stats display
function updateStatsDisplay() {
  const statsEl = document.getElementById("player-stats");
  if (statsEl) {
    statsEl.innerHTML = `
      <div class="stat">Puzzles Solved: ${playerStats.puzzlesSolved}</div>
      <div class="stat">Current Streak: ${playerStats.streaks.current}</div>
      <div class="stat">Best Streak: ${playerStats.streaks.best}</div>
    `;
  }
}

// Difficulty levels configuration
const difficultyLevels = {
  easy: {
    name: "Easy",
    description: "Simple word groups with clear categories",
    maxCategories: 2,
    wordComplexity: 1,
  },
  medium: {
    name: "Medium",
    description: "Mixed categories with some challenging combinations",
    maxCategories: 3,
    wordComplexity: 2,
  },
  hard: {
    name: "Hard",
    description: "Complex categories and subtle connections",
    maxCategories: 4,
    wordComplexity: 3,
  },
};

// Set difficulty level
function setDifficulty(level) {
  if (difficultyLevels[level]) {
    playerStats.difficulty = level;
    savePlayerStats();
    // Update puzzle generation parameters
    updatePuzzleGeneration();
  }
}

// Update puzzle generation based on difficulty
function updatePuzzleGeneration() {
  const difficulty = difficultyLevels[playerStats.difficulty];
  // We'll use these settings when generating new puzzles
  window.puzzleConfig = {
    maxCategories: difficulty.maxCategories,
    wordComplexity: difficulty.wordComplexity,
  };
}

// Game timer
let gameStartTime = null;
let gameTimer = null;

function startGameTimer() {
  gameStartTime = Date.now();
  if (gameTimer) clearInterval(gameTimer);
  gameTimer = setInterval(updateGameTimer, 1000);
}

function stopGameTimer() {
  if (gameTimer) {
    clearInterval(gameTimer);
    gameTimer = null;
  }
  if (gameStartTime) {
    const duration = Math.floor((Date.now() - gameStartTime) / 1000);
    playerStats.totalTime += duration;
    const puzzleId = currentPuzzleId.toString();
    if (
      !playerStats.bestTimes[puzzleId] ||
      duration < playerStats.bestTimes[puzzleId]
    ) {
      playerStats.bestTimes[puzzleId] = duration;
    }
    savePlayerStats();
  }
}

function updateGameTimer() {
  if (!gameStartTime) return;
  const duration = Math.floor((Date.now() - gameStartTime) / 1000);
  const timerEl = document.getElementById("game-timer");
  if (timerEl) {
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    timerEl.textContent = `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }
}

// Track the currently active hint
let activeHintIndex = null;

// Hint highlighting functionality
function toggleHintHighlight(groupIndex) {
  const hintGroup = document.querySelector(
    `.hint-group[data-group-index="${groupIndex}"]`
  );
  if (!hintGroup) return;

  // If clicking the same hint that's already active, clear and exit
  if (activeHintIndex === groupIndex) {
    clearHintHighlights();
    return;
  }

  // Clear any existing highlights first
  clearHintHighlights();

  // Set this as the active hint
  activeHintIndex = groupIndex;
  hintGroup.classList.add("hint-active");

  // Find and highlight all words in this group
  const groupWords = groups[groupIndex] || [];
  document.querySelectorAll(".word").forEach((wordEl) => {
    if (groupWords.includes(wordEl.dataset.word)) {
      wordEl.classList.add("hint-highlighted");
    }
  });

  // Speak the category name if available (uses our existing speech functionality)
  if (!muted) {
    speakWord(hintGroup.textContent);
  }
}

function clearHintHighlights() {
  // Remove highlight classes from hints and words
  document
    .querySelectorAll(".hint-group")
    .forEach((el) => el.classList.remove("hint-active"));
  document
    .querySelectorAll(".word")
    .forEach((el) => el.classList.remove("hint-highlighted"));
  // Clear the active hint tracking
  activeHintIndex = null;
}

function resetGame() {
  selected = [];
  solvedSet = new Set();
  document
    .querySelectorAll(".word")
    .forEach((el) => el.classList.remove("selected", "solved"));
  clearHintHighlights();
  clearSpeechQueue();
  result.textContent = "";
  // Reset and start the timer
  startGameTimer();
}

function revealAnswer() {
  // reveal all groups as solved and animate reorder once
  const oldRects = captureRects();
  solvedSet = new Set(groups.map((_, i) => i));
  reorderWordsAfterSolved();
  renderGrid();
  reorderHintsAccordingToWords();
  playFlipFromRects(oldRects);
  result.textContent = "Answers revealed";
  try {
    playReveal();
  } catch (e) {}
}

document.getElementById("check-btn").addEventListener("click", checkAnswer);
document.getElementById("reset-btn").addEventListener("click", resetGame);
document.getElementById("reveal-btn").addEventListener("click", revealAnswer);
document.getElementById("next-btn").addEventListener("click", nextPuzzle);
document.getElementById("shuffle-btn").addEventListener("click", shufflePuzzle);

renderGrid();

// populate hints on initial load so the hints column is in sync
populateHints();

// Start the timer for the initial puzzle
startGameTimer();

// Try to preload the master wordlist for the client-side generator
(async () => {
  try {
    await loadMasterWordlist();
    console.log("master_wordlist loaded for client generator");
    // repopulate hints now that category names are available
    try {
      populateHints();
      reorderHintsAccordingToWords();
    } catch (e) {}
  } catch (e) {
    console.warn("failed to load master wordlist for generator", e);
  }
})();

function populatePuzzleSelect() {
  if (!puzzleSelect) return;
  const list = getAllPuzzles();
  puzzleSelect.innerHTML = "";
  list.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.title;
    if (p.id === currentPuzzleId) opt.selected = true;
    puzzleSelect.appendChild(opt);
  });
}

if (puzzleSelect) {
  populatePuzzleSelect();
  puzzleSelect.addEventListener("change", (e) => {
    const id = Number(e.target.value);
    loadPuzzle(id, { shuffleChoices: false });
  });
}

// generator toggle (optional). If there's no element, nothing happens and existing behavior remains.
// generator now runs automatically; no manual toggle to initialize

// hints visibility toggle — keep header visible, hide only the list
const showHints = document.getElementById("show-hints");
if (showHints) {
  const hintsCol = document.querySelector(".hints-column");
  const setHintsVisible = (visible) => {
    const list = document.getElementById("hints-list");
    if (list) list.style.display = visible ? "" : "none";
    if (hintsCol) {
      if (!visible) hintsCol.classList.add("collapsed");
      else hintsCol.classList.remove("collapsed");
    }
  };
  showHints.addEventListener("change", (e) =>
    setHintsVisible(e.target.checked)
  );
  // set initial state based on checkbox
  setHintsVisible(showHints.checked);
}

// Initialize sound and speech controls
const soundBtn = document.getElementById("sound-btn");
const speechBtn = document.getElementById("speech-btn");

if (soundBtn) {
  setSoundMuted(soundMuted);
  soundBtn.addEventListener("click", () => setSoundMuted(!soundMuted));
}

if (speechBtn) {
  setSpeechMuted(speechMuted);
  speechBtn.addEventListener("click", () => setSpeechMuted(!speechMuted));
}

// Initialize difficulty control
const difficultySelect = document.getElementById("difficulty");
if (difficultySelect) {
  // Set initial value from stored preference
  difficultySelect.value = playerStats.difficulty || "medium";

  difficultySelect.addEventListener("change", (e) => {
    const newDifficulty = e.target.value;
    setDifficulty(newDifficulty);

    // Generate a new puzzle with the new difficulty
    nextPuzzle();

    // Announce the difficulty change
    speakWord(`Difficulty set to ${newDifficulty}`, { pitch: 1.1 });
  });
}

// Text fitting function
function fitText(element) {
  const container = element.parentElement;
  const maxWidth = container.clientWidth - 16; // Account for padding
  const maxHeight = container.clientHeight - 16;

  // Start with the current font size
  let fontSize = parseFloat(getComputedStyle(element).fontSize);
  const minFontSize = 10; // Don't go smaller than this

  // Reset any previous scaling
  element.style.fontSize = "";

  // Check if text is overflowing
  while (
    (element.scrollWidth > maxWidth || element.scrollHeight > maxHeight) &&
    fontSize > minFontSize
  ) {
    fontSize = Math.max(fontSize - 1, minFontSize);
    element.style.fontSize = fontSize + "px";
  }
}

// Debounced resize handler for updating text fitting
let resizeTimeout;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    document.querySelectorAll(".text-fit").forEach(fitText);
  }, 100);
});

// Theme management
const themeBtn = document.getElementById("theme-btn");
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");
let currentTheme = localStorage.getItem("kc-theme") || "auto";

function setTheme(theme) {
  currentTheme = theme;
  localStorage.setItem("kc-theme", theme);

  // Remove any existing theme classes
  document.documentElement.classList.remove("dark-theme", "light-theme");
  themeBtn.classList.remove("theme-auto");

  // Apply the appropriate theme
  if (theme === "dark" || (theme === "auto" && prefersDark.matches)) {
    document.documentElement.classList.add("dark-theme");
    themeBtn.textContent = "☀️";
  } else {
    document.documentElement.classList.add("light-theme");
    themeBtn.textContent = "🌙";
  }

  // Show auto indicator
  if (theme === "auto") {
    themeBtn.classList.add("theme-auto");
  }

  themeBtn.setAttribute("aria-pressed", theme === "dark");
}

// Initialize theme
setTheme(currentTheme);

// Theme toggle button click handler
if (themeBtn) {
  themeBtn.addEventListener("click", () => {
    // Cycle through themes: auto -> light -> dark -> auto
    const nextTheme = {
      auto: "light",
      light: "dark",
      dark: "auto",
    }[currentTheme];
    setTheme(nextTheme);
  });
}

// Watch for system theme changes
prefersDark.addEventListener("change", (e) => {
  if (currentTheme === "auto") {
    setTheme("auto"); // This will re-apply the system preference
  }
});

// expose for debugging in console
window._game = {
  words,
  puzzle,
  selected,
  checkAnswer,
  resetGame,
  revealAnswer,
  loadPuzzle,
  nextPuzzle,
  shufflePuzzle,
};
