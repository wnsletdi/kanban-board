const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Раздаём статические файлы
app.use(express.static(__dirname));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Хранилище данных
let boards = {};

// функция для проверки ID
function isValidId(id) {
  return id && typeof id === 'string' && id.length > 0;
}

io.on('connection', (socket) => {
  console.log('Новый пользователь:', socket.id);
  
  // Присоединение к доске
  socket.on('join-board', (boardId) => {
    if (!isValidId(boardId)) return;
    
    socket.join(boardId);
    
    if (!boards[boardId]) {
      boards[boardId] = {
        columns: [
          { id: 'todo', title: 'Сделать' },
          { id: 'progress', title: 'В работе' },
          { id: 'done', title: 'Готово' }
        ],
        cards: [
          { id: 'card1', title: 'Первая задача', columnId: 'todo', description: '' },
          { id: 'card2', title: 'Вторая задача', columnId: 'progress', description: '' }
        ]
      };
    }
    
    socket.emit('board-state', boards[boardId]);
  });
  
  // Создание карточки
  socket.on('create-card', (data) => {
    if (!isValidId(data.boardId) || !isValidId(data.columnId) || !data.title?.trim()) return;
    
    const newCard = {
      id: 'card_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      title: data.title.trim().substring(0, 200), // Ограничение длины
      description: (data.description || '').trim().substring(0, 1000),
      columnId: data.columnId,
      createdAt: new Date().toISOString()
    };
    
    if (boards[data.boardId]) {
      boards[data.boardId].cards.push(newCard);
      io.to(data.boardId).emit('card-created', newCard);
    }
  });
  
  // Обновление карточки
  socket.on('update-card', (data) => {
    if (!isValidId(data.boardId) || !isValidId(data.cardId)) return;
    
    const board = boards[data.boardId];
    if (!board) return;
    
    const cardIndex = board.cards.findIndex(card => card.id === data.cardId);
    if (cardIndex === -1) return;
    
    if (data.title !== undefined) {
      board.cards[cardIndex].title = data.title.trim().substring(0, 200);
    }
    if (data.description !== undefined) {
      board.cards[cardIndex].description = data.description.trim().substring(0, 1000);
    }
    if (data.columnId !== undefined && isValidId(data.columnId)) {
      board.cards[cardIndex].columnId = data.columnId;
    }
    
    io.to(data.boardId).emit('card-updated', {
      cardId: data.cardId,
      title: board.cards[cardIndex].title,
      description: board.cards[cardIndex].description,
      columnId: board.cards[cardIndex].columnId,
      updatedBy: socket.id
    });
  });
  
  // Удаление карточки
  socket.on('delete-card', (data) => {
    if (!isValidId(data.boardId) || !isValidId(data.cardId)) return;
    
    const board = boards[data.boardId];
    if (!board) return;
    
    const cardIndex = board.cards.findIndex(card => card.id === data.cardId);
    if (cardIndex === -1) return;
    
    const deletedCard = board.cards.splice(cardIndex, 1)[0];
    
    io.to(data.boardId).emit('card-deleted', {
      cardId: data.cardId,
      columnId: deletedCard.columnId,
      deletedBy: socket.id
    });
  });
  
  // Перемещение карточки
  socket.on('move-card', (data) => {
    if (!isValidId(data.boardId) || !isValidId(data.cardId) || !isValidId(data.toColumnId)) return;
    
    const card = boards[data.boardId]?.cards.find(c => c.id === data.cardId);
    if (card) {
      const fromColumnId = card.columnId;
      card.columnId = data.toColumnId;
      
      socket.to(data.boardId).emit('card-moved', {
        cardId: data.cardId,
        fromColumnId: fromColumnId,
        toColumnId: data.toColumnId,
        movedBy: socket.id
      });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(` Сервер запущен на порту ${PORT}`);
});
