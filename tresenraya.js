/* ==========================================================================
   MathQuest V4 - Módulo Tres en Raya de Suma 15 (Tic-Tac-Toe Aritmético)
   Reglas: Tablero de 3x3. Turnos contra Mateo IA. Colocar números del 1 al 9.
   Cada número se puede usar una sola vez. Gana quien alinee 3 que sumen 15.
   ========================================================================== */

(function() {
    const boardEl = document.getElementById('tres-board');
    if (!boardEl) return;

    const overlay = document.getElementById('tres-overlay');
    const overlayTitle = document.getElementById('tres-overlay-title');
    const overlayText = document.getElementById('tres-overlay-instructions');
    const btnStart = document.getElementById('btn-start-tres-game');
    const btnRestart = document.getElementById('btn-restart-tres');
    const turnIndicator = document.getElementById('tres-turn-indicator');
    const heartsBox = document.getElementById('tres-hearts-box');
    const numSelector = document.getElementById('tres-num-selector');

    let board = Array(9).fill(null); // Cada celda: { val: number, owner: 'player' | 'mateo' | 'obstacle' }
    let usedNumbers = new Set();
    let selectedNumber = null;
    let isPlaying = false;
    let turn = 'player'; // 'player' | 'mateo'
    let level = 1;
    let lives = 3;

    // Posibles líneas ganadoras en un tablero 3x3
    const WINNING_LINES = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Filas
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columnas
        [0, 4, 8], [2, 4, 6]             // Diagonales
    ];

    // --------------------------------------------------------------------------
    // A. Inicialización e Interfaz de Vidas
    // --------------------------------------------------------------------------
    function updateHeartsDisplay() {
        if (!heartsBox) return;
        heartsBox.innerHTML = '';
        for (let i = 0; i < 3; i++) {
            if (i < lives) {
                heartsBox.innerHTML += '❤️ ';
            } else {
                heartsBox.innerHTML += '🖤 ';
            }
        }
    }

    function initGame(gameLevel) {
        level = gameLevel || 1;
        lives = 3;
        isPlaying = false;
        turn = 'player';
        selectedNumber = null;
        usedNumbers.clear();
        board = Array(9).fill(null);

        updateHeartsDisplay();

        // Configurar obstáculos según nivel
        if (level === 4) {
            // Un obstáculo aleatorio
            const idx = Math.floor(Math.random() * 9);
            board[idx] = { val: '✖', owner: 'obstacle' };
        } else if (level === 5) {
            // Dos obstáculos aleatorios en casillas no adyacentes si es posible
            const idx1 = Math.floor(Math.random() * 9);
            let idx2 = Math.floor(Math.random() * 9);
            while (idx1 === idx2) {
                idx2 = Math.floor(Math.random() * 9);
            }
            board[idx1] = { val: '✖', owner: 'obstacle' };
            board[idx2] = { val: '✖', owner: 'obstacle' };
        }

        renderBoardHTML();
        renderSelectorHTML();

        if (turnIndicator) {
            turnIndicator.innerText = "¡Tu turno! 🧑‍🎓";
            turnIndicator.style.background = "var(--color-accent-blue)";
        }

        overlay.classList.remove('hidden');
        overlayTitle.innerText = `Tres en Raya 15 - Nivel ${level} ❌`;
        btnStart.innerText = "¡Iniciar Partida!";
    }

    // --------------------------------------------------------------------------
    // B. Renderizado HTML
    // --------------------------------------------------------------------------
    function renderBoardHTML() {
        boardEl.innerHTML = '';
        board.forEach((cell, idx) => {
            const cellDiv = document.createElement('div');
            cellDiv.className = 'board-cell';
            cellDiv.setAttribute('data-index', idx);

            if (cell !== null) {
                cellDiv.innerText = cell.val;
                cellDiv.classList.add(cell.owner);
                if (cell.owner === 'obstacle') {
                    cellDiv.style.background = 'var(--color-card-secondary)';
                    cellDiv.style.color = 'var(--color-text-muted)';
                    cellDiv.style.cursor = 'not-allowed';
                }
            } else {
                cellDiv.innerText = '';
                cellDiv.style.cursor = 'pointer';
            }

            cellDiv.addEventListener('click', () => handleCellClick(idx));
            boardEl.appendChild(cellDiv);
        });
    }

    function renderSelectorHTML() {
        numSelector.innerHTML = '';
        for (let i = 1; i <= 9; i++) {
            const btn = document.createElement('button');
            btn.className = 'num-choice-btn';
            btn.innerText = i;
            btn.setAttribute('data-num', i);

            if (usedNumbers.has(i)) {
                btn.disabled = true;
                btn.classList.add('used');
            } else if (selectedNumber === i) {
                btn.classList.add('selected');
            }

            btn.addEventListener('click', () => {
                if (!isPlaying || turn !== 'player') return;
                MathQuestApp.SoundEngine.playClick();
                selectedNumber = i;
                renderSelectorHTML();
            });

            numSelector.appendChild(btn);
        }
    }

    // --------------------------------------------------------------------------
    // C. Manejo de Turnos y Clicks
    // --------------------------------------------------------------------------
    function handleCellClick(idx) {
        if (!isPlaying || turn !== 'player') return;
        if (board[idx] !== null) return; // Casilla ocupada
        if (selectedNumber === null) {
            alert("⚠️ Selecciona primero un número disponible del 1 al 9 de la fila inferior.");
            return;
        }

        // Colocar número del jugador
        board[idx] = { val: selectedNumber, owner: 'player' };
        usedNumbers.add(selectedNumber);
        selectedNumber = null;

        MathQuestApp.SoundEngine.playClick();
        renderBoardHTML();
        renderSelectorHTML();

        // Comprobar si el jugador ganó
        if (checkWin('player')) {
            handleWin();
            return;
        }

        // Comprobar empate
        if (checkDraw()) {
            handleDraw();
            return;
        }

        // Cambiar turno a Mateo IA
        turn = 'mateo';
        if (turnIndicator) {
            turnIndicator.innerText = "Pensando... 🤖";
            turnIndicator.style.background = "var(--color-accent-purple)";
        }

        setTimeout(playMateoTurn, 900);
    }

    function playMateoTurn() {
        if (!isPlaying || turn !== 'mateo') return;

        const bestMove = getMateoBestMove();
        if (bestMove) {
            board[bestMove.idx] = { val: bestMove.val, owner: 'mateo' };
            usedNumbers.add(bestMove.val);
        }

        renderBoardHTML();
        renderSelectorHTML();

        // Comprobar si Mateo ganó
        if (checkWin('mateo')) {
            handleLoss();
            return;
        }

        // Comprobar empate
        if (checkDraw()) {
            handleDraw();
            return;
        }

        // Devolver turno al jugador
        turn = 'player';
        if (turnIndicator) {
            turnIndicator.innerText = "¡Tu turno! 🧑‍🎓";
            turnIndicator.style.background = "var(--color-accent-blue)";
        }
    }

    // --------------------------------------------------------------------------
    // D. Inteligencia Artificial de Mateo 🤖
    // --------------------------------------------------------------------------
    function getMateoBestMove() {
        const emptyCells = [];
        board.forEach((cell, idx) => {
            if (cell === null) emptyCells.push(idx);
        });

        const availableNums = [];
        for (let i = 1; i <= 9; i++) {
            if (!usedNumbers.has(i)) availableNums.push(i);
        }

        if (emptyCells.length === 0 || availableNums.length === 0) return null;

        // --- NIVEL 3 o superior: Buscar victoria inmediata ---
        if (level >= 3) {
            for (let i = 0; i < emptyCells.length; i++) {
                const idx = emptyCells[i];
                for (let j = 0; j < availableNums.length; j++) {
                    const val = availableNums[j];
                    // Simular jugada
                    board[idx] = { val, owner: 'mateo' };
                    const isWin = checkWin('mateo');
                    board[idx] = null; // revertir
                    if (isWin) {
                        return { idx, val };
                    }
                }
            }
        }

        // --- NIVEL 2 o superior: Bloquear victoria del jugador ---
        if (level >= 2) {
            for (let i = 0; i < emptyCells.length; i++) {
                const idx = emptyCells[i];
                for (let j = 0; j < availableNums.length; j++) {
                    const val = availableNums[j];
                    // Simular jugada del jugador
                    board[idx] = { val, owner: 'player' };
                    const isWin = checkWin('player');
                    board[idx] = null; // revertir
                    if (isWin) {
                        // Mateo intercepta colocando su propio número en esa casilla
                        return { idx, val: availableNums[0] }; // Puede bloquear con cualquier número
                    }
                }
            }
        }

        // --- Opción por defecto: Posicionar bien o jugar aleatorio ---
        // Si el centro está libre, Mateo lo prefiere
        if (emptyCells.includes(4)) {
            // Colocar un número impar preferentemente en el centro
            const odds = availableNums.filter(n => n % 2 !== 0);
            const val = odds.length > 0 ? odds[0] : availableNums[0];
            return { idx: 4, val };
        }

        // Jugar aleatorio
        const randCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        const randVal = availableNums[Math.floor(Math.random() * availableNums.length)];
        return { idx: randCell, val: randVal };
    }

    // --------------------------------------------------------------------------
    // E. Condiciones de Fin de Partida
    // --------------------------------------------------------------------------
    function checkWin(owner) {
        // Busca si alguna línea cumple: 3 casillas ocupadas por 'owner' y sumatorio = 15
        for (let i = 0; i < WINNING_LINES.length; i++) {
            const [a, b, c] = WINNING_LINES[i];
            const cellA = board[a];
            const cellB = board[b];
            const cellC = board[c];

            if (cellA && cellB && cellC) {
                if (cellA.owner === owner && cellB.owner === owner && cellC.owner === owner) {
                    if (cellA.val + cellB.val + cellC.val === 15) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    function checkDraw() {
        // Queda empatado si no hay más casillas vacías o números disponibles
        const hasEmpty = board.some(cell => cell === null);
        return !hasEmpty || usedNumbers.size >= 9;
    }

    function handleWin() {
        isPlaying = false;

        const nextLevelKey = `tres-${level + 1}`;
        if (level < 5 && !MathQuestApp.state.unlockedLevels.includes(nextLevelKey)) {
            MathQuestApp.state.unlockedLevels.push(nextLevelKey);
        }

        MathQuestApp.SoundEngine.playFanfare();
        const coinsAwarded = MathQuestApp.awardCoins(true, level);

        overlay.classList.remove('hidden');
        overlayTitle.innerText = "¡Ganaste! 🎉";
        overlayText.innerHTML = `¡Fantástico! Completaste el Tres en Raya sumando 15 antes que Mateo.<br>Ganaste <b>+${coinsAwarded} MathCoins</b>.`;
        btnStart.innerText = level < 5 ? "Siguiente Nivel" : "Volver al Mapa";
    }

    function handleLoss() {
        isPlaying = false;
        lives--;
        updateHeartsDisplay();

        if (lives <= 0) {
            handleGameOver();
        } else {
            MathQuestApp.SoundEngine.playWrong();
            alert(`😢 ¡Mateo sumó 15 primero! Perdiste 1 vida.`);
            // Reiniciar estado de ronda
            board = Array(9).fill(null);
            usedNumbers.clear();
            selectedNumber = null;
            turn = 'player';
            renderBoardHTML();
            renderSelectorHTML();
            if (turnIndicator) {
                turnIndicator.innerText = "¡Tu turno! 🧑‍🎓";
                turnIndicator.style.background = "var(--color-accent-blue)";
            }
        }
    }

    function handleDraw() {
        isPlaying = false;
        MathQuestApp.SoundEngine.playWrong();
        alert("👔 ¡Empate! Ninguno sumó 15. Reiniciando la cuadrícula...");
        board = Array(9).fill(null);
        usedNumbers.clear();
        selectedNumber = null;
        turn = 'player';
        renderBoardHTML();
        renderSelectorHTML();
        if (turnIndicator) {
            turnIndicator.innerText = "¡Tu turno! 🧑‍🎓";
            turnIndicator.style.background = "var(--color-accent-blue)";
        }
        isPlaying = true;
    }

    function handleGameOver() {
        isPlaying = false;

        // Castigo:
        MathQuestApp.state.streak = 1;
        const penalty = 20;
        const previousCoins = MathQuestApp.state.coins;
        MathQuestApp.state.coins = Math.max(0, MathQuestApp.state.coins - penalty);
        const lostAmount = previousCoins - MathQuestApp.state.coins;

        try {
            localStorage.setItem('mq3_streak', MathQuestApp.state.streak);
            localStorage.setItem('mq3_coins', MathQuestApp.state.coins);
        } catch(e){}

        document.getElementById('streak-count').innerText = MathQuestApp.state.streak;
        document.getElementById('coins-count').innerText = MathQuestApp.state.coins;

        overlay.classList.remove('hidden');
        overlayTitle.innerText = "¡Juego Terminado! 💔";
        overlayText.innerHTML = `Mateo está muy feliz... 🤖 Te quedaste sin corazones.<br><b>Consecuencias:</b> Tu racha vuelve a 1 y perdiste <b>${lostAmount} MathCoins</b>.`;
        btnStart.innerText = "Reintentar Nivel";
    }

    // --------------------------------------------------------------------------
    // F. Eventos y Pistas de Mochila
    // --------------------------------------------------------------------------
    window.startTresGame = function(gameLevel) {
        initGame(gameLevel);
    };

    window.stopTresGame = function() {
        isPlaying = false;
        usedNumbers.clear();
        board = Array(9).fill(null);
    };

    window.useTresHint = function() {
        // Pista: Mateo IA te regala la mejor jugada para bloquear o ganar
        if (!isPlaying || turn !== 'player') return false;

        const bestMove = getMateoBestMove(); // La IA calcula el mejor movimiento para sí misma, pero te lo revelamos
        if (bestMove) {
            MathQuestApp.SoundEngine.playShield();
            alert(`💡 Pista de Mateo: La mejor jugada en este momento es colocar el número ${bestMove.val} en la casilla número ${bestMove.idx + 1}.`);
            return true;
        }
        return false;
    };

    btnStart.addEventListener('click', () => {
        MathQuestApp.SoundEngine.playClick();
        if (lives <= 0 || !checkWin('player')) {
            initGame(level);
        }
        overlay.classList.add('hidden');
        isPlaying = true;
    });

    btnRestart.addEventListener('click', () => {
        MathQuestApp.SoundEngine.playClick();
        initGame(level);
        overlay.classList.add('hidden');
        isPlaying = true;
    });

})();
