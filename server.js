// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');  // socket.io를 Server로 변경
const cors = require('cors');

const app = express();
app.use(cors());  // 모든 요청에 대해 CORS 허용

const server = http.createServer(app);
const io = new Server(server, {  // socket.io 서버 초기화
  cors: {
    origin: 'http://localhost:3000',  // 클라이언트가 실행 중인 도메인
    methods: ['GET', 'POST'],  // 허용할 메서드
    allowedHeaders: ['Content-Type'],  // 허용할 헤더
    credentials: true  // 자격 증명 허용
  }
});

let chatRooms = [];

io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('joinRoom', ({ roomName }) => {
    socket.join(roomName);
    console.log(`${socket.id} joined room: ${roomName}`);
  });

  socket.on('leaveRoom', ({ roomName }) => {
    socket.leave(roomName);
    console.log(`${socket.id} left room: ${roomName}`);
  });

  socket.on('message', ({ roomName, message, user }) => {
    io.to(roomName).emit('message', { user, message });
  });

  socket.on('createRoom', ({ roomName }) => {
    chatRooms.push(roomName);
    io.emit('updateRooms', chatRooms);
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

server.listen(3001, () => {
  console.log('listening on *:3001');
});
