class DatabaseService {
    constructor() {
        this.tableName = 'users';
        this.dbName = 'db'; // Nombre físico para SQLite e IndexedDB
        this.tech = 'web';  // 'sqlite' | 'indexeddb' | 'web'
        
        this.db = null;     // Instancia de conexión (SQLite o IDB)
        this.ready = false;
    }

    // --- INICIALIZACIÓN INTELIGENTE ---
    async init() {
        // 1. Leer preferencia del usuario
        const pref = localStorage.getItem('miApp_tech');
        const isNative = window.Capacitor && window.Capacitor.isNative;

        // 2. Decidir tecnología
        if (pref) {
            this.tech = pref;
            if (this.tech === 'sqlite' && !isNative) {
                console.warn("SQLite no disponible en navegador. Cambiando a IndexedDB.");
                this.tech = 'indexeddb';
            }
        } else {
            this.tech = isNative ? 'sqlite' : 'indexeddb';
        }

        console.log(`Iniciando Base de Datos con motor: ${this.tech.toUpperCase()}`);

        try {
            if (this.tech === 'sqlite') await this.initSQLite();
            else if (this.tech === 'indexeddb') await this.initIndexedDB();
            else this.initWeb(); 

            this.ready = true;
            
            // --- AQUÍ LA MAGIA: AUTO-CREACIÓN DE SUPERUSUARIOS ---
            await this.seedSuperUsers();

        } catch (e) {
            console.error("Error FATAL DB:", e);
            // Fallback de emergencia
            this.tech = 'web';
            this.initWeb();
        }
    }

    // --- SEEDING (Creación de Superusuarios) ---
    async seedSuperUsers() {
        const admins = [
            {
                email: 'kenth1977@gmail.com',
                password: 'CR129x7848n',
                nombre: 'SuperAdmin Kenth',
                apellido1: 'System',
                apellido2: 'Admin',
                cedula: '111111111',
                nacimiento: '1977-01-01',
                movil: '88888888',
                telefono: '22222222',
                usuario: 'kenth',
                photo: 'https://ui-avatars.com/api/?name=Kenth+Admin&background=0D8ABC&color=fff'
            },
            {
                email: 'lthikingcr@gmail.com',
                password: 'CR129x7848n',
                nombre: 'SuperAdmin LT',
                apellido1: 'Hiking',
                apellido2: 'CR',
                cedula: '222222222',
                nacimiento: '1980-01-01',
                movil: '99999999',
                telefono: '33333333',
                usuario: 'lthiking',
                photo: 'https://ui-avatars.com/api/?name=LT+Hiking&background=random'
            }
        ];

        console.log(`[SEED] Verificando existencia de Superusuarios en ${this.tech}...`);

        for (const admin of admins) {
            try {
                // Buscamos si ya existe el correo (sin contraseña para encontrarlo por email)
                const exists = await this.find(admin.email);
                
                if (exists) {
                    // Si existe, verificamos si la contraseña coincide
                    if (exists.password !== admin.password) {
                        console.log(`[SEED] Corrigiendo credenciales para: ${admin.email}`);
                        // Actualización forzada
                        await this.update(admin.email, admin);
                    } else {
                        console.log(`[SEED] Admin verificado: ${admin.email}`);
                    }
                } else {
                    console.log(`[SEED] Creando nuevo admin: ${admin.email}`);
                    await this.insert(admin);
                }
            } catch (e) {
                console.warn(`[SEED] Error procesando admin ${admin.email}:`, e);
            }
        }
    }

    getStatus() {
        return {
            ready: this.ready,
            type: this.tech
        };
    }

    // --- MOTORES DE INICIALIZACIÓN ---

    async initSQLite() {
        this.sqlitePlugin = window.Capacitor.Plugins.CapacitorSQLite;
        this.db = await this.sqlitePlugin.createConnection(this.dbName, false, "no-encryption", 1, false);
        await this.sqlitePlugin.open({ database: this.dbName, readonly: false });
        await this.sqlitePlugin.execute({ database: this.dbName, statements: `
            CREATE TABLE IF NOT EXISTS users (
                email TEXT PRIMARY KEY, 
                password TEXT, 
                data TEXT
            );
        `});
    }

    initIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);
            
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.tableName)) {
                    db.createObjectStore(this.tableName, { keyPath: 'email' });
                }
            };

            request.onsuccess = (e) => {
                this.db = e.target.result;
                resolve();
            };

            request.onerror = (e) => reject(e.target.error);
        });
    }

    initWeb() {
        if (!localStorage.getItem(this.tableName)) {
            localStorage.setItem(this.tableName, JSON.stringify([]));
        }
    }

    // --- CRUD ROUTER ---

    async insert(data) {
        if (this.tech === 'sqlite') return this.insertSQLite(data);
        if (this.tech === 'indexeddb') return this.insertIDB(data);
        return this.insertWeb(data);
    }

    async find(email, password = null) {
        if (this.tech === 'sqlite') return this.findSQLite(email, password);
        if (this.tech === 'indexeddb') return this.findIDB(email, password);
        return this.findWeb(email, password);
    }

    async update(email, data) {
        if (this.tech === 'sqlite') return this.updateSQLite(email, data);
        if (this.tech === 'indexeddb') return this.updateIDB(email, data);
        return this.updateWeb(email, data);
    }

    async remove(email) {
        if (this.tech === 'sqlite') return this.removeSQLite(email);
        if (this.tech === 'indexeddb') return this.removeIDB(email);
        return this.removeWeb(email);
    }

    // --- IMPLEMENTACIÓN: SQLITE ---
    async insertSQLite(data) {
        const exists = await this.findSQLite(data.email);
        if (exists) throw new Error("Usuario ya existe");
        
        const query = "INSERT INTO users (email, password, data) VALUES (?, ?, ?)";
        await this.sqlitePlugin.run({ database: this.dbName, statement: query, values: [data.email, data.password, JSON.stringify(data)] });
        return data;
    }

    async findSQLite(email, password) {
        let query = "SELECT * FROM users WHERE email = ?";
        let values = [email];
        if (password) { query += " AND password = ?"; values.push(password); }
        
        const res = await this.sqlitePlugin.query({ database: this.dbName, statement: query, values });
        return (res.values && res.values.length > 0) ? JSON.parse(res.values[0].data) : null;
    }

    async updateSQLite(email, newData) {
        const user = await this.findSQLite(email);
        if (!user) throw new Error("Usuario no encontrado");
        const updated = { ...user, ...newData };
        const query = "UPDATE users SET password = ?, data = ? WHERE email = ?";
        await this.sqlitePlugin.run({ database: this.dbName, statement: query, values: [updated.password, JSON.stringify(updated), email] });
        return updated;
    }

    async removeSQLite(email) {
        await this.sqlitePlugin.run({ database: this.dbName, statement: "DELETE FROM users WHERE email = ?", values: [email] });
    }

    // --- IMPLEMENTACIÓN: INDEXEDDB ---
    insertIDB(data) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.tableName, 'readwrite');
            const store = tx.objectStore(this.tableName);
            
            const check = store.get(data.email);
            check.onsuccess = () => {
                if (check.result) {
                    reject(new Error("Usuario ya existe"));
                } else {
                    const addReq = store.add(data);
                    addReq.onsuccess = () => resolve(data);
                    addReq.onerror = () => reject(addReq.error);
                }
            };
            check.onerror = () => reject(check.error);
        });
    }

    findIDB(email, password) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.tableName, 'readonly');
            const store = tx.objectStore(this.tableName);
            const req = store.get(email);
            req.onsuccess = () => {
                const user = req.result;
                if (user && (!password || user.password === password)) resolve(user);
                else resolve(null);
            };
            req.onerror = () => reject(req.error);
        });
    }

    updateIDB(email, newData) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.tableName, 'readwrite');
            const store = tx.objectStore(this.tableName);
            const req = store.get(email);
            req.onsuccess = () => {
                const user = req.result;
                if (!user) { reject(new Error("No encontrado")); return; }
                const updated = { ...user, ...newData };
                const putReq = store.put(updated);
                putReq.onsuccess = () => resolve(updated);
                putReq.onerror = () => reject(putReq.error);
            };
            req.onerror = () => reject(req.error);
        });
    }

    removeIDB(email) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.tableName, 'readwrite');
            const store = tx.objectStore(this.tableName);
            const req = store.delete(email);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    // --- IMPLEMENTACIÓN: WEB (LocalStorage) ---
    insertWeb(data) {
        const users = JSON.parse(localStorage.getItem(this.tableName));
        if (users.some(u => u.email === data.email)) throw new Error("Usuario ya existe");
        users.push(data);
        localStorage.setItem(this.tableName, JSON.stringify(users));
        return data;
    }

    findWeb(email, password) {
        const users = JSON.parse(localStorage.getItem(this.tableName));
        return users.find(u => u.email === email && (!password || u.password === password)) || null;
    }

    updateWeb(email, newData) {
        let users = JSON.parse(localStorage.getItem(this.tableName));
        const idx = users.findIndex(u => u.email === email);
        if (idx === -1) throw new Error("No encontrado");
        users[idx] = { ...users[idx], ...newData };
        localStorage.setItem(this.tableName, JSON.stringify(users));
        return users[idx];
    }

    removeWeb(email) {
        let users = JSON.parse(localStorage.getItem(this.tableName));
        users = users.filter(u => u.email !== email);
        localStorage.setItem(this.tableName, JSON.stringify(users));
    }
}

const db = new DatabaseService();