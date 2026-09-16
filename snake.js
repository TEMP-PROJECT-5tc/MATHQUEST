/* ==========================================================================
   MathQuest V3 - Módulo Snake Algebraico (Edades 8-12)
   Integración con MathQuestGames, limpieza de timers (speedTimer/freezeTimeout),
   soporte declarativo de powerups y feedback de daño con animación .snake-shake.
   ========================================================================== */

(function() {
    'use strict';

    window.MathQuestGames = window.MathQuestGames || {};

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
    const levelVal = document.getElementById('snake-level-display');

    let snake = [];
    let dir = 'right';
    let apples = []; // { x, y, value, isCorrect, hintHighlighted }
    let gameInterval = null;
    let speedTimer = null;
    let freezeTimeout = null;
    let shakeTimeout = null;
    let baseSpeed = 160; // ms per tick
    let currentSpeed = 160;
    let score = 0;
    let lives = 3;
    let isPlaying = false;
    let level = 1;
    let currentChallenge = null;
    let isFrozen = false;
    let snakeHasShield = false;
    let powerupListenersAttached = false;

    // Tamaño de celda
    const gridSize = 20;
    const tileCount = canvas.width / gridSize;

    // Acceso seguro al estado de MathQuest
    function getAppState() {
        return (window.MathQuestApp && window.MathQuestApp.state) || window.state || { inventory: {}, coins: 0, streak: 1, unlockedLevels: [] };
    }

    function getSoundEngine() {
        return window.SoundEngine || (window.MathQuestApp && window.MathQuestApp.SoundEngine) || {
            playClick: () => {},
            playCorrect: () => {},
            playWrong: () => {},
            playShield: () => {},
            playTimeFreeze: () => {},
            playFanfare: () => {}
        };
    }

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

        const screenSnake = document.getElementById('screen-snake');
        if (screenSnake) {
            if (lives === 1) {
                screenSnake.classList.add('snake-lives-critical');
            } else {
                screenSnake.classList.remove('snake-lives-critical');
            }
        }
    }

    // Feedback visual de sacudida al recibir daño
    function triggerSnakeDamageFeedback() {
        const container = document.querySelector('#screen-snake .game-canvas-area') || canvas;
        if (!container) return;
        container.classList.remove('snake-shake');
        void container.offsetWidth; // Forzar reflujo
        container.classList.add('snake-shake');

        if (shakeTimeout) clearTimeout(shakeTimeout);
        shakeTimeout = setTimeout(() => {
            container.classList.remove('snake-shake');
            shakeTimeout = null;
        }, 450);
    }

    function initGame(gameLevel) {
        // Detener cualquier loop o timer previo
        stopSnake();

        level = parseInt(gameLevel, 10) || 1;
        score = 0;
        lives = 3;
        dir = 'right';
        isPlaying = false;
        isFrozen = false;
        snakeHasShield = false;

        // Velocidad basada en nivel
        baseSpeed = Math.max(70, 170 - (level * 15));
        currentSpeed = baseSpeed;

        if (scoreVal) scoreVal.innerText = score;
        if (levelVal) levelVal.innerText = level;
        updateHeartsDisplay();

        // Crear cuerpo inicial de serpiente
        snake = [
            { x: 5, y: 10 },
            { x: 4, y: 10 },
            { x: 3, y: 10 }
        ];

        generateNewMathChallenge();

        if (overlay) {
            overlay.classList.remove('hidden');
            if (overlayTitle) overlayTitle.innerText = `Álgebra Snake - Nivel ${level} 🍏`;
            if (overlayText) {
                overlayText.style.color = '';
                overlayText.innerText = `Resuelve las ecuaciones para ganar. Velocidad base: ${Math.round(1000 / currentSpeed)} celdas/seg.`;
            }
        }
        if (btnStart) btnStart.innerText = "¡Empezar!";

        // Dibujar estado estático de fondo
        draw();
        setupPowerupButtons();
    }

    // Manejo no destructivo de inventario de powerups
    function updatePowerupButtons() {
        const appState = getAppState();
        const shieldCount = (appState.inventory && appState.inventory.shield) || 0;
        const freezeCount = (appState.inventory && appState.inventory.freeze) || 0;

        const shieldBtn = document.getElementById('btn-use-shield-snake');
        const freezeBtn = document.getElementById('btn-use-freeze-snake');

        if (shieldBtn) {
            shieldBtn.innerText = `🛡️ Escudo (${shieldCount})`;
            shieldBtn.disabled = shieldCount <= 0;
        }
        if (freezeBtn) {
            freezeBtn.innerText = `⏱️ Congelar (${freezeCount})`;
            freezeBtn.disabled = freezeCount <= 0;
        }
    }

    function setupPowerupButtons() {
        if (!powerupListenersAttached) {
            const shieldBtn = document.getElementById('btn-use-shield-snake');
            const freezeBtn = document.getElementById('btn-use-freeze-snake');

            if (shieldBtn) {
                shieldBtn.addEventListener('click', () => {
                    const appState = getAppState();
                    if (appState.inventory && appState.inventory.shield > 0) {
                        appState.inventory.shield--;
                        getSoundEngine().playShield();
                        snakeHasShield = true;
                        saveStateAndUpdate();
                        updatePowerupButtons();
                        draw();
                    }
                });
            }

            if (freezeBtn) {
                freezeBtn.addEventListener('click', () => {
                    const appState = getAppState();
                    if (appState.inventory && appState.inventory.freeze > 0) {
                        appState.inventory.freeze--;
                        getSoundEngine().playTimeFreeze();
                        triggerTimeFreeze();
                        saveStateAndUpdate();
                        updatePowerupButtons();
                    }
                });
            }

            powerupListenersAttached = true;
        }

        updatePowerupButtons();
    }

    // Mantenido como alias para compatibilidad retroactiva
    function injectPowerupButtons() {
        setupPowerupButtons();
    }

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
            freezeTimeout = null;
        }, 10000); // 10 segundos
    }

    function saveStateAndUpdate() {
        if (typeof window.saveStateToStorage === 'function') {
            window.saveStateToStorage();
        } else if (window.MathQuestApp && typeof window.MathQuestApp.saveStateToStorage === 'function') {
            window.MathQuestApp.saveStateToStorage();
        } else {
            try {
                const appState = getAppState();
                localStorage.setItem('mq3_inventory', JSON.stringify(appState.inventory));
            } catch (e) {}
        }

        if (typeof window.updateHeaderStats === 'function') {
            window.updateHeaderStats();
        } else {
            const coinsEl = document.getElementById('coins-count');
            const appState = getAppState();
            if (coinsEl && appState) coinsEl.innerText = appState.coins;
        }
    }

    function generateNewMathChallenge() {
        const mathGenerator = window.mathGen || (window.MathQuestApp && window.MathQuestApp.mathGen);
        if (!mathGenerator || typeof mathGenerator.generateSnakeChallenge !== 'function') {
            // Reto de emergencia en caso extremo
            currentChallenge = { formula: `x + ${level} = ${level + 5}`, ans: 5 };
        } else {
            currentChallenge = mathGenerator.generateSnakeChallenge(level);
        }

        // Renderizar la ecuación en LaTeX
        const equationBox = document.getElementById('snake-equation');
        const latexRenderer = window.renderLaTeX || (window.MathQuestApp && window.MathQuestApp.renderLaTeX);
        if (equationBox && typeof latexRenderer === 'function') {
            latexRenderer(currentChallenge.formula, equationBox);
        } else if (equationBox) {
            equationBox.innerText = currentChallenge.formula;
        }

        spawnApples();
    }

    // --------------------------------------------------------------------------
    // B. Spawn y Renderizado de Manzanas
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
        let safetyCounter = 0;
        while (wrongAnswers.size < 3 && safetyCounter < 50) {
            safetyCounter++;
            const offset = (Math.floor(Math.random() * 8) - 4) || 2;
            const val = currentChallenge.ans + offset;
            if (val !== currentChallenge.ans && val > 0) {
                wrongAnswers.add(val);
            }
        }

        // Si faltan distractores por seguridad
        let fallback = 1;
        while (wrongAnswers.size < 3) {
            if (fallback !== currentChallenge.ans) wrongAnswers.add(fallback);
            fallback++;
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

            let onSnake = snake.some(s => s.x === x && s.y === y);
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
        if (overlay) overlay.classList.add('hidden');
        isPlaying = true;

        if (gameInterval) clearInterval(gameInterval);
        gameInterval = setInterval(gameLoop, currentSpeed);

        // Aumentar velocidad dinámicamente cada 30 segundos
        if (speedTimer) clearInterval(speedTimer);
        speedTimer = setInterval(() => {
            if (isPlaying && !isFrozen && currentSpeed > 60) {
                currentSpeed -= 5;
                if (gameInterval) clearInterval(gameInterval);
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
                    getSoundEngine().playCorrect();
                    score++;
                    if (scoreVal) scoreVal.innerText = score;

                    // Crecer la serpiente agregando un segmento en la cola
                    snake.push({ ...snake[snake.length - 1] });

                    // Recompensar monedas en tiempo real
                    const awardFunc = window.awardCoins || (window.MathQuestApp && window.MathQuestApp.awardCoins);
                    if (typeof awardFunc === 'function') {
                        awardFunc(false, level);
                    }

                    if (score >= 5) {
                        // Completar nivel al juntar 5 respuestas
                        handleLevelComplete();
                    } else {
                        generateNewMathChallenge();
                    }
                } else {
                    // Incorrecto (manzana equivocada)
                    getSoundEngine().playWrong();
                    lives--;
                    updateHeartsDisplay();
                    triggerSnakeDamageFeedback();

                    if (lives <= 0) {
                        handleGameOver();
                    } else {
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
            getSoundEngine().playShield();
            resetSnakePosition();
            updatePowerupButtons();
            return;
        }

        getSoundEngine().playWrong();
        lives--;
        updateHeartsDisplay();
        triggerSnakeDamageFeedback();

        if (lives <= 0) {
            handleGameOver();
        } else {
            resetSnakePosition();
            if (apples.length === 0) {
                spawnApples();
            }
        }
    }

    function resetSnakePosition() {
        dir = 'right';
        snake = [
            { x: 10, y: 10 },
            { x: 9, y: 10 },
            { x: 8, y: 10 }
        ];
    }

    function handleGameOver() {
        stopSnake();

        const appState = getAppState();
        appState.streak = 1;
        const penalty = 20;
        const previousCoins = appState.coins || 0;
        appState.coins = Math.max(0, previousCoins - penalty);
        const lostAmount = previousCoins - appState.coins;

        saveStateAndUpdate();

        const streakEl = document.getElementById('streak-count');
        const coinsEl = document.getElementById('coins-count');
        if (streakEl) streakEl.innerText = appState.streak;
        if (coinsEl) coinsEl.innerText = appState.coins;

        if (overlay) {
            overlay.classList.remove('hidden');
            if (overlayTitle) overlayTitle.innerText = "¡Juego Terminado! 💔";
            if (overlayText) {
                overlayText.style.color = 'var(--color-accent-coral, #ef4444)';
                overlayText.innerHTML = `Mateo está triste... 😢 Te quedaste sin vidas.<br><b>Consecuencias:</b> Tu racha vuelve a 1 y has perdido <b>${lostAmount} MathCoins</b>. ¡Estudia más para mejorar!`;
            }
        }
        if (btnStart) btnStart.innerText = "Reintentar Nivel";
    }

    function handleLevelComplete() {
        stopSnake();

        const appState = getAppState();
        const nextLevelKey = `snake-${level + 1}`;
        if (level < 5 && !appState.unlockedLevels.includes(nextLevelKey)) {
            appState.unlockedLevels.push(nextLevelKey);
        }

        if (level === 5 && !appState.unlockedLevels.includes('slider-1')) {
            appState.unlockedLevels.push('slider-1');
        }

        getSoundEngine().playFanfare();
        const awardFunc = window.awardCoins || (window.MathQuestApp && window.MathQuestApp.awardCoins);
        let coinsAwarded = 0;
        if (typeof awardFunc === 'function') {
            coinsAwarded = awardFunc(true, level);
        }

        saveStateAndUpdate();

        if (overlay) {
            overlay.classList.remove('hidden');
            if (overlayTitle) overlayTitle.innerText = "¡Nivel Completado! 🌟";
            if (overlayText) {
                overlayText.style.color = '';
                overlayText.innerText = `¡Espectacular! Resolviste las 5 ecuaciones. Ganaste +${coinsAwarded} MathCoins.`;
            }
        }
        if (btnStart) btnStart.innerText = level < 5 ? "Siguiente Nivel" : "Volver al Mapa";
    }

    // Detención limpia y exhaustiva de Snake
    function stopSnake() {
        isPlaying = false;

        if (gameInterval) {
            clearInterval(gameInterval);
            gameInterval = null;
        }

        if (speedTimer) {
            clearInterval(speedTimer);
            speedTimer = null;
        }

        if (freezeTimeout) {
            clearTimeout(freezeTimeout);
            freezeTimeout = null;
        }

        if (shakeTimeout) {
            clearTimeout(shakeTimeout);
            shakeTimeout = null;
        }

        isFrozen = false;

        const container = document.querySelector('#screen-snake .game-canvas-area') || canvas;
        if (container) {
            container.classList.remove('snake-shake');
        }
    }

    // --------------------------------------------------------------------------
    // D. Dibujado de Gráficos (Skins Fire, Ice, Rainbow Neón)
    // --------------------------------------------------------------------------
    function draw() {
        // Limpiar canvas
        ctx.fillStyle = '#0f172a';
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
        const appState = getAppState();
        const skin = appState.equippedSkin || 'standard';

        // Dibujar Serpiente
        snake.forEach((segment, idx) => {
            const isHead = idx === 0;

            let fillStyle = '#10b981';
            let shadowStyle = 'rgba(16, 185, 129, 0.4)';

            if (skin === 'fire') {
                fillStyle = isHead ? '#ef4444' : '#f97316';
                shadowStyle = 'rgba(239, 68, 68, 0.6)';
            } else if (skin === 'ice') {
                fillStyle = isHead ? '#3b82f6' : '#06b6d4';
                shadowStyle = 'rgba(6, 182, 212, 0.6)';
            } else if (skin === 'rainbow') {
                const hue = (Date.now() / 15 + idx * 15) % 360;
                fillStyle = `hsl(${hue}, 90%, 60%)`;
                shadowStyle = `hsla(${hue}, 90%, 60%, 0.5)`;
            }

            ctx.shadowBlur = 10;
            ctx.shadowColor = shadowStyle;
            ctx.fillStyle = fillStyle;

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

        ctx.shadowBlur = 0;

        // Dibujar Manzanas
        apples.forEach(apple => {
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.arc(apple.x * gridSize + gridSize/2, apple.y * gridSize + gridSize/2, gridSize/2 - 1, 0, Math.PI * 2);
            ctx.fill();

            // Tallo verde/marrón
            ctx.fillStyle = '#a16207';
            ctx.fillRect(apple.x * gridSize + gridSize/2 - 1, apple.y * gridSize + 1, 2, 4);

            // Resaltar con pista
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

            // Valor numérico de la manzana
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 11px Fredoka, sans-serif';
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

    window.handleSnakeDirection = function(newDir) {
        if (!isPlaying) return;
        if (newDir === 'up' && dir === 'down') return;
        if (newDir === 'down' && dir === 'up') return;
        if (newDir === 'left' && dir === 'right') return;
        if (newDir === 'right' && dir === 'left') return;
        dir = newDir;
    };

    function useSnakeHint() {
        const correctApple = apples.find(a => a.isCorrect);
        if (correctApple) {
            correctApple.hintHighlighted = true;
            draw();
            return true;
        }
        return false;
    }
    window.useSnakeHint = useSnakeHint;

    // Listeners de UI
    if (btnStart) {
        btnStart.addEventListener('click', () => {
            getSoundEngine().playClick();
            if (lives <= 0 || score >= 5) {
                if (level < 5 && score >= 5) {
                    initGame(level + 1);
                } else if (level === 5 && score >= 5) {
                    const backBtn = document.getElementById('btn-back-menu');
                    if (backBtn) backBtn.click();
                    return;
                } else {
                    initGame(level);
                }
            }
            startGameLoop();
        });
    }

    if (btnRestart) {
        btnRestart.addEventListener('click', () => {
            getSoundEngine().playClick();
            initGame(level);
        });
    }

    // Controles táctiles D-Pad
    const ctrlUp = document.getElementById('ctrl-up');
    const ctrlDown = document.getElementById('ctrl-down');
    const ctrlLeft = document.getElementById('ctrl-left');
    const ctrlRight = document.getElementById('ctrl-right');

    if (ctrlUp) ctrlUp.addEventListener('click', () => window.handleSnakeDirection('up'));
    if (ctrlDown) ctrlDown.addEventListener('click', () => window.handleSnakeDirection('down'));
    if (ctrlLeft) ctrlLeft.addEventListener('click', () => window.handleSnakeDirection('left'));
    if (ctrlRight) ctrlRight.addEventListener('click', () => window.handleSnakeDirection('right'));

    // --------------------------------------------------------------------------
    // F. Registro en MathQuestGames y exportaciones
    // --------------------------------------------------------------------------
    const SnakeGameModule = {
        name: 'Ecuación-Snake',
        icon: '🐍',
        topic: 'algebra',
        screenId: 'screen-snake',
        start: function(gameLevel) {
            initGame(gameLevel);
        },
        stop: function() {
            stopSnake();
        },
        useHint: function() {
            return useSnakeHint();
        }
    };

    window.MathQuestGames['snake'] = SnakeGameModule;

    // Exportaciones de compatibilidad legacy
    window.startSnakeGame = function(gameLevel) {
        initGame(gameLevel);
    };

    window.stopSnakeGame = function() {
        stopSnake();
    };

    // Registro seguro en el dispatcher global de stop de app.js
    if (typeof window.stopAllGames === 'function') {
        window.stopAllGames = stopSnake;
    }

})();
