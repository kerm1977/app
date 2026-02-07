// --- LÓGICA DE NEGOCIO ---
const app = {
    user: null,
    selectedTech: 'web',
    showRefresh: localStorage.getItem('miApp_showRefresh') === 'true', // Estado del botón refresh

    // AQUÍ CONECTAMOS BIOMETRIC.JS COMO HIJO
    // Si biometricLogic existe (se cargó el script), lo mezclamos en app
    ...(typeof biometricLogic !== 'undefined' ? biometricLogic : {}),

    // --- HERRAMIENTAS DE DESARROLLADOR ---
    setupDevTools: () => {
        let clicks = 0;
        const header = document.getElementById('main-header');
        if (header) {
            header.addEventListener('click', (e) => {
                if (e.target.closest('button')) return;
                
                clicks++;
                
                if (clicks === 1) {
                    setTimeout(() => clicks = 0, 800);
                }
                
                if (clicks === 3) {
                    ui.toast("⚡ Recargando App...");
                    setTimeout(() => window.location.reload(), 300);
                    clicks = 0;
                }
            });
        }
    },

    // --- DASHBOARD LOGIC ---
    loadDashboardData: () => {
        const currentTech = localStorage.getItem('miApp_tech') || 'web';
        app.selectTech(currentTech);
        
        // Cargar estado del switch de Refresh
        const toggle = document.getElementById('refresh-toggle');
        if(toggle) toggle.checked = app.showRefresh;
    },

    selectTech: (techName) => {
        if(techName === 'cloud') return ui.toast('Próximamente');
        app.selectedTech = techName;
        document.querySelectorAll('.tech-card').forEach(el => el.classList.remove('active'));
        const card = document.getElementById(`card-${techName}`);
        if(card) card.classList.add('active');
    },

    saveTechSettings: () => {
        localStorage.setItem('miApp_tech', app.selectedTech);
        ui.toast(`Tecnología cambiada a: ${app.selectedTech.toUpperCase()}`);
        setTimeout(() => {
            router.navigate('home');
            window.location.reload();
        }, 1000);
    },

    // Trigger para el botón de refrescar
    toggleRefreshBtn: (e) => {
        app.showRefresh = e.target.checked;
        localStorage.setItem('miApp_showRefresh', app.showRefresh);
        ui.updateRefreshButton(app.showRefresh);
        ui.toast(app.showRefresh ? "Botón Activado" : "Botón Oculto");
    },

    // --- VISIBILIDAD BIOMETRÍA ---
    updateBiometricUI: () => {
        const btn = document.getElementById('btn-biometric');
        if (!btn) return;
        
        const hasCredentials = localStorage.getItem('miApp_remember');
        const isEnabled = localStorage.getItem('miApp_bio_enabled') === 'true';
        
        if (hasCredentials && isEnabled) {
            btn.classList.remove('hidden');
            btn.classList.add('flex');
        } else {
            btn.classList.add('hidden');
            btn.classList.remove('flex');
        }
    },

    // --- AUTH ---
    login: async (e) => {
        e.preventDefault();
        try {
            // FIX: Limpieza de email
            const email = document.getElementById('log-email').value.trim().toLowerCase();
            const pass = document.getElementById('log-pass').value;
            const remember = document.getElementById('log-remember')?.checked;

            const user = await db.find(email, pass);
            if (user) {
                // Guardar/Borrar preferencias de login
                if (remember) {
                    localStorage.setItem('miApp_remember', JSON.stringify({ email, pass }));
                } else {
                    localStorage.removeItem('miApp_remember');
                }
                app.startSession(user);
            } else {
                ui.toast("Credenciales incorrectas");
            }
        } catch(err) { ui.toast("Error: " + err.message); }
    },

    // Función para rellenar datos si existen
    checkRemembered: () => {
        const saved = localStorage.getItem('miApp_remember');
        if (saved) {
            try {
                const { email, pass } = JSON.parse(saved);
                setTimeout(() => {
                    const emailInput = document.getElementById('log-email');
                    const passInput = document.getElementById('log-pass');
                    const rememberInput = document.getElementById('log-remember');
                    
                    if (emailInput && passInput) {
                        emailInput.value = email;
                        passInput.value = pass;
                        if(rememberInput) rememberInput.checked = true;
                    }
                }, 150);
            } catch (e) { localStorage.removeItem('miApp_remember'); }
        }
    },

    register: async (e) => {
        e.preventDefault();
        const p1 = document.getElementById('reg-pass1').value;
        const p2 = document.getElementById('reg-pass2').value;
        const movil = document.getElementById('reg-movil')?.value;
        const telefono = document.getElementById('reg-telefono')?.value;

        if(p1 !== p2) return ui.toast('Contraseñas no coinciden');
        if(movil && !validators.isValidPhone(movil)) return ui.toast('Móvil debe tener 8 dígitos');
        if(telefono && !validators.isValidPhone(telefono)) return ui.toast('Teléfono debe tener 8 dígitos');

        const data = {
            nombre: document.getElementById('reg-nombre')?.value || '',
            apellido1: document.getElementById('reg-apellido1')?.value || '',
            apellido2: document.getElementById('reg-apellido2')?.value || '',
            cedula: document.getElementById('reg-cedula')?.value || '',
            nacimiento: document.getElementById('reg-nacimiento')?.value || '',
            movil: movil || '',
            telefono: telefono || '',
            // FIX: Normalizar email al registrar
            email: document.getElementById('reg-email').value.trim().toLowerCase(),
            usuario: document.getElementById('reg-usuario').value,
            password: p1,
            photo: document.getElementById('reg-preview')?.src || 'https://via.placeholder.com/150'
        };

        try {
            await db.insert(data);
            ui.toast('Registro exitoso');
            router.navigate('login');
        } catch(err) { ui.toast(err.message); }
    },

    startSession: (user) => {
        app.user = user;
        localStorage.setItem('miApp_current', JSON.stringify(user));
        router.navigate('home');
    },

    // --- CARGA DE DATOS HOME ---
    loadHomeData: () => {
        if(!app.user) return;
        setTimeout(() => {
            const display = document.getElementById('home-user-display');
            if(display) display.innerText = app.user.usuario || app.user.nombre || "Usuario";
            
            const statusDiv = document.querySelector('.w-2.h-2.rounded-full');
            const statusText = document.querySelector('span.text-xs.font-medium');
            
            if (statusDiv && statusText) {
                const dbStatus = db.getStatus ? db.getStatus() : { type: 'web' };
                
                let color = 'bg-orange-400';
                let label = 'Web Storage';

                if (dbStatus.type === 'sqlite') {
                    color = 'bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.6)]';
                    label = 'SQLite Nativo';
                } else if (dbStatus.type === 'indexeddb') {
                    color = 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.6)]';
                    label = 'IndexedDB';
                }

                statusDiv.className = `w-2 h-2 rounded-full ${color}`;
                statusText.innerText = `DB: ${label}`;
            }
        }, 100);
    },

    // --- PERFIL Y BIOMETRÍA ---
    loadProfileData: () => {
        if(!app.user) return;

        // 1. Mostrar configuración biometría si aplica
        const bioContainer = document.getElementById('bio-settings-container');
        const bioToggle = document.getElementById('bio-toggle');
        if (bioContainer) {
            bioContainer.classList.remove('hidden');
            const isEnabled = localStorage.getItem('miApp_bio_enabled') === 'true';
            if(bioToggle) bioToggle.checked = isEnabled;
        }

        // 2. Rellenar formulario con un pequeño delay para asegurar renderizado
        setTimeout(() => {
            const setVal = (id, val) => { 
                const el = document.getElementById(id); 
                if(el) el.value = (val !== undefined && val !== null) ? val : ''; 
            };

            setVal('edit-usuario', app.user.usuario);
            setVal('edit-email', app.user.email);
            
            // Datos personales completos
            setVal('edit-nombre', app.user.nombre);
            setVal('edit-apellido1', app.user.apellido1);
            setVal('edit-apellido2', app.user.apellido2);
            setVal('edit-cedula', app.user.cedula);
            setVal('edit-nacimiento', app.user.nacimiento);
            setVal('edit-movil', app.user.movil);
            setVal('edit-telefono', app.user.telefono);

            // Foto de perfil
            if(app.user.photo && !app.user.photo.includes('placeholder')) {
                const imgPreview = document.getElementById('edit-img-preview');
                if(imgPreview) imgPreview.src = app.user.photo;
            }
        }, 100);
    },
    
    toggleBiometry: async (checkbox) => {
        const enable = checkbox.checked;
        if(enable) {
             localStorage.setItem('miApp_bio_enabled', 'true');
             // Guardamos credenciales actuales para uso futuro
             if(app.user) {
                 localStorage.setItem('miApp_remember', JSON.stringify({
                     email: app.user.email,
                     pass: app.user.password
                 }));
             }
             ui.toast("Biometría activada (Simulada)");
        } else {
             localStorage.removeItem('miApp_bio_enabled');
             ui.toast("Biometría desactivada");
        }
    },

    updateProfile: async (e) => {
        e.preventDefault();
        const passOld = document.getElementById('edit-pass-old').value;
        const passNew = document.getElementById('edit-pass-new').value;
        const passConfirm = document.getElementById('edit-pass-confirm').value;
        
        const movil = document.getElementById('edit-movil').value;
        const telefono = document.getElementById('edit-telefono').value;

        if(movil && !validators.isValidPhone(movil)) return ui.toast('Móvil incorrecto');
        if(telefono && !validators.isValidPhone(telefono)) return ui.toast('Teléfono incorrecto');

        // Objeto de actualización base
        const updates = {
            nombre: document.getElementById('edit-nombre')?.value,
            apellido1: document.getElementById('edit-apellido1')?.value,
            apellido2: document.getElementById('edit-apellido2')?.value,
            cedula: document.getElementById('edit-cedula')?.value,
            nacimiento: document.getElementById('edit-nacimiento')?.value,
            movil: movil,
            telefono: telefono,
            email: document.getElementById('edit-email')?.value,
            usuario: document.getElementById('edit-usuario')?.value,
            photo: document.getElementById('edit-preview')?.src || document.getElementById('edit-img-preview')?.src
        };

        // --- VALIDACIÓN INTELIGENTE DE CONTRASEÑA ---
        // Solo intentamos cambiar contraseña si el usuario escribió algo en los campos NUEVOS.
        // Ignoramos passOld si passNew está vacío (evita bloqueo por autocompletado).
        if (passNew || passConfirm) {
            if (!passOld) return ui.toast('Ingresa tu contraseña actual para confirmar');
            if (!passNew) return ui.toast('Ingresa la nueva contraseña');
            if (!passConfirm) return ui.toast('Confirma la nueva contraseña');
            
            if (passOld !== app.user.password) return ui.toast('Contraseña actual incorrecta');
            if (passNew !== passConfirm) return ui.toast('Las nuevas contraseñas no coinciden');
            
            updates.password = passNew;
        }

        try {
            const updated = await db.update(app.user.email, updates);
            app.user = updated;
            localStorage.setItem('miApp_current', JSON.stringify(updated));
            
            // Si hubo cambio de contraseña, actualizar credenciales biométricas/remember
            if (updates.password && localStorage.getItem('miApp_bio_enabled') === 'true') {
                localStorage.setItem('miApp_remember', JSON.stringify({
                    email: app.user.email, 
                    pass: app.user.password 
                }));
            }

            ui.toast('Perfil actualizado correctamente');
            
            // Limpiar campos de contraseña
            document.getElementById('edit-pass-old').value = '';
            document.getElementById('edit-pass-new').value = '';
            document.getElementById('edit-pass-confirm').value = '';
            
        } catch(err) { 
            console.error(err);
            ui.toast('Error al actualizar perfil'); 
        }
    },

    deleteAccountInit: () => {
        ui.modal(`
            <div class="text-center">
                <h3 class="font-bold text-lg mb-4">¿Eliminar Cuenta?</h3>
                <p class="text-sm text-gray-500 mb-4">Esta acción es irreversible.</p>
                <div class="flex gap-2">
                    <button onclick="ui.closeModal()" class="w-full py-2 rounded-lg bg-gray-100">Cancelar</button>
                    <button onclick="app.finalDelete()" class="w-full py-2 rounded-lg bg-red-600 text-white font-bold">Eliminar</button>
                </div>
            </div>
        `);
    },

    finalDelete: async () => {
        try {
            await db.remove(app.user.email);
            app.logout();
            ui.closeModal();
            ui.toast('Cuenta eliminada');
        } catch(e) { ui.toast("Error al eliminar"); }
    },

    logout: () => {
        app.user = null;
        localStorage.removeItem('miApp_current');
        router.navigate('login');
    },

    // --- LOGIN BIOMETRICO (Bridge) ---
    loginBiometry: () => {
        if(app.loginBiometryLogic) app.loginBiometryLogic();
        else if(biometricLogic) biometricLogic.loginBiometry();
    },
    checkBiometryAvailability: async () => {
        return biometricLogic ? await biometricLogic.checkBiometryAvailability() : false;
    }
};

const router = {
    navigate: async (viewName) => {
        const outlet = document.getElementById('router-outlet');
        const header = document.getElementById('main-header');
        try {
            // FIX: Ruta plana y Cache Busting ?v=3 para evitar "Código Zombie"
            const response = await fetch(`${viewName}.html?v=3`);
            if (!response.ok) throw new Error("Vista no encontrada");
            const html = await response.text();
            outlet.innerHTML = `<div class="fade-in h-full">${html}</div>`;
            
            ui.updateRefreshButton(app.showRefresh);

            if (viewName === 'login' || viewName === 'register') {
                header.classList.add('hidden');
                if(viewName === 'login') {
                    app.checkRemembered();
                    if (app.updateBiometricUI) app.updateBiometricUI();
                }
            } else {
                header.classList.remove('hidden');
                if(viewName === 'home') app.loadHomeData();
                if(viewName === 'perfil') app.loadProfileData();
                if(viewName === 'dashboard') app.loadDashboardData();
            }
        } catch (error) {
            console.error(error);
            if(window.location.protocol === 'file:') ui.toast("Error: Usa Live Server");
            else ui.toast("Error cargando vista: " + viewName);
        }
    }
};