class LocalDB {
    constructor() {
        this.TABLE_USERS = 'db_users';
        if (!localStorage.getItem(this.TABLE_USERS)) {
            localStorage.setItem(this.TABLE_USERS, JSON.stringify([]));
        }
    }

    // Método listo para reemplazar con conexión remota
    async connect() { return true; }

    insert(data) {
        const users = JSON.parse(localStorage.getItem(this.TABLE_USERS));
        if (users.some(u => u.email === data.email || u.usuario === data.usuario)) {
            throw new Error("El usuario o email ya existe");
        }
        users.push(data);
        localStorage.setItem(this.TABLE_USERS, JSON.stringify(users));
        return data;
    }

    find(email, password) {
        const users = JSON.parse(localStorage.getItem(this.TABLE_USERS));
        const user = users.find(u => u.email === email && u.password === password);
        if (!user) throw new Error("Credenciales incorrectas");
        return user;
    }

    update(emailKey, newData) {
        let users = JSON.parse(localStorage.getItem(this.TABLE_USERS));
        const index = users.findIndex(u => u.email === emailKey);
        if (index === -1) throw new Error("Usuario no encontrado");
        
        users[index] = { ...users[index], ...newData };
        localStorage.setItem(this.TABLE_USERS, JSON.stringify(users));
        return users[index];
    }

    remove(emailKey) {
        let users = JSON.parse(localStorage.getItem(this.TABLE_USERS));
        const newUsers = users.filter(u => u.email !== emailKey);
        localStorage.setItem(this.TABLE_USERS, JSON.stringify(newUsers));
    }
}
const db = new LocalDB();
