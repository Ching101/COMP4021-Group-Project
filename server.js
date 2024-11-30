const express = require("express")

const bcrypt = require("bcrypt")
const fs = require("fs")
const session = require("express-session")

// Create the Express app
const app = express()

// Use the 'public' folder to serve static files
app.use(express.static("public"))

// Use the json middleware to parse JSON data
app.use(express.json())

// Create the Socket.IO server
const { Server } = require("socket.io")
const httpServer = require("http").createServer(app)

// Create session middleware
const sessionMiddleware = session({
    secret: "secret_key",
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        maxAge: 1000 * 60 * 60 * 24,
    },
})

// Use the session middleware with Express
app.use(sessionMiddleware)

// Create Socket.IO server
const io = new Server(httpServer)

// Use session middleware with Socket.IO
io.use((socket, next) => {
    sessionMiddleware(socket.request, socket.request.res || {}, next)
})

// Store online users
const onlineUsers = {}
const userSocketMap = new Map();

// Add at the top level, before io.on("connection")
const activeGames = new Map();

const SPAWN_CONFIG = {
    WEAPONS: {
        interval: 5000,  // 5 seconds
        types: ["DAGGER", "SWORD", "BOW"]
    },
    POWERUPS: {
        interval: 10000,
        types: ["HEALTH", "ATTACK", "SPEED"],
        nextId: 1  // Add this for ID generation
    },
};

function startItemSpawning(roomId, io, game) {
    // Weapon spawning
    const weaponTimer = setInterval(() => {
        if (!game.active) {
            clearInterval(weaponTimer);
            return;
        }

        const weaponType = SPAWN_CONFIG.WEAPONS.types[
            Math.floor(Math.random() * SPAWN_CONFIG.WEAPONS.types.length)
        ];

        const weaponData = {
            roomId,
            type: weaponType,
            weaponConfig: {
                name: weaponType.toLowerCase(),
                damage: weaponType === "DAGGER" ? 15 : weaponType === "SWORD" ? 25 : 35,
                attackSpeed: weaponType === "DAGGER" ? 200 : weaponType === "SWORD" ? 400 : 500,
                range: weaponType === "DAGGER" ? 30 : weaponType === "SWORD" ? 50 : 600,
                isThrowable: weaponType === "DAGGER"
            },
            x: Math.floor(Math.random() * (750 - 50) + 50),
            y: Math.floor(Math.random() * (500 - 50) + 50),
            id: Date.now()
        };

        console.log('Emitting weapon spawn:', weaponData);
        io.to(roomId).emit('weapon_spawned', weaponData);
    }, SPAWN_CONFIG.WEAPONS.interval);


    // Powerup spawning
    const powerupTimer = setInterval(() => {
        if (!game.active) {
            clearInterval(powerupTimer);
            return;
        }

        const powerupType = SPAWN_CONFIG.POWERUPS.types[
            Math.floor(Math.random() * SPAWN_CONFIG.POWERUPS.types.length)
        ];

        const powerupData = {
            roomId,
            type: powerupType,
            powerupConfig: {
                name: powerupType.toLowerCase(),
                effect: powerupType === 'HEALTH' ? 20 : 0,
                multiplier: powerupType === 'ATTACK' ? 2 : powerupType === 'SPEED' ? 1.5 : 1,
                duration: powerupType === 'ATTACK' ? 10000 : powerupType === 'SPEED' ? 8000 : 0
            },
            x: Math.floor(Math.random() * (750 - 50) + 50),
            y: Math.floor(Math.random() * (500 - 50) + 50),
            id: Date.now()
        };

        console.log('Emitting powerup spawn:', powerupData);
        io.to(roomId).emit('powerup_spawned', powerupData);
    }, SPAWN_CONFIG.POWERUPS.interval);

    game.spawnTimers = {
        weapon: weaponTimer,
        powerup: powerupTimer
    };
}

// Socket.IO connection handling
io.on("connection", (socket) => {
    console.log('New socket connection:', socket.id);

    socket.on('error', (error) => {
        console.error('Socket error:', error);
    });

    if (!socket.request.session || !socket.request.session.user) {
        socket.disconnect()
        return
    }

    const user = socket.request.session.user
    onlineUsers[user.username] = {
        username: user.username,
        gameRecord: user.gameRecord,
    }
    userSocketMap.set(user.username, socket.id);
    console.log('userSocketMap', userSocketMap);

    // Broadcast new user to all clients
    io.emit("add user", JSON.stringify(user))
    socket.emit("users", JSON.stringify(onlineUsers))

    // Handle get users request
    socket.on("get users", () => {
        socket.emit("users", JSON.stringify(onlineUsers))
    })

    // Handle disconnect
    socket.on("disconnect", () => {
        console.log('Socket disconnected:', socket.id);
        if (user && user.username) {
            delete onlineUsers[user.username]
            userSocketMap.delete(user.username);
            io.emit("remove user", JSON.stringify(user))
        }
    })

    // Add after line 74
    //const activeGames = new Map();

    // Inside io.on("connection") after line 74
    socket.on('start_game_request', () => {
        // Log the start request
        console.log('Received start_game_request from:', socket.id);

        // Create room ID and set host
        const roomId = 'game_' + Math.random().toString(36).substring(2, 9);
        const hostId = socket.id;

        // Create game object with all online users
        const game = {
            id: roomId,
            players: new Set(Object.keys(onlineUsers)), // Add all online users
            host: hostId,
            started: false,
            active: false,
            spawnTimers: {
                weapons: null,
                powerups: null
            }
        };

        // Store game in active games
        activeGames.set(roomId, game);

        // Make all online users join the room
        Object.keys(onlineUsers).forEach(username => {
            const userSocket = Object.values(io.sockets.sockets).find(
                s => s.request.session.user.username === username
            );
            if (userSocket) {
                userSocket.join(roomId);
            }
        });

        // Notify all users about game initiation
        io.emit('game_start_initiated', {
            roomId,
            hostId: hostId
        });

        // Start game after delay
        setTimeout(() => {
            const game = activeGames.get(roomId);
            if (game) {
                game.started = true;
                game.active = true;

                console.log('Available sockets:', {
                    sockets: Object.values(io.sockets.sockets).map(s => ({
                        id: s.id,
                        username: s.request?.session?.user?.username
                    }))
                });
                const playerAssignments = Array.from(game.players).map((username, index) => {
                    const socketId = userSocketMap.get(username);

                    console.log('Looking for socket for user:', {
                        username,
                        foundSocket: socketId
                    });

                    return {
                        id: socketId,
                        username: username,
                        number: index + 1,
                        spawnPoint: index,
                    };
                });

                // Add each player's socket to the game room
                playerAssignments.forEach(player => {
                    const playerSocket = io.sockets.sockets.get(player.id);
                    if (playerSocket) {
                        playerSocket.join(roomId);
                        console.log(`Player ${player.username} joined room ${roomId}`);
                    }
                });

                startItemSpawning(roomId, io, game);

                io.emit('game_started', {
                    roomId: roomId,
                    hostId: hostId,
                    players: playerAssignments

                });
                // Start spawn timers
                game.spawnTimers.weapons = setInterval(() => {
                    if (game.active) {
                        const weaponType = SPAWN_CONFIG.WEAPONS.types[Math.floor(Math.random() * SPAWN_CONFIG.WEAPONS.types.length)];
                        const weaponData = {
                            roomId,
                            type: weaponType,
                            weaponConfig: {
                                name: weaponType.toLowerCase(),
                                damage: weaponType === "DAGGER" ? 15 : weaponType === "SWORD" ? 25 : 35,
                                attackSpeed: weaponType === "DAGGER" ? 200 : weaponType === "SWORD" ? 400 : 500,
                                range: weaponType === "DAGGER" ? 30 : weaponType === "SWORD" ? 50 : 600,
                                isThrowable: weaponType === "DAGGER"
                            },
                            x: Math.floor(Math.random() * (750 - 50) + 50),
                            y: Math.floor(Math.random() * (500 - 50) + 50),
                            id: Date.now()
                        };

                        // Emit to all clients in the room
                        io.to(roomId).emit('weapon_spawned', weaponData);
                    }
                }, SPAWN_CONFIG.WEAPONS.interval);

                game.spawnTimers.powerups = setInterval(() => {
                    if (game.active) {
                        const powerupType = SPAWN_CONFIG.POWERUPS.types[Math.floor(Math.random() * SPAWN_CONFIG.POWERUPS.types.length)];
                        const powerupData = {
                            roomId,
                            type: powerupType,
                            powerupConfig: {
                                name: powerupType.toLowerCase(),
                                effect: powerupType === "HEALTH" ? 20 : 0,
                                multiplier: powerupType === "ATTACK" ? 2 : powerupType === "SPEED" ? 1.5 : 1,
                                duration: powerupType === "ATTACK" ? 10000 : powerupType === "SPEED" ? 8000 : 0,
                                color: powerupType === "HEALTH" ? 0xff0000 : powerupType === "ATTACK" ? 0xff6b00 : 0x00ff00
                            },
                            x: Math.floor(Math.random() * (750 - 50) + 50),
                            y: 100, // Start higher up to let gravity work
                            id: `powerup_${Date.now()}_${Math.random().toString(36).slice(2, 11)}` // More unique ID using slice instead of substr
                        };

                        console.log('Spawning powerup:', powerupData);
                        io.to(roomId).emit('powerup_spawned', powerupData);
                    }
                }, SPAWN_CONFIG.POWERUPS.interval);

            }
        }, 2000);
    });

    // socket.on('player_ready', (playerData) => {
    //     const game = activeGames.get(playerData.roomId);
    //     if (game) {
    //         // Add player to game if not already present
    //         if (!game.players.has(playerData.player.id)) {
    //             game.players.add(playerData.player.id);

    //             // Broadcast to all players including sender
    //             io.to(playerData.roomId).emit('player_ready', playerData);

    //             // Send existing players to new player
    //             game.players.forEach(existingPlayerId => {
    //                 if (existingPlayerId !== playerData.player.id) {
    //                     socket.emit('player_ready', {
    //                         roomId: playerData.roomId,
    //                         player: {
    //                             id: existingPlayerId,
    //                             // Include other player data
    //                         }
    //                     });
    //                 }
    //             });
    //         }
    //     }
    // });

    socket.on('spawn_weapon', (weaponData) => {
        console.log('Server received weapon spawn:', weaponData);
        const game = activeGames.get(weaponData.roomId);
        if (game) {
            console.log('Broadcasting weapon to room:', weaponData.roomId);
            io.to(weaponData.roomId).emit('weapon_spawned', weaponData);
        } else {
            console.log('Game not found for room:', weaponData.roomId);
        }
    });

    socket.on('spawn_powerup', (powerupData) => {
        console.log('Server received powerup spawn:', powerupData);
        const game = activeGames.get(powerupData.roomId);
        if (game) {
            console.log('Broadcasting powerup to room:', powerupData.roomId);
            io.to(powerupData.roomId).emit('powerup_spawned', powerupData);
        }
    });

    socket.on('join_game', (data) => {
        // Log join attempt
        console.log('Join game attempt:', {
            roomId: data.roomId,
            playerId: data.player.id
        });

        const game = activeGames.get(data.roomId);
        if (game) {
            // Assign player number based on join order
            const playerNumber = game.players.size + 1;
            data.player.number = playerNumber;

            // Add player to game
            game.players.add({
                ...data.player,
                socketId: socket.id
            });

            // Join socket room
            socket.join(data.roomId);

            // Broadcast to all players in room
            io.to(data.roomId).emit('player_joined', {
                ...data.player,
                number: playerNumber,
                roomId: data.roomId
            });
        }
    });

    socket.on('player_movement', (moveData) => {
        if (!moveData.roomId || !moveData.id) {
            console.error('Invalid movement data:', moveData);
            return;
        }

        const game = activeGames.get(moveData.roomId);
        if (!game) {
            console.error('Game not found for room:', moveData.roomId);
            return;
        }

        // Broadcast movement to all other players in the room
        socket.to(moveData.roomId).emit('player_movement', {
            id: moveData.id,
            x: moveData.x,
            y: moveData.y,
            velocityX: moveData.velocityX,
            velocityY: moveData.velocityY,
            direction: moveData.direction,
            animation: moveData.animation,
            currentProp: moveData.currentProp,
            isMoving: moveData.isMoving
        });
    });

    socket.on('player_action', (actionData) => {
        const game = activeGames.get(actionData.roomId);
        if (game) {
            // Broadcast the action to other players in the room
            socket.to(actionData.roomId).emit('player_action', actionData);
        }
    })

    socket.on('weapon_collected', (data) => {
        io.to(data.roomId).emit('weapon_collected', data);
    });

    socket.on('powerup_collected', (data) => {
        io.to(data.roomId).emit('powerup_collected', data);
    });

    socket.on('player_attack', (attackData) => {
        console.log('Player attack received:', attackData);
        const game = activeGames.get(attackData.roomId);
        if (game) {
            // Broadcast to all other players in the room
            socket.to(attackData.roomId).emit('player_attack', attackData);
        } else {
            console.log('Game not found for room:', attackData.roomId);
        }
    });

    socket.on('player_animation_frame', (frameData) => {
        console.log('Animation frame received:', frameData);
        const game = activeGames.get(frameData.roomId);
        if (game) {
            // Broadcast animation frames to all other players in the room
            socket.to(frameData.roomId).emit('player_animation_frame', frameData);
        } else {
            console.log('Game not found for room:', frameData.roomId);
        }
    });
    // Add this helper function
})

// This helper function checks whether the text only contains word characters
function containWordCharsOnly(text) {
    return /^\w+$/.test(text)
}

// Handle the /register endpoint
app.post("/register", (req, res) => {
    const { username, password } = req.body

    // Validate input
    if (!username || !password) {
        return res.json({ status: "error", error: "All fields are required" })
    }

    if (!containWordCharsOnly(username)) {
        return res.json({
            status: "error",
            error: "Username can only contain letters, numbers and underscores",
        })
    }

    // Read users file
    try {
        // Initialize users object if file is empty or doesn't exist
        let users = {}
        try {
            const data = fs.readFileSync("data/users.json", "utf8")
            if (data.trim()) {
                users = JSON.parse(data)
            }
        } catch (err) {
            // If file doesn't exist or is empty, continue with empty users object
        }

        // Check if username exists
        if (username in users) {
            return res.json({
                status: "error",
                error: "Username already exists",
            })
        }

        // Hash password and store new user with game record
        const hash = bcrypt.hashSync(password, 10)
        users[username] = {
            username: username,
            password: hash,
            gameRecord: {
                wins: 0,
                losses: 0,
            },
        }

        // Save updated users file
        fs.writeFileSync("data/users.json", JSON.stringify(users, null, 2))

        res.json({ status: "success" })
    } catch (err) {
        console.error("Registration error:", err)
        res.json({ status: "error", error: "Error accessing user database" })
    }
})

// Handle the /signin endpoint
app.post("/signin", (req, res) => {
    // Get the JSON data from the body
    const { username, password } = req.body

    // Read users file
    try {
        const users = JSON.parse(fs.readFileSync("data/users.json"))

        // Check if username exists and password matches
        if (!(username in users)) {
            return res.json({ status: "error", error: "Username not found" })
        }

        if (!bcrypt.compareSync(password, users[username].password)) {
            return res.json({ status: "error", error: "Incorrect password" })
        }

        // Store user information in session
        req.session.user = {
            username,
            username: users[username].username,
            gameRecord: users[username].gameRecord,
        }

        res.json({ status: "success", user: req.session.user })
    } catch (err) {
        res.json({ status: "error", error: "Error accessing user database" })
    }
})

// Add new endpoint to update game record
app.post("/updateGameRecord", (req, res) => {
    if (!req.session.user) {
        return res.json({ status: "error", error: "Not logged in" })
    }

    const { won } = req.body
    const username = req.session.user.username

    try {
        const users = JSON.parse(fs.readFileSync("data/users.json"))

        if (won) {
            users[username].gameRecord.wins++
        } else {
            users[username].gameRecord.losses++
        }

        fs.writeFileSync("data/users.json", JSON.stringify(users, null, 2))

        res.json({
            status: "success",
            record: users[username].gameRecord,
        })
    } catch (err) {
        res.json({ status: "error", error: "Error updating game record" })
    }
})

// Handle the /validate endpoint
app.get("/validate", (req, res) => {
    // Check if user is logged in
    if (!req.session.user) {
        return res.json({ status: "error", error: "Not logged in" })
    }

    // Send user information
    res.json({
        status: "success",
        user: {
            username: req.session.user.username,
            gameRecord: req.session.user.gameRecord,
        },
    })
})

// Handle the /signout endpoint
app.get("/signout", (req, res) => {
    // Delete session user data
    delete req.session.user

    // Send success response
    res.json({ status: "success" })
})

app.get("/getStats/:username", (req, res) => {
    const username = req.params.username

    if (!username) {
        return res.status(400).json({
            status: "error",
            error: "Username is required",
        })
    }

    try {
        const users = JSON.parse(fs.readFileSync("data/users.json"))

        if (!(username in users)) {
            return res.status(404).json({
                status: "error",
                error: "User not found",
            })
        }

        res.json({
            status: "success",
            stats: users[username].gameRecord,
        })
    } catch (err) {
        console.error("Error accessing user database:", err)
        res.status(500).json({
            status: "error",
            error: "Error accessing user database",
        })
    }
})

// Add this endpoint to reload stats
app.get('/reloadStats', (req, res) => {
    try {
        // Check if user is logged in
        if (!req.session || !req.session.user) {
            return res.status(401).json({ error: 'Not logged in' });
        }

        // Read the users file
        const users = JSON.parse(fs.readFileSync("data/users.json"));
        const username = req.session.user.username;

        if (!users[username]) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Send back user stats
        res.json({
            user: {
                username: username,
                gameRecord: users[username].gameRecord
            }
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Use a web server to listen at port 8000
httpServer.listen(8000, () => {
    console.log("The server has started...")
    console.log("http://localhost:8000")
})
