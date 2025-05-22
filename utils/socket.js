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
        socket.on('join', (userId) => {
            socket.join(`user_${userId}`);
        });
    });

    ioInstance = io;
}

function emitToUser(userId, event, data) {
    if (ioInstance) {
        ioInstance.to(`user_${userId}`).emit(event, data);
    }
}

module.exports = { initSocket, emitToUser };
