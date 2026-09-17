/* ==========================================================================
   MathQuest V3 - Módulo de Ranking Competitivo Global & Temporadas Semanales
   Integración con Firebase Firestore, Firebase Auth, Anti-Cheat Validado,
   Prevención de Doble Reclamo, Desempate Determinista y UI Consistente.
   ========================================================================== */

import { 
    db, 
    auth, 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc, 
    collection, 
    query, 
    orderBy, 
    limit, 
    getDocs, 
    where,
    runTransaction
} from './firebase.js';

// Prefijo de almacenamiento local existente en MathQuest V3
const STORAGE_PREFIX = 'mq3_';

// Conjunto de minijuegos válidos autorizados para otorgar puntos competitivos
const VALID_GAMES = new Set([
    'snake', 'tetris', 'arkanoid', 'slider', 'sudoku', 
    'ahorcado', 'tres', 'rush', 'builder', 'escape', 'duel', 'general'
]);

// Configuración Oficial de Recompensas de Temporada
export const RANKING_REWARDS = [
    {
        tier: 'top1',
        title: '🥇 TOP 1',
        minRank: 1,
        maxRank: 1,
        coins: 1000,
        badge: '🏆',
        badgeName: 'Campeón',
        titleReward: 'Campeón'
    },
    {
        tier: 'top2',
        title: '🥈 TOP 2',
        minRank: 2,
        maxRank: 2,
        coins: 750,
        badge: '🥈',
        badgeName: 'Subcampeón',
        titleReward: 'Subcampeón'
    },
    {
        tier: 'top3',
        title: '🥉 TOP 3',
        minRank: 3,
        maxRank: 3,
        coins: 500,
        badge: '🥉',
        badgeName: 'Élite',
        titleReward: 'Élite'
    },
    {
        tier: 'top10',
        title: '🏆 TOP 10',
        minRank: 4,
        maxRank: 10,
        coins: 250,
        badge: '⭐',
        badgeName: 'Top 10',
        titleReward: null
    },
    {
        tier: 'top25',
        title: '🎖️ TOP 25',
        minRank: 11,
        maxRank: 25,
        coins: 150,
        badge: '🎖️',
        badgeName: 'Top 25',
        titleReward: null
    },
    {
        tier: 'top50',
        title: '⭐ TOP 50',
        minRank: 26,
        maxRank: 50,
        coins: 100,
        badge: '🏅',
        badgeName: 'Top 50',
        titleReward: null
    },
    {
        tier: 'participant',
        title: '🎯 PARTICIPACIÓN (>= 100 pts)',
        minRank: 51,
        maxRank: 999999,
        minPoints: 100,
        coins: 50,
        badge: '🎯',
        badgeName: 'Participante',
        titleReward: null
    }
];

/**
 * Determina de forma determinista y estricta la recompensa correspondiente a un jugador
 * según su posición y puntos. Devuelve null si no califica o no tiene puntos.
 * @param {number} rank 
 * @param {number} points 
 * @returns {Object|null}
 */
export function getRewardForRankAndPoints(rank, points) {
    const pts = Number(points) || 0;
    const r = Number(rank);
    if (!r || r < 1 || pts <= 0) {
        return null;
    }

    if (r === 1) return RANKING_REWARDS.find(item => item.tier === 'top1') || null;
    if (r === 2) return RANKING_REWARDS.find(item => item.tier === 'top2') || null;
    if (r === 3) return RANKING_REWARDS.find(item => item.tier === 'top3') || null;
    if (r >= 4 && r <= 10) return RANKING_REWARDS.find(item => item.tier === 'top10') || null;
    if (r >= 11 && r <= 25) return RANKING_REWARDS.find(item => item.tier === 'top25') || null;
    if (r >= 26 && r <= 50) return RANKING_REWARDS.find(item => item.tier === 'top50') || null;
    if (r >= 51 && pts >= 100) return RANKING_REWARDS.find(item => item.tier === 'participant') || null;

    return null;
}

// Estado en memoria del sistema de Ranking
let currentRankingTab = 'weekly'; // 'weekly' | 'global'
let cachedWeeklyRanking = [];
let cachedGlobalRanking = [];
let lastPointAwardTimestamp = 0;
let seasonCountdownTimer = null;
let currentSeasonIdCache = null;

/**
 * Mapeo de avatares 3D a archivos de imagen existentes
 * @param {string} avatarKey 
 * @returns {string}
 */
export function getAvatarImageSrc(avatarKey) {
    const key = (avatarKey === 'cube' ? 'cubo' : avatarKey) || 'cubo';
    const map = {
        'cubo': 'avatar_cube.png',
        'esfera': 'avatar_sphere.png',
        'piramide': 'avatar_pyramid.png',
        'cilindro': 'avatar_cylinder.png'
    };
    return map[key] || 'avatar_cube.png';
}

/**
 * Obtiene la información pública del usuario (SIN datos privados como email)
 * @returns {{ uid: string, displayName: string, avatar: string, isAuthenticated: boolean }}
 */
function getPublicUserInfo() {
    const currentUser = window.MathQuestAuth?.getCurrentUser() || auth?.currentUser;
    const s = window.state || {};

    const uid = currentUser?.uid || localStorage.getItem(STORAGE_PREFIX + 'guest_uid') || ('guest_' + Math.random().toString(36).substring(2, 9));
    if (!localStorage.getItem(STORAGE_PREFIX + 'guest_uid')) {
        try { localStorage.setItem(STORAGE_PREFIX + 'guest_uid', uid); } catch(e) {}
    }

    let rawName = currentUser?.displayName || localStorage.getItem(STORAGE_PREFIX + 'guest_name') || 'Aventurero Matemático';
    rawName = String(rawName).replace(/<[^>]*>?/gm, '').trim();
    if (!rawName) rawName = 'Aventurero Matemático';

    let avatar = s.equippedAvatar || 'cubo';
    if (avatar === 'cube') avatar = 'cubo';

    return {
        uid,
        displayName: rawName,
        avatar,
        isAuthenticated: Boolean(currentUser && !currentUser.isAnonymous)
    };
}

/**
 * Calcula los detalles de la temporada semanal activa (Lunes 00:00:00 UTC a Domingo 23:59:59 UTC)
 * Formato ISO Week: ej. 2026-W38
 * @param {Date} [date]
 * @returns {{ seasonId: string, year: number, weekNumber: number, seasonNumber: number, name: string, startDate: number, endDate: number, isActive: boolean }}
 */
export function calculateSeasonDetails(date = new Date()) {
    const target = new Date(date.valueOf());
    const dayNr = (date.getUTCDay() + 6) % 7; // Lunes = 0, Domingo = 6
    target.setUTCDate(target.getUTCDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setUTCMonth(0, 1);
    if (target.getUTCDay() !== 4) {
        target.setUTCMonth(0, 1 + ((4 - target.getUTCDay()) + 7) % 7);
    }
    const weekNumber = 1 + Math.ceil((firstThursday - target) / 604800000);
    const year = target.getUTCFullYear();
    const seasonId = `${year}-W${String(weekNumber).padStart(2, '0')}`;

    // Lunes 00:00:00 UTC
    const currentMonday = new Date(date);
    const diffToMonday = (date.getUTCDay() + 6) % 7;
    currentMonday.setUTCDate(date.getUTCDate() - diffToMonday);
    currentMonday.setUTCHours(0, 0, 0, 0);

    // Domingo 23:59:59.999 UTC
    const currentSunday = new Date(currentMonday);
    currentSunday.setUTCDate(currentMonday.getUTCDate() + 6);
    currentSunday.setUTCHours(23, 59, 59, 999);

    return {
        seasonId,
        year,
        weekNumber,
        seasonNumber: weekNumber,
        name: `Temporada #${weekNumber}`,
        startDate: currentMonday.getTime(),
        endDate: currentSunday.getTime(),
        isActive: true
    };
}

/**
 * Formatea el tiempo restante para el fin de temporada
 * @param {number} endDateTimestamp 
 * @returns {string}
 */
function formatTimeRemaining(endDateTimestamp) {
    const now = Date.now();
    const diff = endDateTimestamp - now;

    if (diff <= 0) return 'Temporada finalizada';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
        return `${days}d ${hours}h ${minutes}m`;
    }
    return `${hours}h ${minutes}m`;
}

/**
 * Función de ordenamiento y desempate estrictamente determinista:
 * 1. rankingPoints (mayor a menor)
 * 2. userLevel (mayor a menor)
 * 3. stars (mayor a menor)
 * 4. lastUpdated (timestamp más antiguo tiene prioridad)
 * 5. displayName (alfabético)
 * 6. uid (identificador único determinista)
 * @param {Object} a 
 * @param {Object} b 
 * @returns {number}
 */
export function comparePlayers(a, b) {
    if (b.rankingPoints !== a.rankingPoints) {
        return b.rankingPoints - a.rankingPoints;
    }
    if ((b.userLevel || 1) !== (a.userLevel || 1)) {
        return (b.userLevel || 1) - (a.userLevel || 1);
    }
    if ((b.stars || 0) !== (a.stars || 0)) {
        return (b.stars || 0) - (a.stars || 0);
    }
    if ((a.lastUpdated || 0) !== (b.lastUpdated || 0)) {
        return (a.lastUpdated || 0) - (b.lastUpdated || 0);
    }
    const nameCmp = (a.displayName || '').localeCompare(b.displayName || '');
    if (nameCmp !== 0) return nameCmp;
    return (a.uid || '').localeCompare(b.uid || '');
}

/**
 * Calcula matemáticamente y con exactitud los puntos que el usuario necesita
 * para superar al jugador rival superior, respetando las reglas de desempate.
 * @param {Object} user Datos del usuario actual { rankingPoints, userLevel, stars }
 * @param {Object} target Datos del jugador objetivo a superar
 * @returns {number} Puntos necesarios exactos
 */
export function calculatePointsNeededToSurpass(user, target) {
    if (!user || !target) return 0;
    const userPts = Number(user.rankingPoints) || 0;
    const targetPts = Number(target.rankingPoints) || 0;
    if (userPts > targetPts) return 0;

    // Simular estado si el usuario igualara los puntos de target
    const hypotheticalUser = {
        ...user,
        rankingPoints: targetPts,
        lastUpdated: Date.now()
    };

    // Si al igualar puntos el usuario vence en nivel o estrellas, solo necesita targetPts - userPts
    if (comparePlayers(hypotheticalUser, target) < 0) {
        return Math.max(1, targetPts - userPts);
    } else {
        // Si no vence en el desempate, requiere targetPts - userPts + 1
        return (targetPts - userPts) + 1;
    }
}

/**
 * Garantiza la integridad de la temporada activa y previene que puntos
 * de temporadas pasadas se mezclen con la temporada en curso.
 * @returns {Object} Detalles de la temporada activa
 */
export function ensureActiveSeasonIntegrity() {
    const activeSeason = calculateSeasonDetails();
    if (!window.state) window.state = {};
    const s = window.state;

    const savedSeasonId = s.currentSeasonId || localStorage.getItem(STORAGE_PREFIX + 'current_season_id') || '';

    if (savedSeasonId && savedSeasonId !== activeSeason.seasonId) {
        // Cambio de temporada detectado
        const oldWeeklyPoints = Number(s.rankingPoints) || Number(localStorage.getItem(STORAGE_PREFIX + 'ranking_points')) || 0;
        if (oldWeeklyPoints > 0) {
            s.historicRankingPoints = (Number(s.historicRankingPoints) || 0) + oldWeeklyPoints;
        }
        s.rankingPoints = 0;
        s.currentSeasonId = activeSeason.seasonId;

        // Limpiar ranking semanal en memoria y almacenamiento local
        cachedWeeklyRanking = [];
        currentSeasonIdCache = activeSeason.seasonId;

        if (s.rankingStats) {
            s.rankingStats.lastKnownRank = null;
            s.rankingStats.bestPointsSeason = 0;
        }

        try {
            localStorage.setItem(STORAGE_PREFIX + 'ranking_points', '0');
            localStorage.setItem(STORAGE_PREFIX + 'historic_ranking_points', String(s.historicRankingPoints || 0));
            localStorage.setItem(STORAGE_PREFIX + 'current_season_id', activeSeason.seasonId);
            localStorage.removeItem(STORAGE_PREFIX + 'cache_weekly_ranking');
            if (s.rankingStats) {
                localStorage.setItem(STORAGE_PREFIX + 'ranking_stats', JSON.stringify(s.rankingStats));
            }
        } catch(e) {}

        // Comprobar reclamos pendientes de la temporada que acaba de terminar
        setTimeout(() => {
            checkPendingSeasonRewards();
        }, 1000);
    } else if (!savedSeasonId) {
        s.currentSeasonId = activeSeason.seasonId;
        try {
            localStorage.setItem(STORAGE_PREFIX + 'current_season_id', activeSeason.seasonId);
        } catch(e) {}
    }

    return activeSeason;
}

/**
 * ==========================================================================
 * SISTEMA ANTI-CHEAT Y ASIGNACIÓN DE PUNTOS
 * ==========================================================================
 */

/**
 * Valida y asigna puntos competitivos al superar un nivel de juego.
 * Previene trampas y alteraciones directas arbitrarias.
 * @param {string} gameKey Nombre del juego superado
 * @param {number|string} level Nivel superado (1 al 5)
 * @param {Object} [extra] Modificadores válidos
 * @returns {Promise<{ awarded: number, newTotal: number } | null>}
 */
export async function awardLevelPoints(gameKey, level, extra = {}) {
    // 1. Validar juego
    const cleanGame = String(gameKey || '').toLowerCase();
    if (!VALID_GAMES.has(cleanGame)) {
        console.warn(`MathQuest Ranking: Nombre de juego no autorizado: "${cleanGame}".`);
        return null;
    }

    // 2. Validar nivel (1 a 5)
    const lvl = parseInt(level, 10);
    if (isNaN(lvl) || lvl < 1 || lvl > 5) {
        console.warn(`MathQuest Ranking: Nivel de juego inválido: "${level}".`);
        return null;
    }

    // 3. Control de cadencia / cooldown (mínimo 3 segundos entre asignaciones)
    const now = Date.now();
    if (now - lastPointAwardTimestamp < 3000) {
        console.warn("MathQuest Ranking: Cooldown de puntos activo.");
        return null;
    }
    lastPointAwardTimestamp = now;

    // 4. Calcular puntos de forma determinista y matemática
    let pts = 10;
    if (lvl <= 2) {
        pts = 10; // Niveles 1 y 2
    } else if (lvl === 3) {
        pts = 15; // Nivel 3
    } else {
        pts = 20; // Niveles 4 y 5
    }

    if (extra.isBoss || cleanGame === 'duel') {
        pts += 15;
    } else if (cleanGame === 'escape') {
        pts += 10;
    }

    if (extra.streakBonus) {
        pts += 5;
    }

    // Límite de seguridad estricto (máximo 50 puntos por nivel)
    pts = Math.min(pts, 50);

    // 5. Aplicar al estado global
    if (!window.state) window.state = {};
    const s = window.state;
    const season = ensureActiveSeasonIntegrity();

    // Si la temporada cambió mientras jugaba, acumular los anteriores al histórico
    if (s.currentSeasonId && s.currentSeasonId !== season.seasonId) {
        s.historicRankingPoints = (Number(s.historicRankingPoints) || 0) + (Number(s.rankingPoints) || 0);
        s.rankingPoints = 0;
    }
    s.currentSeasonId = season.seasonId;

    s.rankingPoints = (Number(s.rankingPoints) || 0) + pts;
    s.historicRankingPoints = (Number(s.historicRankingPoints) || 0) + pts;

    // Guardar en almacenamiento local seguro
    try {
        localStorage.setItem(STORAGE_PREFIX + 'ranking_points', s.rankingPoints);
        localStorage.setItem(STORAGE_PREFIX + 'historic_ranking_points', s.historicRankingPoints);
        localStorage.setItem(STORAGE_PREFIX + 'current_season_id', s.currentSeasonId);
    } catch(e) {}

    // Notificación visual de puntos ganados
    showRankingPointsToast(pts, `Nivel ${lvl} de ${cleanGame.toUpperCase()}`);

    // Chequeo de récord personal de temporada
    if (!s.rankingStats) s.rankingStats = {};
    const prevRecord = s.rankingStats.bestPointsSeason || 0;
    if (s.rankingPoints > prevRecord && prevRecord > 0) {
        s.rankingStats.bestPointsSeason = s.rankingPoints;
        setTimeout(() => {
            showMotivationalToast(`⭐ ¡Nuevo récord personal: ${s.rankingPoints.toLocaleString()} pts!`);
        }, 1500);
    } else if (!s.rankingStats.bestPointsSeason) {
        s.rankingStats.bestPointsSeason = s.rankingPoints;
    }

    // Sincronizar en segundo plano con Firestore
    await syncPlayerRankingToFirestore(season.seasonId, s.rankingPoints, s.historicRankingPoints);

    // Chequeo reactivo de mejora de posición para mensaje motivacional
    try {
        const { uid } = getPublicUserInfo();
        const { players } = await loadWeeklyLeaderboard(season.seasonId);
        if (players && players.length > 0) {
            const rankInfo = await getPlayerRealRank(players, uid, s.rankingPoints, season.seasonId, 'weekly');
            const currentRank = rankInfo.rank;
            const lastRank = s.rankingStats.lastKnownRank || null;

            if (currentRank) {
                if (lastRank && currentRank < lastRank) {
                    const diff = lastRank - currentRank;
                    setTimeout(() => {
                        showMotivationalToast(`⬆️ ¡Subiste ${diff} ${diff === 1 ? 'posición' : 'posiciones'}! (#${currentRank})`);
                    }, 1200);

                    if (lastRank > 10 && currentRank <= 10) {
                        setTimeout(() => {
                            showMotivationalToast(`🔥 ¡Entraste al TOP 10!`);
                        }, 2600);
                    } else if (lastRank > 3 && currentRank <= 3) {
                        setTimeout(() => {
                            showMotivationalToast(`🏆 ¡Entraste al TOP 3!`);
                        }, 2600);
                    }
                }
                s.rankingStats.lastKnownRank = currentRank;
                if (!s.rankingStats.bestRank || currentRank < s.rankingStats.bestRank) {
                    s.rankingStats.bestRank = currentRank;
                }
                try {
                    localStorage.setItem(`${STORAGE_PREFIX}ranking_stats`, JSON.stringify(s.rankingStats));
                } catch(e) {}
            }
        }
    } catch(e) {}

    // Comprobar logros competitivos
    checkRankingAchievements();

    return { awarded: pts, newTotal: s.rankingPoints };
}

/**
 * Muestra un aviso emergente visual no intrusivo al ganar puntos
 * @param {number} points 
 * @param {string} reason 
 */
function showRankingPointsToast(points, reason) {
    if (typeof document === 'undefined') return;

    let toast = document.getElementById('ranking-points-toast-el');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'ranking-points-toast-el';
        toast.className = 'ranking-points-toast';
        document.body.appendChild(toast);
    }

    toast.innerHTML = `
        <span class="ranking-toast-icon">🏆</span>
        <span class="ranking-toast-value">+${points} Ranking</span>
        <span class="ranking-toast-reason">${reason}</span>
    `;

    toast.classList.add('visible');

    if (window.SoundEngine?.playWin) {
        try { window.SoundEngine.playWin(); } catch(e) {}
    }

    setTimeout(() => {
        toast.classList.remove('visible');
    }, 2800);
}

/**
 * Sincroniza la puntuación del jugador con Firestore
 * @param {string} seasonId 
 * @param {number} weeklyPoints 
 * @param {number} historicPoints 
 */
async function syncPlayerRankingToFirestore(seasonId, weeklyPoints, historicPoints) {
    const currentUser = window.MathQuestAuth?.getCurrentUser() || auth?.currentUser;
    if (!currentUser || !db || currentUser.isAnonymous) {
        return;
    }

    const { displayName, avatar, uid } = getPublicUserInfo();
    const s = window.state || {};

    const playerData = {
        displayName: displayName || 'Aventurero Matemático',
        avatar: avatar || 'cubo',
        rankingPoints: Number(weeklyPoints) || 0,
        historicRankingPoints: Number(historicPoints) || 0,
        levelsCompleted: Array.isArray(s.unlockedLevels) ? s.unlockedLevels.length : 1,
        userLevel: Number(s.userLevel) || 1,
        stars: Number(s.stars) || 0,
        badge: s.equippedBadge || '',
        lastUpdated: Date.now()
    };

    try {
        // 1. Temporada semanal actual
        const weeklyRef = doc(db, 'rankingSeasons', seasonId, 'players', uid);
        await setDoc(weeklyRef, playerData, { merge: true });

        // 2. Ranking general histórico (colección raíz oficial)
        const globalRef = doc(db, 'rankingGlobal', uid);
        await setDoc(globalRef, {
            ...playerData,
            rankingPoints: Number(historicPoints) || 0
        }, { merge: true });

        // 3. Sincronización secundaria debounced a CloudSave
        if (window.MathQuestCloudSave?.triggerDebouncedSave) {
            window.MathQuestCloudSave.triggerDebouncedSave();
        }
    } catch (error) {
        console.warn("MathQuest Ranking: Sync Firestore offline o regla restrictiva:", error.message);
    }
}

/**
 * ==========================================================================
 * CARGA DE CLASIFICACIONES DESDE FIRESTORE
 * ==========================================================================
 */

/**
 * Carga los jugadores del Leaderboard Semanal (Top 50)
 * @param {string} [seasonId] 
 * @param {boolean} [forceRefresh=false]
 * @returns {Promise<{ players: Array, isOffline: boolean, season: Object, error: boolean }>}
 */
export async function loadWeeklyLeaderboard(seasonId = null, forceRefresh = false) {
    const season = calculateSeasonDetails();
    const targetSeasonId = seasonId || season.seasonId;

    if (!forceRefresh && cachedWeeklyRanking.length > 0 && currentSeasonIdCache === targetSeasonId) {
        return { players: cachedWeeklyRanking, isOffline: false, season, error: false };
    }

    let players = [];
    let isOffline = false;
    let hasError = false;

    if (db) {
        try {
            const playersCol = collection(db, 'rankingSeasons', targetSeasonId, 'players');
            const q = query(playersCol, orderBy('rankingPoints', 'desc'), limit(50));
            const snapshot = await getDocs(q);

            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                players.push({
                    uid: docSnap.id,
                    displayName: data.displayName || 'Jugador',
                    avatar: data.avatar || 'cubo',
                    rankingPoints: Number(data.rankingPoints) || 0,
                    levelsCompleted: Number(data.levelsCompleted) || 1,
                    userLevel: Number(data.userLevel) || 1,
                    stars: Number(data.stars) || 0,
                    badge: data.badge || '',
                    lastUpdated: data.lastUpdated || 0
                });
            });

            players.sort(comparePlayers);

            try {
                localStorage.setItem(STORAGE_PREFIX + 'cache_weekly_ranking', JSON.stringify(players));
            } catch(e) {}
            cachedWeeklyRanking = players;
            currentSeasonIdCache = targetSeasonId;
        } catch (error) {
            console.warn("MathQuest Ranking: Error de consulta Firestore semanal:", error);
            isOffline = true;
            hasError = true;
        }
    } else {
        isOffline = true;
    }

    // Fallback a caché local si la red falló o está offline
    if (players.length === 0) {
        try {
            const cached = JSON.parse(localStorage.getItem(STORAGE_PREFIX + 'cache_weekly_ranking'));
            if (Array.isArray(cached) && cached.length > 0) {
                players = cached;
                isOffline = true;
                hasError = false;
            }
        } catch(e) {}
    }

    return { players, isOffline, season, error: hasError && players.length === 0 };
}

/**
 * Carga los jugadores del Leaderboard General Histórico (Top 50)
 * @param {boolean} [forceRefresh=false]
 * @returns {Promise<{ players: Array, isOffline: boolean, error: boolean }>}
 */
export async function loadGlobalLeaderboard(forceRefresh = false) {
    if (!forceRefresh && cachedGlobalRanking.length > 0) {
        return { players: cachedGlobalRanking, isOffline: false, error: false };
    }

    let players = [];
    let isOffline = false;
    let hasError = false;

    if (db) {
        try {
            const playersCol = collection(db, 'rankingGlobal');
            const q = query(playersCol, orderBy('rankingPoints', 'desc'), limit(50));
            const snapshot = await getDocs(q);

            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                players.push({
                    uid: docSnap.id,
                    displayName: data.displayName || 'Jugador',
                    avatar: data.avatar || 'cubo',
                    rankingPoints: Number(data.rankingPoints) || 0,
                    levelsCompleted: Number(data.levelsCompleted) || 1,
                    userLevel: Number(data.userLevel) || 1,
                    stars: Number(data.stars) || 0,
                    badge: data.badge || '',
                    lastUpdated: data.lastUpdated || 0
                });
            });

            players.sort(comparePlayers);

            try {
                localStorage.setItem(STORAGE_PREFIX + 'cache_global_ranking', JSON.stringify(players));
            } catch(e) {}
            cachedGlobalRanking = players;
        } catch (error) {
            console.warn("MathQuest Ranking: Error de consulta Firestore global:", error);
            isOffline = true;
            hasError = true;
        }
    } else {
        isOffline = true;
    }

    if (players.length === 0) {
        try {
            const cached = JSON.parse(localStorage.getItem(STORAGE_PREFIX + 'cache_global_ranking'));
            if (Array.isArray(cached) && cached.length > 0) {
                players = cached;
                isOffline = true;
                hasError = false;
            }
        } catch(e) {}
    }

    return { players, isOffline, error: hasError && players.length === 0 };
}

/**
 * Obtiene la posición real del jugador en el ranking.
 * Si el jugador está fuera del Top 50, consulta a Firestore cuántos jugadores tienen más puntos.
 * @param {Array} players Top 50 ya cargado
 * @param {string} uid 
 * @param {number} points 
 * @param {string} seasonId 
 * @param {'weekly'|'global'} type 
 * @returns {Promise<{ rank: number | null, isEstimated: boolean }>}
 */
export async function getPlayerRealRank(players, uid, points, seasonId, type) {
    if (!uid || points <= 0) {
        return { rank: null, isEstimated: false };
    }

    const index = players.findIndex(p => p.uid === uid);
    if (index !== -1) {
        return { rank: index + 1, isEstimated: false };
    }

    // Si tiene puntos y está fuera del Top 50, consultar conteo exacto en Firestore
    if (db && navigator.onLine) {
        try {
            const col = type === 'weekly' 
                ? collection(db, 'rankingSeasons', seasonId, 'players')
                : collection(db, 'rankingGlobal');
            
            const q = query(col, where('rankingPoints', '>', points));
            const snapshot = await getDocs(q);
            return { rank: snapshot.size + 1, isEstimated: false };
        } catch(e) {
            console.warn("MathQuest Ranking: Error al consultar posición externa:", e);
        }
    }

    // Fallback: está por debajo de los 50
    return { rank: 51, isEstimated: true };
}

/**
 * ==========================================================================
 * PREVENCIÓN ATÓMICA DE DOBLE RECLAMO DE RECOMPENSAS
 * ==========================================================================
 */

let isClaimingRewardInProgress = false;

/**
 * Verifica si el usuario ya reclamó la recompensa de una temporada específica
 * @param {string} uid 
 * @param {string} seasonId 
 * @returns {Promise<boolean>}
 */
export async function isRewardAlreadyClaimed(uid, seasonId) {
    if (!uid || !seasonId) return true;

    // 1. Chequeo local rápido
    if (localStorage.getItem(`${STORAGE_PREFIX}claimed_season_${seasonId}`) === 'true') {
        return true;
    }

    // 2. Chequeo en Firestore
    if (db && navigator.onLine) {
        try {
            const claimRef = doc(db, 'users', uid, 'seasonClaims', seasonId);
            const snap = await getDoc(claimRef);
            if (snap.exists()) {
                try { localStorage.setItem(`${STORAGE_PREFIX}claimed_season_${seasonId}`, 'true'); } catch(e) {}
                return true;
            }
        } catch (e) {
            console.warn("MathQuest Ranking: Verificación de reclamo en Firestore:", e);
        }
    }

    return false;
}

/**
 * Reclama la recompensa de temporada de forma atómica y protegida contra exploits
 * @param {string} seasonId 
 * @param {number} rank 
 * @param {Object} reward 
 * @param {number} [points=0]
 * @returns {Promise<boolean>}
 */
export async function claimSeasonReward(seasonId, rank, reward, points = 0) {
    const { uid, isAuthenticated } = getPublicUserInfo();
    if (!uid || !seasonId || !reward) return false;

    if (isClaimingRewardInProgress) {
        return false;
    }
    isClaimingRewardInProgress = true;

    try {
        const claimKey = `${STORAGE_PREFIX}claimed_season_${seasonId}`;

        // 1. Verificación rápida local
        if (localStorage.getItem(claimKey) === 'true') {
            showToastNotification("⚠️ Ya has reclamado la recompensa de esta temporada.");
            isClaimingRewardInProgress = false;
            return false;
        }

        // 2. Comprobar si ya existe reclamo en Firestore antes de continuar
        const alreadyClaimed = await isRewardAlreadyClaimed(uid, seasonId);
        if (alreadyClaimed) {
            try { localStorage.setItem(claimKey, 'true'); } catch(e) {}
            showToastNotification("⚠️ Ya has reclamado la recompensa de esta temporada.");
            isClaimingRewardInProgress = false;
            return false;
        }

        const coinsAwarded = Number(reward.coins) || 0;
        const claimPayload = {
            seasonId,
            seasonNumber: parseInt(seasonId.split('-W')[1], 10) || 1,
            rank: Number(rank) || 1,
            points: Number(points) || 0,
            tier: reward.tier,
            tierTitle: reward.title,
            coinsAwarded,
            badge: reward.badge || '🏅',
            badgeName: reward.badgeName || 'Premio',
            titleReward: reward.titleReward || null,
            claimedAt: Date.now()
        };

        // 3. Si está autenticado y online, ejecutar transacción atómica en Firestore PRIMERO
        // Firestore es la fuente de verdad absoluta contra condiciones de carrera y reclamos duplicados
        if (db && isAuthenticated && navigator.onLine) {
            try {
                const claimRef = doc(db, 'users', uid, 'seasonClaims', seasonId);
                await runTransaction(db, async (transaction) => {
                    const snap = await transaction.get(claimRef);
                    if (snap.exists()) {
                        throw new Error('ALREADY_CLAIMED');
                    }
                    transaction.set(claimRef, claimPayload);
                });
            } catch (err) {
                if (err.message === 'ALREADY_CLAIMED' || err.code === 'permission-denied') {
                    try { localStorage.setItem(claimKey, 'true'); } catch(e) {}
                    showToastNotification("⚠️ La recompensa ya ha sido registrada en el servidor.");
                    isClaimingRewardInProgress = false;
                    return false;
                }
                console.warn("MathQuest Ranking: Error en transacción Firestore:", err);
                showToastNotification("⚠️ Error de conexión al reclamar. Intenta nuevamente.");
                isClaimingRewardInProgress = false;
                return false;
            }
        }

        // 4. SOLO una vez asegurada la transacción en Firestore (o en modo offline/invitado),
        // se conceden las monedas y recompensas al estado local de forma segura
        try {
            localStorage.setItem(claimKey, 'true');
        } catch(e) {}

        const s = window.state || {};

        // Acreditar monedas reales de forma directa sin alterar estrellas
        s.coins = (Number(s.coins) || 0) + coinsAwarded;
        if (typeof window.updateHeaderStats === 'function') {
            window.updateHeaderStats();
        }

        // Entregar insignia e integrar con el catálogo existente
        if (reward.badge) {
            if (!s.unlockedBadges) s.unlockedBadges = [];
            if (!s.unlockedBadges.includes(reward.badge)) {
                s.unlockedBadges.push(reward.badge);
            }
            if (!s.equippedBadge) {
                s.equippedBadge = reward.badge;
            }
        }

        // Entregar título cosmético si corresponde (Top 1, 2, 3)
        if (reward.titleReward) {
            if (!s.unlockedTitles) s.unlockedTitles = [];
            if (!s.unlockedTitles.includes(reward.titleReward)) {
                s.unlockedTitles.push(reward.titleReward);
            }
            s.equippedTitle = reward.titleReward;
        }

        // Actualizar estadísticas competitivas históricas
        if (!s.rankingStats) {
            s.rankingStats = { bestRank: null, seasonsWon: 0, seasonsParticipated: 0, rewardsClaimedCount: 0 };
        }
        s.rankingStats.bestRank = s.rankingStats.bestRank ? Math.min(s.rankingStats.bestRank, rank) : rank;
        s.rankingStats.seasonsParticipated = (s.rankingStats.seasonsParticipated || 0) + 1;
        s.rankingStats.rewardsClaimedCount = (s.rankingStats.rewardsClaimedCount || 0) + 1;
        if (rank === 1) {
            s.rankingStats.seasonsWon = (s.rankingStats.seasonsWon || 0) + 1;
        }

        // Guardar estado local
        if (typeof window.saveStateToStorage === 'function') {
            window.saveStateToStorage();
        }

        // Guardar registro en historial local deduplicado
        try {
            const historyStr = localStorage.getItem(`${STORAGE_PREFIX}claims_history`) || '[]';
            let history = JSON.parse(historyStr);
            if (!Array.isArray(history)) history = [];
            if (!history.some(item => item.seasonId === seasonId)) {
                history.unshift(claimPayload);
                localStorage.setItem(`${STORAGE_PREFIX}claims_history`, JSON.stringify(history.slice(0, 30)));
            }
        } catch(e) {}

        // Sincronizar en la nube
        if (window.MathQuestCloudSave?.triggerDebouncedSave) {
            window.MathQuestCloudSave.triggerDebouncedSave();
        }

        // Comprobar logros
        checkRankingAchievements();

        showToastNotification(`🎉 ¡Recompensas de temporada acreditadas! (+${coinsAwarded} monedas)`);
        isClaimingRewardInProgress = false;
        return true;
    } catch(err) {
        console.error("MathQuest Ranking: Error durante reclamo de recompensa:", err);
        isClaimingRewardInProgress = false;
        return false;
    }
}

/**
 * Comprueba si hay recompensas de temporadas anteriores pendientes de reclamo
 */
export async function checkPendingSeasonRewards() {
    const { uid, isAuthenticated } = getPublicUserInfo();
    if (!uid || !isAuthenticated) return;

    const currentSeason = calculateSeasonDetails();
    const s = window.state || {};
    
    // Determinar qué temporada comprobar: si el jugador tenía una temporada previa guardada o la semana anterior
    let targetSeasonId = null;
    if (s.currentSeasonId && s.currentSeasonId !== currentSeason.seasonId) {
        targetSeasonId = s.currentSeasonId;
    } else {
        const prevDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        targetSeasonId = calculateSeasonDetails(prevDate).seasonId;
    }

    if (!targetSeasonId || targetSeasonId === currentSeason.seasonId) return;

    const alreadyClaimed = await isRewardAlreadyClaimed(uid, targetSeasonId);
    if (alreadyClaimed) return;

    // Consultar puntos del jugador en esa temporada en Firestore
    if (db && navigator.onLine) {
        try {
            const playerDoc = await getDoc(doc(db, 'rankingSeasons', targetSeasonId, 'players', uid));
            if (playerDoc.exists()) {
                const data = playerDoc.data();
                const points = Number(data.rankingPoints) || 0;
                if (points > 0) {
                    const result = await loadWeeklyLeaderboard(targetSeasonId, true);
                    const rankData = await getPlayerRealRank(result.players, uid, points, targetSeasonId, 'weekly');
                    const rank = rankData.rank || 51;
                    
                    const reward = getRewardForRankAndPoints(rank, points);
                    showSeasonRewardModal(targetSeasonId, rank, reward, points);
                }
            }
        } catch(e) {
            console.warn("MathQuest Ranking: Error al verificar premios pendientes:", e);
        }
    }
}

/**
 * Muestra el modal oficial de fin de temporada y reclamo de recompensas
 * @param {string} seasonId 
 * @param {number} rank 
 * @param {Object|null} reward 
 * @param {number} [points=0]
 */
export function showSeasonRewardModal(seasonId, rank, reward, points = 0) {
    let backdrop = document.getElementById('season-reward-claim-backdrop');
    if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.id = 'season-reward-claim-backdrop';
        backdrop.className = 'ranking-reward-modal-backdrop';
        document.body.appendChild(backdrop);
    }

    const rankIcon = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '🏅';

    backdrop.innerHTML = `
        <div class="ranking-reward-card">
            <div class="reward-chest-animation">🏆</div>
            <h2 style="color: #facc15; font-size: 1.35rem; font-weight: 800; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
                TEMPORADA TERMINADA
            </h2>

            <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 12px 16px; margin-bottom: 16px;">
                <div style="font-size: 0.78rem; color: #94a3b8; text-transform: uppercase; font-weight: 700; margin-bottom: 4px;">
                    Tu resultado:
                </div>
                <div style="display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 1.6rem; font-weight: 900; color: #f8fafc;">
                    <span>${rankIcon}</span>
                    <span>#${rank}</span>
                </div>
                <div style="font-size: 0.95rem; font-weight: 800; color: #facc15; margin-top: 2px;">
                    ${(points || 0).toLocaleString()} puntos
                </div>
            </div>

            ${reward ? `
                <div style="font-size: 0.85rem; font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;">
                    🎁 RECOMPENSAS
                </div>

                <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; text-align: left;">
                    <div style="display: flex; align-items: center; gap: 12px; background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 8px 14px;">
                        <span style="font-size: 1.3rem;">🪙</span>
                        <span style="font-size: 0.92rem; font-weight: 800; color: #facc15;">+${reward.coins} monedas</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 12px; background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 8px 14px;">
                        <span style="font-size: 1.3rem;">${reward.badge}</span>
                        <span style="font-size: 0.92rem; font-weight: 700; color: #f8fafc;">Insignia "${reward.badgeName}"</span>
                    </div>
                    ${reward.titleReward ? `
                        <div style="display: flex; align-items: center; gap: 12px; background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 8px 14px;">
                            <span style="font-size: 1.3rem;">👑</span>
                            <span style="font-size: 0.92rem; font-weight: 700; color: #facc15;">Título "${reward.titleReward}"</span>
                        </div>
                    ` : ''}
                </div>

                <button id="btn-claim-season-reward" class="btn btn-primary" style="width: 100%; padding: 12px; font-weight: 800; font-size: 0.95rem;">
                    RECLAMAR RECOMPENSA
                </button>
                <button id="btn-close-reward-claimed" class="btn btn-secondary" style="width: 100%; padding: 10px; margin-top: 8px; display: none;">
                    Cerrar
                </button>
            ` : `
                <div style="background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 14px; margin-bottom: 20px; color: #94a3b8; font-size: 0.85rem; line-height: 1.5;">
                    Participaste en la temporada con <strong>${(points || 0).toLocaleString()} puntos</strong>.<br>
                    Para desbloquear la recompensa de participación se requieren al menos <strong>100 puntos</strong>.<br>
                    ¡Sigue entrenando en la nueva temporada para ganar tus premios!
                </div>
                <button id="btn-dismiss-unearned-modal" class="btn btn-primary" style="width: 100%; padding: 12px; font-weight: 800;">
                    Entendido
                </button>
            `}
        </div>
    `;

    backdrop.style.display = 'flex';

    const claimBtn = document.getElementById('btn-claim-season-reward');
    claimBtn?.addEventListener('click', async () => {
        window.SoundEngine?.playClick?.();
        claimBtn.disabled = true;
        claimBtn.textContent = '⏳ Reclamando...';

        const success = await claimSeasonReward(seasonId, rank, reward, points);
        if (success) {
            claimBtn.textContent = '✅ Recompensa reclamada';
            claimBtn.disabled = true;
            claimBtn.style.opacity = '0.85';
            claimBtn.style.cursor = 'default';
            const closeBtn = document.getElementById('btn-close-reward-claimed');
            if (closeBtn) {
                closeBtn.style.display = 'block';
                closeBtn.addEventListener('click', () => {
                    window.SoundEngine?.playClick?.();
                    backdrop.style.display = 'none';
                });
            }
        } else {
            claimBtn.textContent = 'Ya reclamada o error';
            setTimeout(() => { backdrop.style.display = 'none'; }, 1500);
        }
    });

    const dismissBtn = document.getElementById('btn-dismiss-unearned-modal');
    dismissBtn?.addEventListener('click', () => {
        window.SoundEngine?.playClick?.();
        try {
            localStorage.setItem(`${STORAGE_PREFIX}claimed_season_${seasonId}`, 'true');
        } catch(e) {}
        backdrop.style.display = 'none';
    });
}

/**
 * ==========================================================================
 * RENDERIZADO VISUAL EN EL HUB (CSS & ESTADOS 100% AUDITADOS)
 * ==========================================================================
 */

/**
 * Renderiza la pantalla completa de Ranking en el contenedor #hub-ranking-view
 * @param {'weekly' | 'global'} [tabType]
 */
export async function renderRankingView(tabType = null) {
    const container = document.getElementById('hub-ranking-view');
    if (!container) return;

    if (tabType) {
        currentRankingTab = tabType;
    }

    const season = calculateSeasonDetails();
    const { displayName, avatar, uid, isAuthenticated } = getPublicUserInfo();
    const s = window.state || {};

    // Estructura limpia basada en style.css de MathQuest
    container.innerHTML = `
        <div class="ranking-screen-container">
            <!-- Banner de Temporada y Cabecera -->
            <div class="ranking-season-banner">
                <div class="ranking-banner-header">
                    <div class="ranking-badge-group">
                        <span class="ranking-status-pill online">
                            ● Temporada Activa
                        </span>
                        <span class="ranking-countdown-box">
                            ⏱️ Termina en: <strong id="ranking-countdown-text" class="ranking-countdown-time">${formatTimeRemaining(season.endDate)}</strong>
                        </span>
                    </div>

                    <div style="display: flex; gap: 8px;">
                        <button id="btn-ranking-rewards-info" class="ranking-refresh-btn">
                            🎁 Ver Premios
                        </button>
                        <button id="btn-ranking-history-info" class="ranking-refresh-btn">
                            📜 Historial
                        </button>
                    </div>
                </div>

                <div class="ranking-banner-details">
                    <h2>🏆 ${season.name} • Ranking Global</h2>
                    <p>Compite resolviendo niveles de cálculo y lógica matemática. Los mejores puestos de cada semana ganan MathCoins, títulos de honor e insignias exclusivas.</p>
                </div>
            </div>

            <!-- Banner para usuarios no autenticados -->
            ${!isAuthenticated ? `
                <div class="ranking-guest-banner">
                    <span class="ranking-guest-msg">🔐 Inicia sesión para guardar tu puntuación oficial y competir por las recompensas semanales.</span>
                    <button id="btn-ranking-login" class="btn btn-primary btn-small">Iniciar Sesión</button>
                </div>
            ` : ''}

            <!-- Selector de Clasificación: Semanal vs General -->
            <div class="ranking-nav-row">
                <div class="ranking-type-toggle">
                    <button id="btn-toggle-weekly" class="ranking-toggle-btn ${currentRankingTab === 'weekly' ? 'active' : ''}">
                        🗓️ Ranking Semanal (Oficial)
                    </button>
                    <button id="btn-toggle-global" class="ranking-toggle-btn ${currentRankingTab === 'global' ? 'active' : ''}">
                        👑 Ranking General (Histórico)
                    </button>
                </div>

                <button id="btn-ranking-refresh" class="ranking-refresh-btn" title="Actualizar datos">
                    🔄 Actualizar
                </button>
            </div>

            <!-- Objetivos de Temporada -->
            <div id="ranking-objectives-wrapper" style="margin-bottom: 16px;"></div>

            <!-- Área de Contenido Dinámico: Loading, Empty, Error o Leaderboard -->
            <div id="ranking-content-area">
                <div class="ranking-state-box loading">
                    <div class="ranking-spinner"></div>
                    <p class="ranking-state-msg">⏳ Cargando ranking...</p>
                </div>
            </div>

            <!-- Tarjeta Fija del Jugador (Mi Posición) -->
            <div id="ranking-user-dock-wrapper"></div>
        </div>
    `;

    // Escuchadores de pestañas y botones de cabecera
    setupHeaderEventListeners(season);

    // Iniciar timer de cuenta regresiva
    startCountdown(season.endDate);

    // Cargar datos
    await refreshRankingContent(season, uid, displayName, avatar);
}

/**
 * Asigna los eventos a los botones de navegación del ranking
 */
function setupHeaderEventListeners(season) {
    document.getElementById('btn-toggle-weekly')?.addEventListener('click', () => {
        window.SoundEngine?.playClick?.();
        renderRankingView('weekly');
    });

    document.getElementById('btn-toggle-global')?.addEventListener('click', () => {
        window.SoundEngine?.playClick?.();
        renderRankingView('global');
    });

    document.getElementById('btn-ranking-refresh')?.addEventListener('click', () => {
        window.SoundEngine?.playClick?.();
        const season = calculateSeasonDetails();
        const { displayName, avatar, uid } = getPublicUserInfo();
        refreshRankingContent(season, uid, displayName, avatar, true);
    });

    document.getElementById('btn-ranking-rewards-info')?.addEventListener('click', () => {
        window.SoundEngine?.playClick?.();
        openRewardsModal();
    });

    document.getElementById('btn-ranking-history-info')?.addEventListener('click', () => {
        window.SoundEngine?.playClick?.();
        openSeasonHistoryModal();
    });

    document.getElementById('btn-ranking-login')?.addEventListener('click', () => {
        window.SoundEngine?.playClick?.();
        if (window.MathQuestAuth?.showAuthModal) {
            window.MathQuestAuth.showAuthModal();
        } else {
            document.getElementById('btn-auth-open')?.click();
        }
    });
}

/**
 * Inicia la cuenta regresiva en vivo del banner
 */
function startCountdown(endDate) {
    if (seasonCountdownTimer) clearInterval(seasonCountdownTimer);
    seasonCountdownTimer = setInterval(() => {
        const el = document.getElementById('ranking-countdown-text');
        if (!el) {
            clearInterval(seasonCountdownTimer);
            seasonCountdownTimer = null;
            return;
        }
        const diff = endDate - Date.now();
        if (diff <= 0) {
            clearInterval(seasonCountdownTimer);
            seasonCountdownTimer = null;
            el.textContent = 'Temporada finalizada';
            ensureActiveSeasonIntegrity();
            renderRankingView(currentRankingTab);
            return;
        }
        el.textContent = formatTimeRemaining(endDate);
    }, 10000);
}

/**
 * Carga y renderiza el contenido del leaderboard según la pestaña activa
 */
async function refreshRankingContent(season, currentUid, currentDisplayName, currentAvatar, forceRefresh = false) {
    const contentArea = document.getElementById('ranking-content-area');
    const dockWrapper = document.getElementById('ranking-user-dock-wrapper');
    if (!contentArea) return;

    // Mostrar estado de carga
    contentArea.innerHTML = `
        <div class="ranking-state-box loading">
            <div class="ranking-spinner"></div>
            <p class="ranking-state-msg">⏳ Cargando ranking...</p>
        </div>
    `;

    let result;
    if (currentRankingTab === 'weekly') {
        result = await loadWeeklyLeaderboard(season.seasonId, forceRefresh);
    } else {
        result = await loadGlobalLeaderboard(forceRefresh);
    }

    // 1. Estado de Error
    if (result.error) {
        contentArea.innerHTML = `
            <div class="ranking-state-box error">
                <p class="ranking-state-msg">⚠️ No se pudo cargar el ranking.</p>
                <button class="btn btn-primary btn-small" id="btn-ranking-retry">Reintentar</button>
            </div>
        `;
        document.getElementById('btn-ranking-retry')?.addEventListener('click', () => {
            refreshRankingContent(season, currentUid, currentDisplayName, currentAvatar, true);
        });
        if (dockWrapper) dockWrapper.innerHTML = '';
        return;
    }

    // 2. Estado Vacío (Sin jugadores)
    if (!result.players || result.players.length === 0) {
        contentArea.innerHTML = `
            <div class="ranking-state-box empty">
                <p class="ranking-state-msg">🏆 Todavía no hay jugadores en el ranking.</p>
                <p class="ranking-state-sub">¡Sé el primero en completar un nivel de cualquier juego para liderar la temporada!</p>
            </div>
        `;
        renderUserDock(dockWrapper, currentUid, currentDisplayName, currentAvatar, null, 0);
        return;
    }

    // 3. Renderizar Leaderboard con jugadores reales
    renderLeaderboard(contentArea, result.players, currentUid);

    // 4. Renderizar Tarjeta Fija del Jugador (Mi Posición) y Objetivos de Temporada
    const s = window.state || {};
    const userPoints = currentRankingTab === 'weekly' ? (Number(s.rankingPoints) || 0) : (Number(s.historicRankingPoints) || 0);
    const rankInfo = await getPlayerRealRank(result.players, currentUid, userPoints, season.seasonId, currentRankingTab);
    
    renderUserDock(dockWrapper, currentUid, currentDisplayName, currentAvatar, rankInfo.rank, userPoints, result.players);
    renderSeasonalObjectives(document.getElementById('ranking-objectives-wrapper'), Number(s.rankingPoints) || 0, rankInfo.rank);
}

/**
 * Renderiza el podio TOP 3 (solo con jugadores reales) y la tabla de clasificación
 */
function renderLeaderboard(container, players, currentUid) {
    let html = '';

    // Podio visual TOP 3
    const top3 = players.slice(0, 3);
    const rest = players.slice(3);

    html += `<div class="ranking-podium-wrapper">`;

    if (top3.length === 1) {
        // Solo 1 jugador: Solo puesto 1 (Oro)
        const p = top3[0];
        const isMe = p.uid === currentUid;
        html += `
            <div class="podium-step rank-1">
                <div class="podium-crown">👑</div>
                <div class="podium-avatar-box">
                    <img src="${getAvatarImageSrc(p.avatar)}" alt="${p.displayName}">
                    <span class="podium-rank-badge">1</span>
                </div>
                <div class="podium-player-name" title="${p.displayName}">
                    ${p.displayName} ${isMe ? '<span class="rank-you-badge">Tú</span>' : ''}
                </div>
                <div class="podium-player-points">${(p.rankingPoints || 0).toLocaleString()} pts</div>
                <div class="podium-pedestal">#1</div>
            </div>
        `;
    } else if (top3.length === 2) {
        // 2 jugadores: Oro (#1) y Plata (#2)
        const [first, second] = top3;
        const isMe1 = first.uid === currentUid;
        const isMe2 = second.uid === currentUid;
        html += `
            <div class="podium-step rank-2">
                <div class="podium-avatar-box">
                    <img src="${getAvatarImageSrc(second.avatar)}" alt="${second.displayName}">
                    <span class="podium-rank-badge">2</span>
                </div>
                <div class="podium-player-name" title="${second.displayName}">
                    ${second.displayName} ${isMe2 ? '<span class="rank-you-badge">Tú</span>' : ''}
                </div>
                <div class="podium-player-points">${(second.rankingPoints || 0).toLocaleString()} pts</div>
                <div class="podium-pedestal">#2</div>
            </div>
            <div class="podium-step rank-1">
                <div class="podium-crown">👑</div>
                <div class="podium-avatar-box">
                    <img src="${getAvatarImageSrc(first.avatar)}" alt="${first.displayName}">
                    <span class="podium-rank-badge">1</span>
                </div>
                <div class="podium-player-name" title="${first.displayName}">
                    ${first.displayName} ${isMe1 ? '<span class="rank-you-badge">Tú</span>' : ''}
                </div>
                <div class="podium-player-points">${(first.rankingPoints || 0).toLocaleString()} pts</div>
                <div class="podium-pedestal">#1</div>
            </div>
        `;
    } else {
        // 3 o más jugadores: Orden Olímpico (Plata #2, Oro #1, Bronce #3)
        const [first, second, third] = top3;
        const isMe1 = first.uid === currentUid;
        const isMe2 = second.uid === currentUid;
        const isMe3 = third.uid === currentUid;
        html += `
            <div class="podium-step rank-2">
                <div class="podium-avatar-box">
                    <img src="${getAvatarImageSrc(second.avatar)}" alt="${second.displayName}">
                    <span class="podium-rank-badge">2</span>
                </div>
                <div class="podium-player-name" title="${second.displayName}">
                    ${second.displayName} ${isMe2 ? '<span class="rank-you-badge">Tú</span>' : ''}
                </div>
                <div class="podium-player-points">${(second.rankingPoints || 0).toLocaleString()} pts</div>
                <div class="podium-pedestal">#2</div>
            </div>

            <div class="podium-step rank-1">
                <div class="podium-crown">👑</div>
                <div class="podium-avatar-box">
                    <img src="${getAvatarImageSrc(first.avatar)}" alt="${first.displayName}">
                    <span class="podium-rank-badge">1</span>
                </div>
                <div class="podium-player-name" title="${first.displayName}">
                    ${first.displayName} ${isMe1 ? '<span class="rank-you-badge">Tú</span>' : ''}
                </div>
                <div class="podium-player-points">${(first.rankingPoints || 0).toLocaleString()} pts</div>
                <div class="podium-pedestal">#1</div>
            </div>

            <div class="podium-step rank-3">
                <div class="podium-avatar-box">
                    <img src="${getAvatarImageSrc(third.avatar)}" alt="${third.displayName}">
                    <span class="podium-rank-badge">3</span>
                </div>
                <div class="podium-player-name" title="${third.displayName}">
                    ${third.displayName} ${isMe3 ? '<span class="rank-you-badge">Tú</span>' : ''}
                </div>
                <div class="podium-player-points">${(third.rankingPoints || 0).toLocaleString()} pts</div>
                <div class="podium-pedestal">#3</div>
            </div>
        `;
    }

    html += `</div>`; // Fin ranking-podium-wrapper

    // Tabla de Clasificación para Puestos 4 al 50
    if (rest.length > 0) {
        html += `
            <div class="ranking-table-card">
                <div class="ranking-table-header">
                    <span>Pos</span>
                    <span>Jugador</span>
                    <span class="rank-cell-level">Nivel</span>
                    <span class="rank-cell-wins">Estrellas</span>
                    <span style="text-align: right;">Puntos</span>
                </div>
                <div class="ranking-table-body">
        `;

        rest.forEach((player, idx) => {
            const rank = idx + 4;
            const isMe = player.uid === currentUid;
            html += `
                <div class="ranking-row ${isMe ? 'is-current-user' : ''}">
                    <div class="rank-cell-pos">
                        #${rank}
                    </div>
                    <div class="rank-cell-player">
                        <div class="rank-player-avatar">
                            <img src="${getAvatarImageSrc(player.avatar)}" alt="${player.displayName}">
                        </div>
                        <div class="rank-player-info">
                            <div class="rank-player-name">
                                ${player.displayName}
                                ${isMe ? '<span class="rank-you-badge">Tú</span>' : ''}
                            </div>
                        </div>
                    </div>
                    <div class="rank-cell-level">
                        Nivel ${player.userLevel || 1}
                    </div>
                    <div class="rank-cell-wins">
                        ⭐ ${player.stars || 0}
                    </div>
                    <div class="rank-cell-points">
                        <strong>${(player.rankingPoints || 0).toLocaleString()}</strong>
                        <span style="font-size: 0.72rem; color: #94a3b8; font-weight: normal;">pts</span>
                    </div>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;
    }

    container.innerHTML = html;
}

/**
 * Renderiza la tarjeta de objetivos de temporada
 */
function renderSeasonalObjectives(container, userPoints, userRank) {
    if (!container) return;

    const objectives = [
        { id: 'pts100', text: 'Conseguir 100 puntos', note: '(Meta de Participación 🎯)', completed: userPoints >= 100 },
        { id: 'pts250', text: 'Conseguir 250 puntos', note: '', completed: userPoints >= 250 },
        { id: 'pts500', text: 'Conseguir 500 puntos', note: '', completed: userPoints >= 500 },
        { id: 'top50', text: 'Entrar al TOP 50', note: '', completed: Boolean(userRank && userRank <= 50) },
        { id: 'top25', text: 'Entrar al TOP 25', note: '', completed: Boolean(userRank && userRank <= 25) },
        { id: 'top10', text: 'Entrar al TOP 10', note: '', completed: Boolean(userRank && userRank <= 10) },
        { id: 'top3', text: 'Entrar al TOP 3', note: '', completed: Boolean(userRank && userRank <= 3) },
    ];

    const completedCount = objectives.filter(o => o.completed).length;

    container.innerHTML = `
        <div class="ranking-objectives-card">
            <div class="ranking-objectives-header">
                <div class="ranking-objectives-title">
                    <span>🎯</span>
                    <span>Objetivos de Temporada</span>
                </div>
                <span class="ranking-objectives-progress-tag">${completedCount} de ${objectives.length} completados</span>
            </div>
            <div class="ranking-objectives-grid">
                ${objectives.map(obj => `
                    <div class="ranking-objective-item ${obj.completed ? 'completed' : ''}">
                        <div class="ranking-objective-check">${obj.completed ? '✓' : ''}</div>
                        <span>${obj.text} ${obj.note ? `<small style="color: #38bdf8; font-weight: 700;">${obj.note}</small>` : ''}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

/**
 * Renderiza la tarjeta fija en la parte inferior con la posición del usuario
 */
function renderUserDock(container, uid, displayName, avatar, rank, points, players = []) {
    if (!container) return;

    const s = window.state || {};
    const safePoints = Number(points) || 0;
    const rankLabel = (rank && rank > 0) ? `#${rank}` : '--';
    const safeName = displayName || 'Jugador';
    const subText = safePoints > 0 
        ? `Nivel ${s.userLevel || 1} • ⭐ ${s.stars || 0} estrellas`
        : `Completa niveles para clasificar`;

    let diffHtml = '';
    if (safePoints > 0 && rank && rank > 0 && players && players.length > 0) {
        if (rank === 1) {
            diffHtml = `<div class="ranking-diff-badge leader">👑 ¡Lideras el ranking semanal!</div>`;
        } else {
            let targetPlayer = null;
            let targetRankLabel = '';
            
            const myIndex = players.findIndex(p => p.uid === uid);
            if (myIndex > 0) {
                targetPlayer = players[myIndex - 1];
                targetRankLabel = `#${myIndex}`;
            } else if (rank <= players.length + 1 && players[rank - 2]) {
                targetPlayer = players[rank - 2];
                targetRankLabel = `#${rank - 1}`;
            } else if (rank > 50 && players.length >= 50) {
                targetPlayer = players[49];
                targetRankLabel = 'TOP 50';
            }

            if (targetPlayer && typeof targetPlayer.rankingPoints === 'number') {
                const userObj = {
                    uid,
                    displayName: safeName,
                    rankingPoints: safePoints,
                    userLevel: s.userLevel || 1,
                    stars: s.stars || 0
                };
                const needed = calculatePointsNeededToSurpass(userObj, targetPlayer);
                if (needed > 0) {
                    diffHtml = `<div class="ranking-diff-badge">⬆️ Necesitas ${needed.toLocaleString()} ${needed === 1 ? 'punto' : 'puntos'} para superar al ${targetRankLabel}</div>`;
                }
            }
        }
    }

    container.innerHTML = `
        <div class="ranking-user-dock-card">
            <div class="ranking-user-dock-left">
                <div class="ranking-user-dock-pos-box">
                    <span class="label">MI POSICIÓN</span>
                    <span class="val">${rankLabel}</span>
                </div>
                <div class="rank-player-avatar" style="width: 44px; height: 44px;">
                    <img src="${getAvatarImageSrc(avatar)}" alt="${safeName}">
                </div>
                <div class="ranking-user-dock-profile">
                    <div class="ranking-user-dock-name">
                        ${safeName}
                        <span class="rank-you-badge">TÚ</span>
                        ${s.equippedTitle ? `<span style="font-size: 0.72rem; color: #facc15; font-weight: 700; margin-left: 6px;">[${s.equippedTitle}]</span>` : ''}
                    </div>
                    <div class="ranking-user-dock-subtitle">
                        ${subText}
                    </div>
                    ${diffHtml}
                </div>
            </div>

            <div class="ranking-user-dock-right">
                <div class="ranking-user-dock-stat">
                    <span class="label">${currentRankingTab === 'weekly' ? 'PUNTOS SEMANA' : 'PUNTOS TOTALES'}</span>
                    <span class="val">${safePoints.toLocaleString()} pts</span>
                </div>
            </div>
        </div>
    `;
}

/**
 * ==========================================================================
 * MODALES DE INFORMACIÓN DE PREMIOS E HISTORIAL
 * ==========================================================================
 */

/**
 * Abre el modal con la tabla de premios oficiales de la temporada
 */
export function openRewardsModal() {
    let modal = document.getElementById('ranking-rewards-modal-container');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'ranking-rewards-modal-container';
        modal.className = 'modal-overlay';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="modal-card" style="max-width: 520px; width: 90%;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <h3 style="margin: 0; color: #facc15; font-size: 1.25rem; font-weight: 800;">
                    🎁 Recompensas de Temporada
                </h3>
                <button id="btn-close-rewards-modal" class="modal-close-btn">&times;</button>
            </div>

            <p style="font-size: 0.88rem; color: #94a3b8; margin-bottom: 16px; line-height: 1.5;">
                Las recompensas se entregan automáticamente al finalizar cada semana (Domingo 23:59 UTC). ¡Sube de nivel para alcanzar los mejores premios!
            </p>

            <div style="display: flex; flex-direction: column; gap: 8px; max-height: 380px; overflow-y: auto; padding-right: 4px;">
                ${RANKING_REWARDS.map(r => `
                    <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 10px 14px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="font-size: 1.4rem;">${r.badge}</span>
                            <div>
                                <strong style="display: block; font-size: 0.88rem; color: #f8fafc;">${r.title}</strong>
                                ${r.titleReward ? `<span style="font-size: 0.75rem; color: #94a3b8;">Título: "${r.titleReward}"</span>` : ''}
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <strong style="color: #facc15; font-size: 0.95rem;">+${r.coins} 🪙</strong>
                        </div>
                    </div>
                `).join('')}
            </div>

            <div style="margin-top: 18px; text-align: center;">
                <button id="btn-dismiss-rewards-modal" class="btn btn-primary" style="width: 100%;">
                    Entendido
                </button>
            </div>
        </div>
    `;

    modal.classList.remove('hidden');

    const closeHandler = () => {
        window.SoundEngine?.playClick?.();
        modal.classList.add('hidden');
    };

    document.getElementById('btn-close-rewards-modal')?.addEventListener('click', closeHandler);
    document.getElementById('btn-dismiss-rewards-modal')?.addEventListener('click', closeHandler);
}

/**
 * Abre el modal con el historial competitivo del jugador
 */
export async function openSeasonHistoryModal() {
    let modal = document.getElementById('ranking-history-modal-container');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'ranking-history-modal-container';
        modal.className = 'modal-overlay';
        document.body.appendChild(modal);
    }

    const s = window.state || {};
    const stats = s.rankingStats || {};
    const { uid, isAuthenticated } = getPublicUserInfo();

    modal.innerHTML = `
        <div class="modal-card" style="max-width: 520px; width: 92%; max-height: 90vh; display: flex; flex-direction: column;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <h3 style="margin: 0; color: #60a5fa; font-size: 1.25rem; font-weight: 800;">
                    📜 Historial de Temporadas
                </h3>
                <button id="btn-close-history-modal" class="modal-close-btn">&times;</button>
            </div>

            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 16px;">
                <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 10px 4px; text-align: center;">
                    <strong style="font-size: 1.1rem; color: #facc15; display: block;">${stats.bestRank ? '#' + stats.bestRank : '--'}</strong>
                    <span style="font-size: 0.68rem; color: #94a3b8;">Mejor Puesto</span>
                </div>
                <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 10px 4px; text-align: center;">
                    <strong style="font-size: 1.1rem; color: #facc15; display: block;">${stats.seasonsWon || 0}</strong>
                    <span style="font-size: 0.68rem; color: #94a3b8;">Ganadas</span>
                </div>
                <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 10px 4px; text-align: center;">
                    <strong style="font-size: 1.1rem; color: #f8fafc; display: block;">${stats.seasonsParticipated || 0}</strong>
                    <span style="font-size: 0.68rem; color: #94a3b8;">Temporadas</span>
                </div>
                <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 10px 4px; text-align: center;">
                    <strong style="font-size: 1.1rem; color: #34d399; display: block;">${stats.rewardsClaimedCount || 0}</strong>
                    <span style="font-size: 0.68rem; color: #94a3b8;">Premios</span>
                </div>
            </div>

            <div id="ranking-history-list-content" style="flex: 1; overflow-y: auto; padding-right: 4px; margin-bottom: 16px;">
                <div style="text-align: center; padding: 24px; color: #94a3b8; font-size: 0.88rem;">
                    ⏳ Cargando historial desde Firestore...
                </div>
            </div>

            <div style="text-align: center;">
                <button id="btn-dismiss-history-modal" class="btn btn-primary" style="width: 100%; padding: 10px;">
                    Cerrar
                </button>
            </div>
        </div>
    `;

    modal.classList.remove('hidden');

    const closeHandler = () => {
        window.SoundEngine?.playClick?.();
        modal.classList.add('hidden');
    };

    document.getElementById('btn-close-history-modal')?.addEventListener('click', closeHandler);
    document.getElementById('btn-dismiss-history-modal')?.addEventListener('click', closeHandler);

    const historyListContainer = document.getElementById('ranking-history-list-content');
    if (!historyListContainer) return;

    let claims = [];

    if (db && isAuthenticated && navigator.onLine) {
        try {
            const claimsCol = collection(db, 'users', uid, 'seasonClaims');
            const q = query(claimsCol, orderBy('claimedAt', 'desc'), limit(25));
            const snap = await getDocs(q);
            const seen = new Set();
            snap.forEach(docSnap => {
                const data = docSnap.data();
                if (data && data.seasonId && !seen.has(data.seasonId)) {
                    seen.add(data.seasonId);
                    claims.push(data);
                }
            });
            if (claims.length > 0) {
                try {
                    localStorage.setItem(`${STORAGE_PREFIX}claims_history`, JSON.stringify(claims.slice(0, 30)));
                } catch(e) {}
            }
        } catch (e) {
            console.warn("MathQuest Ranking: Error consultando historial Firestore:", e);
        }
    }

    if (claims.length === 0) {
        try {
            const cached = localStorage.getItem(`${STORAGE_PREFIX}claims_history`);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed)) {
                    const seen = new Set();
                    parsed.forEach(item => {
                        if (item && item.seasonId && !seen.has(item.seasonId)) {
                            seen.add(item.seasonId);
                            claims.push(item);
                        }
                    });
                }
            }
        } catch(e) {}
    }

    if (claims.length === 0) {
        historyListContainer.innerHTML = `
            <div style="text-align: center; padding: 24px 12px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px;">
                <span style="font-size: 2rem; display: block; margin-bottom: 6px;">📜</span>
                <strong style="color: #f8fafc; font-size: 0.95rem; display: block; margin-bottom: 4px;">Aún no tienes temporadas en tu historial</strong>
                <p style="color: #94a3b8; font-size: 0.82rem; margin: 0; line-height: 1.5;">
                    Compite esta semana resolviendo niveles para clasificar y ganar tus primeras recompensas de temporada.
                </p>
            </div>
        `;
        return;
    }

    historyListContainer.innerHTML = `
        <div class="ranking-history-list">
            ${claims.map(c => {
                const posIcon = c.rank === 1 ? '🥇' : c.rank === 2 ? '🥈' : c.rank === 3 ? '🥉' : '🏅';
                const sNum = c.seasonNumber || (c.seasonId ? c.seasonId.replace(/^\d{4}-W/, '') : '1');
                return `
                    <div class="ranking-history-item">
                        <div class="ranking-history-left">
                            <div class="ranking-history-icon">${c.badge || posIcon}</div>
                            <div>
                                <span class="ranking-history-season">Temporada #${sNum}</span>
                                <div class="ranking-history-pos">${posIcon} Posición #${c.rank}</div>
                                <div style="font-size: 0.78rem; color: #cbd5e1;">
                                    ${c.badgeName || c.tierTitle || 'Participante'}
                                    ${c.titleReward ? `<strong style="color: #facc15; margin-left: 4px;">• "${c.titleReward}"</strong>` : ''}
                                </div>
                            </div>
                        </div>
                        <div class="ranking-history-right">
                            <div class="ranking-history-coins">+${c.coinsAwarded || 0} monedas</div>
                            ${c.points ? `<div class="ranking-history-points">${c.points.toLocaleString()} pts</div>` : ''}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

/**
 * Verifica y desbloquea logros competitivos existentes en app.js
 */
function checkRankingAchievements() {
    if (typeof window.checkAllAchievements === 'function') {
        window.checkAllAchievements();
    }
}

/**
 * Toast de aviso general
 */
function showToastNotification(message) {
    if (typeof window.showToast === 'function') {
        window.showToast(message);
    } else {
        console.log("MathQuest:", message);
    }
}

/**
 * Muestra una notificación emergente no intrusiva de motivación competitiva
 * @param {string} message
 */
let motivationToastTimer = null;
export function showMotivationalToast(message) {
    if (typeof document === 'undefined') return;

    let toast = document.getElementById('ranking-motivation-toast-el');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'ranking-motivation-toast-el';
        toast.className = 'ranking-motivation-toast';
        document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.remove('visible');
    // Force reflow
    void toast.offsetWidth;
    toast.classList.add('visible');

    if (motivationToastTimer) clearTimeout(motivationToastTimer);
    motivationToastTimer = setTimeout(() => {
        toast.classList.remove('visible');
    }, 3200);
}

/**
 * ==========================================================================
 * INICIALIZACIÓN Y EXPOSICIÓN GLOBAL
 * ==========================================================================
 */

export function initRankingModule() {
    // Escuchar cambios de autenticación para comprobar premios pendientes y sincronizar
    window.addEventListener('mathquest:auth-changed', () => {
        checkPendingSeasonRewards();
        const activeTab = document.querySelector('.hub-tab-btn.active')?.dataset.tab;
        if (activeTab === 'ranking') {
            renderRankingView();
        }
    });

    // Comprobar premios pendientes en el arranque
    setTimeout(() => {
        checkPendingSeasonRewards();
    }, 2000);
}

// Exponer en window.MathQuestRanking para el Hub y los juegos de MathQuest V3
window.MathQuestRanking = {
    calculateSeasonDetails,
    ensureActiveSeasonIntegrity,
    comparePlayers,
    calculatePointsNeededToSurpass,
    getRewardForRankAndPoints,
    awardLevelPoints,
    loadWeeklyLeaderboard,
    loadGlobalLeaderboard,
    getPlayerRealRank,
    renderRankingView,
    openRewardsModal,
    openSeasonHistoryModal,
    checkPendingSeasonRewards,
    claimSeasonReward,
    showMotivationalToast,
    RANKING_REWARDS
};

// Autoinicialización cuando el DOM esté listo
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initRankingModule);
    } else {
        initRankingModule();
    }
}
