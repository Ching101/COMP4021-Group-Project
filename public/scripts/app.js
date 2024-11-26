$(document).ready(function() {
    let players = []; 
    let playerResults = []; 
    let currentPlayer; 

    $('#main-menu').show();
    $('#lobby').hide();
    $('#game-over').hide();

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
            playerResults.push({ username: username, wins: 0, losses: 0, damageDealt: 0, powerUpsCollected: 0, survivalTime: 0 });
        }
    }

    simulatePlayers(3); 

    $('#start-game-btn').on('click', function() {
        $('#lobby').hide();
        $('#game-over').show();
        playRound(); 
    });

    function playRound() {
        const winnerIndex = Math.floor(Math.random() * playerResults.length);
        const winner = playerResults[winnerIndex];

        winner.wins += 1; 
        playerResults.forEach((player, index) => {
            if (index !== winnerIndex) {
                player.losses += 1; 
                $('#defeat-animation').show();
            }
        });

        displayResults();
        displayYourResults(); 
        updateYourCharacter();

        $('#play-again-btn').show(); 
        $('#victory-animation').show(); 
    }

    function displayResults() {
        playerResults.sort((a, b) => b.wins - a.wins);
    
        $('#rankings-list').empty(); 
        playerResults.forEach(player => {
            const highlightClass = (player.username === currentPlayer) ? 'highlight' : '';
            $('#rankings-list').append(`<li>${highlightClass ? `<span class="${highlightClass}">${player.username}: ${player.wins} Wins, ${player.losses} Losses</span>` : `${player.username}: ${player.wins} Wins, ${player.losses} Losses`}</li>`);
        });
    
        if (currentPlayer) {
            const yourResults = playerResults.find(player => player.username === currentPlayer);
            if (yourResults) {
                $('#final-wins').text(yourResults.wins);
                $('#final-losses').text(yourResults.losses);
                $('#damage-dealt').text(yourResults.damageDealt);
                $('#power-ups-collected').text(yourResults.powerUpsCollected);
                $('#survival-time').text(yourResults.survivalTime);
            }
        }
    
        $('#result-animation').show();
        $('#victory-animation').show(); 
        $('#defeat-animation').hide(); 
    }
    
    function endGame() {
        playerResults.forEach(player => {
            player.damageDealt = Math.floor(Math.random() * 100); 
            player.powerUpsCollected = Math.floor (Math.random() * 5); 
            player.survivalTime = Math.floor(Math.random() * 300); 
        });
    
        displayResults(); 
        $('#game-over').show(); 
    }

    function displayYourResults() {
        if (currentPlayer) {
            const yourResults = playerResults.find(player => player.username === currentPlayer);
            if (yourResults) {
                $('#final-wins').text(yourResults.wins);
                $('#final-losses').text(yourResults.losses);
            }
        }
    }

    function updateYourCharacter() {
        if (currentPlayer) {
            const yourResults = playerResults.find(player => player.username === currentPlayer);
            if (yourResults) {
                $('#wins').text(yourResults.wins);
                $('#losses').text(yourResults.losses);
            }
        }
    }

    $('#reg-form').on('submit', function(e) {
        e.preventDefault();
        const username = $('#reg-username').val();
        const password = $('#reg-password').val();
        if (password.length >= 8 && /\d/.test(password)) {
            $('#reg-message').text('Registration successful! You can now log in.');
            $('#reg-form')[0].reset();
            addPlayerResult(username); 
        } else {
            $('#reg-message').text('Password must be at least 8 characters long and include numbers.');
        }
    });

    $('#login-form').on('submit', function(e) {
        e.preventDefault();
        currentPlayer = $('#login-username').val(); 
        const password = $('#login-password').val();
        players.push(currentPlayer);
        addPlayerResult(currentPlayer); 
        $('#login-message').text('');
        $('#main-menu').hide();
        $('#lobby').show();
        updatePlayerList();
        displayYourResults(); 
    });

    function updatePlayerList() {
        $('#player-list').empty();
        players.forEach(player => {
            const highlightClass = (player === currentPlayer) ? 'highlight' : '';
            $('#player-list').append(`<li>${highlightClass ? `<span class="${highlightClass}">${player}</span>` : player}</li>`);
        });
    }

    $('#play-again-btn').on('click', function() {
        $('#game-over').show();
        $('#lobby').hide();
        $('#rankings-list').empty(); 
        $('#play-again-btn').hide(); 
        playRound(); 
    });

    $('#return-lobby-btn').on('click', function() {
        $('#game-over').hide();
        $('#lobby').show();
    });

    $('#back-to-menu-btn').on('click', function() {
        $('#lobby').hide();
        $('#main-menu').show();
    });

    $('#back-to-menu-btn-2').on('click', function() {
        $('#game-over').hide();
        $('#main-menu').show();
    });
});