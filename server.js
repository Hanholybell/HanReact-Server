const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const app = express();

app.use(cors());
app.use(express.json());

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'han',
  password: 'postgres',
  port: 5432,
});

const chatRooms = {};

app.post('/register', async (req, res) => {
  const { username, password, nickname } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, password, nickname) VALUES ($1, $2, $3) RETURNING *',
      [username, hashedPassword, nickname]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '회원가입 실패' });
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length > 0) {
      const user = result.rows[0];
      const match = await bcrypt.compare(password, user.password);
      if (match) {
        res.status(200).json({ username: user.username, nickname: user.nickname });
      } else {
        res.status(401).json({ error: '잘못된 비밀번호' });
      }
    } else {
      res.status(401).json({ error: '사용자를 찾을 수 없습니다' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '로그인 실패' });
  }
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true,
  },
});

io.on('connection', (socket) => {
  console.log('A user connected');
  
  // 클라이언트 연결 시 초기 방 목록 전송
  socket.emit('initialRooms', Object.keys(chatRooms));

  socket.on('joinRoom', ({ roomName }) => {
    if (!chatRooms[roomName]) {
      chatRooms[roomName] = [];
    }
    chatRooms[roomName].push(socket.id);
    socket.join(roomName);
    console.log(`${socket.id} joined room: ${roomName}`);
  });

  socket.on('leaveRoom', ({ roomName }) => {
    socket.leave(roomName);
    if (chatRooms[roomName]) {
      chatRooms[roomName] = chatRooms[roomName].filter(id => id !== socket.id);
      if (chatRooms[roomName].length === 0) {
        delete chatRooms[roomName];
      }
    }
    io.emit('updateRooms', Object.keys(chatRooms));  // 방 목록 갱신
    console.log(`${socket.id} left room: ${roomName}`);
  });

  socket.on('message', ({ roomName, message, user }) => {
    io.to(roomName).emit('message', { user, message });
  });

  socket.on('createRoom', ({ roomName }) => {
    if (!chatRooms[roomName]) {
      chatRooms[roomName] = [];
      io.emit('updateRooms', Object.keys(chatRooms));
    }
  });

  socket.on('disconnect', () => {
    for (const roomName in chatRooms) {
      chatRooms[roomName] = chatRooms[roomName].filter(id => id !== socket.id);
      if (chatRooms[roomName].length === 0) {
        delete chatRooms[roomName];
      }
    }
    io.emit('updateRooms', Object.keys(chatRooms));  // 방 목록 갱신
    console.log('A user disconnected');
  });
});

server.listen(3001, () => {
  console.log('Server is running on port 3001');
});