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
    });

    // Handle Start Game button
    $('#start-game-btn').on('click', function() {
        // Hide lobby container
        $('.lobby-container').hide();

        $('#game-over-page').show();
        
        // Show game container
        $('#gameContainer').show();
        
        // Initialize and start the game
        initGame();
    });

    // Handle Return to Lobby button
    $('#return-lobby-btn-2').on('click', function() {
        // Hide game over page
        $('#game-over-page').hide();
        
        // Hide game container
        $('#gameContainer').hide();
        
        // Show lobby container
        $('.lobby-container').show();
        
        // Reset game states
        resetGameState();
    });

    function resetGameState() {
        // Reset game statistics
        $('#damage-dealt').text('0');
        $('#powerups-collected').text('0');
        $('#survival-time').text('0s');
        
        // Reset any other game states or variables here
    }

    // Start auto-refreshing stats when in lobby
    GameStats.startAutoRefresh();

    // Stop refreshing when game starts
    Socket.on('game_started', () => {
        GameStats.stopAutoRefresh();
    });

    // Resume refreshing when returning to lobby
    $('#return-lobby-btn, #return-lobby-btn-2').on('click', () => {
        GameStats.startAutoRefresh();
    });

    // ... rest of your existing jQuery ready code ...
});