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
