const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const levelEl = document.getElementById('level');
const powerEl = document.getElementById('power');
const startButton = document.getElementById('startButton');
const continueButton = document.getElementById('continueButton');

// Grid dimensions (20 x 15 cells, each 40px = 800 x 600 canvas)
const COLS = 20;
const ROWS = 15;
const CELL = 40;

const SETTINGS_KEY = 'blockadeGame.settings';

let activeTheme;   // the currently selected theme object (from window.THEMES)
let settings;      // numeric gameplay settings, loaded at the start of each game
let player;        // { x, y } in grid coordinates
let obstacles;     // Set of "x,y" keys
let items;         // Set of "x,y" keys
let blueBonus;     // { x, y } or null
let yellowBonus;   // { x, y } or null
let score;
let level;
let power;         // remaining "destroy an obstacle" charges
let yellowAvailableAt;
let nextWaveScore;
let tick;
let running;
let intervalId;
let startTime;

let dir = { dx: 0, dy: -1 };

function init() {
    canvas.width = COLS * CELL;
    canvas.height = ROWS * CELL;
    loadSettingsFromStorage();
    muted = document.getElementById('mute').checked;
    musicVol = clampInt(input('musicVolume'), 0, 100, 50);
    setTheme(document.getElementById('theme').value);
    setupTabs();
    document.addEventListener('keydown', handleKeyPress);
    startButton.addEventListener('click', startGame);
    continueButton.addEventListener('click', continueGame);
    // Auto-save settings whenever any input changes.
    document.querySelectorAll('#settings input').forEach(el => {
        el.addEventListener('input', saveSettingsToStorage);
    });
    // Mute applies immediately (and starts audio when unmuting).
    document.getElementById('mute').addEventListener('change', function () {
        muted = this.checked;
        saveSettingsToStorage();
        if (!muted) getAudio();
    });
    // Music volume applies immediately.
    document.getElementById('musicVolume').addEventListener('input', function () {
        musicVol = clampInt(parseInt(this.value, 10), 0, 100, 50);
    });
    // Theme switch applies immediately.
    document.getElementById('theme').addEventListener('change', function () {
        setTheme(this.value);
        saveSettingsToStorage();
    });
    startGame();
}

// Select the active theme and update title + legend.
function setTheme(id) {
    activeTheme = window.THEMES[id] || window.THEMES.classic;
    document.title = activeTheme.name;
    document.getElementById('gameTitle').textContent = activeTheme.name;
    renderLegend(activeTheme.legend);
    if (audioCtx) {
        stopMusic();
        if (!muted) startMusic();
    }
}

function renderLegend(entries) {
    const legendEl = document.getElementById('legend');
    legendEl.innerHTML = '';
    entries.forEach(e => {
        const item = document.createElement('span');
        item.className = 'legend-item';
        const dot = document.createElement('span');
        dot.className = 'dot';
        dot.style.backgroundColor = e.color;
        if (e.round) dot.style.borderRadius = '50%';
        item.appendChild(dot);
        item.appendChild(document.createTextNode(' ' + e.label));
        legendEl.appendChild(item);
    });
}

// Switch between the Game and Settings tabs.
function setupTabs() {
    document.querySelectorAll('.tab').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.tab-panel').forEach(p => p.style.display = 'none');
            document.getElementById('tab-' + btn.dataset.tab).style.display = 'block';
        });
    });
}

// Read the settings form into the `settings` object.
function loadSettings() {
    settings = {
        scorePerWave: clampInt(input('scorePerWave'), 50, 100000, 300),
        greysPerWave: clampInt(input('greysPerWave'), 1, 100, 5),
        maxLevels: clampInt(input('maxLevels'), 1, 50, 10),
        maxGreens: clampInt(input('maxGreens'), 1, 20, 3),
        bonusInterval: clampInt(input('bonusInterval'), 2, 120, 8),
        yellowLevelGap: clampInt(input('yellowLevelGap'), 1, 50, 5),
        maxPowerForYellow: clampInt(input('maxPowerForYellow'), 0, 100, 10),
    };
}

function input(id) {
    return parseInt(document.getElementById(id).value, 10);
}

function clampInt(n, min, max, fallback) {
    if (Number.isNaN(n)) return fallback;
    return Math.max(min, Math.min(max, n));
}

// Persist settings to localStorage so they survive refreshes and server restarts.
function saveSettingsToStorage() {
    const ids = ['scorePerWave', 'greysPerWave', 'maxLevels', 'maxGreens', 'bonusInterval', 'yellowLevelGap', 'maxPowerForYellow', 'musicVolume', 'theme'];
    const data = {};
    ids.forEach(id => { data[id] = document.getElementById(id).value; });
    data.mute = document.getElementById('mute').checked;
    data.colorChange = document.getElementById('colorChange').checked;
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
    } catch (e) {
        // localStorage unavailable (e.g. private browsing) — ignore.
    }
}

// Restore saved settings into the form inputs.
function loadSettingsFromStorage() {
    let data;
    try {
        data = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    } catch (e) {
        data = null;
    }
    if (!data) return;
    Object.keys(data).forEach(id => {
        const el = document.getElementById(id);
        if (!el || data[id] === undefined) return;
        if (el.type === 'checkbox') el.checked = !!data[id];
        else el.value = data[id];
    });
}

function startGame() {
    startGameAt(1, 0);
}

// Respawn from the level you died at, paying a fixed 1/3 of your score.
// The board stays the same; the player stays on their last safe cell.
function continueGame() {
    const cost = Math.floor(score / 3);
    if (cost < 1) return;
    score -= cost;
    running = true;
    startTime = Date.now();
    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(updateGame, 100);
    if (audioCtx && !muted) startMusic();
    hideContinue();
    draw();
}

function startGameAt(startLevel, startScore) {
    loadSettings();
    player = { x: Math.floor(COLS / 2), y: Math.floor(ROWS / 2) };
    obstacles = new Set();
    items = new Set();
    blueBonus = null;
    yellowBonus = null;
    score = startScore;
    level = startLevel;
    power = 0;
    yellowAvailableAt = startLevel + settings.yellowLevelGap;
    nextWaveScore = score + settings.scorePerWave;
    dir = { dx: 0, dy: -1 };
    tick = 0;
    running = true;
    startTime = Date.now();
    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(updateGame, 100);
    if (audioCtx && !muted) startMusic();
    hideContinue();
    draw();
}

function showContinue() {
    const cost = Math.floor(score / 3);
    if (cost >= 1) {
        continueButton.style.display = 'block';
        continueButton.textContent = 'Continue at Level ' + level + ' (cost ' + cost + ')';
    } else {
        continueButton.style.display = 'none';
    }
}

function hideContinue() {
    continueButton.style.display = 'none';
}

function key(x, y) {
    return x + ',' + y;
}

// Called every 100ms. Advances time, spawns items/bonuses/waves, redraws.
function updateGame() {
    if (!running) return;
    tick++;

    if (tick % 8 === 0 && items.size < settings.maxGreens) {
        spawnAtRandom(items);
    }

    const bonusTicks = settings.bonusInterval * 10;
    if (!blueBonus && tick % bonusTicks === 0) {
        spawnBlueBonus();
    }

    if (!yellowBonus && level >= yellowAvailableAt && power <= settings.maxPowerForYellow) {
        spawnYellowBonus();
    }

    if (score >= nextWaveScore && level <= settings.maxLevels) {
        spawnWave();
    }

    draw();
}

// Find a random empty cell that is not on or next to the player.
function randomEmptyCell() {
    for (let i = 0; i < 50; i++) {
        const x = Math.floor(Math.random() * COLS);
        const y = Math.floor(Math.random() * ROWS);
        if (Math.abs(x - player.x) <= 1 && Math.abs(y - player.y) <= 1) continue;
        const k = key(x, y);
        if (obstacles.has(k) || items.has(k)) continue;
        if (blueBonus && blueBonus.x === x && blueBonus.y === y) continue;
        if (yellowBonus && yellowBonus.x === x && yellowBonus.y === y) continue;
        return { x, y };
    }
    return null;
}

function spawnAtRandom(set) {
    const pos = randomEmptyCell();
    if (!pos) return false;
    set.add(key(pos.x, pos.y));
    return true;
}

function spawnWave() {
    const count = settings.greysPerWave;
    let spawned = 0;
    let attempts = 0;
    while (spawned < count && attempts < count * 20) {
        if (spawnAtRandom(obstacles)) spawned++;
        attempts++;
    }
    level++;
    nextWaveScore += settings.scorePerWave;
    activeTheme.sound('levelUp');
}

function spawnBlueBonus() {
    const pos = randomEmptyCell();
    if (!pos) return;
    blueBonus = { x: pos.x, y: pos.y };
}

function spawnYellowBonus() {
    const pos = randomEmptyCell();
    if (!pos) return;
    yellowBonus = { x: pos.x, y: pos.y };
    yellowAvailableAt = level + settings.yellowLevelGap;
}

function handleKeyPress(event) {
    // Restart on Enter or Space after game over.
    if (!running) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            startGame();
        }
        return;
    }

    let dx = 0, dy = 0;
    if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') dx = 1;
    else if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') dx = -1;
    else if (event.key === 'ArrowUp' || event.key === 'w' || event.key === 'W') dy = -1;
    else if (event.key === 'ArrowDown' || event.key === 's' || event.key === 'S') dy = 1;
    else return;

    event.preventDefault();
    movePlayer(dx, dy);
}

function movePlayer(dx, dy) {
    const nx = player.x + dx;
    const ny = player.y + dy;

    if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) return;

    const k = key(nx, ny);

    // Hitting an obstacle: destroy it with a charge, otherwise game over.
    if (obstacles.has(k)) {
        if (power > 0) {
            obstacles.delete(k);
            power--;
            activeTheme.sound('blast');
        } else {
            endGame();
            return;
        }
    }

    player.x = nx;
    player.y = ny;
    dir = { dx, dy };
    activeTheme.sound('move');

    if (items.has(k)) {
        items.delete(k);
        score += 10;
        activeTheme.sound('green');
    }

    if (blueBonus && blueBonus.x === nx && blueBonus.y === ny) {
        score += 50;
        blueBonus = null;
        activeTheme.sound('blue');
    }
    if (yellowBonus && yellowBonus.x === nx && yellowBonus.y === ny) {
        power += 2 + Math.floor(Math.random() * 2);
        yellowBonus = null;
        activeTheme.sound('yellow');
    }

    draw();
}

function endGame() {
    running = false;
    clearInterval(intervalId);
    stopMusic();
    activeTheme.sound('gameOver');
    showContinue();
    draw();
}

function draw() {
    activeTheme.render(ctx, {
        player, dir, obstacles, items, blueBonus, yellowBonus,
        level,
        colorChangeEnabled: document.getElementById('colorChange').checked,
        cols: COLS, rows: ROWS, cell: CELL,
    });

    updateHud();

    if (!running) {
        const secs = Math.floor((Date.now() - startTime) / 1000);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.font = '40px Arial';
        ctx.fillText('Game Over', canvas.width / 2, canvas.height / 2 - 20);
        ctx.font = '20px Arial';
        ctx.fillText('Score: ' + score + '  ·  Survived ' + secs + 's', canvas.width / 2, canvas.height / 2 + 20);
        ctx.fillText('Enter = New Game  ·  Continue = resume (costs score)', canvas.width / 2, canvas.height / 2 + 55);
        ctx.textAlign = 'left';
    }
}

function updateHud() {
    scoreEl.textContent = 'Score: ' + score;
    levelEl.textContent = 'Level: ' + Math.min(level, settings.maxLevels);
    powerEl.textContent = 'Destroy: ' + power;
}

// ---------------------------------------------------------------------------
// Audio (Web Audio API — synthesized; the active theme provides the sounds)
// ---------------------------------------------------------------------------

let muted = false;
let musicVol = 50; // background music volume (0-100)
let audioCtx;
let musicInterval = null;
let musicIndex = 0;

function getAudio() {
    if (!audioCtx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return null;
        audioCtx = new Ctx();
        startMusic();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

// Play a single tone. `endFreq` (optional) sweeps the pitch over the duration.
function playTone({ freq, endFreq, duration, type = 'sine', gain = 0.2, when = 0 }) {
    if (muted) return;
    const ac = getAudio();
    if (!ac) return;
    const t0 = ac.currentTime + when;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (endFreq && endFreq !== freq) {
        osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + duration);
    }
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
}

// Play a short burst of noise (with a decay envelope).
function playNoise({ duration = 0.2, gain = 0.3, when = 0 }) {
    if (muted) return;
    const ac = getAudio();
    if (!ac) return;
    const t0 = ac.currentTime + when;
    const bufferSize = Math.floor(ac.sampleRate * duration);
    const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const src = ac.createBufferSource();
    src.buffer = buffer;
    const g = ac.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(g).connect(ac.destination);
    src.start(t0);
}

function startMusic() {
    if (musicInterval) return;
    musicInterval = setInterval(() => {
        if (muted) return;
        const notes = activeTheme.music.notes;
        const freq = notes[musicIndex % notes.length];
        musicIndex++;
        playMusicNote(freq);
    }, activeTheme.music.stepMs);
}

function stopMusic() {
    if (musicInterval) {
        clearInterval(musicInterval);
        musicInterval = null;
    }
}

function playMusicNote(freq) {
    const peak = activeTheme.music.gain * (musicVol / 100);
    if (peak <= 0) return;
    const ac = getAudio();
    if (!ac) return;
    const t0 = ac.currentTime;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = activeTheme.music.type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);
    osc.connect(g).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + 0.3);
}

window.onload = init;
