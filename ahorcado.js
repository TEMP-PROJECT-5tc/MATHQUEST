/* ==========================================================================
   MathQuest V3 - Módulo Ahorcado de Conceptos (Edades 8-12)
   Vocabulario matemático con 5 sub-niveles progresivos, teclado virtual,
   soporte de acentos en español, 6 vidas y soporte de Pistas.
   ========================================================================== */

(function() {
    const canvas = document.getElementById('ahorcado-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const overlay = document.getElementById('ahorcado-overlay');
    const btnStart = document.getElementById('btn-start-ahorcado-game');
    const btnRestart = document.getElementById('btn-restart-ahorcado');
    const riddleText = document.getElementById('ahorcado-hint');
    const slotsContainer = document.getElementById('ahorcado-word-slots');
    const keyboardContainer = document.getElementById('ahorcado-virtual-keyboard');
    const heartsBox = document.getElementById('ahorcado-hearts-box');

    let secretWord = '';
    let wordTheme = '';
    let userGuesses = new Set();
    let lives = 6;
    let level = 1;
    let isPlaying = false;

    // Vocabulario y Adivinanzas adaptadas para primaria (8 a 12 años)
    const VOCABULARY = {
        1: [
            { word: 'suma', riddle: "Operación de juntar o añadir cantidades: `2 + 3 = 5`." },
            { word: 'resta', riddle: "Operación de quitar o restar cantidades: `8 - 3 = 5`." },
            { word: 'angulo', riddle: "Espacio entre dos líneas que se cruzan. Se mide en grados." },
            { word: 'linea', riddle: "Sucesión continua de puntos en el espacio." }
        ],
        2: [
            { word: 'fraccion', riddle: "Expresa una o varias partes de una unidad dividida en partes iguales." },
            { word: 'ecuacion', riddle: "Igualdad matemática con una variable desconocida (ej. `x`)." },
            { word: 'division', riddle: "Operación de repartir una cantidad en partes iguales." },
            { word: 'triangulo', riddle: "Figura geométrica con tres lados y tres ángulos." }
        ],
        3: [
            { word: 'geometria', riddle: "Parte de las matemáticas que estudia las formas, líneas y figuras." },
            { word: 'multiplicar', riddle: "Operación de sumar un número tantas veces como indica otro." },
            { word: 'vertice', riddle: "Punto donde se unen dos lados de una figura geométrica." },
            { word: 'cuadrado', riddle: "Figura geométrica de cuatro lados iguales y ángulos rectos." }
        ],
        4: [
            { word: 'perimetro', riddle: "Suma de las longitudes de todos los lados de una figura geométrica." },
            { word: 'area', riddle: "Medida de la superficie interna de una figura geométrica." },
            { word: 'diagonal', riddle: "Segmento que une dos vértices no consecutivos de un polígono." },
            { word: 'simetria', riddle: "Correspondencia exacta a ambos lados de una línea divisoria." }
        ],
        5: [
            { word: 'variable', riddle: "Símbolo o letra (como `x`) que representa un valor desconocido." },
            { word: 'coordenada', riddle: "Puntos en un plano cartesiano indicados como `(x, y)`." },
            { word: 'proporcion', riddle: "Igualdad o relación entre dos razones o fracciones." },
            { word: 'poligono', riddle: "Figura geométrica plana delimitada por un trazado de líneas rectas." }
        ]
    };

    const SPANISH_ACCENT_MAP = {
        'a': ['a', 'á'],
        'e': ['e', 'é'],
        'i': ['i', 'í'],
        'o': ['o', 'ó'],
        'u': ['u', 'ú', 'ü'],
        'á': ['a', 'á'],
        'é': ['e', 'é'],
        'í': ['i', 'í'],
        'ó': ['o', 'ó'],
        'ú': ['u', 'ú', 'ü']
    };

    // --------------------------------------------------------------------------
    // A. Inicialización e Interfaz de Vidas
    // --------------------------------------------------------------------------
    function updateHeartsDisplay() {
        if (!heartsBox) return;
        heartsBox.innerHTML = '';
        for (let i = 0; i < 6; i++) {
            if (i < lives) {
                heartsBox.innerHTML += '❤️ ';
            } else {
                heartsBox.innerHTML += '🖤 ';
            }
        }
    }

    function initGame(gameLevel) {
        level = gameLevel || 1;
        lives = 6;
        userGuesses.clear();
        isPlaying = false;

        updateHeartsDisplay();

        // 1. Elegir palabra secreta
        const list = VOCABULARY[level] || VOCABULARY[1];
        const selected = list[Math.floor(Math.random() * list.length)];
        secretWord = selected.word.toLowerCase();
        wordTheme = selected.riddle;

        riddleText.innerHTML = wordTheme;

        // 2. Renderizar espacios
        renderWordSlots();

        // 3. Renderizar teclado
        renderKeyboard();

        overlay.classList.remove('hidden');
        drawHangman();
    }

    function renderWordSlots() {
        slotsContainer.innerHTML = '';
        for (let i = 0; i < secretWord.length; i++) {
            const char = secretWord[i];
            const slot = document.createElement('div');
            slot.className = 'ahorcado-letter-slot';
            slot.innerText = ''; // Oculto

            // Espaciar si es necesario (no aplica aquí, todas son palabras simples)
            slotsContainer.appendChild(slot);
        }
    }

    function renderKeyboard() {
        keyboardContainer.innerHTML = '';
        const alphabet = 'abcdefghijklmnñopqrstuvwxyz';
        
        for (let i = 0; i < alphabet.length; i++) {
            const char = alphabet[i];
            const btn = document.createElement('button');
            btn.className = 'ah-key';
            btn.innerText = char;
            btn.addEventListener('click', () => handleGuess(char, btn));
            keyboardContainer.appendChild(btn);
        }
    }

    // --------------------------------------------------------------------------
    // B. Control de Aciertos y Acentos en Español
    // --------------------------------------------------------------------------
    function handleGuess(letter, keyBtn) {
        if (!isPlaying || userGuesses.has(letter)) return;
        
        userGuesses.add(letter);
        if (keyBtn) {
            keyBtn.classList.add('used');
            keyBtn.disabled = true;
        }

        // Comprobar si la letra acertó (incluyendo acentos)
        let isMatch = false;
        
        for (let i = 0; i < secretWord.length; i++) {
            const secretChar = secretWord[i];
            
            // Comparar letra ingresada con letra secreta mapeando acentos
            const mapped = SPANISH_ACCENT_MAP[secretChar] || [secretChar];
            if (mapped.includes(letter)) {
                isMatch = true;
                // Revelar ranura
                slotsContainer.children[i].innerText = secretChar;
            }
        }

        if (isMatch) {
            MathQuestApp.SoundEngine.playCorrect();
            MathQuestApp.awardCoins(false, level);

            // Comprobar victoria
            if (checkWin()) {
                handleLevelComplete();
            }
        } else {
            // Falló letra
            MathQuestApp.SoundEngine.playWrong();
            lives--;
            updateHeartsDisplay();
            drawHangman();

            if (lives <= 0) {
                handleGameOver();
            }
        }
    }

    function checkWin() {
        // Victoria si no hay ranuras vacías
        for (let i = 0; i < slotsContainer.children.length; i++) {
            if (slotsContainer.children[i].innerText === '') {
                return false;
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
        let overlayText = document.getElementById('ahorcado-overlay-text');
        if (!overlayText) {
            overlayText = document.createElement('p');
            overlayText.id = 'ahorcado-overlay-text';
            const contentBox = overlay.querySelector('.overlay-content');
            if (contentBox) contentBox.insertBefore(overlayText, overlay.querySelector('button'));
        }
        overlayText.style.color = 'var(--color-accent-coral)';
        overlayText.innerHTML = `Mateo está triste... 😢 Te quedaste sin intentos.<br><b>Consecuencias:</b> Tu racha vuelve a 1 y has perdido <b>${lostAmount} MathCoins</b>. ¡Estudia más para mejorar tu vocabulario matemático!`;

        overlay.querySelector('button').innerText = "Reintentar Concepto";
        // Revelar la palabra secreta
        for (let i = 0; i < secretWord.length; i++) {
            slotsContainer.children[i].innerText = secretWord[i];
            slotsContainer.children[i].style.color = 'var(--color-accent-coral)';
        }
    }

    function handleLevelComplete() {
        isPlaying = false;

        const nextLevelKey = `ahorcado-${level + 1}`;
        if (level < 5 && !MathQuestApp.state.unlockedLevels.includes(nextLevelKey)) {
            MathQuestApp.state.unlockedLevels.push(nextLevelKey);
        }

        MathQuestApp.SoundEngine.playFanfare();
        const coinsAwarded = MathQuestApp.awardCoins(true, level);

        overlay.classList.remove('hidden');
        overlay.querySelector('h3').innerText = "¡Excelente Vocabulario! 🌟";
        overlay.querySelector('button').innerText = level < 5 ? "Siguiente Nivel" : "Volver al Mapa";
        alert(`🌟 ¡Espectacular! Adivinaste el concepto matemático de primaria. Ganaste +${coinsAwarded} MathCoins.`);
    }

    // --------------------------------------------------------------------------
    // C. Ilustración del Ahorcado en Canvas
    // --------------------------------------------------------------------------
    function drawHangman() {
        // Fondo
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Estilos del trazo
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';

        // 1. Dibujar la Horca básica (Siempre presente)
        ctx.beginPath();
        // Base
        ctx.moveTo(20, 140);
        ctx.lineTo(80, 140);
        // Poste
        ctx.moveTo(50, 140);
        ctx.lineTo(50, 20);
        // Brazo horizontal
        ctx.lineTo(130, 20);
        // Cuerda
        ctx.lineTo(130, 40);
        ctx.stroke();

        const errorCount = 6 - lives;

        // 2. Dibujar el muñeco según errores acumulados
        ctx.strokeStyle = '#ef4444'; // Muñeco en color coral neón
        ctx.lineWidth = 3;

        // Cabeza
        if (errorCount >= 1) {
            ctx.beginPath();
            ctx.arc(130, 52, 12, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Tronco (Cuerpo)
        if (errorCount >= 2) {
            ctx.beginPath();
            ctx.moveTo(130, 64);
            ctx.lineTo(130, 100);
            ctx.stroke();
        }

        // Brazo izquierdo
        if (errorCount >= 3) {
            ctx.beginPath();
            ctx.moveTo(130, 75);
            ctx.lineTo(110, 90);
            ctx.stroke();
        }

        // Brazo derecho
        if (errorCount >= 4) {
            ctx.beginPath();
            ctx.moveTo(130, 75);
            ctx.lineTo(150, 90);
            ctx.stroke();
        }

        // Pierna izquierda
        if (errorCount >= 5) {
            ctx.beginPath();
            ctx.moveTo(130, 100);
            ctx.lineTo(110, 125);
            ctx.stroke();
        }

        // Pierna derecha (Pérdida de partida)
        if (errorCount >= 6) {
            ctx.beginPath();
            ctx.moveTo(130, 100);
            ctx.lineTo(150, 125);
            ctx.stroke();
        }
    }

    // --------------------------------------------------------------------------
    // D. Eventos y Pistas Globales
    // --------------------------------------------------------------------------
    
    // Callback de Pista
    window.useAhorcadoHint = function() {
        if (!isPlaying) return false;

        // Buscar posiciones no reveladas
        const unrevealedIndices = [];
        for (let i = 0; i < slotsContainer.children.length; i++) {
            if (slotsContainer.children[i].innerText === '') {
                unrevealedIndices.push(i);
            }
        }

        if (unrevealedIndices.length > 0) {
            // Elige un índice al azar y lo revela
            const randomIdx = unrevealedIndices[Math.floor(Math.random() * unrevealedIndices.length)];
            const charToReveal = secretWord[randomIdx];

            SoundEngine.playShield();
            
            // Simular que el usuario pulsó esa tecla en el teclado para marcarla usada
            const keys = keyboardContainer.children;
            let targetBtn = null;
            for (let i = 0; i < keys.length; i++) {
                if (keys[i].innerText === charToReveal) {
                    targetBtn = keys[i];
                    break;
                }
            }

            // Revelar todas las repeticiones de ese carácter
            for (let i = 0; i < secretWord.length; i++) {
                const secretChar = secretWord[i];
                const mapped = SPANISH_ACCENT_MAP[secretChar] || [secretChar];
                if (mapped.includes(charToReveal)) {
                    slotsContainer.children[i].innerText = secretChar;
                }
            }

            if (targetBtn) {
                targetBtn.classList.add('used');
                targetBtn.disabled = true;
                userGuesses.add(charToReveal);
            }

            if (checkWin()) {
                handleLevelComplete();
            }

            return true; // Pista exitosa
        }
        return false;
    };

    btnStart.addEventListener('click', () => {
        SoundEngine.playClick();
        if (lives <= 0 || checkWin()) {
            if (level < 5 && checkWin()) {
                initGame(level + 1);
            } else if (level === 5 && checkWin()) {
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

    window.startAhorcadoGame = function(gameLevel) {
        initGame(gameLevel);
    };

})();
