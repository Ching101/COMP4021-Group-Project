const Socket = (function () {
    let socket = null
    let onlineUserCount = 0

    const getSocket = function () {
        return socket
    }

    const updateStartButton = function () {
        const startButton = document.querySelector('.start-button')
        if (startButton) {
            if (onlineUserCount >= 2) {
                startButton.classList.remove('disabled')
                startButton.disabled = false
                startButton.title = ''
            } else {
                startButton.classList.add('disabled')
                startButton.disabled = true
                startButton.title = 'Need at least 2 players to start'
            }
        }
    }

    const connect = function () {
        if (socket) {
            console.log('Socket already exists, disconnecting first');
            socket.disconnect();
        }

        console.log('Creating new socket connection');
        socket = io();

        socket.on("connect", () => {
            console.log('Socket connected:', socket.id);
            socket.emit("get users");
            GameStats.startAutoRefresh();
        });

        // Add error handling
        socket.on("connect_error", (error) => {
            console.error('Socket connection error:', error);
        });

        socket.on("disconnect", () => {
            console.log('Socket disconnected');
            GameStats.stopAutoRefresh();
        });

        // Set up the users event
        socket.on("users", (onlineUsers) => {
            onlineUsers = JSON.parse(onlineUsers)
            onlineUserCount = Object.keys(onlineUsers).length
            OnlineUsersPanel.update(onlineUsers)
            updateStartButton()
        })

        // Set up the add user event
        socket.on("add user", (user) => {
            user = JSON.parse(user)
            OnlineUsersPanel.addUser(user)
            onlineUserCount++
            updateStartButton()
        })

        // Set up the remove user event
        socket.on("remove user", (user) => {
            user = JSON.parse(user)
            OnlineUsersPanel.removeUser(user)
            onlineUserCount--
            updateStartButton()
        })

        // Update game start initiated handler
        socket.on('game_start_initiated', (data) => {
            // Store room and host information
            window.currentRoomId = data.roomId;
            window.hostId = data.hostId;

            // Update UI for all players
            $('.start-button').prop('disabled', true);
            $('.start-button').text('Starting game...');
            console.log('Game start initiated for room:', data.roomId);
        });

        // Update game started handler
        socket.on('game_started', (gameData) => {
            console.log('Game started with data:', gameData);

            // Ensure we're in the correct room
            if (gameData.roomId !== window.currentRoomId) {
                console.error('Room ID mismatch');
                return;
            }

            // Hide lobby and show game for all players
            $('.lobby-container').hide();
            $('#game').show();

            // Initialize game with complete game data
            startGame(gameData);
        });

        socket.on('player_ready', (playerData) => {
            if (window.game && window.game.scene.scenes[0]) {
                handlePlayerJoined.call(window.game.scene.scenes[0], playerData);
            }
        });

        socket.on('weapon_spawned', (weaponData) => {
            if (weaponData.roomId === window.currentRoomId && window.game?.scene?.scenes[0]) {
                spawnWeapon.call(
                    window.game.scene.scenes[0],
                    weaponData.x,
                    weaponData.y,
                    WEAPONS[weaponData.type],
                    weaponData.id
                );
            }
        });

        socket.on('powerup_spawned', (powerupData) => {
            if (window.game && window.game.scene.scenes[0]) {
                spawnPowerup.call(window.game.scene.scenes[0], powerupData.x, powerupData.y, POWERUPS[powerupData.type.toUpperCase()]);
            }
        });

        socket.on('join_error', (error) => {
            console.error('Failed to join game:', error);
            // Show error to user
            alert(error.error);
        });

        socket.on('player_joined', (playerData) => {
            console.log('Player joined:', playerData);
            if (window.game && window.game.scene.scenes[0]) {
                handlePlayerJoined.call(window.game.scene.scenes[0], playerData);
            }
        });

        socket.on('player_movement', (moveData) => {
            console.log('Received movement data:', moveData);

            // Skip if it's our own movement
            if (moveData.id === socket.id) {
                console.log('Skipping own movement update');
                return;
            }

            if (window.game && window.game.scene.scenes[0]) {
                console.log('Handling movement update for player:', moveData.id);
                handlePlayerUpdate(moveData);
            } else {
                console.log('Game scene not ready for movement update');
            }
        });

        socket.on('player_action', (actionData) => {
            if (window.game && window.game.scene.scenes[0] && actionData.id !== Socket.getSocket().id) {
                const otherPlayer = PlayerManager.players.get(actionData.id);
                if (otherPlayer) {
                    switch (actionData.action) {
                        case 'attack':
                            // Visualize attack animation
                            playAttackAnimation(otherPlayer, actionData);
                            break;
                        case 'use_item':
                            // Show item use effects
                            playItemAnimation(otherPlayer, actionData);
                            break;
                    }
                }
            }
        });
    }

    const disconnect = function () {
        GameStats.stopAutoRefresh()
        socket.disconnect()
        socket = null
    }

    return { getSocket, connect, disconnect }
})()
