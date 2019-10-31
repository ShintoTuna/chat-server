const log = require('./log');
const PORT = process.env.PORT | 8080;
const io = require('socket.io')(PORT, {
    pingTimeout: 60000, // https://github.com/socketio/socket.io/issues/3259
});

log.info(`Starting server on port ${PORT}`);

const SYSTEM_USERNAME = 'System';
const IDLE_TIMEOUT = process.env.IDLE_TIMEOUT | 10000;

let onlineUsers = [];

io.on('connection', (socket) => {
    socket.timeout = 0;

    socket.on('register', (username) => {
        register(socket, username);
    });

    socket.on('new_message', (message) => {
        newMessage(socket, message);
    });

    socket.on('disconnect', () => {
        disconnect(socket);
    });
});

function register(socket, username) {
    const exists = [...onlineUsers, SYSTEM_USERNAME].find((user) => user.toLowerCase() === username.toLowerCase());

    if (exists) {
        socket.emit('registration_result', { success: false });
    } else {
        socket.username = username;
        onlineUsers = [...onlineUsers, username];

        socket.emit('registration_result', { success: true });
        io.sockets.emit('online_users_update', onlineUsers);

        io.sockets.emit('new_message', {
            message: `<i>${username} connected</i>`,
            username: SYSTEM_USERNAME,
        });

        socket.timeout = setTimeout(() => socket.disconnect(true), IDLE_TIMEOUT);
        log.info(`${username} joined chat`);
    }
}

function newMessage(socket, { message, username }) {
    clearTimeout(socket.timeout);
    socket.timeout = setTimeout(() => socket.disconnect(true), IDLE_TIMEOUT);

    io.sockets.emit('new_message', { message, username });
    log.info(`message sent from ${username}`);
}

function disconnect(socket) {
    if (socket.username) {
        onlineUsers = onlineUsers.filter((e) => e !== socket.username);
        io.sockets.emit('online_users_update', onlineUsers);

        io.sockets.emit('new_message', {
            message: `<i>${socket.username} disconnected</i>`,
            username: SYSTEM_USERNAME,
        });

        log.info(`${socket.username} left chat`);
    }
}

['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach((signal) => {
    process.on(signal, () => {
        log.info('closing server');

        io.close();

        process.exit(0);
    });
});
