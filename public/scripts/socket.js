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
            // Update UI to show connection progress
            $('.start-button').text('Connecting players...');

            // Add a loading indicator
            const loadingEl = $('<div class="loading-spinner"></div>');
            $('#gameContainer').prepend(loadingEl);

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

            // Hide lobby and show game for all players// Remove loading indicator
            $('.loading-spinner').remove();

            $('.lobby-container').hide();
            $('#gameContainer').show();

            // Initialize game with complete game data
            startGame(gameData);

            // Stop refreshing when game starts
            GameStats.stopAutoRefresh();
        });

        socket.on('player_ready', (playerData) => {
            if (window.game && window.game.scene.scenes[0]) {
                handlePlayerJoined.call(window.game.scene.scenes[0], playerData);
            }
        });

        // Update the weapon_spawned handler to use .call() like powerups
        socket.on('weapon_spawned', (weaponData) => {
            console.log('Received weapon spawn event:', weaponData);
            if (weaponData.roomId === window.currentRoomId && window.game?.scene?.scenes[0]) {
                console.log('Spawning weapon in game');
                spawnWeapon.call(
                    window.game.scene.scenes[0],
                    weaponData.x,
                    weaponData.y,
                    weaponData.weaponConfig,
                    weaponData.id
                );
            } else {
                console.log('Skipping weapon spawn:', {
                    expectedRoom: window.currentRoomId,
                    receivedRoom: weaponData.roomId,
                    gameReady: !!window.game?.scene?.scenes[0]
                });
            }
        });

        // Add this after the weapon_spawned handler
        socket.on('weapon_collected', (data) => {
            console.log('Weapon collected:', data);
            const weapon = gameState.weapons.get(data.weaponId);
            if (weapon) {
                // Update the collecting player's prop
                const playerSprite = PlayerManager.players.get(data.playerId);
                if (playerSprite) {
                    // Stop any current animations
                    playerSprite.anims.stop();

                    // Update the prop
                    PlayerManager.updatePlayerProp(playerSprite, data.weaponName);

                    // Set idle texture
                    playerSprite.setTexture(
                        `Player${playerSprite.number}_${playerSprite.direction}_Hurt_${playerSprite.currentProp}_3`
                    );
                }

                // Remove weapon from game state and destroy sprite
                gameState.weapons.delete(data.weaponId);
                weapon.destroy();
            }
        });

        socket.on('powerup_spawned', (powerupData) => {
            console.log('Received powerup spawn event:', {
                id: powerupData.id,
                currentPowerups: Array.from(gameState.powerups.keys())
            });

            if (powerupData.roomId === window.currentRoomId && window.game?.scene?.scenes[0]) {
                console.log('Spawning powerup in game');
                const powerupSprite = spawnPowerup.call(
                    window.game.scene.scenes[0],
                    powerupData.x,
                    powerupData.y,
                    powerupData.powerupConfig,
                    powerupData.id
                );

                // Verify powerup was added to gameState
                console.log('After spawn:', {
                    spawnedId: powerupData.id,
                    spriteId: powerupSprite?.id,
                    storedPowerups: Array.from(gameState.powerups.keys())
                });
            }
        });

        socket.on('powerup_collected', (data) => {
            console.log('Powerup collected event received:', {
                powerupId: data.powerupId,
                existingPowerups: Array.from(gameState.powerups.keys()),
                fullData: data
            });

            const powerup = gameState.powerups.get(data.powerupId);
            if (powerup) {
                // Apply powerup effect to the correct player
                const playerSprite = PlayerManager.players.get(data.playerId);
                if (playerSprite) {
                    console.log('Applying powerup effect:', {
                        playerId: data.playerId,
                        powerupType: data.powerupType
                    });

                    // Apply the powerup effect
                    applyPowerupEffect(playerSprite, data.powerupType);

                    // Now we can safely destroy and remove the powerup
                    if (powerup.body) {
                        powerup.body.enable = false;
                    }
                    powerup.destroy();
                    gameState.powerups.delete(data.powerupId);

                    // Show collection effect
                    if (window.game?.scene?.scenes[0]) {
                        const scene = window.game.scene.scenes[0];
                        const text = scene.add
                            .text(playerSprite.x, playerSprite.y - 50,
                                `Picked up ${data.powerupType.name}!`, {
                                fontSize: "16px",
                                fill: "#fff",
                            })
                            .setOrigin(0.5);

                        scene.tweens.add({
                            targets: text,
                            y: text.y - 30,
                            alpha: 0,
                            duration: 1000,
                            onComplete: () => text.destroy(),
                        });
                    }
                }
            } else {
                console.warn('Powerup not found:', {
                    requestedId: data.powerupId,
                    availablePowerups: Array.from(gameState.powerups.entries()).map(([id, p]) => ({
                        id,
                        type: p.type?.name,
                        position: { x: p.x, y: p.y },
                        timestamp: p.timestamp,
                        isBeingCollected: p.isBeingCollected
                    }))
                });
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
            //console.log('Received movement data:', moveData);

            // Skip if it's our own movement
            if (moveData.id === socket.id) {
                //console.log('Skipping own movement update');
                return;
            }

            if (window.game && window.game.scene.scenes[0]) {
                //console.log('Handling movement update for player:', moveData.id);
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
