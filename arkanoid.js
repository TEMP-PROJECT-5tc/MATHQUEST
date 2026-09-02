/* ==========================================================================
   MathQuest V3 - Módulo Math-Arkanoid (Rompeladrillos Matemático)
   Juego estilo Breakout/Arkanoid con físicas de rebote, ladrillos con operaciones,
   ecuaciones algebraicas, ángulos, múltiplos, power-ups y soporte de pistas.
   ========================================================================== */

(function() {
    const canvas = document.getElementById('arkanoid-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const overlay = document.getElementById('arkanoid-overlay');
    const overlayTitle = document.getElementById('arkanoid-overlay-title');
    const overlayText = document.getElementById('arkanoid-overlay-text');
    const btnStart = document.getElementById('btn-start-arkanoid-game');
    const btnRestart = document.getElementById('btn-restart-arkanoid');
    const scoreVal = document.getElementById('arkanoid-score');
    const heartsBox = document.getElementById('arkanoid-hearts-box');
    const equationPromptEl = document.getElementById('arkanoid-equation-prompt');
    const equationBoxEl = document.getElementById('arkanoid-equation');
    const targetCounterEl = document.getElementById('arkanoid-targets-count');

    // Estado del juego
    let level = 1;
    let score = 0;
    let lives = 3;
    let isPlaying = false;
    let isLaunched = false;
    let animationFrameId = null;
    let isFrozen = false;
    let freezeTimeout = null;
    let arkanoidHasShield = false; // Barrera inferior protectora
    let laserPowerActive = false;
    let laserTimeout = null;

    // Paleta (Paddle)
    const paddle = {
        width: 100,
        baseWidth: 100,
        height: 14,
        x: (canvas.width - 100) / 2,
        y: canvas.height - 30,
        speed: 8,
        dx: 0,
        color: '#38bdf8'
    };

    // Bolas (Soporte de Multibola)
    let balls = []; // [{ x, y, radius: 7, dx: 4, dy: -4, speed: 5, isFireball: false }]

    // Ladrillos (Bricks)
    let bricks = [];
    const brickConfig = {
        rowCount: 4,
        colCount: 6,
        width: 62,
        height: 28,
        padding: 8,
        offsetTop: 40,
        offsetLeft: 15
    };

    // Partículas visuales
    let particles = [];

    // Power-ups cayendo
    let fallingPowerups = []; // [{ x, y, type: 'wide'|'multiball'|'fire'|'heart', dy: 2, icon: '🏓' }]

    // Desafío matemático actual
    let currentChallenge = null;
    let remainingTargetBricks = 0;
    let hintActive = false;
    let hintPulse = 0;

    // --------------------------------------------------------------------------
    // 1. Generador Matemático Específico de Arkanoid
    // --------------------------------------------------------------------------
    function generateArkanoidChallenge(gameLevel) {
        hintActive = false;
        let promptText = "Resuelve la operación:";
        let formulaLaTeX = "";
        let targetAnswer = null;
        let brickValues = []; // Array de { text: string, isTarget: boolean, latexDisplay: string }

        const totalBricks = brickConfig.rowCount * brickConfig.colCount; // 24 ladrillos

        switch (gameLevel) {
            case 1: {
                // NIVEL 1: Tablas de Multiplicar y Sumas Rápidas
                const num1 = Math.floor(Math.random() * 7) + 3; // 3 a 9
                const num2 = Math.floor(Math.random() * 8) + 2; // 2 a 9
                targetAnswer = num1 * num2;
                promptText = "Destruye los bloques con el resultado exacto:";
                formulaLaTeX = `${num1} \\times ${num2} = ?`;

                // Colocar 4 a 6 ladrillos objetivo con targetAnswer, el resto distractores cercanos
                const targetPositions = pickRandomIndices(totalBricks, 4);
                
                for (let i = 0; i < totalBricks; i++) {
                    if (targetPositions.includes(i)) {
                        brickValues.push({ text: `${targetAnswer}`, isTarget: true, value: targetAnswer });
                    } else {
                        // Distractor
                        let offset = (Math.floor(Math.random() * 7) - 3) * (Math.random() > 0.5 ? 2 : 5);
                        if (offset === 0) offset = 4;
                        let fakeAns = targetAnswer + offset;
                        if (fakeAns <= 0) fakeAns = targetAnswer + 6;
                        brickValues.push({ text: `${fakeAns}`, isTarget: false, value: fakeAns });
                    }
                }
                break;
            }

            case 2: {
                // NIVEL 2: Ecuaciones Lineales Básicas (Halla x)
                const a = Math.floor(Math.random() * 3) + 2; // 2 a 4
                const xVal = Math.floor(Math.random() * 7) + 2; // 2 a 8
                const b = Math.floor(Math.random() * 6) + 1; // 1 a 6
                const result = a * xVal + b;
                targetAnswer = xVal;
                promptText = "Despeja x y rompe los ladrillos correspondientes:";
                formulaLaTeX = `${a}x + ${b} = ${result}`;

                const targetPositions = pickRandomIndices(totalBricks, 5);
                for (let i = 0; i < totalBricks; i++) {
                    if (targetPositions.includes(i)) {
                        brickValues.push({ text: `x = ${targetAnswer}`, isTarget: true, value: targetAnswer });
                    } else {
                        let fakeX = (targetAnswer + Math.floor(Math.random() * 6) - 3);
                        if (fakeX === targetAnswer || fakeX <= 0) fakeX = targetAnswer + 2;
                        brickValues.push({ text: `x = ${fakeX}`, isTarget: false, value: fakeX });
                    }
                }
                break;
            }

            case 3: {
                // NIVEL 3: Múltiplos y Divisores
                const divisor = [3, 4, 6, 7, 8][Math.floor(Math.random() * 5)];
                promptText = `¡Rompe todos los ladrillos que sean múltiplos de ${divisor}!`;
                formulaLaTeX = `\\text{Múltiplos de } ${divisor}`;
                targetAnswer = divisor;

                // 6 ladrillos múltiplos
                const targetPositions = pickRandomIndices(totalBricks, 6);
                for (let i = 0; i < totalBricks; i++) {
                    if (targetPositions.includes(i)) {
                        const multFactor = Math.floor(Math.random() * 9) + 2; // 2 a 10
                        const val = divisor * multFactor;
                        brickValues.push({ text: `${val}`, isTarget: true, value: val });
                    } else {
                        // Número no divisible por divisor
                        let notMult = Math.floor(Math.random() * 40) + 10;
                        if (notMult % divisor === 0) notMult += 1;
                        brickValues.push({ text: `${notMult}`, isTarget: false, value: notMult });
                    }
                }
                break;
            }

            case 4: {
                // NIVEL 4: Geometría & Ángulos Complementarios / Suplementarios
                const isComplementary = Math.random() > 0.5;
                if (isComplementary) {
                    const angleA = [25, 30, 35, 40, 45, 50, 60][Math.floor(Math.random() * 7)];
                    targetAnswer = 90 - angleA;
                    promptText = `Halla el ángulo complementario (suma 90°) de ${angleA}°:`;
                    formulaLaTeX = `90^\\circ - ${angleA}^\\circ = ?`;
                } else {
                    const angleA = [60, 70, 80, 100, 110, 120, 130][Math.floor(Math.random() * 7)];
                    targetAnswer = 180 - angleA;
                    promptText = `Halla el ángulo suplementario (suma 180°) de ${angleA}°:`;
                    formulaLaTeX = `180^\\circ - ${angleA}^\\circ = ?`;
                }

                const targetPositions = pickRandomIndices(totalBricks, 5);
                for (let i = 0; i < totalBricks; i++) {
                    if (targetPositions.includes(i)) {
                        brickValues.push({ text: `${targetAnswer}°`, isTarget: true, value: targetAnswer });
                    } else {
                        let fake = targetAnswer + (Math.floor(Math.random() * 5) - 2) * 10;
                        if (fake === targetAnswer || fake <= 0 || fake >= 180) fake = targetAnswer + 15;
                        brickValues.push({ text: `${fake}°`, isTarget: false, value: fake });
                    }
                }
                break;
            }

            case 5:
            default: {
                // NIVEL 5 (Reto Maestro): Fracciones Equivalentes y Potencias
                const baseFractions = [
                    { targetText: "1/2", val: 0.5, correct: ["2/4", "3/6", "4/8", "5/10", "50%"], fake: ["1/3", "2/5", "3/4", "1/4", "60%"] },
                    { targetText: "3/4", val: 0.75, correct: ["6/8", "9/12", "75%", "15/20"], fake: ["1/2", "2/3", "4/5", "50%"] },
                    { targetText: "2/5", val: 0.4, correct: ["4/10", "6/15", "40%", "8/20"], fake: ["1/2", "3/5", "2/3", "25%"] }
                ];
                const selectedSet = baseFractions[Math.floor(Math.random() * baseFractions.length)];
                promptText = "Rompe las fracciones y porcentajes equivalentes a:";
                formulaLaTeX = `\\text{Equivalente a } ${selectedSet.targetText}`;
                targetAnswer = selectedSet.targetText;

                const targetPositions = pickRandomIndices(totalBricks, 6);
                for (let i = 0; i < totalBricks; i++) {
                    if (targetPositions.includes(i)) {
                        const textVal = selectedSet.correct[Math.floor(Math.random() * selectedSet.correct.length)];
                        brickValues.push({ text: textVal, isTarget: true, value: textVal });
                    } else {
                        const fakeVal = selectedSet.fake[Math.floor(Math.random() * selectedSet.fake.length)];
                        brickValues.push({ text: fakeVal, isTarget: false, value: fakeVal });
                    }
                }
                break;
            }
        }

        // Construir la matriz de ladrillos
        bricks = [];
        remainingTargetBricks = 0;
        let index = 0;
        for (let r = 0; r < brickConfig.rowCount; r++) {
            bricks[r] = [];
            for (let c = 0; c < brickConfig.colCount; c++) {
                const info = brickValues[index] || { text: '1', isTarget: false, value: 1 };
                if (info.isTarget) remainingTargetBricks++;

                // Asignar colores vibrantes por fila
                const rowColors = [
                    { bg: '#3b82f6', border: '#60a5fa', text: '#ffffff' }, // Azul
                    { bg: '#8b5cf6', border: '#a78bfa', text: '#ffffff' }, // Morado
                    { bg: '#10b981', border: '#34d399', text: '#ffffff' }, // Esmeralda
                    { bg: '#f59e0b', border: '#fbbf24', text: '#0f172a' }  // Ámbar
                ];
                const colorScheme = rowColors[r % rowColors.length];

                // Probabilidad de tener power-up escondido (25%)
                const hasPowerup = Math.random() < 0.25;
                const powerupType = ['wide', 'multiball', 'fire', 'heart'][Math.floor(Math.random() * 4)];

                bricks[r][c] = {
                    x: brickConfig.offsetLeft + c * (brickConfig.width + brickConfig.padding),
                    y: brickConfig.offsetTop + r * (brickConfig.height + brickConfig.padding),
                    status: 1, // 1 = activo, 0 = roto
                    isTarget: info.isTarget,
                    text: info.text,
                    value: info.value,
                    color: colorScheme.bg,
                    borderColor: colorScheme.border,
                    textColor: colorScheme.text,
                    hitsRequired: (gameLevel >= 4 && !info.isTarget) ? 2 : 1, // Bloques resistentes en niveles altos
                    currentHits: 0,
                    hasPowerup,
                    powerupType
                };
                index++;
            }
        }

        currentChallenge = {
            promptText,
            formulaLaTeX,
            targetAnswer,
            totalTargets: remainingTargetBricks
        };

        // Renderizar KaTeX en la UI
        if (equationPromptEl) equationPromptEl.innerText = promptText;
        if (equationBoxEl && window.MathQuestApp) {
            window.MathQuestApp.renderLaTeX(formulaLaTeX, equationBoxEl);
        }
        updateTargetCounterDisplay();
    }

    function pickRandomIndices(total, count) {
        const indices = [];
        for (let i = 0; i < total; i++) indices.push(i);
        indices.sort(() => Math.random() - 0.5);
        return indices.slice(0, count);
    }

    function updateTargetCounterDisplay() {
        if (targetCounterEl) {
            targetCounterEl.innerText = remainingTargetBricks;
        }
    }

    // --------------------------------------------------------------------------
    // 2. Vidas y UI
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

    function resetBallAndPaddle() {
        paddle.width = paddle.baseWidth;
        paddle.x = (canvas.width - paddle.width) / 2;
        paddle.dx = 0;

        const baseSpeed = 4.2 + (level * 0.4);
        balls = [{
            x: canvas.width / 2,
            y: paddle.y - 12,
            radius: 7,
            dx: (Math.random() > 0.5 ? 1 : -1) * (baseSpeed * 0.7),
            dy: -baseSpeed,
            speed: baseSpeed,
            isFireball: laserPowerActive
        }];
        isLaunched = false;
    }

    // --------------------------------------------------------------------------
    // 3. Inicialización del Juego
    // --------------------------------------------------------------------------
    function initGame(gameLevel) {
        level = gameLevel || 1;
        score = 0;
        lives = 3;
        isPlaying = false;
        isLaunched = false;
        isFrozen = false;
        laserPowerActive = false;
        arkanoidHasShield = false;
        particles = [];
        fallingPowerups = [];

        if (freezeTimeout) clearTimeout(freezeTimeout);
        if (laserTimeout) clearTimeout(laserTimeout);

        if (scoreVal) scoreVal.innerText = score;
        updateHeartsDisplay();

        generateArkanoidChallenge(level);
        resetBallAndPaddle();

        if (overlay) overlay.classList.remove('hidden');
        if (overlayTitle) overlayTitle.innerText = `Math-Arkanoid - Nivel ${level} 🚀`;
        if (overlayText) overlayText.innerText = `Controla la paleta con el Ratón, Flechas o Botones. ¡Destruye todos los ${remainingTargetBricks} ladrillos objetivo para ganar!`;
        if (btnStart) btnStart.innerText = "¡Lanzar Bola!";

        draw();
        injectPowerupButtons();
    }

    function injectPowerupButtons() {
        const sidebar = document.querySelector('#screen-arkanoid .game-sidebar');
        if (!sidebar) return;

        const oldPanel = document.getElementById('arkanoid-inventory-panel');
        if (oldPanel) oldPanel.remove();

        const invPanel = document.createElement('div');
        invPanel.id = 'arkanoid-inventory-panel';
        invPanel.style.marginTop = '15px';
        invPanel.style.padding = '10px';
        invPanel.style.border = '2px dashed var(--color-border)';
        invPanel.style.borderRadius = 'var(--border-radius-medium)';
        invPanel.style.background = 'var(--color-card-secondary)';

        const appState = window.MathQuestApp ? window.MathQuestApp.state : { inventory: { shield: 0, freeze: 0 } };
        const shieldCount = appState.inventory.shield || 0;
        const freezeCount = appState.inventory.freeze || 0;

        invPanel.innerHTML = `
            <h4 style="font-size:0.85rem; margin-bottom:8px; font-family:var(--font-heading); color:var(--color-accent-yellow);">🎒 Objetos de la Tienda:</h4>
            <div style="display:flex; gap:8px;">
                <button id="btn-use-shield-arkanoid" class="btn btn-secondary" style="flex:1; padding:6px; font-size:0.75rem;" ${shieldCount <= 0 ? 'disabled' : ''}>
                    🛡️ Escudo (${shieldCount})
                </button>
                <button id="btn-use-freeze-arkanoid" class="btn btn-secondary" style="flex:1; padding:6px; font-size:0.75rem;" ${freezeCount <= 0 ? 'disabled' : ''}>
                    ⏱️ Congelar (${freezeCount})
                </button>
            </div>
        `;

        sidebar.appendChild(invPanel);

        // Listeners
        const shieldBtn = document.getElementById('btn-use-shield-arkanoid');
        const freezeBtn = document.getElementById('btn-use-freeze-arkanoid');

        if (shieldBtn) {
            shieldBtn.addEventListener('click', () => {
                if (appState.inventory.shield > 0) {
                    appState.inventory.shield--;
                    if (window.MathQuestApp) window.MathQuestApp.SoundEngine.playShield();
                    arkanoidHasShield = true;
                    saveStateAndUpdate();
                    injectPowerupButtons();
                }
            });
        }

        if (freezeBtn) {
            freezeBtn.addEventListener('click', () => {
                if (appState.inventory.freeze > 0) {
                    appState.inventory.freeze--;
                    if (window.MathQuestApp) window.MathQuestApp.SoundEngine.playTimeFreeze();
                    triggerTimeFreeze();
                    saveStateAndUpdate();
                    injectPowerupButtons();
                }
            });
        }
    }

    function triggerTimeFreeze() {
        isFrozen = true;
        balls.forEach(b => {
            b.dx *= 0.5;
            b.dy *= 0.5;
        });

        if (freezeTimeout) clearTimeout(freezeTimeout);
        freezeTimeout = setTimeout(() => {
            isFrozen = false;
            balls.forEach(b => {
                b.dx *= 2;
                b.dy *= 2;
            });
        }, 10000);
    }

    function saveStateAndUpdate() {
        if (window.MathQuestApp && typeof window.saveStateToStorage === 'function') {
            window.saveStateToStorage();
        }
        if (window.updateHeaderStats) window.updateHeaderStats();
    }

    // --------------------------------------------------------------------------
    // 4. Bucle Principal y Físicas
    // --------------------------------------------------------------------------
    function update() {
        if (!isPlaying) return;

        // Mover paleta con teclado / botones táctiles
        paddle.x += paddle.dx;
        if (paddle.x < 0) paddle.x = 0;
        if (paddle.x + paddle.width > canvas.width) paddle.x = canvas.width - paddle.width;

        // Si la bola no se ha lanzado, sigue a la paleta
        if (!isLaunched) {
            if (balls.length > 0) {
                balls[0].x = paddle.x + paddle.width / 2;
                balls[0].y = paddle.y - balls[0].radius - 2;
            }
        } else {
            // Mover bolas
            for (let i = balls.length - 1; i >= 0; i--) {
                const ball = balls[i];
                ball.x += ball.dx;
                ball.y += ball.dy;

                // Crear estela de partículas
                if (Math.random() < 0.4) {
                    particles.push({
                        x: ball.x,
                        y: ball.y,
                        radius: Math.random() * 3 + 1,
                        color: ball.isFireball ? '#f97316' : '#38bdf8',
                        alpha: 0.8,
                        life: 20
                    });
                }

                // Rebote con paredes laterales
                if (ball.x + ball.radius > canvas.width) {
                    ball.x = canvas.width - ball.radius;
                    ball.dx = -Math.abs(ball.dx);
                    if (window.MathQuestApp) window.MathQuestApp.SoundEngine.playTone(320, 'sine', 0.05, 0.08);
                } else if (ball.x - ball.radius < 0) {
                    ball.x = ball.radius;
                    ball.dx = Math.abs(ball.dx);
                    if (window.MathQuestApp) window.MathQuestApp.SoundEngine.playTone(320, 'sine', 0.05, 0.08);
                }

                // Rebote con techo superior
                if (ball.y - ball.radius < 0) {
                    ball.y = ball.radius;
                    ball.dy = Math.abs(ball.dy);
                    if (window.MathQuestApp) window.MathQuestApp.SoundEngine.playTone(350, 'sine', 0.05, 0.08);
                }

                // Colisión con la paleta
                if (
                    ball.y + ball.radius >= paddle.y &&
                    ball.y - ball.radius <= paddle.y + paddle.height &&
                    ball.x >= paddle.x &&
                    ball.x <= paddle.x + paddle.width &&
                    ball.dy > 0
                ) {
                    // Calcular ángulo de desvío según dónde golpea la paleta
                    const hitPoint = (ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2);
                    const maxAngle = Math.PI / 3; // 60 grados max
                    const bounceAngle = hitPoint * maxAngle;
                    
                    const speed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
                    ball.dx = speed * Math.sin(bounceAngle);
                    ball.dy = -speed * Math.cos(bounceAngle);

                    if (window.MathQuestApp) window.MathQuestApp.SoundEngine.playTone(440, 'triangle', 0.08, 0.12);

                    // Pequeñas chispas en la paleta
                    for (let p = 0; p < 6; p++) {
                        particles.push({
                            x: ball.x,
                            y: paddle.y,
                            radius: Math.random() * 2 + 1,
                            color: '#38bdf8',
                            alpha: 1,
                            life: 15,
                            dx: (Math.random() - 0.5) * 4,
                            dy: -Math.random() * 3
                        });
                    }
                }

                // Colisión con ladrillos
                checkBrickCollision(ball);

                // Bola cae al fondo
                if (ball.y - ball.radius > canvas.height) {
                    // Si el Súper Escudo está activo, crea un piso láser que rebota la bola
                    if (arkanoidHasShield) {
                        arkanoidHasShield = false;
                        ball.y = canvas.height - ball.radius - 8;
                        ball.dy = -Math.abs(ball.dy);
                        if (window.MathQuestApp) window.MathQuestApp.SoundEngine.playShield();
                        createFloorLaserBurst();
                    } else {
                        // Eliminar esta bola
                        balls.splice(i, 1);
                    }
                }
            }

            // Si se perdieron todas las bolas
            if (balls.length === 0) {
                handleLifeLoss();
            }
        }

        // Actualizar Power-ups cayendo
        for (let p = fallingPowerups.length - 1; p >= 0; p--) {
            const pow = fallingPowerups[p];
            pow.y += pow.dy;

            // Recoger power-up con la paleta
            if (
                pow.y + 12 >= paddle.y &&
                pow.y - 12 <= paddle.y + paddle.height &&
                pow.x >= paddle.x &&
                pow.x <= paddle.x + paddle.width
            ) {
                applyPowerup(pow.type);
                fallingPowerups.splice(p, 1);
                continue;
            }

            // Si cae al vacío
            if (pow.y > canvas.height) {
                fallingPowerups.splice(p, 1);
            }
        }

        // Actualizar partículas
        for (let i = particles.length - 1; i >= 0; i--) {
            const pt = particles[i];
            pt.life--;
            pt.alpha = pt.life / 20;
            if (pt.dx) pt.x += pt.dx;
            if (pt.dy) pt.y += pt.dy;

            if (pt.life <= 0) {
                particles.splice(i, 1);
            }
        }

        // Victoria si no quedan ladrillos objetivo
        if (remainingTargetBricks <= 0 && isPlaying) {
            handleLevelVictory();
            return;
        }

        draw();
        animationFrameId = requestAnimationFrame(update);
    }

    // Colisión de bola con ladrillos
    function checkBrickCollision(ball) {
        for (let r = 0; r < brickConfig.rowCount; r++) {
            for (let c = 0; c < brickConfig.colCount; c++) {
                const b = bricks[r][c];
                if (b.status === 1) {
                    if (
                        ball.x + ball.radius > b.x &&
                        ball.x - ball.radius < b.x + brickConfig.width &&
                        ball.y + ball.radius > b.y &&
                        ball.y - ball.radius < b.y + brickConfig.height
                    ) {
                        // Si no es bola de fuego, rebotar
                        if (!ball.isFireball) {
                            // Detectar si el choque fue lateral o vertical
                            const prevX = ball.x - ball.dx;
                            const prevY = ball.y - ball.dy;

                            if (prevY + ball.radius <= b.y || prevY - ball.radius >= b.y + brickConfig.height) {
                                ball.dy = -ball.dy;
                            } else {
                                ball.dx = -ball.dx;
                            }
                        }

                        b.currentHits++;

                        // Destruir ladrillo si cumplió los golpes requeridos
                        if (b.currentHits >= b.hitsRequired) {
                            b.status = 0;
                            createBrickExplosion(b);

                            if (b.isTarget) {
                                // ¡Ladrillo objetivo acertado!
                                remainingTargetBricks--;
                                score += 50;
                                updateTargetCounterDisplay();
                                if (window.MathQuestApp) window.MathQuestApp.SoundEngine.playCorrect();

                                // Explosión dorada de éxito
                                for (let k = 0; k < 12; k++) {
                                    particles.push({
                                        x: b.x + brickConfig.width / 2,
                                        y: b.y + brickConfig.height / 2,
                                        radius: Math.random() * 4 + 2,
                                        color: '#fbbf24',
                                        alpha: 1,
                                        life: 25,
                                        dx: (Math.random() - 0.5) * 6,
                                        dy: (Math.random() - 0.5) * 6
                                    });
                                }
                            } else {
                                // Ladrillo distractor roto
                                score += 10;
                                if (window.MathQuestApp) window.MathQuestApp.SoundEngine.playTone(580, 'sine', 0.08, 0.1);
                            }

                            // Posibilidad de soltar Power-up
                            if (b.hasPowerup) {
                                spawnPowerup(b.x + brickConfig.width / 2, b.y + brickConfig.height / 2, b.powerupType);
                            }
                        } else {
                            // Bloque golpeado pero aún no roto
                            if (window.MathQuestApp) window.MathQuestApp.SoundEngine.playTone(300, 'square', 0.08, 0.1);
                        }

                        if (scoreVal) scoreVal.innerText = score;
                        return;
                    }
                }
            }
        }
    }

    function createBrickExplosion(b) {
        for (let i = 0; i < 8; i++) {
            particles.push({
                x: b.x + brickConfig.width / 2,
                y: b.y + brickConfig.height / 2,
                radius: Math.random() * 3 + 1,
                color: b.color,
                alpha: 1,
                life: 20,
                dx: (Math.random() - 0.5) * 5,
                dy: (Math.random() - 0.5) * 5
            });
        }
    }

    function createFloorLaserBurst() {
        for (let x = 0; x < canvas.width; x += 15) {
            particles.push({
                x: x,
                y: canvas.height - 10,
                radius: Math.random() * 4 + 2,
                color: '#10b981',
                alpha: 1,
                life: 25,
                dx: (Math.random() - 0.5) * 2,
                dy: -Math.random() * 4 - 2
            });
        }
    }

    function spawnPowerup(x, y, type) {
        const icons = {
            'wide': '🏓',
            'multiball': '⚡',
            'fire': '🔥',
            'heart': '❤️'
        };
        fallingPowerups.push({
            x,
            y,
            type,
            icon: icons[type] || '⭐',
            dy: 2.2
        });
    }

    function applyPowerup(type) {
        if (window.MathQuestApp) window.MathQuestApp.SoundEngine.playFanfare();

        switch (type) {
            case 'wide':
                paddle.width = 140;
                setTimeout(() => { paddle.width = paddle.baseWidth; }, 12000);
                break;
            case 'multiball':
                if (balls.length > 0) {
                    const b = balls[0];
                    balls.push({
                        x: b.x,
                        y: b.y,
                        radius: 7,
                        dx: b.dx * 0.8 + 2,
                        dy: b.dy,
                        speed: b.speed,
                        isFireball: laserPowerActive
                    });
                    balls.push({
                        x: b.x,
                        y: b.y,
                        radius: 7,
                        dx: b.dx * 0.8 - 2,
                        dy: b.dy,
                        speed: b.speed,
                        isFireball: laserPowerActive
                    });
                }
                break;
            case 'fire':
                laserPowerActive = true;
                balls.forEach(b => b.isFireball = true);
                if (laserTimeout) clearTimeout(laserTimeout);
                laserTimeout = setTimeout(() => {
                    laserPowerActive = false;
                    balls.forEach(b => b.isFireball = false);
                }, 8000);
                break;
            case 'heart':
                if (lives < 3) {
                    lives++;
                    updateHeartsDisplay();
                }
                break;
        }
    }

    // --------------------------------------------------------------------------
    // 5. Manejo de Vidas y Game Over
    // --------------------------------------------------------------------------
    function handleLifeLoss() {
        lives--;
        updateHeartsDisplay();
        if (window.MathQuestApp) window.MathQuestApp.SoundEngine.playExplosion();

        if (lives <= 0) {
            isPlaying = false;
            if (animationFrameId) cancelAnimationFrame(animationFrameId);

            if (overlay) overlay.classList.remove('hidden');
            if (overlayTitle) overlayTitle.innerText = "¡Partida Terminada! 💥";
            if (overlayText) overlayText.innerText = "Te has quedado sin corazones. ¡No te rindas y vuelve a intentarlo!";
            if (btnStart) btnStart.innerText = "Reintentar Nivel";
        } else {
            resetBallAndPaddle();
        }
    }

    function handleLevelVictory() {
        isPlaying = false;
        if (animationFrameId) cancelAnimationFrame(animationFrameId);

        if (window.MathQuestApp) {
            window.MathQuestApp.SoundEngine.playFanfare();
            const earnedCoins = window.MathQuestApp.awardCoins(true, level);
            triggerVictoryConfetti();

            // Desbloquear siguiente nivel
            const appState = window.MathQuestApp.state;
            const nextKey = `arkanoid-${level + 1}`;
            if (level < 5 && !appState.unlockedLevels.includes(nextKey)) {
                appState.unlockedLevels.push(nextKey);
            }

            if (overlay) overlay.classList.remove('hidden');
            if (overlayTitle) overlayTitle.innerText = `¡Nivel ${level} Completado! 🎉`;
            if (overlayText) {
                overlayText.innerHTML = `
                    ¡Brillante destreza matemática! Rompiste todos los bloques objetivo.<br>
                    <strong>+${earnedCoins} MathCoins ganadas 🪙</strong> | <strong>+3 ⭐ Estrellas</strong>
                `;
            }

            if (level < 5) {
                if (btnStart) btnStart.innerText = `Pasar al Nivel ${level + 1} 🚀`;
            } else {
                if (btnStart) btnStart.innerText = "¡Volver al Menú Principal!";
            }
        }
    }

    function triggerVictoryConfetti() {
        const cCanvas = document.getElementById('confetti-canvas');
        if (!cCanvas) return;
        const cCtx = cCanvas.getContext('2d');
        cCanvas.width = window.innerWidth;
        cCanvas.height = window.innerHeight;

        const confettis = [];
        const colors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];
        for (let i = 0; i < 80; i++) {
            confettis.push({
                x: Math.random() * cCanvas.width,
                y: Math.random() * cCanvas.height - cCanvas.height,
                size: Math.random() * 8 + 4,
                color: colors[Math.floor(Math.random() * colors.length)],
                dy: Math.random() * 4 + 2,
                dx: (Math.random() - 0.5) * 2,
                rot: Math.random() * 360
            });
        }

        let frames = 0;
        function renderConfetti() {
            cCtx.clearRect(0, 0, cCanvas.width, cCanvas.height);
            confettis.forEach(c => {
                c.y += c.dy;
                c.x += c.dx;
                c.rot += 4;
                cCtx.fillStyle = c.color;
                cCtx.save();
                cCtx.translate(c.x, c.y);
                cCtx.rotate((c.rot * Math.PI) / 180);
                cCtx.fillRect(-c.size / 2, -c.size / 2, c.size, c.size);
                cCtx.restore();
            });

            frames++;
            if (frames < 120) {
                requestAnimationFrame(renderConfetti);
            } else {
                cCtx.clearRect(0, 0, cCanvas.width, cCanvas.height);
            }
        }
        renderConfetti();
    }

    // --------------------------------------------------------------------------
    // 6. Motor de Renderizado en Canvas
    // --------------------------------------------------------------------------
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Fondo con cuadrícula sutil futurista
        ctx.fillStyle = '#0b0f19';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.lineWidth = 1;
        const gridStep = 30;
        for (let x = 0; x < canvas.width; x += gridStep) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
        for (let y = 0; y < canvas.height; y += gridStep) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }

        // Dibujar Barrera de Piso (Si el Escudo está activo)
        if (arkanoidHasShield) {
            ctx.save();
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 4;
            ctx.shadowColor = '#10b981';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.moveTo(0, canvas.height - 4);
            ctx.lineTo(canvas.width, canvas.height - 4);
            ctx.stroke();
            ctx.restore();
        }

        // Dibujar Ladrillos
        hintPulse = (hintPulse + 0.08) % (Math.PI * 2);
        for (let r = 0; r < brickConfig.rowCount; r++) {
            for (let c = 0; c < brickConfig.colCount; c++) {
                const b = bricks[r][c];
                if (b.status === 1) {
                    ctx.save();

                    // Si la pista está activa y es target, animar brillo dorado
                    if (hintActive && b.isTarget) {
                        ctx.shadowColor = '#fbbf24';
                        ctx.shadowBlur = 15 + Math.sin(hintPulse) * 8;
                        ctx.strokeStyle = '#fbbf24';
                        ctx.lineWidth = 3;
                    } else {
                        ctx.shadowColor = b.borderColor;
                        ctx.shadowBlur = 4;
                        ctx.strokeStyle = b.borderColor;
                        ctx.lineWidth = 1.5;
                    }

                    // Fondo del ladrillo
                    ctx.fillStyle = b.color;
                    roundRect(ctx, b.x, b.y, brickConfig.width, brickConfig.height, 6, true, true);

                    // Indicador de Ladrillo Objetivo (pequeña estrella en la esquina)
                    if (b.isTarget) {
                        ctx.fillStyle = '#fbbf24';
                        ctx.font = '10px sans-serif';
                        ctx.fillText('★', b.x + 4, b.y + 11);
                    }

                    // Texto matemático del ladrillo
                    ctx.fillStyle = b.textColor;
                    ctx.font = 'bold 11.5px Outfit, Fredoka, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(b.text, b.x + brickConfig.width / 2, b.y + brickConfig.height / 2 + 1);

                    ctx.restore();
                }
            }
        }

        // Dibujar Power-ups cayendo
        fallingPowerups.forEach(pow => {
            ctx.save();
            ctx.font = '16px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = '#fbbf24';
            ctx.shadowBlur = 8;
            ctx.fillText(pow.icon, pow.x, pow.y);
            ctx.restore();
        });

        // Dibujar Partículas
        particles.forEach(pt => {
            ctx.save();
            ctx.globalAlpha = pt.alpha;
            ctx.fillStyle = pt.color;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });

        // Dibujar Paleta
        ctx.save();
        ctx.fillStyle = paddle.color;
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 12;
        roundRect(ctx, paddle.x, paddle.y, paddle.width, paddle.height, 7, true, false);

        // Detalle de luz en la paleta
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        roundRect(ctx, paddle.x + 6, paddle.y + 2, paddle.width - 12, 3, 2, true, false);
        ctx.restore();

        // Dibujar Bolas
        balls.forEach(ball => {
            ctx.save();
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
            
            if (ball.isFireball) {
                ctx.fillStyle = '#f97316';
                ctx.shadowColor = '#f97316';
                ctx.shadowBlur = 18;
            } else {
                ctx.fillStyle = '#ffffff';
                ctx.shadowColor = '#38bdf8';
                ctx.shadowBlur = 12;
            }
            ctx.fill();

            // Centro brillante
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, ball.radius * 0.5, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.restore();
        });
    }

    function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
        if (typeof radius === 'undefined') radius = 5;
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        if (fill) ctx.fill();
        if (stroke) ctx.stroke();
    }

    // --------------------------------------------------------------------------
    // 7. Controles e Interacción
    // --------------------------------------------------------------------------
    // Ratón en Canvas
    canvas.addEventListener('mousemove', (e) => {
        if (!isPlaying) return;
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        paddle.x = mouseX - paddle.width / 2;
        if (paddle.x < 0) paddle.x = 0;
        if (paddle.x + paddle.width > canvas.width) paddle.x = canvas.width - paddle.width;
    });

    canvas.addEventListener('click', () => {
        if (isPlaying && !isLaunched) {
            isLaunched = true;
            if (window.MathQuestApp) window.MathQuestApp.SoundEngine.playClick();
        }
    });

    // Touch en Canvas
    canvas.addEventListener('touchmove', (e) => {
        if (!isPlaying || !e.touches[0]) return;
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const touchX = e.touches[0].clientX - rect.left;
        paddle.x = touchX - paddle.width / 2;
        if (paddle.x < 0) paddle.x = 0;
        if (paddle.x + paddle.width > canvas.width) paddle.x = canvas.width - paddle.width;
    }, { passive: false });

    canvas.addEventListener('touchstart', (e) => {
        if (isPlaying && !isLaunched) {
            isLaunched = true;
            if (window.MathQuestApp) window.MathQuestApp.SoundEngine.playClick();
        }
    }, { passive: true });

    // Botones Overlay & Reiniciar
    if (btnStart) {
        btnStart.addEventListener('click', () => {
            if (overlay) overlay.classList.add('hidden');
            if (lives <= 0 || remainingTargetBricks <= 0) {
                if (remainingTargetBricks <= 0 && level < 5) {
                    level++;
                }
                initGame(level);
            }
            isPlaying = true;
            isLaunched = true;
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            animationFrameId = requestAnimationFrame(update);
        });
    }

    if (btnRestart) {
        btnRestart.addEventListener('click', () => {
            if (window.MathQuestApp) window.MathQuestApp.SoundEngine.playClick();
            initGame(level);
            isPlaying = true;
            isLaunched = false;
            if (overlay) overlay.classList.add('hidden');
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            animationFrameId = requestAnimationFrame(update);
        });
    }

    // Botones táctiles en pantalla
    const btnCtrlLeft = document.getElementById('ctrl-arkanoid-left');
    const btnCtrlLaunch = document.getElementById('ctrl-arkanoid-launch');
    const btnCtrlRight = document.getElementById('ctrl-arkanoid-right');

    if (btnCtrlLeft) {
        btnCtrlLeft.addEventListener('mousedown', () => { paddle.dx = -paddle.speed; });
        btnCtrlLeft.addEventListener('mouseup', () => { paddle.dx = 0; });
        btnCtrlLeft.addEventListener('touchstart', (e) => { e.preventDefault(); paddle.dx = -paddle.speed; });
        btnCtrlLeft.addEventListener('touchend', () => { paddle.dx = 0; });
    }

    if (btnCtrlRight) {
        btnCtrlRight.addEventListener('mousedown', () => { paddle.dx = paddle.speed; });
        btnCtrlRight.addEventListener('mouseup', () => { paddle.dx = 0; });
        btnCtrlRight.addEventListener('touchstart', (e) => { e.preventDefault(); paddle.dx = paddle.speed; });
        btnCtrlRight.addEventListener('touchend', () => { paddle.dx = 0; });
    }

    if (btnCtrlLaunch) {
        btnCtrlLaunch.addEventListener('click', () => {
            if (isPlaying && !isLaunched) {
                isLaunched = true;
                if (window.MathQuestApp) window.MathQuestApp.SoundEngine.playClick();
            }
        });
    }

    // --------------------------------------------------------------------------
    // 8. Pista de Mochila (Hint)
    // --------------------------------------------------------------------------
    window.useArkanoidHint = function() {
        hintActive = true;
        if (window.MathQuestApp) window.MathQuestApp.SoundEngine.playShield();
        
        // Destacar e iluminar los ladrillos objetivo por 10 segundos
        setTimeout(() => {
            hintActive = false;
        }, 10000);

        return true;
    };

    // Control por Teclado desde el dispatcher central
    window.handleArkanoidKeyboard = function(action) {
        if (action === 'left') {
            paddle.x -= paddle.speed * 2.5;
            if (paddle.x < 0) paddle.x = 0;
        } else if (action === 'right') {
            paddle.x += paddle.speed * 2.5;
            if (paddle.x + paddle.width > canvas.width) paddle.x = canvas.width - paddle.width;
        } else if (action === 'launch') {
            if (isPlaying && !isLaunched) {
                isLaunched = true;
                if (window.MathQuestApp) window.MathQuestApp.SoundEngine.playClick();
            }
        }
    };

    // Hooks globales de apertura y parada
    window.startArkanoidGame = function(gameLevel) {
        initGame(gameLevel);
    };

    window.stopArkanoidGame = function() {
        isPlaying = false;
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        if (freezeTimeout) clearTimeout(freezeTimeout);
        if (laserTimeout) clearTimeout(laserTimeout);
    };

})();
