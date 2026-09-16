/* ==========================================================================
   MathQuest V3 - Módulo de Autenticación Unificada (Firebase Auth v12)
   Soporte completo para:
   - 🔵 Google Sign-In (Popup)
   - ✉️ Correo y Contraseña (Registro, Inicio de Sesión, Recuperación)
   - 📱 Teléfono vía SMS (RecaptchaVerifier + ConfirmationResult)
   - 🍏 Continuar con Apple (OAuthProvider)
   - 👥 Modo Invitado, Reconciliación de Cuentas y Manejo Amigable de Errores
   ========================================================================== */

import { 
    auth, 
    googleProvider, 
    appleProvider, 
    signInWithPopup, 
    signOut, 
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    updateProfile,
    RecaptchaVerifier,
    signInWithPhoneNumber,
    linkWithPopup
} from './firebase.js';

// Estado interno de autenticación
let currentUser = null;
let phoneConfirmationResult = null;
let recaptchaVerifier = null;
let currentAuthTab = 'login'; // 'login' | 'register' | 'forgot' | 'phone-step1' | 'phone-step2'

/**
 * Diccionario de traducción de códigos de error de Firebase Auth a español amigable
 */
const AUTH_ERROR_MESSAGES = {
    'auth/user-not-found': 'No existe ninguna cuenta asociada a este correo electrónico.',
    'auth/wrong-password': 'La contraseña ingresada es incorrecta. Intenta nuevamente.',
    'auth/invalid-credential': 'Credenciales incorrectas. Verifica tu correo y contraseña.',
    'auth/email-already-in-use': 'Ya existe una cuenta con este correo. Por favor inicia sesión.',
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
    'auth/invalid-email': 'El formato del correo electrónico no es válido.',
    'auth/popup-closed-by-user': 'El inicio de sesión fue cancelado (la ventana se cerró).',
    'auth/popup-blocked': 'Tu navegador bloqueó la ventana emergente. Por favor permítela para continuar.',
    'auth/operation-not-allowed': 'Este método de autenticación aún no está habilitado en Firebase Console.',
    'auth/invalid-phone-number': 'Número de teléfono no válido. Debe incluir el prefijo internacional (ejemplo: +34 612345678 o +51 987654321).',
    'auth/missing-phone-number': 'Por favor introduce un número de teléfono válido.',
    'auth/invalid-verification-code': 'El código SMS de 6 dígitos es incorrecto. Verifícalo e inténtalo de nuevo.',
    'auth/code-expired': 'El código SMS ha expirado. Por favor solicita uno nuevo.',
    'auth/too-many-requests': 'Demasiados intentos fallidos. Por seguridad, espera unos minutos.',
    'auth/network-request-failed': 'Error de conexión a internet. Comprueba tu red.',
    'auth/account-exists-with-different-credential': 'Ya existe una cuenta con este correo pero con otro método de acceso.',
    'auth/captcha-check-failed': 'La verificación del reCAPTCHA falló o expiró. Inténtalo de nuevo.'
};

function getFriendlyErrorMessage(err) {
    if (!err) return 'Ocurrió un error inesperado. Inténtalo de nuevo.';
    return AUTH_ERROR_MESSAGES[err.code] || err.message || 'Error de autenticación. Intenta nuevamente.';
}

/**
 * Mostrar mensaje de error en la UI de autenticación
 * @param {string} message 
 */
function showAuthError(message) {
    const errorBox = document.getElementById('auth-error-message');
    if (errorBox) {
        errorBox.textContent = message;
        errorBox.classList.remove('hidden');
    }
}

/**
 * Limpiar mensaje de error
 */
function clearAuthError() {
    const errorBox = document.getElementById('auth-error-message');
    if (errorBox) {
        errorBox.textContent = '';
        errorBox.classList.add('hidden');
    }
}

/**
 * Mostrar toast o notificación en pantalla
 * @param {string} message 
 */
function showToast(message) {
    const toast = document.getElementById('app-toast');
    if (toast) {
        toast.textContent = message;
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 3500);
    }
}

// --------------------------------------------------------------------------
// 1. Métodos de Inicio de Sesión / Registro
// --------------------------------------------------------------------------

/**
 * Iniciar sesión con Google
 */
export async function loginWithGoogle() {
    clearAuthError();
    const btn = document.getElementById('btn-auth-google-login');
    if (btn) btn.disabled = true;

    try {
        const result = await signInWithPopup(auth, googleProvider);
        console.log("✓ Autenticado con Google:", result.user.displayName);
        closeAccountModal();
        showToast(`¡Bienvenido de vuelta, ${result.user.displayName || 'Aventurero'}! 🚀`);
    } catch (err) {
        console.error("Error al autenticar con Google:", err);
        showAuthError(getFriendlyErrorMessage(err));
    } finally {
        if (btn) btn.disabled = false;
    }
}

/**
 * Iniciar sesión con Apple
 */
export async function loginWithApple() {
    clearAuthError();
    const btn = document.getElementById('btn-auth-apple-login');
    if (btn) btn.disabled = true;

    try {
        const result = await signInWithPopup(auth, appleProvider);
        console.log("✓ Autenticado con Apple:", result.user.displayName || result.user.email);
        closeAccountModal();
        showToast(`¡Bienvenido, ${result.user.displayName || 'Aventurero'}! 🍏`);
    } catch (err) {
        console.error("Error al autenticar con Apple:", err);
        showAuthError(getFriendlyErrorMessage(err));
    } finally {
        if (btn) btn.disabled = false;
    }
}

/**
 * Iniciar sesión con Correo y Contraseña
 * @param {string} email 
 * @param {string} password 
 */
export async function loginWithEmail(email, password) {
    clearAuthError();
    if (!email || !password) {
        showAuthError('Por favor ingresa tu correo y contraseña.');
        return;
    }

    const submitBtn = document.getElementById('btn-submit-email-login');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Iniciando sesión...';
    }

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
        console.log("✓ Autenticado con correo:", userCredential.user.email);
        closeAccountModal();
        showToast(`¡Sesión iniciada correctamente! 🎒`);
    } catch (err) {
        console.error("Error al iniciar sesión con correo:", err);
        showAuthError(getFriendlyErrorMessage(err));
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Iniciar Sesión';
        }
    }
}

/**
 * Registrar nueva cuenta con Correo y Contraseña
 * @param {string} displayName 
 * @param {string} email 
 * @param {string} password 
 */
export async function registerWithEmail(displayName, email, password) {
    clearAuthError();
    if (!email || !password) {
        showAuthError('Por favor completa todos los campos.');
        return;
    }

    if (password.length < 6) {
        showAuthError('La contraseña debe contener al menos 6 caracteres.');
        return;
    }

    const submitBtn = document.getElementById('btn-submit-email-register');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creando cuenta...';
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        
        // Asignar nombre de usuario personalizado
        const trimmedName = (displayName && displayName.trim()) ? displayName.trim() : email.split('@')[0];
        try {
            await updateProfile(userCredential.user, {
                displayName: trimmedName
            });
        } catch (pErr) {
            console.warn("Aviso al actualizar perfil:", pErr);
        }

        userCredential.user.displayName = trimmedName;
        currentUser = userCredential.user;
        updateHeaderAccountButton(currentUser);

        console.log("✓ Cuenta creada con éxito:", userCredential.user.email);
        closeAccountModal();
        showToast(`¡Bienvenido a MathQuest, ${trimmedName}! 🌟`);

        // Sincronizar de inmediato el progreso inicial
        if (window.MathQuestCloudSave) {
            window.MathQuestCloudSave.saveUserProgress(userCredential.user, { force: true });
        }
    } catch (err) {
        console.error("Error al crear cuenta:", err);
        showAuthError(getFriendlyErrorMessage(err));
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Crear Cuenta';
        }
    }
}

/**
 * Enviar correo de restablecimiento de contraseña
 * @param {string} email 
 */
export async function sendPasswordReset(email) {
    clearAuthError();
    if (!email || !email.includes('@')) {
        showAuthError('Por favor introduce un correo electrónico válido.');
        return;
    }

    const submitBtn = document.getElementById('btn-submit-forgot-password');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Enviando...';
    }

    try {
        await sendPasswordResetEmail(auth, email.trim());
        showToast('✉️ Correo de recuperación enviado. Revisa tu bandeja de entrada.');
        switchAuthTab('login');
    } catch (err) {
        console.error("Error al solicitar recuperación de contraseña:", err);
        showAuthError(getFriendlyErrorMessage(err));
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Enviar Enlace de Recuperación';
        }
    }
}

// --------------------------------------------------------------------------
// 2. Autenticación con Teléfono y SMS (Phone Auth)
// --------------------------------------------------------------------------

/**
 * Inicializar reCAPTCHA invisible para Phone Auth
 */
function initRecaptchaVerifier() {
    if (recaptchaVerifier) return recaptchaVerifier;

    const container = document.getElementById('recaptcha-container');
    if (!container) return null;

    try {
        recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
            size: 'normal',
            callback: () => {
                clearAuthError();
            },
            'expired-callback': () => {
                showAuthError('La verificación de seguridad ha expirado. Vuelve a intentarlo.');
            }
        });
        recaptchaVerifier.render();
    } catch (err) {
        console.warn("Aviso al inicializar RecaptchaVerifier:", err);
    }
    return recaptchaVerifier;
}

/**
 * Paso 1 Teléfono: Enviar código SMS al número indicado
 * @param {string} phoneNumber 
 */
export async function sendPhoneVerificationCode(phoneNumber) {
    clearAuthError();
    if (!phoneNumber || phoneNumber.trim().length < 7) {
        showAuthError('Introduce un número de teléfono con código de país (ejemplo: +34600112233).');
        return;
    }

    const submitBtn = document.getElementById('btn-send-phone-code');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Enviando SMS...';
    }

    try {
        const verifier = initRecaptchaVerifier();
        phoneConfirmationResult = await signInWithPhoneNumber(auth, phoneNumber.trim(), verifier);
        console.log("✓ SMS de verificación enviado.");
        
        // Mostrar número en la pantalla de verificación
        const displayPhone = document.getElementById('phone-number-target-display');
        if (displayPhone) displayPhone.textContent = phoneNumber.trim();

        switchAuthTab('phone-step2');
        showToast('📱 Código SMS enviado a tu teléfono');
    } catch (err) {
        console.error("Error al enviar SMS de verificación:", err);
        showAuthError(getFriendlyErrorMessage(err));
        // Resetear recaptcha si falló
        if (recaptchaVerifier) {
            try { recaptchaVerifier.clear(); } catch(e) {}
            recaptchaVerifier = null;
        }
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Enviar Código por SMS';
        }
    }
}

/**
 * Paso 2 Teléfono: Confirmar código SMS de 6 dígitos
 * @param {string} smsCode 
 */
export async function verifyPhoneCode(smsCode) {
    clearAuthError();
    if (!phoneConfirmationResult) {
        showAuthError('Sesión de verificación expirada. Solicita un nuevo código.');
        switchAuthTab('phone-step1');
        return;
    }

    if (!smsCode || smsCode.trim().length < 6) {
        showAuthError('Introduce el código de 6 dígitos recibido por SMS.');
        return;
    }

    const submitBtn = document.getElementById('btn-verify-sms-code');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Verificando...';
    }

    try {
        const userCredential = await phoneConfirmationResult.confirm(smsCode.trim());
        console.log("✓ Teléfono verificado con éxito:", userCredential.user.phoneNumber);
        closeAccountModal();
        showToast('¡Teléfono verificado! Sesión iniciada 📱');
    } catch (err) {
        console.error("Error al verificar código SMS:", err);
        showAuthError(getFriendlyErrorMessage(err));
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Confirmar e Iniciar Sesión';
        }
    }
}

/**
 * Cerrar sesión
 */
export async function logoutUser() {
    try {
        await signOut(auth);
        console.log("Sesión de usuario cerrada con éxito.");
        if (window.MathQuestCloudSave) {
            window.MathQuestCloudSave.handleUserLogout();
        }
        closeAccountModal();
        showToast('Has cerrado sesión correctamente. Modo Invitado activo 👤');
    } catch (err) {
        console.error("Error al cerrar sesión:", err);
        showToast('Error al cerrar sesión. Inténtalo de nuevo.');
    }
}

// --------------------------------------------------------------------------
// 3. Control y Navegación de la Interfaz del Modal de Cuenta
// --------------------------------------------------------------------------

/**
 * Cambiar entre pestañas y vistas del modal
 * @param {'login' | 'register' | 'forgot' | 'phone-step1' | 'phone-step2'} tabName 
 */
export function switchAuthTab(tabName) {
    currentAuthTab = tabName;
    clearAuthError();

    const tabsNav = document.getElementById('auth-tabs-nav');
    const tabBtnLogin = document.getElementById('tab-btn-login');
    const tabBtnRegister = document.getElementById('tab-btn-register');

    const viewLogin = document.getElementById('auth-form-login-view');
    const viewRegister = document.getElementById('auth-form-register-view');
    const viewForgot = document.getElementById('auth-form-forgot-view');
    const viewPhone1 = document.getElementById('auth-form-phone1-view');
    const viewPhone2 = document.getElementById('auth-form-phone2-view');

    // Ocultar todas las vistas de formularios
    [viewLogin, viewRegister, viewForgot, viewPhone1, viewPhone2].forEach(v => {
        if (v) v.classList.add('hidden');
    });

    if (tabBtnLogin && tabBtnRegister) {
        tabBtnLogin.classList.toggle('active', tabName === 'login');
        tabBtnRegister.classList.toggle('active', tabName === 'register');
    }

    if (tabsNav) {
        // Ocultar barra de pestañas si está en forgot o phone para no confundir
        tabsNav.classList.toggle('hidden', tabName === 'forgot' || tabName.startsWith('phone'));
    }

    switch (tabName) {
        case 'login':
            if (viewLogin) viewLogin.classList.remove('hidden');
            break;
        case 'register':
            if (viewRegister) viewRegister.classList.remove('hidden');
            break;
        case 'forgot':
            if (viewForgot) viewForgot.classList.remove('hidden');
            break;
        case 'phone-step1':
            if (viewPhone1) {
                viewPhone1.classList.remove('hidden');
                setTimeout(initRecaptchaVerifier, 100);
            }
            break;
        case 'phone-step2':
            if (viewPhone2) viewPhone2.classList.remove('hidden');
            break;
    }
}

/**
 * Abrir el modal de cuenta
 */
export function openAccountModal() {
    const modal = document.getElementById('account-modal');
    if (!modal) return;

    modal.classList.remove('hidden');
    clearAuthError();

    if (currentUser) {
        // Usuario autenticado -> Mostrar datos de perfil y estadísticas
        renderAuthenticatedProfile(currentUser);
    } else {
        // Invitado -> Mostrar formulario de acceso
        document.getElementById('auth-unauthenticated-view')?.classList.remove('hidden');
        document.getElementById('auth-authenticated-view')?.classList.add('hidden');
        switchAuthTab('login');
    }
}

/**
 * Cerrar el modal de cuenta
 */
export function closeAccountModal() {
    const modal = document.getElementById('account-modal');
    if (modal) modal.classList.add('hidden');
    clearAuthError();
}

/**
 * Renderizar la vista de usuario autenticado
 * @param {Object} user 
 */
function renderAuthenticatedProfile(user) {
    const unauthView = document.getElementById('auth-unauthenticated-view');
    const authView = document.getElementById('auth-authenticated-view');

    if (unauthView) unauthView.classList.add('hidden');
    if (authView) authView.classList.remove('hidden');

    const nameEl = document.getElementById('auth-user-name');
    const emailEl = document.getElementById('auth-user-email');
    const uidEl = document.getElementById('auth-user-uid');
    const photoEl = document.getElementById('auth-user-photo');
    const photoFallbackEl = document.getElementById('auth-user-photo-fallback');

    const displayName = user.displayName || user.email?.split('@')[0] || user.phoneNumber || 'Aventurero Matemático';
    if (nameEl) nameEl.textContent = displayName;
    if (emailEl) emailEl.textContent = user.email || user.phoneNumber || 'Cuenta vinculada';
    if (uidEl) uidEl.textContent = `UID: ${user.uid.substring(0, 10)}...`;

    if (user.photoURL && photoEl && photoFallbackEl) {
        photoEl.src = user.photoURL;
        photoEl.classList.remove('hidden');
        photoFallbackEl.classList.add('hidden');
    } else if (photoEl && photoFallbackEl) {
        photoEl.classList.add('hidden');
        photoFallbackEl.textContent = displayName.charAt(0).toUpperCase();
        photoFallbackEl.classList.remove('hidden');
    }

    // Refrescar estadísticas del resumen
    const s = window.state || {};
    const lvl = document.getElementById('auth-stat-level');
    const stars = document.getElementById('auth-stat-stars');
    const streak = document.getElementById('auth-stat-streak');
    const coins = document.getElementById('auth-stat-coins');
    const vip = document.getElementById('auth-stat-vip');

    if (lvl) lvl.textContent = s.userLevel || 1;
    if (stars) stars.textContent = s.stars || 0;
    if (streak) streak.textContent = `${s.streak || 1} días`;
    if (coins) coins.textContent = s.coins || 150;
    if (vip) {
        if (s.isRealVip || (window.MathQuestVIP && typeof window.MathQuestVIP.isIndividualVip === 'function' && window.MathQuestVIP.isIndividualVip())) {
            vip.textContent = '⭐ VIP Confirmado (Nube)';
            vip.style.color = '#10b981';
        } else if (s.isGlobalVip || (window.MathQuestVIP && typeof window.MathQuestVIP.isGlobalVip === 'function' && window.MathQuestVIP.isGlobalVip())) {
            vip.textContent = '🌐 VIP Global Activo (Todos)';
            vip.style.color = '#3b82f6';
        } else if (s.vipBypassPurchased) {
            vip.textContent = '👑 VIP Local (Sin vincular)';
            vip.style.color = '#f59e0b';
        } else {
            vip.textContent = 'Estándar';
            vip.style.color = 'inherit';
        }
    }
}

/**
 * Actualizar el botón y estado en la barra de cabecera principal
 * @param {Object|null} user 
 */
function updateHeaderAccountButton(user) {
    const avatarIcon = document.getElementById('account-avatar-icon');
    const avatarImg = document.getElementById('account-avatar-img');
    const label = document.getElementById('account-header-status-label');
    const indicator = document.getElementById('account-sync-indicator');

    if (user) {
        const displayName = user.displayName || user.email?.split('@')[0] || 'Jugador';
        if (label) label.textContent = displayName.split(' ')[0];

        if (user.photoURL && avatarImg && avatarIcon) {
            avatarImg.src = user.photoURL;
            avatarImg.classList.remove('hidden');
            avatarIcon.classList.add('hidden');
        } else if (avatarIcon && avatarImg) {
            avatarImg.classList.add('hidden');
            avatarIcon.textContent = displayName.charAt(0).toUpperCase();
            avatarIcon.classList.remove('hidden');
        }

        if (indicator) {
            indicator.className = 'account-sync-indicator online';
            indicator.title = 'Sesión iniciada - Progreso conectado a la nube';
        }
    } else {
        if (label) label.textContent = 'Cuenta';
        if (avatarIcon && avatarImg) {
            avatarImg.classList.add('hidden');
            avatarIcon.textContent = '👤';
            avatarIcon.classList.remove('hidden');
        }
        if (indicator) {
            indicator.className = 'account-sync-indicator offline';
            indicator.title = 'Modo Invitado (Almacenamiento Local)';
        }
    }
}

// --------------------------------------------------------------------------
// 4. Inicialización de Listeners y Eventos de UI
// --------------------------------------------------------------------------

function setupAuthEventListeners() {
    // Abrir modal desde el botón de la cabecera
    const btnHeader = document.getElementById('btn-header-account');
    if (btnHeader) {
        btnHeader.addEventListener('click', () => {
            window.SoundEngine?.playClick?.();
            openAccountModal();
        });
    }

    // Cerrar modal con la X o clic fuera
    const btnClose = document.getElementById('btn-close-account-modal');
    if (btnClose) {
        btnClose.addEventListener('click', () => {
            window.SoundEngine?.playClick?.();
            closeAccountModal();
        });
    }

    const modalOverlay = document.getElementById('account-modal');
    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                closeAccountModal();
            }
        });
    }

    // Pestañas Iniciar Sesión / Registrarse
    document.getElementById('tab-btn-login')?.addEventListener('click', () => switchAuthTab('login'));
    document.getElementById('tab-btn-register')?.addEventListener('click', () => switchAuthTab('register'));

    // Botones de Proveedores Sociales
    document.getElementById('btn-auth-google-login')?.addEventListener('click', () => {
        window.SoundEngine?.playClick?.();
        loginWithGoogle();
    });

    document.getElementById('btn-auth-apple-login')?.addEventListener('click', () => {
        window.SoundEngine?.playClick?.();
        loginWithApple();
    });

    // Formulario de Inicio de Sesión con Correo
    const formLogin = document.getElementById('form-email-login');
    if (formLogin) {
        formLogin.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('input-login-email')?.value;
            const password = document.getElementById('input-login-password')?.value;
            loginWithEmail(email, password);
        });
    }

    // Formulario de Registro con Correo
    const formRegister = document.getElementById('form-email-register');
    if (formRegister) {
        formRegister.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('input-register-name')?.value;
            const email = document.getElementById('input-register-email')?.value;
            const password = document.getElementById('input-register-password')?.value;
            registerWithEmail(name, email, password);
        });
    }

    // Enlace "¿Olvidaste tu contraseña?" y formulario de recuperación
    document.getElementById('link-goto-forgot-password')?.addEventListener('click', (e) => {
        e.preventDefault();
        switchAuthTab('forgot');
    });

    document.getElementById('link-back-to-login-from-forgot')?.addEventListener('click', (e) => {
        e.preventDefault();
        switchAuthTab('login');
    });

    const formForgot = document.getElementById('form-forgot-password');
    if (formForgot) {
        formForgot.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('input-forgot-email')?.value;
            sendPasswordReset(email);
        });
    }

    // Navegación hacia Teléfono
    document.getElementById('btn-goto-phone-auth')?.addEventListener('click', () => switchAuthTab('phone-step1'));
    document.getElementById('link-back-to-login-from-phone')?.addEventListener('click', (e) => {
        e.preventDefault();
        switchAuthTab('login');
    });

    // Paso 1 Teléfono
    const formPhone1 = document.getElementById('form-phone-step1');
    if (formPhone1) {
        formPhone1.addEventListener('submit', (e) => {
            e.preventDefault();
            const phone = document.getElementById('input-phone-number')?.value;
            sendPhoneVerificationCode(phone);
        });
    }

    // Paso 2 Teléfono
    const formPhone2 = document.getElementById('form-phone-step2');
    if (formPhone2) {
        formPhone2.addEventListener('submit', (e) => {
            e.preventDefault();
            const code = document.getElementById('input-sms-code')?.value;
            verifyPhoneCode(code);
        });
    }

    document.getElementById('btn-phone-resend-code')?.addEventListener('click', () => {
        switchAuthTab('phone-step1');
    });

    // Forzar sincronización manual
    document.getElementById('btn-auth-sync-now')?.addEventListener('click', async () => {
        if (!currentUser) return;
        window.SoundEngine?.playClick?.();
        const btn = document.getElementById('btn-auth-sync-now');
        if (btn) btn.disabled = true;
        await window.MathQuestCloudSave?.saveUserProgress?.(currentUser, { force: true });
        showToast('✓ ¡Progreso sincronizado en la nube!');
        if (btn) btn.disabled = false;
    });

    // Cerrar sesión
    document.getElementById('btn-auth-logout')?.addEventListener('click', () => {
        window.SoundEngine?.playClick?.();
        logoutUser();
    });
}

// --------------------------------------------------------------------------
// 5. Listener de Autenticación de Firebase (Fuente Única de Verdad)
// --------------------------------------------------------------------------

onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    updateHeaderAccountButton(user);

    if (user) {
        console.log("👤 Usuario autenticado en MathQuest (UID):", user.uid);
        // Activar listener de VIP en tiempo real para este UID
        if (window.MathQuestVIP?.setupFirestoreVipListener) {
            window.MathQuestVIP.setupFirestoreVipListener(user.uid);
        }
        // Cargar progreso del usuario y reconciliar inteligentemente
        if (window.MathQuestCloudSave) {
            await window.MathQuestCloudSave.loadUserProgress(user);
        }
    } else {
        console.log("⚪ Modo Invitado activo en MathQuest.");
        if (window.MathQuestVIP?.teardownFirestoreVipListener) {
            window.MathQuestVIP.teardownFirestoreVipListener();
        }
        if (window.MathQuestCloudSave) {
            window.MathQuestCloudSave.handleUserLogout();
        }
    }
});

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupAuthEventListeners);
} else {
    setupAuthEventListeners();
}

// Exponer en window para integración con app.js
window.MathQuestAuth = {
    getCurrentUser: () => currentUser,
    openAccountModal,
    closeAccountModal,
    loginWithGoogle,
    loginWithApple,
    loginWithEmail,
    registerWithEmail,
    sendPasswordReset,
    sendPhoneVerificationCode,
    verifyPhoneCode,
    logoutUser,
    switchAuthTab,
    triggerDebouncedSync: () => {
        if (window.MathQuestCloudSave) {
            window.MathQuestCloudSave.triggerDebouncedSave();
        }
    }
};
