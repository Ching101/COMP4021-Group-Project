const Socket = (function() {
    let socket = null;

    const getSocket = function() {
        return socket;
    };

    const connect = function() {
        socket = io();

        socket.on("connect", () => {
            socket.emit("get users");
            GameStats.startAutoRefresh();
        });

        socket.on("disconnect", () => {
            GameStats.stopAutoRefresh();
        });

        // Set up the users event
        socket.on("users", (onlineUsers) => {
            onlineUsers = JSON.parse(onlineUsers);
            OnlineUsersPanel.update(onlineUsers);
        });

        // Set up the add user event
        socket.on("add user", (user) => {
            user = JSON.parse(user);
            OnlineUsersPanel.addUser(user);
        });

        // Set up the remove user event
        socket.on("remove user", (user) => {
            user = JSON.parse(user);
            OnlineUsersPanel.removeUser(user);
        });
    };

    const disconnect = function() {
        GameStats.stopAutoRefresh();
        socket.disconnect();
        socket = null;
    };

    return { getSocket, connect, disconnect };
})();
