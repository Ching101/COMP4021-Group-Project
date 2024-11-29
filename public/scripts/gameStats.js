const GameStats = (function () {
    let refreshInterval = null;

    const refreshStats = async function () {
        try {
            // Check if user is logged in first
            const user = Authentication.getUser();
            if (!user) {
                console.log('No user logged in, skipping stats refresh');
                return;
            }

            // Clear existing stats first
            $(".user-record").text("Loading...");

            const response = await fetch('/reloadStats', {
                method: "GET",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                },
                credentials: "same-origin",
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.status === "error") {
                throw new Error(data.error);
            }

            // Only proceed if we have valid stats data
            if (data.stats) {
                const stats = data.stats;
                const winRate = calculateWinRate(stats.wins, stats.losses);
                
                // Update user panel stats
                $("#total-games").text(stats.wins + stats.losses);
                $("#win-rate").text(winRate + "%");
                $("#wins").text(stats.wins);
                $("#losses").text(stats.losses);
                
                // Update online users area
                const username = user.username;
                const userRecord = $(`#username-${username} .user-record`);
                if (userRecord.length) {
                    userRecord.text(
                        `Wins: ${stats.wins} | Losses: ${stats.losses} | Win Rate: ${winRate}%`
                    );
                }
                
                // Trigger a UI refresh event
                $(document).trigger('stats-updated', [stats]);
            }
        } catch (error) {
            console.log('Error refreshing stats:', error);
            $(".user-record").text("Error loading stats");
            
            // Show error message to user
            const errorMessage = $("<div>")
                .addClass("error-message")
                .text("Failed to update stats")
                .fadeIn()
                .delay(3000)
                .fadeOut();
            
            $("#online-users-area").prepend(errorMessage);
        }
    };

    const calculateWinRate = function (wins, losses) {
        const total = wins + losses;
        if (total === 0) return 0;
        return Math.round((wins / total) * 100);
    };

    const startAutoRefresh = function () {
        if (refreshInterval) clearInterval(refreshInterval);
        refreshInterval = setInterval(refreshStats, 5000); // Refresh every 5 seconds
    };

    const stopAutoRefresh = function () {
        if (refreshInterval) {
            clearInterval(refreshInterval);
            refreshInterval = null;
        }
    };

    return { refreshStats, startAutoRefresh, stopAutoRefresh };
})();