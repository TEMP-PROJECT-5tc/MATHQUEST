/* ==========================================================================
   MathQuest V3 - Módulo Constructor Matemático (Fase 4.3 - Implementación Completa)
   Geometría, Áreas, Perímetros, Estabilidad Determinista y Volumen Isométrico
   ========================================================================== */

(function() {
    'use strict';

    window.MathQuestGames = window.MathQuestGames || {};

    // Dimensiones canónicas del canvas
    const CANVAS_WIDTH = 400;
    const CANVAS_HEIGHT = 450;

    // Variables de estado del juego
    let canvas = null;
    let ctx = null;
    let level = 1;
    let isRunning = false;
    let isPaused = false;
    let animFrameId = null;

    let lives = 3;
    let stability = 100; // Porcentaje de 0 a 100%
    let piecesPlaced = 0;
    let piecesTarget = 4;
    let screenShake = 0;

    // Temporizador por problema (niveles 3 a 5)
    let turnTimer = null;
    let turnTimeLeft = 35;
    let maxTurnTime = 35;

    // Desafío matemático actual
    let currentChallenge = null;
    let eliminatedOptions = [];
    let isHintActiveForCurrentProblem = false;

    // Partículas y textos flotantes
    let particles = [];
    let floatTexts = [];

    // Estructura visual acumulada para renderizado
    let placedBlocks = [];
    let beamAngle = 0; // Para el nivel 3 de estabilidad (-0.2 a +0.2 rad)
    let targetBeamAngle = 0;

    // Configuración por nivel
    const LEVEL_CONFIG = {
        1: { target: 4, label: 'Nivel 1: Área de Cimientos y Muros', hasTimer: false },
        2: { target: 5, label: 'Nivel 2: Área vs Perímetro Estructural', hasTimer: false },
        3: { target: 5, label: 'Nivel 3: Estabilidad y Momentos de Equilibrio', hasTimer: true, time: 35 },
        4: { target: 5, label: 'Nivel 4: Áreas Compuestas y Vano de Estructura', hasTimer: true, time: 40 },
        5: { target: 5, label: 'Nivel 5: Volumen 3D y Rascacielos por Capas', hasTimer: true, time: 40 }
    };

    /* --------------------------------------------------------------------------
       Generador Matemático Geométrico y Estructural
       -------------------------------------------------------------------------- */
    function generateBuilderMath(lvl) {
        let promptText = "";
        let formulaText = "";
        let promptSub = "Cálculo Geométrico:";
        let answer = 0;
        let unit = "";
        let diagramData = null;
        let distractors = [];

        switch (lvl) {
            case 1: { // Área de Rectángulos y Cuadrados
                const isSquare = Math.random() > 0.55;
                if (isSquare) {
                    const side = Math.floor(Math.random() * 6) + 4; // 4 a 9
                    answer = side * side;
                    unit = "m²";
                    promptSub = "Área de Bloque Cuadrado:";
                    promptText = `Lado = ${side} m`;
                    formulaText = `A = L^2 = ${side} \\times ${side} = ?`;
                    diagramData = { type: 'square', side: side };
                    distractors = [
                        side * 4, // Error común: perímetro
                        side * 2,
                        answer + (Math.random() > 0.5 ? side : -side)
                    ];
                } else {
                    const base = Math.floor(Math.random() * 6) + 5; // 5 a 10
                    const height = Math.floor(Math.random() * 5) + 3; // 3 a 7
                    answer = base * height;
                    unit = "m²";
                    promptSub = "Área de Losa Rectangular:";
                    promptText = `Base = ${base} m, Altura = ${height} m`;
                    formulaText = `A = b \\times h = ${base} \\times ${height} = ?`;
                    diagramData = { type: 'rect', base: base, height: height };
                    distractors = [
                        2 * (base + height), // Error común: perímetro
                        base + height,
                        (base + 1) * height
                    ];
                }
                break;
            }

            case 2: { // Área y Perímetro combinados
                const askPerimeter = Math.random() > 0.5;
                const isSquare = Math.random() > 0.5;

                if (isSquare) {
                    const side = Math.floor(Math.random() * 6) + 4; // 4 a 9
                    if (askPerimeter) {
                        answer = 4 * side;
                        unit = "m";
                        promptSub = "¡Atención! Calcula el PERÍMETRO:";
                        promptText = `Columna Cuadrada: Lado = ${side} m`;
                        formulaText = `P = 4 \\times L = 4 \\times ${side} = ?`;
                        diagramData = { type: 'square', side: side, target: 'P' };
                        distractors = [
                            side * side, // Confusión con área
                            2 * side,
                            (side + 2) * 4
                        ];
                    } else {
                        answer = side * side;
                        unit = "m²";
                        promptSub = "Calcula el ÁREA:";
                        promptText = `Columna Cuadrada: Lado = ${side} m`;
                        formulaText = `A = L^2 = ${side}^2 = ?`;
                        diagramData = { type: 'square', side: side, target: 'A' };
                        distractors = [
                            4 * side, // Confusión con perímetro
                            side * 2,
                            (side + 1) * (side - 1)
                        ];
                    }
                } else {
                    const base = Math.floor(Math.random() * 6) + 5; // 5 a 10
                    const height = Math.floor(Math.random() * 4) + 3; // 3 a 6
                    if (askPerimeter) {
                        answer = 2 * (base + height);
                        unit = "m";
                        promptSub = "¡Atención! Calcula el PERÍMETRO:";
                        promptText = `Viga Rectangular: Base = ${base} m, Altura = ${height} m`;
                        formulaText = `P = 2(b + h) = 2(${base} + ${height}) = ?`;
                        diagramData = { type: 'rect', base: base, height: height, target: 'P' };
                        distractors = [
                            base * height, // Confusión con área
                            base + height,
                            2 * base + height
                        ];
                    } else {
                        answer = base * height;
                        unit = "m²";
                        promptSub = "Calcula el ÁREA:";
                        promptText = `Viga Rectangular: Base = ${base} m, Altura = ${height} m`;
                        formulaText = `A = b \\times h = ${base} \\times ${height} = ?`;
                        diagramData = { type: 'rect', base: base, height: height, target: 'A' };
                        distractors = [
                            2 * (base + height), // Confusión con perímetro
                            base + height,
                            (base - 1) * height
                        ];
                    }
                }
                break;
            }

            case 3: { // Estabilidad - Equilibrio Discreto de Momentos (Torque)
                // Viga sobre fulcro en x=0, posiciones [-3, -2, -1, 0, +1, +2, +3]
                // Regla determinista: Peso_izq * Dist_izq = Peso_der * Dist_der
                const type = Math.random() > 0.5 ? 'find_pos' : 'find_weight';

                if (type === 'find_pos') {
                    // Carga izquierda conocida, peso derecho conocido, hallar posición derecha d2
                    // d1 * w1 = d2 * w2
                    const pairs = [
                        { d1: 3, w1: 2, w2: 3, d2: 2 }, // 6 = 6
                        { d1: 2, w1: 6, w2: 4, d2: 3 }, // 12 = 12
                        { d1: 1, w1: 8, w2: 4, d2: 2 }, // 8 = 8
                        { d1: 3, w1: 4, w2: 6, d2: 2 }, // 12 = 12
                        { d1: 2, w1: 3, w2: 2, d2: 3 }, // 6 = 6
                        { d1: 1, w1: 9, w2: 3, d2: 3 }  // 9 = 9
                    ];
                    const selected = pairs[Math.floor(Math.random() * pairs.length)];
                    answer = selected.d2;
                    unit = "pos";
                    promptSub = "Equilibrio: ¿En qué posición derecha?";
                    promptText = `Carga Izq: ${selected.w1} t a dist. -${selected.d1} | Contrapeso Der: ${selected.w2} t`;
                    formulaText = `${selected.w1} \\times ${selected.d1} = ${selected.w2} \\times d_2 \\implies d_2 = ?`;
                    diagramData = {
                        type: 'balance',
                        d1: selected.d1,
                        w1: selected.w1,
                        w2: selected.w2,
                        d2: selected.d2,
                        unknown: 'd2'
                    };
                    distractors = [1, 2, 3].filter(p => p !== answer);
                    if (distractors.length < 3) distractors.push(4);
                } else {
                    // Carga izquierda conocida, posición derecha conocida, hallar peso derecho w2
                    const pairs = [
                        { d1: 2, w1: 6, d2: 3, w2: 4 },
                        { d1: 3, w1: 2, d2: 2, w2: 3 },
                        { d1: 1, w1: 10, d2: 2, w2: 5 },
                        { d1: 2, w1: 8, d2: 4, w2: 4 },
                        { d1: 3, w1: 4, d2: 2, w2: 6 }
                    ];
                    const selected = pairs[Math.floor(Math.random() * pairs.length)];
                    answer = selected.w2;
                    unit = "t";
                    promptSub = "Equilibrio: ¿Qué peso para nivelar?";
                    promptText = `Carga Izq: ${selected.w1} t a dist. -${selected.d1} | Posición Der: +${selected.d2}`;
                    formulaText = `${selected.w1} \\times ${selected.d1} = W_2 \\times ${selected.d2} \\implies W_2 = ?`;
                    diagramData = {
                        type: 'balance',
                        d1: selected.d1,
                        w1: selected.w1,
                        w2: selected.w2,
                        d2: selected.d2,
                        unknown: 'w2'
                    };
                    distractors = [
                        answer + 1,
                        answer - 1 > 0 ? answer - 1 : answer + 2,
                        answer + 2
                    ];
                }
                break;
            }

            case 4: { // Áreas Compuestas
                const type = Math.floor(Math.random() * 3);
                if (type === 0) { // Figura en L (Suma de 2 rectángulos)
                    const b1 = Math.floor(Math.random() * 3) + 4; // 4 a 6
                    const h1 = 3;
                    const b2 = 2;
                    const h2 = Math.floor(Math.random() * 3) + 3; // 3 a 5
                    answer = (b1 * h1) + (b2 * h2);
                    unit = "m²";
                    promptSub = "Área Total Compuesta (Figura en L):";
                    promptText = `Base: ${b1}×${h1} m + Torreta: ${b2}×${h2} m`;
                    formulaText = `A_T = (${b1} \\times ${h1}) + (${b2} \\times ${h2}) = ?`;
                    diagramData = { type: 'l_shape', b1, h1, b2, h2 };
                    distractors = [
                        b1 * (h1 + h2),
                        (b1 * h1) + h2,
                        answer - 4
                    ];
                } else if (type === 1) { // Muro con Vano/Ventana (Resta de áreas)
                    const totalW = 8;
                    const totalH = 5;
                    const holeW = 2;
                    const holeH = 2;
                    answer = (totalW * totalH) - (holeW * holeH); // 40 - 4 = 36
                    unit = "m²";
                    promptSub = "Área Neta de Muro con Ventana:";
                    promptText = `Muro: ${totalW}×${totalH} m con Vano: ${holeW}×${holeH} m`;
                    formulaText = `A_{neto} = (${totalW} \\times ${totalH}) - (${holeW} \\times ${holeH}) = ?`;
                    diagramData = { type: 'hole_shape', totalW, totalH, holeW, holeH };
                    distractors = [
                        totalW * totalH, // Sin restar
                        (totalW * totalH) + (holeW * holeH),
                        answer + 4
                    ];
                } else { // Rectángulo con techumbre triangular
                    const b = 6;
                    const hRect = 4;
                    const hTri = 4;
                    const triArea = (b * hTri) / 2; // 12
                    answer = (b * hRect) + triArea; // 24 + 12 = 36
                    unit = "m²";
                    promptSub = "Área de Fachada con Frontón:";
                    promptText = `Muro: ${b}×${hRect} m + Techo Triang.: Base ${b} m, Altura ${hTri} m`;
                    formulaText = `A_T = (${b} \\times ${hRect}) + \\frac{${b} \\times ${hTri}}{2} = ?`;
                    diagramData = { type: 'house_shape', b, hRect, hTri };
                    distractors = [
                        (b * hRect) + (b * hTri), // Sin dividir el triángulo
                        (b * hRect) - triArea,
                        answer - 6
                    ];
                }
                break;
            }

            case 5: // Volumen y Capas (3D Simplificado)
            default: {
                const type = Math.floor(Math.random() * 3);
                if (type === 0) { // Volumen de Prisma Rectangular: V = L * W * H
                    const l = Math.floor(Math.random() * 3) + 3; // 3 a 5
                    const w = Math.floor(Math.random() * 2) + 2; // 2 a 3
                    const h = Math.floor(Math.random() * 3) + 3; // 3 a 5
                    answer = l * w * h;
                    unit = "m³";
                    promptSub = "Volumen de Prisma Rectangular:";
                    promptText = `Largo = ${l} m, Ancho = ${w} m, Alto = ${h} m`;
                    formulaText = `V = L \\times W \\times H = ${l} \\times ${w} \\times ${h} = ?`;
                    diagramData = { type: 'prism_3d', l, w, h };
                    distractors = [
                        l * w + h,
                        2 * (l * w + w * h + l * h),
                        answer + l * w
                    ];
                } else if (type === 1) { // Total de bloques por capas
                    const blocksPerLayer = Math.floor(Math.random() * 6) + 8; // 8 a 13
                    const layers = Math.floor(Math.random() * 3) + 3; // 3 a 5
                    answer = blocksPerLayer * layers;
                    unit = "bloques";
                    promptSub = "Construcción por Capas:";
                    promptText = `Cada capa requiere ${blocksPerLayer} bloques | Torre de ${layers} capas`;
                    formulaText = `Total = ${blocksPerLayer} \\times ${layers} = ?`;
                    diagramData = { type: 'layers_3d', blocksPerLayer, layers };
                    distractors = [
                        blocksPerLayer + layers,
                        blocksPerLayer * (layers - 1),
                        answer + blocksPerLayer
                    ];
                } else { // Cálculo de número de capas: H = V / A_base
                    const baseArea = Math.floor(Math.random() * 4) + 8; // 8 a 11
                    const layers = Math.floor(Math.random() * 4) + 3; // 3 a 6
                    const totalBlocks = baseArea * layers;
                    answer = layers;
                    unit = "capas";
                    promptSub = "¿Cuántas Capas de Altura?:";
                    promptText = `Total Bloques = ${totalBlocks} | Base de la torre = ${baseArea} bloques`;
                    formulaText = `Capas = \\frac{${totalBlocks}}{${baseArea}} = ?`;
                    diagramData = { type: 'layers_3d', blocksPerLayer: baseArea, layers };
                    distractors = [
                        layers + 1,
                        layers - 1 > 0 ? layers - 1 : layers + 2,
                        Math.round(totalBlocks / 4)
                    ];
                }
                break;
            }
        }

        // Limpiar distractores: asegurar unicidad y valores enteros positivos válidos
        const cleanDistractors = [];
        for (let d of distractors) {
            let candidate = Math.round(d);
            if (candidate <= 0 || candidate === answer || cleanDistractors.includes(candidate)) {
                candidate = answer + (cleanDistractors.length + 1) * (Math.random() > 0.5 ? 2 : -2);
                if (candidate <= 0) candidate = answer + cleanDistractors.length + 1;
            }
            cleanDistractors.push(candidate);
        }

        // 4 Opciones barajadas aleatoriamente
        const allOptions = [
            { val: answer, isCorrect: true, unit: unit },
            { val: cleanDistractors[0], isCorrect: false, unit: unit },
            { val: cleanDistractors[1], isCorrect: false, unit: unit },
            { val: cleanDistractors[2], isCorrect: false, unit: unit }
        ];

        // Mezclar opciones
        for (let i = allOptions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allOptions[i], allOptions[j]] = [allOptions[j], allOptions[i]];
        }

        return {
            prompt: promptText,
            promptSub: promptSub,
            formula: formulaText,
            answer: answer,
            unit: unit,
            diagram: diagramData,
            options: allOptions
        };
    }

    /* --------------------------------------------------------------------------
       Actualización del HUD y Opciones en el DOM
       -------------------------------------------------------------------------- */
    function updateHUD() {
        const heartsBox = document.getElementById('builder-hearts-box');
        if (heartsBox) {
            let hStr = '';
            for (let i = 0; i < 3; i++) {
                hStr += (i < lives) ? '❤️ ' : '🤍 ';
            }
            heartsBox.innerText = hStr.trim();
        }

        const stabEl = document.getElementById('builder-stability-display');
        if (stabEl) {
            stabEl.innerText = `${stability}%`;
            stabEl.style.color = stability > 60 ? 'var(--color-accent-green)' : (stability > 30 ? '#f59e0b' : '#ef4444');
        }

        const lvlEl = document.getElementById('builder-level-display');
        if (lvlEl) lvlEl.innerText = level;

        const piecesCountEl = document.getElementById('builder-pieces-count');
        if (piecesCountEl) piecesCountEl.innerText = `${piecesPlaced} / ${piecesTarget} Piezas 🧱`;

        const progFill = document.getElementById('builder-progress-fill');
        if (progFill) {
            const pct = Math.min(100, Math.round((piecesPlaced / piecesTarget) * 100));
            progFill.style.width = `${pct}%`;
        }

        const eqEl = document.getElementById('builder-equation');
        if (eqEl && currentChallenge) {
            if (window.renderLaTeX) {
                window.renderLaTeX(currentChallenge.formula || currentChallenge.prompt, eqEl);
            } else {
                eqEl.innerText = currentChallenge.prompt;
            }
        }

        const promptLabel = document.getElementById('builder-equation-prompt');
        if (promptLabel && currentChallenge) {
            promptLabel.innerText = currentChallenge.promptSub || "Cálculo Geométrico:";
        }

        // Renderizar opciones de piezas en el contenedor inferior
        renderOptionButtons();
    }

    function renderOptionButtons() {
        const container = document.getElementById('builder-options-container');
        if (!container || !currentChallenge) return;

        container.innerHTML = '';

        currentChallenge.options.forEach((opt, idx) => {
            const btn = document.createElement('button');
            btn.className = 'builder-option-btn';
            btn.id = `builder-opt-${idx}`;

            if (eliminatedOptions.includes(idx)) {
                btn.classList.add('eliminated');
                btn.disabled = true;
            }

            const iconSpan = document.createElement('span');
            iconSpan.className = 'builder-option-icon';
            iconSpan.innerText = level === 3 ? '⚖️' : (level === 5 ? '🧊' : '🧱');

            const valSpan = document.createElement('span');
            valSpan.className = 'builder-option-val';
            valSpan.innerText = `${opt.val} ${opt.unit}`;

            btn.appendChild(iconSpan);
            btn.appendChild(valSpan);

            btn.onclick = () => {
                handleOptionClick(opt, idx, btn);
            };

            container.appendChild(btn);
        });
    }

    /* --------------------------------------------------------------------------
       Temporizador de Turno
       -------------------------------------------------------------------------- */
    function startTurnTimer() {
        stopTurnTimer();
        const cfg = LEVEL_CONFIG[level] || LEVEL_CONFIG[1];
        const timerPanel = document.getElementById('builder-timer-panel');

        if (!cfg.hasTimer) {
            if (timerPanel) timerPanel.classList.add('hidden');
            return;
        }

        if (timerPanel) timerPanel.classList.remove('hidden');
        maxTurnTime = cfg.time || 35;
        turnTimeLeft = maxTurnTime;
        updateTimerBar();

        turnTimer = setInterval(() => {
            if (!isRunning || isPaused) return;

            turnTimeLeft--;
            updateTimerBar();

            if (turnTimeLeft <= 0) {
                stopTurnTimer();
                handleTimeoutFailure();
            }
        }, 1000);
    }

    function stopTurnTimer() {
        if (turnTimer) {
            clearInterval(turnTimer);
            turnTimer = null;
        }
    }

    function updateTimerBar() {
        const txt = document.getElementById('builder-timer-text');
        const fill = document.getElementById('builder-timer-fill');
        if (txt) txt.innerText = `${turnTimeLeft}s`;
        if (fill) {
            const pct = Math.max(0, Math.min(100, (turnTimeLeft / maxTurnTime) * 100));
            fill.style.width = `${pct}%`;
        }
    }

    function handleTimeoutFailure() {
        lives--;
        stability = Math.max(0, stability - 25);
        screenShake = 15;
        updateHUD();

        if (window.SoundEngine && typeof window.SoundEngine.playWrong === 'function') {
            window.SoundEngine.playWrong();
        }

        addFloatText("¡Tiempo agotado! -1 ❤️", CANVAS_WIDTH / 2, 220, '#ef4444');

        if (lives <= 0 || stability <= 0) {
            handleGameOver();
            return;
        }

        // Cargar nuevo desafío
        spawnChallenge();
        startTurnTimer();
    }

    /* --------------------------------------------------------------------------
       Lógica de Selección de Opciones y Feedback
       -------------------------------------------------------------------------- */
    function handleOptionClick(opt, idx, btn) {
        if (!isRunning || isPaused) return;

        if (opt.isCorrect) {
            // ¡Acierto!
            btn.classList.add('correct');
            piecesPlaced++;
            stability = Math.min(100, stability + 10);
            updateHUD();

            if (window.SoundEngine && typeof window.SoundEngine.playCorrect === 'function') {
                window.SoundEngine.playCorrect();
            }

            // Registrar colocación de pieza para dibujo en canvas
            recordBlockPlacement();
            createConstructionSparks(CANVAS_WIDTH / 2, 300 - (piecesPlaced * 35));
            addFloatText("¡Pieza Colocada! 🧱✨", CANVAS_WIDTH / 2, 180, '#10b981');

            if (level === 3) {
                targetBeamAngle = 0; // Nivelar viga
            }

            // Pausa breve para animación y verificar victoria
            isPaused = true;
            stopTurnTimer();

            setTimeout(() => {
                isPaused = false;
                if (piecesPlaced >= piecesTarget) {
                    handleLevelWin();
                } else {
                    spawnChallenge();
                    startTurnTimer();
                }
            }, 600);

        } else {
            // ¡Fallo!
            btn.classList.add('wrong');
            lives--;
            stability = Math.max(0, stability - 25);
            screenShake = 14;
            updateHUD();

            if (window.SoundEngine && typeof window.SoundEngine.playWrong === 'function') {
                window.SoundEngine.playWrong();
            }

            if (level === 3) {
                // Inclinar viga por desequilibrio
                targetBeamAngle = (Math.random() > 0.5 ? 0.15 : -0.15);
            }

            createDebris(CANVAS_WIDTH / 2, 280);
            addFloatText("¡Desequilibrio! -1 ❤️", CANVAS_WIDTH / 2, 200, '#ef4444');

            if (lives <= 0 || stability <= 0) {
                handleGameOver();
            }
        }
    }

    function recordBlockPlacement() {
        placedBlocks.push({
            id: piecesPlaced,
            level: level,
            color: ['#0284c7', '#0d9488', '#d97706', '#7c3aed', '#e11d48'][piecesPlaced % 5],
            time: Date.now()
        });
    }

    /* --------------------------------------------------------------------------
       Partículas y Efectos Visuales
       -------------------------------------------------------------------------- */
    function createConstructionSparks(x, y) {
        for (let i = 0; i < 20; i++) {
            const angle = Math.random() * Math.PI * 2;
            const spd = Math.random() * 4 + 2;
            particles.push({
                x: x + (Math.random() * 30 - 15),
                y: y,
                vx: Math.cos(angle) * spd,
                vy: Math.sin(angle) * spd - 2,
                color: ['#f59e0b', '#fbbf24', '#38bdf8', '#ffffff'][Math.floor(Math.random() * 4)],
                size: Math.random() * 4 + 2,
                life: 1.0,
                decay: Math.random() * 0.04 + 0.02
            });
        }
    }

    function createDebris(x, y) {
        for (let i = 0; i < 15; i++) {
            const angle = Math.random() * Math.PI;
            const spd = Math.random() * 3 + 1;
            particles.push({
                x: x + (Math.random() * 40 - 20),
                y: y,
                vx: Math.cos(angle) * spd,
                vy: Math.sin(angle) * spd + 1,
                color: ['#ef4444', '#94a3b8', '#64748b'][Math.floor(Math.random() * 3)],
                size: Math.random() * 6 + 3,
                life: 1.0,
                decay: 0.03
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
            vy: -1.6
        });
    }

    /* --------------------------------------------------------------------------
       Bucle de Actualización Física y Animación
       -------------------------------------------------------------------------- */
    function update() {
        if (!isRunning) return;

        // Suavizado del ángulo de la viga en nivel 3
        beamAngle += (targetBeamAngle - beamAngle) * 0.1;

        // Temblor de pantalla
        if (screenShake > 0) {
            screenShake--;
        }

        // Partículas
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= p.decay;
            if (p.life <= 0) {
                particles.splice(i, 1);
            }
        }

        // Textos flotantes
        for (let i = floatTexts.length - 1; i >= 0; i--) {
            const ft = floatTexts[i];
            ft.y += ft.vy;
            ft.life -= 0.02;
            if (ft.life <= 0) {
                floatTexts.splice(i, 1);
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
            const shakeX = (Math.random() * 2 - 1) * screenShake * 0.7;
            const shakeY = (Math.random() * 2 - 1) * screenShake * 0.7;
            ctx.translate(shakeX, shakeY);
        }

        // 1. Fondo Blueprint Técnico (Cuadrícula milimétrica)
        drawBlueprintBackground();

        // 2. Base / Suelo de Construcción
        drawConstructionBase();

        // 3. Renderizado del problema geométrico y estructura según nivel
        if (level === 1) {
            drawLevel1Scene();
        } else if (level === 2) {
            drawLevel2Scene();
        } else if (level === 3) {
            drawLevel3BalanceScene();
        } else if (level === 4) {
            drawLevel4CompositeScene();
        } else if (level === 5) {
            drawLevel5Isometric3DScene();
        }

        // 4. Partículas
        for (let p of particles) {
            ctx.fillStyle = p.color;
            ctx.globalAlpha = Math.max(0, p.life);
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1.0;

        // 5. Textos Flotantes
        for (let ft of floatTexts) {
            ctx.save();
            ctx.globalAlpha = Math.max(0, ft.life);
            ctx.fillStyle = ft.color;
            ctx.font = 'bold 18px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.shadowColor = 'rgba(0,0,0,0.85)';
            ctx.shadowBlur = 6;
            ctx.fillText(ft.text, ft.x, ft.y);
            ctx.restore();
        }

        // 6. Pluma de Grúa Animada en la esquina superior
        drawCraneArm();

        ctx.restore();
    }

    /* --------------------------------------------------------------------------
       Fondos y Gráficos Estructurales
       -------------------------------------------------------------------------- */
    function drawBlueprintBackground() {
        // Fondo azul de plano técnico
        ctx.fillStyle = '#0b132b';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Cuadrícula arquitectónica
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
        ctx.lineWidth = 1;
        const gridSize = 25;

        ctx.beginPath();
        for (let x = 0; x <= CANVAS_WIDTH; x += gridSize) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, CANVAS_HEIGHT);
        }
        for (let y = 0; y <= CANVAS_HEIGHT; y += gridSize) {
            ctx.moveTo(0, y);
            ctx.lineTo(CANVAS_WIDTH, y);
        }
        ctx.stroke();
    }

    function drawConstructionBase() {
        const baseY = 400;

        // Asfalto / Terreno reforzado
        ctx.fillStyle = '#1c2541';
        ctx.fillRect(20, baseY, CANVAS_WIDTH - 40, 50);
        ctx.strokeStyle = '#3a506b';
        ctx.lineWidth = 2;
        ctx.strokeRect(20, baseY, CANVAS_WIDTH - 40, 50);

        // Patrón a rayas de seguridad amarillas y negras
        const stripeW = 16;
        ctx.save();
        ctx.beginPath();
        ctx.rect(20, baseY, CANVAS_WIDTH - 40, 10);
        ctx.clip();
        for (let x = 20; x < CANVAS_WIDTH - 40; x += stripeW * 2) {
            ctx.fillStyle = '#f59e0b';
            ctx.fillRect(x, baseY, stripeW, 10);
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(x + stripeW, baseY, stripeW, 10);
        }
        ctx.restore();
    }

    function drawCraneArm() {
        ctx.save();
        // Cable de grúa que desciende sobre la estructura
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);

        const craneX = CANVAS_WIDTH / 2;
        ctx.beginPath();
        ctx.moveTo(craneX, 0);
        ctx.lineTo(craneX, 70);
        ctx.stroke();
        ctx.setLineDash([]);

        // Gancho de grúa metálico
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(craneX - 6, 70, 12, 10);
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 2;
        ctx.strokeRect(craneX - 6, 70, 12, 10);

        ctx.restore();
    }

    /* --------------------------------------------------------------------------
       Renderizado de Escenas por Nivel
       -------------------------------------------------------------------------- */
    function drawLevel1Scene() {
        // Dibujar bloques apilados previamente
        const blockW = 160;
        const blockH = 34;
        const startX = (CANVAS_WIDTH - blockW) / 2;
        let curY = 400 - blockH;

        for (let i = 0; i < piecesPlaced; i++) {
            ctx.fillStyle = '#0284c7';
            ctx.fillRect(startX, curY, blockW, blockH);
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 2;
            ctx.strokeRect(startX, curY, blockW, blockH);

            // Remaches metálicos
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(startX + 8, curY + 8, 2.5, 0, Math.PI * 2);
            ctx.arc(startX + blockW - 8, curY + 8, 2.5, 0, Math.PI * 2);
            ctx.arc(startX + 8, curY + blockH - 8, 2.5, 0, Math.PI * 2);
            ctx.arc(startX + blockW - 8, curY + blockH - 8, 2.5, 0, Math.PI * 2);
            ctx.fill();

            // Texto de pieza
            ctx.fillStyle = '#f8fafc';
            ctx.font = 'bold 12px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`Módulo ${i + 1}`, CANVAS_WIDTH / 2, curY + 22);

            curY -= (blockH + 4);
        }

        // Dibujar plano del reto actual en la parte central
        if (currentChallenge && currentChallenge.diagram) {
            drawGeometryBlueprint(currentChallenge.diagram, 110, 120);
        }
    }

    function drawLevel2Scene() {
        // Bloques y columnas que forman un pórtico
        const baseY = 400;
        const colW = 36;
        const colH = 30;

        for (let i = 0; i < piecesPlaced; i++) {
            const isLeftCol = i % 2 === 0;
            const x = isLeftCol ? 90 : 274;
            const y = baseY - (Math.floor(i / 2) + 1) * (colH + 4);

            ctx.fillStyle = '#059669';
            ctx.fillRect(x, y, colW, colH);
            ctx.strokeStyle = '#34d399';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, colW, colH);

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 11px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`P${i + 1}`, x + colW / 2, y + 20);
        }

        if (currentChallenge && currentChallenge.diagram) {
            drawGeometryBlueprint(currentChallenge.diagram, 110, 120);
        }
    }

    function drawLevel3BalanceScene() {
        // Viga sobre fulcro en x=200, y=280
        const pivotX = CANVAS_WIDTH / 2;
        const pivotY = 280;
        const beamLength = 280;

        ctx.save();
        ctx.translate(pivotX, pivotY);
        ctx.rotate(beamAngle);

        // Viga de acero horizontal
        ctx.fillStyle = '#334155';
        ctx.fillRect(-beamLength / 2, -10, beamLength, 20);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.strokeRect(-beamLength / 2, -10, beamLength, 20);

        // Marcas y muescas discretas (-3, -2, -1, 0, +1, +2, +3)
        const unitDist = beamLength / 7; // ~40px
        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 11px system-ui, sans-serif';
        ctx.textAlign = 'center';

        for (let pos = -3; pos <= 3; pos++) {
            const mX = pos * unitDist;
            ctx.beginPath();
            ctx.moveTo(mX, -10);
            ctx.lineTo(mX, 10);
            ctx.strokeStyle = pos === 0 ? '#f59e0b' : '#64748b';
            ctx.stroke();

            ctx.fillText(pos === 0 ? '0' : (pos > 0 ? `+${pos}` : `${pos}`), mX, -16);
        }

        // Si hay diagrama de balance, dibujar las pesas colocadas
        if (currentChallenge && currentChallenge.diagram && currentChallenge.diagram.type === 'balance') {
            const diag = currentChallenge.diagram;

            // Pesa Izquierda en -d1
            const leftX = -diag.d1 * unitDist;
            const w1H = Math.min(45, 20 + diag.w1 * 2);
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(leftX - 16, -10 - w1H, 32, w1H);
            ctx.strokeStyle = '#fca5a5';
            ctx.strokeRect(leftX - 16, -10 - w1H, 32, w1H);
            ctx.fillStyle = '#ffffff';
            ctx.fillText(`${diag.w1}t`, leftX, -14);

            // Indicador o pesa derecha
            if (piecesPlaced > 0 || diag.unknown === 'w2') {
                const rightX = diag.d2 * unitDist;
                const w2H = Math.min(45, 20 + (diag.unknown === 'w2' ? 16 : diag.w2 * 2));
                ctx.fillStyle = '#10b981';
                ctx.fillRect(rightX - 16, -10 - w2H, 32, w2H);
                ctx.strokeStyle = '#6ee7b7';
                ctx.strokeRect(rightX - 16, -10 - w2H, 32, w2H);
                ctx.fillStyle = '#ffffff';
                ctx.fillText(diag.unknown === 'w2' ? '?' : `${diag.w2}t`, rightX, -14);
            }
        }

        ctx.restore();

        // Fulcro Triangular de soporte
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.moveTo(pivotX, pivotY);
        ctx.lineTo(pivotX - 25, pivotY + 45);
        ctx.lineTo(pivotX + 25, pivotY + 45);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Nivel de burbuja informativo
        const isBalanced = Math.abs(beamAngle) < 0.04;
        ctx.fillStyle = isBalanced ? '#10b981' : '#ef4444';
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(isBalanced ? '⚖️ Balanza Nivelada' : '⚠️ Desequilibrio en Viga', pivotX, 360);
    }

    function drawLevel4CompositeScene() {
        // Plano técnico amplio de áreas compuestas
        if (currentChallenge && currentChallenge.diagram) {
            drawCompositeBlueprint(currentChallenge.diagram, 50, 90);
        }

        // Progreso de módulos erigidos en la parte inferior
        const baseY = 400;
        const totalW = piecesPlaced * 48;
        const startX = (CANVAS_WIDTH - totalW) / 2;

        for (let i = 0; i < piecesPlaced; i++) {
            const x = startX + i * 48;
            ctx.fillStyle = '#7c3aed';
            ctx.fillRect(x + 2, baseY - 32, 44, 32);
            ctx.strokeStyle = '#c084fc';
            ctx.lineWidth = 2;
            ctx.strokeRect(x + 2, baseY - 32, 44, 32);

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 11px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`Sec.${i + 1}`, x + 24, baseY - 12);
        }
    }

    function drawLevel5Isometric3DScene() {
        // Rascacielos Isométrico 3D levantándose por capas
        const originX = CANVAS_WIDTH / 2;
        const originY = 320;
        const tileW = 38;
        const tileH = 19;
        const layerH = 24;

        // Dibujar base y capas construidas
        const layersToDraw = Math.max(1, piecesPlaced + 1);

        for (let l = 0; l < layersToDraw; l++) {
            const isLatest = (l === piecesPlaced);
            const layerColor = isLatest ? '#f59e0b' : '#0284c7';
            const topColor = isLatest ? '#fcd34d' : '#38bdf8';
            const shadowColor = isLatest ? '#b45309' : '#0369a1';

            const zOffset = l * layerH;

            // Dibujar bloque isométrico 3x3 en la capa l
            drawIsoBox(originX, originY - zOffset, tileW * 3.2, tileH * 3.2, layerH, topColor, layerColor, shadowColor);
        }

        // Remate dorado de la antena si se completaron las 5 capas
        if (piecesPlaced >= 5) {
            const topY = originY - (5 * layerH);
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(originX, topY - 20);
            ctx.lineTo(originX, topY - 65);
            ctx.stroke();

            ctx.fillStyle = '#f59e0b';
            ctx.beginPath();
            ctx.arc(originX, topY - 65, 6, 0, Math.PI * 2);
            ctx.fill();
        }

        // Placas de datos en pantalla
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`🏢 Capas Erigidas: ${piecesPlaced} / 5`, originX, 85);
    }

    /* --------------------------------------------------------------------------
       Helpers de Dibujo Isométrico y Blueprints
       -------------------------------------------------------------------------- */
    function drawIsoBox(x, y, w, h, height, cTop, cLeft, cRight) {
        // Cara Superior
        ctx.fillStyle = cTop;
        ctx.beginPath();
        ctx.moveTo(x, y - height - h / 2);
        ctx.lineTo(x + w / 2, y - height);
        ctx.lineTo(x, y - height + h / 2);
        ctx.lineTo(x - w / 2, y - height);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.stroke();

        // Cara Izquierda
        ctx.fillStyle = cLeft;
        ctx.beginPath();
        ctx.moveTo(x - w / 2, y - height);
        ctx.lineTo(x, y - height + h / 2);
        ctx.lineTo(x, y + h / 2);
        ctx.lineTo(x - w / 2, y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Cara Derecha
        ctx.fillStyle = cRight;
        ctx.beginPath();
        ctx.moveTo(x, y - height + h / 2);
        ctx.lineTo(x + w / 2, y - height);
        ctx.lineTo(x + w / 2, y);
        ctx.lineTo(x, y + h / 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    function drawGeometryBlueprint(diag, x, y) {
        ctx.save();
        const scale = 14;

        if (diag.type === 'rect') {
            const w = Math.min(180, diag.base * scale);
            const h = Math.min(110, diag.height * scale);
            const rX = x + (180 - w) / 2;
            const rY = y + (110 - h) / 2;

            // Relleno translúcido
            ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
            ctx.fillRect(rX, rY, w, h);
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 2;
            ctx.strokeRect(rX, rY, w, h);

            // Cotas
            ctx.fillStyle = '#f8fafc';
            ctx.font = 'bold 12px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`b = ${diag.base} m`, rX + w / 2, rY - 6);

            ctx.textAlign = 'right';
            ctx.fillText(`h = ${diag.height} m`, rX - 6, rY + h / 2);

        } else if (diag.type === 'square') {
            const s = Math.min(130, diag.side * scale);
            const sX = x + (180 - s) / 2;
            const sY = y + (110 - s) / 2;

            ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
            ctx.fillRect(sX, sY, s, s);
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 2;
            ctx.strokeRect(sX, sY, s, s);

            ctx.fillStyle = '#f8fafc';
            ctx.font = 'bold 12px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`Lado = ${diag.side} m`, sX + s / 2, sY - 6);
        }

        ctx.restore();
    }

    function drawCompositeBlueprint(diag, x, y) {
        ctx.save();
        ctx.translate(x + 30, y + 20);

        if (diag.type === 'l_shape') {
            // Figura en L
            const s = 18;
            const b1 = diag.b1 * s;
            const h1 = diag.h1 * s;
            const b2 = diag.b2 * s;
            const h2 = diag.h2 * s;

            ctx.fillStyle = 'rgba(139, 92, 246, 0.25)';
            ctx.strokeStyle = '#c084fc';
            ctx.lineWidth = 2;

            ctx.beginPath();
            ctx.moveTo(0, h2);
            ctx.lineTo(b1, h2);
            ctx.lineTo(b1, h2 + h1);
            ctx.lineTo(0, h2 + h1);
            ctx.lineTo(0, 0);
            ctx.lineTo(b2, 0);
            ctx.lineTo(b2, h2);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Línea discontinua de separación de secciones
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = '#f59e0b';
            ctx.beginPath();
            ctx.moveTo(b2, h2);
            ctx.lineTo(b2, h2 + h1);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.fillStyle = '#f8fafc';
            ctx.font = 'bold 12px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`Área A`, b2 / 2, h2 / 2 + 5);
            ctx.fillText(`Área B`, b1 / 2 + 10, h2 + h1 / 2 + 5);

        } else if (diag.type === 'hole_shape') {
            // Muro exterior con hueco
            const s = 22;
            const W = diag.totalW * s;
            const H = diag.totalH * s;
            const hW = diag.holeW * s;
            const hH = diag.holeH * s;

            ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
            ctx.fillRect(0, 0, W, H);
            ctx.strokeStyle = '#f87171';
            ctx.lineWidth = 2;
            ctx.strokeRect(0, 0, W, H);

            // Ventana/hueco transparente
            const holeX = (W - hW) / 2;
            const holeY = (H - hH) / 2;
            ctx.fillStyle = '#0b132b';
            ctx.fillRect(holeX, holeY, hW, hH);
            ctx.strokeStyle = '#fbbf24';
            ctx.strokeRect(holeX, holeY, hW, hH);

            ctx.fillStyle = '#fbbf24';
            ctx.font = 'bold 11px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`Vano`, holeX + hW / 2, holeY + hH / 2 + 4);

        } else if (diag.type === 'house_shape') {
            // Rectángulo con tejado triangular
            const s = 22;
            const b = diag.b * s;
            const hR = diag.hRect * s;
            const hT = diag.hTri * s;

            ctx.fillStyle = 'rgba(16, 185, 129, 0.25)';
            ctx.fillRect(0, hT, b, hR);
            ctx.strokeStyle = '#34d399';
            ctx.lineWidth = 2;
            ctx.strokeRect(0, hT, b, hR);

            // Techo triangular
            ctx.beginPath();
            ctx.moveTo(0, hT);
            ctx.lineTo(b / 2, 0);
            ctx.lineTo(b, hT);
            ctx.closePath();
            ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
            ctx.fill();
            ctx.strokeStyle = '#38bdf8';
            ctx.stroke();
        }

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
        stopTurnTimer();
        if (animFrameId) cancelAnimationFrame(animFrameId);

        if (window.SoundEngine && typeof window.SoundEngine.playFanfare === 'function') {
            window.SoundEngine.playFanfare();
        }

        let coinsEarned = 50;
        if (window.completeGameLevel) {
            coinsEarned = window.completeGameLevel('builder', level) || 50;
        }

        const overlay = document.getElementById('builder-overlay');
        const titleEl = document.getElementById('builder-overlay-title');
        const textEl = document.getElementById('builder-overlay-text');
        const btnStart = document.getElementById('btn-start-builder-game');

        if (titleEl) titleEl.innerText = `¡Obra Maestra Finalizada! 🏗️`;
        if (textEl) {
            textEl.innerHTML = `
                <div style="margin: 12px 0;">
                    <p style="color:var(--color-accent-green); font-size:1.15rem; font-weight:800;">
                        ¡Nivel ${level} Completado con 100% de Estabilidad!
                    </p>
                    <p>Piezas Colocadas: <strong>${piecesPlaced} / ${piecesTarget}</strong></p>
                    <p>Recompensa Obtenida: <strong>+${coinsEarned} MathCoins 🪙</strong></p>
                    ${level === 5 ? '<p style="color:#fbbf24; font-weight:800; margin-top:6px;">🎉 ¡Has desbloqueado Math Escape (escape-1)!</p>' : ''}
                </div>
            `;
        }

        if (btnStart) {
            if (level < 5) {
                btnStart.innerText = `Avanzar al Nivel ${level + 1} 🧱`;
                btnStart.onclick = () => {
                    initGame(level + 1);
                };
            } else {
                btnStart.innerText = `¡Ir a Math Escape! 🔐`;
                btnStart.onclick = () => {
                    if (window.launchGame) {
                        window.launchGame('escape', 1);
                    } else {
                        const backBtn = document.getElementById('btn-back-menu');
                        if (backBtn) backBtn.click();
                    }
                };
            }
        }

        if (overlay) overlay.classList.remove('hidden');
    }

    function handleGameOver() {
        isRunning = false;
        stopTurnTimer();
        if (animFrameId) cancelAnimationFrame(animFrameId);

        const overlay = document.getElementById('builder-overlay');
        const titleEl = document.getElementById('builder-overlay-title');
        const textEl = document.getElementById('builder-overlay-text');
        const btnStart = document.getElementById('btn-start-builder-game');

        if (titleEl) titleEl.innerText = `¡Derrumbe Estructural! 💥`;
        if (textEl) {
            textEl.innerHTML = `
                <p style="color:var(--color-accent-coral); font-size:1.05rem; margin-bottom:10px;">
                    La estructura ha perdido su estabilidad o te has quedado sin vidas.
                </p>
                <p>Piezas aseguradas: <strong>${piecesPlaced} / ${piecesTarget}</strong></p>
                <p>¡Refuerza tus cálculos de área y equilibrio y vuelve a intentarlo!</p>
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
    function spawnChallenge() {
        currentChallenge = generateBuilderMath(level);
        eliminatedOptions = [];
        isHintActiveForCurrentProblem = false;
        updateHUD();
    }

    function initGame(lvl) {
        level = parseInt(lvl) || 1;
        const cfg = LEVEL_CONFIG[level] || LEVEL_CONFIG[1];
        piecesTarget = cfg.target;

        lives = 3;
        stability = 100;
        piecesPlaced = 0;
        particles = [];
        floatTexts = [];
        placedBlocks = [];
        beamAngle = 0;
        targetBeamAngle = 0;

        const overlay = document.getElementById('builder-overlay');
        if (overlay) overlay.classList.add('hidden');

        spawnChallenge();
        startTurnTimer();

        isRunning = true;
        isPaused = false;

        if (animFrameId) cancelAnimationFrame(animFrameId);
        animFrameId = requestAnimationFrame(gameLoop);
    }

    /* --------------------------------------------------------------------------
       API Pública Registrada en MathQuestGames['builder']
       -------------------------------------------------------------------------- */
    const BuilderGame = {
        name: 'Constructor Matemático',
        icon: '🧱',
        topic: 'geometry',
        screenId: 'screen-builder',
        level: 1,
        isRunning: false,

        start: function(lvl) {
            this.level = parseInt(lvl) || 1;
            this.isRunning = true;

            canvas = document.getElementById('builder-canvas');
            if (canvas) {
                ctx = canvas.getContext('2d');
            }

            const overlay = document.getElementById('builder-overlay');
            const titleEl = document.getElementById('builder-overlay-title');
            const textEl = document.getElementById('builder-overlay-text');
            const btnStart = document.getElementById('btn-start-builder-game');

            const cfg = LEVEL_CONFIG[this.level] || LEVEL_CONFIG[1];
            if (titleEl) titleEl.innerText = `Constructor Matemático 🧱`;
            if (textEl) {
                textEl.innerHTML = `
                    <p style="font-weight:700; color:var(--color-accent-blue); margin-bottom:8px;">${cfg.label}</p>
                    <p>Coloca con éxito las <strong>${cfg.target} piezas</strong> resolviendo las medidas geométricas requeridas para asegurar la obra.</p>
                `;
            }

            if (btnStart) {
                btnStart.innerText = `¡Iniciar Construcción!`;
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
            stopTurnTimer();
            if (animFrameId) {
                cancelAnimationFrame(animFrameId);
                animFrameId = null;
            }
        },

        useHint: function() {
            if (!isRunning || !currentChallenge) {
                if (window.showToast) window.showToast("Inicia la construcción para usar pistas.");
                return false;
            }

            if (isHintActiveForCurrentProblem) {
                if (window.showToast) window.showToast("💡 La pista ya está activa para esta pieza.");
                return false;
            }

            // Validar inventario de pistas o VIP
            const isVip = window.state && window.state.vipBypassPurchased;
            const hintsCount = (window.state && window.state.globalHints) || 0;

            if (!isVip && hintsCount <= 0) {
                if (window.showToast) window.showToast("❌ No tienes pistas en tu mochila. ¡Cómpralas en la Tienda!");
                if (window.SoundEngine && typeof window.SoundEngine.playWrong === 'function') {
                    window.SoundEngine.playWrong();
                }
                return false;
            }

            // Consumir pista
            if (!isVip && window.state) {
                window.state.globalHints--;
                if (window.saveStateToStorage) window.saveStateToStorage();
                if (window.updateHeaderStats) window.updateHeaderStats();
            }

            isHintActiveForCurrentProblem = true;

            // Eliminar hasta 2 opciones incorrectas
            const incorrectIndices = [];
            currentChallenge.options.forEach((opt, idx) => {
                if (!opt.isCorrect) incorrectIndices.push(idx);
            });

            // Seleccionar 2 incorrectas para descartar
            incorrectIndices.sort(() => Math.random() - 0.5);
            eliminatedOptions = incorrectIndices.slice(0, 2);

            // Re-renderizar botones
            renderOptionButtons();

            if (window.SoundEngine && typeof window.SoundEngine.playShield === 'function') {
                window.SoundEngine.playShield();
            }

            const formulaHint = currentChallenge.formula ? `Fórmula: ${currentChallenge.formula}` : `Respuesta aprox: ${currentChallenge.answer} ${currentChallenge.unit}`;
            if (window.showToast) {
                window.showToast(`💡 Pista Obra: Se descartaron 2 piezas incorrectas. ${formulaHint}`);
            }

            addFloatText("💡 -2 Opciones Descartadas", CANVAS_WIDTH / 2, 170, '#38bdf8');
            return true;
        }
    };

    window.MathQuestGames['builder'] = BuilderGame;

    /* --------------------------------------------------------------------------
       Listeners de UI Globales
       -------------------------------------------------------------------------- */
    const btnRestart = document.getElementById('btn-restart-builder');
    if (btnRestart) {
        btnRestart.addEventListener('click', () => {
            if (window.SoundEngine && typeof window.SoundEngine.playClick === 'function') {
                window.SoundEngine.playClick();
            }
            initGame(level);
        });
    }

    const btnHint = document.getElementById('btn-use-hint-builder');
    if (btnHint) {
        btnHint.addEventListener('click', () => {
            BuilderGame.useHint();
        });
    }

})();
