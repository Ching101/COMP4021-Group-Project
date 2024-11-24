const express = require("express")

const bcrypt = require("bcrypt")
const fs = require("fs")
const session = require("express-session")

// Create the Express app
const app = express()

// Use the 'public' folder to serve static files
app.use(express.static("public"))

// Use the json middleware to parse JSON data
app.use(express.json())

// Create the Socket.IO server
const { Server } = require("socket.io")
const httpServer = require("http").createServer(app)

// Create session middleware
const sessionMiddleware = session({
    secret: "secret_key",
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        maxAge: 1000 * 60 * 60 * 24
    }
})

// Use the session middleware with Express
app.use(sessionMiddleware)

// Create Socket.IO server
const io = new Server(httpServer)

// Use session middleware with Socket.IO
io.use((socket, next) => {
    sessionMiddleware(socket.request, socket.request.res || {}, next)
})

// Store online users
const onlineUsers = {}

// Socket.IO connection handling
io.on("connection", (socket) => {
    if (!socket.request.session || !socket.request.session.user) {
        socket.disconnect()
        return
    }

    const user = socket.request.session.user
    onlineUsers[user.username] = {
        name: user.name,
        gameRecord: user.gameRecord,
    }

    // Broadcast new user to all clients
    io.emit("add user", JSON.stringify(user))
    socket.emit("users", JSON.stringify(onlineUsers))

    // Handle get users request
    socket.on("get users", () => {
        socket.emit("users", JSON.stringify(onlineUsers))
    })

    // Handle disconnect
    socket.on("disconnect", () => {
        if (user && user.username) {
            delete onlineUsers[user.username]
            io.emit("remove user", JSON.stringify(user))
        }
    })
})

// This helper function checks whether the text only contains word characters
function containWordCharsOnly(text) {
    return /^\w+$/.test(text)
}

// Handle the /register endpoint
app.post("/register", (req, res) => {
    const { username, name, password } = req.body

    // Validate input
    if (!username || !name || !password) {
        return res.json({ status: "error", error: "All fields are required" })
    }

    if (!containWordCharsOnly(username)) {
        return res.json({
            status: "error",
            error: "Username can only contain letters, numbers and underscores",
        })
    }

    // Read users file
    try {
        const users = JSON.parse(fs.readFileSync("data/users.json"))

        // Check if username exists
        if (username in users) {
            return res.json({
                status: "error",
                error: "Username already exists",
            })
        }

        // Hash password and store new user with game record
        const hash = bcrypt.hashSync(password, 10)
        users[username] = {
            name: name,
            password: hash,
            gameRecord: {
                wins: 0,
                losses: 0,
            },
        }

        // Save updated users file
        fs.writeFileSync("data/users.json", JSON.stringify(users, null, 2))

        res.json({ status: "success" })
    } catch (err) {
        res.json({ status: "error", error: "Error accessing user database" })
    }
})

// Handle the /signin endpoint
app.post("/signin", (req, res) => {
    // Get the JSON data from the body
    const { username, password } = req.body

    // Read users file
    try {
        const users = JSON.parse(fs.readFileSync("data/users.json"))

        // Check if username exists and password matches
        if (!(username in users)) {
            return res.json({ status: "error", error: "Username not found" })
        }

        if (!bcrypt.compareSync(password, users[username].password)) {
            return res.json({ status: "error", error: "Incorrect password" })
        }

        // Store user information in session
        req.session.user = {
            username,
            name: users[username].name,
            gameRecord: users[username].gameRecord,
        }

        res.json({ status: "success", user: req.session.user })
    } catch (err) {
        res.json({ status: "error", error: "Error accessing user database" })
    }
})

// Add new endpoint to update game record
app.post("/updateGameRecord", (req, res) => {
    if (!req.session.user) {
        return res.json({ status: "error", error: "Not logged in" })
    }

    const { won } = req.body
    const username = req.session.user.username

    try {
        const users = JSON.parse(fs.readFileSync("data/users.json"))

        if (won) {
            users[username].gameRecord.wins++
        } else {
            users[username].gameRecord.losses++
        }

        fs.writeFileSync("data/users.json", JSON.stringify(users, null, 2))

        res.json({
            status: "success",
            record: users[username].gameRecord,
        })
    } catch (err) {
        res.json({ status: "error", error: "Error updating game record" })
    }
})

// Handle the /validate endpoint
app.get("/validate", (req, res) => {
    // Check if user is logged in
    if (!req.session.user) {
        return res.json({ status: "error", error: "Not logged in" })
    }

    // Send user information
    res.json({
        status: "success",
        user: {
            username: req.session.user.username,
            name: req.session.user.name,
            gameRecord: req.session.user.gameRecord,
        },
    })
})

// Handle the /signout endpoint
app.get("/signout", (req, res) => {
    // Delete session user data
    delete req.session.user

    // Send success response
    res.json({ status: "success" })
})

app.get("/getStats/:username", (req, res) => {
    const username = req.params.username

    if (!username) {
        return res.status(400).json({
            status: "error",
            error: "Username is required",
        })
    }

    try {
        const users = JSON.parse(fs.readFileSync("data/users.json"))

        if (!(username in users)) {
            return res.status(404).json({
                status: "error",
                error: "User not found",
            })
        }

        res.json({
            status: "success",
            stats: users[username].gameRecord,
        })
    } catch (err) {
        console.error("Error accessing user database:", err)
        res.status(500).json({
            status: "error",
            error: "Error accessing user database",
        })
    }
})

// Use a web server to listen at port 8000
httpServer.listen(8000, () => {
    console.log("The server has started...")
})

// http://localhost:8000
