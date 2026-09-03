/* ==========================================================================
   MathQuest V3 - Módulo Duelo Matemático (Fase 4.1 Infraestructura)
   ========================================================================== */

(function() {
    'use strict';

    window.MathQuestGames = window.MathQuestGames || {};

    const DuelGame = {
        name: 'Duelo Matemático',
        icon: '⚔️',
        topic: 'logic',
        screenId: 'screen-duel',
        level: 1,
        isRunning: false,

        start: function(lvl) {
            this.level = parseInt(lvl) || 1;
            this.isRunning = true;
            console.log(`[Duelo Matemático] Inicializado nivel ${this.level}`);
            const overlay = document.getElementById('duel-overlay');
            if (overlay) overlay.classList.remove('hidden');
            const lvlEl = document.getElementById('duel-level-display');
            if (lvlEl) lvlEl.innerText = this.level;
        },

        stop: function() {
            this.isRunning = false;
            console.log('[Duelo Matemático] Detenido');
        },

        useHint: function() {
            if (!this.isRunning) return false;
            if (window.showToast) {
                window.showToast("💡 Pista Duelo: Piensa rápido antes de que se acabe el tiempo del rival.");
            }
            return true;
        }
    };

    window.MathQuestGames['duel'] = DuelGame;

    const btnStart = document.getElementById('btn-start-duel-game');
    if (btnStart) {
        btnStart.addEventListener('click', () => {
            if (window.SoundEngine) window.SoundEngine.playClick();
            const overlay = document.getElementById('duel-overlay');
            if (overlay) overlay.classList.add('hidden');
        });
    }
})();
