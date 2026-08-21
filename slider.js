/* ==========================================================================
   MathQuest V3 - Módulo Slither-Fracciones (Fracciones Equivalentes)
   Física de movimiento constante, aceleración Boost, vidas, bombas flotantes,
   invulnerabilidad temporal, skins neón y soporte de Pistas.
   ========================================================================== */

(function() {
    const canvas = document.getElementById('slider-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const overlay = document.getElementById('slider-overlay');
    const overlayTitle = document.getElementById('slider-overlay-title');
    const btnStart = document.getElementById('btn-start-slider-game');
    const btnRestart = document.getElementById('btn-restart-slider');
    const scoreVal = document.getElementById('slider-score');
    const heartsBox = document.getElementById('slider-hearts-box');

    let player = {
        x: 250, y: 200,
        angle: 0,
        speed: 2.2,
        baseSpeed: 2.2,
        boostSpeed: 4.0,
        radius: 12,
        tail: [], // Array of {x, y}
        length: 8
    };

    let opponents = []; // Array of IA worms
    let foods = []; // Array of bubbles
    let bombs = []; // Array of floating math-bombs 💣
    let isPlaying = false;
    let score = 0;
    let lives = 3;
    let level = 1;
    let currentChallenge = null;
    
    // Invulnerabilidad temporal después de recibir daño
    let isInvulnerable = false;
    let invulnerableTimer = 0;
    
    // Mouse and Keyboard tracker
    let mousePos = { x: 250, y: 200 };
    let isBoosting = false;
    let keysPressed = { left: false, right: false };
    let gameLoopInterval = null;

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
        isInvulnerable = false;
        invulnerableTimer = 0;

        // Limpieza y reseteo de player
        player.x = canvas.width / 2;
        player.y = canvas.height / 2;
        player.angle = 0;
        player.length = 6 + level * 2;
        player.tail = [];
        for (let i = 0; i < player.length; i++) {
            player.tail.push({ x: player.x - i * 10, y: player.y });
        }

        scoreVal.innerText = player.length;
        updateHeartsDisplay();

        // Generar reto matemático de fracciones
        generateFractionChallenge();

        // Spawnear oponentes IA, comida y bombas flotantes
        spawnInitialElements();

        overlay.classList.remove('hidden');
        overlayTitle.innerText = `Slither Fracciones - Nivel ${level} 🐛`;
        draw();
    }

    function generateFractionChallenge() {
        currentChallenge = MathQuestApp.mathGen.generateSliderChallenge(level);
        
        // Renderizar fracción en LaTeX en el panel
        const equationBox = document.getElementById('slider-target-equation');
        MathQuestApp.renderLaTeX(currentChallenge.targetText, equationBox);
    }

    function spawnInitialElements() {
        // Comida
        foods = [];
        for (let i = 0; i < 12; i++) {
            foods.push(spawnFoodBubble());
        }

        // Bombas flotantes 💣 (Spawn dependiente del nivel)
        bombs = [];
        const bombCount = 1 + level; // 2 a 6 bombas
        for (let i = 0; i < bombCount; i++) {
            bombs.push({
                x: Math.random() * (canvas.width - 40) + 20,
                y: Math.random() * (canvas.height - 40) + 20,
                vx: (Math.random() * 0.8 - 0.4) * level,
                vy: (Math.random() * 0.8 - 0.4) * level,
                radius: 14
            });
        }

        // Oponentes IA (Removidos a petición)
        opponents = [];
        const opponentCount = 0;
        for (let i = 0; i < opponentCount; i++) {
            opponents.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                angle: Math.random() * Math.PI * 2,
                speed: 1.5 + level * 0.15,
                radius: 12,
                color: ['#a855f7', '#ec4899', '#f97316'][i % 3],
                tail: [],
                length: 8 + level * 2,
                name: `IA Probot #${i + 1}`
            });
            // Inicializar colas de oponentes
            const opp = opponents[opponents.length - 1];
            for (let j = 0; j < opp.length; j++) {
                opp.tail.push({ x: opp.x - j * 8, y: opp.y });
            }
        }
    }

    function spawnFoodBubble() {
        const isCorrect = Math.random() < 0.35; // 35% de ser equivalente
        let text = '';
        let value = 0;

        if (isCorrect) {
            // Selecciona una equivalente
            const eq = currentChallenge.equivalents[Math.floor(Math.random() * currentChallenge.equivalents.length)];
            text = eq;
            const parts = eq.split('/');
            value = parseInt(parts[0]) / parseInt(parts[1]);
        } else {
            // Selecciona un distractor
            const dist = currentChallenge.distractors[Math.floor(Math.random() * currentChallenge.distractors.length)];
            text = dist;
            const parts = dist.split('/');
            value = parseInt(parts[0]) / parseInt(parts[1]);
        }

        // Buscar posición espaciada
        let posX = 0, posY = 0;
        let attempts = 0;
        let tooClose = true;

        while (tooClose && attempts < 25) {
            posX = Math.random() * (canvas.width - 60) + 30;
            posY = Math.random() * (canvas.height - 60) + 30;
            tooClose = false;

            // Evitar spawnear encima del jugador
            const distToPlayer = Math.hypot(posX - player.x, posY - player.y);
            if (distToPlayer < 90) {
                tooClose = true;
                attempts++;
                continue;
            }

            // Evitar spawnear encima de otras burbujas (mantener separadas)
            for (let j = 0; j < foods.length; j++) {
                const other = foods[j];
                const d = Math.hypot(posX - other.x, posY - other.y);
                if (d < 70) {
                    tooClose = true;
                    break;
                }
            }

            // Evitar spawnear encima de las bombas
            for (let j = 0; j < bombs.length; j++) {
                const b = bombs[j];
                const d = Math.hypot(posX - b.x, posY - b.y);
                if (d < 60) {
                    tooClose = true;
                    break;
                }
            }

            attempts++;
        }

        return {
            x: posX,
            y: posY,
            text,
            value,
            isCorrect,
            radius: 18, // Aumentado de 11 a 18 para mayor visibilidad
            color: '#6366f1', // Todos del mismo color para evitar spoiler
            hintHighlighted: false
        };
    }

    // --------------------------------------------------------------------------
    // B. Física de Movimiento Constante y Boost
    // --------------------------------------------------------------------------
    function movePlayer() {
        // Rotación por teclado continua
        if (keysPressed.left) player.angle -= 0.07;
        if (keysPressed.right) player.angle += 0.07;

        // Movimiento constante: el gusano avanza en la dirección de su angle
        const targetSpeed = isBoosting && player.tail.length > 5 ? player.boostSpeed : player.baseSpeed;
        
        // Calcular diferencias y ángulo hacia el cursor
        const dx = mousePos.x - player.x;
        const dy = mousePos.y - player.y;
        
        // Girar suavemente hacia el cursor
        const targetAngle = Math.atan2(dy, dx);
        let diff = targetAngle - player.angle;
        
        // Normalizar diferencia de ángulo
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        
        // Velocidad de giro suavizada (Mejorada de 0.12 a 0.22)
        player.angle += diff * 0.22;

        // Avanzar cabeza
        player.x += Math.cos(player.angle) * targetSpeed;
        player.y += Math.sin(player.angle) * targetSpeed;

        // Muros rebotan o restan vida si sales
        if (player.x < 0 || player.x > canvas.width || player.y < 0 || player.y > canvas.height) {
            handleHit();
            return;
        }

        // Seguir cola
        const head = { x: player.x, y: player.y };
        player.tail.unshift(head);

        if (isBoosting && player.tail.length > 5 && Math.random() < 0.15) {
            // El boost consume cola (pierde masa) y la deja tirada en el camino como comida
            player.tail.pop();
            player.length = player.tail.length;
            scoreVal.innerText = player.length;

            // Dejar burbuja pequeña de masa (Boost)
            foods.push({
                x: player.tail[player.tail.length - 1].x + (Math.random() * 10 - 5),
                y: player.tail[player.tail.length - 1].y + (Math.random() * 10 - 5),
                text: currentChallenge.equivalents[0],
                value: currentChallenge.targetVal,
                isCorrect: true,
                radius: 12, // Aumentado a 12 para visibilidad
                color: '#6366f1', // Color uniforme
                hintHighlighted: false
            });
        }

        while (player.tail.length > player.length) {
            player.tail.pop();
        }
    }

    function moveOpponents() {
        opponents.forEach(opp => {
            // Comportamiento IA: persigue comida cercana o gira al azar
            let targetFood = null;
            let minDist = 180;
            
            foods.forEach(f => {
                const dist = Math.hypot(f.x - opp.x, f.y - opp.y);
                if (dist < minDist) {
                    minDist = dist;
                    targetFood = f;
                }
            });

            let targetAngle = opp.angle;
            if (targetFood) {
                targetAngle = Math.atan2(targetFood.y - opp.y, targetFood.x - opp.x);
            } else {
                // Girar al azar de vez en cuando
                if (Math.random() < 0.05) {
                    targetAngle = opp.angle + (Math.random() * 2 - 1);
                }
            }

            // Suavizado
            let diff = targetAngle - opp.angle;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            opp.angle += diff * 0.08;

            opp.x += Math.cos(opp.angle) * opp.speed;
            opp.y += Math.sin(opp.angle) * opp.speed;

            // Rebotar en muros
            if (opp.x < 10 || opp.x > canvas.width - 10) { opp.angle = Math.PI - opp.angle; }
            if (opp.y < 10 || opp.y > canvas.height - 10) { opp.angle = -opp.angle; }

            // Actualizar cola
            opp.tail.unshift({ x: opp.x, y: opp.y });
            while (opp.tail.length > opp.length) {
                opp.tail.pop();
            }
        });
    }

    function moveFloatingBombs() {
        bombs.forEach(b => {
            b.x += b.vx;
            b.y += b.vy;

            // Rebotar de muros
            if (b.x < b.radius || b.x > canvas.width - b.radius) b.vx *= -1;
            if (b.y < b.radius || b.y > canvas.height - b.radius) b.vy *= -1;
        });
    }

    // --------------------------------------------------------------------------
    // C. Detección de Colisiones (Vidas y Bombas Flotantes)
    // --------------------------------------------------------------------------
    function checkCollisions() {
        if (!isPlaying) return;

        // Decrementar invulnerabilidad
        if (isInvulnerable) {
            invulnerableTimer--;
            if (invulnerableTimer <= 0) isInvulnerable = false;
        }

        // 1. Jugador come comida
        for (let i = foods.length - 1; i >= 0; i--) {
            const f = foods[i];
            const dist = Math.hypot(player.x - f.x, player.y - f.y);
            if (dist < player.radius + f.radius) {
                // Comió!
                if (f.isCorrect) {
                    MathQuestApp.SoundEngine.playCorrect();
                    player.length += 2;
                    scoreVal.innerText = player.length;
                    
                    // Recompensas
                    MathQuestApp.awardCoins(false, level);

                    if (player.length >= 18 + level * 2) {
                        handleLevelComplete();
                        return;
                    }
                } else {
                    // Equivocada
                    MathQuestApp.SoundEngine.playWrong();
                    player.length = Math.max(5, player.length - 2);
                    scoreVal.innerText = player.length;
                    alert("⚠️ ¡Esa fracción no es equivalente!");
                }
                
                foods.splice(i, 1);
                foods.push(spawnFoodBubble());
                break;
            }
        }

        // 2. Colisión con Bombas Flotantes 💣
        if (!isInvulnerable) {
            for (let i = 0; i < bombs.length; i++) {
                const b = bombs[i];
                const dist = Math.hypot(player.x - b.x, player.y - b.y);
                if (dist < player.radius + b.radius) {
                    // Detonar bomba
                    MathQuestApp.SoundEngine.playExplosion();
                    handleHit();
                    // Empujar bomba
                    b.vx *= -1; b.vy *= -1;
                    break;
                }
            }
        }

        // 3. Colisión de cabeza del jugador con colas de oponentes IA
        if (!isInvulnerable) {
            for (let i = 0; i < opponents.length; i++) {
                const opp = opponents[i];
                // Comprobar colisión de la cabeza del player con cualquier parte del cuerpo de la IA
                for (let j = 1; j < opp.tail.length; j++) {
                    const segment = opp.tail[j];
                    const dist = Math.hypot(player.x - segment.x, player.y - segment.y);
                    if (dist < player.radius + opp.radius) {
                        handleHit();
                        return;
                    }
                }
            }
        }
    }

    function handleHit() {
        if (isInvulnerable) return;

        // Comprobar si posee Súper Escudo activo en el inventario global
        if (MathQuestApp.state.inventory.shield > 0) {
            MathQuestApp.state.inventory.shield--;
            MathQuestApp.SoundEngine.playShield();
            
            // Activar invulnerabilidad de amortiguación
            isInvulnerable = true;
            invulnerableTimer = 150; // 2.5s
            
            // Guardar
            localStorage.setItem('mq3_inventory', JSON.stringify(MathQuestApp.state.inventory));
            document.getElementById('coins-count').innerText = MathQuestApp.state.coins;
            alert("🛡️ ¡Tu Súper Escudo absorbió el impacto! Sigues a salvo.");
            return;
        }

        MathQuestApp.SoundEngine.playWrong();
        lives--;
        updateHeartsDisplay();

        if (lives <= 0) {
            handleGameOver();
        } else {
            // Auxilio: recoloca al gusano en el centro, lo hace invulnerable y reduce su cola
            player.x = canvas.width / 2;
            player.y = canvas.height / 2;
            player.angle = 0;
            player.length = Math.max(5, player.length - 3);
            player.tail = [];
            for (let i = 0; i < player.length; i++) {
                player.tail.push({ x: player.x - i * 10, y: player.y });
            }

            isInvulnerable = true;
            invulnerableTimer = 150; // Flashea por 2.5 segundos (a 60 fps)
            
            alert("⚠️ ¡Chocaste! Perdiste 1 vida. Reseteando al centro en modo invulnerable.");
        }
    }

    function handleGameOver() {
        isPlaying = false;
        clearInterval(gameLoopInterval);

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
        
        // Mateo triste en el mensaje de derrota
        let overlayText = document.getElementById('slider-overlay-text');
        if (!overlayText) {
            overlayText = document.createElement('p');
            overlayText.id = 'slider-overlay-text';
            const contentBox = overlay.querySelector('.overlay-content');
            if (contentBox) contentBox.insertBefore(overlayText, btnStart);
        }
        overlayText.style.color = 'var(--color-accent-coral)';
        overlayText.innerHTML = `Mateo está triste... 😢 Te has quedado sin corazones.<br><b>Consecuencias:</b> Tu racha vuelve a 1 y has perdido <b>${lostAmount} MathCoins</b>. ¡Practica más para mejorar tu razonamiento algebraico!`;

        btnStart.innerText = "Reintentar Nivel";
    }

    function handleLevelComplete() {
        isPlaying = false;
        clearInterval(gameLoopInterval);

        const nextLevelKey = `slider-${level + 1}`;
        if (level < 5 && !MathQuestApp.state.unlockedLevels.includes(nextLevelKey)) {
            MathQuestApp.state.unlockedLevels.push(nextLevelKey);
        }

        // Auto desbloquear Tetris Lvl 1 si completó Slither Lvl 5
        if (level === 5 && !MathQuestApp.state.unlockedLevels.includes('tetris-1')) {
            MathQuestApp.state.unlockedLevels.push('tetris-1');
        }

        MathQuestApp.SoundEngine.playFanfare();
        const coinsAwarded = MathQuestApp.awardCoins(true, level);

        overlay.classList.remove('hidden');
        btnStart.innerText = level < 5 ? "Siguiente Nivel" : "Volver al Mapa";
        alert(`🌟 ¡Increíble! Superaste el nivel del gusano equivalente. Ganaste +${coinsAwarded} MathCoins.`);
    }

    // --------------------------------------------------------------------------
    // D. Dibujado de Gráficos (Fuego, Hielo y Arcoíris en Canvas)
    // --------------------------------------------------------------------------
    function draw() {
        // Limpiar canvas
        ctx.fillStyle = '#0b0f19';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Dibujar Cuadrícula de Fondo sutil
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1.5;
        for (let i = 0; i <= canvas.width; i += 40) {
            ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
        }
        for (let i = 0; i <= canvas.height; i += 40) {
            ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
        }

        // Dibujar Comida (Globos de Fracciones)
        foods.forEach(f => {
            // Glow aura si la pista está activada y es la correcta
            if (f.isCorrect && f.hintHighlighted) {
                ctx.shadowBlur = 15;
                ctx.shadowColor = '#eab308';
                ctx.strokeStyle = '#eab308';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(f.x, f.y, f.radius + 5, 0, Math.PI * 2);
                ctx.stroke();
            }

            ctx.fillStyle = f.color;
            ctx.beginPath();
            ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;

            // Texto numérico fraccionario
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 12px Fredoka';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(f.text, f.x, f.y);
        });

        // Dibujar Bombas Flotantes 💣
        bombs.forEach(b => {
            ctx.shadowBlur = 12;
            ctx.shadowColor = '#ef4444';
            ctx.fillStyle = '#b91c1c';
            // Dibujar círculo con picos
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#f43f5e';
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.radius - 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;

            // Dibujar emoji de bomba en el centro
            ctx.fillStyle = '#ffffff';
            ctx.font = '10px Outfit';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('💣', b.x, b.y);
        });

        // Dibujar Oponentes IA
        opponents.forEach(opp => {
            ctx.fillStyle = opp.color;
            opp.tail.forEach((seg, idx) => {
                ctx.beginPath();
                ctx.arc(seg.x, seg.y, opp.radius - (idx * 0.3), 0, Math.PI * 2);
                ctx.fill();
            });

            // Nombre sobre la cabeza
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.font = '9px Outfit';
            ctx.fillText(opp.name, opp.x, opp.y - 18);
        });

        // Dibujar Jugador con Skin Equipada
        const skin = MathQuestApp.state.equippedSkin || 'standard';
        
        ctx.save();
        // Si es invulnerable, flashea transparencia
        if (isInvulnerable && Math.floor(invulnerableTimer / 4) % 2 === 0) {
            ctx.globalAlpha = 0.25;
        }

        player.tail.forEach((seg, idx) => {
            const isHead = idx === 0;
            let fillStyle = '#10b981'; // standard
            let glowColor = 'rgba(16,185,129,0.4)';

            if (skin === 'fire') {
                fillStyle = isHead ? '#ef4444' : '#f97316';
                glowColor = 'rgba(239,68,68,0.6)';
            } else if (skin === 'ice') {
                fillStyle = isHead ? '#3b82f6' : '#06b6d4';
                glowColor = 'rgba(6,182,212,0.6)';
            } else if (skin === 'rainbow') {
                const hue = (Date.now() / 15 + idx * 18) % 360;
                fillStyle = `hsl(${hue}, 90%, 60%)`;
                glowColor = `hsla(${hue}, 90%, 60%, 0.5)`;
            }

            ctx.shadowBlur = 10;
            ctx.shadowColor = glowColor;
            ctx.fillStyle = fillStyle;

            ctx.beginPath();
            ctx.arc(seg.x, seg.y, player.radius - (idx * 0.4), 0, Math.PI * 2);
            ctx.fill();
        });
        
        ctx.restore();

        // Si es invulnerable, dibujar anillo protector encima
        if (isInvulnerable) {
            ctx.save();
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#3b82f6';
            ctx.strokeStyle = '#60a5fa';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(player.x, player.y, player.radius + 10, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        ctx.shadowBlur = 0;
    }

    // --------------------------------------------------------------------------
    // E. Eventos y Teclado Centralizado
    // --------------------------------------------------------------------------
    
    // Captura de movimientos del mouse
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        mousePos.x = e.clientX - rect.left;
        mousePos.y = e.clientY - rect.top;
    });

    canvas.addEventListener('mousedown', () => { isBoosting = true; });
    canvas.addEventListener('mouseup', () => { isBoosting = false; });

    // Touch móvil
    canvas.addEventListener('touchmove', (e) => {
        const rect = canvas.getBoundingClientRect();
        mousePos.x = e.touches[0].clientX - rect.left;
        mousePos.y = e.touches[0].clientY - rect.top;
    });

    canvas.addEventListener('touchstart', () => { isBoosting = true; });
    canvas.addEventListener('touchend', () => { isBoosting = false; });

    // Lector de teclado continuo para mejorar conducción
    window.addEventListener('keydown', (e) => {
        if (!isPlaying) return;
        const key = e.key.toLowerCase();
        if (key === 'a' || e.key === 'ArrowLeft') keysPressed.left = true;
        if (key === 'd' || e.key === 'ArrowRight') keysPressed.right = true;
    });
    window.addEventListener('keyup', (e) => {
        const key = e.key.toLowerCase();
        if (key === 'a' || e.key === 'ArrowLeft') keysPressed.left = false;
        if (key === 'd' || e.key === 'ArrowRight') keysPressed.right = false;
    });

    // Movimiento constante vía WASD / Flechas (Llamado centralizado desde app.js)
    window.handleSliderKeyboardDirection = function(dir) {
        if (!isPlaying) return;
        
        // Simular movimiento constante alterando el ángulo de forma relativa
        let angleDelta = 0.22;
        if (dir === 'left') player.angle -= angleDelta;
        if (dir === 'right') player.angle += angleDelta;
        
        // Simular mousePos adelante del gusano
        mousePos.x = player.x + Math.cos(player.angle) * 80;
        mousePos.y = player.y + Math.sin(player.angle) * 80;
    };

    window.setSliderBoost = function(boostState) {
        isBoosting = boostState;
    };

    window.useSliderHint = function() {
        SoundEngine.playShield();
        foods.forEach(f => {
            if (f.isCorrect) f.hintHighlighted = true;
        });
        draw();
        alert("💡 ¡Pista activada! Se destacaron las fracciones equivalentes correctas.");
        return true;
    };

    btnStart.addEventListener('click', () => {
        SoundEngine.playClick();
        if (lives <= 0 || player.length >= 18 + level * 2) {
            initGame(level);
        }
        
        overlay.classList.add('hidden');
        isPlaying = true;

        // Inmunidad inicial al comenzar
        isInvulnerable = true;
        invulnerableTimer = 150; // 2.5 segundos de inmunidad al nacer

        clearInterval(gameLoopInterval);
        gameLoopInterval = setInterval(() => {
            if (isPlaying) {
                movePlayer();
                moveOpponents();
                moveFloatingBombs();
                checkCollisions();
                draw();
            }
        }, 1000 / 60); // 60 FPS suavizado
    });

    btnRestart.addEventListener('click', () => {
        SoundEngine.playClick();
        initGame(level);
    });

    window.startSliderGame = function(gameLevel) {
        initGame(gameLevel);
    };

})();
