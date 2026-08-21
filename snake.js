/* ==========================================================================
   MathQuest V3 - Módulo Snake Algebraico (Edades 8-12)
   Lógica corregida de regeneración de manzanas, velocidad incremental con el 
   tiempo y soporte de Pistas, Súper Escudo y Congelador de Tiempo.
   ========================================================================== */

(function() {
    const canvas = document.getElementById('snake-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const overlay = document.getElementById('snake-overlay');
    const overlayTitle = document.getElementById('snake-overlay-title');
    const overlayText = document.getElementById('snake-overlay-text');
    const btnStart = document.getElementById('btn-start-snake-game');
    const btnRestart = document.getElementById('btn-restart-snake');
    const scoreVal = document.getElementById('snake-score');
    const heartsBox = document.getElementById('snake-hearts-box');

    let snake = [];
    let dir = 'right';
    let apples = []; // { x, y, value, isCorrect }
    let gameInterval = null;
    let baseSpeed = 160; // ms per tick
    let currentSpeed = 160;
    let score = 0;
    let lives = 3;
    let isPlaying = false;
    let level = 1;
    let currentChallenge = null;
    let isFrozen = false;
    let freezeTimeout = null;

    // Tamaño de celda
    const gridSize = 20;
    const tileCount = canvas.width / gridSize;

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
        dir = 'right';
        isPlaying = false;
        isFrozen = false;
        if (freezeTimeout) clearTimeout(freezeTimeout);

        // Velocidad basada en nivel
        baseSpeed = 170 - (level * 15);
        currentSpeed = baseSpeed;

        scoreVal.innerText = score;
        updateHeartsDisplay();

        // Crear cuerpo inicial de serpiente
        snake = [
            { x: 5, y: 10 },
            { x: 4, y: 10 },
            { x: 3, y: 10 }
        ];

        generateNewMathChallenge();
        overlay.classList.remove('hidden');
        overlayTitle.innerText = `Álgebra Snake - Nivel ${level} 🍏`;
        overlayText.innerText = `Resuelve las ecuaciones para ganar. Velocidad base: ${Math.round(1000 / currentSpeed)} celdas/seg.`;
        btnStart.innerText = "¡Empezar!";

        // Dibujar estado estático de fondo
        draw();
        injectPowerupButtons();
    }

    // Inyectar botones dinámicos de inventario (Súper Escudo y Congelador)
    function injectPowerupButtons() {
        const sidebar = document.querySelector('#screen-snake .game-sidebar');
        if (!sidebar) return;

        // Limpiar cualquier panel de inventario previo
        const oldPanel = document.getElementById('snake-inventory-panel');
        if (oldPanel) oldPanel.remove();

        const invPanel = document.createElement('div');
        invPanel.id = 'snake-inventory-panel';
        invPanel.style.marginTop = '15px';
        invPanel.style.padding = '10px';
        invPanel.style.border = '2px dashed var(--color-border)';
        invPanel.style.borderRadius = 'var(--border-radius-medium)';
        invPanel.style.background = 'var(--color-card-secondary)';

        const appState = MathQuestApp.state;
        const shieldCount = appState.inventory.shield || 0;
        const freezeCount = appState.inventory.freeze || 0;

        invPanel.innerHTML = `
            <h4 style="font-size:0.85rem; margin-bottom:8px; font-family:var(--font-heading); color:var(--color-accent-yellow);">🎒 Tus Objetos de Tienda:</h4>
            <div style="display:flex; gap:8px;">
                <button id="btn-use-shield-snake" class="btn btn-secondary" style="flex:1; padding:6px; font-size:0.75rem;" ${shieldCount <= 0 ? 'disabled' : ''}>
                    🛡️ Escudo (${shieldCount})
                </button>
                <button id="btn-use-freeze-snake" class="btn btn-secondary" style="flex:1; padding:6px; font-size:0.75rem;" ${freezeCount <= 0 ? 'disabled' : ''}>
                    ⏱️ Congelar (${freezeCount})
                </button>
            </div>
        `;

        sidebar.appendChild(invPanel);

        // Listeners
        const shieldBtn = document.getElementById('btn-use-shield-snake');
        const freezeBtn = document.getElementById('btn-use-freeze-snake');

        if (shieldBtn) {
            shieldBtn.addEventListener('click', () => {
                if (appState.inventory.shield > 0) {
                    appState.inventory.shield--;
                    MathQuestApp.SoundEngine.playShield();
                    // Agregar estado activo visual de escudo
                    snakeHasShield = true;
                    saveStateAndUpdate();
                    injectPowerupButtons();
                }
            });
        }

        if (freezeBtn) {
            freezeBtn.addEventListener('click', () => {
                if (appState.inventory.freeze > 0) {
                    appState.inventory.freeze--;
                    MathQuestApp.SoundEngine.playTimeFreeze();
                    triggerTimeFreeze();
                    saveStateAndUpdate();
                    injectPowerupButtons();
                }
            });
        }
    }

    let snakeHasShield = false;

    function triggerTimeFreeze() {
        isFrozen = true;
        currentSpeed = baseSpeed * 1.8; // Más lento
        if (isPlaying) {
            clearInterval(gameInterval);
            gameInterval = setInterval(gameLoop, currentSpeed);
        }

        if (freezeTimeout) clearTimeout(freezeTimeout);
        freezeTimeout = setTimeout(() => {
            isFrozen = false;
            currentSpeed = baseSpeed;
            if (isPlaying) {
                clearInterval(gameInterval);
                gameInterval = setInterval(gameLoop, currentSpeed);
            }
        }, 10000); // 10 segundos
    }

    function saveStateAndUpdate() {
        if (window.MathQuestApp && typeof window.MathQuestApp.updateHeaderStats === 'function') {
            // app.js maneja almacenamiento global
        }
        // Llamar guardado manual
        localStorage.setItem('mq3_inventory', JSON.stringify(MathQuestApp.state.inventory));
        document.getElementById('coins-count').innerText = MathQuestApp.state.coins;
    }

    function generateNewMathChallenge() {
        currentChallenge = MathQuestApp.mathGen.generateSnakeChallenge(level);
        
        // Renderizar la ecuación en LaTeX
        const equationBox = document.getElementById('snake-equation');
        MathQuestApp.renderLaTeX(currentChallenge.formula, equationBox);

        spawnApples();
    }

    // --------------------------------------------------------------------------
    // B. Spawn y Renderizado de Manzanas (Fix: Siempre presentes tras morir)
    // --------------------------------------------------------------------------
    function spawnApples() {
        apples = [];
        
        // 1. Manzana correcta
        const correctPos = getRandomFreeCell();
        apples.push({
            x: correctPos.x,
            y: correctPos.y,
            value: currentChallenge.ans,
            isCorrect: true,
            hintHighlighted: false
        });

        // 2. Tres manzanas distractoras
        const wrongAnswers = new Set();
        while (wrongAnswers.size < 3) {
            // Generar distractor aleatorio cerca del resultado real
            const offset = (Math.floor(Math.random() * 8) - 4) || 2;
            const val = currentChallenge.ans + offset;
            if (val !== currentChallenge.ans && val > 0) {
                wrongAnswers.add(val);
            }
        }

        wrongAnswers.forEach(val => {
            const pos = getRandomFreeCell();
            apples.push({
                x: pos.x,
                y: pos.y,
                value: val,
                isCorrect: false,
                hintHighlighted: false
            });
        });
    }

    function getRandomFreeCell() {
        let attempts = 0;
        while (attempts < 200) {
            const x = Math.floor(Math.random() * tileCount);
            const y = Math.floor(Math.random() * tileCount);
            
            // Comprobar que no choque con la serpiente
            let onSnake = snake.some(s => s.x === x && s.y === y);
            // Comprobar que no choque con otras manzanas
            let onApple = apples.some(a => a.x === x && a.y === y);

            if (!onSnake && !onApple && x > 0 && x < tileCount - 1 && y > 0 && y < tileCount - 1) {
                return { x, y };
            }
            attempts++;
        }
        return { x: 10, y: 12 };
    }

    // --------------------------------------------------------------------------
    // C. Bucle del Juego y Colisiones
    // --------------------------------------------------------------------------
    function startGameLoop() {
        overlay.classList.add('hidden');
        isPlaying = true;
        clearInterval(gameInterval);
        gameInterval = setInterval(gameLoop, currentSpeed);

        // Aumentar velocidad dinámicamente cada 30 segundos
        this.speedTimer = setInterval(() => {
            if (isPlaying && !isFrozen && currentSpeed > 60) {
                currentSpeed -= 5;
                clearInterval(gameInterval);
                gameInterval = setInterval(gameLoop, currentSpeed);
            }
        }, 30000);
    }

    function gameLoop() {
        moveSnake();
        checkCollisions();
        draw();
    }

    function moveSnake() {
        const head = { ...snake[0] };

        switch (dir) {
            case 'up': head.y--; break;
            case 'down': head.y++; break;
            case 'left': head.x--; break;
            case 'right': head.x++; break;
        }

        snake.unshift(head);
        snake.pop();
    }

    function checkCollisions() {
        const head = snake[0];

        // 1. Chocar con muros o consigo misma
        const hitWall = (head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount);
        const hitSelf = snake.slice(1).some(segment => segment.x === head.x && segment.y === head.y);

        if (hitWall || hitSelf) {
            handleHit();
            return;
        }

        // 2. Chocar con manzanas
        for (let i = 0; i < apples.length; i++) {
            const apple = apples[i];
            if (head.x === apple.x && head.y === apple.y) {
                if (apple.isCorrect) {
                    // ¡Correcto!
                    MathQuestApp.SoundEngine.playCorrect();
                    score++;
                    scoreVal.innerText = score;

                    // Crecer la serpiente agregando un segmento en la cola
                    snake.push({ ...snake[snake.length - 1] });

                    // Recompensar monedas en tiempo real
                    MathQuestApp.awardCoins(false, level);

                    if (score >= 5) {
                        // Completar nivel al juntar 5 respuestas
                        handleLevelComplete();
                    } else {
                        generateNewMathChallenge();
                    }
                } else {
                    // Incorrecto (manzana equivocada)
                    MathQuestApp.SoundEngine.playWrong();
                    lives--;
                    updateHeartsDisplay();
                    
                    if (lives <= 0) {
                        handleGameOver();
                    } else {
                        // Volver a colocar la serpiente segura y regenerar el reto matemático
                        resetSnakePosition();
                        generateNewMathChallenge();
                    }
                }
                break;
            }
        }
    }

    function handleHit() {
        if (snakeHasShield) {
            // Súper Escudo absorbe el choque
            snakeHasShield = false;
            MathQuestApp.SoundEngine.playShield();
            resetSnakePosition();
            injectPowerupButtons();
            return;
        }

        MathQuestApp.SoundEngine.playWrong();
        lives--;
        updateHeartsDisplay();

        if (lives <= 0) {
            handleGameOver();
        } else {
            resetSnakePosition();
            // IMPORTANTE: Aseguramos que haya manzanas en pantalla tras re-ubicarse
            if (apples.length === 0) {
                spawnApples();
            }
        }
    }

    function resetSnakePosition() {
        // Recoloca la cabeza de la serpiente segura en el centro
        dir = 'right';
        snake = [
            { x: 10, y: 10 },
            { x: 9, y: 10 },
            { x: 8, y: 10 }
        ];
    }

    function handleGameOver() {
        isPlaying = false;
        clearInterval(gameInterval);
        clearInterval(this.speedTimer);

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
        overlayTitle.innerText = "¡Juego Terminado! 💔";
        overlayText.style.color = 'var(--color-accent-coral)';
        overlayText.innerHTML = `Mateo está triste... 😢 Te quedaste sin vidas.<br><b>Consecuencias:</b> Tu racha vuelve a 1 y has perdido <b>${lostAmount} MathCoins</b>. ¡Estudia más para mejorar!`;
        btnStart.innerText = "Reintentar Nivel";
    }

    function handleLevelComplete() {
        isPlaying = false;
        clearInterval(gameInterval);
        clearInterval(this.speedTimer);

        // Registrar nivel superado en el estado
        const nextLevelKey = `snake-${level + 1}`;
        if (level < 5 && !MathQuestApp.state.unlockedLevels.includes(nextLevelKey)) {
            MathQuestApp.state.unlockedLevels.push(nextLevelKey);
        }
        
        // Auto desbloquear siguiente juego (Slither Lvl 1) si completó Snake Lvl 5
        if (level === 5 && !MathQuestApp.state.unlockedLevels.includes('slider-1')) {
            MathQuestApp.state.unlockedLevels.push('slider-1');
        }

        MathQuestApp.SoundEngine.playFanfare();
        const coinsAwarded = MathQuestApp.awardCoins(true, level);

        overlay.classList.remove('hidden');
        overlayTitle.innerText = "¡Nivel Completado! 🌟";
        overlayText.innerText = `¡Espectacular! Resolviste las 5 ecuaciones. Ganaste +${coinsAwarded} MathCoins.`;
        btnStart.innerText = level < 5 ? "Siguiente Nivel" : "Volver al Mapa";
    }

    // --------------------------------------------------------------------------
    // D. Dibujado de Gráficos (Skins Fire, Ice, Rainbow Neón)
    // --------------------------------------------------------------------------
    function draw() {
        // Limpiar canvas
        ctx.fillStyle = '#0f172a'; // Fondo azul oscuro premium
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Dibujar Rejilla de Fondo sutil
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;
        for (let i = 0; i <= tileCount; i++) {
            ctx.beginPath();
            ctx.moveTo(i * gridSize, 0);
            ctx.lineTo(i * gridSize, canvas.height);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(0, i * gridSize);
            ctx.lineTo(canvas.width, i * gridSize);
            ctx.stroke();
        }

        // Obtener la skin equipada
        const skin = MathQuestApp.state.equippedSkin || 'standard';

        // Dibujar Serpiente
        snake.forEach((segment, idx) => {
            const isHead = idx === 0;
            
            // Establecer color según la Skin de la tienda
            let fillStyle = '#10b981'; // Standard green
            let shadowStyle = 'rgba(16, 185, 129, 0.4)';
            
            if (skin === 'fire') {
                fillStyle = isHead ? '#ef4444' : '#f97316';
                shadowStyle = 'rgba(239, 68, 68, 0.6)';
            } else if (skin === 'ice') {
                fillStyle = isHead ? '#3b82f6' : '#06b6d4';
                shadowStyle = 'rgba(6, 182, 212, 0.6)';
            } else if (skin === 'rainbow') {
                // Ciclo dinámico multicolor
                const hue = (Date.now() / 15 + idx * 15) % 360;
                fillStyle = `hsl(${hue}, 90%, 60%)`;
                shadowStyle = `hsla(${hue}, 90%, 60%, 0.5)`;
            }

            ctx.shadowBlur = 10;
            ctx.shadowColor = shadowStyle;
            ctx.fillStyle = fillStyle;

            // Dibujar segmento redondeado
            drawRoundedRect(
                ctx, 
                segment.x * gridSize + 1, 
                segment.y * gridSize + 1, 
                gridSize - 2, 
                gridSize - 2, 
                isHead ? 6 : 4
            );

            // Detalles de la Cabeza
            if (isHead) {
                ctx.fillStyle = '#ffffff';
                ctx.shadowBlur = 0;
                
                // Ojos orientados
                let eye1 = { x: 5, y: 5 }, eye2 = { x: 15, y: 5 };
                if (dir === 'down') { eye1 = { x: 5, y: 15 }; eye2 = { x: 15, y: 15 }; }
                if (dir === 'left') { eye1 = { x: 5, y: 5 }; eye2 = { x: 5, y: 15 }; }
                if (dir === 'right') { eye1 = { x: 15, y: 5 }; eye2 = { x: 15, y: 15 }; }

                ctx.beginPath();
                ctx.arc(segment.x * gridSize + eye1.x, segment.y * gridSize + eye1.y, 3, 0, Math.PI * 2);
                ctx.arc(segment.x * gridSize + eye2.x, segment.y * gridSize + eye2.y, 3, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#000000';
                ctx.beginPath();
                ctx.arc(segment.x * gridSize + eye1.x, segment.y * gridSize + eye1.y, 1.5, 0, Math.PI * 2);
                ctx.arc(segment.x * gridSize + eye2.x, segment.y * gridSize + eye2.y, 1.5, 0, Math.PI * 2);
                ctx.fill();

                // Aura Dorada si tiene escudo
                if (snakeHasShield) {
                    ctx.strokeStyle = '#eab308';
                    ctx.lineWidth = 3;
                    ctx.shadowColor = '#eab308';
                    ctx.shadowBlur = 15;
                    ctx.strokeRect(segment.x * gridSize - 2, segment.y * gridSize - 2, gridSize + 4, gridSize + 4);
                }
            }
        });

        // Limpiar sombra para otros dibujos
        ctx.shadowBlur = 0;

        // Dibujar Manzanas
        apples.forEach(apple => {
            // Dibujar círculo manzana (rojo universal)
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.arc(apple.x * gridSize + gridSize/2, apple.y * gridSize + gridSize/2, gridSize/2 - 1, 0, Math.PI * 2);
            ctx.fill();

            // Dibujar tallo verde
            ctx.fillStyle = '#a16207';
            ctx.fillRect(apple.x * gridSize + gridSize/2 - 1, apple.y * gridSize + 1, 2, 4);

            // Si se usó Pista, resalta la correcta
            if (apple.isCorrect && apple.hintHighlighted) {
                ctx.strokeStyle = '#eab308';
                ctx.lineWidth = 3;
                ctx.shadowColor = '#eab308';
                ctx.shadowBlur = 12;
                ctx.beginPath();
                ctx.arc(apple.x * gridSize + gridSize/2, apple.y * gridSize + gridSize/2, gridSize/2 + 4, 0, Math.PI * 2);
                ctx.stroke();
                ctx.shadowBlur = 0;
            }

            // Pintar valor numérico de la manzana
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 11px Fredoka';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(apple.value, apple.x * gridSize + gridSize/2, apple.y * gridSize + gridSize/2 + 1);
        });
    }

    function drawRoundedRect(c, x, y, width, height, radius) {
        c.beginPath();
        c.moveTo(x + radius, y);
        c.lineTo(x + width - radius, y);
        c.quadraticCurveTo(x + width, y, x + width, y + radius);
        c.lineTo(x + width, y + height - radius);
        c.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        c.lineTo(x + radius, y + height);
        c.quadraticCurveTo(x, y + height, x, y + height - radius);
        c.lineTo(x, y + radius);
        c.quadraticCurveTo(x, y, x + radius, y);
        c.closePath();
        c.fill();
    }

    // --------------------------------------------------------------------------
    // E. Eventos y Callbacks Globales
    // --------------------------------------------------------------------------
    
    // Cambiar dirección (Llamado centralizado desde app.js)
    window.handleSnakeDirection = function(newDir) {
        if (!isPlaying) return;
        // Evitar giro de 180 grados instantáneo
        if (newDir === 'up' && dir === 'down') return;
        if (newDir === 'down' && dir === 'up') return;
        if (newDir === 'left' && dir === 'right') return;
        if (newDir === 'right' && dir === 'left') return;
        dir = newDir;
    };

    // Callback de Pista Global (Mochila)
    window.useSnakeHint = function() {
        let correctApple = apples.find(a => a.isCorrect);
        if (correctApple) {
            correctApple.hintHighlighted = true;
            draw();
            return true; // Éxito al usar pista
        }
        return false;
    };

    // Iniciar desde overlay
    btnStart.addEventListener('click', () => {
        SoundEngine.playClick();
        if (lives <= 0 || score >= 5) {
            if (level < 5 && score >= 5) {
                // Ir al siguiente nivel
                initGame(level + 1);
            } else if (level === 5 && score >= 5) {
                // Salir al menú principal
                document.getElementById('btn-back-menu').click();
                return;
            } else {
                initGame(level);
            }
        }
        startGameLoop();
    });

    btnRestart.addEventListener('click', () => {
        SoundEngine.playClick();
        initGame(level);
    });

    // Soporte para mandos móviles táctiles
    document.getElementById('ctrl-up').addEventListener('click', () => window.handleSnakeDirection('up'));
    document.getElementById('ctrl-down').addEventListener('click', () => window.handleSnakeDirection('down'));
    document.getElementById('ctrl-left').addEventListener('click', () => window.handleSnakeDirection('left'));
    document.getElementById('ctrl-right').addEventListener('click', () => window.handleSnakeDirection('right'));

    // Exportar inicio del juego
    window.startSnakeGame = function(gameLevel) {
        initGame(gameLevel);
    };

    window.stopAllGames = function() {
        isPlaying = false;
        clearInterval(gameInterval);
        if (freezeTimeout) clearTimeout(freezeTimeout);
    };

})();
