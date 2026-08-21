/* ==========================================================================
   MathQuest V4 - Módulo Balanza Lógica (Razonamiento Algebraico Visual)
   Física de balanza oscilante, sustitución de variables y castigo real por Game Over.
   ========================================================================== */

(function() {
    const canvas = document.getElementById('balanza-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const overlay = document.getElementById('balanza-overlay');
    const overlayTitle = document.getElementById('balanza-overlay-title');
    const overlayInstructions = document.getElementById('balanza-overlay-instructions');
    const btnStart = document.getElementById('btn-start-balanza-game');
    const btnRestart = document.getElementById('btn-restart-balanza');
    
    const heartsBox = document.getElementById('balanza-hearts-box');
    const riddleBox = document.getElementById('balanza-hint-riddle');
    const optionsBox = document.getElementById('balanza-options-box');

    let isPlaying = false;
    let score = 0;
    let lives = 3;
    let level = 1;
    let currentChallenge = null;
    let tiltAngle = 0; // Ángulo de inclinación de la balanza
    let targetTiltAngle = 0;
    let drawInterval = null;

    // Banco de Retos de Razonamiento Algebraico por Nivel
    const CHALLENGES = {
        1: [
            {
                riddle: "En la balanza de platillos:\nPlatillo Izquierdo: 1 Cubo 🟧 + un peso de 3g\nPlatillo Derecho: un peso de 8g\nAmbos platillos están en equilibrio.",
                query: "¿Cuánto pesa el Cubo 🟧?",
                options: [3, 4, 5, 6],
                correct: 5,
                drawLeft: ['cube', 'weight-3'],
                drawRight: ['weight-8']
            },
            {
                riddle: "En la balanza de platillos:\nPlatillo Izquierdo: 1 Pirámide 🔺 + un peso de 2g\nPlatillo Derecho: un peso de 10g\nAmbos platillos están en equilibrio.",
                query: "¿Cuánto pesa la Pirámide 🔺?",
                options: [5, 6, 8, 9],
                correct: 8,
                drawLeft: ['pyramid', 'weight-2'],
                drawRight: ['weight-10']
            }
        ],
        2: [
            {
                riddle: "Pistas:\n- 2 Esferas 🟢 pesan en total 12g.\n- 1 Esfera 🟢 + 1 Cubo 🟧 pesan 10g.",
                query: "¿Cuánto pesa el Cubo 🟧?",
                options: [2, 4, 6, 8],
                correct: 4, // 2E = 12 => E = 6. E + C = 10 => 6 + C = 10 => C = 4
                drawLeft: ['sphere', 'cube'],
                drawRight: ['weight-10']
            },
            {
                riddle: "Pistas:\n- 2 Pirámides 🔺 pesan en total 16g.\n- 1 Pirámide 🔺 + 1 Esfera 🟢 pesan 11g.",
                query: "¿Cuánto pesa la Esfera 🟢?",
                options: [2, 3, 5, 6],
                correct: 3, // 2P = 16 => P = 8. P + E = 11 => 8 + E = 11 => E = 3
                drawLeft: ['pyramid', 'sphere'],
                drawRight: ['weight-11']
            }
        ],
        3: [
            {
                riddle: "Balanza 1: 1 Cubo 🟧 equilibra a 2 Esferas 🟢.\nBalanza 2: 2 Esferas 🟢 equilibran un peso de 8g.",
                query: "¿Cuánto pesa el Cubo 🟧?",
                options: [4, 6, 8, 10],
                correct: 8, // C = 2E. 2E = 8 => C = 8
                drawLeft: ['cube'],
                drawRight: ['sphere', 'sphere']
            },
            {
                riddle: "Balanza 1: 1 Pirámide 🔺 equilibra a 3 Esferas 🟢.\nBalanza 2: 3 Esferas 🟢 equilibran un peso de 9g.",
                query: "¿Cuánto pesa la Pirámide 🔺?",
                options: [3, 6, 9, 12],
                correct: 9, // P = 3E. 3E = 9 => P = 9
                drawLeft: ['pyramid'],
                drawRight: ['sphere', 'sphere', 'sphere']
            }
        ],
        4: [
            {
                riddle: "Balanza equilibrada:\nPlatillo Izquierdo: 1 Cubo 🟧 + 1 Esfera 🟢\nPlatillo Derecho: un peso de 16g\nPista: 1 Cubo 🟧 equivale a 3 Esferas 🟢.",
                query: "¿Cuánto pesa la Esfera 🟢?",
                options: [3, 4, 5, 6],
                correct: 4, // C + E = 16. C = 3E => 3E + E = 16 => 4E = 16 => E = 4
                drawLeft: ['cube', 'sphere'],
                drawRight: ['weight-16']
            },
            {
                riddle: "Balanza equilibrada:\nPlatillo Izquierdo: 1 Pirámide 🔺 + 1 Cubo 🟧\nPlatillo Derecho: un peso de 20g\nPista: 1 Pirámide 🔺 equivale a 4 Cubos 🟧.",
                query: "¿Cuánto pesa el Cubo 🟧?",
                options: [3, 4, 5, 6],
                correct: 4, // P + C = 20. P = 4C => 4C + C = 20 => 5C = 20 => C = 4
                drawLeft: ['pyramid', 'cube'],
                drawRight: ['weight-20']
            }
        ],
        5: [
            {
                riddle: "Sistemas de pesos cruzados:\n- 1 Cubo 🟧 + 1 Esfera 🟢 = 10g.\n- 1 Esfera 🟢 + 1 Pirámide 🔺 = 12g.\n- 1 Cubo 🟧 + 1 Pirámide 🔺 = 8g.",
                query: "¿Cuánto pesa el Cubo 🟧?",
                options: [2, 3, 4, 5],
                correct: 3, // C+E=10, E+P=12, C+P=8 => 2(C+E+P)=30 => C+E+P=15. C = 15 - (E+P) = 15 - 12 = 3
                drawLeft: ['cube', 'sphere'],
                drawRight: ['weight-10']
            },
            {
                riddle: "Sistemas de pesos cruzados:\n- 1 Cubo 🟧 + 1 Esfera 🟢 = 9g.\n- 1 Esfera 🟢 + 1 Pirámide 🔺 = 11g.\n- 1 Cubo 🟧 + 1 Pirámide 🔺 = 10g.",
                query: "¿Cuánto pesa el Cubo 🟧?",
                options: [3, 4, 5, 6],
                correct: 4, // C+E=9, E+P=11, C+P=10 => C = 15 - 11 = 4
                drawLeft: ['cube', 'sphere'],
                drawRight: ['weight-9']
            }
        ]
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
        tiltAngle = 0;
        targetTiltAngle = 0;

        updateHeartsDisplay();

        // Cargar un desafío aleatorio para el nivel seleccionado
        const bank = CHALLENGES[level] || CHALLENGES[1];
        currentChallenge = bank[Math.floor(Math.random() * bank.length)];

        // Mostrar texto descriptivo
        riddleBox.innerText = currentChallenge.riddle;

        // Renderizar opciones múltiples de respuesta
        renderOptions();

        overlay.classList.remove('hidden');
        overlayTitle.innerText = `Balanza de Mateo - Nivel ${level} ⚖️`;
        
        // Iniciar bucle de dibujado de balanza oscilante
        clearInterval(drawInterval);
        drawInterval = setInterval(() => {
            updatePhysics();
            draw();
        }, 1000 / 30);
    }

    function renderOptions() {
        if (!optionsBox) return;
        optionsBox.innerHTML = '';

        currentChallenge.options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'btn-option-balanza';
            btn.innerText = `${opt} g`;
            btn.addEventListener('click', () => submitAnswer(opt));
            optionsBox.appendChild(btn);
        });
    }

    // --------------------------------------------------------------------------
    // B. Lógica y Validación de Respuestas
    // --------------------------------------------------------------------------
    function submitAnswer(selectedVal) {
        if (!isPlaying) return;

        const isCorrect = selectedVal === currentChallenge.correct;

        if (isCorrect) {
            MathQuestApp.SoundEngine.playCorrect();
            targetTiltAngle = 0; // Se equilibra perfectamente!
            isPlaying = false;
            
            // Recompensas escalonadas progresivas
            const coinsAwarded = MathQuestApp.awardCoins(true, level);
            
            alert(`🎉 ¡Excelente! Respuesta correcta. La balanza se equilibra. Ganaste +${coinsAwarded} MathCoins.`);

            // Desbloquear siguiente nivel
            const nextLevelKey = `balanza-${level + 1}`;
            if (level < 5 && !MathQuestApp.state.unlockedLevels.includes(nextLevelKey)) {
                MathQuestApp.state.unlockedLevels.push(nextLevelKey);
            }

            // Desbloquear estrella extra si corresponde
            setTimeout(() => {
                handleNextLevel();
            }, 1200);
        } else {
            MathQuestApp.SoundEngine.playWrong();
            lives--;
            updateHeartsDisplay();

            // Inclinar la balanza bruscamente al equivocarse
            targetTiltAngle = (Math.random() < 0.5 ? -0.15 : 0.15);

            if (lives <= 0) {
                isPlaying = false;
                handleGameOver();
            } else {
                alert("❌ ¡Incorrecto! La balanza se desequilibra. Sigue calculando.");
                setTimeout(() => {
                    targetTiltAngle = -0.05; // Leve desequilibrio continuo
                }, 1000);
            }
        }
    }

    function handleNextLevel() {
        isPlaying = false;
        clearInterval(drawInterval);

        if (level < 5) {
            level++;
            initGame(level);
        } else {
            // Completado todos los niveles de Balanza Lógica
            alert("🏆 ¡Felicitaciones! Has dominado el juego de la Balanza Lógica y completado todos sus niveles.");
            document.getElementById('btn-back-menu').click();
        }
    }

    // --------------------------------------------------------------------------
    // C. Castigo Real de Derrotas (Game Over)
    // --------------------------------------------------------------------------
    function handleGameOver() {
        isPlaying = false;
        clearInterval(drawInterval);

        // Castigo real:
        // 1. Resetear racha diaria
        MathQuestApp.state.streak = 1;

        // 2. Descontar 20 MathCoins (mínimo 0)
        const penalty = 20;
        const previousCoins = MathQuestApp.state.coins;
        MathQuestApp.state.coins = Math.max(0, MathQuestApp.state.coins - penalty);
        const lostAmount = previousCoins - MathQuestApp.state.coins;

        // Guardar estado
        try {
            localStorage.setItem('mq3_streak', MathQuestApp.state.streak);
            localStorage.setItem('mq3_coins', MathQuestApp.state.coins);
        } catch(e){}

        // Actualizar header
        document.getElementById('streak-count').innerText = MathQuestApp.state.streak;
        document.getElementById('coins-count').innerText = MathQuestApp.state.coins;

        overlay.classList.remove('hidden');
        overlayTitle.innerText = "¡Juego Terminado! 💔";
        
        // Mateo triste en el mensaje de derrota
        const overlayText = document.getElementById('balanza-overlay-text') || document.createElement('p');
        overlayText.id = 'balanza-overlay-text';
        overlayText.style.color = 'var(--color-accent-coral)';
        overlayText.innerHTML = `Mateo está triste... 😢 Te has quedado sin corazones.<br><b>Consecuencias:</b> Tu racha vuelve a 1 y has perdido <b>${lostAmount} MathCoins</b>. ¡Practica más para mejorar tu razonamiento algebraico!`;
        
        const contentBox = overlay.querySelector('.overlay-content');
        if (contentBox && !document.getElementById('balanza-overlay-text')) {
            contentBox.insertBefore(overlayText, btnStart);
        }

        btnStart.innerText = "Reintentar Nivel";
    }

    // --------------------------------------------------------------------------
    // D. Animaciones y Física del Canvas
    // --------------------------------------------------------------------------
    function updatePhysics() {
        // Acercar suavemente tiltAngle a targetTiltAngle
        tiltAngle += (targetTiltAngle - tiltAngle) * 0.1;
    }

    function draw() {
        ctx.fillStyle = '#0b0f19';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Cuadrícula sutil
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;
        for (let i = 0; i <= canvas.width; i += 30) {
            ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
        }
        for (let i = 0; i <= canvas.height; i += 30) {
            ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
        }

        const cX = canvas.width / 2;
        const cY = canvas.height - 80;

        // 1. Dibujar Soporte/Base Vertical
        ctx.fillStyle = '#475569';
        ctx.fillRect(cX - 8, cY - 140, 16, 140); // Columna
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(cX - 40, cY, 80, 15); // Base del suelo

        // Fulcro superior
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.arc(cX, cY - 140, 10, 0, Math.PI * 2);
        ctx.fill();

        // 2. Dibujar Brazo Horizontal (Rotado por tiltAngle)
        ctx.save();
        ctx.translate(cX, cY - 140);
        ctx.rotate(tiltAngle);

        const beamHalfLen = 130;
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(-beamHalfLen, 0);
        ctx.lineTo(beamHalfLen, 0);
        ctx.stroke();

        // Ganchos en extremos del brazo
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.arc(-beamHalfLen, 0, 5, 0, Math.PI * 2);
        ctx.arc(beamHalfLen, 0, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        // 3. Posiciones de los Platillos (Pans)
        // Se calculan considerando la rotación del brazo para colgar verticalmente
        const leftPanX = cX - Math.cos(tiltAngle) * beamHalfLen;
        const leftPanY = (cY - 140) - Math.sin(tiltAngle) * beamHalfLen;

        const rightPanX = cX + Math.cos(tiltAngle) * beamHalfLen;
        const rightPanY = (cY - 140) + Math.sin(tiltAngle) * beamHalfLen;

        // Cuerdas de los platillos
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2;
        
        // Izquierda
        ctx.beginPath();
        ctx.moveTo(leftPanX, leftPanY);
        ctx.lineTo(leftPanX - 25, leftPanY + 50);
        ctx.moveTo(leftPanX, leftPanY);
        ctx.lineTo(leftPanX + 25, leftPanY + 50);
        ctx.stroke();
        
        // Derecha
        ctx.beginPath();
        ctx.moveTo(rightPanX, rightPanY);
        ctx.lineTo(rightPanX - 25, rightPanY + 50);
        ctx.moveTo(rightPanX, rightPanY);
        ctx.lineTo(rightPanX + 25, rightPanY + 50);
        ctx.stroke();

        // Dibujar Bases de Platillos
        ctx.fillStyle = '#334155';
        ctx.fillRect(leftPanX - 35, leftPanY + 50, 70, 6);
        ctx.fillRect(rightPanX - 35, rightPanY + 50, 70, 6);

        // 4. Dibujar Objetos/Figuras encima de los platillos
        if (currentChallenge) {
            // Dibujar objetos izquierda
            drawItemsOnPan(currentChallenge.drawLeft, leftPanX, leftPanY + 48);
            // Dibujar objetos derecha
            drawItemsOnPan(currentChallenge.drawRight, rightPanX, rightPanY + 48);
        }
    }

    function drawItemsOnPan(items, panX, panBaseY) {
        if (!items) return;

        items.forEach((item, idx) => {
            const offset = (idx - (items.length - 1) / 2) * 22; // alinear lado a lado
            const itemX = panX + offset;
            const itemY = panBaseY - 10;

            if (item === 'cube') {
                // Cubo 3D Naranja
                ctx.fillStyle = '#f97316';
                ctx.fillRect(itemX - 8, itemY - 16, 16, 16);
                ctx.strokeStyle = '#ea580c';
                ctx.lineWidth = 1.5;
                ctx.strokeRect(itemX - 8, itemY - 16, 16, 16);
                // Cara superior sutil
                ctx.fillStyle = '#ffedd5';
                ctx.beginPath();
                ctx.moveTo(itemX - 8, itemY - 16);
                ctx.lineTo(itemX - 4, itemY - 20);
                ctx.lineTo(itemX + 12, itemY - 20);
                ctx.lineTo(itemX + 8, itemY - 16);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            } else if (item === 'sphere') {
                // Esfera Azul
                ctx.fillStyle = '#3b82f6';
                ctx.beginPath();
                ctx.arc(itemX, itemY - 8, 9, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#2563eb';
                ctx.lineWidth = 1.5;
                ctx.stroke();
                // Brillo
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(itemX - 3, itemY - 11, 2, 0, Math.PI * 2);
                ctx.fill();
            } else if (item === 'pyramid') {
                // Pirámide Coral/Roja
                ctx.fillStyle = '#f43f5e';
                ctx.beginPath();
                ctx.moveTo(itemX, itemY - 18);
                ctx.lineTo(itemX - 10, itemY);
                ctx.lineTo(itemX + 10, itemY);
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = '#e11d48';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            } else if (item.startsWith('weight-')) {
                // Pesa Gris con número
                const label = item.split('-')[1] + 'g';
                ctx.fillStyle = '#475569';
                ctx.beginPath();
                ctx.moveTo(itemX - 10, itemY);
                ctx.lineTo(itemX - 8, itemY - 18);
                ctx.lineTo(itemX + 8, itemY - 18);
                ctx.lineTo(itemX + 10, itemY);
                ctx.closePath();
                ctx.fill();

                // Manija superior
                ctx.strokeStyle = '#475569';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.arc(itemX, itemY - 18, 4, Math.PI, 2 * Math.PI);
                ctx.stroke();

                // Texto numérico
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 8px Outfit';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(label, itemX, itemY - 9);
            }
        });
    }

    // --------------------------------------------------------------------------
    // E. Eventos y Teclado
    // --------------------------------------------------------------------------
    btnStart.addEventListener('click', () => {
        MathQuestApp.SoundEngine.playClick();
        if (lives <= 0) {
            initGame(level);
        }
        
        // Quitar texto extra si existe
        const txtPenalty = document.getElementById('balanza-overlay-text');
        if (txtPenalty) txtPenalty.remove();

        overlay.classList.add('hidden');
        isPlaying = true;
        targetTiltAngle = -0.05; // Leve desequilibrio inicial hasta resolver
    });

    btnRestart.addEventListener('click', () => {
        MathQuestApp.SoundEngine.playClick();
        initGame(level);
    });

    window.startBalanzaGame = function(gameLevel) {
        initGame(gameLevel);
    };

    window.stopBalanzaGame = function() {
        isPlaying = false;
        clearInterval(drawInterval);
    };

})();
