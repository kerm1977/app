// --- EDITOR DE IMÁGENES (SALIDA 400PX) ---
const imageEditor = {
    currentImage: null,
    targetId: null,
    sliderValue: 1,
    baseScale: 1,
    posX: 0,
    posY: 0,
    viewSize: 300,   // Tamaño visual en pantalla
    outputSize: 400, // Tamaño real guardado en DB (400x400)

    // 1. CARGA INICIAL
    loadImage: (e, targetImgId) => {
        const input = e.target;
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            
            reader.onload = (event) => {
                // Optimización previa: Si la imagen es gigante (>2MB o >2000px), la redimensionamos antes de editar
                // para evitar que el canvas se quede sin memoria en móviles.
                const tempImg = new Image();
                tempImg.onload = () => {
                    try {
                        const maxDim = 1200;
                        let w = tempImg.width;
                        let h = tempImg.height;
                        
                        // Si es pequeña, pasar directo
                        if (w <= maxDim && h <= maxDim) {
                             imageEditor.currentImage = event.target.result;
                             imageEditor.targetId = targetImgId;
                             imageEditor.showInterface();
                             input.value = ''; // Limpiar input para permitir recargar la misma imagen
                             return;
                        }

                        // Redimensionar
                        if (w > h) {
                            if (w > maxDim) { h *= maxDim / w; w = maxDim; }
                        } else {
                            if (h > maxDim) { w *= maxDim / h; h = maxDim; }
                        }

                        const canvas = document.createElement('canvas');
                        canvas.width = w;
                        canvas.height = h;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(tempImg, 0, 0, w, h);

                        imageEditor.currentImage = canvas.toDataURL('image/jpeg', 0.9);
                    } catch (err) {
                        console.error("Fallo optimización, usando original", err);
                        imageEditor.currentImage = event.target.result;
                    }

                    imageEditor.targetId = targetImgId;
                    imageEditor.showInterface();
                    input.value = ''; 
                };
                
                tempImg.src = event.target.result;
            };
            
            reader.readAsDataURL(input.files[0]);
        }
    },

    // 2. INTERFAZ MODAL (CROPPER)
    showInterface: () => {
        // Reiniciar valores
        imageEditor.sliderValue = 1;
        imageEditor.posX = 0;
        imageEditor.posY = 0;

        ui.modal(`
            <div class="text-center w-full max-w-sm">
                <h3 class="font-bold text-lg mb-4 text-slate-800">Ajustar Foto</h3>
                
                <!-- Contenedor de visualización (300px) -->
                <div class="relative w-[300px] h-[300px] mx-auto bg-slate-900 rounded-full overflow-hidden border-4 border-indigo-500 shadow-xl mb-6 select-none touch-none"
                     id="editor-container">
                    
                    <img id="editor-img" class="absolute origin-center select-none pointer-events-none" 
                         style="left: 50%; top: 50%; transform: translate(-50%, -50%); max-width: none; max-height: none;">
                    
                    <!-- Loader -->
                    <div id="editor-loader" class="absolute inset-0 flex items-center justify-center text-white bg-slate-900 z-10">
                        <i class="ph ph-spinner animate-spin text-3xl"></i>
                    </div>
                </div>

                <!-- Controles -->
                <div class="px-4 mb-6">
                    <div class="flex justify-between text-xs text-slate-500 mb-2 font-bold uppercase tracking-wider">
                        <span>Zoom</span>
                        <span id="zoom-val">100%</span>
                    </div>
                    <input type="range" min="1" max="3" step="0.1" value="1" 
                           class="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                           oninput="imageEditor.updateZoom(this.value)">
                </div>

                <div class="grid grid-cols-2 gap-3">
                    <button onclick="ui.closeModal()" class="py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition">
                        Cancelar
                    </button>
                    <button onclick="imageEditor.saveImage()" class="py-3 rounded-xl font-bold text-white bg-indigo-600 shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition">
                        Guardar
                    </button>
                </div>
            </div>
        `);

        // Cargar imagen en el editor
        setTimeout(() => {
            const img = document.getElementById('editor-img');
            const loader = document.getElementById('editor-loader');
            
            img.onload = () => {
                loader.classList.add('hidden');
                // Calcular escala base para que cubra el círculo (Object-cover logic manual)
                const ratio = Math.max(imageEditor.viewSize / img.naturalWidth, imageEditor.viewSize / img.naturalHeight);
                imageEditor.baseScale = ratio;
                imageEditor.updateTransform();
                imageEditor.initGestures(); // Activar arrastre táctil/mouse
            };
            img.src = imageEditor.currentImage;
        }, 100);
    },

    // 3. LOGICA VISUAL (ZOOM Y PAN)
    updateZoom: (val) => {
        imageEditor.sliderValue = parseFloat(val);
        document.getElementById('zoom-val').innerText = Math.round(val * 100) + '%';
        imageEditor.updateTransform();
    },

    updateTransform: () => {
        const img = document.getElementById('editor-img');
        if(!img) return;
        const scale = imageEditor.baseScale * imageEditor.sliderValue;
        img.style.transform = `translate(calc(-50% + ${imageEditor.posX}px), calc(-50% + ${imageEditor.posY}px)) scale(${scale})`;
    },

    initGestures: () => {
        const container = document.getElementById('editor-container');
        let isDragging = false;
        let startX, startY, initialX, initialY;

        const start = (x, y) => {
            isDragging = true;
            startX = x;
            startY = y;
            initialX = imageEditor.posX;
            initialY = imageEditor.posY;
        };

        const move = (x, y) => {
            if (!isDragging) return;
            const dx = x - startX;
            const dy = y - startY;
            imageEditor.posX = initialX + dx;
            imageEditor.posY = initialY + dy;
            imageEditor.updateTransform();
        };

        const end = () => isDragging = false;

        // Mouse
        container.addEventListener('mousedown', e => start(e.clientX, e.clientY));
        window.addEventListener('mousemove', e => move(e.clientX, e.clientY));
        window.addEventListener('mouseup', end);

        // Touch
        container.addEventListener('touchstart', e => {
            e.preventDefault(); // Evitar scroll mientras editas
            start(e.touches[0].clientX, e.touches[0].clientY);
        });
        window.addEventListener('touchmove', e => move(e.touches[0].clientX, e.touches[0].clientY));
        window.addEventListener('touchend', end);
    },

    // 4. GUARDAR Y RECORTAR
    saveImage: () => {
        const img = document.getElementById('editor-img');
        const canvas = document.createElement('canvas');
        // El tamaño de salida es fijo (400x400)
        canvas.width = imageEditor.outputSize;
        canvas.height = imageEditor.outputSize;
        const ctx = canvas.getContext('2d');

        // Fondo blanco por si acaso
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Calcular coordenadas relativas
        // Centro del canvas
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;

        // Factor de conversión entre Vista (300px) y Salida (400px)
        const ratio = imageEditor.outputSize / imageEditor.viewSize;
        
        // Ajustamos escala y posición por el ratio
        const finalScale = imageEditor.baseScale * imageEditor.sliderValue * ratio;
        const finalX = imageEditor.posX * ratio;
        const finalY = imageEditor.posY * ratio;

        ctx.save();
        ctx.translate(cx + finalX, cy + finalY);
        ctx.scale(finalScale, finalScale);
        ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
        ctx.restore();

        const finalData = canvas.toDataURL('image/jpeg', 0.85);
        
        // Actualizar la imagen en la vista (Perfil o Registro)
        const targetEl = document.getElementById(imageEditor.targetId);
        if(targetEl) {
            targetEl.src = finalData;
            targetEl.classList.remove('hidden'); // Asegurar que se ve
        }

        // Hacks específicos para Register (ocultar iconos de placeholder)
        if (imageEditor.targetId === 'reg-preview') {
            const iconEl = document.getElementById('reg-icon');
            if (iconEl) iconEl.classList.add('hidden');
        }

        ui.closeModal();
    }
};