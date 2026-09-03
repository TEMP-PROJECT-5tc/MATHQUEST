/* ==========================================================================
   MathQuest V3 - Core Application Controller, Audio & Game Engine
   Administra el estado, el sistema de medallas por logros, tienda de pistas,
   volumen, monetización del bypass VIP, cambio de tema, avatares gráficos 3D
   y economía progresiva de MathCoins.
   ========================================================================== */

// --------------------------------------------------------------------------
// 1. Estado Global de la Aplicación
// --------------------------------------------------------------------------
const state = {
    streak: 1,
    stars: 0,
    coins: 150,
    globalHints: 2,
    userLevel: 1,
    soundEnabled: true,
    musicEnabled: true,
    musicVolume: 0.4,
    musicTrack: 'adventure',
    equippedAvatar: 'cubo',
    equippedSkin: 'standard',
    equippedBadge: '',
    unlockedSkins: ['standard'],
    unlockedLevels: ['snake-1', 'slider-1', 'tetris-1', 'arkanoid-1', 'sudoku-1', 'ahorcado-1', 'tres-1'],
    
    // VIP Premium Monetización
    vipBypassPurchased: false,

    // Mochila de potenciadores comprados
    inventory: {
        shield: 0,  // Súper Escudo
        freeze: 0   // Congelador de tiempo
    },

    activeGameScreen: null, // 'snake', 'tetris', 'slider', 'sudoku', 'ahorcado'
    activeGameLevel: 1      // Nivel activo del juego (1 al 5)
};

// Asignar al objeto global temprano para máxima compatibilidad
window.state = state;
window.MathQuestApp = window.MathQuestApp || {};
window.MathQuestApp.state = state;
window.MathQuestGames = window.MathQuestGames || {};

// Sistema de Notificaciones Toast Universal (Seguro contra bloqueos de sandbox en iframes)
window.showToast = function(msg) {
    let toast = document.getElementById('app-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'app-toast';
        toast.className = 'app-toast';
        document.body.appendChild(toast);
    }
    toast.innerText = msg;
    toast.classList.remove('hidden');
    toast.style.opacity = '1';
    if (window._toastTimer) clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.classList.add('hidden'), 300);
    }, 3000);
};

// Sustituir alert() nativo para prevenir bloqueos de 'allow-modals' en iframes de AI Studio / GitHub Pages
window.alert = function(msg) {
    window.showToast(msg);
};

// Prefijo para LocalStorage
const STORAGE_PREFIX = 'mq3_';

function loadStateFromStorage() {
    try {
        if (localStorage.getItem(STORAGE_PREFIX + 'streak')) {
            state.streak = parseInt(localStorage.getItem(STORAGE_PREFIX + 'streak'));
            state.stars = parseInt(localStorage.getItem(STORAGE_PREFIX + 'stars'));
            state.coins = parseInt(localStorage.getItem(STORAGE_PREFIX + 'coins'));
            state.globalHints = parseInt(localStorage.getItem(STORAGE_PREFIX + 'global_hints'));
            state.userLevel = parseInt(localStorage.getItem(STORAGE_PREFIX + 'user_level'));
            state.soundEnabled = localStorage.getItem(STORAGE_PREFIX + 'sound_enabled') === 'true';
            
            if (localStorage.getItem(STORAGE_PREFIX + 'music_enabled') !== null) {
                state.musicEnabled = localStorage.getItem(STORAGE_PREFIX + 'music_enabled') === 'true';
            }
            if (localStorage.getItem(STORAGE_PREFIX + 'music_volume') !== null) {
                state.musicVolume = parseFloat(localStorage.getItem(STORAGE_PREFIX + 'music_volume'));
            }
            state.musicTrack = localStorage.getItem(STORAGE_PREFIX + 'music_track') || 'adventure';

            state.equippedAvatar = localStorage.getItem(STORAGE_PREFIX + 'equipped_avatar') || 'cubo';
            state.equippedSkin = localStorage.getItem(STORAGE_PREFIX + 'equipped_skin') || 'standard';
            state.equippedBadge = localStorage.getItem(STORAGE_PREFIX + 'equipped_badge') || '';
            state.unlockedSkins = JSON.parse(localStorage.getItem(STORAGE_PREFIX + 'unlocked_skins')) || ['standard'];
            state.unlockedLevels = JSON.parse(localStorage.getItem(STORAGE_PREFIX + 'unlocked_levels')) || ['snake-1', 'slider-1', 'tetris-1', 'arkanoid-1', 'sudoku-1', 'ahorcado-1', 'tres-1'];
            
            // Migrar niveles viejos de balanza a tres para no bloquear al usuario
            state.unlockedLevels = state.unlockedLevels.map(lvl => lvl.replace('balanza-', 'tres-'));
            if (!state.unlockedLevels.includes('tres-1')) {
                state.unlockedLevels.push('tres-1');
            }
            if (!state.unlockedLevels.includes('arkanoid-1')) {
                state.unlockedLevels.push('arkanoid-1');
            }

            // Migración progresiva segura para nuevos juegos (desbloqueo de sucesores retroactivos)
            if (state.unlockedLevels.includes('slider-5') && !state.unlockedLevels.includes('rush-1')) {
                state.unlockedLevels.push('rush-1');
            }
            if (state.unlockedLevels.includes('arkanoid-5') && !state.unlockedLevels.includes('builder-1')) {
                state.unlockedLevels.push('builder-1');
            }
            if (state.unlockedLevels.includes('tres-5') && !state.unlockedLevels.includes('escape-1')) {
                state.unlockedLevels.push('escape-1');
            }
            if (state.unlockedLevels.includes('escape-5') && !state.unlockedLevels.includes('duel-1')) {
                state.unlockedLevels.push('duel-1');
            }

            state.vipBypassPurchased = localStorage.getItem(STORAGE_PREFIX + 'vip_bypass_purchased') === 'true';
            if (state.vipBypassPurchased) {
                // Asegurar los 55 niveles para cuentas con Pase VIP adquirido
                const allGames = ['snake', 'slider', 'rush', 'tetris', 'arkanoid', 'builder', 'sudoku', 'ahorcado', 'tres', 'escape', 'duel'];
                allGames.forEach(g => {
                    for (let l = 1; l <= 5; l++) {
                        const k = `${g}-${l}`;
                        if (!state.unlockedLevels.includes(k)) state.unlockedLevels.push(k);
                    }
                });
            }

            const savedInventory = localStorage.getItem(STORAGE_PREFIX + 'inventory');
            if (savedInventory) {
                state.inventory = JSON.parse(savedInventory);
            }
        }
        
        // Cargar Tema
        const savedTheme = localStorage.getItem(STORAGE_PREFIX + 'theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);
    } catch (e) {
        console.error("Error al cargar estado:", e);
    }
}

function saveStateToStorage() {
    try {
        localStorage.setItem(STORAGE_PREFIX + 'streak', state.streak);
        localStorage.setItem(STORAGE_PREFIX + 'stars', state.stars);
        localStorage.setItem(STORAGE_PREFIX + 'coins', state.coins);
        localStorage.setItem(STORAGE_PREFIX + 'global_hints', state.globalHints);
        localStorage.setItem(STORAGE_PREFIX + 'user_level', state.userLevel);
        localStorage.setItem(STORAGE_PREFIX + 'sound_enabled', state.soundEnabled);
        localStorage.setItem(STORAGE_PREFIX + 'music_enabled', state.musicEnabled);
        localStorage.setItem(STORAGE_PREFIX + 'music_volume', state.musicVolume);
        localStorage.setItem(STORAGE_PREFIX + 'music_track', state.musicTrack);
        localStorage.setItem(STORAGE_PREFIX + 'equipped_avatar', state.equippedAvatar);
        localStorage.setItem(STORAGE_PREFIX + 'equipped_skin', state.equippedSkin);
        localStorage.setItem(STORAGE_PREFIX + 'equipped_badge', state.equippedBadge);
        localStorage.setItem(STORAGE_PREFIX + 'unlocked_skins', JSON.stringify(state.unlockedSkins));
        localStorage.setItem(STORAGE_PREFIX + 'unlocked_levels', JSON.stringify(state.unlockedLevels));
        localStorage.setItem(STORAGE_PREFIX + 'vip_bypass_purchased', state.vipBypassPurchased);
        localStorage.setItem(STORAGE_PREFIX + 'inventory', JSON.stringify(state.inventory));
    } catch (e) {
        console.error("Error al guardar estado:", e);
    }
}

// --------------------------------------------------------------------------
// 2. Motor de Audio Sintetizado (Web Audio API) y Banda Sonora Procedural
// --------------------------------------------------------------------------
const SoundEngine = {
    ctx: null,

    init() {
        if (!this.ctx) {
            try {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (AudioCtx) {
                    this.ctx = new AudioCtx();
                }
            } catch (e) {
                console.warn("AudioContext no disponible en este entorno:", e);
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            try {
                this.ctx.resume();
            } catch (e) {}
        }
    },

    playTone(freq, type, duration, vol) {
        if (!state.soundEnabled) return;
        this.init();
        if (!this.ctx) return;
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            
            osc.type = type || 'sine';
            osc.frequency.value = freq;
            
            gain.gain.setValueAtTime(vol || 0.15, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
            
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            
            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        } catch (e) {
            console.warn("Audio tone error:", e);
        }
    },

    playClick() {
        this.playTone(600, 'triangle', 0.1, 0.1);
    },

    playCorrect() {
        this.playTone(523.25, 'sine', 0.15, 0.15);
        setTimeout(() => this.playTone(659.25, 'sine', 0.15, 0.15), 100);
        setTimeout(() => this.playTone(783.99, 'sine', 0.3, 0.15), 200);
    },

    playWrong() {
        this.playTone(180, 'sawtooth', 0.4, 0.2);
    },

    playExplosion() {
        if (!state.soundEnabled) return;
        this.init();
        if (!this.ctx) return;
        try {
            const bufferSize = this.ctx.sampleRate * 0.4;
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            
            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer;
            
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(800, this.ctx.currentTime);
            filter.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.4);
            
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);
            
            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);
            
            noise.start();
        } catch (e) {}
    },

    playShield() {
        this.playTone(987.77, 'sine', 0.1, 0.15);
        setTimeout(() => this.playTone(1174.66, 'sine', 0.25, 0.15), 80);
    },

    playTimeFreeze() {
        if (!state.soundEnabled) return;
        this.init();
        if (!this.ctx) return;
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.frequency.setValueAtTime(880, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(220, this.ctx.currentTime + 0.6);
            gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.6);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.6);
        } catch(e){}
    },

    playFanfare() {
        const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, idx) => {
            setTimeout(() => {
                this.playTone(freq, 'sine', 0.35, 0.2);
            }, idx * 100);
        });
    }
};

// --------------------------------------------------------------------------
// 2.1 Motor de Música de Fondo (Music Engine) - Sintetizador Web Audio
// --------------------------------------------------------------------------
const NOTE_FREQS = {
    C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, B3: 246.94,
    C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
    C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00, B5: 987.77,
    C6: 1046.50, D6: 1174.66, E6: 1318.51, G6: 1567.98
};

const MusicEngine = {
    masterGain: null,
    isPlaying: false,
    timerId: null,
    currentStep: 0,
    nextNoteTime: 0,
    tempo: 116,
    ducked: false,

    init() {
        SoundEngine.init();
        if (!this.masterGain && SoundEngine.ctx) {
            this.masterGain = SoundEngine.ctx.createGain();
            this.masterGain.gain.setValueAtTime(state.musicEnabled ? state.musicVolume : 0, SoundEngine.ctx.currentTime);
            this.masterGain.connect(SoundEngine.ctx.destination);
        }
    },

    start() {
        if (this.isPlaying) return;
        this.init();
        if (!SoundEngine.ctx) return;

        this.isPlaying = true;
        this.currentStep = 0;
        this.nextNoteTime = SoundEngine.ctx.currentTime + 0.05;
        this.applyVolume();

        if (this.timerId) clearInterval(this.timerId);
        this.timerId = setInterval(() => this.scheduleLoop(), 25);
        this.updateUiState();
    },

    stop() {
        this.isPlaying = false;
        if (this.timerId) {
            clearInterval(this.timerId);
            this.timerId = null;
        }
        this.updateUiState();
    },

    toggle() {
        state.musicEnabled = !state.musicEnabled;
        if (state.musicEnabled) {
            this.start();
        } else {
            this.applyVolume();
        }
        saveStateToStorage();
        this.updateUiState();
    },

    setVolume(vol) {
        state.musicVolume = Math.max(0, Math.min(1, vol));
        this.applyVolume();
        saveStateToStorage();
    },

    setTrack(trackKey) {
        state.musicTrack = trackKey;
        this.currentStep = 0;
        if (trackKey === 'lofi') this.tempo = 88;
        else if (trackKey === 'arcade') this.tempo = 132;
        else this.tempo = 116;
        saveStateToStorage();
    },

    duck() {
        this.ducked = true;
        this.applyVolume();
    },

    unduck() {
        this.ducked = false;
        this.applyVolume();
    },

    applyVolume() {
        if (!this.masterGain || !SoundEngine.ctx) return;
        const targetVol = !state.musicEnabled 
            ? 0 
            : (this.ducked ? state.musicVolume * 0.15 : state.musicVolume);
        
        try {
            this.masterGain.gain.setTargetAtTime(targetVol, SoundEngine.ctx.currentTime, 0.15);
        } catch (e) {}
    },

    updateUiState() {
        const toggleBtn = document.getElementById('btn-music-toggle');
        const toggleIcon = document.getElementById('music-toggle-icon');
        const settingsToggleBtn = document.getElementById('btn-toggle-music');
        const volumeDisplay = document.getElementById('music-volume-display');
        const volumeSlider = document.getElementById('music-volume-slider');
        const trackSelect = document.getElementById('music-track-select');

        const isActuallyActive = state.musicEnabled && this.isPlaying;

        if (toggleBtn) {
            if (isActuallyActive) {
                toggleBtn.classList.add('playing');
                toggleBtn.title = "Música de Fondo: ACTIVADA (Clic para Silenciar)";
            } else {
                toggleBtn.classList.remove('playing');
                toggleBtn.title = "Música de Fondo: SILENCIADA (Clic para Activar)";
            }
        }

        if (toggleIcon) {
            toggleIcon.innerText = state.musicEnabled ? "🎵" : "🔇";
        }

        if (settingsToggleBtn) {
            settingsToggleBtn.innerText = state.musicEnabled ? "Música: ACTIVA" : "Música: SILENCIADA";
            settingsToggleBtn.className = state.musicEnabled ? "btn btn-primary" : "btn btn-secondary";
        }

        if (volumeDisplay) {
            volumeDisplay.innerText = Math.round(state.musicVolume * 100) + '%';
        }

        if (volumeSlider) {
            volumeSlider.value = Math.round(state.musicVolume * 100);
        }

        if (trackSelect) {
            trackSelect.value = state.musicTrack;
        }
    },

    scheduleLoop() {
        if (!this.isPlaying || !SoundEngine.ctx) return;

        const secondsPerStep = (60 / this.tempo) / 4; // 16th note subdivision
        const lookAheadTime = SoundEngine.ctx.currentTime + 0.1;

        while (this.nextNoteTime < lookAheadTime) {
            this.playStep(this.currentStep, this.nextNoteTime, secondsPerStep);
            this.nextNoteTime += secondsPerStep;
            this.currentStep = (this.currentStep + 1) % 64; // 4 compases de 16 pasos = 64 pasos
        }
    },

    playStep(step, time, stepDuration) {
        if (!this.masterGain) return;
        const track = state.musicTrack || 'adventure';

        if (track === 'adventure') {
            this.playAdventurePattern(step, time, stepDuration);
        } else if (track === 'lofi') {
            this.playLofiPattern(step, time, stepDuration);
        } else {
            this.playArcadePattern(step, time, stepDuration);
        }
    },

    // 1. PISTA: Aventura Matemática (Upbeat, Flute-Lead & Arpeggios)
    playAdventurePattern(step, time, stepDuration) {
        // Melodía Lead Principal (Voz dulce y alegre de flauta/campana)
        const melodyMap = {
            0: 'C5', 3: 'E5', 6: 'G5', 8: 'A5', 12: 'G5', 14: 'E5',
            16: 'D5', 19: 'F5', 22: 'A5', 24: 'B5', 28: 'A5', 30: 'F5',
            32: 'E5', 35: 'G5', 38: 'C6', 40: 'D6', 44: 'C6', 46: 'G5',
            48: 'A5', 50: 'B5', 52: 'C6', 56: 'D6', 60: 'G5', 62: 'B5'
        };

        if (melodyMap[step]) {
            this.triggerSynthVoice(NOTE_FREQS[melodyMap[step]], 'triangle', time, stepDuration * 2.2, 0.18, true);
        }

        // Arpegio Mágico de Fondo (16avos)
        const chordProgressions = [
            ['C4', 'E4', 'G4', 'C5'], // Compás 1: C
            ['G3', 'B3', 'D4', 'G4'], // Compás 2: G
            ['A3', 'C4', 'E4', 'A4'], // Compás 3: Am
            ['F3', 'A3', 'C4', 'F4']  // Compás 4: F
        ];
        const bar = Math.floor(step / 16);
        const subStep = step % 16;
        const currentChord = chordProgressions[bar % 4];
        const noteName = currentChord[subStep % 4];
        
        if (subStep % 2 === 0 && Math.random() > 0.08) {
            this.triggerSynthVoice(NOTE_FREQS[noteName], 'sine', time, stepDuration * 0.9, 0.08, false);
        }

        // Línea de Bajo (Caminata rítmica suave)
        const bassMap = {
            0: 'C3', 8: 'G3', 16: 'G3', 24: 'D3', 32: 'A3', 40: 'E3', 48: 'F3', 56: 'G3'
        };
        if (bassMap[step]) {
            this.triggerSynthVoice(NOTE_FREQS[bassMap[step]], 'triangle', time, stepDuration * 3.5, 0.22, false);
        }

        // Percusión suave sintetizada (Clicks / Hats)
        if (step % 8 === 4) {
            this.triggerNoiseClick(time, 0.03, 0.04);
        } else if (step % 4 === 0) {
            this.triggerNoiseClick(time, 0.015, 0.02);
        }
    },

    // 2. PISTA: Concentración & Lo-Fi (Calmante, acordes suaves)
    playLofiPattern(step, time, stepDuration) {
        // Acordes sostenidos tipo Rhodes / Pad
        const lofiChords = [
            ['C4', 'E4', 'G4', 'B4'], // Cmaj7
            ['A3', 'C4', 'E4', 'G4'], // Am7
            ['D4', 'F4', 'A4', 'C5'], // Dm7
            ['G3', 'B3', 'D4', 'F4']  // G7
        ];
        const bar = Math.floor(step / 16);
        const subStep = step % 16;

        if (subStep === 0 || subStep === 8) {
            const chord = lofiChords[bar % 4];
            chord.forEach(n => {
                this.triggerSynthVoice(NOTE_FREQS[n], 'sine', time, stepDuration * 6.5, 0.06, false);
            });
        }

        // Melodía suave pensativa
        const lofiMelody = {
            4: 'E5', 10: 'D5', 14: 'C5',
            20: 'G5', 26: 'E5',
            36: 'F5', 42: 'A5', 46: 'G5',
            52: 'D5', 58: 'C5'
        };
        if (lofiMelody[step]) {
            this.triggerSynthVoice(NOTE_FREQS[lofiMelody[step]], 'sine', time, stepDuration * 3.0, 0.12, true);
        }

        // Bajo profundo y cálido
        if (subStep === 0) {
            const bassRoots = ['C3', 'A3', 'D3', 'G3'];
            this.triggerSynthVoice(NOTE_FREQS[bassRoots[bar % 4]], 'sine', time, stepDuration * 7.0, 0.25, false);
        }
    },

    // 3. PISTA: Chiptune Arcade (Retro 8-bit con arpegios rápidos)
    playArcadePattern(step, time, stepDuration) {
        const arcadeLead = {
            0: 'C5', 4: 'G5', 8: 'C6', 12: 'G5',
            16: 'B4', 20: 'D5', 24: 'G5', 28: 'D5',
            32: 'A4', 36: 'C5', 40: 'E5', 44: 'A5',
            48: 'F4', 52: 'A4', 56: 'C5', 60: 'E5'
        };

        if (arcadeLead[step]) {
            this.triggerSynthVoice(NOTE_FREQS[arcadeLead[step]], 'square', time, stepDuration * 1.8, 0.10, true);
        }

        // Arpegio rápido 8-bit
        const baseFreqs = [NOTE_FREQS.C4, NOTE_FREQS.E4, NOTE_FREQS.G4, NOTE_FREQS.B4];
        const arpeggioNote = baseFreqs[step % 4];
        this.triggerSynthVoice(arpeggioNote, 'square', time, stepDuration * 0.5, 0.05, false);

        // Bajo saltarín
        if (step % 4 === 0) {
            const roots = ['C3', 'G3', 'A3', 'F3'];
            const bar = Math.floor(step / 16);
            this.triggerSynthVoice(NOTE_FREQS[roots[bar % 4]], 'triangle', time, stepDuration * 1.5, 0.22, false);
        }
    },

    // Generador de Voz de Sintetizador con Envolvente ADSR
    triggerSynthVoice(freq, type, startTime, duration, peakVol, withVibrato) {
        if (!SoundEngine.ctx || !this.masterGain || !freq) return;

        try {
            const osc = SoundEngine.ctx.createOscillator();
            const gain = SoundEngine.ctx.createGain();
            const filter = SoundEngine.ctx.createBiquadFilter();

            osc.type = type || 'sine';
            osc.frequency.setValueAtTime(freq, startTime);

            // Vibrato sutil para melodías expresivas
            if (withVibrato) {
                const lfo = SoundEngine.ctx.createOscillator();
                const lfoGain = SoundEngine.ctx.createGain();
                lfo.frequency.value = 5.5; // 5.5 Hz vibrato
                lfoGain.gain.value = freq * 0.015;
                lfo.connect(osc.frequency);
                lfo.start(startTime + 0.05);
                lfo.stop(startTime + duration);
            }

            // Filtro cálido para evitar frecuencias chirriantes
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(type === 'square' ? 1800 : 3200, startTime);

            // Envolvente de volumen (Attack suave, Decay y Release exponencial)
            gain.gain.setValueAtTime(0.0001, startTime);
            gain.gain.linearRampToValueAtTime(peakVol, startTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGain);

            osc.start(startTime);
            osc.stop(startTime + duration);
        } catch (e) {}
    },

    // Generador de Percusión de Ruido Blanco
    triggerNoiseClick(startTime, duration, volume) {
        if (!SoundEngine.ctx || !this.masterGain) return;

        try {
            const bufferSize = SoundEngine.ctx.sampleRate * duration;
            const buffer = SoundEngine.ctx.createBuffer(1, bufferSize, SoundEngine.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }

            const noise = SoundEngine.ctx.createBufferSource();
            noise.buffer = buffer;

            const filter = SoundEngine.ctx.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.setValueAtTime(4000, startTime);

            const gain = SoundEngine.ctx.createGain();
            gain.gain.setValueAtTime(volume, startTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGain);

            noise.start(startTime);
            noise.stop(startTime + duration);
        } catch (e) {}
    }
};

// --------------------------------------------------------------------------
// 3. Renderizador de KaTeX (LaTeX) para Fórmulas Matemáticas
// --------------------------------------------------------------------------
function renderLaTeX(formula, element) {
    if (!element) return;
    if (window.katex) {
        try {
            katex.render(formula, element, {
                throwOnError: false,
                displayMode: false
            });
        } catch (e) {
            element.innerText = formula;
        }
    } else {
        element.innerText = formula;
    }
}

// --------------------------------------------------------------------------
// 4. Generador Matemático (Especializado Niños 8 a 12 Años)
// --------------------------------------------------------------------------
const mathGen = {
    generateSnakeChallenge(level) {
        let x, a, b, formula, ans;
        switch (level) {
            case 1:
                x = Math.floor(Math.random() * 8) + 2;
                a = Math.floor(Math.random() * 7) + 1;
                b = x + a;
                formula = `x + ${a} = ${b}`;
                ans = x;
                break;
            case 2:
                x = Math.floor(Math.random() * 9) + 3;
                a = Math.floor(Math.random() * 8) + 1;
                b = x - a;
                formula = `x - ${a} = ${b}`;
                ans = x;
                break;
            case 3:
                a = Math.floor(Math.random() * 4) + 2;
                x = Math.floor(Math.random() * 8) + 2;
                b = a * x;
                formula = `${a}x = ${b}`;
                ans = x;
                break;
            case 4:
                a = Math.floor(Math.random() * 3) + 2;
                x = Math.floor(Math.random() * 6) + 2;
                b = Math.floor(Math.random() * 6) + 1;
                let c = a * x + b;
                formula = `${a}x + ${b} = ${c}`;
                ans = x;
                break;
            case 5:
                a = 2;
                x = Math.floor(Math.random() * 6) + 3;
                b = Math.floor(Math.random() * 2) + 1;
                let cVal = a * (x - b);
                formula = `${a}(x - ${b}) = ${cVal}`;
                ans = x;
                break;
            default:
                formula = "x + 2 = 5";
                ans = 3;
        }
        return { formula, ans };
    },

    generateSliderChallenge(level) {
        let targetNum, targetDen, targetText, targetVal;
        
        switch (level) {
            case 1:
                targetNum = 1; targetDen = 2;
                targetText = "\\frac{1}{2}";
                break;
            case 2:
                targetNum = 1; targetDen = 3;
                targetText = "\\frac{1}{3}";
                break;
            case 3:
                targetNum = 2; targetDen = 3;
                targetText = "\\frac{2}{3}";
                break;
            case 4:
                targetNum = 3; targetDen = 4;
                targetText = "\\frac{3}{4}";
                break;
            case 5:
                targetVal = 0.5;
                return {
                    targetText: "0.50",
                    isDecimal: true,
                    targetVal: 0.5,
                    equivalents: ["1/2", "2/4", "3/6", "5/10"],
                    distractors: ["1/3", "2/5", "3/4", "1/4"]
                };
            default:
                targetNum = 1; targetDen = 2;
                targetText = "\\frac{1}{2}";
        }

        targetVal = targetNum / targetDen;
        
        const equivalents = [2, 3, 4, 5].map(m => `${targetNum * m}/${targetDen * m}`);
        
        const distractors = [
            `${targetNum + 1}/${targetDen}`,
            `${targetNum}/${targetDen + 1}`,
            `${targetNum + 2}/${targetDen + 2}`,
            `2/5`, `3/5`, `1/4`
        ].filter(f => {
            const parts = f.split('/');
            return (parseInt(parts[0]) / parseInt(parts[1])) !== targetVal;
        });

        return {
            targetText,
            isDecimal: false,
            targetVal,
            equivalents,
            distractors
        };
    },

    generateSudokuClues(level) {
        let clues = [];
        let values = {};
        
        const possibleValues = [2, 3, 4, 5, 6, 7, 8, 9];
        possibleValues.sort(() => Math.random() - 0.5);

        const a = possibleValues[0];
        const b = possibleValues[1];
        const c = possibleValues[2];
        const d = possibleValues[3];
        const e = possibleValues[4];

        values['a'] = a;
        values['b'] = b;
        values['c'] = c;
        values['d'] = d;
        values['e'] = e;

        if (level === 1) {
            clues.push({ text: `a + 4 = ${a + 4}`, var: 'a', ans: a });
        } else if (level === 2) {
            clues.push({ text: `a - 1 = ${a - 1}`, var: 'a', ans: a });
            clues.push({ text: `b + a = ${b + a}`, var: 'b', ans: b });
        } else if (level === 3) {
            clues.push({ text: `a \\times 2 = ${a * 2}`, var: 'a', ans: a });
            clues.push({ text: `b + a = ${b + a}`, var: 'b', ans: b });
            clues.push({ text: `c - b = ${c - b}`, var: 'c', ans: c });
        } else if (level === 4) {
            clues.push({ text: `a + 2 = ${a + 2}`, var: 'a', ans: a });
            clues.push({ text: `b - a = ${b - a}`, var: 'b', ans: b });
            clues.push({ text: `c + b = ${c + b}`, var: 'c', ans: c });
            clues.push({ text: `d \\times a = ${d * a}`, var: 'd', ans: d });
        } else {
            clues.push({ text: `a \\times 3 = ${a * 3}`, var: 'a', ans: a });
            clues.push({ text: `b + a = ${b + a}`, var: 'b', ans: b });
            clues.push({ text: `c - b = ${c - b}`, var: 'c', ans: c });
            clues.push({ text: `d + c = ${d + c}`, var: 'd', ans: d });
            clues.push({ text: `e - a = ${e - a}`, var: 'e', ans: e });
        }

        return { clues, values };
    }
};

// --------------------------------------------------------------------------
// 5. Sistema Monetario Escalonado Progresivo (Invertido a petición)
//    Pocas monedas al inicio (niveles fáciles) y muchas al final (niveles difíciles)
// --------------------------------------------------------------------------
function awardCoins(isLevelCompletion, level) {
    let earned = 0;
    if (level <= 2) {
        // Niveles 1 y 2 (Pocas monedas de inicio)
        earned = isLevelCompletion ? 20 : 5;
    } else if (level === 3) {
        // Nivel 3 (Medio progresivo)
        earned = isLevelCompletion ? 50 : 15;
    } else {
        // Niveles 4 y 5 (Recompensas masivas avanzadas)
        earned = isLevelCompletion ? 120 : 40;
    }

    state.coins += earned;
    state.stars += isLevelCompletion ? 3 : 1;
    
    if (isLevelCompletion) {
        activateStreakDay();

        // Desbloqueo progresivo del siguiente juego al superar el Nivel 5 de un predecesor
        const successors = {
            'slider-5': 'rush-1',
            'arkanoid-5': 'builder-1',
            'tres-5': 'escape-1',
            'escape-5': 'duel-1'
        };
        const currentKey = `${state.activeGameScreen}-${level}`;
        if (successors[currentKey] && !state.unlockedLevels.includes(successors[currentKey])) {
            state.unlockedLevels.push(successors[currentKey]);
            setTimeout(() => {
                window.showToast(`🎉 ¡Nuevo juego desbloqueado en el camino!`);
                renderDuolingoPath();
            }, 500);
        }
    }

    if (state.stars % 5 === 0) {
        state.userLevel++;
    }

    updateHeaderStats();
    saveStateToStorage();
    
    return earned;
}

// --------------------------------------------------------------------------
// 6. Catálogo e Interfaz de la Tienda
// --------------------------------------------------------------------------
const SHOP_CATALOG = {
    skins: [
        { key: 'standard', name: 'Esmeralda Estándar', desc: 'La serpiente clásica verde neón de MathQuest.', price: 0, rarity: 'common', icon: '🟢', type: 'skin' },
        { key: 'fire', name: 'Lava de Fuego 🔥', desc: 'Destella en tonos rojizos y naranja neón brillante.', price: 180, rarity: 'epic', icon: '🔥', type: 'skin' },
        { key: 'ice', name: 'Hielo Glacial ❄️', desc: 'Destella en colores azul helado y cian neón.', price: 120, rarity: 'common', icon: '❄️', type: 'skin' },
        { key: 'rainbow', name: 'Arcoíris Mágico 🌈', desc: 'Cicla dinámicamente por todos los colores.', price: 250, rarity: 'legendary', icon: '🌈', type: 'skin' }
    ],
    powerups: [
        { key: 'hint', name: 'Pista Global 💡', desc: 'Añade una pista a tu mochila para usar en juego.', price: 40, icon: '💡', type: 'inventory' },
        { key: 'shield', name: 'Súper Escudo 🛡️', desc: 'Te protege de 1 choque en Snake o Slither.', price: 60, icon: '🛡️', type: 'inventory' },
        { key: 'freeze', name: 'Congelador ❄️', desc: 'Ralentiza velocidad por 10s en Tetris o Snake.', price: 50, icon: '⏱️', type: 'inventory' }
    ]
};

function renderShop() {
    const skinsContainer = document.getElementById('shop-container-skins');
    const powerupsContainer = document.getElementById('shop-container-powerups');
    
    if (!skinsContainer || !powerupsContainer) return;

    skinsContainer.innerHTML = '';
    powerupsContainer.innerHTML = '';

    // Render Skins
    SHOP_CATALOG.skins.forEach(item => {
        const isUnlocked = state.unlockedSkins.includes(item.key);
        const isEquipped = state.equippedSkin === item.key;
        
        let buttonHTML = '';
        if (isEquipped) {
            buttonHTML = `<button class="btn btn-equipped w-100" disabled>Equipado</button>`;
        } else if (isUnlocked) {
            buttonHTML = `<button class="btn btn-secondary w-100" onclick="equipSkin('${item.key}')">Equipar</button>`;
        } else {
            buttonHTML = `<button class="btn btn-primary w-100" onclick="buyShopItem('skins', '${item.key}')">Comprar</button>`;
        }

        const card = document.createElement('div');
        card.className = `shop-item-card ${isEquipped ? 'equipped' : ''}`;
        card.innerHTML = `
            <span class="rarity-badge ${item.rarity}">${item.rarity}</span>
            <div class="shop-item-header">
                <span class="shop-item-icon">${item.icon}</span>
                <div class="shop-item-info">
                    <h4>${item.name}</h4>
                    <p>${item.desc}</p>
                </div>
            </div>
            <div class="shop-item-footer">
                <span class="shop-item-price">🪙 ${item.price}</span>
                <div style="width: 120px;">${buttonHTML}</div>
            </div>
        `;
        skinsContainer.appendChild(card);
    });

    // Render Powerups
    SHOP_CATALOG.powerups.forEach(item => {
        const currentCount = item.key === 'hint' ? state.globalHints : (state.inventory[item.key] || 0);
        
        const card = document.createElement('div');
        card.className = 'shop-item-card';
        card.innerHTML = `
            <div class="shop-item-header">
                <span class="shop-item-icon">${item.icon}</span>
                <div class="shop-item-info">
                    <h4>${item.name}</h4>
                    <p>${item.desc}</p>
                    <span style="font-size:0.75rem; font-weight:bold; color:var(--color-accent-blue);">Llevas: ${currentCount}</span>
                </div>
            </div>
            <div class="shop-item-footer">
                <span class="shop-item-price">🪙 ${item.price}</span>
                <div style="width: 120px;">
                    <button class="btn btn-primary w-100" onclick="buyShopItem('powerups', '${item.key}')">Comprar</button>
                </div>
            </div>
        `;
        powerupsContainer.appendChild(card);
    });
}

window.buyShopItem = function(category, key) {
    SoundEngine.playClick();
    const item = SHOP_CATALOG[category].find(i => i.key === key);
    if (!item) return;

    if (state.coins < item.price) {
        SoundEngine.playWrong();
        alert("¡No tienes suficientes MathCoins! Completa más niveles para conseguir monedas.");
        return;
    }

    state.coins -= item.price;

    if (item.type === 'skin') {
        state.unlockedSkins.push(key);
        state.equippedSkin = key;
    } else if (item.type === 'inventory') {
        if (key === 'hint') {
            state.globalHints++;
        } else {
            state.inventory[key] = (state.inventory[key] || 0) + 1;
        }
    }

    SoundEngine.playShield();
    saveStateToStorage();
    updateHeaderStats();
    renderShop();
};

window.equipSkin = function(key) {
    SoundEngine.playClick();
    if (state.unlockedSkins.includes(key)) {
        state.equippedSkin = key;
        saveStateToStorage();
        updateHeaderStats();
        renderShop();
    }
};

// --------------------------------------------------------------------------
// 7. Salón de Logros y Medallas por Mérito
// --------------------------------------------------------------------------
const MEDALS_CATALOG = [
    { key: 'algebra_medal', name: 'Medalla de Álgebra 🪐', desc: 'Otorgada al superar el Nivel 5 de Snake y Slither.', condition: () => state.unlockedLevels.includes('snake-5') && state.unlockedLevels.includes('slider-5') },
    { key: 'geometry_medal', name: 'Medalla Geométrica 📐', desc: 'Otorgada al superar el Nivel 5 de Math-Tetris.', condition: () => state.unlockedLevels.includes('tetris-5') },
    { key: 'arkanoid_medal', name: 'Medalla Rompeladrillos 🚀', desc: 'Otorgada al superar el Nivel 5 de Math-Arkanoid.', condition: () => state.unlockedLevels.includes('arkanoid-5') },
    { key: 'logic_medal', name: 'Medalla de la Lógica 🧠', desc: 'Otorgada al superar el Nivel 5 de Sudoku, Ahorcado y Tres en Raya.', condition: () => state.unlockedLevels.includes('sudoku-5') && state.unlockedLevels.includes('ahorcado-5') && state.unlockedLevels.includes('tres-5') },
    { key: 'champion_medal', name: 'Campeón MathQuest 🏅', desc: 'Completa absolutamente todos los 35 niveles de la plataforma.', condition: () => state.unlockedLevels.length >= 35 }
];

function checkAndUnlockAchievements() {
    let stateChanged = false;
    MEDALS_CATALOG.forEach(medal => {
        if (medal.condition()) {
            if (!state.equippedBadge && medal.key === 'champion_medal') {
                state.equippedBadge = '🏅';
                stateChanged = true;
            } else if (!state.equippedBadge && medal.key === 'algebra_medal') {
                state.equippedBadge = '🪐';
                stateChanged = true;
            }
        }
    });

    if (stateChanged) {
        saveStateToStorage();
        updateHeaderStats();
    }
}

function renderAchievements() {
    const container = document.getElementById('achievements-container');
    if (!container) return;

    container.innerHTML = '';

    MEDALS_CATALOG.forEach(medal => {
        const isUnlocked = medal.condition();
        const card = document.createElement('div');
        card.className = `achievement-card ${isUnlocked ? 'unlocked' : 'locked'}`;
        
        let emoji = '🔒';
        if (isUnlocked) {
            if (medal.key === 'algebra_medal') emoji = '🪐';
            else if (medal.key === 'geometry_medal') emoji = '📐';
            else if (medal.key === 'arkanoid_medal') emoji = '🚀';
            else if (medal.key === 'logic_medal') emoji = '🧠';
            else emoji = '🏅';
        }

        let actionButtonHTML = '';
        if (isUnlocked) {
            const isEquipped = state.equippedBadge === emoji;
            actionButtonHTML = isEquipped 
                ? `<button class="btn btn-equipped w-100" disabled>Equipada</button>`
                : `<button class="btn btn-secondary w-100" onclick="equipBadge('${emoji}')">Lucir Medalla</button>`;
        } else {
            actionButtonHTML = `<button class="btn btn-secondary w-100" disabled>Bloqueado</button>`;
        }

        card.innerHTML = `
            <div class="achievement-icon">${emoji}</div>
            <h4>${medal.name}</h4>
            <p>${medal.desc}</p>
            <div style="width: 100%;">${actionButtonHTML}</div>
        `;
        container.appendChild(card);
    });
}

window.equipBadge = function(badgeEmoji) {
    SoundEngine.playClick();
    state.equippedBadge = badgeEmoji;
    saveStateToStorage();
    updateHeaderStats();
    renderAchievements();
};

// --------------------------------------------------------------------------
// 8. Ajustes de Sistema (Reset Progress & Theme Switch)
// --------------------------------------------------------------------------
function setupSettingsListeners() {
    const btnToggleSound = document.getElementById('btn-toggle-sound');
    const btnToggleMusic = document.getElementById('btn-toggle-music');
    const musicVolumeSlider = document.getElementById('music-volume-slider');
    const musicTrackSelect = document.getElementById('music-track-select');
    const btnMusicToggleHeader = document.getElementById('btn-music-toggle');
    const btnResetProgress = document.getElementById('btn-reset-progress');
    const btnThemeToggle = document.getElementById('btn-theme-toggle');

    if (btnThemeToggle) {
        btnThemeToggle.addEventListener('click', () => {
            SoundEngine.playClick();
            const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem(STORAGE_PREFIX + 'theme', newTheme);
        });
    }

    if (btnToggleSound) {
        btnToggleSound.addEventListener('click', () => {
            SoundEngine.playClick();
            state.soundEnabled = !state.soundEnabled;
            btnToggleSound.innerText = state.soundEnabled ? "Sonido: ACTIVO" : "Sonido: MUTED";
            saveStateToStorage();
        });
    }

    if (btnToggleMusic) {
        btnToggleMusic.addEventListener('click', () => {
            SoundEngine.playClick();
            MusicEngine.toggle();
        });
    }

    if (btnMusicToggleHeader) {
        btnMusicToggleHeader.addEventListener('click', () => {
            SoundEngine.playClick();
            MusicEngine.toggle();
        });
    }

    if (musicVolumeSlider) {
        musicVolumeSlider.addEventListener('input', (e) => {
            const volPercent = parseInt(e.target.value);
            MusicEngine.setVolume(volPercent / 100);
            MusicEngine.updateUiState();
        });
    }

    if (musicTrackSelect) {
        musicTrackSelect.addEventListener('change', (e) => {
            SoundEngine.playClick();
            MusicEngine.setTrack(e.target.value);
        });
    }

    if (btnResetProgress) {
        btnResetProgress.addEventListener('click', () => {
            SoundEngine.playWrong();
            if (confirm("¿Estás seguro de que quieres restablecer todo tu progreso en MathQuest V3? Esto borrará tus monedas, estrellas, compras VIP y niveles.")) {
                localStorage.clear();
                state.streak = 1;
                state.stars = 0;
                state.coins = 150;
                state.globalHints = 2;
                state.userLevel = 1;
                state.equippedSkin = 'standard';
                state.equippedBadge = '';
                state.unlockedSkins = ['standard'];
                state.unlockedLevels = ['snake-1', 'slider-1', 'tetris-1', 'arkanoid-1', 'sudoku-1', 'ahorcado-1', 'tres-1'];
                state.vipBypassPurchased = false;
                state.inventory = { shield: 0, freeze: 0 };
                
                saveStateToStorage();
                location.reload();
            }
        });
    }
}

// --------------------------------------------------------------------------
// 9. Monetización del Bypass VIP (Simulación e Interfaz de Checkout)
// --------------------------------------------------------------------------
function setupVipBypassBilling() {
    const btnVipHeader = document.getElementById('btn-header-bypass-vip');
    const billingModal = document.getElementById('premium-buy-modal');
    const btnCloseBilling = document.getElementById('btn-close-payment-modal');
    
    const tabCard = document.getElementById('payment-tab-card');
    const tabCoins = document.getElementById('payment-tab-coins');
    const viewCard = document.getElementById('payment-form-card-view');
    const viewCoins = document.getElementById('payment-form-coins-view');
    
    const ccForm = document.getElementById('checkout-card-form');
    const btnPayCoins = document.getElementById('btn-submit-payment-coins');
    const coinsStatus = document.getElementById('coins-checkout-status');
    
    // Inputs de Tarjeta
    const ccNumInput = document.getElementById('cc-number');
    const ccExpInput = document.getElementById('cc-expiry');
    const ccCvcInput = document.getElementById('cc-cvc');

    if (!btnVipHeader || !billingModal) return;

    // Abrir Modal
    btnVipHeader.addEventListener('click', () => {
        SoundEngine.playClick();
        if (state.vipBypassPurchased) {
            alert("✨ ¡Ya eres un usuario VIP Premium! Todos los 25 niveles ya están completamente desbloqueados.");
            return;
        }
        
        // Actualizar estado de MathCoins para el canje
        coinsStatus.innerText = `Tienes: 🪙 ${state.coins} MathCoins / Necesitas: 🪙 10000`;
        coinsStatus.style.color = state.coins >= 10000 ? 'var(--color-accent-green)' : 'var(--color-accent-coral)';

        billingModal.classList.remove('hidden');
    });

    // Cerrar Modal
    btnCloseBilling.addEventListener('click', () => {
        SoundEngine.playClick();
        billingModal.classList.add('hidden');
    });

    // Cambiar de Pestaña (Tarjeta vs Monedas)
    tabCard.addEventListener('click', () => {
        SoundEngine.playClick();
        tabCard.classList.add('active');
        tabCoins.classList.remove('active');
        viewCard.classList.remove('hidden');
        viewCoins.classList.add('hidden');
    });

    tabCoins.addEventListener('click', () => {
        SoundEngine.playClick();
        tabCoins.classList.add('active');
        tabCard.classList.remove('active');
        viewCoins.classList.remove('hidden');
        viewCard.classList.add('hidden');
    });

    // Formateadores automáticos de entrada de tarjeta de crédito
    ccNumInput.addEventListener('input', (e) => {
        let val = e.target.value.replace(/\D/g, '');
        let formatted = val.match(/.{1,4}/g)?.join(' ') || val;
        e.target.value = formatted;
    });

    ccExpInput.addEventListener('input', (e) => {
        let val = e.target.value.replace(/\D/g, '');
        if (val.length > 2) {
            e.target.value = val.substring(0, 2) + '/' + val.substring(2, 4);
        } else {
            e.target.value = val;
        }
    });

    ccCvcInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D/g, '');
    });

    // Pago Ficticio con Tarjeta de Crédito (Bypass)
    ccForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const btnSubmit = document.getElementById('btn-submit-payment-card');
        btnSubmit.disabled = true;
        btnSubmit.innerText = "Procesando pago seguro... 🔒";
        
        SoundEngine.playTone(400, 'sine', 0.2, 0.1);

        setTimeout(() => {
            btnSubmit.disabled = false;
            btnSubmit.innerText = "Comprar Pase VIP ($4.99)";
            
            activatePremiumVipPass();
            billingModal.classList.add('hidden');
            
            alert("💳 ¡Pago aprobado con éxito! Tu Pase VIP Premium está activo. Se han desbloqueado todos los 25 niveles.");
        }, 1500);
    });

    // Pago con Monedas
    btnPayCoins.addEventListener('click', () => {
        if (state.coins < 10000) {
            SoundEngine.playWrong();
            alert("🪙 ¡Monedas insuficientes! Necesitas al menos 10,000 MathCoins ganadas resolviendo desafíos.");
            return;
        }

        SoundEngine.playClick();
        state.coins -= 10000;
        
        activatePremiumVipPass();
        billingModal.classList.add('hidden');
        
        alert("🪙 ¡Canje completado! Se restaron 10,000 MathCoins y se activó tu Pase VIP Premium.");
    });
}

function activatePremiumVipPass() {
    state.vipBypassPurchased = true;
    
    // Desbloquear los 5 niveles de los 11 juegos (55 niveles en total)
    const games = ['snake', 'slider', 'rush', 'tetris', 'arkanoid', 'builder', 'sudoku', 'ahorcado', 'tres', 'escape', 'duel'];
    state.unlockedLevels = [];
    games.forEach(g => {
        for (let l = 1; l <= 5; l++) {
            state.unlockedLevels.push(`${g}-${l}`);
        }
    });

    SoundEngine.playFanfare();
    saveStateToStorage();
    updateHeaderStats();
    renderDuolingoPath();
}

// --------------------------------------------------------------------------
// 10. Enrutamiento del Hub, Menú y Navegación
// --------------------------------------------------------------------------
function updateHeaderStats() {
    document.getElementById('streak-count').innerText = state.streak;
    document.getElementById('star-count').innerText = state.stars;
    document.getElementById('coins-count').innerText = state.coins;
    document.getElementById('global-hints-count').innerText = state.globalHints;
    document.getElementById('user-level').innerText = state.userLevel;

    // Actualizar botón dorado del Bypass VIP
    const btnVipHeader = document.getElementById('btn-header-bypass-vip');
    if (btnVipHeader) {
        if (state.vipBypassPurchased) {
            btnVipHeader.innerHTML = "👑 VIP Activo";
            btnVipHeader.style.background = "linear-gradient(135deg, #10b981 0%, #059669 100%)";
            btnVipHeader.style.borderColor = "#047857";
            btnVipHeader.style.boxShadow = "0 0 10px rgba(16, 185, 129, 0.4)";
        } else {
            btnVipHeader.innerHTML = "🔓 Bypass VIP";
            btnVipHeader.style.background = "linear-gradient(135deg, #ffe066 0%, #f5b041 50%, #d35400 100%)";
            btnVipHeader.style.borderColor = "#f39c12";
            btnVipHeader.style.boxShadow = "0 0 12px rgba(243, 156, 18, 0.5)";
        }
    }

    // Actualizar Avatar y Medalla en la cabecera (Con imágenes 3D premium)
    const avatarHeader = document.getElementById('active-avatar-display');
    const badgeDisplay = document.getElementById('equipped-badge-display');
    
    if (avatarHeader) {
        const avatarImgFile = {
            'cubo': 'avatar_cube.png',
            'esfera': 'avatar_sphere.png',
            'piramide': 'avatar_pyramid.png',
            'cilindro': 'avatar_cylinder.png'
        }[state.equippedAvatar] || 'avatar_cube.png';
        
        avatarHeader.innerHTML = `<img src="${avatarImgFile}" alt="Avatar">`;
    }
    
    if (badgeDisplay) {
        badgeDisplay.innerText = state.equippedBadge || '';
        badgeDisplay.style.display = state.equippedBadge ? 'flex' : 'none';
    }

    // Actualizar también el panel de calendario de racha si existe
    if (typeof updateStreakCalendar === 'function') {
        updateStreakCalendar();
    }
}

function renderDuolingoPath() {
    const nodes = document.querySelectorAll('.path-node');
    nodes.forEach(node => {
        const game = node.getAttribute('data-game');
        const level = node.getAttribute('data-level');
        const nodeKey = `${game}-${level}`;

        const isUnlocked = state.unlockedLevels.includes(nodeKey);
        
        if (isUnlocked) {
            node.classList.remove('locked');
            node.setAttribute('title', `Nivel ${level} Desbloqueado`);
        } else {
            node.classList.add('locked');
            node.setAttribute('title', `Nivel ${level} Bloqueado`);
        }
    });
}

function setupHubTabNavigation() {
    const tabs = {
        'path': { btn: 'tab-btn-path', view: 'hub-path-view' },
        'shop': { btn: 'tab-btn-shop', view: 'hub-shop-view' },
        'achievements': { btn: 'tab-btn-achievements', view: 'hub-achievements-view' },
        'settings': { btn: 'tab-btn-settings', view: 'hub-settings-view' }
    };

    Object.keys(tabs).forEach(key => {
        const config = tabs[key];
        const btn = document.getElementById(config.btn);
        
        if (btn) {
            btn.addEventListener('click', () => {
                SoundEngine.playClick();
                Object.values(tabs).forEach(t => {
                    const b = document.getElementById(t.btn);
                    const v = document.getElementById(t.view);
                    if (b) b.classList.remove('active');
                    if (v) v.classList.add('hidden');
                });
                btn.classList.add('active');
                document.getElementById(config.view).classList.remove('hidden');

                if (key === 'shop') renderShop();
                if (key === 'achievements') renderAchievements();
            });
        }
    });

    const topicBtns = document.querySelectorAll('.topic-selector-btn');
    topicBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            SoundEngine.playClick();
            topicBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const topic = btn.getAttribute('data-topic');
            ['algebra', 'geometry', 'logic'].forEach(t => {
                const el = document.getElementById(`path-topic-${t}`);
                if (el) el.classList.add('hidden');
            });
            document.getElementById(`path-topic-${topic}`).classList.remove('hidden');
        });
    });

    // Cambiar Avatar ( Picker con selección visual )
    const avatarOptions = document.querySelectorAll('.avatar-option');
    avatarOptions.forEach(opt => {
        const type = opt.getAttribute('data-avatar');
        
        if (type === state.equippedAvatar) {
            opt.classList.add('selected');
        }

        opt.addEventListener('click', () => {
            SoundEngine.playClick();
            avatarOptions.forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            state.equippedAvatar = type;
            saveStateToStorage();
            updateHeaderStats();
        });
    });
}

// --------------------------------------------------------------------------
// 11. Lanzamiento de Videojuegos y Ruteo de Eventos
// --------------------------------------------------------------------------
function launchGame(game, level, isCustom = false) {
    SoundEngine.playClick();
    
    // Bajar volumen de la música de fondo durante los juegos
    MusicEngine.duck();
    
    document.getElementById('screen-hub').classList.add('hidden');
    document.getElementById('btn-back-menu').classList.remove('hidden');

    state.activeGameScreen = game;
    state.activeGameLevel = parseInt(level);

    ['snake', 'tetris', 'arkanoid', 'slider', 'sudoku', 'ahorcado', 'tres', 'rush', 'builder', 'escape', 'duel'].forEach(g => {
        const el = document.getElementById(`screen-${g}`);
        if (el) el.classList.add('hidden');
    });

    const activeEl = document.getElementById(`screen-${game}`);
    if (activeEl) activeEl.classList.remove('hidden');

    // Adaptador no invasivo para juegos modulares registrados en MathQuestGames (Fase 4)
    if (window.MathQuestGames && window.MathQuestGames[game] && typeof window.MathQuestGames[game].start === 'function') {
        window.MathQuestGames[game].start(state.activeGameLevel);
        return;
    }

    if (game === 'snake') {
        if (typeof window.startSnakeGame === 'function') {
            window.startSnakeGame(state.activeGameLevel);
        }
    } else if (game === 'tetris') {
        if (typeof window.startTetrisGame === 'function') {
            window.startTetrisGame(state.activeGameLevel);
        }
    } else if (game === 'arkanoid') {
        if (typeof window.startArkanoidGame === 'function') {
            window.startArkanoidGame(state.activeGameLevel);
        }
    } else if (game === 'slider') {
        if (typeof window.startSliderGame === 'function') {
            window.startSliderGame(state.activeGameLevel);
        }
    } else if (game === 'sudoku') {
        if (typeof window.startSudokuGame === 'function') {
            window.startSudokuGame(state.activeGameLevel);
        }
    } else if (game === 'ahorcado') {
        if (typeof window.startAhorcadoGame === 'function') {
            window.startAhorcadoGame(state.activeGameLevel);
        }
    } else if (game === 'tres') {
        if (typeof window.startTresGame === 'function') {
            window.startTresGame(state.activeGameLevel);
        }
    }
}

document.getElementById('btn-back-menu').addEventListener('click', () => {
    SoundEngine.playClick();
    
    // Restaurar volumen normal de música de fondo al volver al inicio
    MusicEngine.unduck();
    
    if (typeof window.stopAllGames === 'function') {
        window.stopAllGames();
    }
    if (typeof window.stopTresGame === 'function') {
        window.stopTresGame();
    }
    if (typeof window.stopArkanoidGame === 'function') {
        window.stopArkanoidGame();
    }
    if (window.MathQuestGames) {
        Object.values(window.MathQuestGames).forEach(g => {
            if (typeof g.stop === 'function') g.stop();
        });
    }

    state.activeGameScreen = null;
    document.getElementById('btn-back-menu').classList.add('hidden');
    
    ['snake', 'tetris', 'arkanoid', 'slider', 'sudoku', 'ahorcado', 'tres', 'rush', 'builder', 'escape', 'duel'].forEach(g => {
        const el = document.getElementById(`screen-${g}`);
        if (el) el.classList.add('hidden');
    });

    document.getElementById('screen-hub').classList.remove('hidden');
    
    checkAndUnlockAchievements();
    renderDuolingoPath();
    updateHeaderStats();
});

// Delegación global para asegurar la captura de clics en niveles del camino Duolingo
document.addEventListener('click', (e) => {
    const node = e.target.closest('.path-node');
    if (node) {
        e.preventDefault();
        if (node.classList.contains('locked')) {
            SoundEngine.playWrong();
            window.showToast("🔒 Este nivel está bloqueado. ¡Completa los niveles anteriores o adquiere el Pase VIP!");
            return;
        }

        const game = node.getAttribute('data-game');
        const level = node.getAttribute('data-level');
        if (game && level) {
            launchGame(game, level);
        }
        return;
    }

    const hintsBag = e.target.closest('#btn-global-hints-bag');
    if (hintsBag) {
        SoundEngine.playClick();
        window.showToast(`💡 Mochila de Pistas: Tienes ${state.globalHints} disponibles.`);
        return;
    }
});

// --------------------------------------------------------------------------
// 12. Ruteo de Teclado Centralizado (Soluciona Scroll del Navegador y Colisión)
// --------------------------------------------------------------------------
window.addEventListener('keydown', (e) => {
    if (!state.activeGameScreen) return;

    const scrollPreventKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Spacebar'];
    if (scrollPreventKeys.includes(e.key)) {
        e.preventDefault();
    }

    const keyLower = e.key.toLowerCase();

    if (state.activeGameScreen === 'snake') {
        let direction = null;
        if (keyLower === 'w' || e.key === 'ArrowUp') direction = 'up';
        if (keyLower === 's' || e.key === 'ArrowDown') direction = 'down';
        if (keyLower === 'a' || e.key === 'ArrowLeft') direction = 'left';
        if (keyLower === 'd' || e.key === 'ArrowRight') direction = 'right';
        
        if (direction && typeof window.handleSnakeDirection === 'function') {
            window.handleSnakeDirection(direction);
        }
    } else if (state.activeGameScreen === 'tetris') {
        let action = null;
        if (keyLower === 'a' || e.key === 'ArrowLeft') action = 'left';
        if (keyLower === 'd' || e.key === 'ArrowRight') action = 'right';
        if (keyLower === 's' || e.key === 'ArrowDown') action = 'down';
        if (keyLower === 'w' || e.key === 'ArrowUp') action = 'rotate';
        
        if (action && typeof window.handleTetrisAction === 'function') {
            window.handleTetrisAction(action);
        }
    } else if (state.activeGameScreen === 'arkanoid') {
        if (keyLower === 'a' || e.key === 'ArrowLeft') {
            if (typeof window.handleArkanoidKeyboard === 'function') window.handleArkanoidKeyboard('left');
        } else if (keyLower === 'd' || e.key === 'ArrowRight') {
            if (typeof window.handleArkanoidKeyboard === 'function') window.handleArkanoidKeyboard('right');
        } else if (e.key === ' ' || e.key === 'Spacebar' || keyLower === 'w' || e.key === 'ArrowUp') {
            if (typeof window.handleArkanoidKeyboard === 'function') window.handleArkanoidKeyboard('launch');
        }
    } else if (state.activeGameScreen === 'slider') {
        let direction = null;
        if (keyLower === 'w' || e.key === 'ArrowUp') direction = 'up';
        if (keyLower === 's' || e.key === 'ArrowDown') direction = 'down';
        if (keyLower === 'a' || e.key === 'ArrowLeft') direction = 'left';
        if (keyLower === 'd' || e.key === 'ArrowRight') direction = 'right';

        if (direction && typeof window.handleSliderKeyboardDirection === 'function') {
            window.handleSliderKeyboardDirection(direction);
        }

        if (e.key === ' ' || e.key === 'Spacebar') {
            if (typeof window.setSliderBoost === 'function') {
                window.setSliderBoost(true);
            }
        }
    }
});

window.addEventListener('keyup', (e) => {
    if (state.activeGameScreen === 'slider') {
        if (e.key === ' ' || e.key === 'Spacebar') {
            if (typeof window.setSliderBoost === 'function') {
                window.setSliderBoost(false);
            }
        }
    }
});

// --------------------------------------------------------------------------
// 13. Sistema de Modal / Diálogos Rápidos de Mateo
// --------------------------------------------------------------------------
const MathModal = {
    el: document.getElementById('math-modal'),
    title: document.getElementById('modal-title'),
    prompt: document.getElementById('modal-equation-prompt'),
    formulaEl: document.getElementById('modal-equation'),
    optionsBox: document.getElementById('modal-options'),
    feedbackEl: document.getElementById('modal-feedback'),
    callback: null,

    show(config) {
        this.title.innerText = config.title || "¡Desafío de Mateo!";
        this.prompt.innerText = config.prompt || "Resuelve:";
        renderLaTeX(config.formula, this.formulaEl);
        
        this.optionsBox.innerHTML = '';
        this.feedbackEl.classList.add('hidden');
        this.callback = config.callback;

        config.options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'btn-option';
            btn.innerText = opt;
            btn.addEventListener('click', () => this.selectOption(opt, config.correctAnswer));
            this.optionsBox.appendChild(btn);
        });

        this.el.classList.remove('hidden');
    },

    selectOption(val, correctVal) {
        const isCorrect = val === correctVal;
        
        this.feedbackEl.classList.remove('hidden');
        this.feedbackEl.className = `modal-feedback ${isCorrect ? 'correct' : 'wrong'}`;
        this.feedbackEl.innerText = isCorrect 
            ? "¡Excelente! Respuesta correcta. 🎉" 
            : "¡Ups! Sigue intentándolo, tú puedes. 💪";

        if (isCorrect) {
            SoundEngine.playCorrect();
            setTimeout(() => {
                this.el.classList.add('hidden');
                if (this.callback) this.callback(true);
            }, 1200);
        } else {
            SoundEngine.playWrong();
            const card = this.el.querySelector('.modal-card');
            card.classList.add('shake');
            setTimeout(() => card.classList.remove('shake'), 400);
            
            setTimeout(() => {
                this.el.classList.add('hidden');
                if (this.callback) this.callback(false);
            }, 1200);
        }
    }
};

// --------------------------------------------------------------------------
// 14. Pista Global (Mochila) - Evento de Botón
// --------------------------------------------------------------------------
const hintButtons = document.querySelectorAll('.btn-use-hint');
hintButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        SoundEngine.playClick();
        if (state.globalHints <= 0) {
            SoundEngine.playWrong();
            alert("No tienes pistas en tu mochila. ¡Compra más en la tienda!");
            return;
        }

        let hintUsed = false;
        if (window.MathQuestGames && window.MathQuestGames[state.activeGameScreen] && typeof window.MathQuestGames[state.activeGameScreen].useHint === 'function') {
            hintUsed = window.MathQuestGames[state.activeGameScreen].useHint();
        } else if (state.activeGameScreen === 'snake' && typeof window.useSnakeHint === 'function') {
            hintUsed = window.useSnakeHint();
        } else if (state.activeGameScreen === 'tetris' && typeof window.useTetrisHint === 'function') {
            hintUsed = window.useTetrisHint();
        } else if (state.activeGameScreen === 'arkanoid' && typeof window.useArkanoidHint === 'function') {
            hintUsed = window.useArkanoidHint();
        } else if (state.activeGameScreen === 'slider' && typeof window.useSliderHint === 'function') {
            hintUsed = window.useSliderHint();
        } else if (state.activeGameScreen === 'sudoku' && typeof window.useSudokuHint === 'function') {
            hintUsed = window.useSudokuHint();
        } else if (state.activeGameScreen === 'ahorcado' && typeof window.useAhorcadoHint === 'function') {
            hintUsed = window.useAhorcadoHint();
        } else if (state.activeGameScreen === 'tres' && typeof window.useTresHint === 'function') {
            hintUsed = window.useTresHint();
        }

        if (hintUsed) {
            state.globalHints--;
            updateHeaderStats();
            saveStateToStorage();
        }
    });
});

// --------------------------------------------------------------------------
// 15. Lógica de Rachas Diarias y Calendario Semanal
// --------------------------------------------------------------------------
function updateStreakCalendar() {
    const today = new Date();
    const currentDayOfWeek = today.getDay(); // 0 = Dom, 1 = Lun, ..., 6 = Sáb
    const todayStr = today.toISOString().split('T')[0];

    // Leer fechas de racha del almacenamiento
    let streakDates = [];
    try {
        streakDates = JSON.parse(localStorage.getItem(STORAGE_PREFIX + 'streak_dates')) || [];
    } catch(e){}

    const todayCompleted = streakDates.includes(todayStr);

    // Actualizar texto del mensaje del calendario
    const msgEl = document.getElementById('streak-calendar-message');
    if (msgEl) {
        msgEl.innerHTML = todayCompleted 
            ? "¡Racha asegurada por hoy! Llama encendida. Regresa mañana. 🔥" 
            : "¡Completa un reto hoy para mantener la llama encendida! ⚡";
    }

    const countEl = document.getElementById('streak-days-count');
    if (countEl) {
        countEl.innerText = state.streak;
    }

    // Renderizar las celdas del calendario de lunes a domingo
    const cells = document.querySelectorAll('.streak-day-cell');
    cells.forEach(cell => {
        const dayVal = parseInt(cell.getAttribute('data-day'));
        cell.classList.remove('active', 'pending-today');

        // Calcular si ese día de la semana corresponde a una fecha completada
        const isDayCompleted = isDayInCurrentWeek(dayVal, streakDates);

        if (isDayCompleted) {
            cell.classList.add('active');
        } else if (dayVal === currentDayOfWeek && !todayCompleted) {
            cell.classList.add('pending-today');
        }
    });
}

function isDayInCurrentWeek(targetDayOfWeek, streakDates) {
    const today = new Date();
    const currentDayOfWeek = today.getDay();
    
    // Calcular el lunes de esta semana
    const distanceToMonday = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + distanceToMonday);
    
    // Generar las 7 fechas de la semana actual (Lunes a Domingo)
    const weekDates = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        weekDates.push(d.toISOString().split('T')[0]);
    }

    let index = targetDayOfWeek === 0 ? 6 : targetDayOfWeek - 1;
    const dateToCheck = weekDates[index];

    return streakDates.includes(dateToCheck);
}

function checkStreakValidity() {
    const lastActive = localStorage.getItem(STORAGE_PREFIX + 'last_active_date');
    if (lastActive) {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        
        // Crear fechas de comparación a mediodía
        const lastDate = new Date(lastActive + 'T12:00:00');
        const currDate = new Date(todayStr + 'T12:00:00');
        const diffTime = currDate - lastDate;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 1) {
            // Pasó más de un día sin actividad! Racha rota
            state.streak = 1;
            saveStateToStorage();
        }
    }
}

function activateStreakDay() {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    let streakDates = [];
    try {
        streakDates = JSON.parse(localStorage.getItem(STORAGE_PREFIX + 'streak_dates')) || [];
    } catch(e){}

    if (!streakDates.includes(todayStr)) {
        const lastActive = localStorage.getItem(STORAGE_PREFIX + 'last_active_date');
        
        if (lastActive) {
            const lastDate = new Date(lastActive + 'T12:00:00');
            const currDate = new Date(todayStr + 'T12:00:00');
            const diffTime = currDate - lastDate;
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
                state.streak++;
            } else if (diffDays > 1) {
                state.streak = 1;
            }
        } else {
            state.streak = 1;
        }

        streakDates.push(todayStr);
        localStorage.setItem(STORAGE_PREFIX + 'streak_dates', JSON.stringify(streakDates));
        localStorage.setItem(STORAGE_PREFIX + 'last_active_date', todayStr);
        
        saveStateToStorage();
        updateHeaderStats();
        
        if (state.streak >= 2) {
            SoundEngine.playFanfare();
        }
    }
}

// --------------------------------------------------------------------------
// 16. Inicialización General de la Plataforma
// --------------------------------------------------------------------------
let hasInitializedMathQuest = false;
function initMathQuestApp() {
    if (hasInitializedMathQuest) return;
    hasInitializedMathQuest = true;

    loadStateFromStorage();
    checkStreakValidity();
    updateHeaderStats();
    updateStreakCalendar();
    renderDuolingoPath();
    setupHubTabNavigation();
    setupSettingsListeners();
    setupVipBypassBilling();
    
    // Configurar estado visual inicial de música
    MusicEngine.updateUiState();

    // Auto-iniciar música de fondo al primer gesto de interacción del usuario
    const startMusicOnFirstInteraction = () => {
        SoundEngine.init();
        if (state.musicEnabled && !state.activeGameScreen && !MusicEngine.isPlaying) {
            MusicEngine.start();
        }
        window.removeEventListener('click', startMusicOnFirstInteraction);
        window.removeEventListener('touchstart', startMusicOnFirstInteraction);
        window.removeEventListener('keydown', startMusicOnFirstInteraction);
    };

    window.addEventListener('click', startMusicOnFirstInteraction);
    window.addEventListener('touchstart', startMusicOnFirstInteraction);
    window.addEventListener('keydown', startMusicOnFirstInteraction);
    
    if (window.renderMathInElement) {
        try {
            renderMathInElement(document.body, {
                delimiters: [
                    { left: "$$", right: "$$", display: true },
                    { left: "\\(", right: "\\)", display: false }
                ],
                throwOnError: false,
                ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code", "input", "button"]
            });
        } catch (e) {
            console.warn("KaTeX renderMathInElement advertencia:", e);
        }
    }
}

// Helper unificado para completar niveles de juegos de forma no invasiva
function completeGameLevel(game, level) {
    const lvlNum = parseInt(level);
    const nextLevelKey = `${game}-${lvlNum + 1}`;
    if (lvlNum < 5 && !state.unlockedLevels.includes(nextLevelKey)) {
        state.unlockedLevels.push(nextLevelKey);
    }

    const earned = awardCoins(true, lvlNum);
    saveStateToStorage();
    updateHeaderStats();
    renderDuolingoPath();
    checkAndUnlockAchievements();
    return earned;
}

// Exportar funciones útiles a nivel global
window.state = state;
window.SoundEngine = SoundEngine;
window.MusicEngine = MusicEngine;
window.renderLaTeX = renderLaTeX;
window.mathGen = mathGen;
window.awardCoins = awardCoins;
window.completeGameLevel = completeGameLevel;
window.saveStateToStorage = saveStateToStorage;
window.updateHeaderStats = updateHeaderStats;
window.checkAndUnlockAchievements = checkAndUnlockAchievements;
window.renderShop = renderShop;
window.renderInventoryShopModal = renderShop;
window.activatePremiumVipPass = activatePremiumVipPass;
window.activateStreakDay = activateStreakDay;
window.updateStreakCalendar = updateStreakCalendar;
window.checkStreakValidity = checkStreakValidity;

window.MathQuestApp = {
    state,
    SoundEngine,
    MusicEngine,
    renderLaTeX,
    mathGen,
    awardCoins,
    completeGameLevel,
    activatePremiumVipPass,
    saveStateToStorage,
    updateHeaderStats,
    checkAndUnlockAchievements,
    renderShop,
    renderInventoryShopModal: renderShop,
    activateStreakDay,
    updateStreakCalendar
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMathQuestApp);
} else {
    initMathQuestApp();
}
