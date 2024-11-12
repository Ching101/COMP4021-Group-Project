const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const PORT = process.env.PORT || 8000;

// Serve static files
app.use(express.static('public'));
app.use('/client', express.static(path.join(__dirname, '../client')));

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('A user connected');
    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});
// Start server
http.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});