/* ==========================================================================
   MathQuest V3 - Módulo Sodocu Algebraico 9x9
   Sudoku completo de 9x9 con subcuadrículas 3x3, ecuaciones dinámicas con KaTeX,
   sistema de 3 errores (vidas) en color rojo neón y soporte de Pistas.
   ========================================================================== */

(function() {
    const gridEl = document.getElementById('sudoku-board-grid');
    if (!gridEl) return;

    const overlay = document.getElementById('sudoku-overlay');
    const btnStart = document.getElementById('btn-start-sudoku-game');
    const btnRestart = document.getElementById('btn-restart-sudoku');
    const heartsBox = document.getElementById('sudoku-hearts-box');
    const cluesBox = document.getElementById('sudoku-clues-box');

    let board = [];         // 9x9 grid, cells can be { val, fixed, variable, varName, playerVal }
    let solution = [];      // 9x9 solved board numbers
    let variableValues = {};// Mapping of letters to actual values, e.g., {'a': 5}
    let selectedCell = null;// { r, c }
    let lives = 3;
    let level = 1;
    let isPlaying = false;

    // A. Plantilla base de Sudoku 9x9 (Matriz válida para permutaciones rápidas)
    const baseGrid = [
        [5, 3, 4, 6, 7, 8, 9, 1, 2],
        [6, 7, 2, 1, 9, 5, 3, 4, 8],
        [1, 9, 8, 3, 4, 2, 5, 6, 7],
        [8, 5, 9, 7, 6, 1, 4, 2, 3],
        [4, 2, 6, 8, 5, 3, 7, 9, 1],
        [7, 1, 3, 9, 2, 4, 8, 5, 6],
        [9, 6, 1, 5, 3, 7, 2, 8, 4],
        [2, 8, 7, 4, 1, 9, 6, 3, 5],
        [3, 4, 5, 2, 8, 6, 1, 7, 9]
    ];

    // --------------------------------------------------------------------------
    // B. Inicialización e Interfaz de Vidas
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
        selectedCell = null;

        updateHeartsDisplay();

        // 1. Generar la solución permutando filas y columnas
        generatePermutedSudoku();

        // 2. Generar el reto matemático de variables
        const challenge = MathQuestApp.mathGen.generateSudokuClues(level);
        variableValues = challenge.values;

        // Limpiar y renderizar panel de pistas con KaTeX
        cluesBox.innerHTML = '<h4 style="color:var(--color-accent-yellow); margin-bottom:8px; font-family:var(--font-heading);">Despeja:</h4>';
        challenge.clues.forEach(clue => {
            const div = document.createElement('div');
            div.style.marginBottom = '6px';
            div.style.fontSize = '0.9rem';
            
            const labelSpan = document.createElement('span');
            labelSpan.className = 'math-label';
            
            cluesBox.appendChild(div);
            // Renderizar LaTeX
            MathQuestApp.renderLaTeX(clue.text, div);
        });

        // 3. Crear el tablero de juego removiendo celdas según nivel
        createGameBoard();

        // 4. Renderizar el tablero de 9x9 en HTML
        renderSudokuBoardHTML();

        overlay.classList.remove('hidden');
        document.getElementById('sudoku-instruction-text').innerText = `Despeja las variables ($a, b, c, d, e$) y completa la cuadrícula de 9x9. ¡Cuidado con fallar!`;
    }

    // Permutación O(1) de Sudoku para tener tableros infinitos
    function generatePermutedSudoku() {
        solution = JSON.parse(JSON.stringify(baseGrid));
        
        // Permutar dígitos
        const mapping = {};
        const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];
        const shuffled = [...digits].sort(() => Math.random() - 0.5);
        for (let i = 0; i < 9; i++) {
            mapping[digits[i]] = shuffled[i];
        }

        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                solution[r][c] = mapping[solution[r][c]];
            }
        }
    }

    function createGameBoard() {
        board = [];
        // Cantidad de celdas pre-rellenadas decae con el nivel (más difícil)
        const filledCellsCount = 44 - (level * 4); // 40 a 24 celdas

        // Elegir coordenadas al azar para ocultar
        const hiddenMask = [];
        for (let r = 0; r < 9; r++) {
            hiddenMask[r] = [];
            for (let c = 0; c < 9; c++) {
                hiddenMask[r][c] = true; // Todo oculto inicialmente
            }
        }

        let placed = 0;
        while (placed < filledCellsCount) {
            const r = Math.floor(Math.random() * 9);
            const c = Math.floor(Math.random() * 9);
            if (hiddenMask[r][c]) {
                hiddenMask[r][c] = false;
                placed++;
            }
        }

        // Crear la estructura de celdas
        for (let r = 0; r < 9; r++) {
            board[r] = [];
            for (let c = 0; c < 9; c++) {
                const isHidden = hiddenMask[r][c];
                const realVal = solution[r][c];
                
                let isVariable = false;
                let varName = '';

                // Colocar variables algebraicas del reto en las casillas ocultas al azar
                if (isHidden) {
                    // Si el valor real coincide con alguna variable asignada en el reto
                    const matchedVar = Object.keys(variableValues).find(key => variableValues[key] === realVal);
                    if (matchedVar && Math.random() < 0.45) {
                        isVariable = true;
                        varName = matchedVar;
                    }
                }

                board[r][c] = {
                    val: realVal,
                    fixed: !isHidden,
                    isVariable: isVariable,
                    varName: varName,
                    playerVal: isHidden ? '' : realVal,
                    error: false
                };
            }
        }
    }

    // --------------------------------------------------------------------------
    // C. Renderizado del Tablero 9x9 en HTML
    // --------------------------------------------------------------------------
    function renderSudokuBoardHTML() {
        gridEl.innerHTML = '';
        
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const cell = board[r][c];
                const div = document.createElement('div');
                div.className = 'sudoku-cell';
                div.setAttribute('data-row', r);
                div.setAttribute('data-col', c);

                if (cell.fixed) {
                    div.classList.add('cell-fixed');
                    div.innerText = cell.val;
                } else if (cell.isVariable && !cell.playerVal) {
                    div.classList.add('cell-variable');
                    div.innerText = cell.varName;
                } else {
                    // Casilla vacía o rellenada por el jugador
                    div.innerText = cell.playerVal || '';
                }

                if (cell.error) {
                    div.classList.add('cell-error');
                }

                if (selectedCell && selectedCell.r === r && selectedCell.c === c) {
                    div.classList.add('cell-selected');
                }

                div.addEventListener('click', () => selectCell(r, c));
                gridEl.appendChild(div);
            }
        }
    }

    function selectCell(r, c) {
        if (!isPlaying) return;
        const cell = board[r][c];
        if (cell.fixed) return; // Las fijas no se eligen

        selectedCell = { r, c };
        renderSudokuBoardHTML();
    }

    // --------------------------------------------------------------------------
    // D. Entrada Numérica y Lógica de 3 Vidas (Errores en Rojo)
    // --------------------------------------------------------------------------
    function inputNumber(num) {
        if (!selectedCell || !isPlaying) return;
        const { r, c } = selectedCell;
        const cell = board[r][c];

        // Verificar validez contra el solucionador
        const isCorrect = (num === cell.val);

        if (isCorrect) {
            MathQuestApp.SoundEngine.playCorrect();
            cell.playerVal = num;
            cell.error = false;
            
            // Si era variable, alertar que la descubrió
            if (cell.isVariable) {
                alert(`🎉 ¡Excelente! Descubriste que la variable ${cell.varName} vale ${num}.`);
            }

            // Otorgar monedas por acierto
            MathQuestApp.awardCoins(false, level);

            selectedCell = null; // Quitar selección
            renderSudokuBoardHTML();

            // Comprobar victoria
            if (checkSudokuWin()) {
                handleLevelComplete();
            }
        } else {
            // Error matemático
            MathQuestApp.SoundEngine.playWrong();
            cell.playerVal = num; // Mostrar temporalmente
            cell.error = true;
            
            lives--;
            updateHeartsDisplay();
            renderSudokuBoardHTML();

            if (lives <= 0) {
                handleGameOver();
            } else {
                setTimeout(() => {
                    // Limpiar el error después de un segundo
                    cell.playerVal = '';
                    cell.error = false;
                    renderSudokuBoardHTML();
                }, 1000);
            }
        }
    }

    function checkSudokuWin() {
        // Verificar si todas las celdas coinciden con sus valores solucionados
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (board[r][c].playerVal !== board[r][c].val) {
                    return false;
                }
            }
        }
        return true;
    }

    function handleGameOver() {
        isPlaying = false;

        // Castigo real:
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
        overlay.querySelector('h3').innerText = "¡Juego Terminado! 💔";
        
        // Mateo triste en el mensaje de derrota
        let overlayText = document.getElementById('sudoku-overlay-text');
        if (!overlayText) {
            overlayText = document.createElement('p');
            overlayText.id = 'sudoku-overlay-text';
            const contentBox = overlay.querySelector('.overlay-content');
            if (contentBox) contentBox.insertBefore(overlayText, btnStart);
        }
        overlayText.style.color = 'var(--color-accent-coral)';
        overlayText.innerHTML = `Mateo está triste... 😢 Te quedaste sin corazones.<br><b>Consecuencias:</b> Tu racha vuelve a 1 y has perdido <b>${lostAmount} MathCoins</b>. ¡Estudia más para mejorar tu razonamiento lógico!`;

        overlay.querySelector('button').innerText = "Reintentar Sodocu";
    }

    function handleLevelComplete() {
        isPlaying = false;

        const nextLevelKey = `sudoku-${level + 1}`;
        if (level < 5 && !MathQuestApp.state.unlockedLevels.includes(nextLevelKey)) {
            MathQuestApp.state.unlockedLevels.push(nextLevelKey);
        }

        // Auto desbloquear Ahorcado Lvl 1 si completó Sudoku Lvl 5
        if (level === 5 && !MathQuestApp.state.unlockedLevels.includes('ahorcado-1')) {
            MathQuestApp.state.unlockedLevels.push('ahorcado-1');
        }

        MathQuestApp.SoundEngine.playFanfare();
        const coinsAwarded = MathQuestApp.awardCoins(true, level);

        overlay.classList.remove('hidden');
        overlay.querySelector('h3').innerText = "¡Sodocu Resuelto! 🌟";
        overlay.querySelector('button').innerText = level < 5 ? "Siguiente Nivel" : "Volver al Mapa";
        alert(`🌟 ¡Espectacular! Resolviste el sudoku algebraico de 9x9. Ganaste +${coinsAwarded} MathCoins.`);
    }

    // --------------------------------------------------------------------------
    // E. Eventos y Pistas Globales
    // --------------------------------------------------------------------------
    
    // Callback de Pista
    window.useSudokuHint = function() {
        if (!selectedCell || !isPlaying) {
            alert("Elige una casilla vacía en la cuadrícula de 9x9 para aplicar la pista.");
            return false;
        }

        const { r, c } = selectedCell;
        const cell = board[r][c];

        // Rellenar automáticamente con el valor correcto de forma segura (sin contar error)
        SoundEngine.playShield();
        cell.playerVal = cell.val;
        cell.error = false;
        
        selectedCell = null;
        renderSudokuBoardHTML();

        if (checkSudokuWin()) {
            handleLevelComplete();
        }
        
        return true;
    };

    btnStart.addEventListener('click', () => {
        SoundEngine.playClick();
        if (lives <= 0 || checkSudokuWin()) {
            if (level < 5 && checkSudokuWin()) {
                initGame(level + 1);
            } else if (level === 5 && checkSudokuWin()) {
                document.getElementById('btn-back-menu').click();
                return;
            } else {
                initGame(level);
            }
        }
        overlay.classList.add('hidden');
        isPlaying = true;
    });

    btnRestart.addEventListener('click', () => {
        SoundEngine.playClick();
        initGame(level);
    });

    // Teclado virtual numérico
    const numBtns = document.querySelectorAll('.sudoku-num-btn');
    numBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            SoundEngine.playClick();
            const num = btn.getAttribute('data-num');
            if (num) {
                inputNumber(parseInt(num));
            }
        });
    });

    document.getElementById('btn-sudoku-clear').addEventListener('click', () => {
        if (selectedCell && isPlaying) {
            SoundEngine.playClick();
            const { r, c } = selectedCell;
            if (!board[r][c].fixed) {
                board[r][c].playerVal = '';
                board[r][c].error = false;
                renderSudokuBoardHTML();
            }
        }
    });

    window.startSudokuGame = function(gameLevel) {
        initGame(gameLevel);
    };

})();
