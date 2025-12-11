const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Разрешаем всем подключаться
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// Раздаём статические файлы
app.use(express.static(__dirname));

// Все запросы → index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Хранилище в памяти (пока просто)
let boards = {};

io.on('connection', (socket) => {
  console.log('Новый пользователь:', socket.id);
  
  socket.on('join-board', (boardId) => {
    socket.join(boardId);
    
    if (!boards[boardId]) {
      boards[boardId] = {
        columns: [
          { id: 'todo', title: 'Сделать' },
          { id: 'progress', title: 'В работе' },
          { id: 'done', title: 'Готово' }
        ],
        cards: [
          { id: 'card1', title: 'Первая задача', columnId: 'todo' },
          { id: 'card2', title: 'Вторая задача', columnId: 'progress' }
        ]
      };
    }
    
    socket.emit('board-state', boards[boardId]);
  });
  
  socket.on('move-card', (data) => {
    const card = boards[data.boardId]?.cards.find(c => c.id === data.cardId);
    if (card) {
      card.columnId = data.toColumnId;
      socket.to(data.boardId).emit('card-moved', data);
    }
  });
  
  socket.on('create-card', (data) => {
    const newCard = {
      id: 'card_' + Date.now(),
      title: data.title,
      columnId: data.columnId
    };
    
    if (boards[data.boardId]) {
      boards[data.boardId].cards.push(newCard);
      io.to(data.boardId).emit('card-created', newCard);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Сервер запущен на порту ${PORT}`);
});