const socket = io()
const canvas = document.getElementById("gameCanvas")
const ctx = canvas.getContext("2d")
const healthDisplay = document.getElementById("health")

// Load assets
const assets = {
    players: {},
    weapons: {},
    powerups: {},
    background: null,
}

// Load background
const backgroundImage = new Image()
backgroundImage.src = "assets/background/2d-pvp-arena-1-pixel-1.png"
backgroundImage.onload = () => {
    assets.background = backgroundImage
}

// Load player sprites
;["1", "2"].forEach((char) => {
    const img = new Image()
    img.src = `assets/characters/Player${char}/right/Hurt/Bare/3.png`
    img.onload = () => {
        console.log(`Player ${char} sprite loaded successfully`)
        assets.players[char] = img
    }
    img.onerror = () => {
        console.error(`Failed to load Player ${char} sprite`)
    }
})

// Load weapon sprites
;["dagger", "sword", "bow"].forEach((weapon) => {
    const img = new Image()
    img.src = `assets/weapons/${weapon}.png`
    img.onload = () => {
        assets.weapons[weapon] = img
    }
})

// Load powerup sprites
;["health", "speed", "attack"].forEach((powerup) => {
    const img = new Image()
    img.src = `assets/powerups/${powerup}.png`
    img.onload = () => {
        assets.powerups[powerup] = img
    }
})

canvas.width = 800
canvas.height = 600

const players = {}
let myId = null

let currentWeapon = null
let powerUps = {}
let matchTimer = null
let devMode = false

socket.on("connect", () => {
    console.log("Connected to server with ID:", socket.id)
    myId = socket.id
})

socket.on("currentPlayers", (serverPlayers) => {
    console.log("Received current players:", serverPlayers)
    Object.keys(serverPlayers).forEach((id) => {
        players[id] = serverPlayers[id]
    })
})

socket.on("newPlayer", (playerInfo, id) => {
    console.log("New player joined:", id, playerInfo)
    players[id] = playerInfo
})

socket.on("playerMoved", (playerInfo) => {
    if (players[playerInfo.id]) {
        players[playerInfo.id].x = playerInfo.x
        players[playerInfo.id].y = playerInfo.y
    }
})

socket.on("playerDisconnected", (id) => {
    delete players[id]
})

socket.on("playerAttacked", (attackData) => {
    drawAttack(attackData.x, attackData.y)
    if (myId !== attackData.attackerId) {
        const dx = players[myId].x - attackData.x
        const dy = players[myId].y - attackData.y
        const distance = Math.sqrt(dx * dx + dy * dy)

        if (distance < 30) {
            players[myId].health -= 10
            healthDisplay.textContent = `Health: ${players[myId].health}`
        }
    }
})

// Movement controls
const keys = {
    w: false,
    s: false,
    a: false,
    d: false,
    " ": false, // spacebar for jumping
}

document.addEventListener("keydown", (e) => {
    if (keys.hasOwnProperty(e.key)) {
        keys[e.key] = true
    }
    if (e.key === "`") {
        devMode = !devMode
        if (devMode) {
            createDevPanel()
        } else {
            document.getElementById("devPanel")?.remove()
        }
    }
})

document.addEventListener("keyup", (e) => {
    if (keys.hasOwnProperty(e.key)) {
        keys[e.key] = false
    }
})

// Attack on click
canvas.addEventListener("click", (e) => {
    if (!currentWeapon) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    if (currentWeapon.type === "bow") {
        // Implement charge-up mechanic
        setTimeout(() => {
            socket.emit("attack", { x, y, weapon: currentWeapon })
        }, 1000)
    } else {
        socket.emit("attack", { x, y, weapon: currentWeapon })
    }
})

function drawAttack(x, y) {
    const attackSize = 40;
    ctx.beginPath();
    ctx.arc(x, y, attackSize/2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
    ctx.fill();
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.closePath();
    
    setTimeout(() => {
        gameLoop();
    }, 100);
}

function updatePosition() {
    if (!players[myId]) return

    const speed = 5
    if (keys.w) players[myId].y -= speed
    if (keys.s) players[myId].y += speed
    if (keys.a) players[myId].x -= speed
    if (keys.d) players[myId].x += speed
    if (keys[" "]) players[myId].y -= speed

    // Keep player in bounds
    players[myId].x = Math.max(0, Math.min(canvas.width, players[myId].x))
    players[myId].y = Math.max(0, Math.min(canvas.height, players[myId].y))

    socket.emit("playerMovement", {
        x: players[myId].x,
        y: players[myId].y,
    })
}

function createDevPanel() {
    const panel = document.createElement("div")
    panel.id = "devPanel"
    panel.style.position = "fixed"
    panel.style.top = "10px"
    panel.style.right = "10px"
    panel.style.backgroundColor = "rgba(0,0,0,0.8)"
    panel.style.padding = "10px"
    panel.style.color = "white"

    const buttons = [
        { text: "God Mode", action: () => (players[myId].health = Infinity) },
        { text: "Speed Boost", action: () => (speed = 10) },
        { text: "Full Heal", action: () => (players[myId].health = 100) },
        { text: "2x Damage", action: () => (currentWeapon.damage *= 2) },
    ]

    buttons.forEach((btn) => {
        const button = document.createElement("button")
        button.textContent = btn.text
        button.onclick = btn.action
        panel.appendChild(button)
    })

    document.body.appendChild(panel)
}

function pickupWeapon(weapon) {
    currentWeapon = {
        type: weapon.type,
        damage:
            weapon.type === "dagger" ? 5 : weapon.type === "sword" ? 10 : 15,
        range:
            weapon.type === "dagger" ? 30 : weapon.type === "sword" ? 40 : 300,
    }
}

function applyPowerUp(powerUp) {
    switch (powerUp.type) {
        case "health":
            players[myId].health = Math.min(100, players[myId].health + 20)
            break
        case "speed":
            speed = 7.5
            setTimeout(() => (speed = 5), 8000)
            break
        case "attack":
            if (currentWeapon) {
                currentWeapon.damage *= 2
                setTimeout(() => (currentWeapon.damage /= 2), 10000)
            }
            break
    }
}

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background
    if (assets.background) {
        ctx.drawImage(assets.background, 0, 0, canvas.width, canvas.height);
    }
    
    updatePosition();
    
    // Draw power-ups
    Object.values(powerUps).forEach(powerUp => {
        if (assets.powerups[powerUp.type]) {
            ctx.drawImage(
                assets.powerups[powerUp.type],
                powerUp.x - 15,
                powerUp.y - 15,
                30,
                30
            );
        }
    });
    
    // Draw players with weapons
    Object.keys(players).forEach((id) => {
        const player = players[id];
        const playerSprite = assets.players[id === myId ? "1" : "2"];
        
        if (playerSprite) {
            // Draw only the sprite, removed circle
            ctx.drawImage(
                playerSprite,
                player.x - 25,
                player.y - 25,
                50,
                50
            );
            
            // Draw weapon if player has one
            if (player.weapon && assets.weapons[player.weapon.type]) {
                ctx.drawImage(
                    assets.weapons[player.weapon.type],
                    player.x + 15,
                    player.y - 15,
                    20,
                    20
                );
            }
        }
    });
    
    requestAnimationFrame(gameLoop);
}

gameLoop()
