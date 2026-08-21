/* ==========================================================================
   MathQuest V4 - Módulo Suma-Tetris (Aritmética y Razonamiento)
   Bloques 1x1 con números aleatorios. Fusión al sumar la meta en filas/columnas.
   Física fluida libre de bloqueos de rotación y castigo por derrotas.
   ========================================================================== */

(function() {
    const canvas = document.getElementById('tetris-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const overlay = document.getElementById('tetris-overlay');
    const overlayTitle = document.getElementById('tetris-overlay-title');
    const overlayText = document.getElementById('tetris-overlay-text');
    const btnStart = document.getElementById('btn-start-tetris-game');
    const btnRestart = document.getElementById('btn-restart-tetris');
    const scoreVal = document.getElementById('tetris-score');
    const heartsBox = document.getElementById('tetris-hearts-box');
    const targetDesc = document.getElementById('tetris-target-desc');

    const cols = 10;
    const rows = 15;
    const cellSize = 30; // Canvas: 300x450

    let board = [];
    let currentPiece = null; // { x, y, value, color }
    let gameInterval = null;
    let baseSpeed = 1000;
    let currentSpeed = 1000;
    let score = 0;
    let lives = 3;
    let isPlaying = false;
    let level = 1;
    let targetSum = 10; // Meta matemática a sumar en línea

    // Paleta neón de colores para los dígitos
    const NUMBER_COLORS = {
        1: '#ef4444', 2: '#f97316', 3: '#eab308', 4: '#22c55e',
        5: '#14b8a6', 6: '#06b6d4', 7: '#3b82f6', 8: '#6366f1',
        9: '#a855f7'
    };

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
        score = 0;
        lives = 3;
        isPlaying = false;

        // Establecer meta matemática según nivel
        const targets = { 1: 10, 2: 12, 3: 15, 4: 18, 5: 20 };
        targetSum = targets[level] || 10;
        targetDesc.innerText = `Suma ${targetSum}`;

        // Velocidad progresiva
        baseSpeed = Math.max(250, 1000 - (level * 130));
        currentSpeed = baseSpeed;

        scoreVal.innerText = score;
        updateHeartsDisplay();

        // Inicializar tablero vacío
        board = [];
        for (let r = 0; r < rows; r++) {
            board[r] = [];
            for (let c = 0; c < cols; c++) {
                board[r][c] = null;
            }
        }

        currentPiece = null;

        overlay.classList.remove('hidden');
        overlayTitle.innerText = `Suma-Tetris - Nivel ${level} 🧱`;
        overlayText.innerHTML = `Suma exactamente <b>${targetSum}</b> en línea horizontal o vertical apilando bloques.<br>⌨️ Mueve con <b>A / D / S</b> o Flechas. Presiona <b>W</b> para cambiar el número.`;
        btnStart.innerText = "¡Empezar!";

        draw();
    }

    // --------------------------------------------------------------------------
    // B. Creación y Movimiento de Bloques
    // --------------------------------------------------------------------------
    function spawnPiece() {
        // Generar dígito aleatorio según dificultad
        let minDigit = level >= 4 ? 2 : 1;
        let maxDigit = 9;
        if (level === 1) maxDigit = 7; // Más fácil de combinar

        const value = Math.floor(Math.random() * (maxDigit - minDigit + 1)) + minDigit;
        const color = NUMBER_COLORS[value] || '#6366f1';

        currentPiece = {
            x: Math.floor(cols / 2),
            y: 0,
            value: value,
            color: color
        };

        // Colisión al spawnear (Tablero lleno -> Pierde vida)
        if (checkCollision(currentPiece.x, currentPiece.y)) {
            handleTopOut();
        }
    }

    function checkCollision(px, py) {
        if (px < 0 || px >= cols || py >= rows) return true;
        if (py >= 0 && board[py][px] !== null) return true;
        return false;
    }

    function moveLeft() {
        if (!isPlaying || !currentPiece) return;
        if (!checkCollision(currentPiece.x - 1, currentPiece.y)) {
            currentPiece.x--;
            MathQuestApp.SoundEngine.playClick();
            draw();
        }
    }

    function moveRight() {
        if (!isPlaying || !currentPiece) return;
        if (!checkCollision(currentPiece.x + 1, currentPiece.y)) {
            currentPiece.x++;
            MathQuestApp.SoundEngine.playClick();
            draw();
        }
    }

    function moveDown() {
        if (!isPlaying || !currentPiece) return;
        if (!checkCollision(currentPiece.x, currentPiece.y + 1)) {
            currentPiece.y++;
            draw();
        } else {
            lockPiece();
        }
    }

    // Cambiar número de la pieza activa (Reroll)
    function rerollPieceValue() {
        if (!isPlaying || !currentPiece) return;
        MathQuestApp.SoundEngine.playClick();
        
        let minDigit = level >= 4 ? 2 : 1;
        let maxDigit = level === 1 ? 7 : 9;
        let newVal = currentPiece.value;
        while (newVal === currentPiece.value) {
            newVal = Math.floor(Math.random() * (maxDigit - minDigit + 1)) + minDigit;
        }
        currentPiece.value = newVal;
        currentPiece.color = NUMBER_COLORS[newVal] || '#6366f1';
        draw();
    }

    function lockPiece() {
        if (currentPiece.y < 0) {
            handleTopOut();
            return;
        }

        board[currentPiece.y][currentPiece.x] = {
            value: currentPiece.value,
            color: currentPiece.color
        };

        currentPiece = null;
        MathQuestApp.SoundEngine.playClick();

        // Buscar combinaciones de sumas en el tablero
        checkAndFuseSums();

        spawnPiece();
        draw();
    }

    // --------------------------------------------------------------------------
    // C. Detección y Fusión Aritmética (Suma Meta)
    // --------------------------------------------------------------------------
    function checkAndFuseSums() {
        let cleared = false;
        let cellsToClear = new Set(); // Almacenar posiciones "r,c" a borrar

        // 1. Verificar Filas (Horizontales)
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (board[r][c] === null) continue;

                // Buscar secuencias contiguas a la derecha
                let tempSum = 0;
                let seq = [];
                for (let k = c; k < cols; k++) {
                    if (board[r][k] === null) break;
                    tempSum += board[r][k].value;
                    seq.push({ r, c: k });

                    if (tempSum === targetSum) {
                        seq.forEach(cell => cellsToClear.add(`${cell.r},${cell.c}`));
                        cleared = true;
                    }
                    if (tempSum > targetSum) break;
                }
            }
        }

        // 2. Verificar Columnas (Verticales)
        for (let c = 0; c < cols; c++) {
            for (let r = 0; r < rows; r++) {
                if (board[r][c] === null) continue;

                // Buscar secuencias contiguas hacia abajo
                let tempSum = 0;
                let seq = [];
                for (let k = r; k < rows; k++) {
                    if (board[k][c] === null) break;
                    tempSum += board[k][c].value;
                    seq.push({ r: k, c });

                    if (tempSum === targetSum) {
                        seq.forEach(cell => cellsToClear.add(`${cell.r},${cell.c}`));
                        cleared = true;
                    }
                    if (tempSum > targetSum) break;
                }
            }
        }

        // 3. Borrar celdas y sumar puntos
        if (cleared) {
            MathQuestApp.SoundEngine.playExplosion();
            
            const cellsCount = cellsToClear.size;
            score += cellsCount * 10;
            scoreVal.innerText = score;

            // Premiar con monedas de forma progresiva
            MathQuestApp.awardCoins(false, level);

            // Vaciar las celdas
            cellsToClear.forEach(coord => {
                const [r, c] = coord.split(',').map(Number);
                board[r][c] = null;
            });

            // Aplicar gravedad para hacer caer los bloques colgantes
            applyTetrisGravity();

            // Meta de puntuación del nivel para ganar
            const winTarget = 80 + level * 30;
            if (score >= winTarget) {
                handleLevelComplete();
            } else {
                // Recursión para buscar cascadas (nuevas sumas creadas al caer)
                setTimeout(() => {
                    checkAndFuseSums();
                    draw();
                }, 200);
            }
        }
    }

    function applyTetrisGravity() {
        // Recorrer de abajo hacia arriba cada columna haciendo descender bloques colgantes
        for (let c = 0; c < cols; c++) {
            for (let r = rows - 2; r >= 0; r--) {
                if (board[r][c] === null) continue;
                
                // Mover hacia abajo tanto como sea posible
                let targetRow = r;
                while (targetRow + 1 < rows && board[targetRow + 1][c] === null) {
                    targetRow++;
                }

                if (targetRow !== r) {
                    board[targetRow][c] = board[r][c];
                    board[r][c] = null;
                }
            }
        }
    }

    // --------------------------------------------------------------------------
    // D. Control de Derrotas con Castigo Real
    // --------------------------------------------------------------------------
    function handleTopOut() {
        MathQuestApp.SoundEngine.playWrong();
        lives--;
        updateHeartsDisplay();

        if (lives <= 0) {
            handleGameOver();
        } else {
            // Limpiar las filas superiores como auxilio
            for (let r = 0; r < 6; r++) {
                for (let c = 0; c < cols; c++) {
                    board[r][c] = null;
                }
            }
            alert("⚠️ ¡Casi tocas el techo! Perdiste 1 vida. Se limpió la parte superior.");
            draw();
        }
    }

    function handleGameOver() {
        isPlaying = false;
        clearInterval(gameInterval);

        // Castigo:
        // 1. Reiniciar racha a 1
        MathQuestApp.state.streak = 1;

        // 2. Descontar 20 monedas
        const penalty = 20;
        const previousCoins = MathQuestApp.state.coins;
        MathQuestApp.state.coins = Math.max(0, MathQuestApp.state.coins - penalty);
        const lostAmount = previousCoins - MathQuestApp.state.coins;

        // Guardar
        try {
            localStorage.setItem('mq3_streak', MathQuestApp.state.streak);
            localStorage.setItem('mq3_coins', MathQuestApp.state.coins);
        } catch(e){}

        // Actualizar header
        document.getElementById('streak-count').innerText = MathQuestApp.state.streak;
        document.getElementById('coins-count').innerText = MathQuestApp.state.coins;

        overlay.classList.remove('hidden');
        overlayTitle.innerText = "¡Juego Terminado! 💔";
        overlayText.style.color = 'var(--color-accent-coral)';
        overlayText.innerHTML = `Mateo está triste... 😢 Te has quedado sin corazones.<br><b>Consecuencias:</b> Tu racha vuelve a 1 y has perdido <b>${lostAmount} MathCoins</b>. ¡Estudia más y vuelve a intentarlo!`;
        
        btnStart.innerText = "Reintentar Nivel";
    }

    function handleLevelComplete() {
        isPlaying = false;
        clearInterval(gameInterval);

        const nextLevelKey = `tetris-${level + 1}`;
        if (level < 5 && !MathQuestApp.state.unlockedLevels.includes(nextLevelKey)) {
            MathQuestApp.state.unlockedLevels.push(nextLevelKey);
        }

        // Desbloquear Sudoku 1 si pasa Tetris 5
        if (level === 5 && !MathQuestApp.state.unlockedLevels.includes('sudoku-1')) {
            MathQuestApp.state.unlockedLevels.push('sudoku-1');
        }

        MathQuestApp.SoundEngine.playFanfare();
        const coinsAwarded = MathQuestApp.awardCoins(true, level);

        overlay.classList.remove('hidden');
        overlayTitle.innerText = `Nivel ${level} Superado 🎉`;
        overlayText.innerHTML = `¡Estupendo! Lograste realizar las sumas necesarias.<br>Ganaste <b>+${coinsAwarded} MathCoins</b>.`;
        btnStart.innerText = level < 5 ? "Siguiente Nivel" : "Volver al Mapa";
    }

    // --------------------------------------------------------------------------
    // E. Dibujado de Canvas
    // --------------------------------------------------------------------------
    function draw() {
        // Fondo
        ctx.fillStyle = '#0b0f19';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Cuadrícula del tablero
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;
        for (let r = 0; r <= rows; r++) {
            ctx.beginPath();
            ctx.moveTo(0, r * cellSize);
            ctx.lineTo(canvas.width, r * cellSize);
            ctx.stroke();
        }
        for (let c = 0; c <= cols; c++) {
            ctx.beginPath();
            ctx.moveTo(c * cellSize, 0);
            ctx.lineTo(c * cellSize, canvas.height);
            ctx.stroke();
        }

        // Dibujar bloques fijos en el tablero
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cell = board[r][c];
                if (cell !== null) {
                    drawCellBlock(c, r, cell.value, cell.color);
                }
            }
        }

        // Dibujar bloque activo (cayendo)
        if (currentPiece) {
            drawCellBlock(currentPiece.x, currentPiece.y, currentPiece.value, currentPiece.color);
        }
    }

    function drawCellBlock(c, r, val, color) {
        const x = c * cellSize;
        const y = r * cellSize;

        // Marco neón
        ctx.fillStyle = color;
        ctx.fillRect(x + 2, y + 2, cellSize - 4, cellSize - 4);
        
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x + 3, y + 3, cellSize - 6, cellSize - 6);

        // Valor numérico
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 15px Fredoka';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(val, x + cellSize/2, y + cellSize/2 + 1);
    }

    // --------------------------------------------------------------------------
    // F. Teclado Centralizado
    // --------------------------------------------------------------------------
    window.handleTetrisAction = function(action) {
        if (!isPlaying) return;
        if (action === 'left') moveLeft();
        if (action === 'right') moveRight();
        if (action === 'down') moveDown();
        if (action === 'rotate') rerollPieceValue(); // W o Flecha arriba cambia el número!
    };

    window.useTetrisHint = function() {
        // Pista: limpia la fila inferior para bajar presión
        MathQuestApp.SoundEngine.playShield();
        for (let c = 0; c < cols; c++) {
            board[rows - 1][c] = null;
        }
        applyTetrisGravity();
        draw();
        alert("💡 ¡Pista activada! Se barrió la fila del fondo del tablero.");
        return true;
    };

    btnStart.addEventListener('click', () => {
        MathQuestApp.SoundEngine.playClick();
        if (lives <= 0 || score >= 80 + level * 30) {
            initGame(level);
        }
        
        overlay.classList.add('hidden');
        isPlaying = true;

        // Bucle del juego
        clearInterval(gameInterval);
        spawnPiece();
        gameInterval = setInterval(() => {
            if (isPlaying) {
                moveDown();
            }
        }, currentSpeed);
    });

    btnRestart.addEventListener('click', () => {
        MathQuestApp.SoundEngine.playClick();
        initGame(level);
    });

    window.startTetrisGame = function(gameLevel) {
        initGame(gameLevel);
    };

    window.stopAllGames = function() {
        isPlaying = false;
        clearInterval(gameInterval);
    };

})();
