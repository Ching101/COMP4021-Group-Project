let otherPlayers = new Map();

// Updates the position and state of other players
function updateOtherPlayer(playerData) {
    const otherPlayer = otherPlayers.get(playerData.id);
    if (otherPlayer) {
        otherPlayer.x = playerData.x;
        otherPlayer.y = playerData.y;
        otherPlayer.currentWeapon = playerData.currentWeapon;
    }
}

const config = {
    type: Phaser.AUTO,
    parent: 'game',
    width: 800,
    height: 600,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 800 },
            debug: false
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

// Game state variables
let player;
let healthBar;
let cursors;
let wasdKeys;
let weapons = [];
let powerups = [];
let gameTimer;
let currentWeapon = null;
const WEAPONS = {
    DAGGER: {
        name: 'dagger',
        damage: 15,
        attackSpeed: 200,
        throwSpeed: 600,
        range: 30,
        isThrowable: true
    },
    SWORD: {
        name: 'sword',
        damage: 25,
        attackSpeed: 400,
        range: 50,
        isThrowable: false
    },
    BOW: {
        name: 'bow',
        damage: 35,
        chargeTime: 500,
        range: 600,
        projectileSpeed: 800,
        isThrowable: false
    }
};

// Create powerup sprites
const powerupGraphics = {
    health: 'health_potion',
    attack: 'attack_boost',
    speed: 'speed_boost'
};

// Update POWERUPS configuration
const POWERUPS = {
    HEALTH: {
        name: 'health',
        effect: 20,
        sprite: 'health_potion',
        scale: 1
    },
    ATTACK: {
        name: 'attack',
        multiplier: 2,
        duration: 10000,
        sprite: 'attack_boost',
        scale: 1
    },
    SPEED: {
        name: 'speed',
        multiplier: 1.5,
        duration: 8000,
        sprite: 'speed_boost',
        scale: 1
    }
};

let platforms;
let debugText;

// Game networking
let gameSocket = null;

// Add spawn points array at the top of game.js
const SPAWN_POINTS = [
    { x: 100, y: 300 },  // Left side
    { x: 700, y: 300 },  // Right side
    { x: 400, y: 100 },  // Top middle
    { x: 400, y: 500 }   // Bottom middle
];

function initializeMultiplayer() {
    if (!player) {
        console.error('Player not initialized');
        return;
    }

    gameSocket = Socket.getSocket();
    if (!gameSocket) {
        console.error('Socket not connected');
        return;
    }

    const playerId = generatePlayerId();
    player.playerId = playerId;

    const spawnPoint = SPAWN_POINTS[otherPlayers.size] || SPAWN_POINTS[0];

    // Join the game
    gameSocket.emit('join_game', {
        player: {
            id: playerId,
            username: `Player${Math.floor(Math.random() * 1000)}`,
            x: spawnPoint.x,
            y: spawnPoint.y,
            currentWeapon: currentWeapon,
            health: 100
        }
    });

    // Set up game event listeners
    gameSocket.on('player_joined', handlePlayerJoined.bind(this));
    gameSocket.on('player_left', handlePlayerLeft.bind(this));
    gameSocket.on('player_state', updateOtherPlayer);
}

function preload() {
    this.load.on('loaderror', function (file) {
        console.error('Error loading file:', file.src);
    });

    this.load.image('background', 'assets/background/2d-pvp-arena-1-pixel-1.png');

    // Load weapon sprites
    this.load.image('dagger', 'assets/weapons/daggers.png');
    this.load.image('sword', 'assets/weapons/sword.png');
    this.load.image('bow', 'assets/weapons/bow.png');

    // Load powerup sprites
    this.load.image('health_potion', 'assets/powerups/health.png');
    this.load.image('attack_boost', 'assets/powerups/attack.png');
    this.load.image('speed_boost', 'assets/powerups/speed.png');

    // Keep powerup graphics as shapes for now
    const graphics = this.add.graphics();

    // Player (green rectangle)
    graphics.fillStyle(0x00ff00);
    graphics.fillRect(0, 0, 32, 48);
    graphics.generateTexture('player', 32, 48);

    graphics.clear();
    graphics.fillStyle(0x800080);
    graphics.fillRect(0, 0, 20, 5);
    graphics.generateTexture('arrow', 20, 5);

    // Powerups
    graphics.clear();
    graphics.fillStyle(0xff0000);
    graphics.fillCircle(8, 8, 8);
    graphics.generateTexture('powerup_health', 16, 16);

    graphics.clear();
    graphics.fillStyle(0xff6b00);
    graphics.fillCircle(8, 8, 8);
    graphics.generateTexture('powerup_attack', 16, 16);

    graphics.clear();
    graphics.fillStyle(0x00ff00);
    graphics.fillCircle(8, 8, 8);
    graphics.generateTexture('powerup_speed', 16, 16);

    // Ground (brown rectangle)
    graphics.fillStyle(0x966F33);
    graphics.fillRect(0, 0, 800, 64);
    graphics.generateTexture('ground', 800, 64);

    graphics.destroy();

    // Load character spritesheet
    this.load.spritesheet('player1',
        'assets/characters/Player1/right/Run/Bare/8.png',
        {
            frameWidth: 32,  // Width of each frame
            frameHeight: 48  // Height of each frame
        }
    );
}

function create() {
    // Initialize player first
    player = this.physics.add.sprite(400, 300, 'player');
    player.setCollideWorldBounds(true);
    player.health = 100;
    player.direction = 1; // 1 for right, -1 for left

    // Add the background image
    const background = this.add.image(400, 300, 'background');

    // Scale the background to fit the game width and height
    background.setDisplaySize(800, 600);

    // Make sure background is behind everything
    background.setDepth(-1);

    // Create platforms group
    platforms = this.physics.add.staticGroup();

    // Create main ground - moved lower
    const ground = platforms.create(400, 580, 'ground');  // Changed from 568 to 580
    ground.setDisplaySize(800, 64);
    ground.refreshBody();

    // Add floating platforms - adjusted heights
    // Left platform
    const platform1 = platforms.create(200, 450, 'ground');  // Changed from 400 to 450
    platform1.setDisplaySize(200, 20);
    platform1.refreshBody();

    // Middle platform (higher)
    const platform2 = platforms.create(400, 350, 'ground');  // Changed from 300 to 350
    platform2.setDisplaySize(200, 20);
    platform2.refreshBody();

    // Right platform
    const platform3 = platforms.create(600, 450, 'ground');  // Changed from 400 to 450
    platform3.setDisplaySize(200, 20);
    platform3.refreshBody();

    // Small platforms for extra mobility
    const smallPlatform1 = platforms.create(100, 250, 'ground');  // Changed from 200 to 250
    smallPlatform1.setDisplaySize(100, 20);
    smallPlatform1.refreshBody();

    const smallPlatform2 = platforms.create(700, 250, 'ground');  // Changed from 200 to 250
    smallPlatform2.setDisplaySize(100, 20);
    smallPlatform2.refreshBody();

    // Add collision between player and ground
    this.physics.add.collider(player, platforms);

    // Setup controls
    cursors = this.input.keyboard.addKeys({
        up: Phaser.Input.Keyboard.KeyCodes.SPACE,
        down: Phaser.Input.Keyboard.KeyCodes.S,
        left: Phaser.Input.Keyboard.KeyCodes.A,
        right: Phaser.Input.Keyboard.KeyCodes.D,
        throw: Phaser.Input.Keyboard.KeyCodes.E
    });

    // Create health bar
    createHealthBar.call(this);

    // Setup mouse input for attacks
    this.input.on('pointerdown', function (pointer) {
        basicAttack.call(this, pointer);
    }, this);

    // Start match timer (3 minutes)
    gameTimer = this.time.addEvent({
        delay: 180000, // 3 minutes in milliseconds
        callback: endMatch,
        callbackScope: this
    });

    // Start weapon and powerup spawning
    startItemSpawning.call(this);

    // Add debug text
    debugText = this.add.text(10, 10, '', {
        fontSize: '16px',
        fill: '#ffffff',
        backgroundColor: '#000000',
        padding: { x: 10, y: 10 }
    });
    debugText.setScrollFactor(0);  // Make it stay on screen
    debugText.setDepth(1000);      // Make sure it's always visible

    // Initialize multiplayer
    startGame();

    // Setup powerup spawning
    this.time.addEvent({
        delay: 10000, // Spawn every 10 seconds
        callback: () => {
            const x = Phaser.Math.Between(50, 750);
            const y = 0;
            const powerupTypes = Object.values(POWERUPS);
            const randomType = powerupTypes[Math.floor(Math.random() * powerupTypes.length)];
            spawnPowerup.call(this, x, y, randomType);
        },
        loop: true
    });

    // Add multiplayer event listeners
    gameSocket.on('player_joined', handlePlayerJoined.bind(this));
    gameSocket.on('player_left', handlePlayerLeft.bind(this));
    gameSocket.on('player_state', updateOtherPlayer);
}

function update() {
    if (!player || !gameSocket) return;
    const baseSpeed = 160;
    const currentSpeed = baseSpeed * (player.speedMultiplier || 1);

    // Handle existing player movement and controls
    if (cursors.left.isDown) {
        player.setVelocityX(-currentSpeed);
        player.direction = -1;
        player.setFlipX(true);
    } else if (cursors.right.isDown) {
        player.setVelocityX(currentSpeed);
        player.direction = 1;
        player.setFlipX(false);
    } else {
        player.setVelocityX(0);
    }

    if (cursors.up.isDown && player.body.touching.down) {
        player.setVelocityY(-500);
    }

    // Send player updates to server
    gameSocket.emit('player_update', {
        id: player.id,
        x: player.x,
        y: player.y,
        currentWeapon: currentWeapon,
        health: player.health,
        velocity: {
            x: player.body.velocity.x,
            y: player.body.velocity.y
        }
    });

    // Update other players' positions with interpolation
    otherPlayers.forEach((otherPlayer) => {
        if (otherPlayer.targetX !== undefined) {
            otherPlayer.x = Phaser.Math.Linear(otherPlayer.x, otherPlayer.targetX, 0.3);
            otherPlayer.y = Phaser.Math.Linear(otherPlayer.y, otherPlayer.targetY, 0.3);

            // Update weapon position for other players
            if (otherPlayer.currentWeapon) {
                otherPlayer.currentWeapon.x = otherPlayer.x;
                otherPlayer.currentWeapon.y = otherPlayer.y;
            }
        }
    });

    // Add this new section to handle throwing
    if (cursors.throw.isDown && currentWeapon && currentWeapon.name === 'dagger') {
        throwDagger.call(this);
    }
    if (currentWeapon) {
        currentWeapon.x = player.x;
        currentWeapon.y = player.y;
    }

    // Send player state to server
    if (gameSocket) {
        gameSocket.emit('player_update', {
            roomId: getRoomIdFromURL(),
            id: player.playerId,
            x: player.x,
            y: player.y,
            currentWeapon: currentWeapon,
            health: player.health
        });
    }
}

function createHealthBar() {
    healthBar = this.add.graphics();
    updateHealthBar.call(this);
}

function updateHealthBar() {
    healthBar.clear();
    // Background
    healthBar.fillStyle(0xff0000);
    healthBar.fillRect(10, 10, 200, 20);
    // Health
    healthBar.fillStyle(0x00ff00);
    healthBar.fillRect(10, 10, 200 * (player.health / 100), 20);
}
function basicAttack(pointer) {
    if (!currentWeapon) {
        // Visual feedback for no weapon
        const text = this.add.text(player.x, player.y - 50, 'No weapon!', {
            fontSize: '16px',
            fill: '#ff0000'
        }).setOrigin(0.5);

        this.tweens.add({
            targets: text,
            y: text.y - 30,
            alpha: 0,
            duration: 1000,
            onComplete: () => text.destroy()
        });
        return;
    }

    if (player.attackCooldown) return;

    const time = this.time.now;
    if (time < player.lastAttackTime + currentWeapon.attackSpeed) return;

    player.attackCooldown = true;
    player.lastAttackTime = time;

    // Handle different weapon types
    switch (currentWeapon.name) {
        case 'bow':
            chargeBow.call(this, pointer);
            break;
        case 'dagger':
            meleeAttack.call(this, currentWeapon.damage, currentWeapon.range);
            break;
        case 'sword':
            meleeAttack.call(this, currentWeapon.damage, currentWeapon.range);
            break;
    }

    // Reset attack cooldown
    this.time.delayedCall(currentWeapon.attackSpeed, () => {
        player.attackCooldown = false;
    });
}

function startItemSpawning() {
    // Spawn weapons every 5 seconds
    this.time.addEvent({
        delay: 5000,
        callback: () => {
            spawnWeapon.call(this);
        },
        loop: true
    });

    // Spawn powerups every 10 seconds
    this.time.addEvent({
        delay: 10000,
        callback: () => {
            spawnPowerup.call(this);
        },
        loop: true
    });
}

function spawnWeapon() {
    const weaponTypes = ['DAGGER', 'SWORD', 'BOW'];
    const randomType = weaponTypes[Math.floor(Math.random() * weaponTypes.length)];
    const weaponConfig = WEAPONS[randomType];

    const x = Phaser.Math.Between(50, 750);
    const y = Phaser.Math.Between(50, 500);

    const weapon = this.physics.add.sprite(x, y, weaponConfig.name);
    weapon.type = weaponConfig;

    // Add collision with player
    this.physics.add.overlap(player, weapon, collectWeapon, null, this);

    // Add collision with ground
    this.physics.add.collider(weapon, platforms);
}

function collectWeapon(player, weapon) {
    // Drop current weapon if holding one


    currentWeapon = weapon.type;
    weapon.destroy();

    // Add text feedback
    const text = this.add.text(player.x, player.y - 50, `Picked up ${currentWeapon.name}!`, {
        fontSize: '16px',
        fill: '#fff'
    }).setOrigin(0.5);

    this.tweens.add({
        targets: text,
        y: text.y - 30,
        alpha: 0,
        duration: 1000,
        onComplete: () => text.destroy()
    });

    console.log(`Collected weapon: ${weapon.type.name}`);  // Debug log
}

function spawnPowerup() {
    // Get random powerup type from POWERUPS object
    const powerupTypes = Object.keys(POWERUPS);
    const randomType = powerupTypes[Math.floor(Math.random() * powerupTypes.length)];
    const powerupConfig = POWERUPS[randomType];

    // Random position
    const x = Phaser.Math.Between(50, 750);
    const y = Phaser.Math.Between(50, 550);

    // Create powerup sprite
    const powerup = this.physics.add.sprite(x, y, powerupConfig.sprite);
    powerup.powerupType = randomType;
    powerup.setScale(powerupConfig.scale);

    // Add a gentle floating animation
    this.tweens.add({
        targets: powerup,
        y: y - 10
    });

    // Add collision with platforms
    this.physics.add.collider(powerup, platforms);

    // Add collision with player
    this.physics.add.overlap(player, powerup, collectPowerup, null, this);

    // Add to powerups array
    powerups.push(powerup);

    return powerup;
}

function collectPowerup(player, powerup) {
    if (!powerup.powerupType) return; // Guard clause for undefined powerupType

    const type = POWERUPS[powerup.powerupType];
    if (!type) return; // Guard clause for invalid powerup type

    switch (type.name) {
        case 'health':
            player.health = Math.min(player.health + type.effect, 100);
            updateHealthBar();
            break;
        case 'attack':
            player.damageMultiplier = (player.damageMultiplier || 1) * type.multiplier;
            this.time.delayedCall(type.duration, () => {
                player.damageMultiplier = 1;
            });
            break;
        case 'speed':
            player.speedMultiplier = (player.speedMultiplier || 1) * type.multiplier;
            this.time.delayedCall(type.duration, () => {
                player.speedMultiplier = 1;
            });
            break;
    }

    // Add floating text effect
    const effectText = this.add.text(player.x, player.y - 50,
        `${type.name.toUpperCase()} BOOST!`, {
        fontSize: '20px',
        fill: '#fff',
        stroke: '#000',
        strokeThickness: 4
    }).setOrigin(0.5);

    this.tweens.add({
        targets: effectText,
        y: effectText.y - 30,
        alpha: 0,
        duration: 1000,
        onComplete: () => effectText.destroy()
    });

    powerup.destroy();
}

function endMatch() {
    // Match end logic
}

function meleeAttack(damage, range) {
    // Calculate angle between player and cursor
    const pointer = this.input.activePointer;
    const angle = Phaser.Math.Angle.Between(
        player.x, player.y,
        pointer.worldX, pointer.worldY
    );

    // Create attack hitbox at the calculated angle
    const hitboxX = player.x + Math.cos(angle) * (range / 2);
    const hitboxY = player.y + Math.sin(angle) * (range / 2);

    const hitbox = this.add.rectangle(
        hitboxX,
        hitboxY,
        range,
        40,
        0xff0000,
        0.2
    );

    // Set hitbox rotation to match attack direction
    hitbox.rotation = angle;

    // Flip player sprite based on cursor position
    player.setFlipX(pointer.worldX < player.x);

    // Remove hitbox after brief moment
    this.time.delayedCall(100, () => hitbox.destroy());
}

function throwDagger(pointer) {
    if (!currentWeapon || currentWeapon.name !== 'dagger') return;

    const projectile = this.physics.add.sprite(
        player.x,
        player.y,
        'dagger'
    );

    // Direction based on player facing
    const direction = player.direction === 'left' ? -1 : 1;
    const throwSpeed = currentWeapon.throwSpeed || 600;

    projectile.setVelocityX(direction * throwSpeed);

    // Rotate the dagger based on direction
    projectile.rotation = direction === -1 ? Math.PI : 0;

    // Add debug visualization
    if (debugText) {
        const throwPath = this.add.graphics();
        throwPath.lineStyle(1, 0xffff00, 0.5);
        this.time.addEvent({
            delay: 16,
            callback: () => {
                if (projectile.active) {
                    throwPath.lineTo(projectile.x, projectile.y);
                }
            },
            repeat: 30
        });
        this.time.delayedCall(500, () => throwPath.destroy());
    }

    // Cleanup thrown dagger after some time
    this.time.delayedCall(1000, () => {
        if (projectile && projectile.active) {
            projectile.destroy();
        }
    });

    // Drop the current weapon after throwing
    currentWeapon = null;

    // Add visual feedback
    const text = this.add.text(player.x, player.y - 50, 'Dagger thrown!', {
        fontSize: '16px',
        fill: '#fff'
    }).setOrigin(0.5);

    this.tweens.add({
        targets: text,
        y: text.y - 30,
        alpha: 0,
        duration: 1000,
        onComplete: () => text.destroy()
    });
}

function chargeBow(pointer) {
    if (!currentWeapon) return;

    const chargeStart = this.time.now;

    // Visual charge effect
    const chargeBar = this.add.rectangle(
        player.x,
        player.y - 40,
        0,
        5,
        0xff0000
    );

    // Charge update
    const chargeInterval = this.time.addEvent({
        delay: 16,
        callback: () => {
            const chargeTime = this.time.now - chargeStart;
            const chargePercent = Math.min(chargeTime / currentWeapon.chargeTime, 1);
            chargeBar.width = 40 * chargePercent;

            // Add glow effect as charge increases
            chargeBar.setFillStyle(0xff0000 + (Math.floor(chargePercent * 255) << 8));
        },
        loop: true
    });

    // Release on mouse up
    const releaseFunction = () => {
        chargeInterval.destroy();
        chargeBar.destroy();

        const chargeTime = this.time.now - chargeStart;
        const power = Math.min(chargeTime / currentWeapon.chargeTime, 1);

        // Add charge feedback
        const powerText = this.add.text(player.x, player.y - 50,
            `Power: ${Math.floor(power * 100)}%`, {
            fontSize: '16px',
            fill: '#fff'
        }).setOrigin(0.5);

        this.tweens.add({
            targets: powerText,
            y: powerText.y - 30,
            alpha: 0,
            duration: 500,
            onComplete: () => powerText.destroy()
        });

        fireArrow.call(this, pointer, power);

        this.input.off('pointerup', releaseFunction);
    };

    this.input.on('pointerup', releaseFunction);
}

function fireArrow(pointer, power) {
    const arrow = this.physics.add.sprite(player.x, player.y, 'arrow');

    // Calculate angle between player and pointer
    const angle = Phaser.Math.Angle.Between(
        player.x, player.y,
        pointer.worldX, pointer.worldY
    );

    // Set arrow rotation to match angle
    arrow.rotation = angle;

    // Calculate velocity components using angle
    const speed = currentWeapon.projectileSpeed * power;
    arrow.body.setVelocity(
        Math.cos(angle) * speed,
        Math.sin(angle) * speed
    );

    // Add slight gravity effect
    arrow.body.setGravityY(150);

    // Add collision with platforms
    this.physics.add.collider(arrow, platforms, (arrow) => {
        // Stick the arrow where it hit
        arrow.body.setVelocity(0, 0);
        arrow.body.setGravityY(0);
        arrow.body.setImmovable(true);

        // Destroy arrow after a delay
        this.time.delayedCall(2000, () => {
            if (arrow && arrow.active) {
                arrow.destroy();
            }
        });
    });

    // Make arrow persist longer if it doesn't hit anything
    this.time.delayedCall(3000, () => {
        if (arrow && arrow.active) {
            arrow.destroy();
        }
    });

    // Add debug visualization of arrow path
    if (debugText) {
        const arrowPath = this.add.graphics();
        arrowPath.lineStyle(1, 0xff0000, 0.5);
        arrowPath.beginPath();
        arrowPath.moveTo(arrow.x, arrow.y);

        this.time.addEvent({
            delay: 16,
            callback: () => {
                if (arrow.active) {
                    arrowPath.lineTo(arrow.x, arrow.y);
                }
            },
            repeat: 50
        });

        this.time.delayedCall(1000, () => {
            arrowPath.destroy();
        });
    }
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

// Initialize when document is ready
document.addEventListener("DOMContentLoaded", () => {
    CheatMode.initialize()
})

// Initializes and starts the game
function startGame() {
    if (!window.game) {
        window.game = new Phaser.Game(config);
    }

    const gameScene = window.game.scene.scenes[0];
    if (gameScene) {
        // Initialize multiplayer components
        if (!gameSocket) {
            gameSocket = Socket.getSocket();
            initializeMultiplayer();
        }

        // Start game systems
        if (typeof startItemSpawning === 'function') {
            startItemSpawning.call(gameScene);
        }

        // Initialize match timer
        gameTimer = gameScene.time.addEvent({
            delay: 180000, // 3 minutes
            callback: endMatch,
            callbackScope: gameScene
        });

        // Emit ready state
        gameSocket.emit('player_ready', {
            id: player.playerId,
            x: player.x,
            y: player.y,
            roomId: getRoomIdFromURL() || 'default'
        });
    }
}

// Generates unique player ID
function generatePlayerId() {
    return 'player_' + Math.random().toString(36).substr(2, 9);
}

function updateRoomDisplay(roomData) {
    $('#player-list').empty();
    roomData.players.forEach(player => {
        const highlightClass = (player.username === currentPlayer) ? 'highlight' : '';
        $('#player-list').append(
            `<li>${highlightClass ? `<span class="${highlightClass}">${player.username}</span>` : player.username}</li>`
        );
    });
}

function handlePlayerJoined(playerData) {
    console.log('Player joined:', playerData);
    const otherPlayer = this.add.sprite(playerData.x, playerData.y, 'player');
    otherPlayer.id = playerData.id;
    otherPlayer.setTint(0xff0000); // Visual distinction for other players
    this.physics.add.existing(otherPlayer);
    otherPlayer.body.setCollideWorldBounds(true);
    this.physics.add.collider(otherPlayer, platforms);
    otherPlayers.set(playerData.id, otherPlayer);
}

// Handles player disconnection
function handlePlayerLeft(playerId) {
    const otherPlayer = otherPlayers.get(playerId);
    if (otherPlayer) {
        otherPlayer.destroy();
        otherPlayers.delete(playerId);
    }
}

function initSinglePlayerGame() {
    // Create Phaser game instance if it doesn't exist
    if (!window.game) {
        window.game = new Phaser.Game(config);
    }

    // Start game systems
    if (typeof startItemSpawning === 'function') {
        startItemSpawning();
    }

    // Initialize match timer
    gameTimer = window.game.time.addEvent({
        delay: 180000, // 3 minutes
        callback: endMatch,
        callbackScope: window.game
    });
}
