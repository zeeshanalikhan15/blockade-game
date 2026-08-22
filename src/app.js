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

const COLORS = {
    player: '#007bff',
    obstacle: '#333333',
    item: '#28a745',
    bonusBlue: '#00bfff',
    bonusYellow: '#ffc107',
};

// Pastel grid tints, cycled per level. Kept light so the pieces never blend in.
const GRID_COLORS = ['#e6e6e6', '#d6e4f0', '#f0dcd6', '#dcf0dc', '#f0ead6', '#e4dcf0', '#d6f0ec', '#f0dcec'];

const SETTINGS_KEY = 'blockadeGame.settings'; // localStorage key for persisted settings

let settings;      // loaded from the settings form at the start of each game
let player;        // { x, y } in grid coordinates
let obstacles;     // Set of "x,y" keys
let items;         // Set of "x,y" keys (green collectibles)
let blueBonus;     // { x, y } or null — +50 points
let yellowBonus;   // { x, y } or null — 2-3 destroy charges
let score;
let level;
let power;         // remaining "destroy a grey" charges
let yellowAvailableAt; // the level at which the yellow bonus becomes available again
let nextWaveScore;
let tick;
let running;
let intervalId;
let startTime;

function init() {
    canvas.width = COLS * CELL;
    canvas.height = ROWS * CELL;
    loadSettingsFromStorage();
    muted = document.getElementById('mute').checked;
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
    startGame();
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
    const ids = ['scorePerWave', 'greysPerWave', 'maxLevels', 'maxGreens', 'bonusInterval', 'yellowLevelGap', 'maxPowerForYellow'];
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
// The board stays the same; the player stays on their last safe cell
// (one step before the collision, since position isn't advanced on death).
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

    // Spawn a green collectible every ~0.8s, up to maxGreens on screen.
    if (tick % 8 === 0 && items.size < settings.maxGreens) {
        spawnAtRandom(items);
    }

    // Blue bonus: spawns on a fixed interval, at most one on screen.
    const bonusTicks = settings.bonusInterval * 10;
    if (!blueBonus && tick % bonusTicks === 0) {
        spawnBlueBonus();
    }

    // Yellow bonus: independent of blue, spawns once per yellowLevelGap levels,
    // and only while the player is under the max destroy-charge cap.
    if (!yellowBonus && level >= yellowAvailableAt && power <= settings.maxPowerForYellow) {
        spawnYellowBonus();
    }

    // Each time the score crosses a threshold, spawn a new wave of obstacles.
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
        // Keep a clear 3x3 area around the player so nothing pops up in its path.
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

// Spawn a wave of obstacles (grey blocks).
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
    soundLevelUp();
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

    // Walls: block can't leave the grid.
    if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) return;

    const k = key(nx, ny);

    // Hitting a grey: destroy it with a charge, otherwise game over.
    if (obstacles.has(k)) {
        if (power > 0) {
            obstacles.delete(k);
            power--;
            soundBlast();
        } else {
            endGame();
            return;
        }
    }

    player.x = nx;
    player.y = ny;
    soundMove();

    // Collect a green point item.
    if (items.has(k)) {
        items.delete(k);
        score += 10;
        soundGreen();
    }

    // Collect a bonus (blue and yellow are independent).
    if (blueBonus && blueBonus.x === nx && blueBonus.y === ny) {
        score += 50;
        blueBonus = null;
        soundBlue();
    }
    if (yellowBonus && yellowBonus.x === nx && yellowBonus.y === ny) {
        power += 2 + Math.floor(Math.random() * 2); // 2 or 3 charges
        yellowBonus = null;
        soundYellow();
    }

    draw();
}

function endGame() {
    running = false;
    clearInterval(intervalId);
    stopMusic();
    soundGameOver();
    showContinue();
    draw();
}

function cellBackgroundColor() {
    if (!document.getElementById('colorChange').checked) return '#ffffff';
    return GRID_COLORS[(level - 1) % GRID_COLORS.length];
}

// Return `hex` darkened by multiplying each channel by `factor` (0..1).
function darkenColor(hex, factor) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return '#' + [r, g, b]
        .map(v => Math.round(v * factor).toString(16).padStart(2, '0'))
        .join('');
}

function draw() {
    ctx.fillStyle = cellBackgroundColor();
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawGrid();

    // Obstacles.
    obstacles.forEach(k => {
        const [x, y] = k.split(',').map(Number);
        ctx.fillStyle = COLORS.obstacle;
        ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
    });

    // Green collectibles (small squares).
    items.forEach(k => {
        const [x, y] = k.split(',').map(Number);
        ctx.fillStyle = COLORS.item;
        ctx.fillRect(x * CELL + 8, y * CELL + 8, CELL - 16, CELL - 16);
    });

    // Blue bonus (circle).
    if (blueBonus) {
        ctx.fillStyle = COLORS.bonusBlue;
        ctx.beginPath();
        ctx.arc(blueBonus.x * CELL + CELL / 2, blueBonus.y * CELL + CELL / 2, CELL / 2 - 6, 0, Math.PI * 2);
        ctx.fill();
    }

    // Yellow bonus (circle).
    if (yellowBonus) {
        ctx.fillStyle = COLORS.bonusYellow;
        ctx.beginPath();
        ctx.arc(yellowBonus.x * CELL + CELL / 2, yellowBonus.y * CELL + CELL / 2, CELL / 2 - 6, 0, Math.PI * 2);
        ctx.fill();
    }

    // Player.
    ctx.fillStyle = COLORS.player;
    ctx.fillRect(player.x * CELL, player.y * CELL, CELL, CELL);

    updateHud();

    // Game over overlay.
    if (!running) {
        const secs = Math.floor((Date.now() - startTime) / 1000);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
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

function drawGrid() {
    ctx.strokeStyle = darkenColor(cellBackgroundColor(), 0.85);
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
        ctx.beginPath();
        ctx.moveTo(x * CELL, 0);
        ctx.lineTo(x * CELL, canvas.height);
        ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * CELL);
        ctx.lineTo(canvas.width, y * CELL);
        ctx.stroke();
    }
}

function updateHud() {
    scoreEl.textContent = 'Score: ' + score;
    levelEl.textContent = 'Level: ' + Math.min(level, settings.maxLevels);
    powerEl.textContent = 'Destroy: ' + power;
}

// ---------------------------------------------------------------------------
// Sound (Web Audio API — synthesized, no external files)
// ---------------------------------------------------------------------------

let muted = false;
let audioCtx;
let musicInterval = null;
let musicIndex = 0;

const MUSIC_NOTES = [261.63, 329.63, 392.00, 329.63, 293.66, 349.23, 440.00, 349.23]; // gentle C–Am loop
const MUSIC_STEP_MS = 320;

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

// Background music: a soft looping arpeggio.
function startMusic() {
    if (musicInterval) return;
    musicInterval = setInterval(() => {
        if (muted) return;
        const freq = MUSIC_NOTES[musicIndex % MUSIC_NOTES.length];
        musicIndex++;
        playMusicNote(freq);
    }, MUSIC_STEP_MS);
}

function stopMusic() {
    if (musicInterval) {
        clearInterval(musicInterval);
        musicInterval = null;
    }
}

function playMusicNote(freq) {
    const ac = getAudio();
    if (!ac) return;
    const t0 = ac.currentTime;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.04, t0 + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.26);
    osc.connect(g).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + 0.28);
}

// Green +10: a short "coin" blip.
function soundGreen() {
    playTone({ freq: 880, duration: 0.08, type: 'square', gain: 0.12 });
    playTone({ freq: 1318.5, duration: 0.12, type: 'square', gain: 0.12, when: 0.07 });
}

// Blue +50: a rising three-note chime.
function soundBlue() {
    playTone({ freq: 523.25, duration: 0.09, type: 'triangle', gain: 0.15 });
    playTone({ freq: 659.25, duration: 0.09, type: 'triangle', gain: 0.15, when: 0.08 });
    playTone({ freq: 783.99, duration: 0.14, type: 'triangle', gain: 0.15, when: 0.16 });
}

// Yellow (destroy power): a rising "charge" sweep.
function soundYellow() {
    playTone({ freq: 300, endFreq: 1200, duration: 0.35, type: 'sawtooth', gain: 0.15 });
}

// Destroying a grey: noise blast + a low thump.
function soundBlast() {
    playNoise({ duration: 0.25, gain: 0.3 });
    playTone({ freq: 120, endFreq: 50, duration: 0.2, type: 'sawtooth', gain: 0.22 });
}

// Level up: a low rising "walls growing" rumble.
function soundLevelUp() {
    playTone({ freq: 80, endFreq: 160, duration: 0.4, type: 'sawtooth', gain: 0.18 });
    playNoise({ duration: 0.3, gain: 0.1, when: 0.05 });
}

// Movement: a very low, quiet tick.
function soundMove() {
    playTone({ freq: 110, duration: 0.04, type: 'sine', gain: 0.07 });
}

// Classic descending "game over" tune.
function soundGameOver() {
    playTone({ freq: 392, duration: 0.18, type: 'square', gain: 0.12 });
    playTone({ freq: 329.63, duration: 0.18, type: 'square', gain: 0.12, when: 0.18 });
    playTone({ freq: 261.63, duration: 0.18, type: 'square', gain: 0.12, when: 0.36 });
    playTone({ freq: 196, duration: 0.4, type: 'square', gain: 0.12, when: 0.54 });
}

window.onload = init;
