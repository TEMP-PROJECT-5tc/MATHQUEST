/* ==========================================================================
   MathQuest V3 - Capa de Autenticación y Sincronización en la Nube
   Firebase Authentication (Google Sign-In) & Cloud Firestore Persistence
   Mantiene el progreso del jugador sincronizado entre dispositivos mediante UID.
   ========================================================================== */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
    getAuth, 
    GoogleAuthProvider, 
    signInWithPopup, 
    signOut, 
    onAuthStateChanged 
} from 'firebase/auth';
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc 
} from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

// --------------------------------------------------------------------------
// 1. Inicialización Segura de Firebase
// --------------------------------------------------------------------------
let app = null;
let auth = null;
let db = null;
let isFirebaseReady = false;

try {
    app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);

    const dbId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
        ? firebaseConfig.firestoreDatabaseId 
        : undefined;

    try {
        db = dbId ? getFirestore(app, dbId) : getFirestore(app);
    } catch (dbErr) {
        console.warn("Aviso al inicializar Firestore con ID personalizado, usando instancia default:", dbErr);
        db = getFirestore(app);
    }
    
    isFirebaseReady = true;
} catch (err) {
    console.error("Error al inicializar Firebase en MathQuest:", err);
}

// Proveedor de Autenticación con Google
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
    prompt: 'select_account'
});

// --------------------------------------------------------------------------
// 2. Estado Interno del Módulo de Autenticación
// --------------------------------------------------------------------------
let currentUser = null;
let lastSyncTimestamp = null;
let isSyncing = false;
let authListeners = [];

// --------------------------------------------------------------------------
// 3. Métodos Centrales de Autenticación
// --------------------------------------------------------------------------

/**
 * Iniciar sesión con Google usando Firebase Popup
 */
export async function signInWithGoogle() {
    if (!auth) {
        throw new Error("El servicio de autenticación de Firebase no está disponible.");
    }
    setModalLoading(true, "Conectando con Google...");
    clearAuthModalError();

    try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        currentUser = user;
        
        showAppNotification(`¡Bienvenido, ${user.displayName || 'Aventurero'}! 🚀`);
        
        // Sincronizar o migrar progreso
        await loadOrMigrateUserProgress(user);
        
        updateUI();
        return { success: true, user };
    } catch (error) {
        console.error("Error en Google Sign-In:", error);
        handleAuthError(error);
        return { success: false, error };
    } finally {
        setModalLoading(false);
    }
}

/**
 * Cerrar sesión actual
 */
export async function signOutUser() {
    if (!auth) return;
    try {
        await signOut(auth);
        currentUser = null;
        lastSyncTimestamp = null;
        showAppNotification("Has cerrado sesión. Tu progreso local sigue disponible. 👍");
        updateUI();
    } catch (error) {
        console.error("Error al cerrar sesión:", error);
        showAppNotification("Error al cerrar sesión: " + error.message);
    }
}

/**
 * Obtener el usuario actual
 */
export function getCurrentUser() {
    return currentUser;
}

/**
 * Suscribirse a cambios de estado de autenticación
 */
export function onAuthStateChange(callback) {
    if (typeof callback === 'function') {
        authListeners.push(callback);
        if (currentUser) callback(currentUser);
    }
}

// --------------------------------------------------------------------------
// 4. Sincronización y Migración de Progreso en la Nube
// --------------------------------------------------------------------------

/**
 * Carga el progreso del jugador desde Firestore.
 * Si es un usuario nuevo (sin doc en Firestore), migra de forma transparente
 * su progreso local actual sin borrar el localStorage.
 * Si ya existe, concilia inteligentemente manteniendo siempre el valor más avanzado.
 */
async function loadOrMigrateUserProgress(user) {
    if (!db || !user) return;
    isSyncing = true;
    updateSyncIndicator();

    try {
        const userDocRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(userDocRef);

        if (docSnap.exists()) {
            // Usuario con progreso previo en la nube: Conciliación Inteligente
            const cloudData = docSnap.data();
            const cloudProgress = cloudData.progress || {};
            reconcileAndApplyProgress(cloudProgress);
            lastSyncTimestamp = cloudData.updatedAt || Date.now();
            showAppNotification("☁️ Progreso sincronizado desde tu cuenta Google.");
        } else {
            // Usuario nuevo en la nube: Migración del progreso local actual a su cuenta
            await saveProgressToCloud(user, true);
            lastSyncTimestamp = Date.now();
            showAppNotification("✨ Progreso local vinculado exitosamente a tu cuenta.");
        }
    } catch (err) {
        console.error("Error al cargar o migrar progreso en la nube:", err);
        // Si hay error de permisos (por ejemplo, reglas no desplegadas o conexión)
        // se mantiene el progreso local intacto.
    } finally {
        isSyncing = false;
        updateSyncIndicator();
        renderAccountModalContent();
    }
}

/**
 * Guarda el progreso actual en Firestore bajo `users/{uid}`
 */
export async function syncProgressToCloud(isManual = false) {
    if (!currentUser || !db) return;
    if (isSyncing) return;
    
    isSyncing = true;
    updateSyncIndicator();

    try {
        await saveProgressToCloud(currentUser, false);
        lastSyncTimestamp = Date.now();
        if (isManual) {
            showAppNotification("☁️ ¡Tu progreso está 100% guardado y actualizado en la nube!");
        }
    } catch (err) {
        console.error("Error al sincronizar con Firestore:", err);
        if (isManual) {
            showAppNotification("No se pudo sincronizar en la nube en este momento.");
        }
    } finally {
        isSyncing = false;
        updateSyncIndicator();
        renderAccountModalContent();
    }
}

/**
 * Estructura y guarda el documento en Firestore
 */
async function saveProgressToCloud(user, isInitialMigration = false) {
    const currentState = window.state || (window.MathQuestApp && window.MathQuestApp.state) || {};
    const STORAGE_PREFIX = 'mq3_';
    
    // Obtener fechas de racha y última fecha activa de localStorage si existen
    let streakDates = [];
    let lastActiveDate = '';
    try {
        streakDates = JSON.parse(localStorage.getItem(STORAGE_PREFIX + 'streak_dates')) || [];
        lastActiveDate = localStorage.getItem(STORAGE_PREFIX + 'last_active_date') || '';
    } catch (e) {}

    const progressPayload = {
        streak: currentState.streak ?? 1,
        stars: currentState.stars ?? 0,
        coins: currentState.coins ?? 150,
        globalHints: currentState.globalHints ?? 2,
        userLevel: currentState.userLevel ?? 1,
        soundEnabled: currentState.soundEnabled ?? true,
        musicEnabled: currentState.musicEnabled ?? true,
        musicVolume: currentState.musicVolume ?? 0.4,
        musicTrack: currentState.musicTrack || 'adventure',
        equippedAvatar: currentState.equippedAvatar || 'cubo',
        equippedSkin: currentState.equippedSkin || 'standard',
        equippedBadge: currentState.equippedBadge || '',
        unlockedSkins: currentState.unlockedSkins || ['standard'],
        unlockedLevels: currentState.unlockedLevels || ['snake-1', 'slider-1', 'tetris-1', 'arkanoid-1', 'sudoku-1', 'ahorcado-1', 'tres-1'],
        vipBypassPurchased: !!currentState.vipBypassPurchased,
        inventory: currentState.inventory || { shield: 0, freeze: 0 },
        streakDates: streakDates,
        lastActiveDate: lastActiveDate
    };

    const docPayload = {
        uid: user.uid,
        displayName: user.displayName || 'Aventurero Matemático',
        email: user.email || '',
        photoURL: user.photoURL || '',
        updatedAt: Date.now(),
        progress: progressPayload
    };

    if (isInitialMigration) {
        docPayload.registeredAt = Date.now();
    }

    const userDocRef = doc(db, 'users', user.uid);
    await setDoc(userDocRef, docPayload, { merge: true });
}

/**
 * Concilia los datos locales y los de la nube tomando el mayor progreso
 */
function reconcileAndApplyProgress(cloudProgress) {
    if (!cloudProgress) return;
    const currentState = window.state || (window.MathQuestApp && window.MathQuestApp.state);
    if (!currentState) return;

    // Números acumulativos (conservar el mayor logro)
    currentState.streak = Math.max(currentState.streak || 1, cloudProgress.streak || 1);
    currentState.stars = Math.max(currentState.stars || 0, cloudProgress.stars || 0);
    currentState.coins = Math.max(currentState.coins || 0, cloudProgress.coins || 0);
    currentState.globalHints = Math.max(currentState.globalHints || 0, cloudProgress.globalHints || 0);
    currentState.userLevel = Math.max(currentState.userLevel || 1, cloudProgress.userLevel || 1);

    // Conjuntos y listas (unión sin duplicados)
    const baseSkins = ['standard'];
    const currentSkins = Array.isArray(currentState.unlockedSkins) ? currentState.unlockedSkins : baseSkins;
    const cloudSkins = Array.isArray(cloudProgress.unlockedSkins) ? cloudProgress.unlockedSkins : baseSkins;
    currentState.unlockedSkins = Array.from(new Set([...currentSkins, ...cloudSkins]));

    const baseLevels = ['snake-1', 'slider-1', 'tetris-1', 'arkanoid-1', 'sudoku-1', 'ahorcado-1', 'tres-1'];
    const currentLevels = Array.isArray(currentState.unlockedLevels) ? currentState.unlockedLevels : baseLevels;
    const cloudLevels = Array.isArray(cloudProgress.unlockedLevels) ? cloudProgress.unlockedLevels : baseLevels;
    currentState.unlockedLevels = Array.from(new Set([...currentLevels, ...cloudLevels]));

    // Pase VIP: Si está en la nube o local, conservarlo activo
    if (cloudProgress.vipBypassPurchased || currentState.vipBypassPurchased) {
        currentState.vipBypassPurchased = true;
    }

    // Inventario de potenciadores
    currentState.inventory = {
        shield: Math.max(currentState.inventory?.shield || 0, cloudProgress.inventory?.shield || 0),
        freeze: Math.max(currentState.inventory?.freeze || 0, cloudProgress.inventory?.freeze || 0)
    };

    // Personalización y preferencias equipadas
    if (cloudProgress.equippedAvatar) currentState.equippedAvatar = cloudProgress.equippedAvatar;
    if (cloudProgress.equippedSkin) currentState.equippedSkin = cloudProgress.equippedSkin;
    if (cloudProgress.equippedBadge) currentState.equippedBadge = cloudProgress.equippedBadge;

    // Persistir localmente de inmediato (sin borrar localStorage)
    if (typeof window.saveStateToStorage === 'function') {
        window.saveStateToStorage();
    }

    // Refrescar UI del juego
    if (typeof window.updateHeaderStats === 'function') {
        window.updateHeaderStats();
    }
    if (typeof window.renderDuolingoPath === 'function') {
        window.renderDuolingoPath();
    }
    if (typeof window.updateStreakCalendar === 'function') {
        window.updateStreakCalendar();
    }
    if (typeof window.renderAvatarSelectionUI === 'function') {
        window.renderAvatarSelectionUI();
    }
}

// --------------------------------------------------------------------------
// 5. Temporizador de Sincronización Automática (Debounced)
// --------------------------------------------------------------------------
let _syncDebounceTimer = null;
export function triggerDebouncedSync() {
    if (!currentUser || !db) return;
    if (_syncDebounceTimer) clearTimeout(_syncDebounceTimer);
    _syncDebounceTimer = setTimeout(() => {
        syncProgressToCloud();
    }, 2500);
}

// --------------------------------------------------------------------------
// 6. Manejador de Errores Amigables de Firebase
// --------------------------------------------------------------------------
function handleAuthError(error) {
    let msg = "No se pudo completar el inicio de sesión.";
    
    switch (error.code) {
        case 'auth/popup-closed-by-user':
            msg = "La ventana de Google se cerró antes de completar el inicio de sesión.";
            break;
        case 'auth/popup-blocked':
            msg = "El navegador bloqueó la ventana emergente. Por favor, permite las ventanas emergentes en la barra de direcciones.";
            break;
        case 'auth/cancelled-popup-request':
            msg = "Se canceló la solicitud de autenticación.";
            break;
        case 'auth/operation-not-allowed':
            msg = "El proveedor de Google no está habilitado todavía en Firebase Console. (Ve a Firebase Console > Authentication > Sign-in method > Habilita Google).";
            break;
        case 'auth/unauthorized-domain':
            msg = `Este dominio (${window.location.hostname}) debe agregarse a los dominios autorizados en Firebase Console > Authentication > Settings.`;
            break;
        default:
            msg = error.message || msg;
            break;
    }

    showAuthModalError(msg);
}

function showAuthModalError(msg) {
    const errBox = document.getElementById('auth-error-message');
    if (errBox) {
        errBox.textContent = msg;
        errBox.classList.remove('hidden');
    }
}

function clearAuthModalError() {
    const errBox = document.getElementById('auth-error-message');
    if (errBox) {
        errBox.textContent = '';
        errBox.classList.add('hidden');
    }
}

function setModalLoading(isLoading, msg = "Cargando...") {
    const btn = document.getElementById('btn-auth-google-login');
    if (btn) {
        btn.disabled = isLoading;
        if (isLoading) {
            btn.dataset.originalText = btn.innerHTML;
            btn.innerHTML = `<span class="auth-spinner">⏳</span> ${msg}`;
        } else if (btn.dataset.originalText) {
            btn.innerHTML = btn.dataset.originalText;
        }
    }
}

function showAppNotification(msg) {
    if (typeof window.showToast === 'function') {
        window.showToast(msg);
    } else {
        console.log("[MathQuest Auth]", msg);
    }
}

// --------------------------------------------------------------------------
// 7. Renderizado e Interfaz de Usuario de la Cuenta
// --------------------------------------------------------------------------

export function openAccountModal() {
    const modal = document.getElementById('account-modal');
    if (!modal) return;
    clearAuthModalError();
    renderAccountModalContent();
    modal.classList.remove('hidden');
}

export function closeAccountModal() {
    const modal = document.getElementById('account-modal');
    if (modal) modal.classList.add('hidden');
}

/**
 * Actualiza tanto el botón de la cabecera como el contenido del modal
 */
export function updateUI() {
    updateHeaderAccountBtn();
    renderAccountModalContent();
    updateSyncIndicator();

    // Notificar a observadores registrados
    authListeners.forEach(fn => {
        try { fn(currentUser); } catch (e) { console.error("Error en listener de auth:", e); }
    });
}

function updateHeaderAccountBtn() {
    const avatarImg = document.getElementById('account-avatar-img');
    const avatarIcon = document.getElementById('account-avatar-icon');
    const statusLabel = document.getElementById('account-header-status-label');
    const indicator = document.getElementById('account-sync-indicator');

    if (currentUser) {
        if (currentUser.photoURL && avatarImg) {
            avatarImg.src = currentUser.photoURL;
            avatarImg.classList.remove('hidden');
            if (avatarIcon) avatarIcon.classList.add('hidden');
        } else {
            if (avatarImg) avatarImg.classList.add('hidden');
            if (avatarIcon) {
                avatarIcon.classList.remove('hidden');
                avatarIcon.textContent = (currentUser.displayName ? currentUser.displayName[0].toUpperCase() : '👤');
            }
        }
        if (statusLabel) {
            const firstName = (currentUser.displayName || 'Mi Cuenta').split(' ')[0];
            statusLabel.textContent = firstName;
        }
        if (indicator) {
            indicator.className = 'account-sync-indicator online';
            indicator.title = 'Sesión iniciada con Google (Sincronizado)';
        }
    } else {
        if (avatarImg) avatarImg.classList.add('hidden');
        if (avatarIcon) {
            avatarIcon.classList.remove('hidden');
            avatarIcon.textContent = '👤';
        }
        if (statusLabel) statusLabel.textContent = 'Cuenta';
        if (indicator) {
            indicator.className = 'account-sync-indicator offline';
            indicator.title = 'Sin cuenta vinculada (Progreso solo local)';
        }
    }
}

function updateSyncIndicator() {
    const syncPill = document.getElementById('auth-sync-status-pill');
    const indicator = document.getElementById('account-sync-indicator');

    if (currentUser) {
        if (isSyncing) {
            if (syncPill) {
                syncPill.innerHTML = '🔄 Guardando en la nube...';
                syncPill.className = 'auth-status-pill syncing';
            }
            if (indicator) indicator.className = 'account-sync-indicator syncing';
        } else {
            if (syncPill) {
                const timeStr = lastSyncTimestamp ? new Date(lastSyncTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'reciente';
                syncPill.innerHTML = `🟢 Sincronizado (${timeStr})`;
                syncPill.className = 'auth-status-pill online';
            }
            if (indicator) indicator.className = 'account-sync-indicator online';
        }
    } else {
        if (syncPill) {
            syncPill.innerHTML = '⚪ Solo almacenamiento local';
            syncPill.className = 'auth-status-pill offline';
        }
        if (indicator) indicator.className = 'account-sync-indicator offline';
    }
}

function renderAccountModalContent() {
    const unauthView = document.getElementById('auth-unauthenticated-view');
    const authView = document.getElementById('auth-authenticated-view');

    if (!unauthView || !authView) return;

    if (currentUser) {
        unauthView.classList.add('hidden');
        authView.classList.remove('hidden');

        // Datos del usuario
        const photoEl = document.getElementById('auth-user-photo');
        const photoFallback = document.getElementById('auth-user-photo-fallback');
        const nameEl = document.getElementById('auth-user-name');
        const emailEl = document.getElementById('auth-user-email');
        const uidEl = document.getElementById('auth-user-uid');

        if (currentUser.photoURL && photoEl) {
            photoEl.src = currentUser.photoURL;
            photoEl.classList.remove('hidden');
            if (photoFallback) photoFallback.classList.add('hidden');
        } else {
            if (photoEl) photoEl.classList.add('hidden');
            if (photoFallback) {
                photoFallback.classList.remove('hidden');
                photoFallback.textContent = currentUser.displayName ? currentUser.displayName[0].toUpperCase() : 'M';
            }
        }

        if (nameEl) nameEl.textContent = currentUser.displayName || 'Aventurero Matemático';
        if (emailEl) emailEl.textContent = currentUser.email || 'Sin correo asociado';
        if (uidEl) uidEl.textContent = `ID: ${currentUser.uid.substring(0, 10)}...`;

        // Estadísticas de progreso actual
        const currentState = window.state || (window.MathQuestApp && window.MathQuestApp.state) || {};
        const statLevel = document.getElementById('auth-stat-level');
        const statStars = document.getElementById('auth-stat-stars');
        const statStreak = document.getElementById('auth-stat-streak');
        const statCoins = document.getElementById('auth-stat-coins');
        const statVip = document.getElementById('auth-stat-vip');

        if (statLevel) statLevel.textContent = currentState.userLevel ?? 1;
        if (statStars) statStars.textContent = currentState.stars ?? 0;
        if (statStreak) statStreak.textContent = `${currentState.streak ?? 1} días`;
        if (statCoins) statCoins.textContent = `${currentState.coins ?? 0} 🪙`;
        if (statVip) {
            statVip.textContent = currentState.vipBypassPurchased ? '👑 VIP Activo' : 'Estándar';
            statVip.style.color = currentState.vipBypassPurchased ? 'var(--color-accent-yellow)' : 'var(--color-text-muted)';
        }
    } else {
        unauthView.classList.remove('hidden');
        authView.classList.add('hidden');
    }
}

// --------------------------------------------------------------------------
// 8. Inicialización Automática de Eventos y Auth Listener
// --------------------------------------------------------------------------
function initAuth() {
    // Delegación y enlace de botones de la interfaz
    document.addEventListener('click', (e) => {
        // Abrir modal de cuenta
        if (e.target.closest('#btn-header-account, .btn-open-account-modal')) {
            e.preventDefault();
            openAccountModal();
            return;
        }

        // Cerrar modal
        if (e.target.closest('#btn-close-account-modal, #account-modal .modal-close-x')) {
            e.preventDefault();
            closeAccountModal();
            return;
        }

        // Clic en backdrop del modal
        if (e.target.id === 'account-modal') {
            closeAccountModal();
            return;
        }

        // Botón Iniciar Sesión con Google
        if (e.target.closest('#btn-auth-google-login')) {
            e.preventDefault();
            signInWithGoogle();
            return;
        }

        // Botón Cerrar Sesión
        if (e.target.closest('#btn-auth-logout')) {
            e.preventDefault();
            signOutUser();
            return;
        }

        // Botón Sincronizar Ahora
        if (e.target.closest('#btn-auth-sync-now')) {
            e.preventDefault();
            syncProgressToCloud(true);
            return;
        }
    });

    // Escuchador de cambios de sesión en Firebase
    if (auth) {
        onAuthStateChanged(auth, async (user) => {
            currentUser = user;
            if (user) {
                console.log("[MathQuest Auth] Sesión activa detectada para:", user.displayName || user.email);
                await loadOrMigrateUserProgress(user);
            } else {
                console.log("[MathQuest Auth] No hay sesión activa. Operando en modo local.");
            }
            updateUI();
        });
    }

    updateUI();
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuth);
} else {
    initAuth();
}

// Exponer en window para integración con app.js y compatibilidad universal
window.MathQuestAuth = {
    signInWithGoogle,
    signOutUser,
    getCurrentUser,
    syncProgressToCloud,
    triggerDebouncedSync,
    openAccountModal,
    closeAccountModal,
    onAuthStateChange,
    isReady: () => isFirebaseReady
};
