const { PORT, SYSTEM_USERNAME, IDLE_TIMEOUT, MAX_MESSAGE_LENGTH } = require('./constants');
const log = require('./log');
const io = require('socket.io')(PORT, {
    pingTimeout: 60000, // https://github.com/socketio/socket.io/issues/3259
});

log.info(`Starting server on port: ${PORT}`);
log.info(`IDLE_TIMEOUT: ${IDLE_TIMEOUT}`);
log.info(`MAX_MESSAGE_LENGTH: ${MAX_MESSAGE_LENGTH}`);

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

        io.sockets.emit('new_message', systemMessage(`<i>${username} connected</i>`));

        socket.timeout = setTimeout(() => disconnectIdle(socket), IDLE_TIMEOUT);
        log.info(`${username} joined chat`);
    }
}

function newMessage(socket, message) {
    const error = validateMessage(message);

    clearTimeout(socket.timeout);
    socket.timeout = setTimeout(() => disconnectIdle(socket), IDLE_TIMEOUT);

    if (error) {
        socket.emit('new_message', systemMessage(error, true));
        log.info(`message error from ${message.username}: ${error}`);
    } else {
        io.sockets.emit('new_message', message);
        log.info(`message sent from ${message.username}`);
    }
}

function disconnect(socket) {
    if (socket.username) {
        const disconnectMessage = socket.idleDisconnect ? 'disconnected due to inactivity' : 'left chat';
        onlineUsers = onlineUsers.filter((e) => e !== socket.username);

        io.sockets.emit('online_users_update', onlineUsers);
        io.sockets.emit('new_message', systemMessage(`<i>${socket.username} ${disconnectMessage}</i>`));

        log.info(`${socket.username} left chat`);
    }
}

function disconnectIdle(socket) {
    socket.emit('disconnect_idle');
    socket.idleDisconnect = true;
    socket.disconnect();
    log.info(`${socket.username} disconnected after ${IDLE_TIMEOUT}ms of inactivity`);
}

function validateMessage({ message, username }) {
    if (!message) {
        return 'message_missing';
    }
    if (typeof message !== 'string') {
        return 'message_not_string';
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
        return 'message_too_long';
    }
    if (!username) {
        return 'username_missing';
    }
    if (!onlineUsers.includes(username)) {
        return 'user_not_registered';
    }

    return false;
}

function systemMessage(message, isError = false) {
    return {
        message,
        system: true,
        username: SYSTEM_USERNAME,
        error: isError,
    };
}

['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach((signal) => {
    process.on(signal, () => {
        log.info('closing server');

        io.close();

        process.exit(0);
    });
});
