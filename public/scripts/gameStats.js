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

    const refreshStats = function () {
        const onlineUsersArea = $("#online-users-area")
        const users = onlineUsersArea.find(".online-user")

        users.each(function () {
            const username = $(this).attr("id")?.replace("username-", "")
            if (!username) return

            const recordSpan = $(this).find(".user-record")
            if (!recordSpan.length) return

            getStats(username)
                .then((stats) => {
                    if (stats) {
                        const winRate = calculateWinRate(
                            stats.wins,
                            stats.losses
                        )
                        recordSpan.text(
                            `Wins: ${stats.wins} | Losses: ${stats.losses} | Win Rate: ${winRate}%`
                        )

                        const currentUser = Authentication.getUser()
                        if (currentUser && username === currentUser.username) {
                            const totalGames = stats.wins + stats.losses
                            $("#total-games").text(totalGames)
                            $("#win-rate").text(winRate + "%")
                            $("#wins").text(stats.wins)
                            $("#losses").text(stats.losses)
                        }
                    }
                })
                .catch((error) => {
                    console.error(
                        "Error refreshing stats for",
                        username,
                        ":",
                        error
                    )
                })
        })
    }

    const calculateWinRate = function (wins, losses) {
        const total = wins + losses
        return total > 0 ? Math.round((wins / total) * 100) : 0
    }

    const startAutoRefresh = function () {
        if (refreshInterval) {
            clearInterval(refreshInterval)
        }
        refreshStats() // Initial refresh
        refreshInterval = setInterval(refreshStats, 2000)
    }

    const stopAutoRefresh = function () {
        if (refreshInterval) {
            clearInterval(refreshInterval)
            refreshInterval = null
        }
    }

    return { getStats, startAutoRefresh, stopAutoRefresh, refreshStats }
})()
