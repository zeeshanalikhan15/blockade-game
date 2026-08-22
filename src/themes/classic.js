// Classic "Blockade Game" theme — light background, colored blocks, arcade sounds.
window.THEMES = window.THEMES || {};

window.THEMES.classic = {
    name: 'Blockade Game',

    legend: [
        { color: '#007bff', round: false, label: 'You' },
        { color: '#333333', round: false, label: 'Obstacle — avoid' },
        { color: '#28a745', round: false, label: 'Pickup +10' },
        { color: '#00bfff', round: true,  label: 'Bonus +50' },
        { color: '#ffc107', round: true,  label: 'Power-up — destroy 2–3 obstacles' },
    ],

    render(ctx, S) {
        const { cols, rows, cell } = S;
        const pastels = ['#e6e6e6', '#d6e4f0', '#f0dcd6', '#dcf0dc', '#f0ead6', '#e4dcf0', '#d6f0ec', '#f0dcec'];
        const bg = S.colorChangeEnabled ? pastels[(S.level - 1) % pastels.length] : '#ffffff';

        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, cols * cell, rows * cell);

        // Grid lines (a darkened tint of the background).
        ctx.strokeStyle = this.darken(bg, 0.85);
        ctx.lineWidth = 1;
        for (let x = 0; x <= cols; x++) {
            ctx.beginPath(); ctx.moveTo(x * cell, 0); ctx.lineTo(x * cell, rows * cell); ctx.stroke();
        }
        for (let y = 0; y <= rows; y++) {
            ctx.beginPath(); ctx.moveTo(0, y * cell); ctx.lineTo(cols * cell, y * cell); ctx.stroke();
        }

        // Obstacles.
        ctx.fillStyle = '#333333';
        S.obstacles.forEach(k => {
            const [x, y] = k.split(',').map(Number);
            ctx.fillRect(x * cell, y * cell, cell, cell);
        });

        // Pickups.
        ctx.fillStyle = '#28a745';
        S.items.forEach(k => {
            const [x, y] = k.split(',').map(Number);
            ctx.fillRect(x * cell + 8, y * cell + 8, cell - 16, cell - 16);
        });

        // Bonus (blue).
        if (S.blueBonus) {
            ctx.fillStyle = '#00bfff';
            ctx.beginPath();
            ctx.arc(S.blueBonus.x * cell + cell / 2, S.blueBonus.y * cell + cell / 2, cell / 2 - 6, 0, Math.PI * 2);
            ctx.fill();
        }

        // Power-up (yellow).
        if (S.yellowBonus) {
            ctx.fillStyle = '#ffc107';
            ctx.beginPath();
            ctx.arc(S.yellowBonus.x * cell + cell / 2, S.yellowBonus.y * cell + cell / 2, cell / 2 - 6, 0, Math.PI * 2);
            ctx.fill();
        }

        // Player.
        ctx.fillStyle = '#007bff';
        ctx.fillRect(S.player.x * cell, S.player.y * cell, cell, cell);
    },

    darken(hex, f) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return '#' + [r, g, b].map(v => Math.round(v * f).toString(16).padStart(2, '0')).join('');
    },

    sound(name) {
        switch (name) {
            case 'green':
                playTone({ freq: 880, duration: 0.08, type: 'square', gain: 0.12 });
                playTone({ freq: 1318.5, duration: 0.12, type: 'square', gain: 0.12, when: 0.07 });
                break;
            case 'blue':
                playTone({ freq: 523.25, duration: 0.09, type: 'triangle', gain: 0.15 });
                playTone({ freq: 659.25, duration: 0.09, type: 'triangle', gain: 0.15, when: 0.08 });
                playTone({ freq: 783.99, duration: 0.14, type: 'triangle', gain: 0.15, when: 0.16 });
                break;
            case 'yellow':
                playTone({ freq: 300, endFreq: 1200, duration: 0.35, type: 'sawtooth', gain: 0.15 });
                break;
            case 'blast':
                playNoise({ duration: 0.25, gain: 0.3 });
                playTone({ freq: 120, endFreq: 50, duration: 0.2, type: 'sawtooth', gain: 0.22 });
                break;
            case 'levelUp':
                playTone({ freq: 80, endFreq: 160, duration: 0.4, type: 'sawtooth', gain: 0.18 });
                playNoise({ duration: 0.3, gain: 0.1, when: 0.05 });
                break;
            case 'move':
                playTone({ freq: 110, duration: 0.04, type: 'sine', gain: 0.07 });
                break;
            case 'gameOver':
                playTone({ freq: 392, duration: 0.18, type: 'square', gain: 0.12 });
                playTone({ freq: 329.63, duration: 0.18, type: 'square', gain: 0.12, when: 0.18 });
                playTone({ freq: 261.63, duration: 0.18, type: 'square', gain: 0.12, when: 0.36 });
                playTone({ freq: 196, duration: 0.4, type: 'square', gain: 0.12, when: 0.54 });
                break;
        }
    },

    music: {
        notes: [261.63, 329.63, 392.00, 329.63, 293.66, 349.23, 440.00, 349.23],
        stepMs: 320,
        type: 'triangle',
        gain: 0.09,
    },
};
