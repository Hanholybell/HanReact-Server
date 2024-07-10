const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: 'http://localhost:3000',
        methods: ['GET', 'POST']
    }
});

app.use(cors());

let rooms = {}; // 방 정보를 저장하는 객체

io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('getRoomList', () => {
        io.emit('roomList', Object.values(rooms));
    });

    socket.on('createRoom', (roomName, password, callback) => {
        if (!rooms[roomName]) {
            rooms[roomName] = { name: roomName, password, players: 0, playerNicknames: [], status: '대기중', owner: socket.id };
            socket.join(roomName);
            rooms[roomName].players++;
            rooms[roomName].playerNicknames.push(socket.nickname);
            io.emit('roomList', Object.values(rooms));
            socket.emit('roomJoined', rooms[roomName]);
            if (callback) callback(true, rooms[roomName]);
        } else {
            socket.emit('roomExists', roomName);
        }
    });

    socket.on('joinRoom', ({ roomName, nickname }, callback) => {
        const room = rooms[roomName];
        if (room) {
            socket.join(roomName);
            rooms[roomName].players++;
            rooms[roomName].playerNicknames.push(nickname);
            rooms[roomName].status = rooms[roomName].players === 2 ? '플레이 중' : '대기중';
            io.emit('roomList', Object.values(rooms));
            if (callback) callback(true, rooms[roomName]);
            io.to(roomName).emit('updatePlayers', rooms[roomName].playerNicknames);
        }
    });

    socket.on('sendMessage', ({ roomName, message }) => {
        io.to(roomName).emit('receiveMessage', message);
    });

    socket.on('move', ({ roomName, move }) => {
        io.to(roomName).emit('opponentMove', move);
    });

    socket.on('deleteRoom', (roomName) => {
        delete rooms[roomName];
        io.emit('roomList', Object.values(rooms));
        io.to(roomName).emit('roomDeleted');
    });

    socket.on('disconnect', () => {
        for (let roomName in rooms) {
            const room = rooms[roomName];
            if (room) {
                const playerIndex = room.playerNicknames.indexOf(socket.nickname);
                if (playerIndex !== -1) {
                    room.playerNicknames.splice(playerIndex, 1);
                }
                room.players--;
                if (room.players === 0 || room.owner === socket.id) {
                    delete rooms[roomName];
                } else {
                    room.status = '대기중';
                }
                io.emit('roomList', Object.values(rooms));
                io.to(roomName).emit('updatePlayers', room.playerNicknames);
            }
        }
        console.log('A user disconnected');
    });
});

server.listen(3001, () => {
    console.log('Server is running on port 3001');
});
