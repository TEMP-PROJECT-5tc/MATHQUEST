/**
 * MathQuest VIP Payment System (Culqi / Yape Integration)
 * 
 * Flujo:
 * Firebase Auth UID -> Backend API /api/payments/yape/create-charge -> Culqi API -> Webhook -> Firestore users/{uid}/vip -> MathQuest VIP Activado
 */

import { doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { db, auth } from './firebase.js';

export const VIP_CONFIG = {
    productId: 'mathquest-vip',
    productName: 'MathQuest VIP',
    priceDisplay: 'S/ 19.90',
    priceCents: 1990,
    currency: 'PEN',
    sandbox: true
};

let currentVipState = {
    active: false,
    productId: 'mathquest-vip',
    purchasedAt: null,
    paymentId: null,
    method: null,
    isLegacyLocal: false
};

let firestoreUnsubscribe = null;
let isProcessingPayment = false;

/**
 * Inicializar el sistema de pagos VIP
 */
export async function initVipPaymentSystem() {
    console.log("💳 Inicializando sistema de pagos MathQuest VIP...");

    // Cargar configuración pública desde el backend
    await loadBackendConfig();

    // Renderizar tarjeta VIP en la tienda
    renderShopVipCard();

    // Configurar listeners de la interfaz
    setupVipUiListeners();

    // Escuchar cambios de autenticación para vincular el listener de Firestore
    if (typeof window.MathQuestAuth !== 'undefined') {
        const currentUser = window.MathQuestAuth.getCurrentUser();
        if (currentUser) {
            setupFirestoreVipListener(currentUser.uid);
        }
    }

    // Exportar API global
    window.MathQuestVIP = {
        openCheckoutModal,
        closeCheckoutModal,
        checkVipStatus,
        processYapePayment,
        simulateSandboxScenario,
        renderShopVipCard,
        getVipState: () => ({ ...currentVipState })
    };
}

/**
 * Cargar configuración pública desde /api/payments/config
 */
async function loadBackendConfig() {
    try {
        const res = await fetch('/api/payments/config');
        if (res.ok) {
            const data = await res.json();
            if (data.priceDisplay) VIP_CONFIG.priceDisplay = data.priceDisplay;
            if (data.priceCents) VIP_CONFIG.priceCents = data.priceCents;
            if (data.currency) VIP_CONFIG.currency = data.currency;
            if (data.sandbox !== undefined) VIP_CONFIG.sandbox = data.sandbox;
            console.log("✓ Configuración de pagos cargada:", VIP_CONFIG.priceDisplay, data.sandbox ? '(Sandbox Test)' : '(Producción)');
        }
    } catch (e) {
        console.warn("Aviso al consultar /api/payments/config, usando valores predeterminados:", e.message);
    }
}

/**
 * Escuchar cambios en Firestore en tiempo real para users/{uid}
 * Cuando el webhook o backend active el VIP, el juego se actualiza automáticamente.
 */
export function setupFirestoreVipListener(uid) {
    if (firestoreUnsubscribe) {
        firestoreUnsubscribe();
        firestoreUnsubscribe = null;
    }

    if (!uid) return;

    try {
        const userDocRef = doc(db, 'users', uid);
        firestoreUnsubscribe = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data && data.vip && data.vip.active === true) {
                    currentVipState = {
                        active: true,
                        productId: data.vip.productId || 'mathquest-vip',
                        purchasedAt: data.vip.purchasedAt || null,
                        paymentId: data.vip.paymentId || null,
                        method: data.vip.method || 'yape',
                        isLegacyLocal: false
                    };

                    // Aplicar estado VIP al juego
                    applyConfirmedVipToApp();
                } else {
                    // Verificar si tenía bypass local legacy
                    const isLocalBypass = Boolean(window.state && window.state.vipBypassPurchased);
                    currentVipState = {
                        active: false,
                        productId: 'mathquest-vip',
                        purchasedAt: null,
                        paymentId: null,
                        method: null,
                        isLegacyLocal: isLocalBypass
                    };
                }
            }
            renderShopVipCard();
            updateHeaderVipBadge();
        }, (err) => {
            console.warn("Aviso en listener de Firestore VIP:", err.message);
        });
    } catch (e) {
        console.warn("No se pudo iniciar listener de Firestore VIP:", e.message);
    }
}

/**
 * Desconectar listener al cerrar sesión
 */
export function teardownFirestoreVipListener() {
    if (firestoreUnsubscribe) {
        firestoreUnsubscribe();
        firestoreUnsubscribe = null;
    }
    const isLocalBypass = Boolean(window.state && window.state.vipBypassPurchased);
    currentVipState = {
        active: false,
        productId: 'mathquest-vip',
        purchasedAt: null,
        paymentId: null,
        method: null,
        isLegacyLocal: isLocalBypass
    };
    renderShopVipCard();
    updateHeaderVipBadge();
}

/**
 * Aplicar estado VIP confirmado por el backend a la aplicación MathQuest
 */
function applyConfirmedVipToApp() {
    if (!window.state) window.state = {};
    window.state.vipBypassPurchased = true;
    window.state.isRealVip = true;
    window.state.vip = { ...currentVipState };

    // Desbloquear todos los 55 niveles de los 11 juegos
    const games = ['snake', 'slider', 'rush', 'tetris', 'arkanoid', 'builder', 'sudoku', 'ahorcado', 'tres', 'escape', 'duel'];
    if (!Array.isArray(window.state.unlockedLevels)) {
        window.state.unlockedLevels = [];
    }

    games.forEach(g => {
        for (let l = 1; l <= 5; l++) {
            const key = `${g}-${l}`;
            if (!window.state.unlockedLevels.includes(key)) {
                window.state.unlockedLevels.push(key);
            }
        }
    });

    if (typeof window.saveStateToStorage === 'function') {
        window.saveStateToStorage();
    }
    if (typeof window.updateHeaderStats === 'function') {
        window.updateHeaderStats();
    }
    if (typeof window.renderDuolingoPath === 'function') {
        window.renderDuolingoPath();
    }
    renderShopVipCard();
    updateHeaderVipBadge();
}

/**
 * Actualizar botón VIP en el header
 */
function updateHeaderVipBadge() {
    const btnVipHeader = document.getElementById('btn-header-bypass-vip');
    if (!btnVipHeader) return;

    if (currentVipState.active) {
        btnVipHeader.innerHTML = "⭐ VIP Activo";
        btnVipHeader.style.background = "linear-gradient(135deg, #10b981 0%, #059669 100%)";
        btnVipHeader.style.borderColor = "#047857";
        btnVipHeader.style.boxShadow = "0 0 12px rgba(16, 185, 129, 0.4)";
    } else if (currentVipState.isLegacyLocal) {
        btnVipHeader.innerHTML = "👑 VIP Local";
        btnVipHeader.style.background = "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)";
        btnVipHeader.style.borderColor = "#b45309";
    } else {
        btnVipHeader.innerHTML = "👑 VIP";
        btnVipHeader.style.background = "linear-gradient(135deg, #f59e0b 0%, #b45309 100%)";
    }
}

/**
 * Renderizar la tarjeta destacada de MathQuest VIP dentro de la tienda
 */
export function renderShopVipCard() {
    const container = document.getElementById('vip-shop-action-container');
    if (!container) return;

    const currentUser = auth.currentUser || (window.MathQuestAuth && window.MathQuestAuth.getCurrentUser());

    // Caso 1: Usuario ya tiene VIP confirmado en Firestore
    if (currentVipState.active) {
        const dateStr = currentVipState.purchasedAt 
            ? new Date(currentVipState.purchasedAt).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
            : 'Permanente';

        container.innerHTML = `
            <div class="vip-status-active-badge">
                <div class="vip-active-chip">
                    <span>⭐</span>
                    <strong>VIP ACTIVO</strong>
                </div>
                <div class="vip-active-details">
                    <p>¡Membresía confirmada y vinculada a tu cuenta de MathQuest!</p>
                    <span class="vip-active-meta">ID de Pago: ${currentVipState.paymentId || 'Verificado'} • Fecha: ${dateStr}</span>
                </div>
            </div>
        `;
        return;
    }

    // Caso 2: Usuario no ha iniciado sesión
    if (!currentUser) {
        container.innerHTML = `
            <div class="vip-guest-callout">
                <div class="vip-price-tag">
                    <span class="vip-price-currency">Precio:</span>
                    <span class="vip-price-amount">${VIP_CONFIG.priceDisplay}</span>
                    <span class="vip-price-period">/ Pago único</span>
                </div>
                <button class="btn btn-primary btn-vip-cta" id="btn-shop-vip-login">
                    🔒 Inicia sesión para comprar VIP
                </button>
                <span class="vip-security-note">El estado VIP se asocia de forma permanente a tu cuenta en la nube.</span>
            </div>
        `;

        document.getElementById('btn-shop-vip-login')?.addEventListener('click', () => {
            window.SoundEngine?.playClick?.();
            if (window.MathQuestAuth?.openAccountModal) {
                window.MathQuestAuth.openAccountModal();
            }
        });
        return;
    }

    // Caso 3: Usuario autenticado SIN VIP (Listo para comprar)
    const isLegacy = currentVipState.isLegacyLocal;
    const legacyNotice = isLegacy 
        ? `<div class="vip-legacy-notice">⚠️ Tienes un acceso temporal local previo. Cómpralo con Yape para sincronizarlo permanentemente en tu cuenta de Firebase y todos tus dispositivos.</div>` 
        : '';

    container.innerHTML = `
        ${legacyNotice}
        <div class="vip-authenticated-checkout-row">
            <div class="vip-price-tag">
                <span class="vip-price-label">Acceso Total Permanente:</span>
                <span class="vip-price-amount">${VIP_CONFIG.priceDisplay}</span>
                <span class="vip-price-period">PEN (Yape)</span>
            </div>
            <button class="btn btn-primary btn-vip-cta pulse-subtle" id="btn-shop-buy-vip-yape">
                📱 Comprar VIP con Yape (${VIP_CONFIG.priceDisplay})
            </button>
        </div>
        <div class="vip-security-row">
            <span>🔒 Transacción segura procesada vía pasarela Culqi & Yape</span>
            <span>⚡ Activación instantánea en tu cuenta (${currentUser.email || currentUser.displayName || 'UID: ' + currentUser.uid.substring(0, 6)})</span>
        </div>
    `;

    document.getElementById('btn-shop-buy-vip-yape')?.addEventListener('click', () => {
        window.SoundEngine?.playClick?.();
        openCheckoutModal();
    });
}

/**
 * Configurar listeners de la interfaz modal de checkout
 */
function setupVipUiListeners() {
    // Botón cerrar modal
    document.getElementById('btn-close-vip-checkout-modal')?.addEventListener('click', () => {
        window.SoundEngine?.playClick?.();
        closeCheckoutModal();
    });

    // Cambiar pestañas del modal (Yape Oficial vs Simulador Sandbox)
    document.getElementById('tab-vip-yape-official')?.addEventListener('click', () => {
        window.SoundEngine?.playClick?.();
        switchCheckoutTab('yape');
    });

    document.getElementById('tab-vip-sandbox-test')?.addEventListener('click', () => {
        window.SoundEngine?.playClick?.();
        switchCheckoutTab('sandbox');
    });

    // Formulario de Pago con Yape
    const yapeForm = document.getElementById('form-yape-payment');
    if (yapeForm) {
        yapeForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const phone = document.getElementById('yape-phone-input')?.value || '';
            const otp = document.getElementById('yape-otp-input')?.value || '';
            processYapePayment({ phoneNumber: phone, otp: otp });
        });
    }

    // Formateador automático de teléfono (9 dígitos)
    const phoneInput = document.getElementById('yape-phone-input');
    if (phoneInput) {
        phoneInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '').substring(0, 9);
        });
    }

    // Formateador automático de OTP (6 dígitos)
    const otpInput = document.getElementById('yape-otp-input');
    if (otpInput) {
        otpInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '').substring(0, 6);
        });
    }

    // Botones del Simulador Sandbox (para probar los 5 escenarios sin dinero real)
    document.getElementById('btn-sandbox-test-success')?.addEventListener('click', () => {
        simulateSandboxScenario('success');
    });

    document.getElementById('btn-sandbox-test-rejected')?.addEventListener('click', () => {
        simulateSandboxScenario('rejected');
    });

    document.getElementById('btn-sandbox-test-pending')?.addEventListener('click', () => {
        simulateSandboxScenario('pending');
    });

    document.getElementById('btn-sandbox-test-canceled')?.addEventListener('click', () => {
        simulateSandboxScenario('canceled');
    });

    document.getElementById('btn-sandbox-test-webhook')?.addEventListener('click', () => {
        simulateSandboxScenario('webhook_simulation');
    });

    // Reemplazar el botón de compra ficticia del header para abrir el modal real
    const btnVipHeader = document.getElementById('btn-header-bypass-vip');
    if (btnVipHeader) {
        btnVipHeader.addEventListener('click', (e) => {
            e.stopPropagation();
            window.SoundEngine?.playClick?.();
            if (currentVipState.active) {
                alert("⭐ ¡Ya eres miembro MathQuest VIP! Tu cuenta tiene acceso permanente a todos los 55 niveles y contenidos exclusivos.");
                return;
            }
            openCheckoutModal();
        });
    }
}

/**
 * Abrir Modal de Compra VIP
 */
export function openCheckoutModal() {
    const modal = document.getElementById('vip-checkout-modal');
    if (!modal) return;

    const currentUser = auth.currentUser || (window.MathQuestAuth && window.MathQuestAuth.getCurrentUser());
    if (!currentUser) {
        if (window.MathQuestAuth?.openAccountModal) {
            window.MathQuestAuth.openAccountModal();
        }
        return;
    }

    // Resetear estado del modal
    setPaymentState('ready');
    document.getElementById('yape-phone-input').value = currentUser.phoneNumber ? currentUser.phoneNumber.replace(/\D/g, '').slice(-9) : '';
    document.getElementById('yape-otp-input').value = '';

    const priceLabel = document.getElementById('vip-checkout-price-label');
    if (priceLabel) priceLabel.textContent = VIP_CONFIG.priceDisplay;

    const userLabel = document.getElementById('vip-checkout-user-label');
    if (userLabel) userLabel.textContent = currentUser.email || currentUser.displayName || currentUser.uid.substring(0, 8);

    modal.classList.remove('hidden');
}

/**
 * Cerrar Modal de Compra VIP
 */
export function closeCheckoutModal() {
    const modal = document.getElementById('vip-checkout-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

/**
 * Cambiar de pestaña en el modal (Yape Oficial vs Sandbox)
 */
function switchCheckoutTab(tab) {
    const tabYape = document.getElementById('tab-vip-yape-official');
    const tabSandbox = document.getElementById('tab-vip-sandbox-test');
    const viewYape = document.getElementById('view-vip-yape-official');
    const viewSandbox = document.getElementById('view-vip-sandbox-test');

    if (tab === 'yape') {
        tabYape?.classList.add('active');
        tabSandbox?.classList.remove('active');
        viewYape?.classList.remove('hidden');
        viewSandbox?.classList.add('hidden');
    } else {
        tabSandbox?.classList.add('active');
        tabYape?.classList.remove('active');
        viewSandbox?.classList.remove('hidden');
        viewYape?.classList.add('hidden');
    }
}

/**
 * Manejador de Estados Visuales de Pago (Req 10):
 * - preparando
 * - esperando
 * - aprobado
 * - rechazado
 * - cancelado
 * - pendiente
 * - error_conexion
 * - error_proveedor
 */
export function setPaymentState(status, message = '') {
    const statusBox = document.getElementById('vip-checkout-status-box');
    const statusIcon = document.getElementById('vip-checkout-status-icon');
    const statusTitle = document.getElementById('vip-checkout-status-title');
    const statusDesc = document.getElementById('vip-checkout-status-desc');
    const submitBtn = document.getElementById('btn-submit-yape-payment');

    if (!statusBox || !statusTitle || !statusDesc) return;

    statusBox.className = 'vip-status-box';

    switch (status) {
        case 'ready':
            statusBox.classList.add('hidden');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<span>📱 Confirmar y Pagar ${VIP_CONFIG.priceDisplay}</span>`;
            }
            break;

        case 'preparando':
            statusBox.classList.remove('hidden');
            statusBox.classList.add('status-loading');
            statusIcon.textContent = '⏳';
            statusTitle.textContent = 'Preparando pago...';
            statusDesc.textContent = message || 'Conectando con los servicios de autenticación y pasarela...';
            if (submitBtn) submitBtn.disabled = true;
            break;

        case 'esperando':
            statusBox.classList.remove('hidden');
            statusBox.classList.add('status-loading');
            statusIcon.textContent = '📱';
            statusTitle.textContent = 'Esperando pago...';
            statusDesc.textContent = message || 'Validando código de aprobación con Yape y Culqi...';
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = `<span>🔄 Verificando en Yape...</span>`;
            }
            break;

        case 'aprobado':
            statusBox.classList.remove('hidden');
            statusBox.classList.add('status-success');
            statusIcon.textContent = '🎉';
            statusTitle.textContent = '¡Pago Aprobado!';
            statusDesc.textContent = message || 'Tu membresía MathQuest VIP está activa de forma permanente en tu cuenta.';
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = `<span>✓ VIP Activado</span>`;
            }
            window.SoundEngine?.playFanfare?.();
            break;

        case 'rechazado':
            statusBox.classList.remove('hidden');
            statusBox.classList.add('status-error');
            statusIcon.textContent = '❌';
            statusTitle.textContent = 'Pago Rechazado';
            statusDesc.textContent = message || 'El código de aprobación de Yape es inválido o la operación fue declinada.';
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<span>Reintentar Pago (${VIP_CONFIG.priceDisplay})</span>`;
            }
            window.SoundEngine?.playWrong?.();
            break;

        case 'cancelado':
            statusBox.classList.remove('hidden');
            statusBox.classList.add('status-warning');
            statusIcon.textContent = '⚠️';
            statusTitle.textContent = 'Pago Cancelado';
            statusDesc.textContent = message || 'La operación fue cancelada por el usuario.';
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<span>Intentar Nuevamente</span>`;
            }
            break;

        case 'pendiente':
            statusBox.classList.remove('hidden');
            statusBox.classList.add('status-warning');
            statusIcon.textContent = '🕒';
            statusTitle.textContent = 'Pago Pendiente';
            statusDesc.textContent = message || 'El pago está en proceso de validación por Yape. Tu VIP se activará en cuanto sea confirmado.';
            if (submitBtn) submitBtn.disabled = false;
            break;

        case 'error_conexion':
            statusBox.classList.remove('hidden');
            statusBox.classList.add('status-error');
            statusIcon.textContent = '🔌';
            statusTitle.textContent = 'Error de Conexión';
            statusDesc.textContent = message || 'No se pudo contactar con el servidor. Revisa tu conexión a internet.';
            if (submitBtn) submitBtn.disabled = false;
            window.SoundEngine?.playWrong?.();
            break;

        case 'error_proveedor':
            statusBox.classList.remove('hidden');
            statusBox.classList.add('status-error');
            statusIcon.textContent = '⚠️';
            statusTitle.textContent = 'Error del Proveedor';
            statusDesc.textContent = message || 'La pasarela de pagos reportó un error técnico momentáneo.';
            if (submitBtn) submitBtn.disabled = false;
            window.SoundEngine?.playWrong?.();
            break;
    }
}

/**
 * Procesar Pago Oficial con Yape mediante /api/payments/yape/create-charge
 */
export async function processYapePayment({ phoneNumber, otp }) {
    if (isProcessingPayment) return;

    const currentUser = auth.currentUser || (window.MathQuestAuth && window.MathQuestAuth.getCurrentUser());
    if (!currentUser) {
        alert("Debes iniciar sesión con tu cuenta de MathQuest para procesar la compra.");
        return;
    }

    const cleanPhone = (phoneNumber || '').replace(/\D/g, '');
    const cleanOtp = (otp || '').trim();

    if (cleanPhone.length !== 9 || !cleanPhone.startsWith('9')) {
        alert("Por favor ingresa un número de celular de Yape válido (9 dígitos que inicie con 9).");
        return;
    }

    if (cleanOtp.length !== 6) {
        alert("Por favor ingresa el código de aprobación de 6 dígitos que aparece en tu app Yape.");
        return;
    }

    isProcessingPayment = true;
    setPaymentState('preparando', 'Obteniendo credenciales seguras de sesión...');

    try {
        // Obtener ID Token criptográfico de Firebase Auth
        let idToken = '';
        try {
            idToken = await currentUser.getIdToken(true);
        } catch (tErr) {
            console.warn("No se pudo refrescar token criptográfico, usando sesión actual:", tErr);
        }

        setPaymentState('esperando', 'Enviando cobro de S/ 19.90 a Yape...');

        const response = await fetch('/api/payments/yape/create-charge', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
                phoneNumber: cleanPhone,
                otp: cleanOtp,
                email: currentUser.email || 'usuario@mathquest.app'
            })
        });

        const data = await response.json().catch(() => ({}));

        if (response.ok && data.success) {
            setPaymentState('aprobado', data.message || '¡Pago con Yape confirmado exitosamente!');
            
            // Actualizar estado local inmediatamente mientras Firestore sincroniza
            currentVipState = {
                active: true,
                productId: 'mathquest-vip',
                purchasedAt: Date.now(),
                paymentId: data.paymentId || 'yape_approved',
                method: 'yape',
                isLegacyLocal: false
            };
            applyConfirmedVipToApp();

            setTimeout(() => {
                closeCheckoutModal();
            }, 2500);

        } else if (data.status === 'rejected') {
            setPaymentState('rechazado', data.error || 'Pago rechazado: Código OTP inválido o saldo insuficiente.');
        } else if (data.status === 'pending') {
            setPaymentState('pendiente', data.message || 'La operación está pendiente de confirmación en Yape.');
        } else if (data.status === 'canceled') {
            setPaymentState('cancelado', data.message || 'Operación cancelada.');
        } else if (data.status === 'configuration_error' || data.status === 'gateway_error') {
            setPaymentState('error_proveedor', data.error || 'Aviso de configuración en la pasarela de pagos.');
        } else {
            setPaymentState('error_proveedor', data.error || 'No se pudo completar la transacción.');
        }

    } catch (netErr) {
        console.error("Error de red al procesar pago Yape:", netErr);
        setPaymentState('error_conexion', 'No se pudo conectar con el backend de pagos.');
    } finally {
        isProcessingPayment = false;
    }
}

/**
 * Ejecutar Simulador Sandbox (Permite probar los 5 escenarios sin dinero real)
 */
export async function simulateSandboxScenario(scenario) {
    const currentUser = auth.currentUser || (window.MathQuestAuth && window.MathQuestAuth.getCurrentUser());
    if (!currentUser) {
        alert("Inicia sesión para probar las simulaciones de pago.");
        return;
    }

    setPaymentState('preparando', `Simulando escenario Sandbox: [${scenario}]...`);

    try {
        const idToken = await currentUser.getIdToken().catch(() => '');
        setPaymentState('esperando', 'Ejecutando prueba en backend de Sandbox...');

        const res = await fetch('/api/payments/sandbox-simulate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({ scenario: scenario })
        });

        const data = await res.json().catch(() => ({}));

        if (res.ok && data.success) {
            setPaymentState('aprobado', data.message);
            currentVipState = {
                active: true,
                productId: 'mathquest-vip',
                purchasedAt: Date.now(),
                paymentId: data.paymentId,
                method: 'yape',
                isLegacyLocal: false
            };
            applyConfirmedVipToApp();
        } else if (data.status === 'rejected') {
            setPaymentState('rechazado', data.error);
        } else if (data.status === 'pending') {
            setPaymentState('pendiente', data.message);
        } else if (data.status === 'canceled') {
            setPaymentState('cancelado', data.message);
        } else {
            setPaymentState('error_proveedor', data.error || 'Respuesta no esperada de Sandbox.');
        }
    } catch (e) {
        setPaymentState('error_conexion', e.message);
    }
}

/**
 * Consultar si el usuario actual tiene VIP activo confirmado
 */
export function checkVipStatus() {
    return currentVipState.active === true;
}

// Auto-inicializar cuando cargue el documento
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVipPaymentSystem);
} else {
    initVipPaymentSystem();
}
