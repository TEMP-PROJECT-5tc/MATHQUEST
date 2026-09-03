/* ==========================================================================
   MathQuest V3 - Módulo Cálculo Rush (Fase 4.2 - Implementación Completa)
   Pista de Carreras de Alta Velocidad y Cálculo Mental / Álgebra
   ========================================================================== */

(function() {
    'use strict';

    window.MathQuestGames = window.MathQuestGames || {};

    // Configuración del canvas y carriles
    const CANVAS_WIDTH = 400;
    const CANVAS_HEIGHT = 450;
    const ROAD_LEFT = 40;
    const ROAD_RIGHT = 360;
    const ROAD_WIDTH = ROAD_RIGHT - ROAD_LEFT; // 320px
    const LANE_WIDTH = ROAD_WIDTH / 3; // ~106.67px
    const LANE_CENTERS = [
        ROAD_LEFT + LANE_WIDTH * 0.5, // Carril 0: ~93.3px
        ROAD_LEFT + LANE_WIDTH * 1.5, // Carril 1: 200px
        ROAD_LEFT + LANE_WIDTH * 2.5  // Carril 2: ~306.7px
    ];

    // Variables de estado del juego
    let canvas = null;
    let ctx = null;
    let level = 1;
    let isRunning = false;
    let isPaused = false;
    let animFrameId = null;

    let lives = 3;
    let score = 0;
    let doorsSolved = 0;
    let doorsTarget = 5;
    let baseSpeed = 2.4;
    let roadScroll = 0;
    let screenShake = 0;

    // Vehículo
    const player = {
        lane: 1, // Comienza en el carril central
        x: LANE_CENTERS[1],
        targetX: LANE_CENTERS[1],
        y: 360,
        width: 44,
        height: 68,
        tilt: 0,
        invulnerableTimer: 0,
        particles: []
    };

    // Reto actual y arcos
    let currentChallenge = null;
    let activeGates = [];
    let collectibles = [];
    let floatTexts = [];
    let isHintActiveForCurrentGate = false;

    // Metas y velocidades por nivel
    const LEVEL_CONFIG = {
        1: { target: 5, speed: 2.2, label: 'Nivel 1: Sumas y Restas Relámpago' },
        2: { target: 6, speed: 2.8, label: 'Nivel 2: Multiplicaciones y Divisiones de Pista' },
        3: { target: 7, speed: 3.4, label: 'Nivel 3: Álgebra - Ecuaciones Lineales' },
        4: { target: 8, speed: 4.0, label: 'Nivel 4: Potencias, Raíces y Binomios' },
        5: { target: 10, speed: 4.8, label: 'Nivel 5: Reto Boss Rush - Velocidad Máxima' }
    };

    /* --------------------------------------------------------------------------
       Generador Matemático de Cálculo Rush
       -------------------------------------------------------------------------- */
    function generateRushMath(lvl) {
        let promptText = "";
        let promptSub = "¿Resultado?";
        let answer = 0;
        let distractors = [];

        switch (lvl) {
            case 1: { // Sumas y restas dinámicas
                const isAddition = Math.random() > 0.45;
                if (isAddition) {
                    const a = Math.floor(Math.random() * 24) + 6;
                    const b = Math.floor(Math.random() * 20) + 5;
                    answer = a + b;
                    promptText = `${a} + ${b} = ?`;
                } else {
                    const a = Math.floor(Math.random() * 35) + 15;
                    const b = Math.floor(Math.random() * (a - 5)) + 4;
                    answer = a - b;
                    promptText = `${a} - ${b} = ?`;
                }
                distractors = [
                    answer + (Math.random() > 0.5 ? 2 : -2),
                    answer + (Math.random() > 0.5 ? 5 : -4)
                ];
                break;
            }

            case 2: { // Multiplicación y división entera
                const isMult = Math.random() > 0.4;
                if (isMult) {
                    const a = Math.floor(Math.random() * 7) + 3; // 3 a 9
                    const b = Math.floor(Math.random() * 8) + 3; // 3 a 10
                    answer = a * b;
                    promptText = `${a} × ${b} = ?`;
                } else {
                    const b = Math.floor(Math.random() * 7) + 3;
                    const q = Math.floor(Math.random() * 8) + 2;
                    const a = b * q;
                    answer = q;
                    promptText = `${a} ÷ ${b} = ?`;
                }
                distractors = [
                    answer + (Math.random() > 0.5 ? 1 : -1),
                    answer + (Math.random() > 0.5 ? 3 : -2)
                ];
                break;
            }

            case 3: { // Ecuaciones lineales de primer grado
                const xVal = Math.floor(Math.random() * 8) + 2; // x entre 2 y 9
                const op = Math.floor(Math.random() * 3);
                if (op === 0) { // ax + b = c
                    const a = Math.floor(Math.random() * 3) + 2;
                    const b = Math.floor(Math.random() * 8) + 2;
                    const c = a * xVal + b;
                    promptText = `${a}x + ${b} = ${c}`;
                    promptSub = "¿Valor de x?";
                    answer = xVal;
                } else if (op === 1) { // ax - b = c
                    const a = Math.floor(Math.random() * 3) + 2;
                    const b = Math.floor(Math.random() * 6) + 1;
                    const c = a * xVal - b;
                    promptText = `${a}x - ${b} = ${c}`;
                    promptSub = "¿Valor de x?";
                    answer = xVal;
                } else { // x + b = c
                    const b = Math.floor(Math.random() * 15) + 5;
                    const c = xVal + b;
                    promptText = `x + ${b} = ${c}`;
                    promptSub = "¿Valor de x?";
                    answer = xVal;
                }
                distractors = [
                    answer + (Math.random() > 0.5 ? 1 : -1),
                    answer + (Math.random() > 0.5 ? 2 : -2)
                ];
                break;
            }

            case 4: { // Potencias, raíces cuadradas y binomios
                const type = Math.floor(Math.random() * 3);
                if (type === 0) { // x² = N
                    const xVal = Math.floor(Math.random() * 6) + 3; // 3 a 8
                    promptText = `x² = ${xVal * xVal}  (x > 0)`;
                    promptSub = "¿Valor de x?";
                    answer = xVal;
                } else if (type === 1) { // Raíz cuadrada
                    const r = Math.floor(Math.random() * 7) + 3;
                    promptText = `√${r * r} = ?`;
                    promptSub = "¿Resultado?";
                    answer = r;
                } else { // a(x + b) = c
                    const a = 2;
                    const xVal = Math.floor(Math.random() * 6) + 3;
                    const b = Math.floor(Math.random() * 4) + 1;
                    const c = a * (xVal + b);
                    promptText = `${a}(x + ${b}) = ${c}`;
                    promptSub = "¿Valor de x?";
                    answer = xVal;
                }
                distractors = [
                    answer + (Math.random() > 0.5 ? 1 : -1),
                    answer + (Math.random() > 0.5 ? 2 : -3)
                ];
                break;
            }

            case 5: // Reto Boss Rush - Velocidad Máxima y Álgebra Combinada
            default: {
                const type = Math.floor(Math.random() * 3);
                if (type === 0) { // ax + b = cx + d
                    const c = 2;
                    const a = 4;
                    const xVal = Math.floor(Math.random() * 6) + 3;
                    const d = Math.floor(Math.random() * 8) + 10;
                    const b = (c * xVal + d) - (a * xVal);
                    if (b >= 0) {
                        promptText = `${a}x + ${b} = ${c}x + ${d}`;
                    } else {
                        promptText = `${a}x - ${Math.abs(b)} = ${c}x + ${d}`;
                    }
                    promptSub = "¿Valor de x?";
                    answer = xVal;
                } else if (type === 1) { // x² - a = b
                    const xVal = Math.floor(Math.random() * 5) + 4; // 4 a 8
                    const a = Math.floor(Math.random() * 10) + 5;
                    const b = (xVal * xVal) - a;
                    promptText = `x² - ${a} = ${b}  (x > 0)`;
                    promptSub = "¿Valor de x?";
                    answer = xVal;
                } else { // 3(2x - b) = c
                    const xVal = Math.floor(Math.random() * 5) + 3;
                    const b = 1;
                    const c = 3 * (2 * xVal - b);
                    promptText = `3(2x - ${b}) = ${c}`;
                    promptSub = "¿Valor de x?";
                    answer = xVal;
                }
                distractors = [
                    answer - 1,
                    answer + 1
                ];
                break;
            }
        }

        // Asegurar que los distractores no sean iguales a la respuesta ni entre sí
        const cleanDistractors = [];
        for (let d of distractors) {
            let candidate = Math.round(d);
            if (candidate === answer || cleanDistractors.includes(candidate)) {
                candidate = answer + (cleanDistractors.length + 1) * (Math.random() > 0.5 ? 1 : -1);
            }
            cleanDistractors.push(candidate);
        }

        // Ubicar la respuesta en un carril aleatorio (0, 1 o 2)
        const correctLane = Math.floor(Math.random() * 3);
        const options = [];
        let dIdx = 0;
        for (let i = 0; i < 3; i++) {
            if (i === correctLane) {
                options.push(answer);
            } else {
                options.push(cleanDistractors[dIdx++]);
            }
        }

        return {
            prompt: promptText,
            sub: promptSub,
            answer: answer,
            correctLane: correctLane,
            options: options
        };
    }

    /* --------------------------------------------------------------------------
       Actualización de Interfaz y HUD
       -------------------------------------------------------------------------- */
    function updateHUD() {
        const heartsBox = document.getElementById('rush-hearts-box');
        if (heartsBox) {
            let hStr = '';
            for (let i = 0; i < 3; i++) {
                hStr += (i < lives) ? '❤️ ' : '🤍 ';
            }
            heartsBox.innerText = hStr.trim();
        }

        const scoreEl = document.getElementById('rush-score-display');
        if (scoreEl) scoreEl.innerText = score;

        const levelEl = document.getElementById('rush-level-display');
        if (levelEl) levelEl.innerText = level;

        const eqEl = document.getElementById('rush-equation');
        if (eqEl && currentChallenge) {
            eqEl.innerHTML = `<span style="color:var(--color-accent-blue);">${currentChallenge.prompt}</span>`;
        }

        const promptLabel = document.getElementById('rush-equation-prompt');
        if (promptLabel && currentChallenge) {
            promptLabel.innerText = currentChallenge.sub || "Operación en pista:";
        }
    }

    /* --------------------------------------------------------------------------
       Gestión de Spawn de Arcos y Desafíos
       -------------------------------------------------------------------------- */
    function spawnGate() {
        currentChallenge = generateRushMath(level);
        isHintActiveForCurrentGate = false;
        updateHUD();

        activeGates.push({
            y: -70,
            options: currentChallenge.options,
            correctLane: currentChallenge.correctLane,
            answer: currentChallenge.answer,
            passed: false,
            highlighted: false
        });

        // Probabilidad de generar moneda MathCoin flotante entre arcos
        if (Math.random() > 0.4) {
            const coinLane = Math.floor(Math.random() * 3);
            collectibles.push({
                lane: coinLane,
                x: LANE_CENTERS[coinLane],
                y: -140,
                type: 'coin',
                collected: false
            });
        }
    }

    /* --------------------------------------------------------------------------
       Partículas y Efectos Visuales
       -------------------------------------------------------------------------- */
    function createConfetti(x, y) {
        for (let i = 0; i < 24; i++) {
            const angle = Math.random() * Math.PI * 2;
            const spd = Math.random() * 5 + 2;
            player.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * spd,
                vy: Math.sin(angle) * spd - 2,
                color: ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#ffffff'][Math.floor(Math.random() * 5)],
                size: Math.random() * 5 + 3,
                life: 1.0,
                decay: Math.random() * 0.03 + 0.02
            });
        }
    }

    function addFloatText(text, x, y, color) {
        floatTexts.push({
            text: text,
            x: x,
            y: y,
            color: color || '#ffffff',
            life: 1.0,
            vy: -1.8
        });
    }

    /* --------------------------------------------------------------------------
       Lógica Principal del Juego y Actualización
       -------------------------------------------------------------------------- */
    function update() {
        if (!isRunning || isPaused) return;

        // Movimiento suave del jugador (lerp)
        player.targetX = LANE_CENTERS[player.lane];
        const dx = player.targetX - player.x;
        player.x += dx * 0.22;
        player.tilt = Math.max(-0.18, Math.min(0.18, dx * 0.008));

        // Partículas de escape del motor
        if (Math.random() > 0.2) {
            player.particles.push({
                x: player.x + (Math.random() * 12 - 6),
                y: player.y + player.height * 0.45,
                vx: (Math.random() * 2 - 1),
                vy: Math.random() * 3 + 4,
                color: Math.random() > 0.5 ? '#38bdf8' : '#f97316',
                size: Math.random() * 4 + 2,
                life: 1.0,
                decay: 0.06
            });
        }

        // Actualizar partículas
        for (let i = player.particles.length - 1; i >= 0; i--) {
            const p = player.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= p.decay;
            if (p.life <= 0) {
                player.particles.splice(i, 1);
            }
        }

        // Actualizar textos flotantes
        for (let i = floatTexts.length - 1; i >= 0; i--) {
            const ft = floatTexts[i];
            ft.y += ft.vy;
            ft.life -= 0.02;
            if (ft.life <= 0) {
                floatTexts.splice(i, 1);
            }
        }

        // Scroll de carretera
        roadScroll = (roadScroll + baseSpeed * 1.5) % 40;

        // Temporizador de invulnerabilidad
        if (player.invulnerableTimer > 0) {
            player.invulnerableTimer--;
        }

        // Temblor de pantalla
        if (screenShake > 0) {
            screenShake--;
        }

        // Mover monedas / coleccionables
        for (let i = collectibles.length - 1; i >= 0; i--) {
            const c = collectibles[i];
            c.y += baseSpeed;

            // Detección de recogida por el jugador
            if (!c.collected && Math.abs(c.y - player.y) < 36 && player.lane === c.lane) {
                c.collected = true;
                if (window.awardCoins) {
                    window.awardCoins(false, 5); // +5 MathCoins inmediatas
                } else if (window.state) {
                    window.state.coins = (window.state.coins || 0) + 5;
                    if (window.saveStateToStorage) window.saveStateToStorage();
                    if (window.updateHeaderStats) window.updateHeaderStats();
                }
                if (window.SoundEngine && typeof window.SoundEngine.playTone === 'function') {
                    window.SoundEngine.playTone(880, 'sine', 0.1, 0.15);
                }
                addFloatText('+5 🪙', c.x, c.y, '#f59e0b');
                collectibles.splice(i, 1);
                continue;
            }

            if (c.y > CANVAS_HEIGHT + 50) {
                collectibles.splice(i, 1);
            }
        }

        // Mover y evaluar arcos
        for (let i = activeGates.length - 1; i >= 0; i--) {
            const gate = activeGates[i];
            gate.y += baseSpeed;

            // Zona de colisión / cruce con el jugador
            if (!gate.passed && gate.y >= player.y - 10 && gate.y <= player.y + 40) {
                gate.passed = true;

                if (player.lane === gate.correctLane) {
                    // ¡Acierto!
                    doorsSolved++;
                    score += 100 * level;
                    updateHUD();

                    if (window.SoundEngine && typeof window.SoundEngine.playCorrect === 'function') {
                        window.SoundEngine.playCorrect();
                    }

                    createConfetti(LANE_CENTERS[player.lane], player.y);
                    addFloatText(`¡CORRECTO! +${100 * level} 🏎️`, LANE_CENTERS[player.lane], player.y - 30, '#10b981');

                    // Verificar condición de victoria del nivel
                    if (doorsSolved >= doorsTarget) {
                        handleLevelWin();
                        return;
                    }
                } else {
                    // ¡Fallo!
                    if (player.invulnerableTimer <= 0) {
                        lives--;
                        player.invulnerableTimer = 60; // 1 segundo de inmunidad
                        screenShake = 12;
                        updateHUD();

                        if (window.SoundEngine && typeof window.SoundEngine.playWrong === 'function') {
                            window.SoundEngine.playWrong();
                        }

                        addFloatText('¡INCORRECTO! -1 ❤️', LANE_CENTERS[player.lane], player.y - 30, '#ef4444');

                        if (lives <= 0) {
                            handleGameOver();
                            return;
                        }
                    }
                }
            }

            // Eliminar arcos pasados y spawnear siguiente
            if (gate.y > CANVAS_HEIGHT + 80) {
                activeGates.splice(i, 1);
                if (isRunning && doorsSolved < doorsTarget) {
                    spawnGate();
                }
            }
        }
    }

    /* --------------------------------------------------------------------------
       Renderizado en Canvas 2D
       -------------------------------------------------------------------------- */
    function draw() {
        if (!ctx) return;

        ctx.save();

        // Aplicar temblor de pantalla
        if (screenShake > 0) {
            const shakeX = (Math.random() * 2 - 1) * screenShake * 0.8;
            const shakeY = (Math.random() * 2 - 1) * screenShake * 0.8;
            ctx.translate(shakeX, shakeY);
        }

        // 1. Fondo exterior (césped/bordes cibernéticos)
        ctx.fillStyle = '#090d16';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // 2. Asfalto de la pista
        const roadGrad = ctx.createLinearGradient(ROAD_LEFT, 0, ROAD_RIGHT, 0);
        roadGrad.addColorStop(0, '#0f172a');
        roadGrad.addColorStop(0.5, '#1e293b');
        roadGrad.addColorStop(1, '#0f172a');
        ctx.fillStyle = roadGrad;
        ctx.fillRect(ROAD_LEFT, 0, ROAD_WIDTH, CANVAS_HEIGHT);

        // 3. Arcén a cuadros blanco y rojo (estilo circuito F1)
        const curbWidth = 10;
        const segmentHeight = 24;
        for (let y = -segmentHeight + (roadScroll % segmentHeight); y < CANVAS_HEIGHT; y += segmentHeight) {
            const isRed = Math.floor((y - roadScroll) / segmentHeight) % 2 === 0;
            ctx.fillStyle = isRed ? '#ef4444' : '#f8fafc';
            // Borde izquierdo
            ctx.fillRect(ROAD_LEFT - curbWidth, y, curbWidth, segmentHeight);
            // Borde derecho
            ctx.fillRect(ROAD_RIGHT, y, curbWidth, segmentHeight);
        }

        // 4. Líneas divisorias de carril (discontinuas en movimiento)
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.setLineDash([20, 16]);
        ctx.lineDashOffset = -roadScroll;

        // Línea 1 (entre carril 0 y 1)
        ctx.beginPath();
        ctx.moveTo(ROAD_LEFT + LANE_WIDTH, 0);
        ctx.lineTo(ROAD_LEFT + LANE_WIDTH, CANVAS_HEIGHT);
        ctx.stroke();

        // Línea 2 (entre carril 1 y 2)
        ctx.beginPath();
        ctx.moveTo(ROAD_LEFT + LANE_WIDTH * 2, 0);
        ctx.lineTo(ROAD_LEFT + LANE_WIDTH * 2, CANVAS_HEIGHT);
        ctx.stroke();

        ctx.setLineDash([]); // Reset dash

        // 5. Iluminación de Pista / Pistas activadas (Resaltado de carril correcto)
        for (let gate of activeGates) {
            if (gate.highlighted || isHintActiveForCurrentGate) {
                const hX = LANE_CENTERS[gate.correctLane] - LANE_WIDTH * 0.45;
                const hGrad = ctx.createLinearGradient(0, gate.y, 0, player.y);
                hGrad.addColorStop(0, 'rgba(16, 185, 129, 0.45)');
                hGrad.addColorStop(1, 'rgba(16, 185, 129, 0.05)');
                ctx.fillStyle = hGrad;
                ctx.fillRect(hX, gate.y, LANE_WIDTH * 0.9, player.y - gate.y + 40);

                // Flecha holográfica pulsante
                ctx.fillStyle = '#10b981';
                ctx.font = 'bold 22px system-ui, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('⬇️ ¡AQUÍ!', LANE_CENTERS[gate.correctLane], gate.y + 75);
            }
        }

        // 6. Dibujar Monedas / Coleccionables
        for (let c of collectibles) {
            if (c.collected) continue;
            ctx.save();
            ctx.translate(c.x, c.y);
            const bob = Math.sin(Date.now() * 0.008) * 4;
            ctx.translate(0, bob);

            // Resplandor de moneda
            ctx.shadowColor = '#f59e0b';
            ctx.shadowBlur = 10;
            ctx.fillStyle = '#fbbf24';
            ctx.beginPath();
            ctx.arc(0, 0, 13, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#b45309';
            ctx.font = 'bold 11px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowBlur = 0;
            ctx.fillText('🪙', 0, 0);
            ctx.restore();
        }

        // 7. Dibujar Arcos con Respuestas Numéricas
        for (let gate of activeGates) {
            ctx.save();

            // Viga superior del arco
            ctx.fillStyle = '#1e293b';
            ctx.strokeStyle = '#0284c7';
            ctx.lineWidth = 3;
            ctx.fillRect(ROAD_LEFT - 12, gate.y - 12, ROAD_WIDTH + 24, 14);
            ctx.strokeRect(ROAD_LEFT - 12, gate.y - 12, ROAD_WIDTH + 24, 14);

            // Soportes laterales de neón
            ctx.fillStyle = '#0ea5e9';
            ctx.fillRect(ROAD_LEFT - 12, gate.y - 12, 6, 45);
            ctx.fillRect(ROAD_RIGHT + 6, gate.y - 12, 6, 45);

            // 3 Paneles de Carril
            for (let l = 0; l < 3; l++) {
                const centerX = LANE_CENTERS[l];
                const optVal = gate.options[l];
                const isCorrect = (l === gate.correctLane);
                const isHinted = isCorrect && (gate.highlighted || isHintActiveForCurrentGate);

                const cardW = 74;
                const cardH = 46;
                const cardX = centerX - cardW / 2;
                const cardY = gate.y + 4;

                // Fondo del panel
                if (isHinted) {
                    ctx.fillStyle = '#065f46';
                    ctx.strokeStyle = '#34d399';
                    ctx.shadowColor = '#10b981';
                    ctx.shadowBlur = 14;
                } else {
                    ctx.fillStyle = '#0f172a';
                    ctx.strokeStyle = '#38bdf8';
                    ctx.shadowColor = '#0284c7';
                    ctx.shadowBlur = 6;
                }

                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.roundRect(cardX, cardY, cardW, cardH, 8);
                ctx.fill();
                ctx.stroke();
                ctx.shadowBlur = 0;

                // Texto del número / respuesta
                ctx.fillStyle = isHinted ? '#a7f3d0' : '#ffffff';
                ctx.font = 'bold 20px system-ui, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(optVal, centerX, cardY + cardH / 2);
            }

            ctx.restore();
        }

        // 8. Partículas del jugador
        for (let p of player.particles) {
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.life;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1.0;

        // 9. Dibujar Vehículo Corredor
        drawPlayerCar();

        // 10. Dibujar Textos Flotantes
        for (let ft of floatTexts) {
            ctx.save();
            ctx.globalAlpha = Math.max(0, ft.life);
            ctx.fillStyle = ft.color;
            ctx.font = '900 16px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.shadowColor = 'rgba(0,0,0,0.8)';
            ctx.shadowBlur = 4;
            ctx.fillText(ft.text, ft.x, ft.y);
            ctx.restore();
        }

        // 11. HUD Superior en Canvas (Progreso y Velocímetro)
        drawCanvasHUD();

        ctx.restore();
    }

    /* --------------------------------------------------------------------------
       Renderizado Estilizado del Coche
       -------------------------------------------------------------------------- */
    function drawPlayerCar() {
        ctx.save();
        ctx.translate(player.x, player.y);
        ctx.rotate(player.tilt);

        // Efecto de parpadeo por invulnerabilidad
        if (player.invulnerableTimer > 0 && Math.floor(player.invulnerableTimer / 4) % 2 === 0) {
            ctx.globalAlpha = 0.35;
        }

        // Haces de luz delanteros proyectados en la carretera
        const lightGrad = ctx.createLinearGradient(0, 0, 0, -120);
        lightGrad.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
        lightGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = lightGrad;
        ctx.beginPath();
        ctx.moveTo(-16, -20);
        ctx.lineTo(-38, -130);
        ctx.lineTo(38, -130);
        ctx.lineTo(16, -20);
        ctx.closePath();
        ctx.fill();

        // Sombra proyectada del coche
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.beginPath();
        ctx.ellipse(0, 6, 22, 34, 0, 0, Math.PI * 2);
        ctx.fill();

        // Ruedas deportivas negras
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-22, -26, 6, 14); // Rueda delantera izq
        ctx.fillRect(16, -26, 6, 14);  // Rueda delantera der
        ctx.fillRect(-23, 12, 7, 16);  // Rueda trasera izq
        ctx.fillRect(16, 12, 7, 16);   // Rueda trasera der

        // Chasis principal aerodinámico
        const carGrad = ctx.createLinearGradient(-18, 0, 18, 0);
        carGrad.addColorStop(0, '#0284c7');
        carGrad.addColorStop(0.5, '#38bdf8');
        carGrad.addColorStop(1, '#0369a1');
        ctx.fillStyle = carGrad;
        ctx.beginPath();
        ctx.roundRect(-18, -28, 36, 56, 8);
        ctx.fill();

        // Franja deportiva central
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(-4, -28, 8, 56);

        // Parabrisas / Cabina reflectante
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.roundRect(-11, -16, 22, 22, 4);
        ctx.fill();

        const glassGrad = ctx.createLinearGradient(-8, -14, 8, 4);
        glassGrad.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
        glassGrad.addColorStop(1, 'rgba(56, 189, 248, 0.2)');
        ctx.fillStyle = glassGrad;
        ctx.beginPath();
        ctx.roundRect(-9, -14, 18, 18, 3);
        ctx.fill();

        // Alerón trasero de alta velocidad
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(-20, 22, 40, 6);
        ctx.fillStyle = '#0369a1';
        ctx.fillRect(-21, 18, 4, 10);
        ctx.fillRect(17, 18, 4, 10);

        // Luces traseras LED rojas
        ctx.fillStyle = '#ef4444';
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 8;
        ctx.fillRect(-15, 26, 8, 3);
        ctx.fillRect(7, 26, 8, 3);

        ctx.restore();
    }

    /* --------------------------------------------------------------------------
       HUD dentro del Canvas
       -------------------------------------------------------------------------- */
    function drawCanvasHUD() {
        ctx.save();
        // Barra superior translúcida
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(ROAD_LEFT, 8, ROAD_WIDTH, 30);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(ROAD_LEFT, 8, ROAD_WIDTH, 30);

        // Indicador de puertas superadas
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`🏁 Checkpoints: ${doorsSolved}/${doorsTarget}`, ROAD_LEFT + 12, 23);

        // Velocímetro digital
        const speedKmh = Math.round(140 + level * 25 + baseSpeed * 12);
        ctx.fillStyle = '#38bdf8';
        ctx.textAlign = 'right';
        ctx.fillText(`⚡ ${speedKmh} KM/H`, ROAD_RIGHT - 12, 23);

        ctx.restore();
    }

    /* --------------------------------------------------------------------------
       Bucle de Animación
       -------------------------------------------------------------------------- */
    function gameLoop() {
        if (!isRunning) return;
        update();
        draw();
        animFrameId = requestAnimationFrame(gameLoop);
    }

    /* --------------------------------------------------------------------------
       Control de Flujo: Victoria y Derrota
       -------------------------------------------------------------------------- */
    function handleLevelWin() {
        isRunning = false;
        if (animFrameId) cancelAnimationFrame(animFrameId);

        if (window.SoundEngine && typeof window.SoundEngine.playFanfare === 'function') {
            window.SoundEngine.playFanfare();
        }

        // Llamada al helper de MathQuest para completar el nivel
        let coinsEarned = 50;
        if (window.completeGameLevel) {
            coinsEarned = window.completeGameLevel('rush', level) || 50;
        }

        const overlay = document.getElementById('rush-overlay');
        const titleEl = document.getElementById('rush-overlay-title');
        const textEl = document.getElementById('rush-overlay-text');
        const btnStart = document.getElementById('btn-start-rush-game');

        if (titleEl) titleEl.innerText = `¡Meta Cruzada! 🏁`;
        if (textEl) {
            textEl.innerHTML = `
                <div style="margin: 12px 0;">
                    <p style="color:var(--color-accent-green); font-size:1.1rem; font-weight:800;">
                        ¡Nivel ${level} Completado con Éxito!
                    </p>
                    <p>Puntuación Final: <strong>${score} pts</strong></p>
                    <p>Recompensa: <strong>+${coinsEarned} MathCoins 🪙</strong></p>
                </div>
            `;
        }

        if (btnStart) {
            if (level < 5) {
                btnStart.innerText = `Avanzar al Nivel ${level + 1} 🏎️`;
                btnStart.onclick = () => {
                    initGame(level + 1);
                };
            } else {
                btnStart.innerText = `¡Volver al Mapa! 🪐`;
                btnStart.onclick = () => {
                    const backBtn = document.getElementById('btn-back-menu');
                    if (backBtn) backBtn.click();
                };
            }
        }

        if (overlay) overlay.classList.remove('hidden');
    }

    function handleGameOver() {
        isRunning = false;
        if (animFrameId) cancelAnimationFrame(animFrameId);

        const overlay = document.getElementById('rush-overlay');
        const titleEl = document.getElementById('rush-overlay-title');
        const textEl = document.getElementById('rush-overlay-text');
        const btnStart = document.getElementById('btn-start-rush-game');

        if (titleEl) titleEl.innerText = `¡Accidente en Pista! 💥`;
        if (textEl) {
            textEl.innerHTML = `
                <p style="color:var(--color-accent-coral); font-size:1.05rem; margin-bottom:10px;">
                    Te has quedado sin corazones de combustible.
                </p>
                <p>Puntuación obtenida: <strong>${score} pts</strong></p>
                <p>¡Repasa las operaciones y vuelve a la pista!</p>
            `;
        }

        if (btnStart) {
            btnStart.innerText = `Reintentar Nivel ${level} 🔄`;
            btnStart.onclick = () => {
                initGame(level);
            };
        }

        if (overlay) overlay.classList.remove('hidden');
    }

    /* --------------------------------------------------------------------------
       Inicialización y Reseteo
       -------------------------------------------------------------------------- */
    function initGame(lvl) {
        level = parseInt(lvl) || 1;
        const cfg = LEVEL_CONFIG[level] || LEVEL_CONFIG[1];
        doorsTarget = cfg.target;
        baseSpeed = cfg.speed;

        lives = 3;
        score = 0;
        doorsSolved = 0;
        activeGates = [];
        collectibles = [];
        floatTexts = [];
        player.lane = 1;
        player.x = LANE_CENTERS[1];
        player.targetX = LANE_CENTERS[1];
        player.invulnerableTimer = 0;
        player.particles = [];
        isHintActiveForCurrentGate = false;

        const overlay = document.getElementById('rush-overlay');
        if (overlay) overlay.classList.add('hidden');

        updateHUD();
        spawnGate();

        isRunning = true;
        isPaused = false;

        if (animFrameId) cancelAnimationFrame(animFrameId);
        animFrameId = requestAnimationFrame(gameLoop);
    }

    /* --------------------------------------------------------------------------
       Manejo de Entrada y Controles
       -------------------------------------------------------------------------- */
    function moveLeft() {
        if (!isRunning) return;
        if (player.lane > 0) {
            player.lane--;
            if (window.SoundEngine && typeof window.SoundEngine.playClick === 'function') {
                window.SoundEngine.playClick();
            }
        }
    }

    function moveRight() {
        if (!isRunning) return;
        if (player.lane < 2) {
            player.lane++;
            if (window.SoundEngine && typeof window.SoundEngine.playClick === 'function') {
                window.SoundEngine.playClick();
            }
        }
    }

    function handleKeyDown(e) {
        if (!isRunning) return;
        if (window.state && window.state.activeGameScreen !== 'rush') return;

        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
            e.preventDefault();
            moveLeft();
        } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
            e.preventDefault();
            moveRight();
        }
    }

    function handleCanvasPointer(e) {
        if (!isRunning) return;
        const rect = canvas.getBoundingClientRect();
        const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
        const clickX = ((clientX - rect.left) / rect.width) * CANVAS_WIDTH;

        if (clickX < ROAD_LEFT + LANE_WIDTH) {
            player.lane = 0;
        } else if (clickX < ROAD_LEFT + LANE_WIDTH * 2) {
            player.lane = 1;
        } else {
            player.lane = 2;
        }

        if (window.SoundEngine && typeof window.SoundEngine.playClick === 'function') {
            window.SoundEngine.playClick();
        }
    }

    /* --------------------------------------------------------------------------
       API Pública Registrada en MathQuestGames['rush']
       -------------------------------------------------------------------------- */
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

            canvas = document.getElementById('rush-canvas');
            if (canvas) {
                ctx = canvas.getContext('2d');
            }

            const overlay = document.getElementById('rush-overlay');
            const titleEl = document.getElementById('rush-overlay-title');
            const textEl = document.getElementById('rush-overlay-text');
            const btnStart = document.getElementById('btn-start-rush-game');

            const cfg = LEVEL_CONFIG[this.level] || LEVEL_CONFIG[1];
            if (titleEl) titleEl.innerText = `Cálculo Rush 🏎️`;
            if (textEl) {
                textEl.innerHTML = `
                    <p style="font-weight:700; color:var(--color-accent-blue); margin-bottom:8px;">${cfg.label}</p>
                    <p>Cruza los ${cfg.target} arcos con el resultado matemático correcto para dominar la pista.</p>
                `;
            }

            if (btnStart) {
                btnStart.innerText = `¡Arrancar Motores!`;
                btnStart.onclick = () => {
                    if (window.SoundEngine && typeof window.SoundEngine.playClick === 'function') {
                        window.SoundEngine.playClick();
                    }
                    initGame(this.level);
                };
            }

            if (overlay) overlay.classList.remove('hidden');
            updateHUD();
        },

        stop: function() {
            this.isRunning = false;
            isRunning = false;
            if (animFrameId) {
                cancelAnimationFrame(animFrameId);
                animFrameId = null;
            }
        },

        useHint: function() {
            if (!isRunning || activeGates.length === 0) {
                if (window.showToast) window.showToast("Inicia la carrera para usar pistas.");
                return false;
            }

            // Validar inventario de pistas o VIP
            const isVip = window.state && window.state.vipBypassPurchased;
            const hintsCount = (window.state && window.state.inventory && window.state.inventory.hints) || 0;

            if (!isVip && hintsCount <= 0) {
                if (window.showToast) window.showToast("❌ No tienes pistas en tu inventario. ¡Cómpralas en la Tienda!");
                if (window.SoundEngine && typeof window.SoundEngine.playWrong === 'function') {
                    window.SoundEngine.playWrong();
                }
                return false;
            }

            // Consumir pista
            if (!isVip && window.state && window.state.inventory) {
                window.state.inventory.hints--;
                if (window.saveStateToStorage) window.saveStateToStorage();
                if (window.updateHeaderStats) window.updateHeaderStats();
            }

            // Activar pista en el arco actual
            isHintActiveForCurrentGate = true;
            for (let g of activeGates) {
                g.highlighted = true;
            }

            const laneNames = ['Izquierdo', 'Central', 'Derecho'];
            const targetGate = activeGates[0];
            const laneName = targetGate ? laneNames[targetGate.correctLane] : 'correcto';
            const ansVal = targetGate ? targetGate.answer : '';

            if (window.SoundEngine && typeof window.SoundEngine.playShield === 'function') {
                window.SoundEngine.playShield();
            }

            if (window.showToast) {
                window.showToast(`💡 Pista Activada: Conduce al Carril ${laneName} (Respuesta: ${ansVal})`);
            }

            return true;
        }
    };

    window.MathQuestGames['rush'] = RushGame;

    /* --------------------------------------------------------------------------
       Listeners de UI Globales y Controles Táctiles
       -------------------------------------------------------------------------- */
    window.addEventListener('keydown', handleKeyDown);

    // Botones de dirección táctiles
    const btnLeft = document.getElementById('ctrl-rush-left');
    if (btnLeft) {
        btnLeft.addEventListener('click', () => {
            moveLeft();
        });
    }

    const btnRight = document.getElementById('ctrl-rush-right');
    if (btnRight) {
        btnRight.addEventListener('click', () => {
            moveRight();
        });
    }

    // Reiniciar carrera
    const btnRestart = document.getElementById('btn-restart-rush');
    if (btnRestart) {
        btnRestart.addEventListener('click', () => {
            if (window.SoundEngine && typeof window.SoundEngine.playClick === 'function') {
                window.SoundEngine.playClick();
            }
            initGame(level);
        });
    }

    // Botón de Pista en el sidebar
    const btnHint = document.getElementById('btn-use-hint-rush');
    if (btnHint) {
        btnHint.addEventListener('click', () => {
            RushGame.useHint();
        });
    }

    // Interacción táctil en el canvas
    const cvs = document.getElementById('rush-canvas');
    if (cvs) {
        cvs.addEventListener('pointerdown', handleCanvasPointer);
    }

})();
