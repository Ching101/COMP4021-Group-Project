// Player management and initialization
const PlayerManager = {
    // Store all players in the game
    players: new Map(),

    // Player colors for visual distinction
    playerColors: [0xff0000, 0x00ff00, 0x0000ff, 0xffff00],

    // In PlayerManager
    createPlayer: function (scene, playerData, spawnPoint) {
        // Load character sprites and animations
        loadCharacterSprites(scene, playerData);

        // Create player sprite
        const playerSprite = scene.physics.add
            .sprite(spawnPoint.x, spawnPoint.y, `Player${playerData.number}_right_Hurt_Bare_3`)
            .setDepth(1)
            .setScale(2)
            .setAlpha(1)
            .setVisible(true);

        // Create and attach name label with larger offset
        const nameLabel = scene.add
            .text(spawnPoint.x, spawnPoint.y - 40, playerData.username, { // Increased from -50 to -80
                fontSize: "16px",
                fill: "#fff",
                //backgroundColor: "#00000080", // Optional: adds a semi-transparent background
                //padding: { x: 4, y: 2 }       // Optional: adds padding around text
            })
            .setOrigin(0.5)
            .setDepth(2); // Ensure name is above player sprite

        // Store reference to name label
        playerSprite.nameLabel = nameLabel;

        // Set player properties
        playerSprite.id = playerData.id;
        playerSprite.number = playerData.number;
        playerSprite.direction = 'right';
        playerSprite.currentProp = 'Bare';  // Use capital B
        playerSprite.health = 100;
        playerSprite.setCollideWorldBounds(true);

        // Add update listener to keep name label with player
        scene.events.on('update', () => {
            if (playerSprite.active) {
                nameLabel.setPosition(playerSprite.x, playerSprite.y - 40); // Increased from -50 to -80
            }
        });

        // Add custom play function to the sprite
        playerSprite.playAnimation = function (animationKey, forceRestart = false) {
            // Debug logs for initial state
            console.log('Starting animation:', {
                animationKey,
                currentAnim: this.currentAnim,
                hasTimer: !!this.animationTimer
            });

            // Don't restart the same animation unless forced
            if (!forceRestart && this.currentAnim === animationKey) {
                return;
            }

            // Clear existing animation timer
            if (this.animationTimer) {
                this.animationTimer.destroy();
                this.animationTimer = null;
            }

            this.currentAnim = animationKey;
            this.currentFrame = 1;

            // Set initial texture
            const initialTexture = `${animationKey}_1`;
            this.setTexture(initialTexture);

            // Determine max frames based on animation type
            this.maxFrames = this.currentAnim.includes('Run') ? 7 :
                this.currentAnim.includes('Jump') ? 13 :
                    this.currentAnim.includes('Hurt') ? 3 :
                        this.currentAnim.includes('Attack') ? 8 : 10;

            // Only create timer for running animations or if explicitly requested
            const shouldLoop = this.currentAnim.includes('Run');

            if (shouldLoop) {
                this.animationTimer = scene.time.addEvent({
                    delay: 100, // 10 fps
                    callback: () => {
                        this.currentFrame++;
                        if (this.currentFrame > this.maxFrames) {
                            this.currentFrame = 1;
                        }
                        const textureKey = `${this.currentAnim}_${this.currentFrame}`;
                        this.setTexture(textureKey);
                    },
                    loop: true
                });
            } else {
                // For non-looping animations, play once and return to idle
                this.animationTimer = scene.time.addEvent({
                    delay: 100,
                    callback: () => {
                        this.currentFrame++;
                        if (this.currentFrame > this.maxFrames) {
                            // Return to idle state
                            this.anims.stop();
                            const idleTexture = `Player${this.number}_${this.direction}_Hurt_${this.currentProp}_3`;
                            this.setTexture(idleTexture);
                            this.animationTimer.destroy();
                            this.animationTimer = null;
                            this.currentAnim = null;
                        } else {
                            const textureKey = `${this.currentAnim}_${this.currentFrame}`;
                            this.setTexture(textureKey);
                        }
                    },
                    loop: false,
                    repeat: this.maxFrames - 1
                });
            }
        };


        // Add to players map
        this.players.set(playerData.id, playerSprite);

        return playerSprite;
    },

    updatePlayerProp: function (playerSprite, prop) {
        playerSprite.currentProp = prop;
    },

    // Remove a player
    removePlayer: function (playerId) {
        const player = this.players.get(playerId)
        if (player) {
            player.destroy()
            this.players.delete(playerId)
        }
    },
}

const config = {
    type: Phaser.AUTO,
    parent: "game",
    width: 800,
    height: 600,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 800,
        height: 600,
    },
    physics: {
        default: "arcade",
        arcade: {
            gravity: { y: 800 },
            debug: true,
        },
    },
    scene: {
        preload: preload,
        create: create,
    }
};


// Game state variables
let player
let healthBar
let cursors
let weapons = []
let powerups = []
let gameTimer
let currentWeapon = null
const WEAPONS = {
    DAGGER: {
        name: "dagger",
        damage: 15,
        attackSpeed: 200,
        throwSpeed: 600,
        range: 30,
        isThrowable: true,
    },
    SWORD: {
        name: "sword",
        damage: 25,
        attackSpeed: 400,
        range: 50,
        isThrowable: false,
    },
    BOW: {
        name: "bow",
        damage: 35,
        chargeTime: 500,
        range: 600,
        projectileSpeed: 800,
        isThrowable: false,
    },
}

const POWERUPS = {
    HEALTH: {
        name: "health",
        effect: 20, // HP to restore
        color: 0xff0000, // Red
    },
    ATTACK: {
        name: "attack",
        multiplier: 2,
        duration: 10000, // 10 seconds
        color: 0xff6b00, // Orange
    },
    SPEED: {
        name: "speed",
        multiplier: 1.5,
        duration: 8000, // 8 seconds
        color: 0x00ff00, // Green
    },
}

let platforms
let debugText

// 1. Add multiplayer state management
const gameState = {
    players: new Map(),
    weapons: new Map(),
    powerups: new Map(),
    gameStarted: false,
    //matchTimer: null,
    roomId: null,
    timer: {
        element: null,
        remaining: 0,
        interval: null
    }

};

// 2. Define spawn points
const SPAWN_POINTS = [
    { x: 100, y: 300 }, // Top-left
    { x: 700, y: 300 }, // Top-right
    { x: 100, y: 500 }, // Bottom-left
    { x: 700, y: 500 }, // Bottom-right
]

// 3. Socket event handlers for synchronization
//socket.on('player_joined', handlePlayerJoin);
// const socket = Socket.getSocket();
// if (socket) {
//     socket.on('player_movement', handlePlayerMovement);
//     socket.on('weapon_spawn', handleWeaponSpawn);
//     socket.on('powerup_spawn', handlePowerupSpawn);
//     socket.on('game_start', handleGameStart);
// }
function preload() {
    this.load.on("loaderror", function (file) {
        console.error("Error loading file:", file.src)
    })

    this.load.image(
        "background",
        "./assets/background/2d-pvp-arena-1-pixel-1.png"
    )

    // Create player texture
    const graphics = this.add.graphics()

    // Player (green rectangle with border)
    // graphics.fillStyle(0x00ff00)
    // graphics.fillRect(0, 0, 32, 48)
    // graphics.generateTexture("player", 32, 48)

    // graphics.clear()
    // graphics.fillStyle(0x800080)
    // graphics.fillRect(0, 0, 20, 5)
    // graphics.generateTexture("arrow", 20, 5)

    // Weapons
    // graphics.clear()
    // graphics.fillStyle(0xffff00)
    // graphics.fillRect(0, 0, 20, 8)
    // graphics.generateTexture("dagger", 20, 8)

    // graphics.clear()
    // graphics.fillStyle(0xff0000)
    // graphics.fillRect(0, 0, 30, 10)
    // graphics.generateTexture("sword", 30, 10)

    // graphics.clear()
    // graphics.fillStyle(0x800080)
    // graphics.fillRect(0, 0, 25, 15)
    // graphics.generateTexture("bow", 25, 15)

    // graphics.clear()
    // graphics.fillStyle(0x800080)
    // graphics.fillRect(0, 0, 20, 5)
    // graphics.generateTexture("arrow", 20, 5)

    // Load weapon sprites
    this.load.image('dagger', './assets/weapons/daggers.png');
    this.load.image('sword', './assets/weapons/sword.png');
    this.load.image('bow', './assets/weapons/bow.png');
    this.load.image('arrow', './assets/weapons/arrow.png');

    // Powerups
    // graphics.clear()
    // graphics.fillStyle(0xff0000)
    // graphics.fillCircle(8, 8, 8)
    // graphics.generateTexture("powerup_health", 16, 16)

    // graphics.clear()
    // graphics.fillStyle(0xff6b00)
    // graphics.fillCircle(8, 8, 8)
    // graphics.generateTexture("powerup_attack", 16, 16)

    // graphics.clear()
    // graphics.fillStyle(0x00ff00)
    // graphics.fillCircle(8, 8, 8)
    // graphics.generateTexture("powerup_speed", 16, 16)


    // Load powerup sprites
    this.load.image('powerup_health', './assets/powerups/health.png');
    this.load.image('powerup_attack', './assets/powerups/attack.png');
    this.load.image('powerup_speed', './assets/powerups/speed.png');

    // Ground (brown rectangle)
    graphics.fillStyle(0x966f33)
    graphics.fillRect(0, 0, 800, 64)
    graphics.generateTexture("ground", 800, 64)

    graphics.destroy()

    for (let i = 1; i <= 4; i++) {
        const directions = ['left', 'right'];
        const actions = {
            'Run': 7,
            'Jump': 13,
            'Hurt': 3,
            'Death': 10,
            'Attack': 8,
        };
        const props = ['Bare', 'Dagger', 'Sword', 'Bow'];

        // Load animations for each prop
        directions.forEach(direction => {
            props.forEach(prop => {
                Object.entries(actions).forEach(([action, frameCount]) => {
                    // Skip Attack animation for Bare prop
                    if (action === 'Attack' && prop === 'Bare') {
                        return;
                    }

                    for (let frame = 1; frame <= frameCount; frame++) {
                        const path = `./assets/characters/Player${i}/${direction}/${action}/${prop}/${frame}.png`;
                        // Use consistent capitalization in the key
                        const key = `Player${i}_${direction}_${action}_${prop}_${frame}`;
                        this.load.image(key, path);
                    }
                });
            });
        });
    }
}

function create() {
    // Create game world
    createGameWorld.call(this)

    // Initialize socket handlers
    initializeMultiplayerHandlers.call(this);

    // Add player collisions
    this.physics.add.collider(
        Object.values(PlayerManager.players),
        Object.values(PlayerManager.players)
    )

    // Send ready signal
    const socket = Socket.getSocket()
    if (socket) {
        // Bind the handler to this scene
        this.handlePlayerMovement = function (moveData) {
            if (!moveData || !moveData.id) return;

            const playerSprite = PlayerManager.players.get(moveData.id);
            if (playerSprite && moveData.id !== socket.id) {
                playerSprite.setPosition(moveData.x, moveData.y);
                playerSprite.setVelocity(moveData.velocityX, moveData.velocityY);
                playerSprite.direction = moveData.direction;

                // Update animation if provided
                if (moveData.animation) {
                    playerSprite.playAnimation(moveData.animation);
                }
            }
        };

        // Now bind all socket listeners
        socket.on("player_movement", (moveData) =>
            this.handlePlayerMovement(moveData)
        );

        socket.on('weapon_spawned', (weaponData) => {
            console.log('Received weapon spawn:', weaponData);
            if (weaponData.roomId === gameState.roomId) {
                spawnWeapon.call(
                    this,
                    weaponData.x,
                    weaponData.y,
                    weaponData.weaponConfig,
                    weaponData.id
                );
            }
        });

        socket.on('weapon_collected', (data) => {
            const weapon = gameState.weapons.get(data.weaponId);
            if (weapon) {
                gameState.weapons.delete(data.weaponId);
                weapon.destroy();
            }
        });

        socket.on('powerup_spawned', (powerupData) => {
            console.log('Received powerup spawn:', powerupData);
            if (powerupData.roomId === gameState.roomId) {
                spawnPowerup.call(
                    this,
                    powerupData.x,
                    powerupData.y,
                    powerupData.powerupConfig,
                    powerupData.id
                );
            }
        });

        socket.on('powerup_collected', (data) => {
            console.log('Powerup collection event received:', {
                powerupId: data.powerupId,
                existingPowerups: Array.from(gameState.powerups.entries()).map(([id, p]) => ({
                    id,
                    active: p.active,
                    visible: p.visible,
                    position: { x: p.x, y: p.y }
                }))
            });

            let powerup = gameState.powerups.get(data.powerupId);

            // If not found by ID, try to find by position
            if (!powerup) {
                for (const [id, p] of gameState.powerups.entries()) {
                    if (Math.abs(p.x - data.x) < 5 && Math.abs(p.y - data.y) < 5) {
                        console.log('Found powerup by position instead of ID');
                        powerup = p;
                        break;
                    }
                }
            }

            if (powerup) {
                // Apply powerup effect to the correct player
                const playerSprite = PlayerManager.players.get(data.playerId);
                if (playerSprite) {
                    applyPowerupEffect(playerSprite, data.powerupType);
                }

                // Clean up the powerup
                gameState.powerups.delete(data.powerupId);
                powerup.destroy();
            } else {
                console.warn('Powerup not found:', {
                    requestedId: data.powerupId,
                    position: { x: data.x, y: data.y },
                    availablePowerups: Array.from(gameState.powerups.entries()).map(([id, p]) => ({
                        id,
                        position: { x: p.x, y: p.y }
                    }))
                });
            }
        });
    }
    // Initialize game state
    gameState.roomId = window.currentRoomId;
    gameState.gameStarted = true;

    console.log('Game created with room ID:', gameState.roomId);
}

function createGameWorld() {
    // Create background
    const background = this.add
        .image(400, 300, "background")
        .setDepth(-1)
        .setDisplaySize(800, 600);

    // Create platforms group
    platforms = this.physics.add.staticGroup();
    gameState.platforms = platforms;  // Store in gameState

    // Create main ground
    const ground = platforms.create(400, 580, "ground");
    ground.setDisplaySize(800, 64);
    ground.refreshBody();

    // Add floating platforms
    const platform1 = platforms.create(200, 450, "ground");
    platform1.setDisplaySize(200, 20);
    platform1.refreshBody();

    const platform2 = platforms.create(400, 350, "ground");
    platform2.setDisplaySize(200, 20);
    platform2.refreshBody();

    const platform3 = platforms.create(600, 450, "ground");
    platform3.setDisplaySize(200, 20);
    platform3.refreshBody();

    const platform4 = platforms.create(100, 250, "ground");
    platform4.setDisplaySize(100, 20);
    platform4.refreshBody();

    const platform5 = platforms.create(700, 250, "ground");
    platform5.setDisplaySize(100, 20);
    platform5.refreshBody();

    return platforms;
}


function initializeMultiplayerHandlers() {
    const scene = this
    // Handle player movement updates
    this.handlePlayerMovement = function (moveData) {
        // Get player sprite from PlayerManager
        const playerSprite = PlayerManager.players.get(moveData.id)

        if (playerSprite && moveData.id !== Socket.getSocket().id) {
            // Update player position and velocity
            playerSprite.setPosition(moveData.x, moveData.y)
            playerSprite.setVelocity(moveData.velocityX, moveData.velocityY)
            playerSprite.flipX = moveData.flipX

            // Update player direction for weapon handling
            playerSprite.direction = moveData.velocityX < 0 ? "left" : "right"
        }
    }
}

function setupPlayerControls(playerSprite) {
    // Setup controls using WASD and Spacebar
    cursors = this.input.keyboard.addKeys({
        up: Phaser.Input.Keyboard.KeyCodes.SPACE,
        left: Phaser.Input.Keyboard.KeyCodes.A,
        right: Phaser.Input.Keyboard.KeyCodes.D,
    });

    // Create single movement update timer with a shorter delay
    const movementTimer = this.time.addEvent({
        delay: 16,
        callback: () => {
            if (!playerSprite.active) return;

            let currentAnimation = null;
            let isMoving = false;

            // Handle horizontal movement
            if (cursors.left.isDown && !cursors.right.isDown) {
                playerSprite.setVelocityX(-160);
                currentAnimation = `Player${playerSprite.number}_left_Run_${playerSprite.currentProp}`;
                playerSprite.direction = 'left';
                isMoving = true;
            } else if (cursors.right.isDown && !cursors.left.isDown) {
                playerSprite.setVelocityX(160);
                currentAnimation = `Player${playerSprite.number}_right_Run_${playerSprite.currentProp}`;
                playerSprite.direction = 'right';
                isMoving = true;
            } else {
                playerSprite.setVelocityX(0);
                // Explicitly stop running animation when not moving horizontally
                if (playerSprite.anims.currentAnim && playerSprite.anims.currentAnim.key.includes('Run')) {
                    playerSprite.anims.stop();
                }
            }

            // Handle jumping
            if (cursors.up.isDown && playerSprite.body.touching.down) {
                playerSprite.setVelocityY(-500);
                currentAnimation = `Player${playerSprite.number}_${playerSprite.direction}_Jump_${playerSprite.currentProp}`;
                isMoving = true;
            }

            // Set idle state when not moving
            if (!isMoving) {
                if (playerSprite.animationTimer) {
                    playerSprite.animationTimer.destroy();
                    playerSprite.animationTimer = null;
                }
                playerSprite.currentAnim = null;
                const idleTexture = `Player${playerSprite.number}_${playerSprite.direction}_Hurt_${playerSprite.currentProp}_3`;
                playerSprite.setTexture(idleTexture);
            } else if (currentAnimation && (playerSprite.currentAnim !== currentAnimation || !playerSprite.animationTimer)) {
                playerSprite.playAnimation(currentAnimation);
            }

            // Emit movement data
            const socket = Socket.getSocket();
            if (socket) {
                socket.emit("player_movement", {
                    roomId: gameState.roomId,
                    id: socket.id,
                    x: playerSprite.x,
                    y: playerSprite.y,
                    velocityX: playerSprite.body.velocity.x,
                    velocityY: playerSprite.body.velocity.y,
                    direction: playerSprite.direction,
                    animation: isMoving ? currentAnimation : null,
                    currentProp: playerSprite.currentProp,
                    isMoving: isMoving
                });
            }
        },
        loop: true,
    });





    // Create health bar
    createHealthBar.call(this)

    // Setup mouse input for attacks
    this.input.on(
        "pointerdown",
        function (pointer) {
            basicAttack.call(this, pointer)
        },
        this
    )


}


function handlePlayerUpdate(moveData) {
    const otherPlayer = PlayerManager.players.get(moveData.id);
    if (!otherPlayer) return;

    // Update position
    otherPlayer.x = moveData.x;
    otherPlayer.y = moveData.y;
    otherPlayer.setVelocityX(moveData.velocityX);
    otherPlayer.setVelocityY(moveData.velocityY);
    otherPlayer.direction = moveData.direction;

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

function createHealthBar() {
    healthBar = this.add.graphics()
    updateHealthBar.call(this)
}

function updateHealthBar() {
    healthBar.clear()
    // Background
    healthBar.fillStyle(0xff0000)
    healthBar.fillRect(10, 10, 200, 20)
    // Health
    healthBar.fillStyle(0x00ff00)
    healthBar.fillRect(10, 10, 200 * (player.health / 100), 20)
}

function basicAttack(pointer) {
    if (!currentWeapon) {
        // Visual feedback for no weapon
        const text = this.add
            .text(player.x, player.y - 50, "No weapon!", {
                fontSize: "16px",
                fill: "#ff0000",
            })
            .setOrigin(0.5);

        this.tweens.add({
            targets: text,
            y: text.y - 30,
            alpha: 0,
            duration: 1000,
            onComplete: () => text.destroy(),
        });
        return;
    }

    if (player.attackCooldown) return;

    const time = this.time.now;
    if (time < player.lastAttackTime + currentWeapon.attackSpeed) return;

    player.attackCooldown = true;
    player.lastAttackTime = time;

    // Use our custom playAnimation instead of Phaser's play
    // const attackAnim = `Player${player.number}_${player.direction}_Attack_${player.currentProp}`;
    // player.playAnimation(attackAnim, false);  // false for non-looping attack animation

    // Handle different weapon types
    switch (currentWeapon.name) {
        case "bow":
            chargeBow.call(this, pointer);
            break;
        case "dagger":
            meleeAttack.call(this, currentWeapon.damage, currentWeapon.range);
            break;
        case "sword":
            meleeAttack.call(this, currentWeapon.damage, currentWeapon.range);
            break;
    }

    // Reset attack cooldown
    this.time.delayedCall(currentWeapon.attackSpeed, () => {
        player.attackCooldown = false;

        // Return to idle state after attack
        const idleAnim = `Player${player.number}_${player.direction}_Hurt_${player.currentProp}`;
        player.setTexture(`${idleAnim}_3`);  // Use frame 3 for idle
    });
}

// function startItemSpawning() {
//     // Spawn weapons every 5 seconds
//     this.time.addEvent({
//         delay: 5000,
//         callback: () => {
//             const weaponTypes = Object.keys(WEAPONS);
//             const randomType = weaponTypes[Math.floor(Math.random() * weaponTypes.length)];
//             const weaponConfig = WEAPONS[randomType];

//             const x = Phaser.Math.Between(50, 750);
//             const y = Phaser.Math.Between(50, 500);

//             // Generate unique ID for the weapon
//             const id = Date.now();

//             // Emit weapon spawn event to server
//             const socket = Socket.getSocket();
//             if (socket) {
//                 socket.emit('spawn_weapon', {
//                     roomId: window.currentRoomId,
//                     type: randomType,
//                     weaponConfig: weaponConfig,
//                     x: x,
//                     y: y,
//                     id: id
//                 });
//             }
//         },
//         loop: true,
//     });

//     // Spawn powerups every 10 seconds
//     this.time.addEvent({
//         delay: 10000,
//         callback: () => {
//             const powerupTypes = Object.keys(POWERUPS);
//             const randomType = powerupTypes[Math.floor(Math.random() * powerupTypes.length)];
//             const powerupConfig = POWERUPS[randomType];

//             const x = Phaser.Math.Between(50, 750);
//             const y = Phaser.Math.Between(50, 500);

//             // Generate unique ID for the powerup
//             const id = Date.now();

//             // Emit powerup spawn event to server
//             const socket = Socket.getSocket();
//             if (socket) {
//                 socket.emit('spawn_powerup', {
//                     roomId: window.currentRoomId,
//                     type: randomType,
//                     powerupConfig: powerupConfig,
//                     x: x,
//                     y: y,
//                     id: id
//                 });
//             }
//         },
//         loop: true,
//     });
// }

// Move spawnWeapon outside of config

function spawnWeapon(x, y, weaponConfig, id) {
    console.log('Spawning weapon:', { x, y, weaponConfig, id });

    // Create the weapon sprite
    const weapon = this.physics.add.sprite(x, y, weaponConfig.name)
        .setScale(1)
        .setDepth(1);

    // Enable physics
    this.physics.world.enable(weapon);

    // Set collision bounds
    weapon.setCollideWorldBounds(true);

    // Add gravity
    weapon.body.setGravity(0, 800);

    // Store the weapon configuration and ID
    weapon.type = weaponConfig;
    weapon.id = id;

    // Add collision with platforms
    if (platforms) {
        this.physics.add.collider(weapon, platforms);
    }

    // Define collectWeapon as a scene method
    this.collectWeapon = function (playerSprite, weapon) {
        if (!weapon.active) return;

        const weaponConfig = weapon.type;

        // Stop any current animations
        playerSprite.anims.stop();

        // Update player's prop for animations
        const weaponName = weaponConfig.name.charAt(0).toUpperCase() + weaponConfig.name.slice(1);
        PlayerManager.updatePlayerProp(playerSprite, weaponName);

        // Set current weapon for the local player
        if (playerSprite === player) {
            currentWeapon = weaponConfig;
        }

        // Emit weapon collection to server
        const socket = Socket.getSocket();
        if (socket) {
            socket.emit('weapon_collected', {
                roomId: gameState.roomId,
                weaponId: weapon.id,
                playerId: socket.id,
                weaponName: weaponName,
                x: weapon.x,
                y: weapon.y
            });
        }

        // Set idle texture immediately
        playerSprite.setTexture(
            `Player${playerSprite.number}_${playerSprite.direction}_Hurt_${playerSprite.currentProp}_3`
        );

        // Remove weapon from game state and destroy sprite
        gameState.weapons.delete(weapon.id);
        weapon.destroy();

        // Add collection feedback
        const text = this.add
            .text(playerSprite.x, playerSprite.y - 50, `Picked up ${weaponConfig.name}!`, {
                fontSize: "16px",
                fill: "#fff",
            })
            .setOrigin(0.5);

        this.tweens.add({
            targets: text,
            y: text.y - 30,
            alpha: 0,
            duration: 1000,
            onComplete: () => text.destroy(),
        });
    };

    // Add overlap with all players
    PlayerManager.players.forEach(playerSprite => {
        this.physics.add.overlap(
            playerSprite,
            weapon,
            this.collectWeapon,
            null,
            this
        );
    });

    // Store weapon in game state
    gameState.weapons.set(id, weapon);

    return weapon;
}





// Update spawnPowerup function
// Remove the standalone collectPowerup function and keep the one inside spawnPowerup
function spawnPowerup(x, y, powerupConfig, id) {
    console.log('Spawning powerup:', { x, y, powerupConfig, id });

    const powerup = this.physics.add.sprite(x, y, `powerup_${powerupConfig.name}`)
        .setScale(0.6)
        .setDepth(1);

    // Enable physics and add gravity
    powerup.body.setGravityY(300);
    powerup.setBounce(0.2);
    powerup.setCollideWorldBounds(true);

    // Store the powerup configuration and ID
    powerup.type = powerupConfig;
    powerup.id = id;

    // Store powerup in game state BEFORE adding collisions
    if (!gameState.powerups) {
        gameState.powerups = new Map();
    }
    gameState.powerups.set(id, powerup);

    // Add collision with platforms
    if (gameState.platforms) {
        this.physics.add.collider(powerup, gameState.platforms);
    }

    // Add collision with all players
    PlayerManager.players.forEach(playerSprite => {
        this.physics.add.overlap(
            playerSprite,
            powerup,
            (player, powerupSprite) => {
                // Only handle collection if we're the collecting player
                if (player.id === Socket.getSocket().id) {
                    collectPowerup.call(this, player, powerupSprite);
                }
            },
            null,
            this
        );
    });

    console.log('Powerup spawned:', {
        id: powerup.id,
        position: { x: powerup.x, y: powerup.y },
        existingPowerups: Array.from(gameState.powerups.keys())
    });

    return powerup;
}

// Separate collectPowerup function for clarity
function collectPowerup(player, powerupSprite) {
    if (!powerupSprite.active || !powerupSprite.visible) return;

    const powerupId = powerupSprite.id;
    console.log('Attempting to collect powerup:', {
        powerupId,
        exists: gameState.powerups.has(powerupId),
        allPowerups: Array.from(gameState.powerups.entries()).map(([id, p]) => ({
            id,
            active: p.active,
            visible: p.visible,
            position: { x: p.x, y: p.y }
        }))
    });

    // Only collect if the powerup exists in gameState
    if (gameState.powerups.has(powerupId)) {
        const socket = Socket.getSocket();
        if (socket) {
            socket.emit('powerup_collected', {
                roomId: gameState.roomId,
                powerupId: powerupId,
                playerId: socket.id,
                powerupType: powerupSprite.type,
                x: powerupSprite.x,
                y: powerupSprite.y
            });
        }

        // Hide powerup but don't destroy it yet
        powerupSprite.setVisible(false);
        powerupSprite.body.enable = false;
    }
}


function applyPowerupEffect(playerSprite, powerupType) {
    console.log('Applying powerup effect:', powerupType);

    switch (powerupType.name) {
        case 'health':
            // Heal player
            if (playerSprite.health < 100) {
                playerSprite.health = Math.min(100, playerSprite.health + powerupType.effect);
                updateHealthBar();
            }
            break;

        case 'attack':
            // Temporarily increase attack damage
            playerSprite.attackMultiplier = powerupType.multiplier;
            setTimeout(() => {
                playerSprite.attackMultiplier = 1;
            }, powerupType.duration);
            break;

        case 'speed':
            // Temporarily increase movement speed
            playerSprite.speedMultiplier = powerupType.multiplier;
            setTimeout(() => {
                playerSprite.speedMultiplier = 1;
            }, powerupType.duration);
            break;
    }
}



function endMatch() {
    // Clear timer interval if it exists
    if (gameState.timer.interval) {
        clearInterval(gameState.timer.interval);
    }

    // Remove timer element
    if (gameState.timer.element) {
        gameState.timer.element.remove();
    }

    // Hide game container
    $('#gameContainer').hide();

    // Show game over page with animation
    $('#game-over-page').fadeIn(500);

    // Determine winner and show appropriate message
    const currentPlayer = PlayerManager.players.get(Socket.getSocket().id);
    const isWinner = currentPlayer && currentPlayer.health > 0;

    // Show victory or defeat message with animation
    if (isWinner) {
        $('#victory-text').fadeIn(1000);
        $('#defeat-text').hide();
        // Update game record for win
        GameRecord.update(true);
    } else {
        $('#defeat-text').fadeIn(1000);
        $('#victory-text').hide();
        // Update game record for loss
        GameRecord.update(false);
    }

    // Update final stats
    const gameStats = {
        damageDealt: gameState.damageDealt || 0,
        powerupsCollected: gameState.powerupsCollected || 0,
        survivalTime: Math.floor((Date.now() - gameState.startTime) / 1000)
    };

    $('#damage-dealt').text(gameStats.damageDealt);
    $('#powerups-collected').text(gameStats.powerupsCollected);
    $('#survival-time').text(gameStats.survivalTime + 's');

    // Clean up game state
    gameState.gameStarted = false;
    gameState.players.clear();
    gameState.weapons.clear();
    gameState.powerups.clear();

    // Resume stats auto-refresh
    GameStats.startAutoRefresh();
}

function meleeAttack(damage, range) {
    // Create attack hitbox
    const direction = player.direction === "left" ? -1 : 1;

    // Set attacking state and stop movement
    // player.isAttacking = true;
    // player.setVelocityX(0);

    const hitbox = this.add.rectangle(
        player.x + range * direction,
        player.y,
        range,
        40,
        0xff0000,
        0.2
    );

    // Get the correct animation key based on current weapon
    const prop = player.currentProp || 'Bare';
    const attackAnim = `Player${player.number}_${player.direction}_Attack_${prop}`;

    // Play attack animation (not looping)
    player.playAnimation(attackAnim, true);  // false for non-looping attack animation

    // Use a separate timer to track attack state
    this.time.delayedCall(800, () => {  // 800ms = roughly the duration of attack animation
        player.isAttacking = false;
        hitbox.destroy();

        // Return to idle state
        const idleAnim = `Player${player.number}_${player.direction}_Hurt_${prop}`;
        player.setTexture(`${idleAnim}_3`);  // Use frame 3 for idle
    });

    // Emit attack event for multiplayer if needed
    const socket = Socket.getSocket();
    if (socket) {
        socket.emit('player_attack', {
            roomId: gameState.roomId,
            id: socket.id,
            direction: player.direction,
            prop: prop
        });
    }
}

function throwDagger(pointer) {
    if (!currentWeapon || currentWeapon.name !== "dagger") return

    const projectile = this.physics.add.sprite(player.x, player.y, "dagger")

    // Direction based on player facing
    const direction = player.direction === "left" ? -1 : 1
    const throwSpeed = currentWeapon.throwSpeed || 600

    projectile.setVelocityX(direction * throwSpeed)

    // Rotate the dagger based on direction
    projectile.rotation = direction === -1 ? Math.PI : 0

    // Add debug visualization
    if (debugText) {
        const throwPath = this.add.graphics()
        throwPath.lineStyle(1, 0xffff00, 0.5)
        this.time.addEvent({
            delay: 16,
            callback: () => {
                if (projectile.active) {
                    throwPath.lineTo(projectile.x, projectile.y)
                }
            },
            repeat: 30,
        })
        this.time.delayedCall(500, () => throwPath.destroy())
    }

    // Cleanup thrown dagger after some time
    this.time.delayedCall(1000, () => {
        if (projectile && projectile.active) {
            projectile.destroy()
        }
    })

    // Drop the current weapon after throwing
    currentWeapon = null

    // Add visual feedback
    const text = this.add
        .text(player.x, player.y - 50, "Dagger thrown!", {
            fontSize: "16px",
            fill: "#fff",
        })
        .setOrigin(0.5)

    this.tweens.add({
        targets: text,
        y: text.y - 30,
        alpha: 0,
        duration: 1000,
        onComplete: () => text.destroy(),
    })
}

function chargeBow(pointer) {
    if (!currentWeapon) return

    const chargeStart = this.time.now

    // Visual charge effect
    const chargeBar = this.add.rectangle(
        player.x,
        player.y - 40,
        0,
        5,
        0xff0000
    )

    // Charge update
    const chargeInterval = this.time.addEvent({
        delay: 16,
        callback: () => {
            const chargeTime = this.time.now - chargeStart
            const chargePercent = Math.min(
                chargeTime / currentWeapon.chargeTime,
                1
            )
            chargeBar.width = 40 * chargePercent

            // Add glow effect as charge increases
            chargeBar.setFillStyle(
                0xff0000 + (Math.floor(chargePercent * 255) << 8)
            )
        },
        loop: true,
    })

    // Release on mouse up
    const releaseFunction = () => {
        chargeInterval.destroy()
        chargeBar.destroy()

        const chargeTime = this.time.now - chargeStart
        const power = Math.min(chargeTime / currentWeapon.chargeTime, 1)

        // Add charge feedback
        const powerText = this.add
            .text(
                player.x,
                player.y - 50,
                `Power: ${Math.floor(power * 100)}%`,
                {
                    fontSize: "16px",
                    fill: "#fff",
                }
            )
            .setOrigin(0.5)

        this.tweens.add({
            targets: powerText,
            y: powerText.y - 30,
            alpha: 0,
            duration: 500,
            onComplete: () => powerText.destroy(),
        })

        fireArrow.call(this, pointer, power)

        this.input.off("pointerup", releaseFunction)
    }

    this.input.on("pointerup", releaseFunction)
}

function fireArrow(pointer, power) {
    const arrow = this.physics.add.sprite(player.x, player.y, "arrow")

    // Calculate angle between player and pointer
    const angle = Phaser.Math.Angle.Between(
        player.x,
        player.y,
        pointer.worldX,
        pointer.worldY
    )

    // Set arrow rotation to match angle
    arrow.rotation = angle

    // Calculate velocity components using angle
    const speed = currentWeapon.projectileSpeed * power
    arrow.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed)

    // Add slight gravity effect
    arrow.body.setGravityY(150)

    // Add collision with platforms
    this.physics.add.collider(arrow, platforms, (arrow) => {
        // Stick the arrow where it hit
        arrow.body.setVelocity(0, 0)
        arrow.body.setGravityY(0)
        arrow.body.setImmovable(true)

        // Destroy arrow after a delay
        this.time.delayedCall(2000, () => {
            if (arrow && arrow.active) {
                arrow.destroy()
            }
        })
    })

    // Make arrow persist longer if it doesn't hit anything
    this.time.delayedCall(3000, () => {
        if (arrow && arrow.active) {
            arrow.destroy()
        }
    })

    // Add debug visualization of arrow path
    if (debugText) {
        const arrowPath = this.add.graphics()
        arrowPath.lineStyle(1, 0xff0000, 0.5)
        arrowPath.beginPath()
        arrowPath.moveTo(arrow.x, arrow.y)

        this.time.addEvent({
            delay: 16,
            callback: () => {
                if (arrow.active) {
                    arrowPath.lineTo(arrow.x, arrow.y)
                }
            },
            repeat: 50,
        })

        this.time.delayedCall(1000, () => {
            arrowPath.destroy()
        })
    }
}

const createCheatMenu = function () {
    const menu = document.createElement("div")
    menu.id = "cheat-menu"
    menu.style.display = "none"
    menu.innerHTML = `
        <div class="cheat-menu-content">
            <h3>Developer Tools</h3>
            <div class="cheat-options">
                <label>
                    <input type="checkbox" id="godMode"> God Mode
                </label>
                <label>
                    <input type="checkbox" id="speedBoost"> Speed Boost
                </label>
                <label>
                    <input type="checkbox" id="fullHeal"> Full Heal
                </label>
                <label>
                    <input type="checkbox" id="powerUp"> Power Up (2x damage)
                </label>
            </div>
        </div>
    `
    document.body.appendChild(menu)

    // Add event listeners for checkboxes
    document.getElementById("godMode").addEventListener("change", (e) => {
        activeEffects.godMode = e.target.checked
        if (e.target.checked) setHealth(1000)
        else setHealth(originalHealth)
    })

    document.getElementById("speedBoost").addEventListener("change", (e) => {
        activeEffects.speedBoost = e.target.checked
        if (e.target.checked) setSpeed(2)
        else setSpeed(originalSpeed)
    })

    document.getElementById("powerUp").addEventListener("change", (e) => {
        activeEffects.powerUp = e.target.checked
        if (e.target.checked) setDamageMultiplier(2)
        else setDamageMultiplier(1)
    })
}

const toggleCheatMode = function () {
    isCheatMode = !isCheatMode
    const menu = document.getElementById("cheat-menu")
    menu.style.display = isCheatMode ? "block" : "none"
    updateCheatUI()
}

const updateCheatUI = function () {
    const cheatIndicator = document.getElementById("cheat-indicator")
    if (!cheatIndicator) {
        const indicator = document.createElement("div")
        indicator.id = "cheat-indicator"
        indicator.style.position = "fixed"
        indicator.style.top = "10px"
        indicator.style.right = "10px"
        indicator.style.padding = "5px 10px"
        indicator.style.backgroundColor = "rgba(0, 0, 0, 0.7)"
        indicator.style.color = "#fff"
        indicator.style.borderRadius = "5px"
        indicator.style.display = isCheatMode ? "block" : "none"
        indicator.textContent = "CHEAT MODE"
        document.body.appendChild(indicator)
    } else {
        cheatIndicator.style.display = isCheatMode ? "block" : "none"
    }
}
function updateTimer() {
    const minutes = Math.floor(gameState.timer.remaining / 60);
    const seconds = gameState.timer.remaining % 60;
    gameState.timer.element.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    // Add warning class when less than 30 seconds remain
    if (gameState.timer.remaining <= 30) {
        gameState.timer.element.classList.add('warning');
    }

    if (gameState.timer.remaining <= 0) {
        // End game when timer reaches 0
        clearInterval(gameState.timer.interval);
        endMatch();
        gameState.timer.element.remove();
    }

    gameState.timer.remaining--;
}

// Add this function to handle game initialization
function startGame(gameData, socketId) {
    // Store room ID in game state
    gameState.roomId = gameData.roomId

    const gameContainer = document.getElementById('gameContainer');
    gameState.timer.element = document.createElement('div');
    gameState.timer.element.className = 'game-timer';
    gameContainer.appendChild(gameState.timer.element);

    // Initialize timer value (3 minutes = 180 seconds)
    gameState.timer.remaining = 180;

    // Initial display
    updateTimer();

    // Update every second
    gameState.timer.interval = setInterval(updateTimer, 1000);

    // Initialize Phaser game if not already created
    if (!window.game.scene) {
        console.log('Creating new Phaser game instance');
        // Add scene ready callback
        config.scene.create = function () {
            console.log('Scene create function called');
            // Call original create function
            create.call(this)

            // Now that scene is ready, spawn players
            console.log("Scene ready, spawning players")
            spawnAllPlayers.call(this, gameData.players, socketId)
        }
        window.game = new Phaser.Game(config)
    } else {
        //console.log(window.game)
        console.log('Phaser game instance already exists');
        // If game exists, check if the scene is active
        const currentScene = window.game.scene.scenes[0];
        if (currentScene) {
            console.log('Current scene found:', currentScene);
            if (currentScene.isActive) {
                console.log('Restarting active scene');
                // Restart the scene
                currentScene.scene.restart();
                // Wait for scene to be ready
                currentScene.events.once('create', function () {
                    console.log('Scene restarted, spawning players');
                    spawnAllPlayers.call(this, gameData.players);
                });
            } else {
                console.error('Game scene is not active');
                return; // Exit if the scene is not ready
            }
        } else {
            console.error('No current scene found');
            return; // Exit if no scene is found
        }
    }

    // Reset game state
    gameState.gameStarted = true;
    gameState.players.clear();
    gameState.weapons.clear();
    gameState.powerups.clear();
    console.log('Game state reset');


    // Check if the scene is active before spawning players
    const activeScene = window.game?.scene?.scenes[0];
    console.log('Is active scene:', activeScene?.isActive);
    if (activeScene?.isActive) {
        console.log('Game data before spawning players:', gameData);
        spawnAllPlayers.call(activeScene, gameData.players, socketId);
    }
    // Create and setup timer


    console.log("Game started in room:", gameData.roomId)
}

function spawnAllPlayers(playerAssignments, socketId) {
    // Clear existing players
    PlayerManager.players.clear()

    // Create all players at their assigned spawn points
    playerAssignments.forEach((playerData) => {
        // Get spawn point based on player number
        console.log("playerData", playerData)
        const spawnPoint = SPAWN_POINTS[playerData.spawnPoint]
        console.log("spawnPoint,playerData", spawnPoint, playerData)

        // Create new player with assigned position and color
        const newPlayer = PlayerManager.createPlayer(
            this,
            {
                ...playerData,
                x: spawnPoint.x,
                y: spawnPoint.y,
            },
            spawnPoint
        )

        console.log("newPlayer", newPlayer)

        // Add collision with platforms for all players
        this.physics.add.collider(newPlayer, platforms)
        console.log("Socket.getSocket()", Socket.getSocket().id)
        console.log("playerData.id", playerData.id)
        // If this is our player, set up controls and camera
        if (playerData.id === Socket.getSocket().id) {
            console.log("S yes")
            player = newPlayer
            setupPlayerControls.call(this, player)
            //this.cameras.main.startFollow(player);
        }
        // Add player name label
        // const nameLabel = this.add
        //     .text(spawnPoint.x, spawnPoint.y - 50, playerData.username, { // Changed from -20 to -50
        //         fontSize: "14px",
        //         fill: "#fff",
        //     })
        //     .setOrigin(0.5);

        // Make name label follow player
        // this.time.addEvent({
        //     delay: 16,
        //     callback: () => {
        //         if (newPlayer.active) {
        //             nameLabel.setPosition(newPlayer.x, newPlayer.y - 20)
        //         }
        //     },
        //     loop: true,
        // })
    })
}
function handlePlayerAction(actionType, data) {
    // Emit the action to other players
    Socket.getSocket().emit("player_action", {
        roomId: gameState.roomId,
        id: player.id,
        action: actionType,
        ...data,
    })
}

// Use this function for different actions:
function attackWithWeapon() {
    // Existing attack code...
    handlePlayerAction("attack", {
        weaponType: currentWeapon.name,
        position: { x: player.x, y: player.y },
        direction: player.flipX ? -1 : 1,
    })
}

function useItem() {
    // Existing item use code...
    handlePlayerAction("use_item", {
        itemType: currentItem.name,
        position: { x: player.x, y: player.y },
    })
}

const CheatMode = (function () {
    let isCheatMode = false
    let originalSpeed = 1
    let originalHealth = 100
    let activeEffects = {
        godMode: false,
        speedBoost: false,
        powerUp: false,
    }

    const createCheatMenu = function () {
        const menu = document.createElement("div")
        menu.id = "cheat-menu"
        menu.style.display = "none"
        menu.innerHTML = `
            <div class="cheat-menu-content">
                <h3>Developer Tools</h3>
                <div class="cheat-options">
                    <label>
                        <input type="checkbox" id="godMode"> God Mode
                    </label>
                    <label>
                        <input type="checkbox" id="speedBoost"> Speed Boost
                    </label>
                    <label>
                        <input type="checkbox" id="fullHeal"> Full Heal
                    </label>
                    <label>
                        <input type="checkbox" id="powerUp"> Power Up (2x damage)
                    </label>
                </div>
            </div>
        `
        document.body.appendChild(menu)

        // Add event listeners for checkboxes
        document.getElementById("godMode").addEventListener("change", (e) => {
            activeEffects.godMode = e.target.checked
            if (e.target.checked) setHealth(1000)
            else setHealth(originalHealth)
        })

        document
            .getElementById("speedBoost")
            .addEventListener("change", (e) => {
                activeEffects.speedBoost = e.target.checked
                if (e.target.checked) setSpeed(2)
                else setSpeed(originalSpeed)
            })

        document.getElementById("powerUp").addEventListener("change", (e) => {
            activeEffects.powerUp = e.target.checked
            if (e.target.checked) setDamageMultiplier(2)
            else setDamageMultiplier(1)
        })
    }

    const toggleCheatMode = function () {
        isCheatMode = !isCheatMode
        const menu = document.getElementById("cheat-menu")
        menu.style.display = isCheatMode ? "block" : "none"
        updateCheatUI()
    }

    const updateCheatUI = function () {
        const cheatIndicator = document.getElementById("cheat-indicator")
        if (!cheatIndicator) {
            const indicator = document.createElement("div")
            indicator.id = "cheat-indicator"
            indicator.style.position = "fixed"
            indicator.style.top = "10px"
            indicator.style.right = "10px"
            indicator.style.padding = "5px 10px"
            indicator.style.backgroundColor = "rgba(0, 0, 0, 0.7)"
            indicator.style.color = "#fff"
            indicator.style.borderRadius = "5px"
            indicator.style.display = isCheatMode ? "block" : "none"
            indicator.textContent = "CHEAT MODE"
            document.body.appendChild(indicator)
        } else {
            cheatIndicator.style.display = isCheatMode ? "block" : "none"
        }
    }

    // Helper functions to be connected with game mechanics
    const setHealth = function (value) {
        // To be implemented when connecting with game health system
        console.log("Health set to:", value)
    }

    const setSpeed = function (multiplier) {
        // To be implemented when connecting with game movement system
        console.log("Speed multiplier set to:", multiplier)
    }

    const setDamageMultiplier = function (multiplier) {
        // To be implemented when connecting with game damage system
        console.log("Damage multiplier set to:", multiplier)
    }

    // Initialize cheat mode key listener
    const initialize = function () {
        createCheatMenu()
        document.addEventListener("keydown", (event) => {
            if (event.key === "`" || event.key === "~") {
                toggleCheatMode()
            }
        })
    }

    return {
        initialize,
        isEnabled: () => isCheatMode,
        toggle: toggleCheatMode,
    }
})()

function loadCharacterSprites(scene, playerData) {
    const playerNumber = playerData.number;
    const directions = ['left', 'right'];
    const actionFrames = {
        'Run': 7,
        'Jump': 13,
        'Hurt': 3,
        'Death': 10
    };
    const props = ['Bare', 'Dagger', 'Sword', 'Bow'];

    directions.forEach(direction => {
        props.forEach(prop => {
            Object.entries(actionFrames).forEach(([action, frameCount]) => {
                const animKey = `Player${playerNumber}_${direction}_${action}_${prop}`;

                const frames = [];
                for (let i = 1; i <= frameCount; i++) {
                    frames.push({
                        key: `Player${playerNumber}_${direction}_${action}_${prop}_${i}`
                    });
                }

                scene.anims.create({
                    key: animKey,
                    frames: frames,
                    frameRate: 10,
                    repeat: action === 'Run' ? -1 : 0
                });
            });
        });
    });

    return `Player${playerNumber}_right_Hurt_Bare_3`;
}


function handlePlayerHurt(player) {
    const hurtAnim = `Player${player.number}_${player.direction}_Hurt_${player.currentProp}`;
    player.play(hurtAnim).once('animationcomplete', () => {
        // Return to previous animation after hurt animation completes
        if (player.body.velocity.x !== 0) {
            player.play(`player${player.number}_${player.direction}_run`);
        } else {
            player.play(`player${player.number}_${player.direction}_idle`);
        }
    });
}

// Update weapon pickup handling
function handleWeaponPickup(weapon) {
    if (!player) return;

    const weaponName = weapon.name.charAt(0).toUpperCase() + weapon.name.slice(1);
    PlayerManager.updatePlayerProp(player, weaponName);

    // Emit weapon pickup to other players if needed
    const socket = Socket.getSocket();
    if (socket) {
        socket.emit('weapon_pickup', {
            playerId: player.id,
            weapon: weaponName
        });
    }
}

// Initialize when document is ready
document.addEventListener("DOMContentLoaded", () => {
    CheatMode.initialize()
})

