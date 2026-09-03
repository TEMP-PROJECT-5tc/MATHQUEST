/* ==========================================================================
   MathQuest V3 - Módulo Math Escape (Fase 4.4)
   Escape Room Matemático: Resuelve 3 mecanismos (Dial, Engranaje, Compuerta)
   con temporizador decreciente por nivel, penalización por error y 5 niveles:
   1. Secuencias Aritméticas
   2. Proporciones Inversas
   3. Coordenadas Cartesianas (con plano visual en canvas)
   4. Sistemas de Ecuaciones 2x2
   5. Divisibilidad, Números Primos y Factorización
   ========================================================================== */

(function() {
    'use strict';

    window.MathQuestGames = window.MathQuestGames || {};

    const LEVEL_TIMES = {
        1: 150, // 2:30
        2: 135, // 2:15
        3: 120, // 2:00
        4: 105, // 1:45
        5: 90   // 1:30
    };

    const EscapeGame = {
        name: 'Math Escape',
        icon: '🔐',
        topic: 'logic',
        screenId: 'screen-escape',
        level: 1,
        isRunning: false,
        
        // Estado del juego
        timeLeft: 150,
        maxTime: 150,
        timerInterval: null,
        animFrameId: null,
        hearts: 3,
        currentMechIndex: 0, // 0: Dial, 1: Engranaje, 2: Compuerta
        mechanisms: [],      // 3 retos por nivel
        options: [],
        correctAnswer: null,
        activeClueFormula: '',
        activeCluePrompt: '',
        hintUsedThisMech: false,

        // Animación visual del cuarto y puerta
        canvas: null,
        ctx: null,
        vaultRotation: 0,
        targetVaultRotation: 0,
        doorOpenProgress: 0, // 0 = cerrada, 1 = completamente abierta
        bolts: [
            { state: 'locked', progress: 0 }, // Dial
            { state: 'locked', progress: 0 }, // Engranaje
            { state: 'locked', progress: 0 }  // Compuerta
        ],
        particles: [],
        floatingTexts: [],
        radarSweepAngle: 0,
        targetCoord: { x: 0, y: 0 },

        init: function() {
            this.canvas = document.getElementById('escape-canvas');
            if (this.canvas) {
                this.ctx = this.canvas.getContext('2d');
            }

            const btnRestart = document.getElementById('btn-restart-escape');
            if (btnRestart) {
                btnRestart.onclick = () => {
                    if (window.SoundEngine) window.SoundEngine.playClick();
                    this.start(this.level);
                };
            }

            const btnStart = document.getElementById('btn-start-escape-game');
            if (btnStart) {
                btnStart.onclick = () => {
                    if (window.SoundEngine) window.SoundEngine.playClick();
                    const overlay = document.getElementById('escape-overlay');
                    if (overlay) overlay.classList.add('hidden');
                    
                    // Si estaba en estado de victoria o derrota, reiniciar nivel
                    if (!this.isRunning) {
                        this.start(this.level);
                    }
                };
            }
        },

        start: function(lvl) {
            this.stop(); // Limpieza rigurosa previa

            this.level = Math.max(1, Math.min(5, parseInt(lvl) || 1));
            this.isRunning = true;
            this.hearts = 3;
            this.currentMechIndex = 0;
            this.doorOpenProgress = 0;
            this.vaultRotation = 0;
            this.targetVaultRotation = 0;
            this.particles = [];
            this.floatingTexts = [];
            this.bolts = [
                { state: 'locked', progress: 0 },
                { state: 'locked', progress: 0 },
                { state: 'locked', progress: 0 }
            ];

            this.maxTime = LEVEL_TIMES[this.level] || 120;
            this.timeLeft = this.maxTime;

            if (!this.canvas) {
                this.init();
            }

            // Ocultar overlay de reglas/inicio
            const overlay = document.getElementById('escape-overlay');
            if (overlay) overlay.classList.add('hidden');

            this.updateHeaderUI();
            this.updateTimerUI();

            // Generar los 3 desafíos del nivel
            this.mechanisms = this.generateChallenges(this.level);
            this.loadMechanism(0);

            // Iniciar cuenta regresiva del temporizador
            this.startTimer();

            // Iniciar bucle de animación gráfica
            this.startLoop();

            console.log(`[Math Escape] Nivel ${this.level} iniciado. Tiempo: ${this.timeLeft}s`);
        },

        stop: function() {
            this.isRunning = false;
            if (this.timerInterval) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;
            }
            if (this.animFrameId) {
                cancelAnimationFrame(this.animFrameId);
                this.animFrameId = null;
            }
            console.log('[Math Escape] Detenido limpiamente.');
        },

        startTimer: function() {
            if (this.timerInterval) clearInterval(this.timerInterval);
            this.timerInterval = setInterval(() => {
                if (!this.isRunning) return;

                this.timeLeft--;
                this.updateTimerUI();

                if (this.timeLeft <= 0) {
                    this.timeLeft = 0;
                    this.triggerGameOver("¡El tiempo se ha agotado! Los cerrojos se sellaron permanentemente.");
                }
            }, 1000);
        },

        updateTimerUI: function() {
            const display = document.getElementById('escape-timer-display');
            const fill = document.getElementById('escape-timer-fill');

            const mins = Math.floor(Math.max(0, this.timeLeft) / 60);
            const secs = Math.max(0, this.timeLeft) % 60;
            const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

            if (display) {
                display.innerText = timeStr;
                if (this.timeLeft <= 20) {
                    display.style.color = '#ef4444';
                } else if (this.timeLeft <= 45) {
                    display.style.color = '#f59e0b';
                } else {
                    display.style.color = 'var(--color-accent-gold)';
                }
            }

            if (fill) {
                const pct = Math.max(0, Math.min(100, (this.timeLeft / this.maxTime) * 100));
                fill.style.width = `${pct}%`;
            }
        },

        updateHeaderUI: function() {
            const lvlEl = document.getElementById('escape-level-display');
            if (lvlEl) lvlEl.innerText = this.level;

            const locksEl = document.getElementById('escape-locks-display');
            if (locksEl) locksEl.innerText = `${this.currentMechIndex} / 3 🔓`;

            const heartsEl = document.getElementById('escape-hearts-box');
            if (heartsEl) {
                let heartsStr = '';
                for (let i = 0; i < 3; i++) {
                    heartsStr += (i < this.hearts) ? '❤️ ' : '🖤 ';
                }
                heartsEl.innerText = heartsStr.trim();
            }

            // Actualizar insignias de mecanismos en el panel inferior
            for (let i = 1; i <= 3; i++) {
                const badge = document.getElementById(`escape-badge-${i}`);
                if (badge) {
                    badge.classList.remove('active', 'unlocked', 'locked');
                    const idx = i - 1;
                    if (idx < this.currentMechIndex) {
                        badge.classList.add('unlocked');
                    } else if (idx === this.currentMechIndex) {
                        badge.classList.add('active');
                    } else {
                        badge.classList.add('locked');
                    }
                }
            }
        },

        loadMechanism: function(index) {
            this.currentMechIndex = index;
            this.hintUsedThisMech = false;
            this.updateHeaderUI();

            if (index >= this.mechanisms.length) {
                this.triggerVictory();
                return;
            }

            const mech = this.mechanisms[index];
            this.correctAnswer = mech.answer;
            this.options = mech.options;
            this.activeClueFormula = mech.formula;
            this.activeCluePrompt = mech.prompt;
            this.targetCoord = mech.targetCoord || { x: 0, y: 0 };

            // Actualizar texto del sidebar
            const promptEl = document.getElementById('escape-equation-prompt');
            if (promptEl) promptEl.innerText = `Mecanismo ${index + 1}: ${mech.typeName}`;

            const eqEl = document.getElementById('escape-equation');
            if (eqEl) {
                eqEl.innerHTML = `<span style="font-weight: 700; color: #f8fafc;">${mech.question}</span>`;
            }

            const promptBar = document.getElementById('escape-terminal-prompt');
            if (promptBar) {
                promptBar.innerText = mech.instruction || "Introduce la clave en el panel de control:";
            }

            const feedbackEl = document.getElementById('escape-terminal-feedback');
            if (feedbackEl) {
                feedbackEl.classList.add('hidden');
            }

            // Renderizar botones de opciones
            this.renderOptionsGrid();

            // Girar el dial hacia la posición del mecanismo
            this.targetVaultRotation = index * (Math.PI * 2 / 3);
            this.bolts[index].state = 'active';
        },

        renderOptionsGrid: function() {
            const container = document.getElementById('escape-options-container');
            if (!container) return;

            container.innerHTML = '';

            this.options.forEach(optVal => {
                const btn = document.createElement('button');
                btn.className = 'escape-option-btn';
                btn.id = `escape-btn-${String(optVal).replace(/[^a-zA-Z0-9]/g, '_')}`;
                btn.innerText = optVal;

                btn.addEventListener('click', () => {
                    this.handleOptionSelect(optVal, btn);
                });

                container.appendChild(btn);
            });
        },

        handleOptionSelect: function(selectedVal, btnEl) {
            if (!this.isRunning) return;

            const isCorrect = String(selectedVal) === String(this.correctAnswer);

            if (isCorrect) {
                // Correcto: desbloquear mecanismo actual
                if (window.SoundEngine) window.SoundEngine.playCorrect();
                btnEl.classList.add('correct');

                // Deshabilitar todos los botones temporalmente
                const allBtns = document.querySelectorAll('.escape-option-btn');
                allBtns.forEach(b => b.disabled = true);

                // Feedback visual en terminal
                const feedbackEl = document.getElementById('escape-terminal-feedback');
                if (feedbackEl) {
                    feedbackEl.className = 'escape-terminal-feedback success';
                    feedbackEl.innerText = `¡Mecanismo ${this.currentMechIndex + 1} desbloqueado con éxito! 🔓`;
                    feedbackEl.classList.remove('hidden');
                }

                // Animación de cerrojo
                this.bolts[this.currentMechIndex].state = 'unlocked';
                this.createSparks(200, 220, '#10b981');
                this.addFloatingText("¡DESBLOQUEADO!", 200, 160, '#10b981');

                setTimeout(() => {
                    this.loadMechanism(this.currentMechIndex + 1);
                }, 1000);
            } else {
                // Incorrecto: penalización de tiempo (-15s) y feedback
                if (window.SoundEngine) window.SoundEngine.playWrong();
                btnEl.classList.add('wrong');
                setTimeout(() => btnEl.classList.remove('wrong'), 500);

                // Aplicar penalización de tiempo (-15s)
                const penalty = 15;
                this.timeLeft = Math.max(0, this.timeLeft - penalty);
                this.updateTimerUI();

                // Restar un corazón
                this.hearts = Math.max(0, this.hearts - 1);
                this.updateHeaderUI();

                // Partículas y texto de alerta
                this.createSparks(200, 220, '#ef4444');
                this.addFloatingText("-15s PENALIZACIÓN", 200, 160, '#ef4444');

                const feedbackEl = document.getElementById('escape-terminal-feedback');
                if (feedbackEl) {
                    feedbackEl.className = 'escape-terminal-feedback error';
                    feedbackEl.innerText = `¡Código inválido! Penalización de -15s. (${this.hearts} intentos restantes) ⚠️`;
                    feedbackEl.classList.remove('hidden');
                }

                if (this.hearts <= 0 || this.timeLeft <= 0) {
                    setTimeout(() => {
                        this.triggerGameOver("¡Se han agotado los intentos y la sala se bloqueó por seguridad!");
                    }, 600);
                }
            }
        },

        useHint: function() {
            if (!this.isRunning) return false;

            const mech = this.mechanisms[this.currentMechIndex];
            if (!mech) return false;

            // Descartar hasta 2 opciones incorrectas
            const buttons = Array.from(document.querySelectorAll('.escape-option-btn:not(.eliminated)'));
            let eliminatedCount = 0;

            buttons.forEach(btn => {
                if (eliminatedCount < 2 && btn.innerText !== String(this.correctAnswer)) {
                    btn.classList.add('eliminated');
                    btn.disabled = true;
                    eliminatedCount++;
                }
            });

            // Mostrar pista conceptual o fórmula relevante
            const clue = mech.hint || `Pista: Revisa la relación de ${mech.typeName}.`;
            const eqEl = document.getElementById('escape-equation');
            if (eqEl) {
                eqEl.innerHTML += `<div style="margin-top: 6px; font-size: 0.9rem; color: var(--color-accent-gold); border-top: 1px dashed rgba(255,255,255,0.2); padding-top: 4px;">💡 Pista: ${clue}</div>`;
            }

            if (window.showToast) {
                window.showToast(`💡 Pista activada: ${clue}`);
            }

            return true;
        },

        triggerVictory: function() {
            this.stop();
            if (window.SoundEngine) window.SoundEngine.playFanfare();

            // Completar el nivel a través del helper unificado de MathQuest
            let earnedCoins = 40;
            if (typeof window.completeGameLevel === 'function') {
                earnedCoins = window.completeGameLevel('escape', this.level) || 40;
            }

            // Mostrar overlay de victoria
            const overlay = document.getElementById('escape-overlay');
            const title = document.getElementById('escape-overlay-title');
            const text = document.getElementById('escape-overlay-text');
            const btn = document.getElementById('btn-start-escape-game');

            if (title) title.innerHTML = "🎉 ¡ESCAPE EXITOSO! 🚪✨";
            if (text) {
                const nextMsg = this.level === 5 
                    ? "¡Completaste todas las salas de escape! Se ha desbloqueado ⚔️ Duelo Matemático."
                    : `¡Has abierto la compuerta de la Sala ${this.level}! Recompensa: +${earnedCoins} MathCoins 🪙`;
                text.innerHTML = `
                    <p style="font-size: 1.1rem; color: #10b981; font-weight: bold; margin-bottom: 8px;">
                        ¡Los 3 mecanismos han sido resueltos!
                    </p>
                    <p style="color: var(--color-text-muted);">${nextMsg}</p>
                `;
            }

            if (btn) {
                if (this.level === 5) {
                    btn.innerText = "¡Ir al Duelo Final (⚔️ Duelo)!";
                    btn.onclick = () => {
                        overlay.classList.add('hidden');
                        const backBtn = document.getElementById('btn-back-menu');
                        if (backBtn) backBtn.click();
                    };
                } else {
                    btn.innerText = `Entrar a la Sala ${this.level + 1} 🔐`;
                    btn.onclick = () => {
                        overlay.classList.add('hidden');
                        this.start(this.level + 1);
                    };
                }
            }

            if (overlay) overlay.classList.remove('hidden');
        },

        triggerGameOver: function(reason) {
            this.stop();
            if (window.SoundEngine) window.SoundEngine.playWrong();

            const overlay = document.getElementById('escape-overlay');
            const title = document.getElementById('escape-overlay-title');
            const text = document.getElementById('escape-overlay-text');
            const btn = document.getElementById('btn-start-escape-game');

            if (title) title.innerHTML = "🚨 ALARMA ACTIVADA: ATRAPADO 🚨";
            if (text) {
                text.innerHTML = `
                    <p style="font-size: 1rem; color: #ef4444; font-weight: bold; margin-bottom: 6px;">
                        ${reason}
                    </p>
                    <p style="color: var(--color-text-muted);">Puedes intentarlo nuevamente con el tiempo completo de la sala.</p>
                `;
            }

            if (btn) {
                btn.innerText = "Reintentar esta Sala 🔄";
                btn.onclick = () => {
                    overlay.classList.add('hidden');
                    this.start(this.level);
                };
            }

            if (overlay) overlay.classList.remove('hidden');
        },

        /* ==========================================================================
           GENERADOR MATEMÁTICO DE RETOS POR NIVEL (5 NIVELES, 3 MECANISMOS C/U)
           ========================================================================== */
        generateChallenges: function(level) {
            switch (level) {
                case 1:
                    return this.generateLevel1Sequences();
                case 2:
                    return this.generateLevel2InverseProportions();
                case 3:
                    return this.generateLevel3Coordinates();
                case 4:
                    return this.generateLevel4LinearSystems();
                case 5:
                    return this.generateLevel5DivisibilityAndPrimes();
                default:
                    return this.generateLevel1Sequences();
            }
        },

        // NIVEL 1 — SECUENCIAS ARITMÉTICAS
        generateLevel1Sequences: function() {
            // Mecanismo 1: Dial Numérico (Secuencia ascendente)
            const step1 = [2, 3, 4, 5, 10][Math.floor(Math.random() * 5)];
            const start1 = Math.floor(Math.random() * 5) + 1;
            const seq1 = [start1, start1 + step1, start1 + 2 * step1, start1 + 3 * step1];
            const ans1 = start1 + 4 * step1;
            const opts1 = this.shuffleArray([ans1, ans1 - step1, ans1 + step1, ans1 + 2 * step1]);

            // Mecanismo 2: Engranaje (Secuencia descendente)
            const step2 = [2, 3, 4, 5][Math.floor(Math.random() * 4)];
            const start2 = 30 + Math.floor(Math.random() * 10);
            const seq2 = [start2, start2 - step2, start2 - 2 * step2, start2 - 3 * step2];
            const ans2 = start2 - 4 * step2;
            const opts2 = this.shuffleArray([ans2, ans2 + step2, ans2 - step2, ans2 - 2 * step2]);

            // Mecanismo 3: Panel de Salida (Secuencia con paso mayor o geométrica simple)
            const isGeometric = Math.random() > 0.5;
            let seq3, ans3, opts3, clue3;
            if (isGeometric) {
                const ratio = 2;
                const s3 = [2, 3, 4][Math.floor(Math.random() * 3)];
                seq3 = [s3, s3 * ratio, s3 * ratio * ratio, s3 * Math.pow(ratio, 3)];
                ans3 = s3 * Math.pow(ratio, 4);
                opts3 = this.shuffleArray([ans3, ans3 - 4, ans3 + 6, ans3 * 2]);
                clue3 = "Cada número se duplica (multiplicar por 2).";
            } else {
                const step3 = 6;
                const s3 = Math.floor(Math.random() * 5) + 2;
                seq3 = [s3, s3 + step3, s3 + 2 * step3, s3 + 3 * step3];
                ans3 = s3 + 4 * step3;
                opts3 = this.shuffleArray([ans3, ans3 - step3, ans3 + step3, ans3 + 10]);
                clue3 = `La diferencia constante es +${step3}.`;
            }

            return [
                {
                    typeName: "Dial Numérico 🔢",
                    question: `Secuencia: ${seq1.join(', ')}, ¿ ?`,
                    prompt: "Identifica el siguiente valor aritmético.",
                    instruction: "Calcula el término que abre el primer cerrojo:",
                    answer: ans1,
                    options: opts1,
                    hint: `El paso entre cada número es +${step1}.`
                },
                {
                    typeName: "Engranaje Secuencial ⚙️",
                    question: `Secuencia: ${seq2.join(', ')}, ¿ ?`,
                    prompt: "Secuencia decreciente de rotación.",
                    instruction: "Sincroniza los dientes del engranaje con el código:",
                    answer: ans2,
                    options: opts2,
                    hint: `La secuencia va restando -${step2} en cada paso.`
                },
                {
                    typeName: "Panel de Salida 🚪",
                    question: `Secuencia de Compuerta: ${seq3.join(', ')}, ¿ ?`,
                    prompt: "Último código para liberar los pernos.",
                    instruction: "Introduce el código maestro de la puerta:",
                    answer: ans3,
                    options: opts3,
                    hint: clue3
                }
            ];
        },

        // NIVEL 2 — PROPORCIONES INVERSAS (A1 * B1 = A2 * B2 = k)
        generateLevel2InverseProportions: function() {
            // Mecanismo 1: Obreros y Tiempo (Trabajadores vs Horas)
            // A1 * B1 = A2 * B2
            const workers1 = 2;
            const hours1 = 12; // k = 24
            const workers2 = 4;
            const ans1 = 6; // 24 / 4 = 6 horas
            const opts1 = this.shuffleArray([ans1, 8, 10, 3]);

            // Mecanismo 2: Engranajes acoplados (Dientes * RPM = constante)
            // D1 * R1 = D2 * R2
            const d1 = 15;
            const r1 = 40; // k = 600
            const d2 = 30;
            const ans2 = 20; // 600 / 30 = 20 rpm
            const opts2 = this.shuffleArray([ans2, 15, 25, 30]);

            // Mecanismo 3: Bombas de Despresurización y Tiempo
            // B1 * T1 = B2 * T2
            const b1 = 3;
            const t1 = 20; // k = 60
            const b2 = 5;
            const ans3 = 12; // 60 / 5 = 12 min
            const opts3 = this.shuffleArray([ans3, 10, 15, 18]);

            return [
                {
                    typeName: "Dial de Operarios 🔢",
                    question: `Si ${workers1} técnicos tardan ${hours1} h en abrir la esclusa, ¿cuántas horas tardarán ${workers2} técnicos?`,
                    prompt: "Proporcionalidad Inversa: Más técnicos tardan menos tiempo.",
                    instruction: "Calcula las horas necesarias para ajustar el dial:",
                    answer: ans1,
                    options: opts1,
                    hint: `Constante: ${workers1} × ${hours1} = 24. Luego divide 24 entre ${workers2}.`
                },
                {
                    typeName: "Engranaje Acoplado ⚙️",
                    question: `Un engranaje de ${d1} dientes gira a ${r1} RPM. ¿A qué RPM girará el engranaje acoplado de ${d2} dientes?`,
                    prompt: "Dientes × RPM = Constante de rotación.",
                    instruction: "Determina la velocidad RPM del segundo engranaje:",
                    answer: ans2,
                    options: opts2,
                    hint: `Dientes1 × RPM1 = Dientes2 × RPM2 ( ${d1} × ${r1} = ${d1 * r1} ). Divide entre ${d2}.`
                },
                {
                    typeName: "Panel de Evacuación 🚪",
                    question: `Si ${b1} extractores vacían el aire en ${t1} min, ¿cuántos minutos tardarán ${b2} extractores?`,
                    prompt: "Caudal inverso de extracción.",
                    instruction: "Introduce los minutos exactos para destrabar la puerta:",
                    answer: ans3,
                    options: opts3,
                    hint: `Trabajo total: ${b1} × ${t1} = ${b1 * t1}. Divide entre ${b2}.`
                }
            ];
        },

        // NIVEL 3 — COORDENADAS CARTESIANAS (Con plano visual en canvas)
        generateLevel3Coordinates: function() {
            // Puntos en diferentes cuadrantes
            const p1 = { x: 3, y: 2 };
            const ans1 = `(${p1.x}, ${p1.y})`;
            const opts1 = this.shuffleArray([ans1, `(${p1.y}, ${p1.x})`, `(-${p1.x}, ${p1.y})`, `(${p1.x}, -${p1.y})`]);

            const p2 = { x: -3, y: 4 };
            const ans2 = `(${p2.x}, ${p2.y})`;
            const opts2 = this.shuffleArray([ans2, `(${Math.abs(p2.x)}, ${p2.y})`, `(${p2.y}, ${p2.x})`, `(${p2.x}, -${p2.y})`]);

            const p3 = { x: -4, y: -2 };
            const ans3 = `(${p3.x}, ${p3.y})`;
            const opts3 = this.shuffleArray([ans3, `(4, 2)`, `(-2, -4)`, `(-4, 2)`]);

            return [
                {
                    typeName: "Radar Cartesiano (Sensor 1) 🔢",
                    question: `Observa el punto verde en el radar: ¿Cuáles son sus coordenadas (X, Y)?`,
                    prompt: "Eje horizontal X, eje vertical Y.",
                    instruction: "Selecciona el par ordenado (X, Y) del sensor parpadeante:",
                    answer: ans1,
                    options: opts1,
                    targetCoord: p1,
                    hint: `Avanza ${p1.x} unidades en el eje horizontal X y ${p1.y} en el eje vertical Y.`
                },
                {
                    typeName: "Transmisor Cuadrante II ⚙️",
                    question: `Identifica las coordenadas (X, Y) del relé de emergencia en el radar.`,
                    prompt: "En el Cuadrante II: X es negativo e Y es positivo.",
                    instruction: "Alinea la antena con las coordenadas exactas:",
                    answer: ans2,
                    options: opts2,
                    targetCoord: p2,
                    hint: `El punto está a la izquierda del origen (X = ${p2.x}) y hacia arriba (Y = ${p2.y}).`
                },
                {
                    typeName: "Compuerta de Evacuación 🚪",
                    question: `Nodo de escape final marcado en el radar: ¿Cuál es su posición (X, Y)?`,
                    prompt: "Cuadrante III: Ambos valores X e Y son negativos.",
                    instruction: "Ingresa el vector de coordenadas para abrir la puerta:",
                    answer: ans3,
                    options: opts3,
                    targetCoord: p3,
                    hint: `Eje horizontal: ${p3.x}, Eje vertical: ${p3.y}.`
                }
            ];
        },

        // NIVEL 4 — SISTEMAS DE ECUACIONES (2x2)
        generateLevel4LinearSystems: function() {
            // Mech 1: x + y = 14, x - y = 4 => x = 9, y = 5
            const x1 = 9;
            const y1 = 5;
            const s1 = x1 + y1; // 14
            const d1 = x1 - y1; // 4
            const opts1 = this.shuffleArray([x1, y1, x1 + 1, x1 - 2]);

            // Mech 2: x + 2y = 13, x + y = 9 => y = 4, x = 5
            const y2 = 4;
            const x2 = 5;
            const a2 = x2 + 2 * y2; // 13
            const b2 = x2 + y2;     // 9
            const opts2 = this.shuffleArray([y2, x2, y2 + 2, y2 - 1]);

            // Mech 3: 2x + y = 16, y = 6 => 2x = 10 => x = 5
            const y3 = 6;
            const x3 = 5;
            const a3 = 2 * x3 + y3; // 16
            const opts3 = this.shuffleArray([x3, x3 + 2, x3 - 1, 8]);

            return [
                {
                    typeName: "Dial de Ecuaciones 🔢",
                    question: `Sistema: x + y = ${s1}  y  x - y = ${d1}. ¿Cuál es el valor de x?`,
                    prompt: "Suma ambas ecuaciones para cancelar 'y': 2x = (suma).",
                    instruction: "Calcula el valor de la incógnita x para el primer cerrojo:",
                    answer: x1,
                    options: opts1,
                    hint: `Suma: (x + y) + (x - y) = 2x => ${s1} + ${d1} = ${s1 + d1}. Luego divide entre 2.`
                },
                {
                    typeName: "Engranaje Algebraico ⚙️",
                    question: `Sistema: x + 2y = ${a2}  y  x + y = ${b2}. ¿Cuál es el valor de y?`,
                    prompt: "Resta la segunda ecuación de la primera.",
                    instruction: "Determina el valor de la variable y para calibrar el engranaje:",
                    answer: y2,
                    options: opts2,
                    hint: `(x + 2y) - (x + y) = y => ${a2} - ${b2} = ${a2 - b2}.`
                },
                {
                    typeName: "Compuerta de Salida 🚪",
                    question: `Sistema: 2x + y = ${a3}  y  y = ${y3}. ¿Cuál es el valor del código x?`,
                    prompt: "Sustituye el valor conocido de y en la primera ecuación.",
                    instruction: "Introduce el código maestro x para liberar la compuerta:",
                    answer: x3,
                    options: opts3,
                    hint: `2x + ${y3} = ${a3} => 2x = ${a3} - ${y3} = ${a3 - y3} => x = ${x3}.`
                }
            ];
        },

        // NIVEL 5 — DIVISIBILIDAD, PRIMOS Y FACTORIZACIÓN
        generateLevel5DivisibilityAndPrimes: function() {
            // Mech 1: Mayor factor primo de un número compuesto
            // 70 = 2 * 5 * 7 => mayor factor primo es 7
            // 66 = 2 * 3 * 11 => mayor factor primo es 11
            const num1 = 70;
            const ans1 = 7;
            const opts1 = this.shuffleArray([ans1, 5, 10, 35]);

            // Mech 2: MCD de dos números
            // MCD(24, 36) = 12
            const nA = 24;
            const nB = 36;
            const ans2 = 12;
            const opts2 = this.shuffleArray([ans2, 6, 8, 18]);

            // Mech 3: Criterio de divisibilidad por 9
            // 34X => 3 + 4 + X = 7 + X debe ser múltiplo de 9 => X = 2
            const cA = 3;
            const cB = 4;
            const sumAB = cA + cB; // 7
            const ans3 = 2; // 7 + 2 = 9
            const opts3 = this.shuffleArray([ans3, 3, 5, 7]);

            return [
                {
                    typeName: "Dial de Factorización 🔢",
                    question: `¿Cuál es el mayor factor primo de ${num1}? (${num1} = 2 × 5 × 7)`,
                    prompt: "Un factor primo solo es divisible por 1 y por sí mismo.",
                    instruction: "Introduce el mayor divisor primo para abrir el cerrojo:",
                    answer: ans1,
                    options: opts1,
                    hint: `Los divisores primos de 70 son 2, 5 y 7. El mayor de ellos es 7.`
                },
                {
                    typeName: "Engranaje Sincronizado ⚙️",
                    question: `Calcula el Máximo Común Divisor: MCD(${nA}, ${nB}) para acoplar los engranajes.`,
                    prompt: "MCD es el mayor número entero que divide a ambos sin residuo.",
                    instruction: "Calcula el MCD para alinear la rotación:",
                    answer: ans2,
                    options: opts2,
                    hint: `Divisores de 24: 1,2,3,4,6,8,12,24. Divisores de 36: 1,2,3,4,6,9,12,18,36. El mayor común es 12.`
                },
                {
                    typeName: "Panel de Divisibilidad 🚪",
                    question: `Para que el código ${cA}${cB}X sea divisible por 9, ¿qué dígito debe ser X?`,
                    prompt: "Criterio de divisibilidad del 9: La suma de sus dígitos debe ser 9, 18, 27...",
                    instruction: "Introduce el último dígito para abrir la compuerta final:",
                    answer: ans3,
                    options: opts3,
                    hint: `Suma: ${cA} + ${cB} + X = ${sumAB} + X. El siguiente múltiplo de 9 es 9, por lo tanto X = 9 - ${sumAB} = ${ans3}.`
                }
            ];
        },

        shuffleArray: function(arr) {
            const copy = [...arr];
            for (let i = copy.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [copy[i], copy[j]] = [copy[j], copy[i]];
            }
            return copy;
        },

        /* ==========================================================================
           RENDERIZADOR GRÁFICO DEL ESCAPE ROOM (CANVAS 400x450)
           ========================================================================== */
        startLoop: function() {
            const render = () => {
                if (!this.isRunning) return;
                this.updatePhysics();
                this.draw();
                this.animFrameId = requestAnimationFrame(render);
            };
            this.animFrameId = requestAnimationFrame(render);
        },

        updatePhysics: function() {
            // Suavizado del giro del dial de la bóveda
            const rotDiff = this.targetVaultRotation - this.vaultRotation;
            this.vaultRotation += rotDiff * 0.08;

            // Progreso de apertura de compuerta si todos los mecanismos están desbloqueados
            if (this.currentMechIndex >= 3) {
                this.doorOpenProgress = Math.min(1, this.doorOpenProgress + 0.02);
            }

            // Actualizar cerrojos
            this.bolts.forEach((b, idx) => {
                if (idx < this.currentMechIndex) {
                    b.progress = Math.min(1, b.progress + 0.1);
                }
            });

            // Radar sweep para el nivel 3
            this.radarSweepAngle = (this.radarSweepAngle + 0.04) % (Math.PI * 2);

            // Partículas
            for (let i = this.particles.length - 1; i >= 0; i--) {
                const p = this.particles[i];
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.1; // gravedad
                p.alpha -= 0.02;
                if (p.alpha <= 0) {
                    this.particles.splice(i, 1);
                }
            }

            // Textos flotantes
            for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
                const ft = this.floatingTexts[i];
                ft.y -= 0.8;
                ft.alpha -= 0.015;
                if (ft.alpha <= 0) {
                    this.floatingTexts.splice(i, 1);
                }
            }
        },

        draw: function() {
            if (!this.ctx) return;
            const ctx = this.ctx;
            const w = this.canvas.width;
            const h = this.canvas.height;

            // Fondo de la sala de escape de alta tecnología
            ctx.fillStyle = '#090d16';
            ctx.fillRect(0, 0, w, h);

            // Muros y paneles metálicos
            this.drawRoomWalls(ctx, w, h);

            if (this.level === 3) {
                // NIVEL 3: Pantalla CRT de Radar Cartesiano Central
                this.drawCartesianRadar(ctx, w, h);
            } else {
                // OTROS NIVELES: Gran Bóveda Central con Mecanismos y Engranajes
                this.drawVaultDoor(ctx, w / 2, h / 2 - 20);
            }

            // Indicadores de Cerrojos y Estado de Mecanismos
            this.drawMechanismsHUD(ctx, w, h);

            // Dibujar partículas y efectos
            this.drawParticles(ctx);
            this.drawFloatingTexts(ctx);
        },

        drawRoomWalls: function(ctx, w, h) {
            // Marco metálico de la habitación
            ctx.strokeStyle = '#1e293b';
            ctx.lineWidth = 4;
            ctx.strokeRect(6, 6, w - 12, h - 12);

            // Remaches y pernos en las esquinas
            const rivets = [
                { x: 18, y: 18 }, { x: w - 18, y: 18 },
                { x: 18, y: h - 18 }, { x: w - 18, y: h - 18 }
            ];
            rivets.forEach(r => {
                ctx.fillStyle = '#475569';
                ctx.beginPath();
                ctx.arc(r.x, r.y, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#94a3b8';
                ctx.lineWidth = 1;
                ctx.stroke();
            });

            // Tuberías y cables superiores
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(10, 30);
            ctx.lineTo(w - 10, 30);
            ctx.stroke();

            // Luz de emergencia superior
            const lightColor = this.timeLeft <= 20 ? '#ef4444' : (this.currentMechIndex >= 3 ? '#10b981' : '#f59e0b');
            ctx.fillStyle = lightColor;
            ctx.beginPath();
            ctx.arc(w / 2, 24, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowColor = lightColor;
            ctx.shadowBlur = 12;
            ctx.fill();
            ctx.shadowBlur = 0;
        },

        drawVaultDoor: function(ctx, cx, cy) {
            const radius = 120;

            // Luz de fondo si la compuerta se está abriendo
            if (this.doorOpenProgress > 0) {
                const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, radius * 1.5);
                grad.addColorStop(0, 'rgba(16, 185, 129, 0.8)');
                grad.addColorStop(0.5, 'rgba(56, 189, 248, 0.4)');
                grad.addColorStop(1, 'transparent');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(cx, cy, radius * 1.4, 0, Math.PI * 2);
                ctx.fill();
            }

            // Anillo exterior de la bóveda
            ctx.save();
            ctx.fillStyle = '#1e293b';
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // 3 Cerrojos hidráulicos en el perímetro (120° c/u)
            const boltAngles = [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6];
            boltAngles.forEach((angle, idx) => {
                const bolt = this.bolts[idx];
                const isUnlocked = idx < this.currentMechIndex;
                const extension = isUnlocked ? -18 : 12; // Se retrae al desbloquear

                const bx = cx + Math.cos(angle) * (radius + extension);
                const by = cy + Math.sin(angle) * (radius + extension);

                ctx.save();
                ctx.translate(bx, by);
                ctx.rotate(angle);

                // Cerrojo de acero
                ctx.fillStyle = isUnlocked ? '#10b981' : (idx === this.currentMechIndex ? '#f59e0b' : '#64748b');
                ctx.fillRect(-12, -8, 24, 16);
                ctx.strokeStyle = '#0f172a';
                ctx.lineWidth = 2;
                ctx.strokeRect(-12, -8, 24, 16);

                // LED indicador del cerrojo
                ctx.fillStyle = isUnlocked ? '#34d399' : (idx === this.currentMechIndex ? '#fbbf24' : '#ef4444');
                ctx.beginPath();
                ctx.arc(0, 0, 4, 0, Math.PI * 2);
                ctx.fill();

                ctx.restore();
            });

            // Rueda circular central giratoria
            ctx.translate(cx, cy);
            ctx.rotate(this.vaultRotation);

            // Escotilla central
            ctx.fillStyle = '#0f172a';
            ctx.strokeStyle = '#475569';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(0, 0, radius - 25, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Rayos o radios de la rueda de la bóveda
            for (let i = 0; i < 6; i++) {
                const rad = (i * Math.PI) / 3;
                ctx.strokeStyle = '#334155';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(Math.cos(rad) * (radius - 30), Math.sin(rad) * (radius - 30));
                ctx.stroke();
            }

            // Engranaje central
            ctx.fillStyle = '#f59e0b';
            ctx.beginPath();
            ctx.arc(0, 0, 22, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#d97706';
            ctx.lineWidth = 3;
            ctx.stroke();

            // Candado / Icono central
            ctx.restore();

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 24px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const icon = this.currentMechIndex >= 3 ? '🔓' : (this.currentMechIndex === 0 ? '🔢' : (this.currentMechIndex === 1 ? '⚙️' : '🚪'));
            ctx.fillText(icon, cx, cy);
        },

        // PLANO CARTESIANO VISUAL (NIVEL 3)
        drawCartesianRadar: function(ctx, w, h) {
            const cx = w / 2;
            const cy = h / 2 - 20;
            const size = 260;
            const half = size / 2;
            const step = size / 10; // -5 a +5 (10 divisiones)

            // Marco del monitor CRT
            ctx.fillStyle = '#0f172a';
            ctx.strokeStyle = '#0284c7';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.roundRect(cx - half - 10, cy - half - 10, size + 20, size + 20, 10);
            ctx.fill();
            ctx.stroke();

            // Cuadrícula interior
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
            ctx.lineWidth = 1;

            for (let i = -5; i <= 5; i++) {
                const x = cx + i * step;
                const y = cy + i * step;

                // Líneas verticales
                ctx.beginPath();
                ctx.moveTo(x, cy - half);
                ctx.lineTo(x, cy + half);
                ctx.stroke();

                // Líneas horizontales
                ctx.beginPath();
                ctx.moveTo(cx - half, y);
                ctx.lineTo(cx + half, y);
                ctx.stroke();
            }

            // Ejes principales X e Y
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 2;

            // Eje X (horizontal)
            ctx.beginPath();
            ctx.moveTo(cx - half, cy);
            ctx.lineTo(cx + half, cy);
            ctx.stroke();

            // Eje Y (vertical)
            ctx.beginPath();
            ctx.moveTo(cx, cy - half);
            ctx.lineTo(cx, cy + half);
            ctx.stroke();

            // Etiquetas de ejes y números clave
            ctx.fillStyle = '#94a3b8';
            ctx.font = '10px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';

            [-4, -2, 2, 4].forEach(val => {
                // En eje X
                ctx.fillText(String(val), cx + val * step, cy + 3);
                // En eje Y
                ctx.fillText(String(val), cx - 12, cy - val * step - 5);
            });

            ctx.fillStyle = '#38bdf8';
            ctx.font = 'bold 12px sans-serif';
            ctx.fillText("X", cx + half - 8, cy - 14);
            ctx.fillText("Y", cx + 12, cy - half + 4);

            // Radar sweep rotativo
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.cos(this.radarSweepAngle) * half, cy + Math.sin(this.radarSweepAngle) * half);
            ctx.stroke();

            // Punto objetivo activo del desafío
            const tx = cx + this.targetCoord.x * step;
            const ty = cy - this.targetCoord.y * step; // En canvas Y crece hacia abajo

            // Ondas expansivas alrededor del punto objetivo
            const pulse = (Date.now() % 1000) / 1000;
            ctx.strokeStyle = `rgba(16, 185, 129, ${1 - pulse})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(tx, ty, 6 + pulse * 14, 0, Math.PI * 2);
            ctx.stroke();

            // Punto objetivo
            ctx.fillStyle = '#10b981';
            ctx.beginPath();
            ctx.arc(tx, ty, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Líneas punteadas hacia los ejes
            ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.lineTo(tx, cy);
            ctx.moveTo(tx, ty);
            ctx.lineTo(cx, ty);
            ctx.stroke();
            ctx.setLineDash([]);
        },

        drawMechanismsHUD: function(ctx, w, h) {
            const barY = h - 45;

            // Barra de estado de cerrojos
            ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(15, barY, w - 30, 36, 6);
            ctx.fill();
            ctx.stroke();

            // 3 Luces de estado de los mecanismos
            const mechs = [
                { name: '1. Dial', icon: '🔢' },
                { name: '2. Engranaje', icon: '⚙️' },
                { name: '3. Compuerta', icon: '🚪' }
            ];

            const colW = (w - 30) / 3;
            mechs.forEach((m, i) => {
                const mx = 15 + i * colW + colW / 2;
                const isUnlocked = i < this.currentMechIndex;
                const isActive = i === this.currentMechIndex;

                const color = isUnlocked ? '#10b981' : (isActive ? '#f59e0b' : '#64748b');

                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(mx - 32, barY + 18, 5, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = isUnlocked ? '#34d399' : (isActive ? '#fbbf24' : '#94a3b8');
                ctx.font = 'bold 11px sans-serif';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(`${m.icon} ${m.name}`, mx - 22, barY + 18);
            });
        },

        createSparks: function(x, y, color) {
            for (let i = 0; i < 18; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * 4 + 2;
                this.particles.push({
                    x,
                    y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    alpha: 1,
                    color: color || '#f59e0b'
                });
            }
        },

        addFloatingText: function(text, x, y, color) {
            this.floatingTexts.push({
                text,
                x,
                y,
                alpha: 1,
                color: color || '#ffffff'
            });
        },

        drawParticles: function(ctx) {
            this.particles.forEach(p => {
                ctx.save();
                ctx.globalAlpha = p.alpha;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            });
        },

        drawFloatingTexts: function(ctx) {
            this.floatingTexts.forEach(ft => {
                ctx.save();
                ctx.globalAlpha = ft.alpha;
                ctx.fillStyle = ft.color;
                ctx.font = 'bold 16px sans-serif';
                ctx.textAlign = 'center';
                ctx.shadowColor = ft.color;
                ctx.shadowBlur = 8;
                ctx.fillText(ft.text, ft.x, ft.y);
                ctx.restore();
            });
        }
    };

    window.MathQuestGames['escape'] = EscapeGame;

    // Inicialización al cargar el script
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => EscapeGame.init());
    } else {
        EscapeGame.init();
    }
})();
