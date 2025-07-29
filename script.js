// script.js

// --- SDK IMPORTS ---
import { auth, db } from './firebase-config.js'; 
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, addDoc, onSnapshot, doc, updateDoc, query, orderBy, serverTimestamp, getDoc, setDoc, getDocs, where, deleteDoc, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const availableRegions = ["Sul", "Norte", "Centro-Oeste", "Sudeste", "Nordeste"];

// --- DOM ELEMENTS ---
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const modalContainer = document.getElementById('modal-container');

// --- APP STATE ---
let currentUserProfile = null;
let allShifts = [];
let allUsers = new Map();
let userNotifications = [];
let unsubscribeListeners = [];
let calendarInstance = null;

// --- HELPER FUNCTIONS ---
function normalizeRegion(regionStr) {
    if (!regionStr) return '';
    return regionStr.toLowerCase().replace('regional', '').trim();
}

function getShiftStatus(shift) {
    if (!shift || !shift.status) return 'Desconhecido';
    let currentStatus = shift.status;
    const now = new Date();
    const originalDate = new Date(shift.originalDate);
    if (currentStatus === 'Aguardando Confirmação' && now > originalDate) {
        return 'Expirada';
    }
    return currentStatus;
}

function toggleButtonLoading(button, isLoading) {
    if (!button) return;
    if (isLoading) {
        button.disabled = true;
        button.classList.add('loading');
    } else {
        button.disabled = false;
        button.classList.remove('loading');
    }
}

// --- TEMPLATES HTML ---
const confirmationModalHTML = (title, message, confirmClass) => `
    <div class="modal-overlay fixed inset-0 bg-black bg-opacity-70 z-[100] flex items-center justify-center p-4 opacity-0">
        <div class="modal-content glassmorphism rounded-2xl p-8 max-w-sm w-full shadow-lg scale-95 opacity-0">
            <div class="flex justify-between items-center mb-6">
                <h4 class="text-xl font-bold">${title}</h4>
                <button class="modal-close p-2 rounded-full hover:bg-white/10">
                    <i class="fa-solid fa-xmark w-5 h-5 text-white"></i>
                </button>
            </div>
            <p class="text-gray-300 mb-8">${message}</p>
            <div class="flex justify-end space-x-4">
                <button class="modal-close btn btn-secondary font-semibold py-2 px-5 rounded-full">Cancelar</button>
                <button id="modalConfirm" class="btn ${confirmClass} font-semibold py-2 px-5 rounded-full">Confirmar</button>
            </div>
        </div>
    </div>`;

const forgotPasswordModalHTML = `
    <div class="modal-overlay fixed inset-0 bg-black bg-opacity-70 z-[100] flex items-center justify-center p-4 opacity-0">
        <div class="modal-content glassmorphism rounded-2xl p-8 max-w-sm w-full shadow-lg scale-95 opacity-0">
            <div class="flex justify-between items-center mb-4">
                <h4 class="text-xl font-bold">Redefinir Senha</h4>
                <button class="modal-close p-2 rounded-full hover:bg-white/10">
                    <i class="fa-solid fa-xmark w-5 h-5 text-white"></i>
                </button>
            </div>
            <p class="text-gray-300 mb-6 text-sm">Insira seu e-mail abaixo. Se ele estiver cadastrado, enviaremos um link para você criar uma nova senha.</p>
            <form id="reset-password-form" class="space-y-4">
                <input type="email" id="reset-email" placeholder="Digite seu e-mail" required class="form-input w-full p-3 rounded-lg">
                <button type="submit" id="reset-submit-btn" class="btn btn-primary w-full font-bold py-3 rounded-full text-base">Enviar Link</button>
            </form>
            <p id="reset-message" class="text-sm mt-4 text-center h-4"></p>
        </div>
    </div>`;

const profileModalHTML = (user, isOwnProfile) => {
    const photo = user.photoURL || `https://placehold.co/80x80/1a1a1a/f0f0f0?text=${user.name.charAt(0)}`;
    const posto = user.posto || 'Não informado';
    const cidade = user.cidade || 'Não informada';
    const regional = user.regional || 'Não informada';
    
    return `
    <div class="modal-overlay fixed inset-0 bg-black bg-opacity-70 z-[100] flex items-center justify-center p-4 opacity-0">
        <div class="modal-content glassmorphism rounded-2xl p-8 max-w-lg w-full shadow-lg scale-95 opacity-0">
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-2xl font-bold">${isOwnProfile ? 'Meu Perfil' : `Perfil de ${user.name.split(' ')[0]}`}</h3>
                <button class="modal-close p-2 rounded-full hover:bg-white/10"><i class="fa-solid fa-xmark w-5 h-5 text-white"></i></button>
            </div>
            <div id="profile-view-mode">
                <div class="space-y-4">
                    <div class="flex items-center space-x-4"><img src="${photo}" class="w-20 h-20 rounded-full object-cover border-2 border-[var(--sun-yellow)]"><h4 class="text-2xl font-bold">${user.name}</h4></div>
                    <p><strong class="text-gray-400 w-20 inline-block">Posto:</strong> ${posto}</p>
                    <p><strong class="text-gray-400 w-20 inline-block">Cidade:</strong> ${cidade}</p>
                    <p><strong class="text-gray-400 w-20 inline-block">Regional:</strong> ${regional}</p>
                    ${isOwnProfile ? '<div class="pt-4 flex justify-end"><button id="edit-profile-btn" class="btn btn-secondary font-bold py-2 px-6 rounded-full text-base">Editar Perfil</button></div>' : ''}
                </div>
            </div>
            <form id="profile-edit-mode" class="hidden space-y-4">
                <div class="flex items-center space-x-4">
                    <img src="${photo}" id="edit-profile-pic-preview" class="w-20 h-20 rounded-full object-cover border-2 border-[var(--sun-yellow)]">
                    <div class="flex-grow">
                        <label class="text-sm font-medium text-gray-300">URL da Foto de Perfil</label>
                        <input type="url" id="profile-photo-url" value="${user.photoURL || ''}" placeholder="https://exemplo.com/sua-foto.jpg" class="form-input w-full p-3 rounded-lg mt-1">
                    </div>
                </div>
                <div><label class="text-sm font-medium text-gray-300">Posto de Trabalho</label><input type="text" id="profile-posto" value="${user.posto || ''}" placeholder="Ex: Portaria Principal" class="form-input w-full p-3 rounded-lg mt-1"></div>
                <div><label class="text-sm font-medium text-gray-300">Cidade</label><input type="text" id="profile-cidade" value="${user.cidade || ''}" placeholder="Ex: São Paulo" class="form-input w-full p-3 rounded-lg mt-1" readonly></div>
                <div><label class="text-sm font-medium text-gray-300">Regional</label><input type="text" id="profile-regional" value="${user.regional || ''}" placeholder="Ex: Regional Sul" class="form-input w-full p-3 rounded-lg mt-1" readonly></div>
                 <details class="pt-2">
                    <summary class="text-sm text-gray-400 cursor-pointer hover:text-white">Como adicionar minha foto de perfil?</summary>
                    <p class="text-xs text-gray-500 mt-2 p-3 bg-black/20 rounded-lg">Para adicionar uma foto, você precisa hospedá-la em um site (como <a href="https://imgur.com/upload" target="_blank" class="underline">Imgur</a>). Após o upload, clique com o botão direito na imagem, selecione "Copiar endereço da imagem" e cole o link no campo acima.</p>
                </details>
                <div class="pt-4 flex justify-end space-x-4">
                    <button type="button" id="cancel-edit-btn" class="btn btn-secondary font-bold py-3 px-8 rounded-full text-base">Cancelar</button>
                    <button type="submit" id="save-profile-btn" class="btn btn-primary font-bold py-3 px-8 rounded-full text-base"><span class="spinner"><i class="fas fa-spinner fa-spin"></i></span><span class="btn-text">Salvar</span></button>
                </div>
            </form>
        </div>
    </div>`;
};

const dashboardModalHTML = (regionalName) => `
    <div class="modal-overlay fixed inset-0 bg-black bg-opacity-70 z-[100] flex items-center justify-center p-4 opacity-0">
        <div class="modal-content glassmorphism rounded-2xl p-6 md:p-8 max-w-4xl w-full shadow-lg scale-95 opacity-0 flex flex-col" style="max-height: 90vh;">
            <div class="flex justify-between items-center mb-6 flex-shrink-0">
                <h3 class="text-2xl font-bold">Dashboard de Ocorrências - <span class="text-[var(--sun-yellow)] text-xl">${regionalName}</span></h3>
                <button class="modal-close p-2 rounded-full hover:bg-white/10">
                    <i class="fa-solid fa-xmark w-5 h-5 text-white"></i>
                </button>
            </div>

            <div class="flex-grow overflow-y-auto pr-4 -mr-4">
                <div class="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                    <div class="stat-card bg-gray-800/50 p-4 rounded-lg border-l-[var(--sun-yellow)]" style="animation-delay: 0s;">
                        <div class="flex items-center text-gray-400 text-sm font-medium"><i class="fa-solid fa-layer-group mr-2"></i> Total</div>
                        <div id="db-total-count" class="text-3xl font-bold mt-1 text-white">0</div>
                    </div>
                    <div class="stat-card bg-gray-800/50 p-4 rounded-lg border-l-[var(--color-approved)]" style="animation-delay: 0.1s;">
                        <div class="flex items-center text-gray-400 text-sm font-medium"><i class="fa-solid fa-circle-check mr-2 text-[var(--color-approved)]"></i> Aprovadas</div>
                        <div id="db-approved-count" class="text-3xl font-bold mt-1 text-white">0</div>
                    </div>
                    <div class="stat-card bg-gray-800/50 p-4 rounded-lg border-l-[var(--color-pending)]" style="animation-delay: 0.2s;">
                        <div class="flex items-center text-gray-400 text-sm font-medium"><i class="fa-solid fa-clock mr-2 text-[var(--color-pending)]"></i> Pendentes</div>
                        <div id="db-pending-count" class="text-3xl font-bold mt-1 text-white">0</div>
                    </div>
                    <div class="stat-card bg-gray-800/50 p-4 rounded-lg border-l-[var(--color-rejected)]" style="animation-delay: 0.3s;">
                        <div class="flex items-center text-gray-400 text-sm font-medium"><i class="fa-solid fa-circle-xmark mr-2 text-[var(--color-rejected)]"></i> Recusadas</div>
                        <div id="db-rejected-count" class="text-3xl font-bold mt-1 text-white">0</div>
                    </div>
                    <div class="stat-card bg-gray-800/50 p-4 rounded-lg border-l-[var(--color-expired)]" style="animation-delay: 0.4s;">
                        <div class="flex items-center text-gray-400 text-sm font-medium"><i class="fa-solid fa-calendar-xmark mr-2 text-[var(--color-expired)]"></i> Expiradas</div>
                        <div id="db-expired-count" class="text-3xl font-bold mt-1 text-white">0</div>
                    </div>
                </div>

                <div class="grid md:grid-cols-2 gap-8">
                    <div>
                        <h4 class="font-bold text-lg mb-4">Detalhes por Status</h4>
                        <div id="status-details-list" class="space-y-4">
                            </div>
                    </div>
                    <div>
                        <h4 class="font-bold text-lg mb-4">Trocas por Mês</h4>
                        <div id="monthly-stats-list" class="space-y-3">
                            </div>
                    </div>
                </div>
            </div>
        </div>
    </div>`;
    
const calendarModalHTML = `
    <div class="modal-overlay fixed inset-0 bg-black bg-opacity-70 z-[100] flex items-center justify-center p-4 opacity-0">
        <div class="modal-content glassmorphism rounded-2xl p-6 md:p-8 max-w-6xl w-full shadow-lg scale-95 opacity-0 flex flex-col" style="height: 90vh;">
            <div class="flex justify-between items-center mb-6 flex-shrink-0">
                <h3 class="text-2xl font-bold">Calendário de Plantões</h3>
                <button class="modal-close p-2 rounded-full hover:bg-white/10"><i class="fa-solid fa-xmark w-5 h-5 text-white"></i></button>
            </div>
            <div id='calendar-container' class="flex-grow overflow-hidden"></div>
        </div>
    </div>`;

const notificationModalHTML = () => `
    <div class="modal-overlay fixed inset-0 bg-black bg-opacity-70 z-[100] flex items-center justify-center p-4 opacity-0">
        <div class="modal-content glassmorphism rounded-2xl p-8 max-w-lg w-full shadow-lg scale-95 opacity-0 flex flex-col" style="max-height: 90vh;">
            <div class="flex justify-between items-center mb-4 flex-shrink-0">
                <h3 class="text-2xl font-bold">Notificações</h3>
                <button class="modal-close p-2 rounded-full hover:bg-white/10">
                    <i class="fa-solid fa-xmark w-5 h-5 text-white"></i>
                </button>
            </div>
            <div id="notification-list" class="flex-grow overflow-y-auto -mr-4 pr-4 space-y-2">
                </div>
            <div id="notification-actions" class="mt-6 flex-shrink-0">
               </div>
        </div>
    </div>`;

const shiftFormHTML = `
    <div class="glassmorphism p-6 rounded-2xl sticky top-24">
        <h3 class="text-2xl font-bold mb-6">Solicitar Troca</h3>
        <form id="shift-form-inner" class="space-y-4">
            <div>
                <label class="text-sm font-medium text-gray-300">Trocar com o(a) colega</label>
                <select id="colleagueName" required class="form-select w-full p-3 rounded-lg mt-1">
                    <option value="" disabled selected>Selecione um colega</option>
                </select>
                <div id="selected-colleague-preview" class="hidden mt-3 p-3 bg-white/5 rounded-lg border border-white/10 flex items-center space-x-3"></div>
            </div>
            <div>
                 <label class="text-sm font-medium text-gray-300">Seu plantão (que você quer trocar)</label>
                <input type="text" id="originalDate" required class="form-input w-full p-3 rounded-lg mt-1" placeholder="Selecione a data e hora">
            </div>
            <div>
                 <label class="text-sm font-medium text-gray-300">Plantão desejado (que você quer pegar)</label>
                <input type="text" id="desiredDate" required class="form-input w-full p-3 rounded-lg mt-1" placeholder="Selecione a data e hora">
            </div>
            <div>
                 <label class="text-sm font-medium text-gray-300">Motivo</label>
                <textarea id="reason" placeholder="Ex: Consulta médica" rows="3" class="form-input w-full p-3 rounded-lg mt-1" required></textarea>
            </div>
            <div class="pt-2">
                <button type="submit" id="submit-shift-btn" class="btn btn-primary w-full font-bold py-3 px-8 rounded-full text-base">
                    <span class="spinner"><i class="fas fa-spinner fa-spin"></i></span>
                    <span class="btn-text">Enviar Solicitação</span>
                </button>
            </div>
        </form>
    </div>`;

const userListModalHTML = () => `
    <div class="modal-overlay fixed inset-0 bg-black bg-opacity-70 z-[100] flex items-center justify-center p-4 opacity-0">
        <div class="modal-content glassmorphism rounded-2xl p-6 md:p-8 max-w-2xl w-full shadow-lg scale-95 opacity-0 flex flex-col" style="height: 90vh;">
            <div class="flex justify-between items-center mb-4 flex-shrink-0">
                <h3 class="text-2xl font-bold">Usuários Registrados</h3>
                <button class="modal-close p-2 rounded-full hover:bg-white/10"><i class="fa-solid fa-xmark w-5 h-5 text-white"></i></button>
            </div>
            <div class="mb-4 flex-shrink-0">
                <input type="search" id="user-search-input" placeholder="Buscar por nome ou e-mail..." class="form-input w-full p-3 rounded-lg">
            </div>
            <div id="user-list-items" class="flex-grow overflow-y-auto -mr-4 pr-4">
                </div>
        </div>
    </div>`;

// --- AUTHENTICATION LOGIC ---
function initializeAuth() {
    const regionSelect = document.getElementById('register-regional');
    if (regionSelect) {
        availableRegions.sort().forEach(region => {
            const option = document.createElement('option');
            option.value = region;
            option.textContent = region;
            regionSelect.appendChild(option);
        });
    }

    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const showRegisterBtn = document.getElementById('show-register');
    const showLoginBtn = document.getElementById('show-login');
    const forgotPasswordBtn = document.getElementById('forgot-password');

    onAuthStateChanged(auth, (user) => {
        unsubscribeListeners.forEach(unsub => unsub());
        unsubscribeListeners = [];

        if (user) {
            const userDocRef = doc(db, "users", user.uid);
            
            const unsub = onSnapshot(userDocRef, (doc) => {
                if (doc.exists()) {
                    const newProfile = { uid: user.uid, ...doc.data() };
                    
                    if (JSON.stringify(newProfile) !== JSON.stringify(currentUserProfile)) {
                        currentUserProfile = newProfile;
                        initializeAppUI();
                    }
                } else {
                    console.error('[DEBUG] ERRO: Documento do usuário não encontrado no Firestore!');
                    signOut(auth);
                }
            }, (error) => {
                console.error("[DEBUG] ERRO CRÍTICO no listener do perfil (verifique as REGRAS do Firestore):", error);
                signOut(auth);
            });
            
            unsubscribeListeners.push(unsub);
            authContainer.classList.add('hidden');
            appContainer.classList.remove('hidden');

        } else {
            currentUserProfile = null;
            authContainer.classList.remove('hidden');
            appContainer.classList.add('hidden');
        }
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const errorP = document.getElementById('login-error');
        errorP.textContent = '';
        try { await signInWithEmailAndPassword(auth, email, password); } 
        catch (error) { errorP.textContent = "Email ou senha inválidos."; }
    });

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('register-name').value;
        const email = document.getElementById('register-email').value;
        const regional = document.getElementById('register-regional').value;
        const password = document.getElementById('register-password').value;
        const confirmPassword = document.getElementById('register-confirm-password').value;
        const errorP = document.getElementById('register-error');
        errorP.textContent = '';

        if (password !== confirmPassword) { errorP.textContent = 'As senhas não coincidem.'; return; }
        if (!regional) { errorP.textContent = 'Por favor, selecione uma regional.'; return; }

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await setDoc(doc(db, "users", userCredential.user.uid), { 
                name, 
                email, 
                regional,
                role: 'vigilante', 
                posto: '', 
                cidade: '', 
                photoURL: '' 
            });
        } catch (error) {
            if (error.code === 'auth/email-already-in-use') errorP.textContent = 'Este email já está em uso.';
            else if (error.code === 'auth/weak-password') errorP.textContent = 'A senha deve ter no mínimo 6 caracteres.';
            else errorP.textContent = 'Ocorreu um erro ao cadastrar.';
        }
    });

    forgotPasswordBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openForgotPasswordModal();
    });

    showRegisterBtn.addEventListener('click', (e) => { e.preventDefault(); document.getElementById('login-view').classList.add('hidden'); document.getElementById('register-view').classList.remove('hidden'); });
    showLoginBtn.addEventListener('click', (e) => { e.preventDefault(); document.getElementById('register-view').classList.add('hidden'); document.getElementById('login-view').classList.remove('hidden'); });
}

// --- MAIN APP LOGIC ---
async function initializeAppUI() {
    if (!currentUserProfile) {
        console.error('[DEBUG] initializeAppUI chamada sem currentUserProfile!');
        return;
    }
    
    const { name, role, photoURL } = currentUserProfile;
    document.getElementById('user-greeting').textContent = `Olá, ${name.split(' ')[0]}`;
    document.getElementById('user-role').textContent = role;
    document.getElementById('profile-pic-header').src = photoURL || `https://placehold.co/40x40/1a1a1a/f0f0f0?text=${name.charAt(0)}`;

    const formSection = document.getElementById('form-section');
    const shiftListContainer = document.getElementById('shift-list-container');
    const supervisorActions = document.getElementById('supervisor-actions');
    const donoActions = document.getElementById('dono-actions');
    const dashboardStats = document.getElementById('dashboard-stats');

    if (role === 'supervisor' || role === 'dono' || role === 'adm') {
        formSection.innerHTML = '';
        formSection.style.display = 'none';
        shiftListContainer.classList.remove('lg:col-span-2');
        shiftListContainer.classList.add('lg:col-span-3');
        supervisorActions.classList.remove('hidden');
        dashboardStats.classList.remove('hidden');
        donoActions.classList.toggle('hidden', role !== 'dono' && role !== 'adm');
    } else {
        formSection.innerHTML = shiftFormHTML;
        formSection.style.display = 'block';
        shiftListContainer.classList.remove('lg:col-span-3');
        shiftListContainer.classList.add('lg:col-span-2');
        supervisorActions.classList.add('hidden');
        dashboardStats.classList.add('hidden');
        donoActions.classList.add('hidden');

        flatpickr.localize(flatpickr.l10ns.pt);
        const commonConfig = { enableTime: true, dateFormat: "Y-m-d H:i", time_24hr: true };
        flatpickr("#originalDate", commonConfig);
        flatpickr("#desiredDate", commonConfig);
    }
    
    await fetchAllUsers();
    setupEventListeners();
    startRealtimeListeners();
}

async function fetchAllUsers() {
    allUsers.clear();
    try {
        const querySnapshot = await getDocs(collection(db, "users"));
        querySnapshot.forEach(doc => allUsers.set(doc.id, { id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Erro ao buscar usuários (verifique as regras do Firestore):", error);
    }
    
    const colleaguesSelect = document.getElementById('colleagueName');
    if (colleaguesSelect && currentUserProfile?.regional) {
        colleaguesSelect.innerHTML = '<option value="" disabled selected>Selecione um colega da sua regional</option>';
        const currentUserRegion = normalizeRegion(currentUserProfile.regional);

        allUsers.forEach(user => {
            const colleagueRegion = normalizeRegion(user.regional);
            if (user.id !== currentUserProfile.uid && user.role === 'vigilante' && colleagueRegion === currentUserRegion) {
                const option = document.createElement('option');
                option.value = user.name;
                option.textContent = user.name;
                option.dataset.uid = user.id;
                colleaguesSelect.appendChild(option);
            }
        });
    }
}

function startRealtimeListeners() {
    unsubscribeListeners.filter(unsub => unsub.type === 'data').forEach(unsub => unsub.func());
    unsubscribeListeners = unsubscribeListeners.filter(unsub => unsub.type !== 'data');

    const shiftsCollectionRef = collection(db, "shifts");
    const qShifts = query(shiftsCollectionRef, orderBy('createdAt', 'desc'));
    const unsubShifts = onSnapshot(qShifts, (snapshot) => {
        allShifts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderShifts();
    }, (error) => {
        console.error("Erro no listener de trocas:", error);
    });
    unsubscribeListeners.push({type: 'data', func: unsubShifts});

    if (!currentUserProfile) return;
    const qNotif = query(
        collection(db, "notifications"),
        where("userId", "==", currentUserProfile.uid),
        orderBy("createdAt", "desc")
    );

    const unsubNotif = onSnapshot(qNotif, (snapshot) => {
        userNotifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const unreadCount = userNotifications.filter(n => !n.read).length;
        const badge = document.getElementById('notification-badge');

        if (badge) {
            if (unreadCount > 0) {
                badge.textContent = unreadCount;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }
    }, (error) => {
         console.error("Erro no listener de notificações:", error);
    });
    unsubscribeListeners.push({type: 'data', func: unsubNotif});
}

function renderShifts() {
    if (!currentUserProfile) return;
    const shiftList = document.getElementById('shift-list');
    shiftList.innerHTML = '';
    
    const isSupervisor = currentUserProfile.role === 'supervisor';
    const isDonoOrAdm = currentUserProfile.role === 'dono' || currentUserProfile.role === 'adm';
    const currentUserRegion = normalizeRegion(currentUserProfile.regional);

    let visibleShifts = [];
    if (isDonoOrAdm) {
        visibleShifts = allShifts;
    } else if (isSupervisor) {
        if (currentUserRegion) {
            visibleShifts = allShifts.filter(s => normalizeRegion(s.regional) === currentUserRegion);
        } else {
            visibleShifts = [];
        }
    } else {
        visibleShifts = allShifts.filter(s => s.requesterUid === currentUserProfile.uid || s.colleagueUid === currentUserProfile.uid);
    }

    if (visibleShifts.length === 0) {
        shiftList.innerHTML = `<div class="text-center text-gray-500 p-8 bg-[#1a1a1a]/50 rounded-lg">Nenhuma solicitação para você.</div>`;
    } else {
        visibleShifts.forEach(shift => {
            const statusMap = { 
                'Aguardando Confirmação': { class: 'status-aguardando', text: 'Aguardando Confirmação', icon: 'fa-solid fa-clock', iconColor: 'text-yellow-500' }, 
                'Confirmada - Aguardando Supervisor': { class: 'status-confirmada', text: 'Aguardando Supervisor', icon: 'fa-solid fa-user-check', iconColor: 'text-blue-500' }, 
                'Aprovada': { class: 'status-aprovada', text: 'Aprovada', icon: 'fa-solid fa-circle-check', iconColor: 'text-green-500' }, 
                'Recusada': { class: 'status-recusada', text: 'Recusada pelo Colega', icon: 'fa-solid fa-circle-xmark', iconColor: 'text-red-500' }, 
                'Recusada pelo Supervisor': { class: 'status-recusada', text: 'Recusada', icon: 'fa-solid fa-shield-xmark', iconColor: 'text-red-600' }, 
                'Expirada': { class: 'status-expirada', text: 'Expirada', icon: 'fa-solid fa-calendar-xmark', iconColor: 'text-gray-400' }, 
            };
            
            const currentStatus = getShiftStatus(shift);
            const statusInfo = statusMap[currentStatus] || { text: currentStatus, icon: 'fa-solid fa-question-circle', iconColor: 'text-gray-400', class: 'status-expirada' };
            
            let displayStatusHTML = statusInfo.text;
            if (shift.supervisorActionByName && shift.supervisorActionById) {
                const firstName = shift.supervisorActionByName.split(' ')[0];
                displayStatusHTML = `${statusInfo.text} por <span class="supervisor-name" data-uid="${shift.supervisorActionById}" style="cursor: pointer;">${firstName}</span>`;
            }

            const card = document.createElement('div');
            card.className = `shift-card p-5 rounded-lg ${statusInfo.class}`;
            card.id = `shift-${shift.id}`;

            let actionsHtml = '';
            if (currentUserProfile.uid === shift.colleagueUid && currentStatus === 'Aguardando Confirmação') {
                actionsHtml = `<button data-id="${shift.id}" data-action="accept" class="btn btn-success text-xs font-bold py-2 px-4 rounded-full">Aceitar</button> <button data-id="${shift.id}" data-action="reject" class="btn btn-danger text-xs font-bold py-2 px-4 rounded-full">Recusar</button>`;
            }
            if ((isSupervisor || isDonoOrAdm) && currentStatus === 'Confirmada - Aguardando Supervisor') {
                 actionsHtml = `<button data-id="${shift.id}" data-action="approve" class="btn btn-success text-xs font-bold py-2 px-4 rounded-full">Aprovar</button> <button data-id="${shift.id}" data-action="decline" class="btn btn-danger text-xs font-bold py-2 px-4 rounded-full">Recusar</button>`;
            }
            if (isDonoOrAdm) {
                actionsHtml += `<button data-id="${shift.id}" data-action="delete-shift" class="btn btn-danger text-xs font-bold py-2 px-4 rounded-full ml-2">
                    <i class="fa-solid fa-trash-can"></i>
                </button>`;
            }

            card.innerHTML = `
                <div class="flex justify-between items-start flex-wrap gap-2">
                    <div>
                        <h4 class="font-bold text-lg text-white">
                            <span class="clickable-name" data-uid="${shift.requesterUid}">${shift.requester}</span> 
                            <i class="fa-solid fa-arrow-right-long text-gray-400 inline-block h-4 w-4 mx-2"></i>
                            <span class="clickable-name" data-uid="${shift.colleagueUid}">${shift.colleague}</span>
                        </h4>
                        <p class="text-sm text-gray-400">De: ${formatDateTime(shift.originalDate)} <br> Para: ${formatDateTime(shift.desiredDate)}</p>
                        ${shift.reason ? `<p class="text-sm text-gray-300 mt-2 italic">Motivo: "${shift.reason}"</p>` : ''}
                    </div>
                    <div class="text-right flex-shrink-0">
                        <span class="flex items-center justify-end text-sm font-semibold">
                            <i class="${statusInfo.icon} ${statusInfo.iconColor} h-4 w-4 mr-2"></i> 
                            ${displayStatusHTML}
                        </span>
                    </div>
                </div>
                ${actionsHtml ? `<div class="mt-4 pt-4 border-t border-gray-700 flex justify-end space-x-3">${actionsHtml}</div>` : ''}
            `;
            shiftList.appendChild(card);
        });
    }
    updateDashboardStats();
}

function updateDashboardStats() {
    const role = currentUserProfile.role;
    if (!currentUserProfile || (role !== 'supervisor' && role !== 'dono' && role !== 'adm')) {
        document.getElementById('dashboard-stats').classList.add('hidden');
        return;
    }
    document.getElementById('dashboard-stats').classList.remove('hidden');

    const isDonoOrAdm = role === 'dono' || role === 'adm';
    const currentUserRegion = normalizeRegion(currentUserProfile.regional);
    
    let shiftsToCount = [];
    if (isDonoOrAdm) {
        shiftsToCount = allShifts;
    } else if (currentUserProfile.role === 'supervisor' && currentUserRegion) {
        shiftsToCount = allShifts.filter(s => normalizeRegion(s.regional) === currentUserRegion);
    }

    const counts = shiftsToCount.reduce((acc, shift) => {
        const status = getShiftStatus(shift);
        if (status === 'Aguardando Confirmação' || status === 'Confirmada - Aguardando Supervisor') {
            acc.pending++;
        } else if (status === 'Aprovada') {
            acc.approved++;
        } else if (status.startsWith('Recusada')) {
            acc.rejected++;
        } else if (status === 'Expirada') {
            acc.expired++;
        }
        return acc;
    }, { pending: 0, approved: 0, rejected: 0, expired: 0 });

    document.getElementById('count-total').textContent = shiftsToCount.length;
    document.getElementById('count-pending').textContent = counts.pending;
    document.getElementById('count-approved').textContent = counts.approved;
    document.getElementById('count-rejected').textContent = counts.rejected;
    document.getElementById('count-expired').textContent = counts.expired;

    const exportContainer = document.getElementById('export-container');
    if (currentUserProfile && (role === 'dono' || role === 'adm')) {
        exportContainer.innerHTML = `
            <button id="delete-all-shifts-btn" class="btn btn-danger text-xs font-semibold py-2 px-3 rounded-full">Excluir Todas</button>
            <button id="export-json" class="btn btn-secondary text-xs font-semibold py-2 px-3 rounded-full">Exportar JSON</button>
        `;
        document.getElementById('export-json').addEventListener('click', exportDataAsJson);
        document.getElementById('delete-all-shifts-btn').addEventListener('click', () => {
            showActionModal('Excluir Todas as Trocas', 'Tem certeza que deseja EXCLUIR TODAS as trocas? Esta ação é irreversível.', 'btn-danger', deleteAllShifts);
        });
    } else if (currentUserProfile && role === 'supervisor') {
        exportContainer.innerHTML = `<button id="export-json" class="btn btn-secondary text-xs font-semibold py-2 px-3 rounded-full">Exportar JSON</button>`;
        document.getElementById('export-json').addEventListener('click', exportDataAsJson);
    } else {
        exportContainer.innerHTML = '';
    }
}

async function createNotification(userId, message, shiftId = null) {
    try {
        const notificationData = {
            userId,
            message,
            shiftId,
            read: false,
            createdAt: serverTimestamp()
        };
        await addDoc(collection(db, "notifications"), notificationData);
    } catch(error) {
        console.error("Erro ao criar notificação:", error);
    }
}

async function handleLogout() { 
    await signOut(auth);
    window.location.reload();
}

function handleProfileClick() { openProfileModal(currentUserProfile, true); }
function handleOpenDashboard() { openDashboardModal(); }
function handleOpenCalendar() { openCalendarModal(); }
function handleManageUsers() {
    const modalEl = createAndAppendModal(userListModalHTML());
    const userListContainer = modalEl.querySelector('#user-list-items');
    const searchInput = modalEl.querySelector('#user-search-input');
    
    const renderList = (filter = '') => {
        userListContainer.innerHTML = '';
        const filterText = filter.toLowerCase();
        const usersArray = Array.from(allUsers.values());

        usersArray
            .filter(user => user.name.toLowerCase().includes(filterText) || user.email.toLowerCase().includes(filterText))
            .forEach(user => {
                const photo = user.photoURL || `https://placehold.co/40x40/1a1a1a/f0f0f0?text=${user.name.charAt(0)}`;
                const userItem = document.createElement('div');
                userItem.className = 'user-list-item';
                userItem.dataset.uid = user.id;
                userItem.innerHTML = `
                    <img src="${photo}" alt="Avatar de ${user.name}" class="user-list-avatar">
                    <div class="flex-grow">
                        <p class="font-bold text-white">${user.name}</p>
                        <p class="text-sm text-gray-400">${user.email}</p>
                    </div>
                    <span class="user-list-role role-${user.role}">${user.role}</span>
                `;
                userListContainer.appendChild(userItem);
            });
    };

    renderList();

    searchInput.addEventListener('keyup', (e) => {
        renderList(e.target.value);
    });

    userListContainer.addEventListener('click', (e) => {
        const userItem = e.target.closest('.user-list-item');
        if (userItem) {
            const uid = userItem.dataset.uid;
            const userToView = allUsers.get(uid);
            if (userToView) {
                const isOwnProfile = uid === currentUserProfile.uid;
                openProfileModal(userToView, isOwnProfile);
            }
        }
    });
}
function handleOpenNotifications() { openNotificationsModal(); }

async function handleShiftFormSubmit(e) {
    e.preventDefault();
    const submitBtn = document.getElementById('submit-shift-btn');
    toggleButtonLoading(submitBtn, true);

    const colleagueSelect = document.getElementById('colleagueName');
    const selectedOption = colleagueSelect.options[colleagueSelect.selectedIndex];
    const colleagueName = selectedOption.value;
    const colleagueUid = selectedOption.dataset.uid;

    if (!colleagueUid) { 
        alert('Por favor, selecione um colega válido da lista.');
        toggleButtonLoading(submitBtn, false);
        return; 
    }
    
    const newShiftData = {
        requester: currentUserProfile.name, requesterUid: currentUserProfile.uid,
        colleague: colleagueName, colleagueUid: colleagueUid,
        originalDate: document.getElementById('originalDate').value,
        desiredDate: document.getElementById('desiredDate').value,
        reason: document.getElementById('reason').value,
        status: 'Aguardando Confirmação',
        createdAt: serverTimestamp(),
        regional: currentUserProfile.regional || 'Não especificada'
    };
    
    try {
        const docRef = await addDoc(collection(db, "shifts"), newShiftData);
        const notificationMessage = `${currentUserProfile.name} enviou uma solicitação de troca.`;
        await createNotification(colleagueUid, notificationMessage, docRef.id);

        e.target.reset();
        flatpickr("#originalDate").clear();
        flatpickr("#desiredDate").clear();
        document.getElementById('selected-colleague-preview').classList.add('hidden');
        document.getElementById('selected-colleague-preview').innerHTML = '';
    } catch (error) {
        console.error("Erro ao enviar solicitação:", error);
        alert("Falha ao enviar solicitação. Tente novamente.");
    } finally {
        toggleButtonLoading(submitBtn, false);
    }
}

function handleShiftListClick(e) {
    // Adicionada a classe '.supervisor-name' para que o clique seja detectado
    const nameSpan = e.target.closest('.clickable-name, .supervisor-name');
    const actionButton = e.target.closest('button');

    if (nameSpan) {
        const uid = nameSpan.dataset.uid;
        const userToView = allUsers.get(uid);
        if (userToView) {
            openProfileModal(userToView, uid === currentUserProfile.uid);
        }
        return;
    }

    if (actionButton) {
        const id = actionButton.dataset.id;
        const action = actionButton.dataset.action;
        const shift = allShifts.find(s => s.id === id);
        if (!shift) return;

        const performUpdate = async (newStatus) => {
            const updateData = { status: newStatus };

            if (newStatus === 'Aprovada' || newStatus === 'Recusada pelo Supervisor') {
                updateData.supervisorActionByName = currentUserProfile.name;
                updateData.supervisorActionById = currentUserProfile.uid;
                updateData.supervisorActionAt = serverTimestamp();
            }

            await updateDoc(doc(db, "shifts", id), updateData);
            
            const supervisors = Array.from(allUsers.values()).filter(u => u.role === 'supervisor' || u.role === 'dono' || u.role === 'adm');
            switch (newStatus) {
                case 'Confirmada - Aguardando Supervisor':
                    await createNotification(shift.requesterUid, `${shift.colleague} aceitou sua solicitação de troca.`, shift.id);
                    supervisors.forEach(sup => {
                        if (normalizeRegion(sup.regional) === normalizeRegion(shift.regional) || sup.role === 'dono' || sup.role === 'adm') {
                            createNotification(sup.id, `A troca entre ${shift.requester} e ${shift.colleague} aguarda aprovação.`, shift.id)
                        }
                    });
                    break;
                case 'Recusada':
                    await createNotification(shift.requesterUid, `${shift.colleague} recusou sua solicitação de troca.`, shift.id);
                    break;
                case 'Aprovada':
                    const approverName = currentUserProfile.name.split(' ')[0];
                    await createNotification(shift.requesterUid, `Sua troca com ${shift.colleague} foi APROVADA por ${approverName}.`, shift.id);
                    await createNotification(shift.colleagueUid, `Sua troca com ${shift.requester} foi APROVADA por ${approverName}.`, shift.id);
                    break;
                case 'Recusada pelo Supervisor':
                    const declinerName = currentUserProfile.name.split(' ')[0];
                    await createNotification(shift.requesterUid, `Sua troca com ${shift.colleague} foi RECUSADA pelo supervisor ${declinerName}.`, shift.id);
                    await createNotification(shift.colleagueUid, `Sua troca com ${shift.requester} foi RECUSADA pelo supervisor ${declinerName}.`, shift.id);
                    break;
            }
        };

        const actions = {
            accept: () => showActionModal('Aceitar Troca', `Confirma a troca do plantão?`, 'btn-success', () => performUpdate('Confirmada - Aguardando Supervisor')),
            reject: () => showActionModal('Recusar Troca', 'Tem certeza que deseja recusar?', 'btn-danger', () => performUpdate('Recusada')),
            approve: () => showActionModal('Aprovar Troca', 'Confirma a aprovação final?', 'btn-success', () => performUpdate('Aprovada')),
            decline: () => showActionModal('Recusar Troca', 'Tem certeza que deseja recusar?', 'btn-danger', () => performUpdate('Recusada pelo Supervisor')),
            'delete-shift': () => showActionModal('Excluir Troca', 'Tem certeza que deseja excluir esta troca?', 'btn-danger', () => deleteShift(id))
        };
        if (actions[action]) actions[action]();
    }
}

function handleColleaguesSelectChange() {
    const colleagueSelect = document.getElementById('colleagueName');
    const previewContainer = document.getElementById('selected-colleague-preview');
    
    if (!colleagueSelect || !previewContainer || !colleagueSelect.value || colleagueSelect.selectedIndex === 0) {
        if(previewContainer) {
            previewContainer.classList.add('hidden');
            previewContainer.innerHTML = '';
        }
        return;
    }

    const selectedOption = colleagueSelect.options[colleagueSelect.selectedIndex];
    const selectedColleagueUid = selectedOption.dataset.uid;

    if (selectedColleagueUid) {
        const selectedColleague = allUsers.get(selectedColleagueUid);
        if (selectedColleague) {
            const photo = selectedColleague.photoURL || `https://placehold.co/40x40/1a1a1a/f0f0f0?text=${selectedColleague.name.charAt(0)}`;
            const posto = selectedColleague.posto || 'Não informado';
            const cidade = selectedColleague.cidade || 'Não informado';
            previewContainer.innerHTML = `<img src="${photo}" class="w-10 h-10 rounded-full object-cover border border-white/20"><div><p class="font-bold text-white">${selectedColleague.name}</p><p class="text-xs text-gray-400">Posto: ${posto}</p><p class="text-xs text-gray-400">Cidade: ${cidade}</p></div>`;
            previewContainer.classList.remove('hidden');
        } else {
            previewContainer.classList.add('hidden');
        }
    } else {
        previewContainer.classList.add('hidden');
    }
}

function setupEventListeners() {
    document.getElementById('logout-btn')?.addEventListener('click', handleLogout);
    document.getElementById('profile-area')?.addEventListener('click', handleProfileClick);
    document.getElementById('open-dashboard-btn')?.addEventListener('click', handleOpenDashboard);
    document.getElementById('open-calendar-btn')?.addEventListener('click', handleOpenCalendar);
    document.getElementById('manage-users-btn')?.addEventListener('click', handleManageUsers);
    document.getElementById('notification-bell')?.addEventListener('click', handleOpenNotifications);
    document.getElementById('shift-list')?.addEventListener('click', handleShiftListClick);

    const shiftFormContainer = document.getElementById('form-section');
    if(shiftFormContainer.hasChildNodes()) {
        const shiftFormInner = shiftFormContainer.querySelector('#shift-form-inner');
        const colleagueNameSelect = document.getElementById('colleagueName');
        shiftFormInner?.addEventListener('submit', handleShiftFormSubmit);
        colleagueNameSelect?.addEventListener('change', handleColleaguesSelectChange);
    }
}

function openProfileModal(user, isOwnProfile) {
    const modalEl = createAndAppendModal(profileModalHTML(user, isOwnProfile));
    if (!modalEl) return;
    if (isOwnProfile) {
        const viewMode = modalEl.querySelector('#profile-view-mode');
        const editMode = modalEl.querySelector('#profile-edit-mode');
        
        modalEl.querySelector('#edit-profile-btn')?.addEventListener('click', () => { 
            viewMode.classList.add('hidden'); 
            editMode.classList.remove('hidden'); 
        });
        modalEl.querySelector('#cancel-edit-btn')?.addEventListener('click', () => { 
            viewMode.classList.remove('hidden'); 
            editMode.classList.add('hidden');
        });
        editMode?.addEventListener('submit', (e) => saveProfileData(e, modalEl));
    }
}

async function saveProfileData(e, modalEl) {
    e.preventDefault();
    const saveBtn = document.getElementById('save-profile-btn');
    toggleButtonLoading(saveBtn, true);

    const photoURL = document.getElementById('profile-photo-url').value;
    const posto = document.getElementById('profile-posto').value;
    
    if (!currentUserProfile || !currentUserProfile.uid) return;
    
    const dataToUpdate = { photoURL, posto };
    
    const userDocRef = doc(db, "users", currentUserProfile.uid);
    try {
        await updateDoc(userDocRef, dataToUpdate);
        hideModalContainer(modalEl);
    } catch (error) {
        console.error("Erro ao salvar perfil:", error);
        alert("Ocorreu um erro ao salvar. Tente novamente.");
    } finally {
        toggleButtonLoading(saveBtn, false);
    }
}

function openDashboardModal() {
    if (!currentUserProfile) return;

    const isDonoOrAdm = currentUserProfile.role === 'dono' || currentUserProfile.role === 'adm';
    const currentUserRegion = normalizeRegion(currentUserProfile.regional);
    const regionalTitle = isDonoOrAdm ? 'Todas as Regionais' : (currentUserProfile.regional || 'Sem Regional Definida');
    
    let shiftsToAnalyze = [];
    if (isDonoOrAdm) {
        shiftsToAnalyze = allShifts;
    } else if (currentUserProfile.role === 'supervisor' && currentUserRegion) {
        shiftsToAnalyze = allShifts.filter(s => normalizeRegion(s.regional) === currentUserRegion);
    }

    const modalEl = createAndAppendModal(dashboardModalHTML(regionalTitle));
    if (!modalEl) return;

    const animateCountUp = (el, endValue) => {
        let startValue = 0;
        const duration = 1000;
        const startTime = performance.now();

        function step(currentTime) {
            const elapsedTime = currentTime - startTime;
            const progress = Math.min(elapsedTime / duration, 1);
            el.textContent = Math.floor(progress * endValue).toLocaleString('pt-BR');
            if (progress < 1) {
                requestAnimationFrame(step);
            } else {
                el.textContent = endValue.toLocaleString('pt-BR');
            }
        }
        requestAnimationFrame(step);
    };

    const counts = shiftsToAnalyze.reduce((acc, shift) => {
        const status = getShiftStatus(shift);
        if (status === 'Aguardando Confirmação' || status === 'Confirmada - Aguardando Supervisor') acc.pending++;
        else if (status === 'Aprovada') acc.approved++;
        else if (status.startsWith('Recusada')) acc.rejected++;
        else if (status === 'Expirada') acc.expired++;
        return acc;
    }, { pending: 0, approved: 0, rejected: 0, expired: 0 });
    counts.total = shiftsToAnalyze.length;

    const statusDetails = shiftsToAnalyze.reduce((acc, s) => {
        const status = getShiftStatus(s);
        acc[status] = (acc[status] || 0) + 1;
        return acc;
    }, {});

    const monthlyCounts = shiftsToAnalyze.reduce((acc, s) => {
        if (s.createdAt?.toDate) {
            const month = s.createdAt.toDate().toLocaleString('pt-BR', { month: 'long' });
            const year = s.createdAt.toDate().getFullYear();
            const key = `${month.charAt(0).toUpperCase() + month.slice(1)} de ${year}`;
            acc[key] = (acc[key] || 0) + 1;
        }
        return acc;
    }, {});

    animateCountUp(modalEl.querySelector('#db-total-count'), counts.total);
    animateCountUp(modalEl.querySelector('#db-approved-count'), counts.approved);
    animateCountUp(modalEl.querySelector('#db-pending-count'), counts.pending);
    animateCountUp(modalEl.querySelector('#db-rejected-count'), counts.rejected);
    animateCountUp(modalEl.querySelector('#db-expired-count'), counts.expired);

    const statusListEl = modalEl.querySelector('#status-details-list');
    statusListEl.innerHTML = '';
    const statusColors = { 'Aprovada': 'var(--color-approved)', 'Recusada': 'var(--color-rejected)', 'Aguardando': 'var(--color-pending)', 'Confirmada': 'var(--color-pending)', 'Expirada': 'var(--color-expired)' };

    Object.entries(statusDetails).forEach(([status, count]) => {
        const percentage = counts.total > 0 ? (count / counts.total * 100).toFixed(1) : 0;
        let colorKey = Object.keys(statusColors).find(key => status.includes(key)) || 'var(--sun-yellow)';
        
        const itemHtml = `
            <div>
                <div class="flex justify-between items-center mb-1 text-sm">
                    <span class="font-semibold text-gray-300">${status}</span>
                    <span class="text-gray-400">${count} (${percentage}%)</span>
                </div>
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill" style="background-color: ${statusColors[colorKey] || '#6b7280'};" data-width="${percentage}%"></div>
                </div>
            </div>`;
        statusListEl.insertAdjacentHTML('beforeend', itemHtml);
    });

    setTimeout(() => {
        modalEl.querySelectorAll('.progress-bar-fill').forEach(bar => {
            bar.style.width = bar.dataset.width;
        });
    }, 100);

    const monthlyListEl = modalEl.querySelector('#monthly-stats-list');
    monthlyListEl.innerHTML = '';
    if (Object.keys(monthlyCounts).length > 0) {
        Object.entries(monthlyCounts).forEach(([month, count]) => {
            const itemHtml = `
                <div class="flex justify-between items-center text-sm p-2 rounded-md hover:bg-white/5">
                    <span class="text-gray-300">${month}</span>
                    <span class="font-bold text-white bg-gray-700 px-2 py-0.5 rounded-md">${count} trocas</span>
                </div>`;
            monthlyListEl.insertAdjacentHTML('beforeend', itemHtml);
        });
    } else {
        monthlyListEl.innerHTML = `<p class="text-center text-gray-500 text-sm">Nenhum dado mensal para esta regional.</p>`;
    }
}

function openCalendarModal() {
    const modalEl = createAndAppendModal(calendarModalHTML);
    const calendarEl = modalEl.querySelector('#calendar-container');

    const approvedShifts = allShifts.filter(s => getShiftStatus(s) === 'Aprovada');
    const calendarEvents = approvedShifts.flatMap(shift => {
        return [
            {
                title: `Plantão: ${shift.requester}`,
                start: shift.desiredDate,
                color: '#22c55e',
                extendedProps: { shiftId: shift.id }
            },
            {
                title: `Plantão: ${shift.colleague}`,
                start: shift.originalDate,
                color: '#3b82f6',
                extendedProps: { shiftId: shift.id }
            }
        ];
    });

    if (calendarInstance) {
        calendarInstance.destroy();
    }

    calendarInstance = new FullCalendar.Calendar(calendarEl, {
        locale: 'pt-br',
        initialView: 'dayGridMonth',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,listWeek'
        },
        buttonText: {
            today: 'hoje',
            month: 'mês',
            week: 'semana',
            list: 'lista'
        },
        events: calendarEvents,
    });

    setTimeout(() => {
        calendarInstance.render();
    }, 100);
}

function openNotificationsModal() {
    const modalEl = createAndAppendModal(notificationModalHTML());
    if (!modalEl) return;

    const notificationList = modalEl.querySelector('#notification-list');
    const notificationActions = modalEl.querySelector('#notification-actions');
    
    if (userNotifications.length === 0) {
        notificationList.innerHTML = `<p class="text-center text-gray-400 p-8">Nenhuma notificação encontrada.</p>`;
        return;
    }

    userNotifications.forEach(n => {
        const item = document.createElement('div');
        item.className = `notification-item p-4 rounded-lg cursor-pointer ${!n.read ? 'unread' : 'bg-white/5'}`;
        item.innerHTML = `
            <p class="text-white">${n.message}</p>
            <p class="text-xs text-gray-400 mt-1">${formatRelativeTime(n.createdAt)}</p>
        `;
        item.addEventListener('click', async () => {
            await markNotificationAsRead(n.id);
            if (n.shiftId) {
                hideModalContainer(modalEl);
                const shiftCard = document.getElementById(`shift-${n.shiftId}`);
                shiftCard?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                shiftCard?.classList.add('animate-pulse');
                setTimeout(() => shiftCard?.classList.remove('animate-pulse'), 2000);
            }
        });
        notificationList.appendChild(item);
    });
    
    const unreadCount = userNotifications.filter(n => !n.read).length;
    if (unreadCount > 0) {
        const markAllReadBtn = document.createElement('button');
        markAllReadBtn.className = 'btn btn-secondary w-full font-semibold py-2 rounded-full';
        markAllReadBtn.textContent = 'Marcar todas como lidas';
        markAllReadBtn.addEventListener('click', async () => {
            await markAllNotificationsAsRead();
            modalEl.querySelectorAll('.notification-item.unread').forEach(item => {
                item.classList.remove('unread');
                item.classList.add('bg-white/5');
            });
            markAllReadBtn.remove();
        });
        notificationActions.appendChild(markAllReadBtn);
    }
}

async function markNotificationAsRead(notificationId) {
    const notificationRef = doc(db, "notifications", notificationId);
    await updateDoc(notificationRef, { read: true });
}

async function markAllNotificationsAsRead() {
    const unread = userNotifications.filter(n => !n.read);
    if (unread.length === 0) return;

    const batch = writeBatch(db);
    unread.forEach(n => {
        const notificationRef = doc(db, "notifications", n.id);
        batch.update(notificationRef, { read: true });
    });
    await batch.commit();
}

function createAndAppendModal(innerHTML, targetContainer = modalContainer) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = innerHTML.trim();
    const modalEl = tempDiv.firstElementChild;
    if (!modalEl) return null;
    
    targetContainer.innerHTML = '';
    targetContainer.appendChild(modalEl);

    const closeModal = () => {
        hideModalContainer(modalEl, targetContainer);
    };

    modalEl.querySelectorAll('.modal-close').forEach(btn => btn.addEventListener('click', closeModal));
    modalEl.addEventListener('click', (e) => { if (e.target === modalEl) closeModal(); });
    
    showModalContainer(modalEl);
    return modalEl;
}

function showActionModal(title, message, confirmClass, onConfirm) {
    const modalEl = createAndAppendModal(confirmationModalHTML(title, message, confirmClass));
    if (!modalEl) return;
    modalEl.querySelector('#modalConfirm').addEventListener('click', () => { 
        onConfirm(); 
        hideModalContainer(modalEl); 
    });
}

function showModalContainer(modalEl) {
    if (!modalEl) return;
    setTimeout(() => {
        modalEl.classList.remove('opacity-0');
        const content = modalEl.querySelector('.modal-content');
        content?.classList.remove('scale-95', 'opacity-0');
    }, 10);
}

function hideModalContainer(modalEl, targetContainer = modalContainer) {
    if (!modalEl) return;
    modalEl.classList.add('opacity-0');
    const content = modalEl.querySelector('.modal-content');
    content?.classList.add('scale-95', 'opacity-0');
    setTimeout(() => { if(targetContainer.contains(modalEl)) targetContainer.innerHTML = ''; }, 300);
}

function formatDateTime(dateTimeString) {
    if (!dateTimeString) return 'N/A';
    const date = typeof dateTimeString.toDate === 'function' ? dateTimeString.toDate() : new Date(dateTimeString);
    return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatRelativeTime(timestamp) {
    if (!timestamp || typeof timestamp.toDate !== 'function') return '';
    const date = timestamp.toDate();
    const now = new Date();
    const seconds = Math.round((now - date) / 1000);
    const minutes = Math.round(seconds / 60);
    const hours = Math.round(minutes / 60);
    const days = Math.round(hours / 24);

    if (seconds < 60) return `há ${seconds} segundos`;
    if (minutes < 60) return `há ${minutes} minutos`;
    if (hours < 24) return `há ${hours} horas`;
    return `há ${days} dias`;
}

function exportDataAsJson() {
    const dataToExport = allShifts.map(s => {
        const newShift = {...s};
        if (newShift.createdAt?.toDate) newShift.createdAt = newShift.createdAt.toDate();
        if (newShift.supervisorActionAt?.toDate) newShift.supervisorActionAt = newShift.supervisorActionAt.toDate();
        return newShift;
    });
    const jsonContent = JSON.stringify(dataToExport, null, 2);
    const a = document.createElement('a');
    const blob = new Blob([jsonContent], { type: 'application/json' });
    a.href = URL.createObjectURL(blob);
    a.download = 'suncontrol_trocas.json';
    a.click();
    URL.revokeObjectURL(a.href);
}

async function deleteShift(shiftId) {
    try {
        await deleteDoc(doc(db, "shifts", shiftId));
    } catch (error) {
        console.error("Erro ao excluir troca:", error);
    }
}

async function deleteAllShifts() {
    try {
        const shiftsRef = collection(db, "shifts");
        const querySnapshot = await getDocs(shiftsRef);
        const batch = writeBatch(db);
        querySnapshot.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
    } catch (error) {
        console.error("Erro ao excluir todas as trocas:", error);
    }
}

document.addEventListener('DOMContentLoaded', initializeAuth);
