import {
  getNextPuzzleId,
  getPuzzle,
  getRandomPuzzleId,
  initializePuzzles,
  shuffle,
} from "./game.mjs";
import {
  generatePuzzle,
  guessCategoriesForGroups,
  loadMasterWordlist,
} from "./generator.mjs";

let currentPuzzleId = 1;
let puzzle = null;
let words = [];
let groups = [];
let selected = [];
let solvedSet = new Set(); // indexes of solved groups for current puzzle

const result = document.getElementById("result");

// Web Audio helpers and sound/speech state
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx)
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

// Sound effects state
let soundMuted = localStorage.getItem("kc-sound-muted") === "1";
let speechMuted = false; // Force speech enabled for testing

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
  // Use existing static grid elements instead of creating new ones
  for (let idx = 0; idx < 16; idx++) {
    const cell = document.getElementById(`word-${idx}`);

    if (!cell) {
      console.error(`Could not find word-${idx} element`);
      continue;
    }

    const word = words[idx];
    const rowIdx = Math.floor(idx / 4);
    const colIdx = idx % 4;

    if (word) {
      // Update content and attributes - text goes directly on cell now
      cell.textContent = word;

      // Clear any inline styles that might override CSS
      cell.style.fontSize = "";
      cell.style.whiteSpace = "";
      cell.style.wordBreak = "";
      cell.style.overflowWrap = "";
      cell.style.hyphens = "";

      cell.setAttribute("aria-label", word);
      cell.setAttribute("aria-selected", "false");
      cell.setAttribute("aria-colindex", colIdx + 1);
      cell.setAttribute("aria-rowindex", rowIdx + 1);
      cell.dataset.word = word;
      cell.dataset.row = rowIdx;
      cell.dataset.col = colIdx;

      // Add group data
      const groupIndices = [];
      groups.forEach((g, i) => {
        if (g.includes(word)) groupIndices.push(i);
      });
      if (groupIndices.length) {
        cell.dataset.groups = groupIndices.join(",");
      } else {
        delete cell.dataset.groups;
      }

      // Handle solved state
      if (isWordSolved(word)) {
        cell.classList.add("solved");
        cell.tabIndex = -1;
        cell.setAttribute("aria-disabled", "true");
      } else {
        cell.classList.remove("solved");
        cell.tabIndex = 0;
        cell.removeAttribute("aria-disabled");
      }

      // Clear selection state
      cell.classList.remove("selected");

      // Show the cell
      cell.style.display = "";
    } else {
      // Hide unused cells
      cell.style.display = "none";
      cell.textContent = "";
      cell.removeAttribute("aria-label");
      delete cell.dataset.word;
      delete cell.dataset.row;
      delete cell.dataset.col;
      delete cell.dataset.groups;
    }
  }

  // Initialize text fitting for all visible cells
  requestAnimationFrame(() => {
    const wordElements = document.querySelectorAll(".word");
    wordElements.forEach((el) => {
      // Temporarily disable fitText - use CSS sizing instead
      // fitText(el);
      // Add loaded class after a brief delay to ensure smooth transition
      setTimeout(() => el.classList.add("loaded"), 50);
    });
  });
}

// Helper functions

function isWordSolved(word) {
  for (const si of solvedSet) {
    const g = groups[si] || [];
    if (g.includes(word)) return true;
  }
  return false;
}

function reorderWordsAfterSolved() {
  // Use a Set to ensure unique words and maintain insertion order
  const seenWords = new Set();
  const solvedWords = [];

  // First add all solved words in group order, skipping duplicates
  for (const si of solvedSet) {
    const g = groups[si] || [];
    for (const w of g) {
      if (!seenWords.has(w)) {
        seenWords.add(w);
        solvedWords.push(w);
      }
    }
  }

  // Then add remaining unique words
  const remaining = words.filter((w) => !seenWords.has(w));
  const shuffledRemaining = shuffle(remaining);

  // Update the words array with unique words only
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

  // We always use 4 columns in the grid
  const cols = 4;

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
    // For solved groups without an override, find their current position in the word list
    if (solvedSet.has(gi)) {
      let pos = -1;
      for (const w of grp) {
        const idx = words.indexOf(w);
        if (idx >= 0 && (pos === -1 || idx < pos)) pos = idx;
      }
      groupWordRow.set(key, pos === -1 ? Infinity : Math.floor(pos / cols));
    } else {
      // For unsolved groups, find their lowest word position
      let pos = -1;
      for (const w of grp) {
        const idx = words.indexOf(w);
        if (idx >= 0 && (pos === -1 || idx < pos)) pos = idx;
      }
      groupWordRow.set(key, pos === -1 ? Infinity : Math.floor(pos / cols));
    }
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

async function populateHints() {
  const hintsList = document.getElementById("hints-list");
  const hintsCol = document.querySelector(".hints-column");
  if (!hintsList || !hintsCol) return;

  console.log(
    "Populating hints. Current puzzle:",
    JSON.stringify(puzzle, null, 2)
  );

  // First try to use stored category labels from the puzzle
  let catNames = puzzle.groupLabels || [];
  console.log("Initial catNames:", catNames);

  // If no labels stored, try to use previously guessed categories or guess new ones
  if (!catNames.length) {
    try {
      // First check if we have previously guessed categories for this puzzle
      if (
        playerStats.lastPuzzleId === currentPuzzleId &&
        playerStats.lastPuzzleLabels
      ) {
        catNames = playerStats.lastPuzzleLabels;
      } else {
        // Make sure wordlist is loaded
        await loadMasterWordlist();
        // Try to guess categories
        const guessed = guessCategoriesForGroups(groups) || [];
        if (guessed.some((x) => x)) {
          catNames = guessed;
          // Store the guessed categories
          playerStats.lastPuzzleLabels = guessed;
          playerStats.lastPuzzleId = currentPuzzleId;
          savePlayerStats();
        }
      }
    } catch (e) {
      console.warn("Failed to guess categories:", e);
      catNames = [];
    }
  }

  // defensive dedupe: ensure we don't display the same visible label twice
  const seenDisplay = new Set();

  // Update static hint elements instead of creating new ones
  for (let i = 0; i < 4; i++) {
    const hintElement = document.getElementById(`hint-${i}`);
    const hintTextDiv = hintElement?.querySelector(".hint-text");
    const hintWordsDiv = hintElement?.querySelector(".hint-words");

    if (!hintElement || !hintTextDiv || !hintWordsDiv) {
      console.error(`Could not find hint-${i} element or its children`);
      continue;
    }

    if (i < groups.length) {
      const g = groups[i];

      // Update dataset
      hintElement.dataset.groupIndex = String(i);

      const cat = catNames[i];
      if (cat) {
        // nicer label: replace dashes and capitalize
        const rawLabel = String(cat).replace(/-/g, " ").trim();
        const displayKey = rawLabel.toLowerCase();
        const label = rawLabel.replace(/\b\w/g, (m) => m.toUpperCase());
        if (seenDisplay.has(displayKey)) {
          // duplicate visible label detected; fall back to word hint
          hintTextDiv.textContent = `${g[0]} · ${g.length - 1} more`;
        } else {
          hintTextDiv.textContent = label;
          seenDisplay.add(displayKey);
        }
      } else {
        hintTextDiv.textContent = `${g[0]} · ${g.length - 1} more`;
      }

      // Show the hint element
      hintElement.style.display = "";
    } else {
      // Hide unused hint elements
      hintElement.style.display = "none";
      hintTextDiv.textContent = "";
      hintWordsDiv.textContent = "";
    }
  }
}

// Load a puzzle by id (either built-in or generated shape). This restores
// the previous loadPuzzle behavior used by controls and next/shuffle.
async function loadPuzzle(id, { shuffleChoices = true } = {}) {
  // If there's a partially solved puzzle, count it as abandoned
  if (solvedSet.size > 0 && solvedSet.size < groups.length) {
    playerStats.streaks.current = 0; // Break the streak for abandoned puzzle
    playerStats.gamesPlayed++;
    savePlayerStats();
  }

  // Ensure wordlist is loaded for category hints
  await loadMasterWordlist();

  const p = getPuzzle(id, { shuffleChoices });
  currentPuzzleId = p.id;
  puzzle = p;
  // Ensure unique words in choices
  const uniqueChoices = [...new Set(p.choices)];
  words = uniqueChoices;
  groups = p.groups;
  selected = [];
  solvedSet = new Set();
  clearSpeechQueue();

  // Save the puzzle state
  playerStats.lastPuzzleId = p.id;
  playerStats.lastPuzzleGroups = p.groups;
  if (p.groupLabels) {
    playerStats.lastPuzzleLabels = p.groupLabels;
  }
  savePlayerStats();
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
    // ensure master wordlist is loaded before generating or displaying
    await loadMasterWordlist();
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
  console.log(
    "processSpeechQueue called, speaking:",
    speaking,
    "queue length:",
    speechQueue.length,
    "speechMuted:",
    speechMuted
  );
  if (speaking || speechQueue.length === 0 || speechMuted) return;

  speaking = true;
  const { text, options = {} } = speechQueue[0];
  console.log("About to speak:", text);

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
  console.log("queueSpeech called:", text, "speechMuted:", speechMuted);
  if (speechMuted) return;
  speechQueue.push({ text, options });
  processSpeechQueue();
}

function speakWord(word, options = {}) {
  console.log("speakWord called with:", word);
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
    // Remove animation classes
    el.classList.remove("wrong");
    // Reset aria attributes
    el.setAttribute("aria-selected", "false");
    selected = selected.filter((w) => w !== word);
  } else if (selected.length >= 4) {
    // Prevent selecting more than 4 words
    result.textContent = "You can only select 4 words!";
    speakWord("Only 4 words allowed", { pitch: 1.0 });
    // Add wrong animation
    el.classList.add("wrong");
    setTimeout(() => el.classList.remove("wrong"), 400);
    return;
  } else {
    // Select the word
    el.classList.add("selected");
    el.setAttribute("aria-selected", "true");
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
      // Update player stats on puzzle completion
      playerStats.puzzlesSolved++;
      playerStats.streaks.current++;
      playerStats.streaks.best = Math.max(
        playerStats.streaks.best,
        playerStats.streaks.current
      );
      playerStats.gamesPlayed++;
      savePlayerStats();
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

  // Fixed column count since we use a 4x4 grid
  const cols = 4;

  // Find first occurrence of any selected word to determine its row
  let pos = -1;
  const grp = groups[si] || [];
  for (const w of selected) {
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
  document.querySelectorAll(".Gridcell.word.selected").forEach((el) => {
    el.classList.remove("selected");
    el.setAttribute("aria-selected", "false");
  });
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
  lastPuzzleId: null, // Track the last puzzle shown
  lastPuzzleGroups: null, // Store the last puzzle's group data
  lastPuzzleLabels: null, // Store the last puzzle's category labels
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
  if (!speechMuted) {
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
document
  .getElementById("next-btn")
  .addEventListener("click", () => nextPuzzle().catch(console.error));
document.getElementById("shuffle-btn").addEventListener("click", () => {
  const randId = getRandomPuzzleId(currentPuzzleId);
  loadPuzzle(randId, { shuffleChoices: true }).catch(console.error);
});

// Set up static event handlers for grid cells and hints
function setupStaticEventHandlers() {
  // Set up event handlers for static grid cells
  for (let idx = 0; idx < 16; idx++) {
    const cell = document.getElementById(`word-${idx}`);
    if (!cell) continue;

    // Add click event handler
    cell.addEventListener("click", () => {
      console.log("Grid cell clicked:", cell.id);
      const word = cell.dataset.word;
      console.log("Word from dataset:", word);
      if (!word || isWordSolved(word)) return;

      const isSelected = cell.classList.contains("selected");
      if (isSelected) {
        cell.classList.remove("selected");
        cell.setAttribute("aria-selected", "false");
        selected = selected.filter((w) => w !== word);
      } else {
        cell.classList.add("selected");
        cell.setAttribute("aria-selected", "true");
        selected.push(word);
        // Speak the word when it's selected
        console.log("About to call speakWord with:", word);
        speakWord(word);
        // Play selection sound
        try {
          playSelectSound();
        } catch (e) {}
      }
      updateResult();
    });

    // Add keyboard event handler
    cell.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        cell.click();
      }
    });
  }

  // Set up event handlers for static hint elements
  for (let i = 0; i < 4; i++) {
    const hintElement = document.getElementById(`hint-${i}`);
    if (!hintElement) continue;

    // Add click event handler
    hintElement.addEventListener("click", () => {
      const groupIndex = parseInt(hintElement.dataset.groupIndex);
      if (!isNaN(groupIndex)) {
        toggleHintHighlight(groupIndex);
      }
    });

    // Add keyboard event handler
    hintElement.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const groupIndex = parseInt(hintElement.dataset.groupIndex);
        if (!isNaN(groupIndex)) {
          toggleHintHighlight(groupIndex);
        }
      }
    });
  }
}

// Initialize the game
async function startGame() {
  console.log("Starting game initialization...");

  // Load saved player stats
  loadPlayerStats();
  console.log("Player stats loaded");

  try {
    // First initialize puzzles
    console.log("Initializing puzzles...");
    await initializePuzzles();
    console.log("Puzzles initialized");

    // Get saved or default puzzle ID
    currentPuzzleId = playerStats.lastPuzzleId || 1;
    console.log("Loading master wordlist...");
    await loadMasterWordlist();
    console.log("Master wordlist loaded for client generator");

    // If we have a saved puzzle state, restore it
    if (playerStats.lastPuzzleId !== null) {
      currentPuzzleId = playerStats.lastPuzzleId;
      // Get the puzzle but preserve the saved labels
      puzzle = getPuzzle(currentPuzzleId, { shuffleChoices: false });
      if (playerStats.lastPuzzleLabels) {
        puzzle.groupLabels = playerStats.lastPuzzleLabels;
      }
      if (playerStats.lastPuzzleGroups) {
        puzzle.groups = playerStats.lastPuzzleGroups;
      }
    } else {
      // Load initial puzzle if no saved state
      puzzle = getPuzzle(currentPuzzleId, { shuffleChoices: false });
    }

    console.log("Loading initial puzzle state:", { currentPuzzleId, puzzle });
    words = puzzle.choices;
    groups = puzzle.groups;
    console.log("Puzzle data prepared:", { words, groups });

    // Render everything in the correct order
    console.log("Starting render sequence...");
    renderGrid();
    console.log("Grid rendered");
    populateHints();
    console.log("Hints populated");
    reorderHintsAccordingToWords();
    console.log("Hints reordered");
    updateResult();

    // Start the timer only after everything is loaded
    startGameTimer();
  } catch (e) {
    console.warn("Failed to initialize game:", e);
  }
}

// Start the game initialization when modules are loaded
window.addEventListener("DOMContentLoaded", async () => {
  console.log("DOM Content Loaded, starting initialization...");
  try {
    // Set up static event handlers first
    setupStaticEventHandlers();

    // Wait for module imports to be ready
    await Promise.resolve();
    await startGame();
  } catch (err) {
    console.error("Game initialization failed:", err);
    // Try to provide more detail about the error
    if (err instanceof ReferenceError) {
      console.log("Module state:", {
        initializePuzzles: typeof initializePuzzles,
        getPuzzle: typeof getPuzzle,
        loadMasterWordlist: typeof loadMasterWordlist,
      });
    }
  }
});

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

// Text fitting function - DISABLED for CSS-only sizing
function fitText(element) {
  // Function disabled - using CSS clamp() for responsive sizing instead
  return;
}

// Debounced resize handler for updating text fitting
let resizeTimeout;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    // Temporarily disable fitText - use CSS sizing instead
    // document.querySelectorAll(".word").forEach(fitText);
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
