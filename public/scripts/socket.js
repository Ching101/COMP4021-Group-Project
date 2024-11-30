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


            window.currentRoomId = data.roomId;
            window.hostId = data.hostId;

            // Update UI for all players
            $('.start-button').prop('disabled', true);
            $('.start-button').text('Starting game...');
            console.log('Game start initiated for room:', data.roomId);
        });

        // Update game started handler
        socket.on('game_started', (gameData) => {
            console.time('gameLoadingTime');
            console.log('[Loading] Game start received:', new Date().toISOString());

            const loadingEl = $('<div class="loading-spinner"></div>');
            $('#gameContainer').append(loadingEl);

            // Add timer initialization
            const timerElement = $('<div class="game-timer">3:00</div>');
            $('#game').append(timerElement);
            gameState.timer.element = timerElement[0];
            timerElement.fadeIn(500);

            console.log('Timer element initialized:', {
                element: gameState.timer.element,
                parent: $('#game').length,
                visible: timerElement.is(':visible')
            });

            console.log('[Loading] Room check:', {
                current: window.currentRoomId,
                received: gameData.roomId
            });
            // Ensure we're in the correct room
            if (gameData.roomId !== window.currentRoomId) {
                console.error('Room ID mismatch');
                return;
            }


            console.log('[Loading] Hiding lobby, showing game container');
            $('.lobby-container').hide();
            $('#gameContainer').show();

            console.log('[Loading] Starting game initialization');
            startGame(gameData);

            // Stop refreshing when game starts
            GameStats.stopAutoRefresh();
            console.timeEnd('gameLoadingTime'); // End timing

            // Initialize game stats
            gameState.stats = {
                damageDealt: 0,
                powerupsCollected: 0,
                startTime: Date.now()
            };
            
            // Start periodic stats update
            gameState.statsInterval = setInterval(updateGameStats, 1000);
        });


        // Update the weapon_spawned handler to use .call() like powerups
        socket.on('weapon_spawned', (weaponData) => {
            if (weaponData.roomId === window.currentRoomId && window.game?.scene?.scenes[0]) {
                spawnWeapon.call(
                    window.game.scene.scenes[0],
                    weaponData.x,
                    weaponData.y,
                    weaponData.weaponConfig,
                    weaponData.id
                );
            }
        });

        // Add this after the weapon_spawned handler
        socket.on('weapon_collected', (data) => {
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

            // Get the current game scene properly
            const currentScene = window.game?.scene?.scenes[0];
            if (!currentScene || !currentScene.scene.isActive) {
                console.error('No active game scene found');
                return;
            }

            if (powerupData.roomId === window.currentRoomId) {


                // Wait for next frame to ensure scene is ready
                currentScene.time.delayedCall(0, () => {
                    const powerupSprite = spawnPowerup.call(
                        currentScene,
                        powerupData.x,
                        powerupData.y,
                        powerupData.powerupConfig,
                        powerupData.id
                    );

                    if (powerupSprite) {
                        // Add collision with all players
                        PlayerManager.players.forEach(playerSprite => {
                            currentScene.physics.add.overlap(
                                playerSprite,
                                powerupSprite,
                                (player, powerup) => collectPowerup(player, powerup, currentScene),
                                null,
                                currentScene
                            );
                        });
                    }
                });
            }
        });

        socket.on('powerup_collected', (data) => {
            console.group('Powerup Collection Debug');
            console.log('Powerup collected event data:', {
                playerId: data.playerId,
                powerupType: data.powerupType,
                position: { x: data.x, y: data.y },
                isLocalPlayer: data.playerId === socket.id
            });
            
            const scene = window.game?.scene?.scenes[0];
            if (!scene) {
                console.error('❌ No active scene found for powerup cleanup');
                console.groupEnd();
                return;
            }
            console.log('✓ Scene found:', scene.scene.key);
        
        
            // Update the collecting player's effects
            const playerSprite = PlayerManager.players.get(data.playerId);
            if (playerSprite) {
                console.log('✓ Player sprite found:', {
                    id: data.playerId,
                    position: { x: playerSprite.x, y: playerSprite.y }
                });

                if (data.playerId !== socket.id) {
                    console.log('📡 Applying remote player powerup effect:', data.powerupType);
                    applyPowerupEffect(playerSprite, data.powerupType);
                    showPowerupFeedback(scene, playerSprite, data.powerupType.name, false);
                } else {
                    // For the local player
                    console.log('🎮 Applying local player powerup effect:', data.powerupType);
                    const powerupConfig = {
                        name: data.powerupType.name.toLowerCase(),
                        duration: data.powerupType.duration,
                        multiplier: data.powerupType.multiplier
                    };
                    
                    // Apply the powerup effect
                    applyPowerupEffect(playerSprite, data.powerupType);
                    
                    // Update display for non-health powerups
                    if (powerupConfig.name !== 'health') {
                        // Initialize gameState.activePowerups if it doesn't exist
                        if (!gameState.activePowerups) {
                            gameState.activePowerups = {};
                        }
                        
                        // Pass the normalized powerup configuration
                        updateActivePowerupsDisplay(scene, powerupConfig);
                    }
                    
                    showPowerupFeedback(scene, playerSprite, powerupConfig.name, true);
                }
            }
        
            // Clean up powerup sprites
            const powerupsToClean = scene.children.list.filter(child => 
                child.texture && 
                child.texture.key && 
                child.texture.key.startsWith('powerup_') &&
                Math.abs(child.x - data.x) < 20 && 
                Math.abs(child.y - data.y) < 20
            );

            console.log('🧹 Powerups found for cleanup:', {
                count: powerupsToClean.length,
                positions: powerupsToClean.map(p => ({ x: p.x, y: p.y, key: p.texture.key }))
            });
        
            powerupsToClean.forEach(powerupSprite => {
                try {
                    console.log('Cleaning up powerup:', {
                        id: powerupSprite.id,
                        position: { x: powerupSprite.x, y: powerupSprite.y },
                        key: powerupSprite.texture.key
                    });
                    // Remove from gameState
                    gameState.powerups.delete(powerupSprite.id);
                    gameState.powerups.delete(`pos_${Math.floor(powerupSprite.x)}_${Math.floor(powerupSprite.y)}`);
        
                    // Disable physics
                    if (powerupSprite.body) {
                        powerupSprite.body.enable = false;
                    }
        
                    // Remove colliders
                    if (scene.physics?.world) {
                        scene.physics.world.colliders.getActive()
                            .filter(collider => 
                                collider.object1 === powerupSprite || 
                                collider.object2 === powerupSprite
                            ).forEach(collider => {
                                collider.destroy();
                            });

                    }
        
                    // Destroy the sprite
                    powerupSprite.destroy(true);
                    console.log('✓ Powerup cleanup successful');
                } catch (error) {
                    console.error('Error during powerup cleanup:', error);
                }
            });
        
            if (powerupsToClean.length === 0) {
                console.log('No powerups found to clean up at location:', {x: data.x, y: data.y});
            }
            console.groupEnd();

        });

        socket.on('player_attack', (attackData) => {

            // Skip if it's our own attack
            if (attackData.id === socket.id) {
                return;
            }

            // Handle the attack animation for other players
            if (window.game && window.game.scene.scenes[0]) {
                const otherPlayer = PlayerManager.players.get(attackData.id);
                if (otherPlayer) {
                    // Stop any current movement
                    otherPlayer.setVelocityX(0);
                    // Update player direction first
                    otherPlayer.direction = attackData.direction;
                    // Play the attack animation
                    otherPlayer.playMeleeAttackAnimation(
                        window.game.scene.scenes[0],
                        otherPlayer,
                        attackData.weaponType
                    );
                }
            }
        });

        // Add inside the Socket IIFE, in the connect function
        socket.on('player_damaged', (data) => {
            if (window.game && window.game.scene.scenes[0]) {
                const scene = window.game.scene.scenes[0]
                const damagedPlayer = PlayerManager.players.get(data.targetId);

                if (damagedPlayer) {
                    // Show damage number
                    showDamageNumber(scene, data.x, data.y, data.damage);

                    // Apply damage to player
                    handlePlayerDamage(damagedPlayer, data.damage);
                }
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
            if (moveData.id === socket.id) {
                return;
            }

            if (window.game && window.game.scene.scenes[0]) {
                const otherPlayer = PlayerManager.players.get(moveData.id);
                if (otherPlayer) {
                    // If player is attacking, ignore movement updates completely
                    if (otherPlayer.isAttacking || otherPlayer.attackCooldown) {
                        return;
                    }

                    // Update player position and velocity
                    otherPlayer.setPosition(moveData.x, moveData.y);
                    otherPlayer.setVelocity(moveData.velocityX, moveData.velocityY);

                    // Handle animation state
                    if (moveData.isMoving && moveData.animation) {
                        if (otherPlayer.currentAnim !== moveData.animation) {
                            otherPlayer.playAnimation(moveData.animation);
                        }
                    } else {
                        // Stop animation and set idle texture when not moving
                        if (otherPlayer.animationTimer) {
                            otherPlayer.animationTimer.destroy();
                            otherPlayer.animationTimer = null;
                        }
                        otherPlayer.currentAnim = null;
                        otherPlayer.setTexture(
                            `Player${otherPlayer.number}_${otherPlayer.direction}_Hurt_${otherPlayer.currentProp}_3`
                        );
                    }
                }
            }
        });

        // socket.on('player_action', (actionData) => {
        //     if (window.game && window.game.scene.scenes[0] && actionData.id !== Socket.getSocket().id) {
        //         const otherPlayer = PlayerManager.players.get(actionData.id);
        //         if (otherPlayer) {
        //             switch (actionData.action) {
        //                 case 'attack':
        //                     // Visualize attack animation
        //                     playAttackAnimation(otherPlayer, actionData);
        //                     break;
        //                 case 'use_item':
        //                     // Show item use effects
        //                     playItemAnimation(otherPlayer, actionData);
        //                     break;
        //             }
        //         }
        //     }
        // });

        // Add these event handlers inside connect function
        socket.on('time_update', (data) => {


            if (gameState.timer.element) {
                const minutes = Math.floor(data.timeRemaining / 60);
                const seconds = data.timeRemaining % 60;
                const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;

                gameState.timer.element.textContent = timeString;
                if (data.timeRemaining <= 30) {
                    console.log('Adding warning class to timer');
                    gameState.timer.element.classList.add('warning');
                }
            } else {
                console.warn('Timer element not found in gameState');
            }
        });

        socket.on('game_ended', (data) => {
            // Stop all game activities
            gameState.gameStarted = false;

            // Remove all existing socket listeners for game events
            socket.removeAllListeners('player_movement');
            socket.removeAllListeners('player_attack');
            socket.removeAllListeners('weapon_collected');
            socket.removeAllListeners('powerup_collected');

            // Clear all game intervals and timers
            if (gameState.timer.interval) {
                clearInterval(gameState.timer.interval);
            }

            //Display appropriate end game message
            if (data.reason === 'time_up') {
                $('#game-over-reason').text('Time\'s Up!');
            } else if (data.reason === 'last_player_standing') {
                $('#game-over-reason').text('Last Player Standing!');
            }

            if (data.winner === Socket.getSocket().id) {
                $('#victory-text').show();
                $('#defeat-text').hide();
                // Update game record for win
                GameRecord.update(true);
            } else {
                $('#victory-text').hide();
                $('#defeat-text').show();
                // Update game record for loss
                GameRecord.update(false);
            }
            
            $('#gameContainer').hide();
            // Show end game screen
            $('#game-over-page').fadeIn(1000);
            
            // Clear stats update interval
            if (gameState.statsInterval) {
                clearInterval(gameState.statsInterval);
            }
            
            // Final stats update
            const gameStats = {
                damageDealt: gameState.stats.damageDealt || 0,
                powerupsCollected: gameState.stats.powerupsCollected || 0,
                survivalTime: Math.floor((Date.now() - gameState.stats.startTime) / 1000)
            };

            $('#damage-dealt').text(gameStats.damageDealt);
            $('#powerups-collected').text(gameStats.powerupsCollected);
            $('#survival-time').text(gameStats.survivalTime + 's');
            
            // Destroy the Phaser game instance
            if (window.game) {
                window.game.destroy(true);
                window.game = null;
            }

            // Clean up game state
            gameState.players.clear();
            gameState.weapons.clear();
            gameState.powerups.clear();
            gameState.roomId = null;  // Clear room ID

            // Resume stats auto-refresh and force immediate refresh
            GameStats.startAutoRefresh();
            GameStats.refreshStats(); // Force immediate refresh
        });

        // Add this inside the Socket IIFE connect function
        socket.on('player_animation_frame', (frameData) => {
            // Skip if it's our own animation
            if (frameData.id === socket.id) {
                return;
            }

            // Handle the animation frame for other players
            if (window.game && window.game.scene.scenes[0]) {
                const otherPlayer = PlayerManager.players.get(frameData.id);
                if (otherPlayer) {
                    // Set the texture directly for the frame
                    otherPlayer.setTexture(frameData.frame);

                    // Update direction if needed
                    otherPlayer.direction = frameData.direction;

                    // If this is a death animation, set death state
                    if (frameData.animation === 'death') {
                        otherPlayer.isDead = true;
                    }
                }
            }
        });

        socket.on('player_death_animation', (frameData) => {
            // Skip if it's our own animation
            if (frameData.id === socket.id) {
                return;
            }

            // Handle the death animation frame for other players
            if (window.game && window.game.scene.scenes[0]) {
                const otherPlayer = PlayerManager.players.get(frameData.id);
                if (otherPlayer) {
                    // Set the texture directly for the frame
                    otherPlayer.setTexture(frameData.frame);

                    // Update direction if needed
                    otherPlayer.direction = frameData.direction;

                    // Set death state
                    otherPlayer.isDead = true;

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
