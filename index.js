const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

let rooms = {};

io.on('connection', (socket) => {
    socket.on('createRoom', (roomName, createdBy) => {
        if (!rooms[roomName]) {
            rooms[roomName] = { roomName, createdBy, players: [], status: '대기중' };
            io.emit('roomList', Object.values(rooms));
        }
    });

    socket.on('joinRoom', (roomName, nickname) => {
        if (rooms[roomName]) {
            rooms[roomName].players.push(nickname);
            socket.join(roomName);
            io.to(roomName).emit('playerJoined', nickname);
            io.emit('roomList', Object.values(rooms));
        }
    });

    socket.on('move', (data) => {
        io.to(data.roomName).emit('opponentMove', data.move);
    });

    socket.on('sendMessage', (data) => {
        io.to(data.roomName).emit('newMessage', data.message);
    });

    socket.on('deleteRoom', (data) => {
        if (rooms[data.roomName].createdBy === data.requestedBy) {
            delete rooms[data.roomName];
            io.emit('roomList', Object.values(rooms));
        }
    });

    socket.on('disconnect', () => {
        for (let roomName in rooms) {
            rooms[roomName].players = rooms[roomName].players.filter(player => player !== socket.id);
            io.to(roomName).emit('playerLeft', socket.id);
            if (rooms[roomName].players.length === 0) {
                delete rooms[roomName];
            }
            io.emit('roomList', Object.values(rooms));
        }
    });
});

server.listen(3001, () => {
    console.log('Listening on port 3001');
});
