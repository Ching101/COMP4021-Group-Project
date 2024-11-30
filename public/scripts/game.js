// Player management and initialization
const PlayerManager = {
    // Store all players in the game
    players: new Map(),

    // Player colors for visual distinction
    playerColors: [0xff0000, 0x00ff00, 0x0000ff, 0xffff00],

    // In PlayerManager
    createPlayer: function (scene, playerData, spawnPoint) {
        // Load character sprites and animations
        loadCharacterSprites(scene, playerData)

        // Create player sprite
        const playerSprite = scene.physics.add
            .sprite(
                spawnPoint.x,
                spawnPoint.y,
                `Player${playerData.number}_right_Hurt_Bare_3`
            )
            .setDepth(1)
            .setScale(2)
            .setAlpha(1)
            .setVisible(true)

        // Create and attach name label with larger offset
        const nameLabel = scene.add
            .text(spawnPoint.x, spawnPoint.y - 40, playerData.username, {
                // Increased from -50 to -80
                fontSize: "16px",
                fill: "#fff",
                //backgroundColor: "#00000080", // Optional: adds a semi-transparent background
                //padding: { x: 4, y: 2 }       // Optional: adds padding around text
            })
            .setOrigin(0.5)
            .setDepth(2) // Ensure name is above player sprite

        // Store reference to name label
        playerSprite.nameLabel = nameLabel

        // Set player properties
        playerSprite.id = playerData.id;
        playerSprite.number = playerData.number;
        playerSprite.direction = 'right';
        playerSprite.currentProp = 'Bare';  // Use capital B
        playerSprite.health = 100;
        playerSprite.isInvulnerable = false;
        playerSprite.attackMultiplier = 1;
        playerSprite.speedMultiplier = 1;
        playerSprite.setCollideWorldBounds(true);
        playerSprite.setDebugBodyColor(0, 0, 0, 0); // Make physics body invisible


        // Add update listener to keep name label with player
        scene.events.on("update", () => {
            if (playerSprite.active) {
                nameLabel.setPosition(playerSprite.x, playerSprite.y - 60) // Increased from -50 to -80
            }
        })

        // Create health bar graphics
        const healthBarWidth = 50
        const healthBarHeight = 6
        const healthBarPadding = 2
        const healthBar = scene.add.graphics().setDepth(3)

        // Store health bar reference on player sprite
        playerSprite.healthBar = healthBar

        // Add health bar update function to the player sprite
        playerSprite.updateHealthBar = function () {
            if (!this.healthBar || !this.active) return

            const barX = this.x - healthBarWidth / 2
            const barY = this.y - 50 // Position above name label

            this.healthBar.clear()

            // Draw background (black)
            this.healthBar.fillStyle(0x000000, 1)
            this.healthBar.fillRect(
                barX,
                barY,
                healthBarWidth + healthBarPadding * 2,
                healthBarHeight + healthBarPadding * 2
            )

            // Draw health bar (red)
            this.healthBar.fillStyle(0xff0000, 1)
            const currentWidth = healthBarWidth * (this.health / 100)
            this.healthBar.fillRect(
                barX + healthBarPadding,
                barY + healthBarPadding,
                currentWidth,
                healthBarHeight
            )
        }

        // Update health bar position in scene update
        scene.events.on("update", () => {
            if (playerSprite.active) {
                playerSprite.updateHealthBar()
            }
        })

        // Add custom play function to the sprite
        playerSprite.playAnimation = function (
            animationKey,
            forceRestart = false
        ) {
            // Debug logs for initial state
            // console.log('Starting animation:', {
            //     animationKey,
            //     currentAnim: this.currentAnim,
            //     hasTimer: !!this.animationTimer
            // });

            // Don't restart the same animation unless forced
            if (!forceRestart && this.currentAnim === animationKey) {
                return
            }

            // Clear existing animation timer
            if (this.animationTimer) {
                this.animationTimer.destroy()
                this.animationTimer = null
            }

            this.currentAnim = animationKey
            this.currentFrame = 1

            // Set initial texture
            const initialTexture = `${animationKey}_1`
            this.setTexture(initialTexture)

            // Determine max frames based on animation type
            this.maxFrames = this.currentAnim.includes("Run")
                ? 7
                : this.currentAnim.includes("Jump")
                ? 13
                : this.currentAnim.includes("Hurt")
                ? 3
                : this.currentAnim.includes("Attack")
                ? 8
                : 10

            // Only create timer for running animations or if explicitly requested
            const shouldLoop = this.currentAnim.includes("Run")

            if (shouldLoop) {
                this.animationTimer = scene.time.addEvent({
                    delay: 100, // 10 fps
                    callback: () => {
                        this.currentFrame++
                        if (this.currentFrame > this.maxFrames) {
                            this.currentFrame = 1
                        }
                        const textureKey = `${this.currentAnim}_${this.currentFrame}`
                        this.setTexture(textureKey)
                    },
                    loop: true,
                })
            } else {
                // For non-looping animations, play once and return to idle
                this.animationTimer = scene.time.addEvent({
                    delay: 100,
                    callback: () => {
                        this.currentFrame++
                        if (this.currentFrame > this.maxFrames) {
                            // Return to idle state
                            this.anims.stop()
                            const idleTexture = `Player${this.number}_${this.direction}_Hurt_${this.currentProp}_3`
                            this.setTexture(idleTexture)
                            this.animationTimer.destroy()
                            this.animationTimer = null
                            this.currentAnim = null
                        } else {
                            const textureKey = `${this.currentAnim}_${this.currentFrame}`
                            this.setTexture(textureKey)
                        }
                    },
                    loop: false,
                    repeat: this.maxFrames - 1,
                })
            }
        }

        playerSprite.playMeleeAttackAnimation = function (
            scene,
            playerSprite,
            weaponType
        ) {
            // If already attacking or in cooldown, don't start new attack
            if (playerSprite.isAttacking || playerSprite.attackCooldown) {
                return false;
            }

            // Stop any movement if this is the local player
            // if (playerSprite === player) {
            //     playerSprite.setVelocityX(0)
            // }

            // Store the previous animation state to restore later if needed
            // const previousAnim = playerSprite.currentAnim

            // Clear any existing animation timer
            if (playerSprite.animationTimer) {
                playerSprite.animationTimer.destroy()
                playerSprite.animationTimer = null
            }

            // Set attacking state IMMEDIATELY
            playerSprite.isAttacking = true
            playerSprite.attackCooldown = true // Set cooldown immediately
            playerSprite.currentAnim = null // Prevent other animations from running

            // Normalize weapon type to lowercase for consistency
            weaponType = weaponType.toLowerCase()

            // Get weapon config
            const weaponConfig = WEAPONS[weaponType.toUpperCase()]
            if (!weaponConfig) {
                console.error("Invalid weapon type:", weaponType)
                return false
            }

            // Set up animation parameters based on weapon type
            const maxFrames = weaponType === "dagger" ? 13 : 9 // 14 frames for dagger, 9 for sword
            const frameDelay = weaponType === "dagger" ? 50 : 90 // Faster animation (50ms for dagger, 60ms for sword)

            // Function to get texture key
            const getTextureKey = (frame) => {
                const capitalizedWeapon =
                    weaponType.charAt(0).toUpperCase() + weaponType.slice(1)
                return `Player${playerSprite.number}_${playerSprite.direction}_Attack_${capitalizedWeapon}_${frame}`
            }

            // Create all frames at once
            const frames = []
            for (let i = 1; i <= maxFrames; i++) {
                const textureKey = getTextureKey(i)
                if (!scene.textures.exists(textureKey)) {
                    console.error("Texture not found:", textureKey)
                    return false
                }
                frames.push(textureKey)
            }

            // Set initial frame
            playerSprite.setTexture(frames[0])

            // Flag to track if animation is active
            let isAnimationActive = true

            // Create a single timeline for the entire animation
            let currentIndex = 0
            const animationLoop = () => {
                if (!isAnimationActive) return

                if (currentIndex < frames.length) {
                    const currentTexture = frames[currentIndex]
                    playerSprite.setTexture(currentTexture)
                    currentIndex++

                    // Emit animation frame update for network play
                    if (playerSprite === player) {
                        const socket = Socket.getSocket()
                        if (socket) {
                            socket.emit("player_animation_frame", {
                                roomId: gameState.roomId,
                                id: socket.id,
                                frame: currentTexture,
                                weaponType: weaponType,
                                direction: playerSprite.direction,
                            })
                        }
                    }

                    scene.time.delayedCall(frameDelay, animationLoop)
                } else {
                    // Animation complete
                    isAnimationActive = false
                    playerSprite.isAttacking = false

                    // Check movement state immediately after attack ends
            if (playerSprite === player) {
                // For local player, check actual keyboard state
                if (cursors.left.isDown || cursors.right.isDown) {
                    const runAnim = `Player${playerSprite.number}_${playerSprite.direction}_Run_${playerSprite.currentProp}`
                    playerSprite.currentAnim = runAnim
                    playerSprite.playAnimation(runAnim, true) // Force restart the animation
                } else {
                    const idleTexture = `Player${playerSprite.number}_${playerSprite.direction}_Hurt_${playerSprite.currentProp}_3`
                    playerSprite.setTexture(idleTexture)
                        playerSprite.currentAnim = null
                }
            }

                    // Handle cooldown
                    scene.time.delayedCall(weaponConfig.attackSpeed, () => {
                        playerSprite.attackCooldown = false
                        console.log("Attack cooldown complete")
                    })
                }
            }

            // Override the sprite's texture setter during the animation
            const originalSetTexture = playerSprite.setTexture
            playerSprite.setTexture = function (key) {
                if (isAnimationActive) {
                    // Only allow attack animation textures during the animation
                    if (frames.includes(key)) {
                        return originalSetTexture.call(this, key)
                    }
                } else {
                    return originalSetTexture.call(this, key)
                }
            }

            // Start the animation loop
            animationLoop()

            // Clean up after animation
            scene.time.delayedCall(frameDelay * (maxFrames + 1), () => {
                // Restore original setTexture function
                playerSprite.setTexture = originalSetTexture
            })

            return true
        }

        // Add to players map
        this.players.set(playerData.id, playerSprite)

        return playerSprite
    },

    updatePlayerProp: function (playerSprite, prop) {
        playerSprite.currentProp = prop
    },

    // Remove a player
    removePlayer: function (playerId) {
        const playerSprite = this.players.get(playerId)
        if (playerSprite) {
            if (playerSprite.healthBar) {
                playerSprite.healthBar.destroy()
            }
            if (playerSprite.nameLabel) {
                playerSprite.nameLabel.destroy()
            }
            playerSprite.destroy()
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
            debug: false,
        },
    },
    scene: {
        preload: preload,
        create: create,
    },
}

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
    roomId: null,
    timer: {
        element: null,
        remaining: 0,
        interval: null,
    },
    activePowerups: {
        attack: { count: 0, timer: null },
        speed: { count: 0, timer: null },
    },
    stats: {
        damageDealt: 0,
        powerupsCollected: 0,
        startTime: null,
        interval: null,
    },
    activePowerups: {
        attack: { count: 0, timer: null },
        speed: { count: 0, timer: null },
    },
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
    this.load.image("dagger", "./assets/weapons/daggers.png")
    this.load.image("sword", "./assets/weapons/sword.png")
    this.load.image("bow", "./assets/weapons/bow.png")
    this.load.image("arrow", "./assets/weapons/arrow.png")

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
    this.load.image("powerup_health", "./assets/powerups/health.png")
    this.load.image("powerup_attack", "./assets/powerups/attack.png")
    this.load.image("powerup_speed", "./assets/powerups/speed.png")

    // Ground (brown rectangle)
    graphics.fillStyle(0x966f33)
    graphics.fillRect(0, 0, 800, 64)
    graphics.generateTexture("ground", 800, 64)

    graphics.destroy()

    for (let i = 1; i <= 4; i++) {
        const directions = ["left", "right"]
        const actions = {
            Run: 7,
            Jump: 13,
            Hurt: 3,
            Death: 10,
        }
        const props = ["Bare", "Dagger", "Sword", "Bow"]

        // Load animations for each prop
        directions.forEach((direction) => {
            props.forEach((prop) => {
                Object.entries(actions).forEach(([action, frameCount]) => {
                    // Skip Attack animation for Bare prop
                    // if (action === 'Attack' && prop === 'Bare') {
                    //     return;
                    // }

                    for (let frame = 1; frame <= frameCount; frame++) {
                        const path = `./assets/characters/Player${i}/${direction}/${action}/${prop}/${frame}.png`
                        // Use consistent capitalization in the key
                        const key = `Player${i}_${direction}_${action}_${prop}_${frame}`
                        this.load.image(key, path)
                    }
                })
            })
        })
        // In your preload function where you load the attack animations
        directions.forEach((direction) => {
            // Load dagger attack frames (13 frames)
            for (let frame = 1; frame <= 13; frame++) {
                const path = `./assets/characters/Player${i}/${direction}/Attack/Dagger/${frame}.png`
                const key = `Player${i}_${direction}_Attack_Dagger_${frame}`
                this.load.image(key, path)
            }

            // Load sword attack frames (9 frames)
            for (let frame = 1; frame <= 9; frame++) {
                const path = `./assets/characters/Player${i}/${direction}/Attack/Sword/${frame}.png`
                const key = `Player${i}_${direction}_Attack_Sword_${frame}`
                this.load.image(key, path)
            }
        })
    }
}

function updateGameStats() {
    $("#damage-dealt").text(gameState.stats.damageDealt || 0)
    $("#powerups-collected").text(gameState.stats.powerupsCollected || 0)

    if (gameState.stats.startTime) {
        const survivalTime = Math.floor(
            (Date.now() - gameState.stats.startTime) / 1000
        )
        $("#survival-time").text(survivalTime + "s")
    }
}

function create() {
    // Create game world
    createGameWorld.call(this)

    // Initialize socket handlers
    initializeMultiplayerHandlers.call(this)

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
            if (!moveData || !moveData.id) return

            const playerSprite = PlayerManager.players.get(moveData.id)
            if (playerSprite && moveData.id !== socket.id) {
                playerSprite.setPosition(moveData.x, moveData.y)
                playerSprite.setVelocity(moveData.velocityX, moveData.velocityY)
                playerSprite.direction = moveData.direction

                // Update animation if provided
                if (moveData.animation) {
                    playerSprite.playAnimation(moveData.animation)
                }
            }
        }

        // Now bind all socket listeners
        socket.on("player_movement", (moveData) =>
            this.handlePlayerMovement(moveData)
        )

        // socket.on("weapon_spawned", (weaponData) => {
        //     //console.log('Received weapon spawn:', weaponData);
        //     if (weaponData.roomId === gameState.roomId) {
        //         spawnWeapon.call(
        //             this,
        //             weaponData.x,
        //             weaponData.y,
        //             weaponData.weaponConfig,
        //             weaponData.id
        //         )
        //     }
        // })

        socket.on("weapon_collected", (data) => {
            const weapon = gameState.weapons.get(data.weaponId)
            if (weapon) {
                gameState.weapons.delete(data.weaponId)
                weapon.destroy()
            }
        })

        // socket.on("powerup_spawned", (powerupData) => {
        //     //console.log('Received powerup spawn:', powerupData);
        //     if (powerupData.roomId === gameState.roomId) {
        //         spawnPowerup.call(
        //             this,
        //             powerupData.x,
        //             powerupData.y,
        //             powerupData.powerupConfig,
        //             powerupData.id
        //         )
        //     }
        // })

        socket.on("powerup_collected", (data) => {
            // Skip if this is our own collection
            if (data.playerId === socket.id) return;


            const scene = window.game.scene.scenes[0];
            if (!scene) return;

            // Find the powerup
            let powerup = gameState.powerups.get(data.powerupId)
            if (!powerup) {
                // Try to find by position
                for (const [_, p] of gameState.powerups.entries()) {
                    if (
                        Math.abs(p.x - data.x) < 20 &&
                        Math.abs(p.y - data.y) < 20
                    ) {
                        powerup = p
                        break
                    }
                }
            }

            // Find the player who collected
            const playerSprite = PlayerManager.players.get(data.playerId);
            if (!playerSprite) return;

            // Apply effect and show feedback
            if (powerup && powerup.active) {
                applyPowerupEffect(playerSprite, data.powerupType)
                showPowerupFeedback(
                    scene,
                    playerSprite,
                    data.powerupType.name,
                    false
                )
                cleanupPowerup(powerup, scene)
            }
        })

        socket.on("player_attack", (attackData) => {
            if (attackData.id !== socket.id) {
                // Only handle other players' attacks
                handleOtherPlayerAttack.call(this, attackData)
            }
        })
    }
    // Initialize game state
    gameState.roomId = window.currentRoomId
    gameState.gameStarted = true

    console.log("Game created with room ID:", gameState.roomId)

    // Add this to the create function after other key bindings
    this.input.keyboard.on("keydown-X", function () {
        // Only allow if game is active
        if (gameState.gameStarted) {
            const socket = Socket.getSocket()
            if (socket) {
                socket.emit("reduce_time", {
                    roomId: gameState.roomId,
                })
            }
        }
    })
}

function createGameWorld() {
    // Create background
    const background = this.add
        .image(400, 300, "background")
        .setDepth(-1)
        .setDisplaySize(800, 600)

    // Create platforms group
    platforms = this.physics.add.staticGroup()
    gameState.platforms = platforms // Store in gameState

    // Create main ground
    const ground = platforms.create(400, 580, "ground")
    ground.setDisplaySize(800, 64)
    ground.refreshBody()

    // Add floating platforms
    const platform1 = platforms.create(200, 450, "ground")
    platform1.setDisplaySize(200, 20)
    platform1.refreshBody()

    const platform2 = platforms.create(400, 350, "ground")
    platform2.setDisplaySize(200, 20)
    platform2.refreshBody()

    const platform3 = platforms.create(600, 450, "ground")
    platform3.setDisplaySize(200, 20)
    platform3.refreshBody()

    const platform4 = platforms.create(100, 250, "ground")
    platform4.setDisplaySize(100, 20)
    platform4.refreshBody()

    const platform5 = platforms.create(700, 250, "ground")
    platform5.setDisplaySize(100, 20)
    platform5.refreshBody()

    return platforms
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
    })

    // Create single movement update timer with a shorter delay
    const movementTimer = this.time.addEvent({
        delay: 16,
        callback: () => {
            if (!playerSprite.active) return

            let currentAnimation = null
            let isMoving = false

            // Don't allow any movement or animation changes during attack
            // if (playerSprite.isAttacking || playerSprite.attackCooldown) {
            //     playerSprite.setVelocityX(0)

            //     // Important: Emit stopped movement to other players
            //     const socket = Socket.getSocket()
            //     if (socket) {
            //         socket.emit("player_movement", {
            //             roomId: gameState.roomId,
            //             id: socket.id,
            //             x: playerSprite.x,
            //             y: playerSprite.y,
            //             velocityX: 0,
            //             velocityY: playerSprite.body.velocity.y, // Keep vertical velocity for jumping
            //             direction: playerSprite.direction,
            //             animation: null,
            //             currentProp: playerSprite.currentProp,
            //             isMoving: false,
            //             isAttacking: true, // Add this flag
            //         })
            //     }
            //     return
            // }

            // Handle horizontal movement
            if (cursors.left.isDown && !cursors.right.isDown) {
                // Only set velocity if not attacking
                //if (!playerSprite.isAttacking) {
                    playerSprite.setVelocityX(-160 * playerSprite.speedMultiplier);
                    currentAnimation = `Player${playerSprite.number}_left_Run_${playerSprite.currentProp}`;
                    playerSprite.direction = 'left';
                    isMoving = true;
                    playerSprite.playAnimation(currentAnimation);
                //}
            } else if (cursors.right.isDown && !cursors.left.isDown) {
                // Only set velocity if not attacking
                //if (!playerSprite.isAttacking) {
                    playerSprite.setVelocityX(160 * playerSprite.speedMultiplier);
                    currentAnimation = `Player${playerSprite.number}_right_Run_${playerSprite.currentProp}`;
                    playerSprite.direction = 'right';
                    isMoving = true;
                    playerSprite.playAnimation(currentAnimation);
                //}
            } else {
                playerSprite.setVelocityX(0)
            }

            // Handle jumping - also prevent during attack
            if (
                cursors.up.isDown &&
                playerSprite.body.touching.down //&& !playerSprite.isAttacking
            ) {
                playerSprite.setVelocityY(-500)
                currentAnimation = `Player${playerSprite.number}_${playerSprite.direction}_Jump_${playerSprite.currentProp}`
                isMoving = true
                playerSprite.playAnimation(currentAnimation)
            }

            // Set idle state when not moving
            if (!isMoving) {
                if (playerSprite.animationTimer) {
                    playerSprite.animationTimer.destroy()
                    playerSprite.animationTimer = null
                }
                playerSprite.currentAnim = null
                const idleTexture = `Player${playerSprite.number}_${playerSprite.direction}_Hurt_${playerSprite.currentProp}_3`
                playerSprite.setTexture(idleTexture)
            }

            // Only emit movement if not attacking
            const socket = Socket.getSocket()
            if (socket ) { //&& !playerSprite.isAttacking
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
                    isMoving: isMoving,
                })
            }
        },
        loop: true,
    })

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
    const otherPlayer = PlayerManager.players.get(moveData.id)
    if (!otherPlayer) return

    // Update position and movement
    otherPlayer.x = moveData.x
    otherPlayer.y = moveData.y
    otherPlayer.setVelocityX(moveData.velocityX)
    otherPlayer.setVelocityY(moveData.velocityY)
    otherPlayer.direction = moveData.direction

    // Update health if provided
    if (
        moveData.health !== undefined &&
        otherPlayer.health !== moveData.health
    ) {
        otherPlayer.health = moveData.health
        if (otherPlayer.updateHealthBar) {
            otherPlayer.updateHealthBar()
        }
    } else {
        // Stop animation and set idle texture when not moving
        if (otherPlayer.animationTimer) {
            otherPlayer.animationTimer.destroy()
            otherPlayer.animationTimer = null
        }
        otherPlayer.currentAnim = null
        otherPlayer.setTexture(
            `Player${otherPlayer.number}_${otherPlayer.direction}_Hurt_${otherPlayer.currentProp}_3`
        )
    }
}

function updateHealthBar() {
    if (!healthBar || !player) {
        console.log("Health bar update skipped - missing components")
        return
    }

    console.log("Updating health bar with health:", player.health)
    healthBar.clear()

    // Redraw border
    healthBar.lineStyle(2, 0xffffff)
    healthBar.fillStyle(0x000000, 1)
    healthBar.strokeRoundedRect(
        10,
        25,
        healthBar.barWidth + healthBar.padding * 2,
        healthBar.barHeight + healthBar.padding * 2,
        5
    )
    healthBar.fillRoundedRect(
        10,
        25,
        healthBar.barWidth + healthBar.padding * 2,
        healthBar.barHeight + healthBar.padding * 2,
        5
    )

    // Redraw health bar
    healthBar.fillStyle(0xff0000, 1)
    const currentWidth =
        healthBar.barWidth * (Math.max(0, Math.min(100, player.health)) / 100)
    healthBar.fillRoundedRect(
        10 + healthBar.padding,
        25 + healthBar.padding,
        currentWidth,
        healthBar.barHeight,
        4
    )
}

function basicAttack(pointer) {
    // First check if player can attack
    if (player.isAttacking || player.attackCooldown) {
        return;
    }

    if (!currentWeapon) {
        // Visual feedback for no weapon
        const text = this.add
            .text(player.x, player.y - 80, "No weapon!", {
                fontSize: "16px",
                fill: "#ff0000",
                style: {
                    weight: "bold",
                }
            })
            .setOrigin(0.5)

        this.tweens.add({
            targets: text,
            y: text.y - 30,
            alpha: 0,
            duration: 2000,
            //ease: "Power2",
            onComplete: () => text.destroy(),
        })
        return
    }

    // Handle different weapon types
    switch (currentWeapon.name) {
        case "dagger":
        case "sword":
            // Start attack animation
            if (
                player.playMeleeAttackAnimation(
                    this,
                    player,
                    currentWeapon.name
                )
            ) {
                meleeAttack.call(
                    this,
                    currentWeapon.damage,
                    currentWeapon.range
                )

                // Emit attack event for multiplayer with all necessary data
                const socket = Socket.getSocket()
                if (socket) {
                    socket.emit("player_attack", {
                        roomId: gameState.roomId,
                        id: socket.id,
                        weaponType: currentWeapon.name,
                        direction: player.direction,
                        timestamp: Date.now(),
                    })
                }
            }
            break
        case "bow":
            chargeBow.call(this, pointer)
            break
    }
}

function handleOtherPlayerAttack(attackData) {
    const otherPlayer = PlayerManager.players.get(attackData.id)
    if (otherPlayer) {
        // Update player direction
        otherPlayer.direction = attackData.direction

        // Play attack animation for other player
        otherPlayer.playMeleeAttackAnimation(
            this,
            otherPlayer,
            attackData.weaponType
        )
    }
}

function spawnWeapon(x, y, weaponConfig, id) {
    //console.log('Spawning weapon:', { x, y, weaponConfig, id });

    // Create the weapon sprite
    const weapon = this.physics.add
        .sprite(x, y, weaponConfig.name)
        .setScale(1)
        .setDepth(1)

    // Enable physics
    this.physics.world.enable(weapon)

    // Set collision bounds
    weapon.setCollideWorldBounds(true)

    // Add gravity
    weapon.body.setGravity(0, 800)
    weapon.setBounce(0.2)

    // Store the weapon configuration and ID
    weapon.type = weaponConfig
    weapon.id = id

    // Add collision with platforms
    if (platforms) {
        this.physics.add.collider(weapon, platforms)
    }

    // Define collectWeapon as a scene method
    this.collectWeapon = function (playerSprite, weapon) {
        if (!weapon.active) return

        const weaponConfig = weapon.type

        // Stop any current animations
        playerSprite.anims.stop()

        // Update player's prop for animations
        const weaponName =
            weaponConfig.name.charAt(0).toUpperCase() +
            weaponConfig.name.slice(1)
        PlayerManager.updatePlayerProp(playerSprite, weaponName)

        // Set current weapon for the local player
        if (playerSprite === player) {
            currentWeapon = weaponConfig
        }

        // Emit weapon collection to server
        const socket = Socket.getSocket()
        if (socket) {
            socket.emit("weapon_collected", {
                roomId: gameState.roomId,
                weaponId: weapon.id,
                playerId: socket.id,
                weaponName: weaponName,
                x: weapon.x,
                y: weapon.y,
            })
        }

        // Set idle texture immediately
        playerSprite.setTexture(
            `Player${playerSprite.number}_${playerSprite.direction}_Hurt_${playerSprite.currentProp}_3`
        )

        // Remove weapon from game state and destroy sprite
        gameState.weapons.delete(weapon.id)
        weapon.destroy()

        // Add collection feedback
        const text = this.add
            .text(
                playerSprite.x,
                playerSprite.y - 80,
                `Picked up ${weaponConfig.name.toUpperCase()}!`,
                {
                    fontSize: "16px",
                    fill: "#fff",
                    style: {
                        weight: "bold",
                    }
                }
            )
            .setOrigin(0.5)

        this.tweens.add({
            targets: text,
            y: text.y - 30,
            alpha: 0,
            duration: 2000,
            onComplete: () => text.destroy(),
        })
    }

    // Add overlap with all players
    PlayerManager.players.forEach((playerSprite) => {
        this.physics.add.overlap(
            playerSprite,
            weapon,
            this.collectWeapon,
            null,
            this
        )
    })

    // Store weapon in game state
    gameState.weapons.set(id, weapon)

    return weapon
}

// Update spawnPowerup function
function spawnPowerup(x, y, powerupConfig, id) {
    const scene = this;

    try {
        //console.log('Creating powerup sprite:', {
        //    id,
        //    type: powerupConfig.name,
        //    position: { x, y }
        //});

        // Create the powerup sprite with physics enabled
        const powerup = scene.physics.add
            .sprite(x, y, `powerup_${powerupConfig.name}`)
            .setScale(0.8)
            .setDepth(1)

        // Add additional identification properties
        powerup.id = id
        powerup.powerupConfig = powerupConfig
        powerup.isBeingCollected = false
        powerup.spawnPosition = { x, y } // Store spawn position for identification

        // Set up physics properties
        powerup.body.setGravityY(300)
        powerup.setBounce(0.2)
        powerup.setCollideWorldBounds(true)
        // Add collision with platforms
        if (platforms) {
            this.physics.add.collider(powerup, platforms)
        }

        // Add to gameState powerups map using both ID and position as keys
        gameState.powerups.set(id, powerup)
        gameState.powerups.set(`pos_${Math.floor(x)}_${Math.floor(y)}`, powerup)

        return powerup
    } catch (error) {
        return null;
    }
}

function collectPowerup(player, powerupSprite, scene) {
    if (!powerupSprite.active || powerupSprite.isBeingCollected) return

    // Mark as being collected immediately
    powerupSprite.isBeingCollected = true

    const powerupId = powerupSprite.id
    const position = { x: powerupSprite.x, y: powerupSprite.y }
    const powerupConfig = powerupSprite.powerupConfig


    const socket = Socket.getSocket();
    if (socket) {
        // Apply effect immediately for collecting player
        if (player === window.player) {
            // Check if this is the local player
            applyPowerupEffect(player, powerupConfig)
            showPowerupFeedback(scene, player, powerupConfig.name, true)
            // Update active powerups display only for non-health powerups
            if (powerupConfig.name !== "health") {
                updateActivePowerupsDisplay(scene, powerupConfig.name)
            }
        }

        // Clean up locally first
        try {
            // Remove from gameState
            gameState.powerups.delete(powerupId)
            gameState.powerups.delete(
                `pos_${Math.floor(position.x)}_${Math.floor(position.y)}`
            )

            // Disable physics
            if (powerupSprite.body) {
                powerupSprite.body.enable = false
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
            powerupSprite.destroy(true)
        } catch (error) {
            console.error("Error during local powerup cleanup:", error)
        }

        // Emit collection event
        socket.emit("powerup_collected", {
            roomId: gameState.roomId,
            powerupId: powerupId,
            playerId: socket.id,
            powerupType: powerupConfig,
            x: position.x,
            y: position.y,
        })
    }

    // Update powerup stats
    gameState.stats.powerupsCollected++
    updateGameStats()
}

function cleanupPowerup(powerup, scene) {
    if (!powerup || !powerup.active) {
        console.log("Skipping cleanup - powerup inactive or null")
        return
    }

    // Get position key before cleanup
    const positionKey = `pos_${Math.floor(powerup.x)}_${Math.floor(powerup.y)}`

    // Remove from all collections
    gameState.powerups.delete(powerup.id)
    gameState.powerups.delete(positionKey)

    // Disable physics and visibility
    powerup.setActive(false);
    powerup.setVisible(false);

    if (powerup.body) {
        powerup.body.enable = false
    }

    // Remove colliders
    if (scene?.physics?.world) {
        scene.physics.world.colliders.getActive()
            .filter(collider =>
                collider.object1 === powerup ||
                collider.object2 === powerup
            ).forEach(collider => {
                collider.destroy();
            });
    }

    // Destroy the sprite
    powerup.destroy()
}

// Helper function to show powerup feedback
function showPowerupFeedback(scene, player, powerupName, isCollector) {
    const message = isCollector ?
        `Picked up ${powerupName.toUpperCase()}!` :
        `Player ${player.number} got ${powerupName.toUpperCase()}!`;

    const feedbackText = scene.add
        .text(player.x, player.y - 80, message, {
            fontSize: "16px",
            fill: "#fff",
            //stroke: "#000",
            align: "center",
            style: {
                weight: "bold",
            }
        })
        .setOrigin(0.5)

    scene.tweens.add({
        targets: feedbackText,
        y: feedbackText.y - 30,
        alpha: 0,
        duration: 2000,
        //ease: "Power2",
        onComplete: () => feedbackText.destroy(),
    })
}

function applyPowerupEffect(playerSprite, powerupConfig) {
    console.log("Applying powerup effect:", powerupConfig)

    switch (powerupConfig.name) {
        case "health":
            if (playerSprite.health < 100) {
                playerSprite.health = Math.min(
                    100,
                    playerSprite.health + powerupConfig.effect
                )
                playerSprite.updateHealthBar()
            }
            break

        case "attack":
            // Initialize attackMultiplier if not exists
            playerSprite.attackMultiplier = playerSprite.attackMultiplier || 1
            // Multiply existing multiplier with new one
            playerSprite.attackMultiplier *= (powerupConfig.multiplier || 2);
            console.log('Attack multiplier updated to:', playerSprite.attackMultiplier);

            // Clear existing timeout if any
            if (playerSprite.attackTimeout) clearTimeout(playerSprite.attackTimeout);

            playerSprite.attackTimeout = setTimeout(() => {
                playerSprite.attackMultiplier = 1;
                console.log('Attack multiplier reset to 1');
            }, powerupConfig.duration || 10000);
            break;

        case 'speed':
            const baseSpeed = 160; // Base movement speed
            const baseJumpVelocity = -500; // Base jump velocity

            // Initialize speedMultiplier if not exists
            playerSprite.speedMultiplier = playerSprite.speedMultiplier || 1
            // Multiply existing multiplier with new one
            playerSprite.speedMultiplier *= powerupConfig.multiplier || 1.5
            console.log(
                "Speed multiplier updated to:",
                playerSprite.speedMultiplier
            )

            // Apply speed boost
            if (playerSprite === player) {
                // Only modify speed for local player
                playerSprite.setMaxVelocity(
                    baseSpeed * playerSprite.speedMultiplier,
                    Math.abs(baseJumpVelocity * playerSprite.speedMultiplier)
                )
                // Store the current jump velocity for this player
                playerSprite.currentJumpVelocity =
                    baseJumpVelocity * playerSprite.speedMultiplier
            }

            // Clear existing timeout if any
            if (playerSprite.speedTimeout) clearTimeout(playerSprite.speedTimeout);

            playerSprite.speedTimeout = setTimeout(() => {
                playerSprite.speedMultiplier = 1
                if (playerSprite === player) {
                    playerSprite.setMaxVelocity(
                        baseSpeed,
                        Math.abs(baseJumpVelocity)
                    )
                    playerSprite.currentJumpVelocity = baseJumpVelocity
                }
                console.log("Speed multiplier reset to 1")
            }, powerupConfig.duration || 8000)
            break

        default:
            console.warn("Unknown powerup type:", powerupConfig.name)
    }
}

// function endMatch() {
//     // Clear timer interval if it exists
//     if (gameState.timer.interval) {
//         clearInterval(gameState.timer.interval);
//     }

//     // Remove timer element
//     if (gameState.timer.element) {
//         gameState.timer.element.remove();
//     }
//     const endGameButton = document.querySelector('.end-game-button');
//     endGameButton.style.display = 'none';
//     // Hide game container
//     $('#gameContainer').hide();

//     // Show game over page with animation
//     $('#game-over-page').fadeIn(500);

//     // Determine winner and show appropriate message
//     const currentPlayer = PlayerManager.players.get(Socket.getSocket().id);
//     const isWinner = currentPlayer && currentPlayer.health > 0;

//     // Show victory or defeat message with animation
//     if (isWinner) {
//         $('#victory-text').fadeIn(1000);
//         $('#defeat-text').hide();
//         // Update game record for win
//         GameRecord.update(true);
//     } else {
//         $('#defeat-text').fadeIn(1000);
//         $('#victory-text').hide();
//         // Update game record for loss
//         GameRecord.update(false);
//     }

//     // Update final stats
//     const gameStats = {
//         damageDealt: gameState.damageDealt || 0,
//         powerupsCollected: gameState.powerupsCollected || 0,
//         survivalTime: Math.floor((Date.now() - gameState.startTime) / 1000)
//     };

//     $('#damage-dealt').text(gameStats.damageDealt);
//     $('#powerups-collected').text(gameStats.powerupsCollected);
//     $('#survival-time').text(gameStats.survivalTime + 's');

//     // Clean up game state
//     gameState.gameStarted = false;
//     gameState.players.clear();
//     gameState.weapons.clear();
//     gameState.powerups.clear();

//     // Resume stats auto-refresh
//     GameStats.startAutoRefresh();
// }

function meleeAttack(damage, range) {
    const direction = player.direction === "left" ? -1 : 1

    // Create attack hitbox
    const hitbox = this.add.rectangle(
        player.x + range * direction,
        player.y,
        range,
        40,
        0xff0000,
        0
    )

    // Check for collision with other players
    PlayerManager.players.forEach((otherPlayer) => {
        if (otherPlayer !== player && !otherPlayer.isInvulnerable) {
            const bounds = hitbox.getBounds()
            const playerBounds = otherPlayer.getBounds()

            if (Phaser.Geom.Rectangle.Overlaps(bounds, playerBounds)) {
                // Calculate final damage including multipliers
                const finalDamage = Math.round(
                    damage * (player.attackMultiplier || 1)
                )

                // Emit attack hit event
                const socket = Socket.getSocket()
                if (socket) {
                    socket.emit("player_attack_hit", {
                        roomId: gameState.roomId,
                        attackerId: socket.id,
                        targetId: otherPlayer.id,
                        damage: finalDamage,
                        x: otherPlayer.x,
                        y: otherPlayer.y,
                    })
                }
            }
        }
    })

    // Use a separate timer to track attack state
    this.time.delayedCall(800, () => {
        player.isAttacking = false
        hitbox.destroy()
    })
}

function showDamageNumber(scene, x, y, damage) {
    const text = scene.add
        .text(x, y - 20, `-${damage}`, {
            fontSize: "18px",
            fill: "#ff0000",
            fontWeight: "bold",
        })
        .setOrigin(0.5)
        .setDepth(1000)

    scene.tweens.add({
        targets: text,
        y: text.y - 10,
        alpha: 1,
        duration: 1500,
        //ease: "Power1",
        onComplete: () => text.destroy(),
    })
}
function playDeathAnimation(player, scene) {
    // Add debug log
    console.log('Starting death animation for player:', player.id);

    // Stop any current movement
    player.setVelocityX(0);
    player.setVelocityY(0);

    // Set player as dead to prevent other actions
    player.isAttacking = true;

    // Clear any existing animation timer
    if (player.animationTimer) {
        player.animationTimer.destroy();
        player.animationTimer = null;
    }

    // Animation parameters
    const maxFrames = 10;
    const frameDelay = 100;

    // Create frames array
    const frames = Array.from({ length: maxFrames }, (_, i) =>
        `Player${player.number}_${player.direction}_Death_${player.currentProp}_${i + 1}`
    );

    // Set initial frame
    player.setTexture(frames[0]);

    // Animation loop
    let currentIndex = 0;
    const animationLoop = () => {
        if (currentIndex < frames.length) {
            const currentTexture = frames[currentIndex];
            player.setTexture(currentTexture);

            // Emit animation frame for network play
            if (player === window.player) {
                const socket = Socket.getSocket();
                if (socket) {
                    socket.emit('player_death_animation', {
                        roomId: gameState.roomId,
                        id: socket.id,
                        frame: currentTexture,
                        direction: player.direction
                    });
                }
            }

            currentIndex++;
            scene.time.delayedCall(frameDelay, animationLoop);
        }
    };

    // Start animation
    animationLoop();
}

function handlePlayerDamage(playerSprite, damage) {
    // Update health
    playerSprite.health = Math.max(0, playerSprite.health - damage);


    // Update the player's health bar
    if (playerSprite.updateHealthBar) {
        playerSprite.updateHealthBar()
    }

    // Add brief invulnerability
    playerSprite.isInvulnerable = true
    setTimeout(() => {
        playerSprite.isInvulnerable = false
    }, 500)

    // Play hurt animation
    const hurtAnim = `Player${playerSprite.number}_${playerSprite.direction}_Hurt_${playerSprite.currentProp}`
    playerSprite.playAnimation(hurtAnim)

    // Check for player death
    if (playerSprite.health <= 0) {
        handlePlayerDeath(playerSprite);
        console.log('Player died:', playerSprite.id);

    }
    if (playerSprite === player) {
        gameState.stats.damageDealt += damage
        updateGameStats()
    }
}

function handlePlayerDeath(playerSprite) {
    // Add debug log
    console.log('handlePlayerDeath called for player:', playerSprite.id);

    if (playerSprite.isDead) {
        console.log('Player already marked as dead, skipping');
        return;
    }

    // Mark player as dead
    playerSprite.isDead = true;

    // Clear weapon if player has one
    if (playerSprite.currentWeapon) {
        playerSprite.currentWeapon = null;
    }

    // Get the current scene
    const scene = window.game.scene.scenes[0];

    // Emit death event immediately before animation
    if (playerSprite === player) {
        const socket = Socket.getSocket();
        if (socket) {
            console.log('Emitting player_died event');
            socket.emit('player_died', {
                playerId: socket.id,
                roomId: gameState.roomId
            });
        }
        // Update local game state
    }

    // Play death animation
    playDeathAnimation(playerSprite, scene);
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
    if (false && debugText) {
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
            duration: 1000,
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
    if (false && debugText) {
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

function updateActivePowerupsDisplay(scene, powerupConfig) {
    if (!scene || !powerupConfig || powerupConfig.name === "health") return

    const powerupName = powerupConfig.name.toLowerCase()

    // Initialize gameState.activePowerups if it doesn't exist
    if (!gameState.activePowerups) {
        gameState.activePowerups = {}
    }

    // Initialize this powerup type if it doesn't exist
    if (!gameState.activePowerups[powerupName]) {
        gameState.activePowerups[powerupName] = {
            count: 0,
            displaySprite: null,
            countText: null,
            durationText: null,
            duration: powerupConfig.duration,
            updateInterval: null, // Add this to track the interval
        }
    }

    const powerupInfo = gameState.activePowerups[powerupName]
    powerupInfo.count++
    powerupInfo.duration = powerupConfig.duration // Update duration for new powerup

    // Clear existing update interval if it exists
    if (powerupInfo.updateInterval) {
        powerupInfo.updateInterval.remove()
    }

    const updateDisplay = () => {
        const baseX = 25
        const baseY = 25
        const spacing = 80
        const index = powerupName === "attack" ? 0 : 1
        const x = baseX + spacing * index

        // Clean up existing display elements
        if (powerupInfo.displaySprite) powerupInfo.displaySprite.destroy()
        if (powerupInfo.countText) powerupInfo.countText.destroy()
        if (powerupInfo.durationText) powerupInfo.durationText.destroy()

        // Create icon background (semi-transparent black circle)
        scene.add
            .circle(x + 20, baseY + 20, 30, 0x000000, 0.3)
            .setDepth(99)
            .setScrollFactor(0)

        // Create powerup sprite
        powerupInfo.displaySprite = scene.add
            .sprite(x + 20, baseY + 20, `powerup_${powerupName}`)
            .setScale(0.8)
            .setDepth(100)
            .setScrollFactor(0)

        // Always show count text (even for count = 1)
        powerupInfo.countText = scene.add.text(x + 35, baseY , `x${powerupInfo.count}`, {
            fontSize: '14px',
            fill: '#fff',
            stroke: '#000',
            strokeThickness: 3
        })
            .setDepth(100)
            .setScrollFactor(0);

        // Show duration
        if (powerupInfo.duration) {
            const remainingSeconds = Math.ceil(powerupInfo.duration / 1000);
            powerupInfo.durationText = scene.add.text(x + 20, baseY + 45,
                `${remainingSeconds}s`, {
                fontSize: '14px',
                fill: '#fff',
                stroke: '#000',
                strokeThickness: 2
            })
                .setOrigin(0.5)
                .setDepth(100)
                .setScrollFactor(0);

            // Create new update interval with proper timing
            let elapsedTime = 0
            powerupInfo.updateInterval = scene.time.addEvent({
                delay: 1000,
                callback: () => {
                    elapsedTime += 1000
                    const remaining = Math.ceil(
                        (powerupInfo.duration - elapsedTime) / 1000
                    )
                    if (powerupInfo.durationText && remaining > 0) {
                        powerupInfo.durationText.setText(`${remaining}s`)
                    }
                },
                repeat: remainingSeconds - 1,
            })
        }
    }

    updateDisplay()

    // Create timer for powerup expiration
    scene.time.delayedCall(powerupInfo.duration, () => {
        powerupInfo.count--
        if (powerupInfo.count <= 0) {
            // Clean up all display elements
            if (powerupInfo.displaySprite) powerupInfo.displaySprite.destroy()
            if (powerupInfo.countText) powerupInfo.countText.destroy()
            if (powerupInfo.durationText) powerupInfo.durationText.destroy()
            if (powerupInfo.updateInterval) powerupInfo.updateInterval.remove()
            delete gameState.activePowerups[powerupName]
        } else {
            updateDisplay()
        }
    })
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
                    <input type="checkbox" id="speedBoost"> Speed Boost
                </label>
                <label>
                    <input type="checkbox" id="powerUp"> Power Up (2x damage)
                </label>
            </div>
        </div>
    `
    document.body.appendChild(menu)


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
    console.time("startGameTime")
    console.log("[StartGame] Beginning game initialization")
    gameState.roomId = gameData.roomId
    console.log("[StartGame] Creating timer element")

    // Initial display
    console.log("[StartGame] Setting up game scene")
    // Initialize Phaser game if not already created
    if (!window.game.scene) {
        console.log("[StartGame] Creating new Phaser instance")
        // Add scene ready callback
        config.scene.create = function () {
            console.log("Scene create function called")
            // Call original create function
            create.call(this)

            // Now that scene is ready, spawn players
            console.log("[Scene] Spawning players")
            spawnAllPlayers.call(this, gameData.players, socketId)

            console.log("[Scene] Notifying server player is ready")
            Socket.getSocket().emit("player_ready", {
                roomId: gameState.roomId,
                playerId: Socket.getSocket().id,
            })
        }
        window.game = new Phaser.Game(config)
    }

    // Reset game state
    console.log("[StartGame] Clearing game state")
    gameState.gameStarted = true
    gameState.players.clear()
    gameState.weapons.clear()
    gameState.powerups.clear()
    // Corrected the code to properly select and remove the loading spinner element
    document.querySelector(".loading-spinner").remove()

    console.log("Game started in room:", gameData.roomId)
}

function spawnAllPlayers(playerAssignments, socketId) {
    // Clear existing players
    PlayerManager.players.clear()
    console.time("spawnPlayersTime")
    console.log("[Spawn] Starting player spawn:", {
        playerCount: playerAssignments.length,
        socketId: socketId,
    })

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
            //console.log("S yes")
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
    console.timeEnd("spawnPlayersTime")
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
        fullHeal: false,
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
        document.getElementById("fullHeal").addEventListener("change", (e) => {
            activeEffects.fullHeal = e.target.checked
            if (e.target.checked) setHealth(100)
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
    // const playerSprite = PlayerManager.players.get(moveData.id)
    const setHealth = function (value) {
        // To be implemented when connecting with game health system
        // console.log("playerSprite", playerSprite)
        console.log("Health set to:", value)
        player.health = value
    }

    const setSpeed = function (multiplier) {
        // To be implemented when connecting with game movement system
        console.log("Speed multiplier set to:", multiplier)
        player.speedMultiplier = multiplier
    }

    const setDamageMultiplier = function (multiplier) {
        // To be implemented when connecting with game damage system
        console.log("Damage multiplier set to:", multiplier)
        player.attackMultiplier = multiplier
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
    const playerNumber = playerData.number
    const directions = ["left", "right"]
    const actionFrames = {
        Run: 7,
        Jump: 13,
        Hurt: 3,
        Death: 10,
    }
    const props = ["Bare", "Dagger", "Sword", "Bow"]

    directions.forEach((direction) => {
        props.forEach((prop) => {
            Object.entries(actionFrames).forEach(([action, frameCount]) => {
                const animKey = `Player${playerNumber}_${direction}_${action}_${prop}`

                const frames = []
                for (let i = 1; i <= frameCount; i++) {
                    frames.push({
                        key: `Player${playerNumber}_${direction}_${action}_${prop}_${i}`,
                    })
                }

                scene.anims.create({
                    key: animKey,
                    frames: frames,
                    frameRate: 10,
                    repeat: action === "Run" ? -1 : 0,
                })
            })
        })
    })

    //console.log('Loading attack textures for player', playerData.number);
    directions.forEach((direction) => {
        props.forEach((prop) => {
            if (prop !== "Bare") {
                // Skip Bare prop for attack animations
                for (let frame = 1; frame <= 8; frame++) {
                    const path = `./assets/characters/Player${playerData.number}/${direction}/Attack/${prop}/${frame}.png`
                    const key = `Player${playerData.number}_${direction}_Attack_${prop}_${frame}`
                    //console.log(`Loading attack texture: ${key} from ${path}`);
                    scene.load.image(key, path)
                }
            }
        })
    })

    // Add texture load error handler
    scene.load.on("loaderror", (fileObj) => {
        console.error("Error loading texture:", fileObj.key, fileObj.src)
    })

    return `Player${playerNumber}_right_Hurt_Bare_3`
}

function handlePlayerHurt(player) {
    const hurtAnim = `Player${player.number}_${player.direction}_Hurt_${player.currentProp}`
    player.play(hurtAnim).once("animationcomplete", () => {
        // Return to previous animation after hurt animation completes
        if (player.body.velocity.x !== 0) {
            player.play(`player${player.number}_${player.direction}_run`)
        } else {
            player.play(`player${player.number}_${player.direction}_idle`)
        }
    })
}

// Update weapon pickup handling
function handleWeaponPickup(weapon) {
    if (!player) return

    const weaponName =
        weapon.name.charAt(0).toUpperCase() + weapon.name.slice(1)
    PlayerManager.updatePlayerProp(player, weaponName)

    // Emit weapon pickup to other players if needed
    const socket = Socket.getSocket()
    if (socket) {
        socket.emit("weapon_pickup", {
            playerId: player.id,
            weapon: weaponName,
        })
    }
}
// Initialize when document is ready
document.addEventListener("DOMContentLoaded", () => {
    CheatMode.initialize()
})
