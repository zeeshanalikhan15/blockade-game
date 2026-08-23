// "Space Saver" theme — spaceship, astronauts, asteroids, galactic starfield.
window.THEMES = window.THEMES || {};

window.THEMES.space = {
    name: 'Space Saver',

    legend: [
        { color: '#dfe9ff', round: false, label: 'You — ship' },
        { color: '#6b7076', round: false, label: 'Asteroid — avoid' },
        { color: '#28a745', round: false, label: 'Astronaut +10' },
        { color: '#00bfff', round: true,  label: 'Energy +50' },
        { color: '#ffc107', round: true,  label: 'Armory — destroy 2–3 asteroids' },
    ],

    nebulaColors: ['#1a1040', '#102a40', '#10402a', '#401030', '#2a1040', '#102040', '#400a1a', '#0a2a40'],

    render(ctx, S) {
        const { cols, rows, cell } = S;
        const w = cols * cell, h = rows * cell;

        // Deep space.
        ctx.fillStyle = '#080818';
        ctx.fillRect(0, 0, w, h);

        // Nebula glow (tint cycles per level when enabled).
        const nebula = S.colorChangeEnabled
            ? this.nebulaColors[(S.level - 1) % this.nebulaColors.length]
            : '#1a1040';
        this._nebula(ctx, nebula, w * 0.3, h * 0.35, 320);
        this._nebula(ctx, nebula, w * 0.72, h * 0.68, 300);

        // Stars (precomputed once).
        if (!this.stars) this._initStars(w, h);
        this.stars.forEach(s => {
            ctx.globalAlpha = s.alpha;
            ctx.fillStyle = s.color;
            ctx.fillRect(s.x, s.y, s.size, s.size);
        });
        ctx.globalAlpha = 1;

        // Faint grid.
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.lineWidth = 1;
        for (let x = 0; x <= cols; x++) {
            ctx.beginPath(); ctx.moveTo(x * cell, 0); ctx.lineTo(x * cell, h); ctx.stroke();
        }
        for (let y = 0; y <= rows; y++) {
            ctx.beginPath(); ctx.moveTo(0, y * cell); ctx.lineTo(w, y * cell); ctx.stroke();
        }

        // Entities.
        S.obstacles.forEach(k => { const [x, y] = k.split(',').map(Number); this._asteroid(ctx, x, y, cell); });
        S.items.forEach(k => { const [x, y] = k.split(',').map(Number); this._astronaut(ctx, x, y, cell); });
        if (S.blueBonus) this._energyOrb(ctx, S.blueBonus.x, S.blueBonus.y, cell);
        if (S.yellowBonus) this._armory(ctx, S.yellowBonus.x, S.yellowBonus.y, cell);
        this._ship(ctx, S.player.x, S.player.y, S.dir, cell);
    },

    _initStars(w, h) {
        this.stars = [];
        for (let i = 0; i < 130; i++) {
            this.stars.push({
                x: Math.random() * w,
                y: Math.random() * h,
                size: Math.random() < 0.85 ? 1 : 2,
                alpha: 0.3 + Math.random() * 0.7,
                color: Math.random() < 0.8 ? '#ffffff' : '#aaccff',
            });
        }
    },

    _nebula(ctx, color, x, y, r) {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, color);
        g.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = g;
        ctx.globalAlpha = 0.45;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    },

    _ship(ctx, gx, gy, dir, cell) {
        const cx = gx * cell + cell / 2;
        const cy = gy * cell + cell / 2;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(Math.atan2(dir.dy, dir.dx) + Math.PI / 2);

        ctx.fillStyle = '#ff8c3a';
        ctx.beginPath(); ctx.moveTo(-4, 11); ctx.lineTo(0, 18); ctx.lineTo(4, 11); ctx.closePath(); ctx.fill();

        ctx.fillStyle = '#dfe9ff';
        ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(10, 9); ctx.lineTo(0, 4); ctx.lineTo(-10, 9); ctx.closePath(); ctx.fill();

        ctx.fillStyle = '#4da6ff';
        ctx.beginPath(); ctx.arc(0, -4, 4, 0, Math.PI * 2); ctx.fill();

        ctx.restore();
    },

    _astronaut(ctx, gx, gy, cell) {
        const cx = gx * cell + cell / 2, cy = gy * cell + cell / 2;
        ctx.fillStyle = 'rgba(40, 167, 69, 0.16)';
        ctx.beginPath(); ctx.arc(cx, cy, 15, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e8f2ec'; this._roundRect(ctx, cx - 6, cy + 1, 12, 9, 4);
        ctx.fillStyle = '#f7faf8'; ctx.beginPath(); ctx.arc(cx, cy - 5, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#28a745'; ctx.beginPath(); ctx.arc(cx, cy - 5, 3.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#34c759'; this._roundRect(ctx, cx - 2, cy + 4, 4, 5, 2);
    },

    _asteroid(ctx, gx, gy, cell) {
        const cx = gx * cell + cell / 2, cy = gy * cell + cell / 2;
        ctx.fillStyle = '#6b7076';
        ctx.beginPath();
        ctx.moveTo(cx - 13, cy + 2);
        ctx.lineTo(cx - 8, cy - 12);
        ctx.lineTo(cx + 2, cy - 10);
        ctx.lineTo(cx + 13, cy - 2);
        ctx.lineTo(cx + 9, cy + 10);
        ctx.lineTo(cx - 2, cy + 13);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#4b4f55';
        ctx.beginPath(); ctx.arc(cx - 4, cy - 1, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + 5, cy + 4, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#8b9096';
        ctx.beginPath(); ctx.arc(cx - 6, cy - 6, 2, 0, Math.PI * 2); ctx.fill();
    },

    _energyOrb(ctx, gx, gy, cell) {
        const cx = gx * cell + cell / 2, cy = gy * cell + cell / 2;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 16);
        g.addColorStop(0, 'rgba(120, 220, 255, 0.9)');
        g.addColorStop(0.45, 'rgba(0, 150, 255, 0.45)');
        g.addColorStop(1, 'rgba(0, 100, 255, 0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(cx, cy, 16, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#eaf6ff';
        ctx.beginPath(); ctx.arc(cx, cy, 4.5, 0, Math.PI * 2); ctx.fill();
    },

    _armory(ctx, gx, gy, cell) {
        const cx = gx * cell + cell / 2, cy = gy * cell + cell / 2;
        ctx.fillStyle = 'rgba(255, 193, 7, 0.15)';
        ctx.beginPath(); ctx.arc(cx, cy, 15, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffc107';
        ctx.beginPath();
        ctx.moveTo(cx, cy - 13);
        ctx.lineTo(cx + 11, cy - 8);
        ctx.lineTo(cx + 11, cy + 1);
        ctx.quadraticCurveTo(cx + 11, cy + 9, cx, cy + 14);
        ctx.quadraticCurveTo(cx - 11, cy + 9, cx - 11, cy + 1);
        ctx.lineTo(cx - 11, cy - 8);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#7a5600';
        ctx.fillRect(cx - 1.5, cy - 7, 3, 11);
        ctx.fillRect(cx - 5, cy - 3, 10, 3);
    },

    _roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
        ctx.fill();
    },

    sound(name) {
        switch (name) {
            case 'green':
                playTone({ freq: 520, endFreq: 1040, duration: 0.18, type: 'sine', gain: 0.22 });
                playTone({ freq: 1040, duration: 0.14, type: 'sine', gain: 0.16, when: 0.14 });
                break;
            case 'blue':
                playTone({ freq: 400, endFreq: 1600, duration: 0.2, type: 'sine', gain: 0.2 });
                playTone({ freq: 800, endFreq: 2000, duration: 0.16, type: 'triangle', gain: 0.12, when: 0.08 });
                break;
            case 'yellow':
                playTone({ freq: 240, endFreq: 480, duration: 0.15, type: 'triangle', gain: 0.2 });
                playTone({ freq: 960, duration: 0.18, type: 'sine', gain: 0.16, when: 0.12 });
                break;
            case 'blast':
                playNoise({ duration: 0.4, gain: 0.4 });
                playTone({ freq: 120, endFreq: 30, duration: 0.35, type: 'sawtooth', gain: 0.28 });
                break;
            case 'levelUp':
                playTone({ freq: 50, endFreq: 140, duration: 0.6, type: 'sine', gain: 0.22 });
                playNoise({ duration: 0.4, gain: 0.12, when: 0.08 });
                break;
            case 'move':
                playTone({ freq: 180, endFreq: 70, duration: 0.06, type: 'sine', gain: 0.1 });
                break;
            case 'gameOver':
                playTone({ freq: 300, endFreq: 60, duration: 0.9, type: 'sine', gain: 0.24 });
                playTone({ freq: 150, endFreq: 40, duration: 0.9, type: 'triangle', gain: 0.18, when: 0.05 });
                playNoise({ duration: 0.5, gain: 0.1, when: 0.1 });
                break;
        }
    },

    music: {
        notes: [196, 233.08, 293.66, 233.08, 174.61, 220, 261.63, 220],
        stepMs: 340,
        type: 'sine',
        gain: 0.2,
    },
};
