// Responsive layout, follow-camera viewport, on-screen pilot controls, and the
// slide-in menu drawer. Loaded before app.js; the engine calls into this file.
//
// The board is always drawn in "art units" (COLS x ROWS cells of CELL px, i.e.
// 800x600). This file decides how those units map to the screen:
//   * wide screens  -> scale 1, the whole board is visible (unchanged desktop)
//   * tablets       -> the whole board, scaled down to fit
//   * phones        -> cells stay readable and the view becomes a window onto
//                      the board that follows the player up to the boundaries

const VIEW = {
    scale: 1,     // art units -> CSS pixels
    dpr: 1,       // device pixel ratio the backing store is sized for
    w: 800,       // visible width in CSS pixels
    h: 600,       // visible height in CSS pixels
    camX: 0,      // camera offset in CSS pixels (top-left of the window)
    camY: 0,
    tCamX: 0,     // where the camera is heading
    tCamY: 0,
    camera: false // true when the board is bigger than the window
};

// Touch UI (top bar + drawer + d-pad) below this width, or on any touch device.
const TOUCH_UI_MAX_WIDTH = 1000;
// A touch screen wider than this is treated as a laptop, not a tablet.
const TOUCH_FALLBACK_MAX_WIDTH = 1400;
// Camera mode is considered below these — a phone, in either orientation.
const COMPACT_MAX_WIDTH = 720;
const COMPACT_MAX_HEIGHT = 560;
// Cell size aimed for in camera mode, so the board stays readable and tappable.
const CAMERA_CELL_PX = 38;
// The canvas border from style.css, on each side.
const CANVAS_BORDER = 2;
// Hold-to-repeat timings for the d-pad.
const HOLD_DELAY_MS = 260;
const HOLD_REPEAT_MS = 110;
// A swipe has to cover this many pixels to count as a move.
const SWIPE_MIN_PX = 24;

let camAnimId = null;
let holdTimer = null;
let holdRepeat = null;

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

// Tablets and phones report a coarse pointer. A tablet asking for the desktop
// site can report a fine one, so fall back to "has touch and isn't a big
// screen" — which leaves touchscreen laptops on the desktop layout.
function isTouchDevice() {
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return true;
    return navigator.maxTouchPoints > 0 && window.innerWidth < TOUCH_FALLBACK_MAX_WIDTH;
}

// Decide which UI to show and mark it on <body> so CSS can follow.
function detectUiMode() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const touchUi = isTouchDevice() || vw < TOUCH_UI_MAX_WIDTH;
    const compact = touchUi && (vw < COMPACT_MAX_WIDTH || vh < COMPACT_MAX_HEIGHT);
    const landscape = compact && vw > vh;

    document.body.classList.toggle('touch-ui', touchUi);
    document.body.classList.toggle('compact', compact);
    document.body.classList.toggle('landscape', landscape);

    return { touchUi, compact };
}

// Run straight away (this script sits at the end of <body>) so the first paint
// already uses the right layout instead of flashing the desktop one.
detectUiMode();

// Size the canvas to the space available and pick the scale / camera mode.
function applyLayout() {
    const mode = detectUiMode();
    const canvas = document.getElementById('gameCanvas');
    const stage = document.getElementById('stage');
    const worldW = COLS * CELL;
    const worldH = ROWS * CELL;

    moveLegend(mode.compact);

    let scale = 1;
    let viewW = worldW;
    let viewH = worldH;

    if (mode.touchUi) {
        const availW = Math.max(160, stage.clientWidth - 2 * CANVAS_BORDER);
        const availH = Math.max(160, stage.clientHeight - 2 * CANVAS_BORDER);
        // Scale that would show the whole board (never magnified past 1:1).
        const fit = Math.min(availW / worldW, availH / worldH, 1);
        // On a phone, keep cells readable even if that means not showing it all.
        scale = mode.compact ? Math.min(1, Math.max(fit, CAMERA_CELL_PX / CELL)) : fit;
        viewW = Math.min(availW, Math.round(worldW * scale));
        viewH = Math.min(availH, Math.round(worldH * scale));
    }

    VIEW.scale = scale;
    VIEW.w = viewW;
    VIEW.h = viewH;
    VIEW.camera = worldW * scale > viewW + 1 || worldH * scale > viewH + 1;

    // Cap the backing store at 2x — beyond that the extra pixels cost more than
    // they show on a phone.
    VIEW.dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = viewW + 'px';
    canvas.style.height = viewH + 'px';
    canvas.width = Math.round(viewW * VIEW.dpr);
    canvas.height = Math.round(viewH * VIEW.dpr);

    updateCamera(true);
    if (typeof player !== 'undefined' && player) draw();
}

// The legend eats scarce vertical space on a phone, so it lives in the drawer.
function moveLegend(intoDrawer) {
    const legend = document.getElementById('legend');
    const target = document.getElementById(intoDrawer ? 'legendSlot' : 'left');
    if (legend && target && legend.parentElement !== target) target.appendChild(legend);
}

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------

function clampNum(n, min, max) {
    return Math.max(min, Math.min(max, n));
}

// Point the camera at the player, clamped so it never scrolls past the board.
function updateCamera(instant) {
    const worldW = COLS * CELL * VIEW.scale;
    const worldH = ROWS * CELL * VIEW.scale;
    const maxX = Math.max(0, worldW - VIEW.w);
    const maxY = Math.max(0, worldH - VIEW.h);

    let tx = 0;
    let ty = 0;
    if (typeof player !== 'undefined' && player) {
        tx = clampNum((player.x + 0.5) * CELL * VIEW.scale - VIEW.w / 2, 0, maxX);
        ty = clampNum((player.y + 0.5) * CELL * VIEW.scale - VIEW.h / 2, 0, maxY);
    }
    VIEW.tCamX = tx;
    VIEW.tCamY = ty;

    if (instant || !VIEW.camera) {
        cancelCamAnim();
        VIEW.camX = tx;
        VIEW.camY = ty;
    } else if (camAnimId === null) {
        camAnimId = requestAnimationFrame(stepCamera);
    }
}

function cancelCamAnim() {
    if (camAnimId !== null) {
        cancelAnimationFrame(camAnimId);
        camAnimId = null;
    }
}

// Ease the camera towards its target so the board slides instead of jumping.
function stepCamera() {
    camAnimId = null;
    const dx = VIEW.tCamX - VIEW.camX;
    const dy = VIEW.tCamY - VIEW.camY;
    if (Math.abs(dx) < 0.6 && Math.abs(dy) < 0.6) {
        VIEW.camX = VIEW.tCamX;
        VIEW.camY = VIEW.tCamY;
        draw();
        return;
    }
    VIEW.camX += dx * 0.3;
    VIEW.camY += dy * 0.3;
    draw();
    camAnimId = requestAnimationFrame(stepCamera);
}

// Fade the edges that still have board behind them, so it reads as "more this
// way" rather than as the boundary. Drawn in screen space, after the board.
function drawEdgeHints(ctx) {
    if (!VIEW.camera) return;
    const worldW = COLS * CELL * VIEW.scale;
    const worldH = ROWS * CELL * VIEW.scale;
    const f = 24;

    function fade(x0, y0, x1, y1, x, y, w, h) {
        const g = ctx.createLinearGradient(x0, y0, x1, y1);
        g.addColorStop(0, 'rgba(0, 0, 0, 0.45)');
        g.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(x, y, w, h);
    }

    if (VIEW.camX > 1) fade(0, 0, f, 0, 0, 0, f, VIEW.h);
    if (VIEW.camX < worldW - VIEW.w - 1) fade(VIEW.w, 0, VIEW.w - f, 0, VIEW.w - f, 0, f, VIEW.h);
    if (VIEW.camY > 1) fade(0, 0, 0, f, 0, 0, VIEW.w, f);
    if (VIEW.camY < worldH - VIEW.h - 1) fade(0, VIEW.h, 0, VIEW.h - f, 0, VIEW.h - f, VIEW.w, f);
}

// Point the way to food only when none of it is on screen (phone view). Green
// pick-ups, the blue bonus, and the yellow bonus all count: if any of them is
// visible the hint hides, and only when *nothing* is in view does a chevron
// appear, facing the nearest one.
function drawPickupHint(ctx) {
    if (!VIEW.camera || !running || paused) return;

    const targets = [];
    if (typeof items !== 'undefined') {
        items.forEach(function (k) {
            const xy = k.split(',').map(Number);
            targets.push({ x: xy[0], y: xy[1] });
        });
    }
    if (blueBonus) targets.push({ x: blueBonus.x, y: blueBonus.y });
    if (yellowBonus) targets.push({ x: yellowBonus.x, y: yellowBonus.y });
    if (targets.length === 0) return;

    const s = VIEW.scale;
    const cell = CELL * s;
    const px = (player.x + 0.5) * cell - VIEW.camX;
    const py = (player.y + 0.5) * cell - VIEW.camY;

    // Find the nearest target and remember whether any target is in view.
    let nearest = null;
    let nearestD = Infinity;
    let anyVisible = false;
    targets.forEach(function (t) {
        const tx = (t.x + 0.5) * cell - VIEW.camX;
        const ty = (t.y + 0.5) * cell - VIEW.camY;
        if (tx >= 0 && tx <= VIEW.w && ty >= 0 && ty <= VIEW.h) anyVisible = true;
        const dx = tx - px;
        const dy = ty - py;
        const d = dx * dx + dy * dy;
        if (d < nearestD) { nearestD = d; nearest = { tx, ty }; }
    });

    // Only show the hint while nothing to eat is on screen.
    if (anyVisible || !nearest) return;

    const ang = Math.atan2(nearest.ty - py, nearest.tx - px);
    const off = CELL * s * 0.85;
    const cx = px + Math.cos(ang) * off;
    const cy = py + Math.sin(ang) * off;
    const r = 9;
    const pulse = 0.7 + 0.3 * Math.sin(tick / 2.2);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    ctx.globalAlpha = pulse;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Dark halo first so the chevron reads on both light and dark boards.
    ctx.strokeStyle = 'rgba(10, 10, 20, 0.7)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(r, 0); ctx.lineTo(0, r);
    ctx.moveTo(r, 0); ctx.lineTo(0, -r);
    ctx.stroke();

    ctx.strokeStyle = '#3df07c';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.restore();
}

// ---------------------------------------------------------------------------
// Touch input — d-pad and swipes
// ---------------------------------------------------------------------------

function stepPlayer(dx, dy) {
    if (!running || paused) return;
    movePlayer(dx, dy);
}

// Move once, then repeat while the button stays held (like key auto-repeat).
function pressDir(dx, dy) {
    releaseDir();
    stepPlayer(dx, dy);
    holdTimer = setTimeout(function () {
        holdRepeat = setInterval(function () { stepPlayer(dx, dy); }, HOLD_REPEAT_MS);
    }, HOLD_DELAY_MS);
}

function releaseDir() {
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
    if (holdRepeat) { clearInterval(holdRepeat); holdRepeat = null; }
}

// Virtual joystick. Dragging the knob away from centre moves the player in the
// dominant cardinal direction; holding it repeats the move like key auto-repeat.
let stickPointer = null;   // active pointerId while dragging, else null
let stickDir = null;       // 'up' | 'down' | 'left' | 'right' while engaged
let stickKnob = null;
let stickCenter = { x: 0, y: 0 };
let stickRadius = 42;
const STICK_DEAD_ZONE = 14;

function setupJoystick() {
    const joy = document.getElementById('joystick');
    if (!joy) return;
    stickKnob = document.getElementById('stickKnob');

    function deltaFor(d) {
        if (d === 'up') return [0, -1];
        if (d === 'down') return [0, 1];
        if (d === 'left') return [-1, 0];
        return [1, 0]; // right
    }

    function onDown(e) {
        if (stickPointer !== null) return;
        const rect = joy.getBoundingClientRect();
        stickCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        stickRadius = Math.min(rect.width, rect.height) / 2 - 8;
        stickPointer = e.pointerId;
        if (joy.setPointerCapture) {
            try { joy.setPointerCapture(e.pointerId); } catch (err) { /* synthetic/idle pointer */ }
        }
        getAudio();
        e.preventDefault();
    }

    function onMove(e) {
        if (stickPointer !== e.pointerId) return;
        e.preventDefault();
        let dx = e.clientX - stickCenter.x;
        let dy = e.clientY - stickCenter.y;
        const len = Math.hypot(dx, dy);
        if (len > stickRadius && len > 0) {
            dx = dx / len * stickRadius;
            dy = dy / len * stickRadius;
        }
        if (stickKnob) stickKnob.style.transform = 'translate(' + dx + 'px, ' + dy + 'px)';

        if (len < STICK_DEAD_ZONE) {
            if (stickDir) { stickDir = null; releaseDir(); }
            return;
        }
        const d = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
        if (d !== stickDir) {
            stickDir = d;
            const delta = deltaFor(d);
            pressDir(delta[0], delta[1]);
        }
    }

    function onUp(e) {
        if (stickPointer !== e.pointerId) return;
        stickPointer = null;
        resetJoystick();
    }

    joy.addEventListener('pointerdown', onDown);
    joy.addEventListener('pointermove', onMove);
    joy.addEventListener('pointerup', onUp);
    joy.addEventListener('pointercancel', onUp);
    joy.addEventListener('contextmenu', function (e) { e.preventDefault(); });
}

// Snap the knob back to centre and stop any held movement.
function resetJoystick() {
    if (stickKnob) stickKnob.style.transform = 'translate(0px, 0px)';
    stickDir = null;
    releaseDir();
}

// Swiping across the board moves one cell in the swiped direction; a plain tap
// after a game over starts a new one.
function setupSwipe() {
    const canvas = document.getElementById('gameCanvas');
    let startX = 0;
    let startY = 0;
    let tracking = false;

    canvas.addEventListener('touchstart', function (e) {
        if (e.touches.length !== 1) { tracking = false; return; }
        tracking = true;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        getAudio();
    }, { passive: true });

    canvas.addEventListener('touchend', function (e) {
        if (!tracking) return;
        tracking = false;
        const touch = e.changedTouches[0];
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;
        const adx = Math.abs(dx);
        const ady = Math.abs(dy);

        if (!running) {
            if (adx < 14 && ady < 14) {
                e.preventDefault();
                startGame();
            }
            return;
        }
        if (paused || Math.max(adx, ady) < SWIPE_MIN_PX) return;
        e.preventDefault();
        if (adx > ady) stepPlayer(dx > 0 ? 1 : -1, 0);
        else stepPlayer(0, dy > 0 ? 1 : -1);
    }, { passive: false });
}

// ---------------------------------------------------------------------------
// Drawer (score + settings on small screens)
// ---------------------------------------------------------------------------

function isDrawerOpen() {
    return document.body.classList.contains('drawer-open');
}

function openDrawer() {
    document.body.classList.add('drawer-open');
    document.getElementById('menuButton').setAttribute('aria-expanded', 'true');
    resetJoystick();
    pauseGame();
}

function closeDrawer() {
    document.body.classList.remove('drawer-open');
    document.getElementById('menuButton').setAttribute('aria-expanded', 'false');
    resumeGame();
}

function toggleDrawer() {
    if (isDrawerOpen()) closeDrawer();
    else openDrawer();
}

function setupDrawer() {
    document.getElementById('menuButton').addEventListener('click', toggleDrawer);
    document.getElementById('drawerClose').addEventListener('click', closeDrawer);
    document.getElementById('scrim').addEventListener('click', closeDrawer);
    // Starting or continuing from inside the drawer should get out of the way.
    document.getElementById('startButton').addEventListener('click', closeDrawer);
    document.getElementById('continueButton').addEventListener('click', closeDrawer);
}

// ---------------------------------------------------------------------------

function setupResponsive() {
    setupDrawer();
    setupJoystick();
    setupSwipe();

    let resizeTimer = null;
    function onResize() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(applyLayout, 80);
    }
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', onResize);

    applyLayout();
}
