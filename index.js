const log = require('./log');
const PORT = process.env.PORT | 8080;
const io = require('socket.io')(PORT, {
    pingTimeout: 60000, // https://github.com/socketio/socket.io/issues/3259
});

log.info(`Starting server on port ${PORT}`);

const SYSTEM_USERNAME = 'System';
const MAX_MESSAGE_LENGTH = process.env.MAX_MESSAGE_LENGTH | 500;
const IDLE_TIMEOUT = process.env.IDLE_TIMEOUT | 100000;

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

        socket.timeout = setTimeout(() => socket.disconnect(true), IDLE_TIMEOUT);
        log.info(`${username} joined chat`);
    }
}

function newMessage(socket, message) {
    const error = validateMessage(message);

    clearTimeout(socket.timeout);
    socket.timeout = setTimeout(() => socket.disconnect(true), IDLE_TIMEOUT);

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
        onlineUsers = onlineUsers.filter((e) => e !== socket.username);

        io.sockets.emit('online_users_update', onlineUsers);
        io.sockets.emit('new_message', systemMessage(`<i>${socket.username} left chat</i>`));

        log.info(`${socket.username} left chat`);
    }
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
        message: `<i>${message}</i>`,
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
