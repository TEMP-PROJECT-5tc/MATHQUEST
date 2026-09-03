/* ==========================================================================
   MathQuest V3 - Módulo Math Escape (Fase 4.1 Infraestructura)
   ========================================================================== */

(function() {
    'use strict';

    window.MathQuestGames = window.MathQuestGames || {};

    const EscapeGame = {
        name: 'Math Escape',
        icon: '🔐',
        topic: 'logic',
        screenId: 'screen-escape',
        level: 1,
        isRunning: false,

        start: function(lvl) {
            this.level = parseInt(lvl) || 1;
            this.isRunning = true;
            console.log(`[Math Escape] Inicializado nivel ${this.level}`);
            const overlay = document.getElementById('escape-overlay');
            if (overlay) overlay.classList.remove('hidden');
            const lvlEl = document.getElementById('escape-level-display');
            if (lvlEl) lvlEl.innerText = this.level;
        },

        stop: function() {
            this.isRunning = false;
            console.log('[Math Escape] Detenido');
        },

        useHint: function() {
            if (!this.isRunning) return false;
            if (window.showToast) {
                window.showToast("💡 Pista Escape: Descifra la combinación resolviendo la pista lógica.");
            }
            return true;
        }
    };

    window.MathQuestGames['escape'] = EscapeGame;

    const btnStart = document.getElementById('btn-start-escape-game');
    if (btnStart) {
        btnStart.addEventListener('click', () => {
            if (window.SoundEngine) window.SoundEngine.playClick();
            const overlay = document.getElementById('escape-overlay');
            if (overlay) overlay.classList.add('hidden');
        });
    }
})();
