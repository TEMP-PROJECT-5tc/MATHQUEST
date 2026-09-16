/**
 * MathQuest VIP Payment System (Manual Yape & WhatsApp Flow)
 * 
 * Flujo de Pago Manual:
 * 1. El usuario inicia sesión en MathQuest.
 * 2. Ingresa a la sección VIP o hace clic en el botón VIP.
 * 3. Se muestra el precio único de S/ 4.90.
 * 4. Se muestra el número de Yape oficial y las instrucciones claras.
 * 5. El usuario realiza el pago de S/ 4.90 en su app Yape.
 * 6. Hace clic en "Enviar Comprobante por WhatsApp" con un mensaje preparado que incluye su cuenta.
 * 7. El administrador valida el comprobante y activa manualmente el VIP en Firestore.
 * 8. Firestore sincroniza en tiempo real con la app del usuario y desbloquea todos los niveles.
 */

import { doc, onSnapshot, setDoc } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { db, auth } from './firebase.js';

// Configuración centralizada para Yape y WhatsApp
const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {};

export const VIP_CONFIG = {
    productId: 'mathquest-vip',
    productName: 'MathQuest VIP - Acceso Total',
    price: 4.90,
    priceDisplay: 'S/ 4.90',
    currency: 'PEN',
    // Números configurables desde variables de entorno VITE_* o variables globales en window
    yapeNumber: env.VITE_YAPE_NUMBER || (typeof window !== 'undefined' && window.MATHQUEST_YAPE_NUMBER) || '987654321',
    whatsappNumber: env.VITE_WHATSAPP_NUMBER || (typeof window !== 'undefined' && window.MATHQUEST_WHATSAPP_NUMBER) || '51987654321'
};

let currentVipState = {
    active: false,
    productId: 'mathquest-vip',
    purchasedAt: null,
    amount: 4.90,
    currency: 'PEN',
    method: null,
    status: 'none',
    isLegacyLocal: false
};

let isGlobalVipActive = false;
let firestoreUnsubscribe = null;
let globalFirestoreUnsubscribe = null;

/**
 * Formatear número de teléfono para visualización clara (ej: 987 654 321)
 */
function formatPhoneForDisplay(phone) {
    if (!phone) return '987 654 321';
    const clean = String(phone).replace(/\D/g, '');
    if (clean.length === 9) {
        return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6, 9)}`;
    }
    return phone;
}

/**
 * Inicializar el sistema de pagos manual VIP y listeners de estado
 */
export async function initVipPaymentSystem() {
    console.log("👑 Inicializando sistema MathQuest VIP (Pago Manual Yape y Control Global)...");

    // Iniciar listener en tiempo real de la configuración global
    setupFirestoreGlobalVipListener();

    // Renderizar tarjeta VIP en la tienda
    renderShopVipCard();

    // Configurar listeners de la interfaz
    setupVipUiListeners();

    // Escuchar sesión actual si ya existe
    if (typeof window.MathQuestAuth !== 'undefined') {
        const currentUser = window.MathQuestAuth.getCurrentUser();
        if (currentUser) {
            setupFirestoreVipListener(currentUser.uid);
        }
    } else if (auth.currentUser) {
        setupFirestoreVipListener(auth.currentUser.uid);
    }

    // Exportar API global para consumo por app.js y auth.js
    window.MathQuestVIP = {
        openCheckoutModal,
        closeCheckoutModal,
        checkVipStatus,
        isGlobalVip,
        isIndividualVip,
        isIndividualVipActive,
        setUserVipStatus,
        renderShopVipCard,
        setupFirestoreVipListener,
        setupFirestoreGlobalVipListener,
        teardownFirestoreVipListener,
        getVipState: () => ({ ...currentVipState, isGlobal: isGlobalVipActive }),
        config: VIP_CONFIG
    };
}

/**
 * Evalúa si los datos de un usuario en Firestore contienen VIP activo.
 * Admite:
 * - Booleano simple directo: vip: true / false (la forma más fácil en Firebase Console)
 * - Booleano simple directo: isVip: true / false
 * - Booleano simple directo: bypassPurchased: true / false
 * - Estructura de mapa: vip: { active: true / false }
 */
export function isIndividualVipActive(data) {
    if (!data) return false;
    // 1. Booleano simple directo en la raíz del documento (lo más fácil para el admin)
    if (data.vip === true || data.isVip === true || data.vipActive === true || data.bypassPurchased === true) {
        return true;
    }
    // 2. Booleano explícitamente en false
    if (data.vip === false || data.isVip === false || data.vipActive === false || data.bypassPurchased === false) {
        return false;
    }
    // 3. Estructura de mapa vip: { active: true }
    if (data.vip && typeof data.vip === 'object') {
        if (data.vip.active === true || data.vip.status === 'confirmed') return true;
        if (data.vip.active === false) return false;
    }
    return false;
}

/**
 * Función de Administrador: Activa o desactiva el VIP de un usuario individual en Firestore
 * Guarda el booleano 'vip: true' o 'vip: false' en users/{uid}
 */
export async function setUserVipStatus(targetUid, active) {
    if (!targetUid || typeof targetUid !== 'string' || !targetUid.trim()) {
        throw new Error("Debes proporcionar un UID de usuario válido.");
    }
    const cleanUid = targetUid.trim();
    const boolVal = Boolean(active);
    const userDocRef = doc(db, 'users', cleanUid);
    
    await setDoc(userDocRef, {
        vip: boolVal,
        updatedAt: Date.now()
    }, { merge: true });

    console.log(`👑 Admin: Estado VIP de ${cleanUid} guardado como: ${boolVal}`);
    return true;
}

/**
 * Escuchar cambios en la configuración global compartida en config/global
 * Permite activar o desactivar el VIP para todos los usuarios en tiempo real desde Firebase Console
 */
export function setupFirestoreGlobalVipListener() {
    if (globalFirestoreUnsubscribe) {
        globalFirestoreUnsubscribe();
        globalFirestoreUnsubscribe = null;
    }

    try {
        const globalDocRef = doc(db, 'config', 'global');
        globalFirestoreUnsubscribe = onSnapshot(globalDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                // Soporta globalVipActive, vipGlobalActive o globalVip
                isGlobalVipActive = Boolean(
                    data && (data.globalVipActive === true || data.vipGlobalActive === true || data.globalVip === true)
                );
            } else {
                isGlobalVipActive = false;
            }

            console.log(`🌐 MathQuest VIP Global: ${isGlobalVipActive ? 'ACTIVADO' : 'INACTIVO'}`);
            updateEffectiveVipState();
        }, (err) => {
            console.warn("Aviso en listener de VIP Global:", err.message);
            isGlobalVipActive = false;
            updateEffectiveVipState();
        });
    } catch (e) {
        console.warn("No se pudo iniciar listener de VIP Global:", e.message);
    }
}

/**
 * Escuchar cambios en Firestore en tiempo real para users/{uid}
 * Cuando el administrador activa el VIP individual en Firestore, la app se actualiza al instante.
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
                const hasVip = isIndividualVipActive(data);
                if (hasVip) {
                    const vipObj = (data.vip && typeof data.vip === 'object') ? data.vip : {};
                    currentVipState = {
                        active: true,
                        productId: vipObj.productId || 'mathquest-vip',
                        productName: vipObj.productName || 'MathQuest VIP - Acceso Total',
                        purchasedAt: vipObj.purchasedAt || null,
                        amount: vipObj.amount !== undefined ? vipObj.amount : 4.90,
                        currency: vipObj.currency || 'PEN',
                        method: vipObj.method || 'admin_grant',
                        status: vipObj.status || 'confirmed',
                        environment: vipObj.environment || 'firestore',
                        isLegacyLocal: false
                    };
                } else {
                    // Verificar si tenía bypass local legacy
                    const isLocalBypass = Boolean(window.state && window.state.vipBypassPurchased && !window.state.isGlobalVip);
                    currentVipState = {
                        active: false,
                        productId: 'mathquest-vip',
                        purchasedAt: null,
                        amount: null,
                        currency: 'PEN',
                        method: null,
                        status: 'none',
                        isLegacyLocal: isLocalBypass
                    };
                }
            }
            updateEffectiveVipState();
        }, (err) => {
            console.warn("Aviso en listener de Firestore VIP:", err.message);
        });
    } catch (e) {
        console.warn("No se pudo iniciar listener de Firestore VIP:", e.message);
    }
}

/**
 * Desconectar listener de usuario al cerrar sesión
 */
export function teardownFirestoreVipListener() {
    if (firestoreUnsubscribe) {
        firestoreUnsubscribe();
        firestoreUnsubscribe = null;
    }
    const isLocalBypass = Boolean(window.state && window.state.vipBypassPurchased && !window.state.isGlobalVip);
    currentVipState = {
        active: false,
        productId: 'mathquest-vip',
        purchasedAt: null,
        amount: null,
        currency: 'PEN',
        method: null,
        status: 'none',
        isLegacyLocal: isLocalBypass
    };
    updateEffectiveVipState();
}

/**
 * Actualizar el estado VIP unificado en la aplicación
 * Regla: Acceso VIP = VIP Global activo O VIP individual confirmado
 */
export function updateEffectiveVipState() {
    const hasVip = isGlobalVipActive || currentVipState.active;

    if (!window.state) window.state = {};
    window.state.vipBypassPurchased = hasVip || Boolean(currentVipState.isLegacyLocal);
    window.state.isRealVip = currentVipState.active === true;
    window.state.isGlobalVip = isGlobalVipActive === true;
    window.state.vip = {
        ...currentVipState,
        active: currentVipState.active,
        isGlobal: isGlobalVipActive
    };

    // Actualizar interfaz del juego sin recargar
    if (typeof window.updateHeaderStats === 'function') {
        window.updateHeaderStats();
    }
    if (typeof window.renderDuolingoPath === 'function') {
        window.renderDuolingoPath();
    }
    renderShopVipCard();
    updateHeaderVipBadge();

    // Actualizar modal de cuenta si está visible
    if (window.MathQuestAuth?.updateModalStats) {
        window.MathQuestAuth.updateModalStats(window.state);
    }
}

/**
 * Aplicar estado VIP confirmado por Firestore a la aplicación MathQuest
 */
function applyConfirmedVipToApp() {
    updateEffectiveVipState();
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
    } else if (isGlobalVipActive) {
        btnVipHeader.innerHTML = "🌐 VIP Global";
        btnVipHeader.style.background = "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)";
        btnVipHeader.style.borderColor = "#1e40af";
        btnVipHeader.style.boxShadow = "0 0 12px rgba(37, 99, 235, 0.4)";
    } else if (currentVipState.isLegacyLocal) {
        btnVipHeader.innerHTML = "👑 VIP Local";
        btnVipHeader.style.background = "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)";
        btnVipHeader.style.borderColor = "#b45309";
        btnVipHeader.style.boxShadow = "none";
    } else {
        btnVipHeader.innerHTML = "👑 VIP";
        btnVipHeader.style.background = "linear-gradient(135deg, #f59e0b 0%, #b45309 100%)";
        btnVipHeader.style.borderColor = "";
        btnVipHeader.style.boxShadow = "none";
    }
}

/**
 * Renderizar la tarjeta destacada de MathQuest VIP dentro de la tienda
 */
export function renderShopVipCard() {
    const container = document.getElementById('vip-shop-action-container');
    if (!container) return;

    const currentUser = auth.currentUser || (window.MathQuestAuth && window.MathQuestAuth.getCurrentUser());

    // Caso 1: Usuario ya tiene VIP confirmado individualmente en Firestore
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
                    <span class="vip-active-meta">Estado: Verificado • Fecha: ${dateStr}</span>
                </div>
            </div>
        `;
        return;
    }

    // Caso 2: Modo VIP Global activado desde Firebase Console
    if (isGlobalVipActive) {
        container.innerHTML = `
            <div class="vip-status-active-badge" style="border-color: #3b82f6;">
                <div class="vip-active-chip" style="background: linear-gradient(135deg, #2563eb, #1d4ed8);">
                    <span>🌐</span>
                    <strong>VIP GLOBAL ACTIVO</strong>
                </div>
                <div class="vip-active-details">
                    <p>¡Acceso VIP activado para todos los usuarios por el Administrador! Todos los niveles y funciones están disponibles.</p>
                    <span class="vip-active-meta" style="color: #60a5fa;">Modo: Acceso Global Concedido</span>
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
                    🔒 Inicia sesión para adquirir VIP
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

    // Caso 3: Usuario autenticado SIN VIP (Listo para comprar con Yape)
    const isLegacy = currentVipState.isLegacyLocal;
    const legacyNotice = isLegacy 
        ? `<div class="vip-legacy-notice">⚠️ Tienes un acceso temporal local previo. Adquiérelo con Yape para sincronizarlo permanentemente en tu cuenta de Firebase y todos tus dispositivos.</div>` 
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
                📱 Adquirir VIP con Yape (${VIP_CONFIG.priceDisplay})
            </button>
        </div>
        <div class="vip-security-row">
            <span>📱 Pago manual simple vía Yape • Verificación rápida por WhatsApp</span>
            <span>⚡ Activación permanente en tu cuenta (${currentUser.email || currentUser.displayName || 'UID: ' + currentUser.uid.substring(0, 6)})</span>
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

    // Cerrar modal al hacer clic en el backdrop
    const modal = document.getElementById('vip-checkout-modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeCheckoutModal();
            }
        });
    }

    // Cerrar con tecla Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
            closeCheckoutModal();
        }
    });

    // Botón para copiar número de Yape
    const btnCopyYape = document.getElementById('btn-copy-yape-number');
    if (btnCopyYape) {
        btnCopyYape.addEventListener('click', () => {
            window.SoundEngine?.playClick?.();
            const cleanPhone = String(VIP_CONFIG.yapeNumber).replace(/\D/g, '');
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(cleanPhone).then(() => {
                    const originalText = btnCopyYape.innerHTML;
                    btnCopyYape.innerHTML = "✓ ¡Copiado!";
                    setTimeout(() => {
                        btnCopyYape.innerHTML = originalText;
                    }, 2000);
                }).catch(() => {
                    prompt("Copia el número de Yape manualmente:", cleanPhone);
                });
            } else {
                prompt("Copia el número de Yape manualmente:", cleanPhone);
            }
        });
    }

    // Botón del header para abrir el modal VIP
    const btnVipHeader = document.getElementById('btn-header-bypass-vip');
    if (btnVipHeader) {
        btnVipHeader.addEventListener('click', (e) => {
            e.stopPropagation();
            window.SoundEngine?.playClick?.();
            if (currentVipState.active) {
                alert("⭐ ¡Ya eres miembro MathQuest VIP! Tu cuenta tiene acceso permanente a todos los 55 niveles y contenidos exclusivos.");
                return;
            }
            if (isGlobalVipActive) {
                alert("🌐 ¡Acceso VIP Global Activo! El Administrador ha habilitado todos los 55 niveles y contenidos VIP para todos los jugadores.");
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

    // Identificador de cuenta
    const accountLabel = currentUser.email || currentUser.displayName || (`Cuenta UID: ${currentUser.uid.substring(0, 8)}`);

    // Actualizar etiquetas en el modal
    const userLabelEl = document.getElementById('vip-checkout-user-label');
    if (userLabelEl) userLabelEl.textContent = accountLabel;

    const accountInstEl = document.getElementById('vip-instructions-account-label');
    if (accountInstEl) accountInstEl.textContent = accountLabel;

    const priceLabel = document.getElementById('vip-checkout-price-label');
    if (priceLabel) priceLabel.textContent = VIP_CONFIG.priceDisplay;

    const phoneDisplay = document.getElementById('vip-yape-phone-display');
    if (phoneDisplay) phoneDisplay.textContent = formatPhoneForDisplay(VIP_CONFIG.yapeNumber);

    // Configurar enlace de WhatsApp con mensaje preparado
    const whatsappBtn = document.getElementById('btn-send-whatsapp-receipt');
    if (whatsappBtn) {
        const cleanWhatsapp = String(VIP_CONFIG.whatsappNumber).replace(/\D/g, '');
        const message = `Hola, quiero activar MathQuest VIP. Mi cuenta es: ${accountLabel}`;
        const encodedMsg = encodeURIComponent(message);
        whatsappBtn.href = `https://wa.me/${cleanWhatsapp}?text=${encodedMsg}`;
        whatsappBtn.onclick = () => {
            window.SoundEngine?.playClick?.();
        };
    }

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
 * Consultar si el VIP global está activo
 */
export function isGlobalVip() {
    return isGlobalVipActive === true;
}

/**
 * Consultar si el usuario tiene VIP individual confirmado en Firestore
 */
export function isIndividualVip() {
    return currentVipState.active === true;
}

/**
 * Consultar si el usuario actual tiene acceso VIP (Global activo O Individual confirmado)
 */
export function checkVipStatus() {
    return isGlobalVipActive === true || currentVipState.active === true;
}

// Auto-inicializar cuando cargue el documento
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVipPaymentSystem);
} else {
    initVipPaymentSystem();
}
