const GameStats = (function () {
    let refreshInterval = null

    const getStats = function (username) {
        return fetch(`/getStats/${username}`, {
            method: "GET",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            credentials: "same-origin",
        })
            .then((res) => {
                if (!res.ok) {
                    if (res.status === 404) {
                        return { wins: 0, losses: 0 }
                    }
                    throw new Error(`HTTP error! status: ${res.status}`)
                }
                return res.json()
            })
            .then((json) => {
                if (json.status === "error") {
                    throw new Error(json.error)
                }
                return json.stats || { wins: 0, losses: 0 }
            })
    }

    const calculateWinRate = function (wins, losses) {
        const total = wins + losses
        if (total === 0) return 0
        return Math.round((wins / total) * 100)
    }

    const refreshStats = function () {
        // Clear existing stats first
        $(".user-record").text("Loading...")
        
        // Get fresh data from users.json
        fetch("/reloadStats", {
            method: "GET",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            credentials: "same-origin",
        })
        .then(res => res.json())
        .then(response => {
            if (response.status === "error") {
                throw new Error(response.error);
            }
            
            // Read fresh data directly from the server
            return fetch("/getStats/" + Authentication.getUser().username);
        })
        .then(res => res.json())
        .then(data => {
            if (data.status === "success") {
                const stats = data.stats;
                const winRate = calculateWinRate(stats.wins, stats.losses);
                
                // Update user panel stats
                $("#total-games").text(stats.wins + stats.losses);
                $("#win-rate").text(winRate + "%");
                $("#wins").text(stats.wins);
                $("#losses").text(stats.losses);
                
                // Update online users area
                const username = Authentication.getUser().username;
                const userRecord = $(`#username-${username} .user-record`);
                if (userRecord.length) {
                    userRecord.text(
                        `Wins: ${stats.wins} | Losses: ${stats.losses} | Win Rate: ${winRate}%`
                    );
                }
                
                // Trigger a UI refresh event
                $(document).trigger('stats-updated', [stats]);
            }
        })
        .catch((error) => {
            console.error("Error refreshing stats:", error);
            $(".user-record").text("Error loading stats");
            
            // Show error message to user
            const errorMessage = $("<div>")
                .addClass("error-message")
                .text("Failed to update stats")
                .fadeIn()
                .delay(3000)
                .fadeOut();
            
            $("#online-users-area").prepend(errorMessage);
        });
    }

    const startAutoRefresh = function () {
        if (refreshInterval) clearInterval(refreshInterval)
        refreshInterval = setInterval(refreshStats, 5000) // Refresh every 5 seconds
    }

    const stopAutoRefresh = function () {
        if (refreshInterval) {
            clearInterval(refreshInterval)
            refreshInterval = null
        }
    }

    return { refreshStats, startAutoRefresh, stopAutoRefresh }
})()
