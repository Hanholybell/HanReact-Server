const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const app = express();

app.use(cors());
app.use(express.json());

// PostgreSQL 연결 설정
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,  // Render에서 설정한 DATABASE_URL 환경 변수
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,  // SSL 설정
});

const chatRooms = {};

// 회원가입 엔드포인트
app.post('/register', async (req, res) => {
  const { username, password, nickname } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);  // 비밀번호 암호화
    const result = await pool.query(
      'INSERT INTO users (username, password, nickname) VALUES ($1, $2, $3) RETURNING *',
      [username, hashedPassword, nickname]
    );
    res.status(201).json(result.rows[0]);  // 성공 시 새 사용자 정보 반환
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '회원가입 실패' });
  }
});

// 로그인 엔드포인트
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length > 0) {
      const user = result.rows[0];
      const match = await bcrypt.compare(password, user.password);
      if (match) {
        res.status(200).json({ username: user.username, nickname: user.nickname });  // 성공 시 사용자 정보 반환
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

// HTTP 서버 생성 및 WebSocket 서버 설정
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:3000', 'https://hanreact.onrender.com'],
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true,
  },
});

// WebSocket 연결 처리
io.on('connection', (socket) => {
  console.log('A user connected');
  
  socket.emit('initialRooms', Object.keys(chatRooms));  // 초기 방 목록 전송

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

// 포트 설정 및 서버 시작
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
