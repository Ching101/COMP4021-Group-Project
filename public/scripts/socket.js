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
            //console.log('Received weapon spawn event:', weaponData);
            if (weaponData.roomId === window.currentRoomId && window.game?.scene?.scenes[0]) {
                //console.log('Spawning weapon in game');
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
            //console.log('Weapon collected:', data);
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
            //console.log('Received powerup spawn event:', powerupData);
        
            // Get the current game scene properly
            const currentScene = window.game?.scene?.scenes[0];
            if (!currentScene || !currentScene.scene.isActive) {
                console.error('No active game scene found');
                return;
            }
        
            if (powerupData.roomId === window.currentRoomId) {
                //console.log('Spawning powerup in game scene:', {
                //    sceneKey: currentScene.scene.key,
                //    powerupId: powerupData.id
                //});
        
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
            console.log('Powerup collected event received:', data);
            
            const scene = window.game?.scene?.scenes[0];
            if (!scene) {
                console.error('No active scene found for powerup cleanup');
                return;
            }
        
            // Update the collecting player's effects
            const playerSprite = PlayerManager.players.get(data.playerId);
            if (playerSprite) {
                // Only apply effects if we didn't already handle it locally
                if (data.playerId !== socket.id) {
                    applyPowerupEffect(playerSprite, data.powerupType);
                    showPowerupFeedback(scene, playerSprite, data.powerupType.name, false);
                } else {
                    // For the local player
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
        
            powerupsToClean.forEach(powerupSprite => {
                try {
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
                    console.log('Powerup cleanup completed:', powerupSprite.id);
                } catch (error) {
                    console.error('Error during powerup cleanup:', error);
                }
            });
        
            if (powerupsToClean.length === 0) {
                console.log('No powerups found to clean up at location:', {x: data.x, y: data.y});
            }
        });

        socket.on('player_attack', (attackData) => {
            console.log('Received player attack:', attackData);
            
            if (attackData.id === socket.id) {
                return;
            }
        
            if (window.game && window.game.scene.scenes[0]) {
                const otherPlayer = PlayerManager.players.get(attackData.id);
                if (otherPlayer) {
                    console.log('Playing attack animation for player:', attackData.id);
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
                const scene = window.game.scene.scenes[0];
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
    }

    const disconnect = function () {
        GameStats.stopAutoRefresh()
        socket.disconnect()
        socket = null
    }

    return { getSocket, connect, disconnect }
})()
