/* ==========================================================================
   MathQuest V3 - Módulo Cálculo Rush (Fase 4.1 Infraestructura)
   ========================================================================== */

(function() {
    'use strict';

    window.MathQuestGames = window.MathQuestGames || {};

    const RushGame = {
        name: 'Cálculo Rush',
        icon: '🏎️',
        topic: 'algebra',
        screenId: 'screen-rush',
        level: 1,
        isRunning: false,

        start: function(lvl) {
            this.level = parseInt(lvl) || 1;
            this.isRunning = true;
            console.log(`[Cálculo Rush] Inicializado nivel ${this.level}`);
            const overlay = document.getElementById('rush-overlay');
            if (overlay) overlay.classList.remove('hidden');
            const lvlEl = document.getElementById('rush-level-display');
            if (lvlEl) lvlEl.innerText = this.level;
        },

        stop: function() {
            this.isRunning = false;
            console.log('[Cálculo Rush] Detenido');
        },

        useHint: function() {
            if (!this.isRunning) return false;
            if (window.showToast) {
                window.showToast("💡 Pista Cálculo Rush: Elige el carril con el resultado correcto.");
            }
            return true;
        }
    };

    window.MathQuestGames['rush'] = RushGame;

    // Conectar botón de inicio de overlay para cuando se juegue
    const btnStart = document.getElementById('btn-start-rush-game');
    if (btnStart) {
        btnStart.addEventListener('click', () => {
            if (window.SoundEngine) window.SoundEngine.playClick();
            const overlay = document.getElementById('rush-overlay');
            if (overlay) overlay.classList.add('hidden');
        });
    }
})();
