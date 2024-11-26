const SignInForm = (function () {
    // This function initializes the UI
    const initialize = function () {
        // Hide it
        $("#signin-overlay").hide()

        // Submit event for the signin form
        $("#signin-form").on("submit", (e) => {
            // Do not submit the form
            e.preventDefault()

            // Get the input fields
            const username = $("#signin-username").val().trim()
            const password = $("#signin-password").val().trim()

            // Send a signin request
            Authentication.signin(
                username,
                password,
                () => {
                    hide()
                    UserPanel.update(Authentication.getUser())
                    UserPanel.show()

                    Socket.connect()
                },
                (error) => {
                    $("#signin-message").text(error)
                }
            )
        })

        // Submit event for the register form
        $("#register-form").on("submit", (e) => {
            // Do not submit the form
            e.preventDefault()

            // Get the input fields
            const username = $("#register-username").val().trim()
            const password = $("#register-password").val().trim()

            // Send a register request
            Registration.register(
                username,
                password,
                () => {
                    $("#register-form").get(0).reset()
                    $("#register-message").text("You can sign in now.")
                },
                (error) => {
                    $("#register-message").text(error)
                }
            )
        })

        // Add this to public/scripts/ui.js after the SignInForm initialization
        $("#signin-overlay .auth-tab").on("click", function () {
            const tab = $(this).data("tab")

            // Update tabs
            $(".auth-tab").removeClass("active")
            $(this).addClass("active")

            // Update forms
            $(".auth-form").removeClass("active")
            $(`#${tab}-form`).addClass("active")
        })
    }

    // This function shows the form
    const show = function () {
        $("#signin-overlay").fadeIn(500)
    }

    // This function hides the form
    const hide = function () {
        $("#signin-form").get(0).reset()
        $("#signin-message").text("")
        $("#register-message").text("")
        $("#signin-overlay").fadeOut(500)
    }

    return { initialize, show, hide }
})()

const UserPanel = (function () {
    // This function initializes the UI
    const initialize = function () {
        // Hide it
        $("#user-panel").hide()

        // Click event for the signout button
        $("#signout-button").on("click", () => {
            // Send a signout request
            Authentication.signout(() => {
                Socket.disconnect()

                hide()
                SignInForm.show()
            })
        })
    }

    // This function shows the form with the user
    const show = function (user) {
        $("#user-panel").show()
        GameStats.startAutoRefresh()
    }

    // This function hides the form
    const hide = function () {
        $("#user-panel").hide()
        GameStats.stopAutoRefresh()
    }

    // This function updates the user panel
    const update = function (user) {
        if (user) {
            const wins = user.gameRecord?.wins || 0
            const losses = user.gameRecord?.losses || 0
            const totalGames = wins + losses
            const winRate =
                totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0

            $("#user-panel .user-name").text(user.username)
            $("#total-games").text(totalGames)
            $("#win-rate").text(winRate + "%")
        } else {
            $("#user-panel .user-name").text("")
            $("#total-games").text("0")
            $("#win-rate").text("0%")
        }
    }

    return { initialize, show, hide, update }
})()

const OnlineUsersPanel = (function () {
    // This function initializes the UI
    const initialize = function () {}

    const calculateWinRate = function (wins, losses) {
        const total = wins + losses
        return total > 0 ? Math.round((wins / total) * 100) : 0
    }

    const formatUserStats = function (wins, losses) {
        const winRate = calculateWinRate(wins, losses)
        return `Wins: ${wins} | Losses: ${losses} | Win Rate: ${winRate}%`
    }

    // This function updates the online users panel
    const update = function (onlineUsers) {
        const onlineUsersArea = $("#online-users-area")
        onlineUsersArea.empty()

        // Get the current user
        const currentUser = Authentication.getUser()

        // First add the current user
        if (currentUser) {
            const userDiv = $("<div></div>")
                .addClass("online-user")
                .addClass("current-user")
                .attr("id", "username-" + currentUser.username)

            const nameSpan = $("<span></span>")
                .addClass("user-name")
                .text(currentUser.username + " (You)")

            const recordSpan = $("<span></span>")
                .addClass("user-record")
                .text(
                    formatUserStats(
                        currentUser.gameRecord?.wins || 0,
                        currentUser.gameRecord?.losses || 0
                    )
                )

            userDiv.append(nameSpan).append(recordSpan)
            onlineUsersArea.append(userDiv)
        }

        // Then add other online users
        for (const username in onlineUsers) {
            if (username !== currentUser.username) {
                const userDiv = $("<div></div>")
                    .addClass("online-user")
                    .attr("id", "username-" + username)

                const nameSpan = $("<span></span>")
                    .addClass("user-name")
                    .text(onlineUsers[username].username)

                const recordSpan = $("<span></span>")
                    .addClass("user-record")
                    .text("Loading stats...")

                userDiv.append(nameSpan).append(recordSpan)
                onlineUsersArea.append(userDiv)

                // Fetch and update user stats
                GameStats.getStats(username)
                    .then((stats) => {
                        if (stats) {
                            recordSpan.text(
                                formatUserStats(stats.wins, stats.losses)
                            )
                        } else {
                            recordSpan.text("No stats available")
                        }
                    })
                    .catch((error) => {
                        console.error("Error fetching stats:", error.message)
                        recordSpan.text("Error loading stats")
                    })
            }
        }
    }

    // This function adds a user in the panel
    const addUser = function (user) {
        const onlineUsersArea = $("#online-users-area")

        // Find the user
        const userDiv = onlineUsersArea.find("#username-" + user.username)

        // Add the user
        if (userDiv.length == 0) {
            onlineUsersArea.append(
                $("<div id='username-" + user.username + "'></div>").append(
                    UI.getUserDisplay(user)
                )
            )
        }
    }

    // This function removes a user from the panel
    const removeUser = function (user) {
        const onlineUsersArea = $("#online-users-area")

        // Find the user
        const userDiv = onlineUsersArea.find("#username-" + user.username)

        // Remove the user
        if (userDiv.length > 0) userDiv.remove()
    }

    return { initialize, update, addUser, removeUser }
})()

const UI = (function () {
    // This function gets the user display
    const getUserDisplay = function (user) {
        return $("<div class='field-content row shadow'></div>").append(
            $("<span class='user-name'>" + user.username + "</span>")
        )
    }

    // The components of the UI are put here
    const components = [SignInForm, UserPanel, OnlineUsersPanel]

    // This function initializes the UI
    const initialize = function () {
        // Initialize the components
        for (const component of components) {
            component.initialize()
        }
    }

    return { getUserDisplay, initialize }
})()

const GameRecord = (function () {
    const update = function (won) {
        fetch("/updateGameRecord", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ won }),
        })
            .then((res) => res.json())
            .then((json) => {
                if (json.status === "success") {
                    const user = Authentication.getUser()
                    user.gameRecord = json.record
                    UserPanel.update(user)
                }
            })
    }

    return { update }
})()

const VenueSelector = (function () {
    let selectedVenue = "forest" // default venue

    const initialize = function () {
        $("#venue-overlay").hide()

        $("#select-venue").on("click", () => {
            $("#venue-overlay").fadeIn(500)
        })

        $("#close-venue").on("click", () => {
            $("#venue-overlay").fadeOut(500)
        })

        $(".venue-option").on("click", function () {
            $(".venue-option").removeClass("selected")
            $(this).addClass("selected")
            selectedVenue = $(this).data("venue")
        })
    }

    const getSelectedVenue = function () {
        return selectedVenue
    }

    return { initialize, getSelectedVenue }
})()
