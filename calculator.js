/* ==========================================================================
   MathQuest V3 - Módulo Calculadora Matemática Infantil
   Lógica segura, diseño para niños, teclado, división entre cero protegida
   y Modo Aprender con dificultades progresivas (🌱 Fácil, 🌿 Medio, ⭐ Difícil)
   ========================================================================== */

(function() {
    'use strict';

    window.MathQuestGames = window.MathQuestGames || {};

    // Símbolos visuales amigables para niños
    const OP_SYMBOLS = {
        '+': '+',
        '-': '−',
        '*': '×',
        '/': '÷'
    };

    // Estado interno del módulo
    let isRunning = false;
    let currentMode = 'normal'; // 'normal' | 'learn'
    let learnDifficulty = 'easy'; // 'easy' | 'medium' | 'hard'
    let currentExercise = null;
    let learnStats = {
        correct: 0,
        streak: 0,
        coinsEarned: 0
    };

    // Estado del motor de la calculadora
    let calcState = {
        currentInput: '0',
        previousInput: null,
        operator: null,
        waitingForOperand: false,
        history: '',
        lastResult: null,
        lastOperator: null,
        lastSecondOperand: null,
        errorMessage: null
    };

    // Colección de listeners y timers para limpieza total (Memory Leaks Prevention)
    let activeListeners = [];
    let activeTimers = [];

    function addTrackedListener(target, event, handler, options) {
        if (!target) return;
        target.addEventListener(event, handler, options);
        activeListeners.push({ target, event, handler, options });
    }

    function setTrackedTimeout(callback, delay) {
        const id = setTimeout(() => {
            const index = activeTimers.indexOf(id);
            if (index !== -1) activeTimers.splice(index, 1);
            callback();
        }, delay);
        activeTimers.push(id);
        return id;
    }

    function clearAllTimers() {
        activeTimers.forEach(id => clearTimeout(id));
        activeTimers = [];
    }

    function clearAllListeners() {
        activeListeners.forEach(({ target, event, handler, options }) => {
            try {
                target.removeEventListener(event, handler, options);
            } catch (e) {}
        });
        activeListeners = [];
    }

    /* --------------------------------------------------------------------------
       Motor Matemático Seguro (Sin eval)
       -------------------------------------------------------------------------- */
    function formatNumber(num) {
        if (isNaN(num) || !isFinite(num)) return '0';
        // Evitar imprecisiones binarias de punto flotante como 0.1 + 0.2 = 0.30000000000000004
        const rounded = parseFloat(Number(num).toPrecision(12));
        // Si es entero, retornarlo directo; si tiene decimales, limitar a máximo 8
        if (Number.isInteger(rounded)) {
            return rounded.toString();
        }
        return rounded.toString();
    }

    function performMath(num1, num2, op) {
        switch (op) {
            case '+':
                return num1 + num2;
            case '-':
                return num1 - num2;
            case '*':
                return num1 * num2;
            case '/':
                if (num2 === 0) {
                    return 'ZERO_DIVISION';
                }
                return num1 / num2;
            default:
                return num2;
        }
    }

    function playAudio(type) {
        if (!window.SoundEngine) return;
        try {
            switch (type) {
                case 'click':
                    if (typeof window.SoundEngine.playClick === 'function') window.SoundEngine.playClick();
                    break;
                case 'pop':
                    if (typeof window.SoundEngine.playPop === 'function') window.SoundEngine.playPop();
                    break;
                case 'correct':
                    if (typeof window.SoundEngine.playCorrect === 'function') window.SoundEngine.playCorrect();
                    break;
                case 'wrong':
                    if (typeof window.SoundEngine.playWrong === 'function') window.SoundEngine.playWrong();
                    break;
                case 'fanfare':
                    if (typeof window.SoundEngine.playFanfare === 'function') window.SoundEngine.playFanfare();
                    break;
            }
        } catch (e) {}
    }

    /* --------------------------------------------------------------------------
       Operaciones de Entrada de la Calculadora
       -------------------------------------------------------------------------- */
    function inputDigit(digit) {
        playAudio('click');
        calcState.errorMessage = null;

        if (calcState.waitingForOperand) {
            calcState.currentInput = String(digit);
            calcState.waitingForOperand = false;
        } else {
            if (calcState.currentInput === '0') {
                calcState.currentInput = String(digit);
            } else {
                // Límite de 14 caracteres para mantener legibilidad visual
                if (calcState.currentInput.length < 14) {
                    calcState.currentInput += String(digit);
                }
            }
        }
        updateDisplay();
    }

    function inputDecimal() {
        playAudio('click');
        calcState.errorMessage = null;

        if (calcState.waitingForOperand) {
            calcState.currentInput = '0.';
            calcState.waitingForOperand = false;
        } else if (!calcState.currentInput.includes('.')) {
            calcState.currentInput += '.';
        }
        updateDisplay();
    }

    function toggleSign() {
        playAudio('click');
        calcState.errorMessage = null;

        if (calcState.currentInput === '0' || calcState.currentInput === '') return;

        if (calcState.currentInput.startsWith('-')) {
            calcState.currentInput = calcState.currentInput.slice(1);
        } else {
            calcState.currentInput = '-' + calcState.currentInput;
        }
        updateDisplay();
    }

    function deleteLast() {
        playAudio('click');
        calcState.errorMessage = null;

        if (calcState.waitingForOperand) {
            return;
        }

        if (calcState.currentInput.length > 1) {
            calcState.currentInput = calcState.currentInput.slice(0, -1);
            if (calcState.currentInput === '-') {
                calcState.currentInput = '0';
            }
        } else {
            calcState.currentInput = '0';
        }
        updateDisplay();
    }

    function clearAll() {
        playAudio('pop');
        calcState = {
            currentInput: '0',
            previousInput: null,
            operator: null,
            waitingForOperand: false,
            history: '',
            lastResult: null,
            lastOperator: null,
            lastSecondOperand: null,
            errorMessage: null
        };
        updateDisplay();
    }

    function setOperator(nextOp) {
        playAudio('click');
        calcState.errorMessage = null;

        const currentVal = parseFloat(calcState.currentInput);

        if (calcState.operator && calcState.waitingForOperand) {
            // El usuario cambió de operador antes de escribir el segundo número
            calcState.operator = nextOp;
            calcState.history = `${formatNumber(calcState.previousInput)} ${OP_SYMBOLS[nextOp]}`;
            updateDisplay();
            return;
        }

        if (calcState.previousInput === null) {
            calcState.previousInput = currentVal;
        } else if (calcState.operator) {
            const result = performMath(calcState.previousInput, currentVal, calcState.operator);
            if (result === 'ZERO_DIVISION') {
                handleZeroDivision();
                return;
            }
            calcState.previousInput = result;
            calcState.currentInput = formatNumber(result);
        }

        calcState.waitingForOperand = true;
        calcState.operator = nextOp;
        calcState.history = `${formatNumber(calcState.previousInput)} ${OP_SYMBOLS[nextOp]}`;
        updateDisplay();
    }

    function calculate(isEqualsPressed = true) {
        calcState.errorMessage = null;

        const currentVal = parseFloat(calcState.currentInput);

        // Caso: Presionar '=' repetidamente
        if (calcState.operator === null) {
            if (calcState.lastOperator && calcState.lastSecondOperand !== null && isEqualsPressed) {
                const res = performMath(currentVal, calcState.lastSecondOperand, calcState.lastOperator);
                if (res === 'ZERO_DIVISION') {
                    handleZeroDivision();
                    return;
                }
                calcState.history = `${formatNumber(currentVal)} ${OP_SYMBOLS[calcState.lastOperator]} ${formatNumber(calcState.lastSecondOperand)} =`;
                calcState.currentInput = formatNumber(res);
                calcState.waitingForOperand = true;
                playAudio('click');
                updateDisplay();
                checkLearnAnswerIfActive(res);
            } else if (currentMode === 'learn' && isEqualsPressed) {
                // En modo aprender, si solo tipearon el resultado y dieron igual
                checkLearnAnswerIfActive(currentVal);
            }
            return;
        }

        const prevVal = calcState.previousInput !== null ? calcState.previousInput : currentVal;
        const result = performMath(prevVal, currentVal, calcState.operator);

        if (result === 'ZERO_DIVISION') {
            handleZeroDivision();
            return;
        }

        playAudio('click');

        if (isEqualsPressed) {
            calcState.history = `${formatNumber(prevVal)} ${OP_SYMBOLS[calcState.operator]} ${formatNumber(currentVal)} =`;
            calcState.lastOperator = calcState.operator;
            calcState.lastSecondOperand = currentVal;
            calcState.lastResult = result;
            calcState.operator = null;
            calcState.previousInput = null;
        }

        calcState.currentInput = formatNumber(result);
        calcState.waitingForOperand = true;
        updateDisplay();

        // En Modo Aprender, comprobar si el resultado coincide con el reto
        if (currentMode === 'learn') {
            checkLearnAnswerIfActive(result);
        }
    }

    function handleZeroDivision() {
        playAudio('wrong');
        calcState.errorMessage = 'No puedes dividir entre 0 😅';
        calcState.history = `${formatNumber(calcState.previousInput || 0)} ÷ 0 =`;
        calcState.currentInput = '0';
        calcState.previousInput = null;
        calcState.operator = null;
        calcState.waitingForOperand = true;
        updateDisplay();
    }

    /* --------------------------------------------------------------------------
       Actualización Visual de la Pantalla de la Calculadora
       -------------------------------------------------------------------------- */
    function updateDisplay() {
        const historyEl = document.getElementById('calc-history-display');
        const mainEl = document.getElementById('calc-main-display');
        const msgEl = document.getElementById('calc-friendly-message');

        if (historyEl) {
            historyEl.innerText = calcState.history || '';
        }

        if (mainEl) {
            if (calcState.errorMessage) {
                mainEl.innerText = '0';
            } else {
                mainEl.innerText = calcState.currentInput;
            }
        }

        if (msgEl) {
            if (calcState.errorMessage) {
                msgEl.innerText = calcState.errorMessage;
                msgEl.classList.remove('hidden');
                msgEl.classList.add('active-error');
            } else {
                msgEl.innerText = '';
                msgEl.classList.add('hidden');
                msgEl.classList.remove('active-error');
            }
        }
    }

    /* --------------------------------------------------------------------------
       Mapeo de Teclado Físico
       -------------------------------------------------------------------------- */
    function handleKeyboard(e) {
        if (!isRunning) return;

        // Si el foco está en un input externo o modal, ignorar
        const tag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

        const key = e.key;

        if (key >= '0' && key <= '9') {
            e.preventDefault();
            inputDigit(key);
            triggerButtonVisualFeedback(`btn-calc-${key}`);
        } else if (key === '+') {
            e.preventDefault();
            setOperator('+');
            triggerButtonVisualFeedback('btn-calc-add');
        } else if (key === '-') {
            e.preventDefault();
            setOperator('-');
            triggerButtonVisualFeedback('btn-calc-sub');
        } else if (key === '*' || key === 'x' || key === 'X') {
            e.preventDefault();
            setOperator('*');
            triggerButtonVisualFeedback('btn-calc-mul');
        } else if (key === '/') {
            e.preventDefault();
            setOperator('/');
            triggerButtonVisualFeedback('btn-calc-div');
        } else if (key === 'Enter' || key === '=') {
            e.preventDefault();
            calculate(true);
            triggerButtonVisualFeedback('btn-calc-equals');
        } else if (key === 'Backspace') {
            e.preventDefault();
            deleteLast();
            triggerButtonVisualFeedback('btn-calc-backspace');
        } else if (key === 'Escape' || key === 'c' || key === 'C') {
            e.preventDefault();
            clearAll();
            triggerButtonVisualFeedback('btn-calc-clear');
        } else if (key === '.' || key === ',') {
            e.preventDefault();
            inputDecimal();
            triggerButtonVisualFeedback('btn-calc-dot');
        }
    }

    function triggerButtonVisualFeedback(buttonId) {
        const btn = document.getElementById(buttonId);
        if (btn) {
            btn.classList.add('calc-key-pressed');
            setTrackedTimeout(() => {
                btn.classList.remove('calc-key-pressed');
            }, 120);
        }
    }

    /* --------------------------------------------------------------------------
       🎯 Modo Aprender (Generador de Retos para Niños)
       -------------------------------------------------------------------------- */
    function generateExercise(difficulty) {
        let op, num1, num2, targetAnswer, promptText;

        if (difficulty === 'easy') {
            // 🌱 Fácil: Sumas y restas pequeñas (1 a 15), resultado entero positivo
            const isAdd = Math.random() < 0.6;
            if (isAdd) {
                num1 = Math.floor(Math.random() * 12) + 1;
                num2 = Math.floor(Math.random() * 10) + 1;
                op = '+';
                targetAnswer = num1 + num2;
                promptText = `¿Cuánto es ${num1} + ${num2}?`;
            } else {
                num1 = Math.floor(Math.random() * 15) + 4;
                num2 = Math.floor(Math.random() * (num1 - 1)) + 1;
                op = '-';
                targetAnswer = num1 - num2;
                promptText = `¿Cuánto es ${num1} − ${num2}?`;
            }
        } else if (difficulty === 'medium') {
            // 🌿 Medio: Sumas/restas de 2 dígitos, tablas de multiplicar (2 a 9), divisiones exactas
            const pick = Math.random();
            if (pick < 0.35) {
                // Multiplicación básica (tablas 2 al 9)
                num1 = Math.floor(Math.random() * 8) + 2;
                num2 = Math.floor(Math.random() * 8) + 2;
                op = '*';
                targetAnswer = num1 * num2;
                promptText = `¿Cuánto es ${num1} × ${num2}?`;
            } else if (pick < 0.65) {
                // División exacta
                num2 = Math.floor(Math.random() * 7) + 2;
                targetAnswer = Math.floor(Math.random() * 8) + 2;
                num1 = num2 * targetAnswer;
                op = '/';
                promptText = `¿Cuánto es ${num1} ÷ ${num2}?`;
            } else {
                // Suma o resta mayor (10 a 60)
                num1 = Math.floor(Math.random() * 35) + 15;
                num2 = Math.floor(Math.random() * 30) + 10;
                op = '+';
                targetAnswer = num1 + num2;
                promptText = `¿Cuánto es ${num1} + ${num2}?`;
            }
        } else {
            // ⭐ Difícil: Multiplicaciones de 2 dígitos, divisiones de números mayores, restas compuestas
            const pick = Math.random();
            if (pick < 0.45) {
                // Multiplicación media (ej: 12 × 7, 15 × 6, 20 × 4)
                num1 = Math.floor(Math.random() * 15) + 10;
                num2 = Math.floor(Math.random() * 8) + 3;
                op = '*';
                targetAnswer = num1 * num2;
                promptText = `¿Cuánto es ${num1} × ${num2}?`;
            } else if (pick < 0.8) {
                // División exacta más compleja (ej: 96 ÷ 8 = 12)
                num2 = Math.floor(Math.random() * 9) + 4;
                targetAnswer = Math.floor(Math.random() * 11) + 6;
                num1 = num2 * targetAnswer;
                op = '/';
                promptText = `¿Cuánto es ${num1} ÷ ${num2}?`;
            } else {
                // Resta grande (ej: 135 − 48)
                num1 = Math.floor(Math.random() * 100) + 60;
                num2 = Math.floor(Math.random() * 45) + 15;
                op = '-';
                targetAnswer = num1 - num2;
                promptText = `¿Cuánto es ${num1} − ${num2}?`;
            }
        }

        return { num1, num2, op, targetAnswer, promptText };
    }

    function renderLearnCard() {
        const questionEl = document.getElementById('calc-learn-question');
        const feedbackEl = document.getElementById('calc-learn-feedback');
        const nextBtn = document.getElementById('btn-calc-learn-next');

        if (questionEl && currentExercise) {
            questionEl.innerText = currentExercise.promptText;
        }

        if (feedbackEl) {
            feedbackEl.className = 'calc-learn-feedback-box neutral';
            feedbackEl.innerText = 'Calcula o escribe tu respuesta y pulsa =';
        }

        if (nextBtn) {
            nextBtn.classList.add('hidden');
        }

        updateLearnStatsUI();
    }

    function updateLearnStatsUI() {
        const scoreEl = document.getElementById('calc-learn-score-val');
        const streakEl = document.getElementById('calc-learn-streak-val');
        const coinsEl = document.getElementById('calc-learn-coins-val');

        if (scoreEl) scoreEl.innerText = learnStats.correct;
        if (streakEl) streakEl.innerText = `${learnStats.streak} 🔥`;
        if (coinsEl) coinsEl.innerText = `+${learnStats.coinsEarned} 🪙`;
    }

    function checkLearnAnswerIfActive(userNumber) {
        if (currentMode !== 'learn' || !currentExercise) return;

        const feedbackEl = document.getElementById('calc-learn-feedback');
        const nextBtn = document.getElementById('btn-calc-learn-next');
        const isCorrect = Math.abs(userNumber - currentExercise.targetAnswer) < 0.0001;

        if (isCorrect) {
            learnStats.correct++;
            learnStats.streak++;
            learnStats.coinsEarned += 10;

            // Recompensa en el sistema global MathQuest
            if (window.state) {
                window.state.coins = (window.state.coins || 0) + 10;
                window.state.stars = (window.state.stars || 0) + 1;
                if (typeof window.saveStateToStorage === 'function') window.saveStateToStorage();
                if (typeof window.updateHeaderStats === 'function') window.updateHeaderStats();
            }

            if (learnStats.streak >= 3) {
                playAudio('fanfare');
            } else {
                playAudio('correct');
            }

            if (feedbackEl) {
                feedbackEl.className = 'calc-learn-feedback-box success';
                feedbackEl.innerHTML = `¡Correcto! 🎉 <strong>${currentExercise.targetAnswer}</strong> (+10 MathCoins 🪙)`;
            }

            if (nextBtn) {
                nextBtn.classList.remove('hidden');
            }

            updateLearnStatsUI();

            // Avanzar automáticamente tras 1.4s para flujo dinámico
            setTrackedTimeout(() => {
                if (isRunning && currentMode === 'learn') {
                    nextLearnExercise();
                }
            }, 1400);

        } else {
            learnStats.streak = 0;
            playAudio('wrong');

            if (feedbackEl) {
                feedbackEl.className = 'calc-learn-feedback-box warning';
                feedbackEl.innerHTML = `Casi 😄 Inténtalo otra vez.`;
            }

            updateLearnStatsUI();
        }
    }

    function nextLearnExercise() {
        currentExercise = generateExercise(learnDifficulty);
        clearAll();
        renderLearnCard();
    }

    function setLearnDifficulty(diff) {
        learnDifficulty = diff;
        playAudio('click');

        const diffBtns = document.querySelectorAll('.calc-diff-btn');
        diffBtns.forEach(btn => {
            if (btn.getAttribute('data-diff') === diff) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        nextLearnExercise();
    }

    function setMode(mode) {
        currentMode = mode;
        playAudio('click');

        const normalTab = document.getElementById('tab-calc-mode-normal');
        const learnTab = document.getElementById('tab-calc-mode-learn');
        const learnPanel = document.getElementById('calc-learn-panel');

        if (mode === 'learn') {
            if (normalTab) normalTab.classList.remove('active');
            if (learnTab) learnTab.classList.add('active');
            if (learnPanel) learnPanel.classList.remove('hidden');
            nextLearnExercise();
        } else {
            if (normalTab) normalTab.classList.add('active');
            if (learnTab) learnTab.classList.remove('active');
            if (learnPanel) learnPanel.classList.add('hidden');
        }

        clearAll();
    }

    /* --------------------------------------------------------------------------
       Inicialización y Enlace de Eventos del DOM
       -------------------------------------------------------------------------- */
    function attachKeypadEvents() {
        // Dígitos 0-9
        for (let i = 0; i <= 9; i++) {
            const btn = document.getElementById(`btn-calc-${i}`);
            if (btn) {
                addTrackedListener(btn, 'click', () => inputDigit(i));
            }
        }

        // Operadores
        const opMap = {
            'btn-calc-add': '+',
            'btn-calc-sub': '-',
            'btn-calc-mul': '*',
            'btn-calc-div': '/'
        };
        Object.keys(opMap).forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                addTrackedListener(btn, 'click', () => setOperator(opMap[id]));
            }
        });

        // Acciones especiales
        const btnEquals = document.getElementById('btn-calc-equals');
        if (btnEquals) {
            addTrackedListener(btnEquals, 'click', () => calculate(true));
        }

        const btnClear = document.getElementById('btn-calc-clear');
        if (btnClear) {
            addTrackedListener(btnClear, 'click', () => clearAll());
        }

        const btnBackspace = document.getElementById('btn-calc-backspace');
        if (btnBackspace) {
            addTrackedListener(btnBackspace, 'click', () => deleteLast());
        }

        const btnDot = document.getElementById('btn-calc-dot');
        if (btnDot) {
            addTrackedListener(btnDot, 'click', () => inputDecimal());
        }

        const btnSign = document.getElementById('btn-calc-sign');
        if (btnSign) {
            addTrackedListener(btnSign, 'click', () => toggleSign());
        }

        // Pestañas de modo
        const tabNormal = document.getElementById('tab-calc-mode-normal');
        if (tabNormal) {
            addTrackedListener(tabNormal, 'click', () => setMode('normal'));
        }

        const tabLearn = document.getElementById('tab-calc-mode-learn');
        if (tabLearn) {
            addTrackedListener(tabLearn, 'click', () => setMode('learn'));
        }

        // Botones de dificultad en Modo Aprender
        const diffBtns = document.querySelectorAll('.calc-diff-btn');
        diffBtns.forEach(btn => {
            const diff = btn.getAttribute('data-diff');
            addTrackedListener(btn, 'click', () => setLearnDifficulty(diff));
        });

        // Botón saltar/siguiente reto
        const btnNext = document.getElementById('btn-calc-learn-next');
        if (btnNext) {
            addTrackedListener(btnNext, 'click', () => {
                playAudio('click');
                nextLearnExercise();
            });
        }

        const btnSkip = document.getElementById('btn-calc-learn-skip');
        if (btnSkip) {
            addTrackedListener(btnSkip, 'click', () => {
                playAudio('click');
                nextLearnExercise();
            });
        }

        // Botón volver dentro de la pantalla
        const btnBackInternal = document.getElementById('btn-calc-back-to-menu');
        if (btnBackInternal) {
            addTrackedListener(btnBackInternal, 'click', () => {
                const headerBackBtn = document.getElementById('btn-back-menu');
                if (headerBackBtn) {
                    headerBackBtn.click();
                } else if (typeof window.stopAllActiveGames === 'function') {
                    window.stopAllActiveGames();
                    const hub = document.getElementById('screen-hub');
                    const calc = document.getElementById('screen-calculator');
                    if (hub) hub.classList.remove('hidden');
                    if (calc) calc.classList.add('hidden');
                }
            });
        }

        // Teclado físico
        addTrackedListener(window, 'keydown', handleKeyboard);
    }

    /* --------------------------------------------------------------------------
       Contrato Modular Oficial window.MathQuestGames.calculator
       -------------------------------------------------------------------------- */
    const CalculatorTool = {
        name: 'Calculadora',
        icon: '🧮',
        topic: 'arithmetic',
        screenId: 'screen-calculator',

        start: function(level) {
            this.stop(); // Detener de forma limpia cualquier estado previo

            isRunning = true;
            clearAll();
            attachKeypadEvents();

            // Modo inicial: normal (o learn si se especifica)
            setMode('normal');

            updateDisplay();
        },

        stop: function() {
            isRunning = false;
            clearAllTimers();
            clearAllListeners();

            // Restablecer estados temporales
            calcState = {
                currentInput: '0',
                previousInput: null,
                operator: null,
                waitingForOperand: false,
                history: '',
                lastResult: null,
                lastOperator: null,
                lastSecondOperand: null,
                errorMessage: null
            };
        }
    };

    window.MathQuestGames['calculator'] = CalculatorTool;

})();
