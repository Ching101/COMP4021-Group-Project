$(document).ready(function () {
    let playerResults = [];
    let currentPlayer;

    $('#main-menu').show();
    $('#lobby').hide();
    $('#game-over').hide();

    GameLobby.initialize();

    function simulatePlayers(num) {
        for (let i = 1; i <= num; i++) {
            let username = `Player${i}`;
            players.push(username);
            addPlayerResult(username);
        }
        updatePlayerList();
        $('#start-game-btn').prop('disabled', false);
    }

    function addPlayerResult(username) {
        const existingPlayer = playerResults.find(player => player.username === username);
        if (!existingPlayer) {
            playerResults.push({
                username: username,
                wins: 0,
                losses: 0,
                damageDealt: 0,
                powerUpsCollected: 0,
                survivalTime: 0
            });
            updateStartButton();
        }
    }

    // Game logic handlers
    $('#start-game-btn').on('click', function () {
        playRound();
    });

    function playRound() {
        const winnerIndex = Math.floor(Math.random() * playerResults.length);
        const winner = playerResults[winnerIndex];

        winner.wins += 1;
        playerResults.forEach((player, index) => {
            if (index !== winnerIndex) {
                player.losses += 1;
            }
        });

        // Update game record for the current user
        if (currentPlayer === winner.username) {
            GameRecord.update(true);
        } else {
            GameRecord.update(false);
        }

        displayResults();
        UserPanel.update(Authentication.getUser());
    }

    function displayResults() {
        playerResults.sort((a, b) => b.wins - a.wins);

        $('#rankings-list').empty();
        playerResults.forEach(player => {
            const userDisplay = UI.getUserDisplay({
                username: `${player.username}: ${player.wins} Wins, ${player.losses} Losses`
            });
            if (player.username === currentPlayer) {
                userDisplay.addClass('highlight');
            }
            $('#rankings-list').append($('<li>').append(userDisplay));
        });
    }

    // Authentication handlers
    $('#reg-form').on('submit', function (e) {
        e.preventDefault();
        const username = $('#reg-username').val();
        const password = $('#reg-password').val();

        Registration.register(
            username,
            password,
            () => {
                addPlayerResult(username);
                SignInForm.hide();
                UserPanel.show();
            },
            (error) => $('#reg-message').text(error)
        );
    });

    $('#login-form').on('submit', function (e) {
        e.preventDefault();
        const username = $('#login-username').val();
        const password = $('#login-password').val();

        Authentication.signin(
            username,
            password,
            () => {
                currentPlayer = username;
                addPlayerResult(currentPlayer);
                OnlineUsersPanel.update({ [currentPlayer]: true });
                SignInForm.hide();
                UserPanel.show();
            },
            (error) => $('#login-message').text(error)
        );
    });

    // Example of enabling/disabling the start button based on player count
    function updateStartButton() {
        const startButton = document.getElementById('start-game-btn');
        console.log('Player count:', playerResults.length); // Debug log
        if (playerResults.length >= 2) {
            startButton.disabled = false;
            console.log('Enabling button'); // Debug log
        } else {
            startButton.disabled = true;
            console.log('Disabling button'); // Debug log
        }
    }

    // Initialize music state
    document.addEventListener('DOMContentLoaded', function () {
        const musicButton = document.querySelector('.music-button');
        let isMusicPlaying = true;

        // Create audio elements for different pages
        const menuMusic = new Audio('music/Frontpage.mp3');
        const gameMusic = new Audio('msuic/Gamepage.mp3');
        const lobbyMusic = new Audio('music/Frontpage.mp3');

        // Set them to loop
        menuMusic.loop = true;
        gameMusic.loop = true;
        lobbyMusic.loop = true;

        // Function to stop all music
        function stopAllMusic() {
            menuMusic.pause();
            menuMusic.currentTime = 0;
            gameMusic.pause();
            gameMusic.currentTime = 0;
            lobbyMusic.pause();
            lobbyMusic.currentTime = 0;
        }

        // Function to handle music toggle
        function toggleMusic() {
            if (isMusicPlaying) {
                stopAllMusic();
            } else {
                // Play music based on current page
                if (window.location.pathname.includes('game')) {
                    gameMusic.play();
                } else if (window.location.pathname.includes('lobby')) {
                    lobbyMusic.play();
                } else {
                    menuMusic.play(); // Default to menu music
                }
            }
        }

        // Music button click handler
        musicButton.addEventListener('click', function () {
            this.classList.toggle('active');
            isMusicPlaying = !isMusicPlaying;
            toggleMusic();
        });

        // Initial music play
        toggleMusic();
    });

    // Add this to your existing JavaScript
    document.getElementById('start-game-btn').addEventListener('click', function () {
        // Hide the lobby
        document.querySelector('.lobby-container').style.display = 'none';

        // Show game over page
        document.getElementById('game-over-page').style.display = 'flex';

        // Update stats (you can modify these values based on actual game data)
        document.getElementById('damage-dealt').textContent = '150';
        document.getElementById('powerups-collected').textContent = '3';
        document.getElementById('survival-time').textContent = '45s';
    });

    // Handle Play Again button
    document.getElementById('play-again-btn').addEventListener('click', function () {
        // Reset game state and start a new game
        resetGameState();
        startNewGame();
    });

    // Handle Return to Lobby button
    document.getElementById('return-lobby-btn').addEventListener('click', function () {
        // Hide game over page
        document.getElementById('game-over-page').style.display = 'none';
        // Show lobby
        document.querySelector('.lobby-container').style.display = 'grid';
        // Reset any necessary game states
        resetGameState();
    });

    function resetGameState() {
        // Reset game statistics
        document.getElementById('damage-dealt').textContent = '0';
        document.getElementById('powerups-collected').textContent = '0';
        document.getElementById('survival-time').textContent = '0s';
        // Add any other game state resets needed
    }

    function startNewGame() {
        // Hide game over page
        document.getElementById('game-over-page').style.display = 'none';
        // Reset game elements and start new game
        // Add your game initialization logic here
    }

    // Handle Back to Menu button
    document.getElementById('back-to-menu-btn').addEventListener('click', function () {
        // Add your menu navigation logic here
        window.location.href = '/menu'; // Adjust the path as needed
    });
});