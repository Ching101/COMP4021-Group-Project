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
    playerSprite.playAnimation = function(animationKey, loop = false) {
        // If already playing this animation, don't restart it
        if (this.currentAnim != animationKey){
            this.currentAnim = animationKey;
            this.setTexture(animationKey + '_1');
        }
        
        
        // Start animation loop if needed
        if (loop && !this.animationTimer) {
            let frame = 1;
            const maxFrames = this.currentAnim.includes('Run') ? 7 : 
                        this.currentAnim.includes('Jump') ? 13 : 
                        this.currentAnim.includes('Hurt') ? 3 : 
                        this.currentAnim.includes('Attack') ? 8 : 10;
            
            this.animationTimer = scene.time.addEvent({
                delay: 100, // 10 fps
                callback: () => {
                    frame = frame % maxFrames + 1;
                    const textureKey = `${this.currentAnim}_${frame}`;
                    this.setTexture(textureKey);
                    console.log(textureKey);
                },
                loop: true
            });
        } else if (!loop) {
            // Stop any existing animation timer
            if (this.animationTimer) {
                this.animationTimer.destroy();
                this.animationTimer = null;
            }
        }
    };


    // Add to players map
    this.players.set(playerData.id, playerSprite);
    
    return playerSprite;
    },

    updatePlayerProp: function(playerSprite, prop) {
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
        //update: update
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
    players: new Map(), // Track all players
    weapons: new Map(), // Track weapons
    powerups: new Map(), // Track powerups
    gameStarted: false,
    matchTimer: null,
}

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
    graphics.clear()
    graphics.fillStyle(0xffff00)
    graphics.fillRect(0, 0, 20, 8)
    graphics.generateTexture("dagger", 20, 8)

    graphics.clear()
    graphics.fillStyle(0xff0000)
    graphics.fillRect(0, 0, 30, 10)
    graphics.generateTexture("sword", 30, 10)

    graphics.clear()
    graphics.fillStyle(0x800080)
    graphics.fillRect(0, 0, 25, 15)
    graphics.generateTexture("bow", 25, 15)

    graphics.clear()
    graphics.fillStyle(0x800080)
    graphics.fillRect(0, 0, 20, 5)
    graphics.generateTexture("arrow", 20, 5)

    // Powerups
    graphics.clear()
    graphics.fillStyle(0xff0000)
    graphics.fillCircle(8, 8, 8)
    graphics.generateTexture("powerup_health", 16, 16)

    graphics.clear()
    graphics.fillStyle(0xff6b00)
    graphics.fillCircle(8, 8, 8)
    graphics.generateTexture("powerup_attack", 16, 16)

    graphics.clear()
    graphics.fillStyle(0x00ff00)
    graphics.fillCircle(8, 8, 8)
    graphics.generateTexture("powerup_speed", 16, 16)

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
    //initializeMultiplayerHandlers.call(this);

    // Add player collisions
    this.physics.add.collider(
        Object.values(PlayerManager.players),
        Object.values(PlayerManager.players)
    )

    // Send ready signal
    const socket = Socket.getSocket()
    if (socket) {
        socket.on("player_movement", (moveData) =>
            this.handlePlayerMovement(moveData)
        )
        socket.on("weapon_spawn", (weaponData) =>
            this.handleWeaponSpawn(weaponData)
        )
        socket.on("powerup_spawn", (powerupData) =>
            this.handlePowerupSpawn(powerupData)
        )
        socket.on("game_start", (gameData) => this.handleGameStart(gameData))
    }
    // });
    console.log('Scene created');
}

function createGameWorld() {
    // Your existing platform creation code here
    // Reference lines 103-209 from original game.js
    // Create platforms group
    const background = this.add
        .image(400, 300, "background")
        .setDepth(-1) // Set background to lowest depth
        .setDisplaySize(800, 600)

    platforms = this.physics.add.staticGroup()

    // Create main ground - moved lower
    const ground = platforms.create(400, 580, "ground") // Changed from 568 to 580
    ground.setDisplaySize(800, 64)
    ground.refreshBody()

    // Add floating platforms - adjusted heights
    // Left platform
    const platform1 = platforms.create(200, 450, "ground") // Changed from 400 to 450
    platform1.setDisplaySize(200, 20)
    platform1.refreshBody()

    // Middle platform (higher)
    const platform2 = platforms.create(400, 350, "ground") // Changed from 300 to 350
    platform2.setDisplaySize(200, 20)
    platform2.refreshBody()

    // Right platform
    const platform3 = platforms.create(600, 450, "ground") // Changed from 400 to 450
    platform3.setDisplaySize(200, 20)
    platform3.refreshBody()

    // Small platforms for extra mobility
    const smallPlatform1 = platforms.create(100, 250, "ground") // Changed from 200 to 250
    smallPlatform1.setDisplaySize(100, 20)
    smallPlatform1.refreshBody()

    const smallPlatform2 = platforms.create(700, 250, "ground") // Changed from 200 to 250
    smallPlatform2.setDisplaySize(100, 20)
    smallPlatform2.refreshBody()
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

    // Create single movement update timer
    const movementTimer = this.time.addEvent({
        delay: 50,
        callback: () => {
            if (!playerSprite.active) return;

            if (cursors.left.isDown) {
                playerSprite.setVelocityX(-160);
                playerSprite.playAnimation(`Player${playerSprite.number}_left_Run_${playerSprite.currentProp}`, true);
                playerSprite.direction = 'left';
            } else if (cursors.right.isDown) {
                playerSprite.setVelocityX(160);
                playerSprite.playAnimation(`Player${playerSprite.number}_right_Run_${playerSprite.currentProp}`, true);
                playerSprite.direction = 'right';
            } else {
                playerSprite.setVelocityX(0);
                // Stop any running animation and set idle texture
                if (playerSprite.animationTimer) {
                    playerSprite.animationTimer.destroy();
                    playerSprite.animationTimer = null;
                }
                playerSprite.setTexture(`Player${playerSprite.number}_${playerSprite.direction}_Hurt_${playerSprite.currentProp}_3`);
            }

            if (cursors.up.isDown && playerSprite.body.touching.down) {
                playerSprite.setVelocityY(-500);
                playerSprite.playAnimation(`Player${playerSprite.number}_${playerSprite.direction}_Jump_${playerSprite.currentProp}`);
            }

            // Only emit if there's movement or direction change
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
                    animation: playerSprite.anims.currentAnim?.key // Send current animation
                });
            }
        },
        loop: true,
    })


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

    // Start match timer (3 minutes)
    gameTimer = this.time.addEvent({
        delay: 180000, // 3 minutes in milliseconds
        callback: endMatch,
        callbackScope: this,
    })

    // Start weapon and powerup spawning
    startItemSpawning.call(this)
}
// function update() {
//     if (!player) return;

//     // Handle local player movement
//     if (cursors.left.isDown) {
//         player.setVelocityX(-160);
//         player.flipX = true;
//         player.direction = 'left';
//         emitPlayerUpdate();
//     } else if (cursors.right.isDown) {
//         player.setVelocityX(160);
//         player.flipX = false;
//         player.direction = 'right';
//         emitPlayerUpdate();
//     } else {
//         player.setVelocityX(0);
//         emitPlayerUpdate();
//     }

//     if (cursors.up.isDown && player.body.touching.down) {
//         player.setVelocityY(-330);
//         emitPlayerUpdate();
//     }
// }

// // Emit player position and state to server
// function emitPlayerUpdate() {
//     const socket = Socket.getSocket();
//     if (!socket || !player) return;

//     const moveData = {
//         roomId: gameState.roomId,
//         id: socket.id,
//         x: player.x,
//         y: player.y,
//         velocityX: player.body.velocity.x,
//         velocityY: player.body.velocity.y,
//         flipX: player.flipX,
//         direction: player.direction
//     };

//     console.log('Emitting player update:', moveData);
//     socket.emit('player_movement', moveData);
// }

function handlePlayerUpdate(moveData) {
    if (!window.game || !window.game.scene.scenes[0]) {
        console.log("Game scene not ready");
        return;
    }

    const otherPlayer = PlayerManager.players.get(moveData.id);
    if (!otherPlayer) {
        console.log("Player not found:", moveData.id);
        return;
    }

    // Update position and physics
    otherPlayer.setPosition(moveData.x, moveData.y);
    otherPlayer.setVelocity(moveData.velocityX, moveData.velocityY);
    otherPlayer.direction = moveData.direction;

    // Update animation if provided
    if (moveData.animation) {
        otherPlayer.play(moveData.animation, true);
    }

    // Update name label position with larger offset
    // if (otherPlayer.nameLabel) {
    //     otherPlayer.nameLabel.setPosition(moveData.x, moveData.y - 80); // Increased from -50 to -80
    // }
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
            .setOrigin(0.5)

        this.tweens.add({
            targets: text,
            y: text.y - 30,
            alpha: 0,
            duration: 1000,
            onComplete: () => text.destroy(),
        })
        return
    }

    if (player.attackCooldown) return

    const time = this.time.now
    if (time < player.lastAttackTime + currentWeapon.attackSpeed) return

    player.attackCooldown = true
    player.lastAttackTime = time

    // Handle different weapon types
    switch (currentWeapon.name) {
        case "bow":
            chargeBow.call(this, pointer)
            break
        case "dagger":
            meleeAttack.call(this, currentWeapon.damage, currentWeapon.range)
            break
        case "sword":
            meleeAttack.call(this, currentWeapon.damage, currentWeapon.range)
            break
    }

    // Reset attack cooldown
    this.time.delayedCall(currentWeapon.attackSpeed, () => {
        player.attackCooldown = false
    })
}

function startItemSpawning() {
    // Spawn weapons every 5 seconds
    this.time.addEvent({
        delay: 5000,
        callback: () => {
            spawnWeapon.call(this)
        },
        loop: true,
    })

    // Spawn powerups every 10 seconds
    this.time.addEvent({
        delay: 10000,
        callback: () => {
            spawnPowerup.call(this)
        },
        loop: true,
    })
}

function spawnWeapon() {
    const weaponTypes = ["DAGGER", "SWORD", "BOW"]
    const randomType =
        weaponTypes[Math.floor(Math.random() * weaponTypes.length)]
    const weaponConfig = WEAPONS[randomType]

    const x = Phaser.Math.Between(50, 750)
    const y = Phaser.Math.Between(50, 500)

    const weapon = this.physics.add.sprite(x, y, weaponConfig.name)
    weapon.type = weaponConfig

    // Add collision with player
    this.physics.add.overlap(player, weapon, collectWeapon, null, this)

    // Add collision with ground
    this.physics.add.collider(weapon, platforms)
}

function collectWeapon(player, weapon) {
    // Drop current weapon if holding one

    currentWeapon = weapon.type
    weapon.destroy()

    // Update player's prop for animations
    const weaponName = currentWeapon.name.charAt(0).toUpperCase() + currentWeapon.name.slice(1);
    player.currentProp = weaponName;  // Update the prop to match new weapon
    
    // Add text feedback
    const text = this.add
        .text(player.x, player.y - 50, `Picked up ${currentWeapon.name}!`, {
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

    // Emit weapon pickup to other players if needed
    const socket = Socket.getSocket();
    if (socket) {
        socket.emit('weapon_pickup', {
            roomId: gameState.roomId,
            playerId: player.id,
            weapon: weaponName
        });
    }

    console.log(`Collected weapon: ${weapon.type.name}`) // Debug log
}

function spawnPowerup() {
    const powerupTypes = ["HEALTH", "ATTACK", "SPEED"]
    const randomType =
        powerupTypes[Math.floor(Math.random() * powerupTypes.length)]
    const powerupConfig = POWERUPS[randomType]

    const x = Phaser.Math.Between(50, 750)
    const y = Phaser.Math.Between(50, 500)

    const powerup = this.physics.add.sprite(
        x,
        y,
        `powerup_${powerupConfig.name}`
    )
    powerup.type = powerupConfig

    // Add collision with player
    this.physics.add.overlap(player, powerup, collectPowerup, null, this)

    // Add collision with ground
    this.physics.add.collider(powerup, platforms)
}

function collectPowerup(player, powerup) {
    const type = powerup.type

    switch (type.name) {
        case "health":
            player.health = Math.min(player.health + type.effect, 100)
            updateHealthBar.call(this)
            break
        case "attack":
            player.attackMultiplier =
                (player.attackMultiplier || 1) * type.multiplier
            this.time.delayedCall(type.duration, () => {
                player.attackMultiplier =
                    (player.attackMultiplier || 2) / type.multiplier
            })
            break
        case "speed":
            player.speedMultiplier =
                (player.speedMultiplier || 1) * type.multiplier
            this.time.delayedCall(type.duration, () => {
                player.speedMultiplier =
                    (player.speedMultiplier || 1.5) / type.multiplier
            })
            break
    }

    powerup.destroy()

    console.log(`Collected powerup: ${powerup.type.name}`) // Debug log
}

function endMatch() {
    // Match end logic
}

function meleeAttack(damage, range) {
    // Create attack hitbox
    const direction = player.direction === "left" ? -1 : 1

    // Stop movement during attack
    player.setVelocityX(0);

    const hitbox = this.add.rectangle(
        player.x + range * direction,
        player.y,
        range,
        40,
        0xff0000,
        0.2
    )

    // Get the correct animation key based on current weapon
    const prop = player.currentProp || 'Bare';
    const attackAnim = `Player${player.number}_${player.direction}_Attack_${prop}`;
    
    // Play attack animation (not looping)
    player.playAnimation(attackAnim, false);
    
    // Set timer to end attack state
    player.scene.time.delayedCall(500, () => {  // Adjust timing based on weapon
        player.isAttacking = false;
        // Return to idle state
        player.setTexture(`Player${player.number}_${player.direction}_Hurt_${prop}_3`);
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
    // Remove hitbox after brief moment
    this.time.delayedCall(100, () => hitbox.destroy())
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

// Add this function to handle game initialization
function startGame(gameData, socketId) {
    // Store room ID in game state
    gameState.roomId = gameData.roomId

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

    // Start match timer (3 minutes)
    gameState.matchTimer = setTimeout(() => {
        endMatch()
    }, 180000)
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

    // Play the appropriate attack animation based on weapon type
    const attackAnim = `player${player.number}_${player.direction}_attack_${currentWeapon.name}`;
    player.play(attackAnim).once('animationcomplete', () => {
        // Return to run/idle animation after attack
        if (player.body.velocity.x !== 0) {
            player.play(`player${player.number}_${player.direction}_run`);
        } else {
            player.play(`player${player.number}_${player.direction}_idle`);
        }
    });

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
    });
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

