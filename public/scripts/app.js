$(document).ready(function() {
    // Create all sounds at the start
    const sounds = {
        background: new Audio('/assets/music/Frontpage.mp3')
    };
    sounds.background.loop = true;
    
    const musicButton = document.querySelector('.music-button');
    
    // Start with button in inactive state
    musicButton.className = 'music-button inactive';
    
    musicButton.addEventListener('click', () => {
        // Toggle button states
        musicButton.classList.toggle('active');
        musicButton.classList.toggle('inactive');
        
        // Toggle music
        if (musicButton.classList.contains('active')) {
            sounds.background.play().catch(error => console.log("Audio play failed:", error));
        } else {
            sounds.background.pause();
        }
        
        // Debug
        // console.log('Current classes:', musicButton.className);
    });

    // Handle Start Game button
    $('#start-game-btn').on('click', function() {
        // Hide lobby container
        $('.lobby-container').hide();
        
        // Show game container
        $('#gameContainer').show();
        
        // Initialize and start the game
        startGame();
    });

    let playerResults = []; 
    let currentPlayer;

    // Initialize UI components
    UI.initialize();

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
    $('#start-game-btn').on('click', function() {
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
    $('#reg-form').on('submit', function(e) {
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

    $('#login-form').on('submit', function(e) {
        e.preventDefault();
        const username = $('#login-username').val();
        const password = $('#login-password').val();
        
        Authentication.signin(
            username,
            password,
            () => {
                currentPlayer = username;
                addPlayerResult(currentPlayer);
                OnlineUsersPanel.update({[currentPlayer]: true});
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

    // Handle Start Game button
    document.getElementById('start-game-btn').addEventListener('click', function() {
        // Hide lobby container
        document.querySelector('.lobby-container').style.display = 'none';
        
        // Show game container (if you have one)
        const gameContainer = document.getElementById('gameContainer');
        if (gameContainer) {
            gameContainer.style.display = 'block';
        }
        
        // Initialize game from your existing game.js
        if (typeof initGame === 'function') {
            startGame();
        }
    });

    // Handle Play Again button
    document.getElementById('play-again-btn').addEventListener('click', function() {
        // Reset game state and start a new game
        resetGameState();
        startNewGame();
    });

    // Handle Return to Lobby button
    document.getElementById('return-lobby-btn').addEventListener('click', function() {
        // Hide game over page
        document.getElementById('game-over-page').style.display = 'none';
        
        // Show lobby container
        document.querySelector('.lobby-container').style.display = 'grid';
        
        // Reset game state
        resetGameState();
        
        // Re-enable start game button if needed
        const startGameBtn = document.getElementById('start-game-btn');
        if (startGameBtn) {
            startGameBtn.disabled = false;
        }
    });

    function resetGameState() {
        // Reset game statistics
        document.getElementById('damage-dealt').textContent = '0';
        document.getElementById('powerups-collected').textContent = '0';
        document.getElementById('survival-time').textContent = '0s';
        
        // Reset any other game states or variables here
        // For example:
        playerResults = playerResults.map(player => ({
            ...player,
            damageDealt: 0,
            powerUpsCollected: 0,
            survivalTime: 0
        }));
    }
});