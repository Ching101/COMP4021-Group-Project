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
        socket = io()

        socket.on("connect", () => {
            socket.emit("get users")
            GameStats.startAutoRefresh()
        })

        socket.on("disconnect", () => {
            GameStats.stopAutoRefresh()
        })

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

        socket.on('game_started', () => {
            $('.lobby-container').hide();
            $('#game').show();
            startGame();
        });

        socket.on('player_ready', (playerData) => {
            if (window.game && window.game.scene.scenes[0]) {
                handlePlayerJoined.call(window.game.scene.scenes[0], playerData);
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
