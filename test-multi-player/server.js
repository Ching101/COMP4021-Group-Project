const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

const rooms = {};
const players = {};
const MATCH_DURATION = 180; // 3 minutes in seconds

class Room {
    constructor(id) {
        this.id = id;
        this.players = {};
        this.gameState = {
            weapons: [],
            powerUps: [],
            matchStartTime: null,
            isActive: false
        };
    }

    addPlayer(playerId, playerData) {
        this.players[playerId] = playerData;
        if (Object.keys(this.players).length >= 2) {
            this.startMatch();
        }
    }

    startMatch() {
        this.gameState.isActive = true;
        this.gameState.matchStartTime = Date.now();
        this.spawnPowerUp();
        this.spawnWeapon();
    }

    spawnPowerUp() {
        const powerUp = {
            x: Math.random() * 700,
            y: Math.random() * 500,
            type: ['health', 'speed', 'attack'][Math.floor(Math.random() * 3)]
        };
        this.gameState.powerUps.push(powerUp);
    }

    spawnWeapon() {
        const weapon = {
            x: Math.random() * 700,
            y: Math.random() * 500,
            type: ['dagger', 'sword', 'bow'][Math.floor(Math.random() * 3)]
        };
        this.gameState.weapons.push(weapon);
    }
}

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Create new player with initial position
    players[socket.id] = {
        x: Math.floor(Math.random() * 700),
        y: Math.floor(Math.random() * 500),
        health: 100
    };
    
    console.log('Players after connection:', players);

    // Emit the current players to the new player
    socket.emit('currentPlayers', players);
    
    // Emit the new player to all other players
    socket.broadcast.emit('newPlayer', players[socket.id], socket.id);

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

const PORT = 8000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});