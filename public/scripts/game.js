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

const game = new Phaser.Game(config);

// Game state variables
let player;
let healthBar;
let cursors;
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

const POWERUPS = {
    HEALTH: {
        name: 'health',
        effect: 20,  // HP to restore
        color: 0xff0000  // Red
    },
    ATTACK: {
        name: 'attack',
        multiplier: 2,
        duration: 10000, // 10 seconds
        color: 0xff6b00  // Orange
    },
    SPEED: {
        name: 'speed',
        multiplier: 1.5,
        duration: 8000,  // 8 seconds
        color: 0x00ff00  // Green
    }
};

let platforms;
let debugText;

function preload() {
    this.load.on('loaderror', function (file) {
        console.error('Error loading file:', file.src);
    });

    this.load.image('background', './assets/background/2d-pvp-arena-2-pixel.png');

    // Create a temporary texture for our shapes
    const graphics = this.add.graphics();

    // Player (green rectangle)
    graphics.fillStyle(0x00ff00);
    graphics.fillRect(0, 0, 32, 48);
    graphics.generateTexture('player', 32, 48);

    // Weapons
    graphics.clear();
    graphics.fillStyle(0xffff00);
    graphics.fillRect(0, 0, 20, 8);
    graphics.generateTexture('dagger', 20, 8);

    graphics.clear();
    graphics.fillStyle(0xff0000);
    graphics.fillRect(0, 0, 30, 10);
    graphics.generateTexture('sword', 30, 10);

    graphics.clear();
    graphics.fillStyle(0x800080);
    graphics.fillRect(0, 0, 25, 15);
    graphics.generateTexture('bow', 25, 15);

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
}

function create() {
    // Create gradient background
    const background = this.add.graphics();

    // Create gradient from dark blue to light blue
    background.fillGradientStyle(
        0x1a1a2e,  // Dark blue at top
        0x1a1a2e,  // Dark blue at top
        0x16213e,  // Slightly lighter blue at bottom
        0x16213e,  // Slightly lighter blue at bottom
        1          // Alpha (opacity)
    );

    // Fill the entire game area
    background.fillRect(0, 0, 800, 600);

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

    // Create player
    player = this.physics.add.sprite(400, 300, 'player');
    player.setCollideWorldBounds(true);
    player.health = 100;
    player.direction = 'right';  // Default direction

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
}

function update() {
    const baseSpeed = 160;
    const currentSpeed = baseSpeed * (player.speedMultiplier || 1);

    if (cursors.left.isDown) {
        player.setVelocityX(-currentSpeed);
        player.setFlipX(true);     // Flip sprite to face left
        player.direction = 'left';  // Track direction
    } else if (cursors.right.isDown) {
        player.setVelocityX(currentSpeed);
        player.setFlipX(false);    // Normal sprite facing right
        player.direction = 'right'; // Track direction
    } else {
        player.setVelocityX(0);
    }

    // Handle jumping with stronger initial velocity
    if (cursors.up.isDown && player.body.touching.down) {
        player.setVelocityY(-500);  // Increased from -330 to -500 to match higher gravity
    }

    // Update health bar position
    updateHealthBar.call(this);

    // Update debug text
    debugText.setText([
        '=== Player Info ===',
        `Position: (${Math.floor(player.x)}, ${Math.floor(player.y)})`,
        `Velocity: (${Math.floor(player.body.velocity.x)}, ${Math.floor(player.body.velocity.y)})`,
        `Health: ${player.health}`,
        `On Ground: ${player.body.touching.down}`,
        '',
        '=== Weapon Info ===',
        `Current Weapon: ${currentWeapon ? currentWeapon.name : 'None'}`,
        currentWeapon ? `Damage: ${currentWeapon.damage}` : '',
        '',
        '=== Power-ups ===',
        `Speed Multiplier: ${player.speedMultiplier || 1}x`,
        `Attack Multiplier: ${player.attackMultiplier || 1}x`,
        '',
        '=== Controls ===',
        'AS - Move',
        'SPACE - Jump',
        'Click - Attack',
        'E - Throw (Dagger only)',
        `Facing: ${player.direction || 'right'}`,
    ].join('\n'));

    // Add this new section to handle throwing
    if (cursors.throw.isDown && currentWeapon && currentWeapon.name === 'dagger') {
        throwDagger.call(this);
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
    const powerupTypes = ['HEALTH', 'ATTACK', 'SPEED'];
    const randomType = powerupTypes[Math.floor(Math.random() * powerupTypes.length)];
    const powerupConfig = POWERUPS[randomType];

    const x = Phaser.Math.Between(50, 750);
    const y = Phaser.Math.Between(50, 500);

    const powerup = this.physics.add.sprite(x, y, `powerup_${powerupConfig.name}`);
    powerup.type = powerupConfig;

    // Add collision with player
    this.physics.add.overlap(player, powerup, collectPowerup, null, this);

    // Add collision with ground
    this.physics.add.collider(powerup, platforms);
}

function collectPowerup(player, powerup) {
    const type = powerup.type;

    switch (type.name) {
        case 'health':
            player.health = Math.min(player.health + type.effect, 100);
            updateHealthBar.call(this);
            break;
        case 'attack':
            player.attackMultiplier = (player.attackMultiplier || 1) * type.multiplier;
            this.time.delayedCall(type.duration, () => {
                player.attackMultiplier = (player.attackMultiplier || 2) / type.multiplier;
            });
            break;
        case 'speed':
            player.speedMultiplier = (player.speedMultiplier || 1) * type.multiplier;
            this.time.delayedCall(type.duration, () => {
                player.speedMultiplier = (player.speedMultiplier || 1.5) / type.multiplier;
            });
            break;
    }

    powerup.destroy();

    console.log(`Collected powerup: ${powerup.type.name}`);  // Debug log
}

function endMatch() {
    // Match end logic
}

function meleeAttack(damage, range) {
    // Create attack hitbox
    const direction = player.flipX ? -1 : 1;
    const hitbox = this.add.rectangle(
        player.x + (range * direction),
        player.y,
        range,
        40,
        0xff0000,
        0.2
    );

    // Check for hits on other players (will be implemented with multiplayer)

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
