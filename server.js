const express = require("express")

const bcrypt = require("bcrypt")
const fs = require("fs")
const session = require("express-session")
const GAME_CONFIG = {
    DURATION: 180, // 3 minutes in seconds
    MIN_PLAYERS: 2,
}

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
const userSocketMap = new Map()

// Add at the top level, before io.on("connection")
const activeGames = new Map()

const SPAWN_CONFIG = {
    WEAPONS: {
        interval: 10000, // 5 seconds
        types: ["DAGGER", "SWORD", "BOW"],
    },
    POWERUPS: {
        interval: 20000,
        types: ["HEALTH", "ATTACK", "SPEED"],
        configs: {
            ATTACK: {
                name: "attack",
                duration: 10000,
                multiplier: 2,
            },
            SPEED: {
                name: "speed",
                duration: 8000,
                multiplier: 1.5,
            },
            HEALTH: {
                name: "health",
                effect: 20,
            },
        },
    },
}

function spawnWeapon(roomId, io) {
    const weaponType =
        SPAWN_CONFIG.WEAPONS.types[
        Math.floor(Math.random() * SPAWN_CONFIG.WEAPONS.types.length)
        ]
    const weaponData = {
        roomId,
        type: weaponType,
        weaponConfig: {
            name: weaponType.toLowerCase(),
            // Damage values: Dagger=15, Sword=25, Bow=35
            damage:
                weaponType === "DAGGER" ? 15 : weaponType === "SWORD" ? 25 : 35,
            // Attack speed (ms): Dagger=200 (fastest), Sword=400, Bow=500 (slowest)
            attackSpeed:
                weaponType === "DAGGER"
                    ? 200
                    : weaponType === "SWORD"
                        ? 400
                        : 500,
            // Attack range (pixels): Dagger=30 (shortest), Sword=50, Bow=600 (longest)
            range:
                weaponType === "DAGGER"
                    ? 30
                    : weaponType === "SWORD"
                        ? 50
                        : 600,
            // Only daggers can be thrown as projectiles
            isThrowable: weaponType === "DAGGER",
        },
        // Random spawn position within game bounds (50-750 x, 50-500 y)
        x: Math.floor(Math.random() * (750 - 50) + 50),
        y: Math.floor(Math.random() * (500 - 50) + 50),
        id: Date.now(),
    }
    io.to(roomId).emit("weapon_spawned", weaponData)
}

function startItemSpawning(roomId, io, game) {
    // Initial spawns
    setTimeout(() => {
        spawnWeapon(roomId, io);
    }, 1000);

    // Set up intervals
    const weaponTimer = setInterval(() => {
        // Stop spawning if game is no longer active
        if (!game.active) {
            clearInterval(weaponTimer)
            return
        }
        spawnWeapon(roomId, io)
    }, SPAWN_CONFIG.WEAPONS.interval)

    // POWERUP SPAWNING SYSTEM
    const powerupTimer = setInterval(() => {
        // Stop spawning if game is no longer active
        if (!game.active) {
            clearInterval(powerupTimer)
            return
        }

        const powerupType =
            SPAWN_CONFIG.POWERUPS.types[
            Math.floor(Math.random() * SPAWN_CONFIG.POWERUPS.types.length)
            ]
        const powerupConfig = SPAWN_CONFIG.POWERUPS.configs[powerupType]
        const powerupData = {
            roomId,
            type: powerupType,
            powerupConfig: {
                ...powerupConfig,
                name: powerupType.toLowerCase(), // Add this explicitly
                color:
                    powerupType === "HEALTH"
                        ? 0xff0000
                        : powerupType === "ATTACK"
                            ? 0xff6b00
                            : 0x00ff00,
            },
            // Random spawn position within game bounds
            x: Math.floor(Math.random() * (750 - 50) + 50),
            y: 100,
            id: `powerup_${Date.now()}_${Math.random()
                .toString(36)
                .slice(2, 11)}`,
        }

        // Emit powerup spawn event to all players in the room
        console.log("Emitting powerup spawn:", powerupData)
        io.to(roomId).emit("powerup_spawned", powerupData)
    }, SPAWN_CONFIG.POWERUPS.interval) // Spawn every 10 seconds (10000ms)

    // Store timer references in game object for cleanup
    game.spawnTimers = {
        weapon: weaponTimer,
        powerup: powerupTimer,
    }
}

// Add these constants at the top of your file
const PHYSICS_CONFIG = {
    MAX_SPEED: 1200,
    MIN_SPEED: 100,
    MAX_DAMAGE: 50,
    MIN_DAMAGE: 10,
    MAX_DISTANCE: 1000
};

function validateArrowPhysics(data) {
    // Validate speed
    const speed = Math.sqrt(
        Math.pow(Math.cos(data.angle) * data.power * 800, 2) +
        Math.pow(Math.sin(data.angle) * data.power * 800, 2)
    );

    if (speed > PHYSICS_CONFIG.MAX_SPEED || speed < PHYSICS_CONFIG.MIN_SPEED) {
        console.warn('Invalid arrow speed detected:', speed);
        return false;
    }

    return true;
}

function validateHit(hitData, initialPosition, currentPosition) {
    const timeElapsed = Date.now() - hitData.timestamp;
    const maxDistance = PHYSICS_CONFIG.MAX_SPEED * (timeElapsed / 1000);

    const actualDistance = Math.sqrt(
        Math.pow(currentPosition.x - initialPosition.x, 2) +
        Math.pow(currentPosition.y - initialPosition.y, 2)
    );

    if (actualDistance > maxDistance) {
        console.warn('Invalid arrow trajectory detected');
        return false;
    }

    return true;
}

// Socket.IO connection handling
io.on("connection", (socket) => {
    console.log("New socket connection:", socket.id)

    socket.on("error", (error) => {
        console.error("Socket error:", error)
    })

    if (!socket.request.session || !socket.request.session.user) {
        socket.disconnect()
        return
    }

    const user = socket.request.session.user
    onlineUsers[user.username] = {
        username: user.username,
        gameRecord: user.gameRecord,
    }
    userSocketMap.set(user.username, socket.id)
    console.log("userSocketMap", userSocketMap)

    // Broadcast new user to all clients
    io.emit("add user", JSON.stringify(user))
    socket.emit("users", JSON.stringify(onlineUsers))

    // Handle get users request
    socket.on("get users", () => {
        socket.emit("users", JSON.stringify(onlineUsers))
    })

    // Handle disconnect
    socket.on("disconnect", () => {
        console.log("Socket disconnected:", socket.id)
        if (user && user.username) {
            delete onlineUsers[user.username]
            userSocketMap.delete(user.username)
            io.emit("remove user", JSON.stringify(user))
        }
    })

    // Add after line 74
    //const activeGames = new Map();

    // Inside io.on("connection") after line 74
    socket.on("start_game_request", () => {
        // Log the start request
        console.log("Received start_game_request from:", socket.id)

        // Create room ID and set host
        const roomId = "game_" + Math.random().toString(36).substring(2, 9)
        const hostId = socket.id

        // Create game object with all online users
        const game = {
            id: roomId,
            players: new Set(Object.keys(onlineUsers)), // Add all online users
            host: hostId,
            started: false,
            active: false,
            spawnTimers: {
                weapons: null,
                powerups: null,
            },
            timeRemaining: GAME_CONFIG.DURATION,
            timer: null,
            alivePlayers: new Set(),
        }

        // Store game in active games
        activeGames.set(roomId, game)

        // Make all online users join the room
        Object.keys(onlineUsers).forEach((username) => {
            const userSocket = Object.values(io.sockets.sockets).find(
                (s) => s.request.session.user.username === username
            )
            if (userSocket) {
                userSocket.join(roomId)
            }
        })

        // Notify all users about game initiation
        io.emit("game_start_initiated", {
            roomId,
            hostId: hostId,
        })

        // Start game after delay
        setTimeout(() => {
            const game = activeGames.get(roomId)
            if (game) {
                game.started = true
                game.active = true
                game.timeRemaining = GAME_CONFIG.DURATION // Initialize time remaining

                console.log("Available sockets:", {
                    sockets: Object.values(io.sockets.sockets).map((s) => ({
                        id: s.id,
                        username: s.request?.session?.user?.username,
                    })),
                })
                const playerAssignments = Array.from(game.players).map(
                    (username, index) => {
                        const socketId = userSocketMap.get(username)

                        console.log("Looking for socket for user:", {
                            username,
                            foundSocket: socketId,
                        })

                        // Add each player's socket ID to alivePlayers Set
                        game.alivePlayers.add(socketId)

                        return {
                            id: socketId,
                            username: username,
                            number: index + 1,
                            spawnPoint: index,
                        }
                    }
                )

                // Add each player's socket to the game room
                playerAssignments.forEach((player) => {
                    const playerSocket = io.sockets.sockets.get(player.id)
                    if (playerSocket) {
                        playerSocket.player = { health: 100 }
                        playerSocket.join(roomId)
                        console.log(
                            `Player ${player.username} joined room ${roomId}`
                        )
                    }
                })

                //startItemSpawning(roomId, io, game);

                io.emit("game_started", {
                    roomId: roomId,
                    hostId: hostId,
                    players: playerAssignments,
                })
                // Start spawn timers
                // game.spawnTimers.weapons = setInterval(() => {
                //     if (game.active) {
                //         const weaponType =
                //             SPAWN_CONFIG.WEAPONS.types[
                //                 Math.floor(
                //                     Math.random() *
                //                         SPAWN_CONFIG.WEAPONS.types.length
                //                 )
                //             ]
                //         const weaponData = {
                //             roomId,
                //             type: weaponType,
                //             weaponConfig: {
                //                 name: weaponType.toLowerCase(),
                //                 damage:
                //                     weaponType === "DAGGER"
                //                         ? 15
                //                         : weaponType === "SWORD"
                //                         ? 25
                //                         : 35,
                //                 attackSpeed:
                //                     weaponType === "DAGGER"
                //                         ? 200
                //                         : weaponType === "SWORD"
                //                         ? 400
                //                         : 500,
                //                 range:
                //                     weaponType === "DAGGER"
                //                         ? 30
                //                         : weaponType === "SWORD"
                //                         ? 50
                //                         : 600,
                //                 isThrowable: weaponType === "DAGGER",
                //             },
                //             x: Math.floor(Math.random() * (750 - 50) + 50),
                //             y: Math.floor(Math.random() * (500 - 50) + 50),
                //             id: Date.now(),
                //         }

                //         // Emit to all clients in the room
                //         io.to(roomId).emit("weapon_spawned", weaponData)
                //     }
                // }, SPAWN_CONFIG.WEAPONS.interval)

                // game.spawnTimers.powerups = setInterval(() => {
                //     if (game.active) {
                //         const powerupType =
                //             SPAWN_CONFIG.POWERUPS.types[
                //                 Math.floor(
                //                     Math.random() *
                //                         SPAWN_CONFIG.POWERUPS.types.length
                //                 )
                //             ]
                //         const powerupData = {
                //             roomId,
                //             type: powerupType,
                //             powerupConfig: {
                //                 name: powerupType.toLowerCase(),
                //                 effect: powerupType === "HEALTH" ? 20 : 0,
                //                 multiplier:
                //                     powerupType === "ATTACK"
                //                         ? 2
                //                         : powerupType === "SPEED"
                //                         ? 1.5
                //                         : 1,
                //                 duration:
                //                     powerupType === "ATTACK"
                //                         ? 10000
                //                         : powerupType === "SPEED"
                //                         ? 8000
                //                         : 0,
                //                 color:
                //                     powerupType === "HEALTH"
                //                         ? 0xff0000
                //                         : powerupType === "ATTACK"
                //                         ? 0xff6b00
                //                         : 0x00ff00,
                //             },
                //             x: Math.floor(Math.random() * (750 - 50) + 50),
                //             y: 100, // Start higher up to let gravity work
                //             id: `powerup_${Date.now()}_${Math.random()
                //                 .toString(36)
                //                 .slice(2, 11)}`, // More unique ID using slice instead of substr
                // //         }

                //         //console.log('Spawning powerup:', powerupData);
                //         // io.to(roomId).emit("powerup_spawned", powerupData)
                //     }
                // }, SPAWN_CONFIG.POWERUPS.interval)
            }
        }, 2000)
    })

    // socket.on("spawn_weapon", (weaponData) => {
    //     console.log("Server received weapon spawn:", weaponData)
    //     const game = activeGames.get(weaponData.roomId)
    //     if (game) {
    //         console.log("Broadcasting weapon to room:", weaponData.roomId)
    //         io.to(weaponData.roomId).emit("weapon_spawned", weaponData)
    //     } else {
    //         console.log("Game not found for room:", weaponData.roomId)
    //     }
    // })

    // socket.on("spawn_powerup", (powerupData) => {
    //     console.log("Server received powerup spawn:", powerupData)
    //     const game = activeGames.get(powerupData.roomId)
    //     if (game) {
    //         console.log("Broadcasting powerup to room:", powerupData.roomId)
    //         io.to(powerupData.roomId).emit("powerup_spawned", powerupData)
    //     }
    // })

    socket.on("join_game", (data) => {
        // Log join attempt
        console.log("Join game attempt:", {
            roomId: data.roomId,
            playerId: data.player.id,
        })

        const game = activeGames.get(data.roomId)
        if (game) {
            // Assign player number based on join order
            const playerNumber = game.players.size + 1
            data.player.number = playerNumber

            // Add player to game
            game.players.add({
                ...data.player,
                socketId: socket.id,
            })

            // Join socket room
            socket.join(data.roomId)

            // Broadcast to all players in room
            io.to(data.roomId).emit("player_joined", {
                ...data.player,
                number: playerNumber,
                roomId: data.roomId,
            })
        }
    })

    socket.on("player_movement", (moveData) => {
        if (!moveData.roomId || !moveData.id) {
            console.error("Invalid movement data:", moveData)
            return
        }

        const game = activeGames.get(moveData.roomId)
        if (!game) {
            console.error("Game not found for room:", moveData.roomId)
            return
        }

        // Broadcast movement to all other players in the room
        socket.to(moveData.roomId).emit("player_movement", {
            id: moveData.id,
            x: moveData.x,
            y: moveData.y,
            velocityX: moveData.velocityX,
            velocityY: moveData.velocityY,
            direction: moveData.direction,
            animation: moveData.animation,
            currentProp: moveData.currentProp,
            isMoving: moveData.isMoving,
        })
    })

    socket.on("player_action", (actionData) => {
        const game = activeGames.get(actionData.roomId)
        if (game) {
            // Broadcast the action to other players in the room
            socket.to(actionData.roomId).emit("player_action", actionData)
        }
    })

    socket.on("weapon_collected", (data) => {
        io.to(data.roomId).emit("weapon_collected", data)
    })

    socket.on("powerup_collected", (data) => {
        io.to(data.roomId).emit("powerup_collected", data)
    })

    socket.on("player_attack", (attackData) => {
        console.log("Player attack received:", attackData)
        const game = activeGames.get(attackData.roomId)
        if (game) {
            // Broadcast to all other players in the room
            socket.to(attackData.roomId).emit("player_attack", attackData)
        } else {
            console.log("Game not found for room:", attackData.roomId)
        }
    })

    socket.on("player_animation_frame", (frameData) => {
        const game = activeGames.get(frameData.roomId)
        if (game) {
            // Broadcast animation frames to all other players in the room
            socket
                .to(frameData.roomId)
                .emit("player_animation_frame", frameData)
        } else {
            console.log("Game not found for room:", frameData.roomId)
        }
    })

    // Add inside the io.on("connection") handler
    socket.on("player_attack_hit", (data) => {
        const game = activeGames.get(data.roomId)
        if (game) {
            // Broadcast damage to all players in the room
            io.to(data.roomId).emit("player_damaged", {
                attackerId: data.attackerId,
                targetId: data.targetId,
                damage: data.damage,
                x: data.x,
                y: data.y,
            })
        }
    })

    socket.on("player_ready", (data) => {
        const game = activeGames.get(data.roomId)
        if (!game) return
        // Start the game timer
        startGameTimer(data.roomId, io)
        startItemSpawning(data.roomId, io, game)
    })

    socket.on("player_died", (data) => {
        console.log("Player died event received:", {
            roomId: data.roomId,
            playerId: data.playerId,
        })

        const game = activeGames.get(data.roomId)
        console.log("Game state for death:", {
            gameExists: !!game,
            alivePlayers: game?.alivePlayers
                ? Array.from(game.alivePlayers)
                : [],
            alivePlayersCount: game?.alivePlayers?.size,
        })

        if (!game) {
            console.log("Game not found for player death")
            return
        }

        // Remove player from alive players
        game.alivePlayers.delete(data.playerId)
        console.log("After removing dead player:", {
            remainingPlayers: Array.from(game.alivePlayers),
            remainingCount: game.alivePlayers.size,
        })

        // Broadcast death to all players
        io.to(data.roomId).emit("player_died", {
            playerId: data.playerId,
        })

        // Check if game should end
        console.log("Checking game end for room:", data.roomId)
        checkGameEnd(data.roomId, io)
    })

    socket.on("reduce_time", (data) => {
        const game = activeGames.get(data.roomId)
        if (game && game.active) {
            // Reduce time by 30 seconds, but don't go below 0
            game.timeRemaining = Math.max(0, game.timeRemaining - 30)

            // Emit updated time to all players in the room
            io.to(data.roomId).emit("time_update", {
                timeRemaining: game.timeRemaining,
            })

            // Check if time has run out
            if (game.timeRemaining <= 0) {
                endGame(data.roomId, io, "time_up")
            }
        }
    })

    socket.on("player_death_animation", (frameData) => {
        const game = activeGames.get(frameData.roomId)
        if (game) {
            // Broadcast death animation frames to all other players in the room
            socket
                .to(frameData.roomId)
                .emit("player_death_animation", frameData)
        } else {
            console.log("Game not found for room:", frameData.roomId)
        }
    })

    socket.on("get_leaderboard", (data, callback) => {
        try {
            const users = JSON.parse(fs.readFileSync("data/users.json"))

            const leaderboardData = Object.entries(users).map(
                ([username, userData]) => ({
                    username,
                    wins: userData.gameRecord?.wins || 0,
                    losses: userData.gameRecord?.losses || 0,
                })
            )

            callback(leaderboardData)
        } catch (err) {
            console.error("Error getting leaderboard data:", err)
            callback([])
        }
    })

    socket.on("player_damaged", (data) => {
        console.log("Player damaged:", {
            playerId: socket.id,
            previousHealth: socket.player?.health,
            damage: data.damage,
        })

        if (!socket.player) {
            socket.player = { health: 100 }
        }
        socket.player.health = Math.max(0, socket.player.health - data.damage)

        console.log("Updated player health:", {
            playerId: socket.id,
            newHealth: socket.player.health,
        })
    })

    socket.on("powerup_collected", (data) => {
        console.log("Powerup collected:", {
            playerId: socket.id,
            previousHealth: socket.player?.health,
            powerupType: data.powerupType,
        })

        if (!socket.player) {
            socket.player = { health: 100 }
        }
        if (data.powerupType === "HEALTH") {
            socket.player.health = Math.min(100, socket.player.health + 20)
            console.log("Health powerup applied:", {
                playerId: socket.id,
                newHealth: socket.player.health,
            })
        }
    })

    socket.on('bow_charge_start', (data) => {
        const game = activeGames.get(data.roomId);
        if (game) {
            // Broadcast charging state to other players
            socket.to(data.roomId).emit('player_bow_charging', {
                playerId: data.playerId,
                position: data.position
            });
        }
    });

    socket.on('bow_charge_release', (data) => {
        const game = activeGames.get(data.roomId);
        if (game && validateArrowPhysics(data)) {
            const arrowId = `arrow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Store initial arrow data for validation
            game.arrows = game.arrows || new Map();
            game.arrows.set(arrowId, {
                initialPosition: data.position,
                timestamp: Date.now(),
                power: data.power,
                angle: data.angle
            });

            io.to(data.roomId).emit('arrow_spawned', {
                ...data,
                arrowId: arrowId
            });
        }
    });

    socket.on('bow_arrow_hit', (data) => {
        const game = activeGames.get(data.roomId);
        if (game) {
            const arrowData = game.arrows.get(data.arrowId);
            if (arrowData && validateHit(arrowData, arrowData.initialPosition, data.position)) {
                // Validate and potentially adjust damage
                const validatedDamage = Math.min(
                    Math.max(data.damage, PHYSICS_CONFIG.MIN_DAMAGE),
                    PHYSICS_CONFIG.MAX_DAMAGE
                );

                io.to(data.roomId).emit('arrow_hit', {
                    ...data,
                    damage: validatedDamage
                });
            }
            // Clean up arrow data
            game.arrows.delete(data.arrowId);
        }
    });
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
app.get("/reloadStats", (req, res) => {
    try {
        // Check if user is logged in
        if (!req.session || !req.session.user) {
            return res.status(401).json({ error: "Not logged in" })
        }

        // Read the users file
        const users = JSON.parse(fs.readFileSync("data/users.json"))
        const username = req.session.user.username

        if (!users[username]) {
            return res.status(404).json({ error: "User not found" })
        }

        // Send back user stats
        res.json({
            user: {
                username: username,
                gameRecord: users[username].gameRecord,
            },
        })
    } catch (error) {
        console.error("Error fetching stats:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})
function startGameTimer(roomId, io) {
    const game = activeGames.get(roomId)
    console.log("Starting game timer:", {
        roomId,
        gameExists: !!game,
        timeRemaining: game?.timeRemaining,
    })

    if (!game) return

    if (game.timer) {
        console.log("Clearing existing timer")
        clearInterval(game.timer)
    }

    game.timer = setInterval(() => {
        if (game.timeRemaining <= 0) {
            console.log("Game time up, ending game")
            endGame(roomId, io, "time_up")
            return
        }

        io.to(roomId).emit("time_update", {
            timeRemaining: game.timeRemaining,
        })

        game.timeRemaining--
    }, 1000)
}
function endGame(roomId, io, reason) {
    const game = activeGames.get(roomId)
    if (!game) return

    // Clear all timers
    clearInterval(game.timer)
    if (game.spawnTimers.weapons) clearInterval(game.spawnTimers.weapons)
    if (game.spawnTimers.powerups) clearInterval(game.spawnTimers.powerups)

    // Set game as inactive
    game.active = false
    game.started = false

    // Calculate winner based on reason
    let winner = null
    game.alivePlayers.forEach((playerId) => {
        io.sockets.sockets.get(playerId)
    })
    if (reason === "last_player_standing" && game.alivePlayers.size === 1) {
        winner = Array.from(game.alivePlayers)[0]
        console.log("Last player standing winner:", winner)
    }
    let highestHealth = -1
    let healthiestPlayer = null

    // Iterate through alive players to find highest health
    for (const playerId of game.alivePlayers) {
        const playerSocket = io.sockets.sockets.get(playerId)

        if (
            playerSocket &&
            playerSocket.player &&
            playerSocket.player.health > highestHealth
        ) {
            highestHealth = playerSocket.player.health
            healthiestPlayer = playerId
        }
    }
    winner = healthiestPlayer
    console.log("Time up winner:", {
        winner,
        finalHealth: highestHealth,
    })

    // Emit game end event to all players
    const finalStats = {
        totalPlayers: game.players.size,
        duration: GAME_CONFIG.DURATION - game.timeRemaining,
    }

    console.log("Emitting game end:", {
        reason,
        winner,
        stats: finalStats,
    })

    io.to(roomId).emit("game_ended", {
        reason: reason,
        winner: winner,
        finalStats: finalStats,
    })

    // Clean up game data after a delay
    setTimeout(() => {
        console.log("Cleaning up game data for room:", roomId)
        activeGames.delete(roomId)
    }, 5000)
}

function checkGameEnd(roomId, io) {
    const game = activeGames.get(roomId)
    console.log("Checking game end:", {
        roomId,
        gameExists: !!game,
        isActive: game?.active,
        alivePlayers: game?.alivePlayers ? Array.from(game.alivePlayers) : [],
        alivePlayersCount: game?.alivePlayers?.size,
    })

    if (!game || !game.active) {
        console.log("Game not active or not found, skipping end check")
        return
    }
    if (game.alivePlayers.size === 0) {
        console.log("No players remaining, ending game")
        endGame(roomId, io, "no_players_remaining")
    }
    // Check if only one player is alive
    else if (game.alivePlayers.size === 1) {
        console.log("One player remaining, ending game:", {
            lastPlayer: Array.from(game.alivePlayers)[0],
        })
        endGame(roomId, io, "last_player_standing")
    } else {
        console.log("Multiple players still alive:", game.alivePlayers.size)
    }
}

// Use a web server to listen at port 8000
httpServer.listen(8000, () => {
    console.log("The server has started...")
    console.log("http://localhost:8000")
})
