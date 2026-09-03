/* ==========================================================================
   MathQuest V3 - Módulo Constructor Matemático (Fase 4.1 Infraestructura)
   ========================================================================== */

(function() {
    'use strict';

    window.MathQuestGames = window.MathQuestGames || {};

    const BuilderGame = {
        name: 'Constructor Matemático',
        icon: '🏗️',
        topic: 'geometry',
        screenId: 'screen-builder',
        level: 1,
        isRunning: false,

        start: function(lvl) {
            this.level = parseInt(lvl) || 1;
            this.isRunning = true;
            console.log(`[Constructor Matemático] Inicializado nivel ${this.level}`);
            const overlay = document.getElementById('builder-overlay');
            if (overlay) overlay.classList.remove('hidden');
            const lvlEl = document.getElementById('builder-level-display');
            if (lvlEl) lvlEl.innerText = this.level;
        },

        stop: function() {
            this.isRunning = false;
            console.log('[Constructor Matemático] Detenido');
        },

        useHint: function() {
            if (!this.isRunning) return false;
            if (window.showToast) {
                window.showToast("💡 Pista Constructor: Balancea el peso y los ángulos de apoyo.");
            }
            return true;
        }
    };

    window.MathQuestGames['builder'] = BuilderGame;

    const btnStart = document.getElementById('btn-start-builder-game');
    if (btnStart) {
        btnStart.addEventListener('click', () => {
            if (window.SoundEngine) window.SoundEngine.playClick();
            const overlay = document.getElementById('builder-overlay');
            if (overlay) overlay.classList.add('hidden');
        });
    }
})();
