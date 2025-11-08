const pool = require('./dbConn');
let ioInstance = null;

function initSocket(server) {
    const { Server } = require('socket.io');
    const io = new Server(server, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST']
        }
    });

    io.on('connection', (socket) => {
        console.log('Socket conectado:', socket.id);
        socket.on('join', (userId) => socket.join(`user_${userId}`));
    });

    ioInstance = io;
}

async function emitNotification(userId, event, service = 'alexicon', data = {}, dbSave = true) {
    try {
        const payload = {
            id: null,
            seen: false,
            event,
            content: data ?? {},
            service,
            notif_date: new Date().toISOString()
        };

        if(!dbSave){
            emitToUser(userId, event, payload);
            return { ok: true, notifId: null, payload };
        }

        const [result] = await pool.execute(
            `INSERT INTO notifications (owner_id, event, content, service) VALUES (?, ?, ?, ?)`,
            [userId, event, JSON.stringify(payload.content), service]
        );
        payload.id = result.insertId;

        emitToUser(userId, event, payload);

        return { ok: true, notifId: payload.id, payload };
    } catch (err) {
        console.error('emitNotification error:', err);
        return { ok: false, error: err.message };
    }
}

function emitToUser(userId, event, data) {
    if (ioInstance)
        ioInstance.to(`user_${userId}`).emit(event, data);
}

module.exports = { initSocket, emitNotification }; // emitToUser,