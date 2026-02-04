// --- CONFIGURACIÓN UI ---
const ui = {
    togglePass: (id, icon) => {
        const input = document.getElementById(id);
        const isPass = input.type === 'password';
        input.type = isPass ? 'text' : 'password';
        icon.classList.toggle('ph-eye');
        icon.classList.toggle('ph-eye-slash');
        icon.classList.toggle('text-indigo-600');
    },

    toast: (msg) => {
        const el = document.getElementById('toast');
        if(!el) return;
        el.innerText = msg;
        el.classList.remove('opacity-0', '-translate-y-10');
        setTimeout(() => el.classList.add('opacity-0', '-translate-y-10'), 3000);
    },

    modal: (html) => {
        document.getElementById('modal-content').innerHTML = html;
        document.getElementById('modal-overlay').classList.remove('hidden');
    },

    closeModal: () => {
        document.getElementById('modal-overlay').classList.add('hidden');
    },

    // --- EDITOR: CARGA DIRECTA (SIN PROCESAMIENTO PREVIO) ---
    // Solución definitiva para que la imagen siempre cargue rápido
    openImageEditor: (input, targetImgId) => {
        if (input.files && input.files[0]) {
            ui.toast("Cargando editor...");
            const reader = new FileReader();
            
            reader.onload = (e) => {
                // Asignación directa: Más rápida y compatible con móviles
                imageEditor.currentImage = e.target.result;
                imageEditor.targetId = targetImgId;
                imageEditor.showInterface();
                input.value = ''; 
            };
            
            reader.onerror = () => ui.toast("Error leyendo archivo");
            reader.readAsDataURL(input.files[0]);
        }
    }
};

// --- VALIDADORES ---
const validators = {
    nameInput: (e) => {
        let val = e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ]/g, '');
        if (val.length > 0) val = val.charAt(0).toUpperCase() + val.slice(1).toLowerCase();
        e.target.value = val;
    },
    numberInput: (e) => { 
        e.target.value = e.target.value.replace(/\D/g, ''); 
    },
    userInput: (e) => { 
        e.target.value = e.target.value.replace(/[^a-zA-Z0-9]/g, ''); 
    },
    isValidPhone: (str) => /^\d{8}$/.test(str)
};

// --- EDITOR DE IMÁGENES (SALIDA 400PX) ---
const imageEditor = {
    currentImage: null,
    targetId: null,
    sliderValue: 1,
    baseScale: 1,
    posX: 0,
    posY: 0,
    viewSize: 300,   // Tamaño visual en pantalla
    outputSize: 400, // Tamaño real guardado en DB

    showInterface: () => {
        ui.modal(`
            <div class="text-center w-full max-w-sm">
                <h3 class="font-bold text-lg mb-4 text-slate-800">Ajustar Foto</h3>
                
                <!-- Contenedor de visualización (300px) -->
                <div class="relative w-[300px] h-[300px] mx-auto bg-slate-900 rounded-full overflow-hidden border-4 border-indigo-500 shadow-xl mb-6 select-none">
                    <!-- Imagen con opacidad inicial 0 para evitar parpadeos -->
                    <img id="editor-img" class="absolute origin-center select-none pointer-events-none opacity-0 transition-opacity duration-300" 
                         style="left: 50%; top: 50%; transform: translate(-50%, -50%); max-width: none; max-height: none;">
                    
                    <div id="editor-loader" class="absolute inset-0 flex items-center justify-center text-white bg-slate-900 z-10">
                        <i class="ph ph-spinner animate-spin text-2xl"></i>
                    </div>
                </div>

                <div class="space-y-4 px-4">
                    <div>
                        <label class="text-xs font-bold text-slate-500 uppercase flex justify-between"><span>Zoom</span> <span id="lbl-scale">100%</span></label>
                        <input type="range" min="0.5" max="3" step="0.1" value="1" oninput="imageEditor.updatePreview(this.value, 'scale')" class="w-full accent-indigo-600">
                    </div>
                    <div>
                        <label class="text-xs font-bold text-slate-500 uppercase">Posición</label>
                        <div class="flex gap-2">
                            <input type="range" min="-200" max="200" step="1" value="0" oninput="imageEditor.updatePreview(this.value, 'x')" class="w-full accent-indigo-600">
                            <input type="range" min="-200" max="200" step="1" value="0" oninput="imageEditor.updatePreview(this.value, 'y')" class="w-full accent-indigo-600">
                        </div>
                    </div>
                </div>

                <div class="flex gap-2 mt-8">
                    <button onclick="ui.closeModal()" class="w-full py-2 rounded-lg bg-gray-100 font-medium hover:bg-gray-200 transition">Cancelar</button>
                    <button onclick="imageEditor.save()" class="w-full py-2 rounded-lg bg-indigo-600 text-white font-bold shadow-lg hover:bg-indigo-700 transition">Confirmar</button>
                </div>
            </div>
        `);

        setTimeout(() => {
            const img = document.getElementById('editor-img');
            if (!img) return;

            img.onload = () => {
                const loader = document.getElementById('editor-loader');
                if(loader) loader.classList.add('hidden');
                img.classList.remove('opacity-0');

                // Calcular ajuste automático
                const w = img.naturalWidth || img.width;
                const h = img.naturalHeight || img.height;
                const scaleW = imageEditor.viewSize / w;
                const scaleH = imageEditor.viewSize / h;
                
                // "Cover" lógico
                imageEditor.baseScale = Math.max(scaleW, scaleH);
                
                if (!isFinite(imageEditor.baseScale) || imageEditor.baseScale === 0) imageEditor.baseScale = 1;

                imageEditor.sliderValue = 1;
                imageEditor.posX = 0;
                imageEditor.posY = 0;
                imageEditor.updateVisuals();
            };
            
            img.onerror = () => {
                ui.toast("Error visualizando la imagen");
                ui.closeModal();
            };

            img.src = imageEditor.currentImage;
        }, 100);
    },

    updatePreview: (val, type) => {
        if (type === 'scale') imageEditor.sliderValue = parseFloat(val);
        if (type === 'x') imageEditor.posX = parseInt(val);
        if (type === 'y') imageEditor.posY = parseInt(val);
        imageEditor.updateVisuals();
    },

    updateVisuals: () => {
        const img = document.getElementById('editor-img');
        const lbl = document.getElementById('lbl-scale');
        const finalScale = imageEditor.baseScale * imageEditor.sliderValue;
        
        if (lbl) lbl.innerText = Math.round(imageEditor.sliderValue * 100) + '%';
        if (img) img.style.transform = `translate(calc(-50% + ${imageEditor.posX}px), calc(-50% + ${imageEditor.posY}px)) scale(${finalScale})`;
    },

    save: () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = () => {
            // Salida exacta 400x400
            canvas.width = imageEditor.outputSize;
            canvas.height = imageEditor.outputSize;
            
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            const cx = canvas.width / 2;
            const cy = canvas.height / 2;
            
            // Factor de conversión (400 / 300 = 1.333)
            const ratio = imageEditor.outputSize / imageEditor.viewSize;
            const finalScale = imageEditor.baseScale * imageEditor.sliderValue * ratio;

            ctx.save();
            ctx.translate(cx + (imageEditor.posX * ratio), cy + (imageEditor.posY * ratio));
            ctx.scale(finalScale, finalScale);
            ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
            ctx.restore();

            const finalData = canvas.toDataURL('image/jpeg', 0.85);
            
            const targetEl = document.getElementById(imageEditor.targetId);
            if(targetEl) {
                targetEl.src = finalData;
                targetEl.classList.remove('hidden');
            }

            if (imageEditor.targetId === 'reg-preview') {
                const iconEl = document.getElementById('reg-icon');
                if (iconEl) iconEl.classList.add('hidden');
            }
            
            if (imageEditor.targetId === 'edit-preview') {
                const ph = document.getElementById('edit-placeholder');
                if (ph) ph.classList.add('hidden');
            }

            ui.closeModal();
        };
        img.src = imageEditor.currentImage;
    }
};

// --- LÓGICA DE NEGOCIO ---
const app = {
    user: null,
    selectedTech: 'web', // Valor por defecto

    // --- DASHBOARD LOGIC ---
    loadDashboardData: () => {
        const currentTech = localStorage.getItem('miApp_tech') || 'web';
        app.selectTech(currentTech);
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

    // --- AUTH ---
    login: async (e) => {
        e.preventDefault();
        try {
            // FIX CRÍTICO: Normalizar email (eliminar espacios y minúsculas)
            const email = document.getElementById('log-email').value.trim().toLowerCase();
            const pass = document.getElementById('log-pass').value;
            
            const user = await db.find(email, pass);
            if (user) {
                app.startSession(user);
            } else {
                ui.toast("Credenciales incorrectas");
            }
        } catch(err) { ui.toast("Error: " + err.message); }
    },

    register: async (e) => {
        e.preventDefault();
        const p1 = document.getElementById('reg-pass1').value;
        const p2 = document.getElementById('reg-pass2').value;
        const movil = document.getElementById('reg-movil').value;
        const telefono = document.getElementById('reg-telefono').value;

        if(p1 !== p2) return ui.toast('Contraseñas no coinciden');
        if(!validators.isValidPhone(movil)) return ui.toast('Móvil debe tener 8 dígitos');
        if(telefono && !validators.isValidPhone(telefono)) return ui.toast('Teléfono debe tener 8 dígitos');

        const data = {
            nombre: document.getElementById('reg-nombre').value,
            apellido1: document.getElementById('reg-apellido1').value,
            apellido2: document.getElementById('reg-apellido2').value,
            cedula: document.getElementById('reg-cedula').value,
            nacimiento: document.getElementById('reg-nacimiento').value,
            movil: movil,
            telefono: telefono,
            // FIX CRÍTICO: Normalizar email al registrar
            email: document.getElementById('reg-email').value.trim().toLowerCase(),
            usuario: document.getElementById('reg-usuario').value,
            password: p1,
            photo: document.getElementById('reg-preview').src || 'https://via.placeholder.com/150'
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

    // --- CARGA DE DATOS ---
    loadHomeData: () => {
        if(!app.user) return;
        setTimeout(() => {
            const display = document.getElementById('home-user-display');
            if(display) display.innerText = app.user.nombre;
            
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

    loadProfileData: () => {
        if(!app.user) return;
        setTimeout(() => {
            document.getElementById('edit-nombre').value = app.user.nombre;
            document.getElementById('edit-apellido1').value = app.user.apellido1;
            document.getElementById('edit-apellido2').value = app.user.apellido2;
            document.getElementById('edit-cedula').value = app.user.cedula;
            document.getElementById('edit-nacimiento').value = app.user.nacimiento;
            document.getElementById('edit-movil').value = app.user.movil;
            document.getElementById('edit-telefono').value = app.user.telefono;
            document.getElementById('edit-email').value = app.user.email;
            document.getElementById('edit-usuario').value = app.user.usuario;
            
            const preview = document.getElementById('edit-preview');
            const placeholder = document.getElementById('edit-placeholder');
            
            if(app.user.photo && !app.user.photo.includes('placeholder')) {
                preview.src = app.user.photo;
                preview.classList.remove('hidden');
                if(placeholder) placeholder.classList.add('hidden');
            }
        }, 50);
    },

    updateProfile: async (e) => {
        e.preventDefault();
        const passOld = document.getElementById('edit-pass-old').value;
        const passNew = document.getElementById('edit-pass-new').value;
        const passConfirm = document.getElementById('edit-pass-confirm').value;
        const movil = document.getElementById('edit-movil').value;
        const telefono = document.getElementById('edit-telefono').value;

        if(!validators.isValidPhone(movil)) return ui.toast('Móvil incorrecto');
        if(telefono && !validators.isValidPhone(telefono)) return ui.toast('Teléfono incorrecto');

        const updates = {
            nombre: document.getElementById('edit-nombre').value,
            apellido1: document.getElementById('edit-apellido1').value,
            apellido2: document.getElementById('edit-apellido2').value,
            nacimiento: document.getElementById('edit-nacimiento').value,
            movil: movil,
            telefono: telefono,
            email: document.getElementById('edit-email').value,
            usuario: document.getElementById('edit-usuario').value,
            photo: document.getElementById('edit-preview').src
        };

        if (passOld || passNew || passConfirm) {
            if (!passOld || !passNew || !passConfirm) return ui.toast('Faltan campos de contraseña');
            if (passOld !== app.user.password) return ui.toast('Contraseña actual incorrecta');
            if (passNew !== passConfirm) return ui.toast('Nuevas no coinciden');
            updates.password = passNew;
        }

        try {
            const updated = await db.update(app.user.email, updates);
            app.user = updated;
            localStorage.setItem('miApp_current', JSON.stringify(updated));
            ui.toast('Perfil actualizado');
            document.getElementById('edit-pass-old').value = '';
            document.getElementById('edit-pass-new').value = '';
            document.getElementById('edit-pass-confirm').value = '';
        } catch(err) { ui.toast('Error al actualizar'); }
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
    }
};

// --- ROUTER ---
const router = {
    navigate: async (viewName) => {
        const outlet = document.getElementById('router-outlet');
        const header = document.getElementById('main-header');
        try {
            const response = await fetch(`${viewName}.html`);
            if (!response.ok) throw new Error("Vista no encontrada");
            const html = await response.text();
            outlet.innerHTML = `<div class="fade-in h-full">${html}</div>`;
            
            if (viewName === 'login' || viewName === 'register') {
                header.classList.add('hidden');
            } else {
                header.classList.remove('hidden');
                if(viewName === 'home') app.loadHomeData();
                if(viewName === 'perfil') app.loadProfileData();
                if(viewName === 'dashboard') app.loadDashboardData();
            }
        } catch (error) {
            console.error(error);
            if(window.location.protocol === 'file:') ui.toast("Error: Usa Live Server");
            else ui.toast("Error cargando vista");
        }
    }
};

// EXPOSICIÓN GLOBAL
window.app = app;
window.ui = ui;
window.validators = validators;
window.router = router;

// Arranque
window.onload = async () => {
    if(typeof db !== 'undefined' && db.init) await db.init();
    
    const saved = localStorage.getItem('miApp_current');
    if(saved) {
        app.user = JSON.parse(saved);
        router.navigate('home');
    } else {
        router.navigate('login');
    }
};