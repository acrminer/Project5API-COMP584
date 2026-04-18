// ES6 const declarations - block-scoped, immutable bindings for DOM references
const cardGrid = document.getElementById('card-grid');
const loading = document.getElementById('loading');
const modalOverlay = document.getElementById('modal-overlay');
const modalClose = document.getElementById('modal-close');

// let allows reassignment - used because allPokemon is populated after async API fetch
let allPokemon = [];

// Object literal as a lookup map - converts PokeAPI's kebab-case stat names to display abbreviations
const statAbbrev = {
    'hp': 'HP', 'attack': 'ATK', 'defense': 'DEF',
    'special-attack': 'SPA', 'special-defense': 'SPD', 'speed': 'SPE'
};

// === PokeAPI Integration ===
// PokeAPI endpoint: /pokemon?limit=N returns a paginated list with { results: [{ name, url }] }
// Each result's `url` points to the full Pokemon resource (stats, sprites, types, etc.)
// Using Fetch API (modern replacement for XMLHttpRequest) with Promise chaining
function fetchPokemon() {
    fetch('https://pokeapi.co/api/v2/pokemon?limit=20')
        // Arrow function parses the Response object as JSON (returns a Promise)
        .then(res => res.json())
        // Array.prototype.map transforms each result into a fetch Promise for full details
        // Promise.all runs all 20 detail requests in parallel and resolves when all complete
        // This is more efficient than sequential fetches (20 round trips -> 1 parallel batch)
        .then(data => Promise.all(data.results.map(p => fetch(p.url).then(r => r.json()))))
        .then(details => {
            allPokemon = details;
            // classList API: modern, cleaner alternative to className string manipulation
            loading.classList.add('hidden');
            renderCards(allPokemon);
        })
        // .catch handles any rejected Promise in the chain (network errors, JSON parse failures, etc.)
        .catch(() => {
            loading.innerHTML = '<p>Failed to load. Please refresh.</p>';
        });
}

// Render Pokemon cards and animate them in with staggered fade
function renderCards(list) {
    cardGrid.innerHTML = '';
    if (!list.length) {
        cardGrid.innerHTML = '<p style="color:#aaa;padding:2rem;text-align:center">No Pokemon found.</p>';
        return;
    }
    // forEach with arrow function iterates over Pokemon array from PokeAPI
    list.forEach(pokemon => {
        const card = document.createElement('div');
        card.className = 'poke-card';
        // Template literals (backticks) allow multi-line strings and ${} interpolation
        // padStart(3, '0') pads Pokemon ID to 3 digits (e.g., 1 -> "001") ES2017 feature
        // Logical OR (||) provides fallback sprite if official-artwork is missing
        // Bracket notation ['official-artwork'] required because property contains a hyphen
        card.innerHTML = `
            <span class="card-id">#${String(pokemon.id).padStart(3, '0')}</span>
            <img src="${pokemon.sprites.other['official-artwork'].front_default || pokemon.sprites.front_default}"
                 alt="${pokemon.name}" loading="lazy">
            <p class="card-name">${pokemon.name}</p>
            <div class="card-types">
                ${pokemon.types.map(t => `<span class="type-badge type-${t.type.name}">${t.type.name}</span>`).join('')}
            </div>
        `;
        // Closure captures `pokemon` reference so each card opens its own modal on click
        card.addEventListener('click', () => openModal(pokemon));
        cardGrid.appendChild(card);
    });

    // === Anime.js Animation: Card Entrance ===
    // anime() accepts config object with targets, properties to animate, and timing options
    // - targets: CSS selector (Anime.js queries DOM automatically)
    // - opacity: [0, 1] means animate FROM 0 TO 1 (array = explicit from/to values)
    // - anime.stagger(60): each card's animation starts 60ms after the previous (cascading effect)
    // - easing: 'easeOutCubic' decelerates smoothly at the end (feels natural)
    anime({
        targets: '.poke-card',
        opacity: [0, 1],
        delay: anime.stagger(60),
        duration: 500,
        easing: 'easeOutCubic'
    });
}

// Populate modal with selected Pokemon data and show it
function openModal(pokemon) {
    // PokeAPI sprites object contains multiple image variants; prefer high-res official artwork
    document.getElementById('modal-image').src =
        pokemon.sprites.other['official-artwork'].front_default || pokemon.sprites.front_default;
    document.getElementById('modal-image').alt = pokemon.name;
    document.getElementById('modal-name').textContent = pokemon.name;
    // .map() transforms the types array into HTML strings, .join('') concatenates them
    document.getElementById('modal-types').innerHTML = pokemon.types
        .map(t => `<span class="type-badge type-${t.type.name}">${t.type.name}</span>`).join('');
    // PokeAPI returns height in decimeters and weight in hectograms - divide by 10 for meters/kg
    // toFixed(1) rounds to 1 decimal place and returns a string
    document.getElementById('modal-height').textContent = (pokemon.height / 10).toFixed(1) + ' m';
    document.getElementById('modal-weight').textContent = (pokemon.weight / 10).toFixed(1) + ' kg';
    // || 'N/A' fallback for Pokemon without base_experience data
    document.getElementById('modal-exp').textContent = pokemon.base_experience || 'N/A';

    const statsContainer = document.getElementById('modal-stats');
    statsContainer.innerHTML = '';
    // PokeAPI's stats array contains { base_stat, stat: { name } } for each of 6 stats
    pokemon.stats.forEach(stat => {
        const val = stat.base_stat;
        // Scale base_stat value (PokeAPI max is 255) to a percentage for bar width
        // Math.min caps at 100% as a safety guard
        const pct = Math.min((val / 255) * 100, 100);
        // Nested ternary operator assigns CSS class based on stat thresholds
        const cls = val >= 90 ? 'stat-high' : val >= 50 ? 'stat-mid' : 'stat-low';
        const row = document.createElement('div');
        row.className = 'stat-row';
        // data-w attribute stores the target width percentage; read by Anime.js below via el.dataset.w
        // Fallback to stat.stat.name if abbreviation isn't in the lookup map
        row.innerHTML = `
            <span class="stat-name">${statAbbrev[stat.stat.name] || stat.stat.name}</span>
            <span class="stat-value">${val}</span>
            <div class="stat-bar-bg"><div class="stat-bar-fill ${cls}" data-w="${pct}"></div></div>
        `;
        statsContainer.appendChild(row);
    });

    modalOverlay.classList.add('active');
    // Prevent background scroll while modal is open (common UX pattern for modals)
    document.body.style.overflow = 'hidden';

    // === Anime.js Animation: Stat Bars Fill ===
    // Demonstrates per-element dynamic values via function-based property
    // - width: (el) => ... receives each element and returns its individual target width from data-w
    // - anime.stagger(80, { start: 300 }): 300ms initial delay, then 80ms stagger between bars
    //   (lets the modal appear first, then bars fill in sequence)
    // - easing: 'easeOutQuart' - fast start, smooth deceleration (classic stat-bar feel)
    anime({
        targets: '.stat-bar-fill',
        width: el => el.dataset.w + '%',
        delay: anime.stagger(80, { start: 300 }),
        duration: 600,
        easing: 'easeOutQuart'
    });
}

// Hide modal and restore scrolling
function closeModal() {
    modalOverlay.classList.remove('active');
    // Reset to empty string restores default CSS overflow behavior
    document.body.style.overflow = '';
}

// === Event Listeners (multiple ways to close modal) ===
modalClose.addEventListener('click', closeModal);
// Event delegation pattern: e.target is the actual clicked element
// Only close if click was on overlay itself (not bubbled up from modal content)
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });
// KeyboardEvent.key provides the logical key name (modern replacement for keyCode)
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// Kick off PokeAPI fetch when script runs (at end of body, so DOM is ready)
fetchPokemon();
