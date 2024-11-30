const SignInForm = (function () {
    // This function initializes the UI
    const initialize = function () {
        GameLobby.initialize()
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

        // Add stats update listener
        $(document).on('stats-updated', function(e, stats) {
            const user = Authentication.getUser();
            if (user) {
                user.gameRecord = stats;
                update(user);
                
                // Refresh the online users display
                const userDiv = $(`#username-${user.username}`);
                if (userDiv.length) {
                    userDiv.addClass('updated')
                        .delay(200)
                        .queue(function(next) {
                            $(this).removeClass('updated');
                            next();
                        });
                }
            }
        });
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
    const initialize = function () { }

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
                .text(currentUser.username)

            onlineUsersArea.append(userDiv)
        }

        // Then add other online users
        for (const username in onlineUsers) {
            if (username !== currentUser.username) {
                const userDiv = $("<div></div>")
                    .addClass("online-user")
                    .attr("id", "username-" + username)
                    .text(username)

                onlineUsersArea.append(userDiv)
            }
        }
    }

    // This function adds a user in the panel
    const addUser = function (user) {
        const onlineUsersArea = $("#online-users-area")
        const userDiv = onlineUsersArea.find("#username-" + user.username)

        if (userDiv.length == 0) {
            onlineUsersArea.append(
                $("<div></div>")
                    .addClass("online-user")
                    .attr("id", "username-" + user.username)
                    .text(user.username)
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

        // Add click handler for back to menu button
        $(".menu-button").on("click", () => {
            // Disconnect from socket
            Socket.disconnect()

            // Hide user panel
            UserPanel.hide()

            // Show signin form
            SignInForm.show()
        })

        initializeInstructionsPopup()
        initializeLeaderboard()
    }

    // Update the UI.initializeLeaderboard function
    function updateLeaderboard() {
        const socket = Socket.getSocket();
        if (!socket) {
            console.error('No socket connection available');
            return;
        }

        socket.emit('get_leaderboard', {}, (players) => {
            const leaderboardEntries = $('#leaderboard-entries');
            leaderboardEntries.empty();

            if (!players || players.length === 0) {
                leaderboardEntries.html('<div class="leaderboard-entry">No players found</div>');
                return;
            }

            // Sort players by win rate
            players.sort((a, b) => {
                const winRateA = (a.wins / (a.wins + a.losses)) * 100 || 0;
                const winRateB = (b.wins / (b.wins + b.losses)) * 100 || 0;
                return winRateB - winRateA;
            });

            // Add player entries
            players.forEach((player, index) => {
                const totalGames = player.wins + player.losses;
                const winRate = totalGames > 0 ? ((player.wins / totalGames) * 100).toFixed(1) : '0.0';
                
                const entry = $('<div></div>')
                    .addClass(`leaderboard-entry ${index < 3 ? `top-3 rank-${index + 1}` : ''}`)
                    .html(`
                        <span class="rank-col">#${index + 1}</span>
                        <span class="name-col">${player.username}</span>
                        <span class="stat-col">${totalGames}</span>
                        <span class="stat-col">${winRate}%</span>
                        <span class="stat-col">${player.wins}</span>
                        <span class="stat-col">${player.losses}</span>
                    `);
                
                leaderboardEntries.append(entry);
            });
        });
    }

    function initializeLeaderboard() {
        const $leaderboardBtn = $('#leaderboard-btn');
        const $leaderboardPopup = $('#leaderboard-popup');
        const $closeBtn = $leaderboardPopup.find('.close-popup');

        // Click handler for the leaderboard button
        $leaderboardBtn.on('click', () => {
            // Always fetch fresh data before showing the popup
            updateLeaderboard();
            $leaderboardPopup.fadeIn(300);
        });

        // Click handler for the close button
        $closeBtn.on('click', () => {
            $leaderboardPopup.fadeOut(300);
        });

        // Click handler for clicking outside the popup
        $(window).on('click', (event) => {
            if (event.target === $leaderboardPopup[0]) {
                $leaderboardPopup.fadeOut(300);
            }
        });
    }

    return { getUserDisplay, initialize, initializeLeaderboard }
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

const initializeInstructionsPopup = function () {
    const popup = document.getElementById('instructions-popup');
    const btn = document.getElementById('instructions-btn');
    const closeBtn = document.querySelector('.close-popup');

    btn.onclick = function () {
        popup.style.display = "block";
    }

    closeBtn.onclick = function () {
        popup.style.display = "none";
    }

    window.onclick = function (event) {
        if (event.target == popup) {
            popup.style.display = "none";
        }
    }
}

const GameLobby = (function () {
    const initialize = function () {
        // Event handler for the start button
        $('#start-game-btn').on('click', function () {
            // Only proceed if button is not disabled
            if (!$(this).hasClass('disabled')) {
                // Get the socket connection
                const socket = Socket.getSocket();
                if (!socket) {
                    console.error('No socket connection available');
                    return;
                }

                console.log('Emitting start_game_request with socket:', socket.id);
                socket.emit('start_game_request');

                $(this).prop('disabled', true);
                $(this).text('Starting game...');
            }
        });
    }

    return { initialize };
})();
