/* ==========================================================================
   MathQuest V3 - Módulo de Persistencia y Sincronización en la Nube (Firestore)
   Maneja la estructura users/{uid}, resolución inteligente de conflictos,
   migración desde localStorage sin pérdidas y debounce de guardado automático.
   ========================================================================== */

import { db, doc, getDoc, setDoc } from './firebase.js';

// Prefijo de almacenamiento local existente en MathQuest V3
const STORAGE_PREFIX = 'mq3_';

// Estado interno del sincronizador
let currentSyncStatus = 'offline'; // 'offline' | 'saving' | 'saved' | 'error'
let syncDebounceTimer = null;
let activeUid = null;
let lastSaveTimestamp = null;
let cachedUserVip = null;

/**
 * Sanitizar recursivamente cualquier campo undefined antes de enviar a Firestore
 * @param {*} obj 
 * @returns {*}
 */
function sanitizeForFirestore(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(sanitizeForFirestore);
    const cleaned = {};
    for (const key of Object.keys(obj)) {
        if (obj[key] !== undefined) {
            cleaned[key] = sanitizeForFirestore(obj[key]);
        }
    }
    return cleaned;
}

/**
 * Calcula el identificador ISO de la temporada semanal activa (ej. 2026-W38)
 * @returns {string}
 */
export function getActiveSeasonId() {
    const d = new Date();
    const target = new Date(d.valueOf());
    const dayNr = (d.getUTCDay() + 6) % 7;
    target.setUTCDate(target.getUTCDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setUTCMonth(0, 1);
    if (target.getUTCDay() !== 4) {
        target.setUTCMonth(0, 1 + ((4 - target.getUTCDay()) + 7) % 7);
    }
    const weekNumber = 1 + Math.ceil((firstThursday - target) / 604800000);
    return `${target.getUTCFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
}

/**
 * Notificar cambios de estado de sincronización al resto de la aplicación
 * @param {'offline' | 'saving' | 'saved' | 'error' | 'local-only'} status 
 * @param {string} [detail]
 */
function updateSyncStatus(status, detail = '') {
    currentSyncStatus = status;
    
    // Disparar evento personalizado para la interfaz
    window.dispatchEvent(new CustomEvent('mathquest:cloud-sync', {
        detail: {
            status,
            detail,
            lastSaved: lastSaveTimestamp
        }
    }));

    // Actualizar elementos visuales directos si existen
    const statusPill = document.getElementById('auth-sync-status-pill');
    const headerIndicator = document.getElementById('account-sync-indicator');
    const headerStatusLabel = document.getElementById('account-header-status-label');

    if (statusPill) {
        statusPill.className = `auth-status-pill ${status}`;
        switch (status) {
            case 'saving':
                statusPill.textContent = '☁️ Guardando...';
                statusPill.title = 'Sincronizando con la nube';
                break;
            case 'saved':
                statusPill.textContent = '✓ Guardado en la nube';
                statusPill.title = 'Progreso sincronizado en Firestore';
                break;
            case 'local-only':
                statusPill.textContent = '🟡 Guardado local';
                statusPill.title = detail || 'Progreso seguro en este dispositivo';
                break;
            case 'error':
                statusPill.textContent = '🟡 Guardado local';
                statusPill.title = detail || 'Progreso guardado localmente';
                break;
            case 'offline':
            default:
                statusPill.textContent = '⚪ Modo Invitado / Local';
                statusPill.title = 'Almacenamiento local del navegador';
                break;
        }
    }

    if (headerIndicator) {
        if (status === 'saved') {
            headerIndicator.className = 'account-sync-indicator online';
            headerIndicator.title = 'En línea: Progreso respaldado en la nube';
        } else if (status === 'saving') {
            headerIndicator.className = 'account-sync-indicator syncing';
            headerIndicator.title = 'Guardando en la nube...';
        } else if (status === 'local-only' || status === 'error') {
            headerIndicator.className = 'account-sync-indicator local';
            headerIndicator.title = detail || 'Progreso seguro en tu dispositivo';
        } else {
            headerIndicator.className = 'account-sync-indicator offline';
            headerIndicator.title = 'Modo Invitado (Almacenamiento Local)';
        }
    }

    // El botón de cabecera SIEMPRE debe mostrar el nombre del usuario o 'Cuenta'
    // NUNCA debe ser reemplazado por texto técnico como 'Guardando...' o 'Sin sync'
    if (headerStatusLabel) {
        const user = window.MathQuestAuth?.getCurrentUser();
        if (user) {
            const displayName = user.displayName || user.email?.split('@')[0] || 'Jugador';
            headerStatusLabel.textContent = displayName.split(' ')[0];
        } else {
            headerStatusLabel.textContent = 'Cuenta';
        }
    }
}

/**
 * Obtener un snapshot limpio y estructurado del estado actual de MathQuest
 * @param {Object} [user] Usuario autenticado de Firebase
 * @returns {Object} Datos formateados para users/{uid}
 */
export function formatProgressData(user = null) {
    const s = window.state || {};

    const currentUser = user || window.MathQuestAuth?.getCurrentUser();

    const payload = {
        profile: {
            uid: currentUser?.uid || activeUid || '',
            displayName: currentUser?.displayName || 'Aventurero Matemático',
            email: currentUser?.email || null,
            phoneNumber: currentUser?.phoneNumber || null,
            photoURL: currentUser?.photoURL || null,
            providerId: currentUser?.providerData?.[0]?.providerId || 'password',
            lastLoginAt: Date.now()
        },
        progression: {
            streak: Number(s.streak) || 1,
            stars: Number(s.stars) || 0,
            coins: Number(s.coins) || 150,
            globalHints: Number(s.globalHints ?? 2),
            lives: Number(s.lives ?? 3),
            userLevel: Number(s.userLevel) || 1,
            rankingPoints: Number(s.rankingPoints) || 0,
            historicRankingPoints: Number(s.historicRankingPoints) || 0,
            currentSeasonId: s.currentSeasonId || getActiveSeasonId(),
            rankingStats: s.rankingStats || { bestRank: null, seasonsWon: 0, seasonsParticipated: 0, rewardsClaimedCount: 0 },
            unlockedLevels: Array.isArray(s.unlockedLevels) 
                ? [...s.unlockedLevels] 
                : ['snake-1', 'slider-1', 'tetris-1', 'arkanoid-1', 'sudoku-1', 'ahorcado-1', 'tres-1'],
            unlockedAchievements: Array.isArray(s.unlockedAchievements) 
                ? [...s.unlockedAchievements] 
                : []
        },
        customization: {
            equippedAvatar: (s.equippedAvatar === 'cube' ? 'cubo' : s.equippedAvatar) || 'cubo',
            equippedSkin: s.equippedSkin || 'standard',
            equippedBadge: s.equippedBadge || '',
            unlockedSkins: Array.isArray(s.unlockedSkins) ? [...s.unlockedSkins] : ['standard']
        },
        inventory: {
            shield: Number(s.inventory?.shield) || 0,
            freeze: Number(s.inventory?.freeze) || 0
        },
        settings: {
            soundEnabled: s.soundEnabled !== false,
            musicEnabled: s.musicEnabled !== false,
            musicVolume: typeof s.musicVolume === 'number' ? s.musicVolume : 0.3,
            musicTrack: s.musicTrack || 'arcade'
        },
        security: {
            // Nota arquitectónica: Flag de compatibilidad con versiones previas (solo individual)
            vipBypassPurchased: Boolean(s.isRealVip || (s.vipBypassPurchased && !s.isGlobalVip))
        },
        updatedAt: Date.now(),
        clientVersion: 'MathQuest-V3.3'
    };

    // Si existe información VIP confirmada en la nube, preservarla exactamente para no violar las reglas de Firestore
    if (cachedUserVip) {
        payload.vip = cachedUserVip;
    }

    return payload;
}

/**
 * Reconciliación segura entre el progreso local (localStorage/state) y el de Firestore.
 * Prioriza SIEMPRE el mayor avance para evitar cualquier retroceso o pérdida.
 * @param {Object} cloudData Documento obtenido de users/{uid}
 * @param {Object} localState Estado actual en memoria/localStorage
 * @returns {Object} Estado unificado final
 */
export function reconcileAndMerge(cloudData, localState) {
    const cloudProg = cloudData.progression || cloudData;
    const cloudCust = cloudData.customization || cloudData;
    const cloudInv = cloudData.inventory || {};
    const cloudSec = cloudData.security || {};
    const cloudSet = cloudData.settings || {};

    // Fuente de Verdad VIP: Firestore (soporta booleano directo 'vip: true/false', 'isVip', o mapa)
    const isCloudVipActive = Boolean(
        cloudData.vip === true ||
        cloudData.isVip === true ||
        cloudData.vipActive === true ||
        cloudData.bypassPurchased === true ||
        (cloudData.vip && typeof cloudData.vip === 'object' && (cloudData.vip.active === true || cloudData.vip.status === 'confirmed'))
    );
    const isGlobalVipActive = Boolean(window.MathQuestVIP?.isGlobalVip?.() || window.state?.isGlobalVip);
    const localLegacyBypass = Boolean(localState.vipBypassPurchased && !localState.isGlobalVip);

    if (isCloudVipActive) {
        cachedUserVip = (cloudData.vip !== undefined) ? cloudData.vip : true;
    } else if (cloudData.vip !== undefined) {
        cachedUserVip = cloudData.vip;
    }

    const localUnlockedLevels = Array.isArray(localState.unlockedLevels) ? localState.unlockedLevels : [];
    const cloudUnlockedLevels = Array.isArray(cloudProg.unlockedLevels) ? cloudProg.unlockedLevels : [];

    const localUnlockedSkins = Array.isArray(localState.unlockedSkins) ? localState.unlockedSkins : ['standard'];
    const cloudUnlockedSkins = Array.isArray(cloudCust.unlockedSkins) ? cloudCust.unlockedSkins : ['standard'];

    const localAchievements = Array.isArray(localState.unlockedAchievements) ? localState.unlockedAchievements : [];
    const cloudAchievements = Array.isArray(cloudProg.unlockedAchievements) ? cloudProg.unlockedAchievements : [];

    // Combinación inteligente: Unión de conjuntos para desbloqueos
    const mergedLevels = Array.from(new Set([...localUnlockedLevels, ...cloudUnlockedLevels]));
    const mergedSkins = Array.from(new Set([...localUnlockedSkins, ...cloudUnlockedSkins]));
    const mergedAchievements = Array.from(new Set([...localAchievements, ...cloudAchievements]));

    // Valores numéricos: Tomar el máximo de cada uno para no retroceder
    const mergedStreak = Math.max(Number(localState.streak) || 1, Number(cloudProg.streak) || 1);
    const mergedStars = Math.max(Number(localState.stars) || 0, Number(cloudProg.stars) || 0);
    const mergedCoins = Math.max(Number(localState.coins) || 0, Number(cloudProg.coins) || 0);
    const mergedHints = Math.max(Number(localState.globalHints) || 0, Number(cloudProg.globalHints) || 0);
    const mergedUserLevel = Math.max(Number(localState.userLevel) || 1, Number(cloudProg.userLevel) || 1);
    // Manejo inteligente de temporadas competitivas
    const activeSeasonId = getActiveSeasonId();
    const cloudSeasonId = cloudProg.currentSeasonId || '';
    const localSeasonId = localState.currentSeasonId || '';

    let localWeeklyPts = Number(localState.rankingPoints) || 0;
    let cloudWeeklyPts = Number(cloudProg.rankingPoints) || 0;
    let localHistoricPts = Number(localState.historicRankingPoints) || 0;
    let cloudHistoricPts = Number(cloudProg.historicRankingPoints) || 0;

    // Si los puntos provienen de una temporada anterior, transferirlos a histórico de forma segura
    if (cloudSeasonId && cloudSeasonId !== activeSeasonId && cloudWeeklyPts > 0) {
        cloudHistoricPts += cloudWeeklyPts;
        cloudWeeklyPts = 0;
    }
    if (localSeasonId && localSeasonId !== activeSeasonId && localWeeklyPts > 0) {
        localHistoricPts += localWeeklyPts;
        localWeeklyPts = 0;
    }

    const mergedRankingPoints = Math.max(localWeeklyPts, cloudWeeklyPts);
    const mergedHistoricRankingPoints = Math.max(localHistoricPts, cloudHistoricPts);

    const mergedRankingStats = {
        bestRank: (localState.rankingStats?.bestRank && cloudProg.rankingStats?.bestRank) 
            ? Math.min(localState.rankingStats.bestRank, cloudProg.rankingStats.bestRank)
            : (localState.rankingStats?.bestRank || cloudProg.rankingStats?.bestRank || null),
        seasonsWon: Math.max(localState.rankingStats?.seasonsWon || 0, cloudProg.rankingStats?.seasonsWon || 0),
        seasonsParticipated: Math.max(localState.rankingStats?.seasonsParticipated || 0, cloudProg.rankingStats?.seasonsParticipated || 0),
        rewardsClaimedCount: Math.max(localState.rankingStats?.rewardsClaimedCount || 0, cloudProg.rankingStats?.rewardsClaimedCount || 0)
    };

    // Inventario: Preservar las cantidades más altas acumuladas
    const mergedShield = Math.max(Number(localState.inventory?.shield) || 0, Number(cloudInv.shield) || 0);
    const mergedFreeze = Math.max(Number(localState.inventory?.freeze) || 0, Number(cloudInv.freeze) || 0);

    // Membresía VIP: Si la nube individual lo confirma, es VIP Real. Si el VIP Global está activo, concede acceso
    const hasVipAccess = isCloudVipActive || isGlobalVipActive || localLegacyBypass;

    return {
        streak: mergedStreak,
        stars: mergedStars,
        coins: mergedCoins,
        globalHints: mergedHints,
        lives: 3,
        userLevel: mergedUserLevel,
        rankingPoints: mergedRankingPoints,
        historicRankingPoints: mergedHistoricRankingPoints,
        currentSeasonId: activeSeasonId,
        rankingStats: mergedRankingStats,
        equippedAvatar: ((localState.equippedAvatar === 'cube' ? 'cubo' : localState.equippedAvatar) || (cloudCust.equippedAvatar === 'cube' ? 'cubo' : cloudCust.equippedAvatar)) || 'cubo',
        equippedSkin: localState.equippedSkin || cloudCust.equippedSkin || 'standard',
        equippedBadge: localState.equippedBadge || cloudCust.equippedBadge || '',
        unlockedSkins: mergedSkins.length ? mergedSkins : ['standard'],
        unlockedLevels: mergedLevels.length ? mergedLevels : ['snake-1', 'slider-1', 'tetris-1', 'arkanoid-1', 'sudoku-1', 'ahorcado-1', 'tres-1'],
        unlockedAchievements: mergedAchievements,
        vipBypassPurchased: hasVipAccess,
        isRealVip: isCloudVipActive,
        isGlobalVip: isGlobalVipActive,
        vip: cachedUserVip || { active: false, productId: 'mathquest-vip' },
        inventory: {
            shield: mergedShield,
            freeze: mergedFreeze
        },
        soundEnabled: cloudSet.soundEnabled !== undefined ? cloudSet.soundEnabled : (localState.soundEnabled !== false),
        musicEnabled: cloudSet.musicEnabled !== undefined ? cloudSet.musicEnabled : (localState.musicEnabled !== false),
        musicVolume: cloudSet.musicVolume !== undefined ? cloudSet.musicVolume : (localState.musicVolume ?? 0.3),
        musicTrack: cloudSet.musicTrack || localState.musicTrack || 'arcade'
    };
}

/**
 * Aplicar un estado reconciliado a la memoria (window.state) y a localStorage de forma segura
 * @param {Object} mergedState 
 */
function applyMergedStateToApp(mergedState) {
    if (!window.state) {
        window.state = {};
    }

    Object.assign(window.state, mergedState);

    // Guardar en localStorage bajo el prefijo 'mq3_' de forma explícita y no destructiva
    try {
        localStorage.setItem(STORAGE_PREFIX + 'streak', window.state.streak);
        localStorage.setItem(STORAGE_PREFIX + 'stars', window.state.stars);
        localStorage.setItem(STORAGE_PREFIX + 'coins', window.state.coins);
        localStorage.setItem(STORAGE_PREFIX + 'global_hints', window.state.globalHints);
        localStorage.setItem(STORAGE_PREFIX + 'user_level', window.state.userLevel);
        localStorage.setItem(STORAGE_PREFIX + 'sound_enabled', window.state.soundEnabled);
        localStorage.setItem(STORAGE_PREFIX + 'music_enabled', window.state.musicEnabled);
        localStorage.setItem(STORAGE_PREFIX + 'music_volume', window.state.musicVolume);
        localStorage.setItem(STORAGE_PREFIX + 'music_track', window.state.musicTrack);
        localStorage.setItem(STORAGE_PREFIX + 'equipped_avatar', window.state.equippedAvatar);
        localStorage.setItem(STORAGE_PREFIX + 'equipped_skin', window.state.equippedSkin);
        localStorage.setItem(STORAGE_PREFIX + 'equipped_badge', window.state.equippedBadge);
        localStorage.setItem(STORAGE_PREFIX + 'unlocked_skins', JSON.stringify(window.state.unlockedSkins));
        localStorage.setItem(STORAGE_PREFIX + 'unlocked_levels', JSON.stringify(window.state.unlockedLevels));
        // Persistir vip_bypass_purchased como 'true' solo si el usuario tiene VIP individual confirmado o bypass local legacy
        // NUNCA persistir VIP Global como compra local individual
        const persistVip = Boolean(window.state.isRealVip || (localLegacyBypass && !window.state.isGlobalVip));
        localStorage.setItem(STORAGE_PREFIX + 'vip_bypass_purchased', persistVip);
        localStorage.setItem(STORAGE_PREFIX + 'inventory', JSON.stringify(window.state.inventory));
        localStorage.setItem(STORAGE_PREFIX + 'ranking_points', window.state.rankingPoints || 0);
        localStorage.setItem(STORAGE_PREFIX + 'historic_ranking_points', window.state.historicRankingPoints || 0);
        localStorage.setItem(STORAGE_PREFIX + 'current_season_id', window.state.currentSeasonId || getActiveSeasonId());
        if (window.state.rankingStats) {
            localStorage.setItem(STORAGE_PREFIX + 'ranking_stats', JSON.stringify(window.state.rankingStats));
        }
    } catch (e) {
        console.warn("Aviso al persistir estado reconciliado en localStorage:", e);
    }

    // Refrescar los componentes visuales de MathQuest
    if (typeof window.updateHeaderStats === 'function') {
        window.updateHeaderStats();
    }
    if (typeof window.renderDuolingoPath === 'function') {
        window.renderDuolingoPath();
    }
    if (typeof window.renderAllPathNodes === 'function') {
        window.renderAllPathNodes();
    }
    if (typeof window.renderStreakCalendar === 'function') {
        window.renderStreakCalendar();
    }
    if (typeof window.renderAchievements === 'function') {
        window.renderAchievements();
    }
    if (typeof window.renderShop === 'function') {
        window.renderShop();
    }
}

/**
 * Cargar el progreso del usuario desde Firestore (o migrarlo si es la primera vez)
 * @param {Object} user Usuario autenticado de Firebase
 */
export async function loadUserProgress(user) {
    if (!user || !user.uid) {
        updateSyncStatus('offline');
        return;
    }

    activeUid = user.uid;
    updateSyncStatus('saving', 'Conectando con la nube...');

    try {
        const userDocRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(userDocRef);

        if (docSnap.exists()) {
            // El documento ya existe en Firestore -> Reconciliación inteligente
            const cloudData = docSnap.data();
            console.log("☁️ Progreso existente encontrado en Firestore para UID:", user.uid);

            const merged = reconcileAndMerge(cloudData, window.state || {});
            applyMergedStateToApp(merged);

            // Respaldo inmediato del estado unificado en Firestore
            await saveUserProgress(user, { force: true, silent: true });
            updateSyncStatus('saved', 'Progreso sincronizado y actualizado');
        } else {
            // Primera vez del usuario en Firestore -> Migración segura desde localStorage
            console.log("📦 Primera vez del usuario en la nube. Migrando progreso local a Firestore...");
            await saveUserProgress(user, { force: true });
            localStorage.setItem(STORAGE_PREFIX + `migrated_${user.uid}`, 'true');
            updateSyncStatus('saved', 'Progreso local respaldado en la nube');
        }
    } catch (err) {
        console.warn("Aviso de sincronización en Firestore:", err?.code, err?.message);
        let detail = 'Progreso seguro guardado localmente en este navegador';
        if (err?.code === 'not-found' || err?.message?.includes('does not exist')) {
            detail = 'Base de datos Firestore pendiente de crear en Firebase Console';
        } else if (err?.code === 'permission-denied') {
            detail = 'Reglas de seguridad de Firestore pendientes en Firebase Console';
        }
        updateSyncStatus('local-only', detail);
    }
}

/**
 * Guardar el progreso actual en users/{uid}
 * @param {Object} [user]
 * @param {Object} [options]
 */
export async function saveUserProgress(user = null, options = {}) {
    const targetUser = user || window.MathQuestAuth?.getCurrentUser();
    const uid = targetUser?.uid || activeUid;

    if (!uid) {
        updateSyncStatus('offline');
        return;
    }

    if (!options.silent) {
        updateSyncStatus('saving', 'Guardando...');
    }

    try {
        const rawPayload = formatProgressData(targetUser);
        const payload = sanitizeForFirestore(rawPayload);
        const userDocRef = doc(db, 'users', uid);

        await setDoc(userDocRef, payload, { merge: true });

        lastSaveTimestamp = Date.now();
        updateSyncStatus('saved', 'Progreso respaldado en la nube');
        console.log("✓ Progreso de MathQuest guardado en Firestore:", uid);
    } catch (err) {
        console.warn("Aviso al guardar progreso en Firestore:", err?.code, err?.message);
        let detail = 'Progreso seguro guardado localmente en este navegador';
        if (err?.code === 'not-found' || err?.message?.includes('does not exist')) {
            detail = 'Base de datos Firestore pendiente de crear en Firebase Console';
        } else if (err?.code === 'permission-denied') {
            detail = 'Reglas de seguridad de Firestore pendientes en Firebase Console';
        }
        updateSyncStatus('local-only', detail);
    }
}

/**
 * Disparador de guardado automático con debounce (espera 1.5s de inactividad)
 * Evita sobrecarga de peticiones a Firestore tras acciones repetidas.
 */
export function triggerDebouncedSave() {
    const user = window.MathQuestAuth?.getCurrentUser();
    if (!user || !user.uid) {
        return;
    }

    updateSyncStatus('saving');

    if (syncDebounceTimer) {
        clearTimeout(syncDebounceTimer);
    }

    syncDebounceTimer = setTimeout(() => {
        saveUserProgress(user);
    }, 1500);
}

/**
 * Restablecer progreso en la nube de forma segura para users/{uid}
 * Reemplaza la progresión, personalización e inventario por los valores iniciales.
 * No borra la cuenta, ni el usuario, ni los pagos ni el estado VIP del servidor.
 * @param {Object} [user]
 */
export async function resetUserProgress(user = null) {
    if (syncDebounceTimer) {
        clearTimeout(syncDebounceTimer);
        syncDebounceTimer = null;
    }

    const targetUser = user || window.MathQuestAuth?.getCurrentUser();
    const uid = targetUser?.uid || activeUid;

    if (!uid) {
        return;
    }

    updateSyncStatus('saving', 'Restableciendo progreso en la nube...');

    try {
        const rawPayload = formatProgressData(targetUser);
        const payload = sanitizeForFirestore(rawPayload);
        const userDocRef = doc(db, 'users', uid);

        // Guardar estado inicial limpio en users/{uid}
        await setDoc(userDocRef, payload, { merge: true });

        lastSaveTimestamp = Date.now();
        updateSyncStatus('saved', 'Progreso restablecido en la nube');
        console.log("✓ Progreso restablecido exitosamente en Firestore para UID:", uid);
    } catch (err) {
        console.warn("Aviso al restablecer progreso en Firestore:", err?.code, err?.message);
        updateSyncStatus('local-only', 'Progreso local restablecido');
    }
}

/**
 * Resetear estado al cerrar sesión
 */
export function handleUserLogout() {
    activeUid = null;
    if (syncDebounceTimer) {
        clearTimeout(syncDebounceTimer);
    }
    updateSyncStatus('offline');
}

// Exponer la API en el objeto global para acceso unificado
window.MathQuestCloudSave = {
    loadUserProgress,
    saveUserProgress,
    resetUserProgress,
    triggerDebouncedSave,
    formatProgressData,
    reconcileAndMerge,
    handleUserLogout,
    getSyncStatus: () => currentSyncStatus
};
