// Load and manage word data
let words = [];
let activeFilters = {
  categories: new Set(),
  pos: new Set(),
  search: "",
};

async function loadWords() {
  try {
    const response = await fetch("master_wordlist.json");
    words = await response.json();
    initializeFilters();
    renderWords(filterWords());
  } catch (error) {
    console.error("Error loading words:", error);
    document.getElementById("wordList").innerHTML =
      '<div class="error">Error loading words. Please try again later.</div>';
  }
}

// Filter management
function initializeFilters() {
  const categories = new Set();
  const pos = new Set();

  words.forEach((word) => {
    word.categories.forEach((cat) => categories.add(cat));
    word.pos.forEach((p) => pos.add(p));
  });

  renderFilterChips("categoryFilters", Array.from(categories).sort());
  renderFilterChips("posFilters", Array.from(pos).sort());
}

function renderFilterChips(containerId, items) {
  const container = document.getElementById(containerId);
  container.innerHTML = items
    .map(
      (item) => `
        <div class="filter-chip" data-value="${item}">
            ${item}
        </div>
    `
    )
    .join("");

  container.addEventListener("click", (e) => {
    const chip = e.target.closest(".filter-chip");
    if (!chip) return;

    const value = chip.dataset.value;
    const filterType = containerId === "categoryFilters" ? "categories" : "pos";

    chip.classList.toggle("active");
    if (chip.classList.contains("active")) {
      activeFilters[filterType].add(value);
    } else {
      activeFilters[filterType].delete(value);
    }

    renderWords(filterWords());
  });
}

function filterWords() {
  return words.filter((word) => {
    // Search filter
    if (
      activeFilters.search &&
      !word.word.toLowerCase().includes(activeFilters.search.toLowerCase())
    ) {
      return false;
    }

    // Category filter
    if (activeFilters.categories.size > 0) {
      if (!word.categories.some((cat) => activeFilters.categories.has(cat))) {
        return false;
      }
    }

    // Part of speech filter
    if (activeFilters.pos.size > 0) {
      if (!word.pos.some((p) => activeFilters.pos.has(p))) {
        return false;
      }
    }

    return true;
  });
}

// Word rendering
function renderWords(filteredWords) {
  const wordList = document.getElementById("wordList");
  wordList.innerHTML = filteredWords
    .map(
      (word) => `
        <div class="word-card" data-word="${word.word}">
            <h3>${word.word}</h3>
            <div class="word-preview">
                ${
                  word.categories[0]
                    ? `<span class="category-tag">${word.categories[0]}</span>`
                    : ""
                }
                ${
                  word.pos[0]
                    ? `<span class="pos-tag">${word.pos[0]}</span>`
                    : ""
                }
            </div>
        </div>
    `
    )
    .join("");
}

// Word detail view
function showWordDetail(word) {
  const detail = document.getElementById("wordDetail");
  const wordData = words.find((w) => w.word === word);

  if (!wordData) return;

  document.getElementById("detailWord").textContent = wordData.word;
  document.getElementById("detailCategories").innerHTML = wordData.categories
    .map((cat) => `<span class="category-tag">${cat}</span>`)
    .join("");
  document.getElementById("detailPos").innerHTML = wordData.pos
    .map((p) => `<span class="pos-tag">${p}</span>`)
    .join("");

  detail.classList.remove("hidden");
}

// Event Listeners
document.addEventListener("DOMContentLoaded", () => {
  loadWords();

  // Search input
  const searchInput = document.getElementById("searchInput");
  searchInput.addEventListener("input", (e) => {
    activeFilters.search = e.target.value;
    renderWords(filterWords());
  });

  // Word card clicks
  document.getElementById("wordList").addEventListener("click", (e) => {
    const card = e.target.closest(".word-card");
    if (card) {
      showWordDetail(card.dataset.word);
    }
  });

  // Close detail view
  document.getElementById("closeDetail").addEventListener("click", () => {
    document.getElementById("wordDetail").classList.add("hidden");
  });

  // Close detail view when clicking outside
  document.getElementById("wordDetail").addEventListener("click", (e) => {
    if (e.target === document.getElementById("wordDetail")) {
      document.getElementById("wordDetail").classList.add("hidden");
    }
  });
});
