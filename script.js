// script.js

// API URL will be loaded from config.js
let API_URL = null;

// Data variables (will be populated from Google Sheets)
let PLAYERS = [];
let TOURNAMENTS = [];
let CURRENT_TOURNAMENT = null;
let CURRENT_SCORES = [];

// DOM elements
const playerSelect = document.getElementById('player-select');
const scoreInput = document.getElementById('score-input');
const submitBtn = document.getElementById('submit-btn');
const messageDiv = document.getElementById('message');
const currentTournamentDiv = document.getElementById('current-tournament');
const countdownDiv = document.getElementById('countdown');
const lastTournamentTitle = document.getElementById('last-tournament-title');
const previousScoresBtn = document.getElementById('previous-scores-btn');
const previousModal = document.getElementById('previous-modal');
const closeModalBtn = document.querySelector('.close');
const previousTournamentsDiv = document.getElementById('previous-tournaments');
const loadingOverlay = document.getElementById('loading-overlay');
const contentContainer = document.getElementById('content-container');
const currentLeaderboardDiv = document.getElementById('current-leaderboard');

// Initialize with auto-refresh
// Load data immediately when page loads
window.addEventListener('DOMContentLoaded', function() {
    // First load the config, then load the data
    loadConfig().then(() => {
        loadData();
    }).catch(error => {
        console.error('Error loading config:', error);
        showMessage('Error loading configuration. Please refresh the page.', 'error');
        loadingOverlay.style.display = 'none';
        contentContainer.classList.add('content-loaded');
    });
});

// Load API URL from config.js
async function loadConfig() {
    try {
        // Wait for the config script to load and execute
        if (typeof CONFIG_API_URL !== 'undefined') {
            API_URL = CONFIG_API_URL;
            console.log('Loaded API URL from config:', API_URL);
            return Promise.resolve();
        } else {
            // If not loaded yet, wait a bit and try again
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    if (typeof CONFIG_API_URL !== 'undefined') {
                        API_URL = CONFIG_API_URL;
                        console.log('Loaded API URL from config:', API_URL);
                        resolve();
                    } else {
                        reject(new Error('Could not load API URL from config'));
                    }
                }, 500);
            });
        }
    } catch (error) {
        console.error('Error loading config:', error);
        return Promise.reject(error);
    }
}

// Refresh button
document.getElementById('refresh-btn').addEventListener('click', function() {
    loadData();
});

// Load all data from Google Sheets
async function loadData() {
    try {
        // Show loading overlay
        loadingOverlay.style.display = 'flex';
        contentContainer.classList.remove('content-loaded');
        
        // Make sure we have the API URL
        if (!API_URL) {
            await loadConfig();
        }
        
        // Load current tournament
        const tournamentResponse = await fetch(`${API_URL}?operation=getCurrentTournament`);
        CURRENT_TOURNAMENT = await tournamentResponse.json();
        
        // Convert the endDate string to a Date object for easier comparison
        CURRENT_TOURNAMENT.endDate = new Date(CURRENT_TOURNAMENT.endDate);
        
        // Load players
        const playersResponse = await fetch(`${API_URL}?operation=getPlayers`);
        const playersData = await playersResponse.json();
        PLAYERS = playersData.map(player => player.name);
        
        // Get current scores for the leaderboard
        CURRENT_SCORES = playersData
            .filter(player => player.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 3); // Get top 3 for podium
        
        // Load tournament results
        const resultsResponse = await fetch(`${API_URL}?operation=getResults`);
        TOURNAMENTS = await resultsResponse.json();
        
        // Update the UI
        populatePlayers();
        updateCurrentTournament();
        displayCurrentLeaderboard();
        
        // Only display results if there are tournaments
        if (TOURNAMENTS.length > 0) {
            displayLatestResults();
        } else {
            document.getElementById('last-tournament-title').textContent = "No previous tournament results yet";
        }
        
        // Hide loading overlay and show content with animation
        setTimeout(() => {
            loadingOverlay.style.display = 'none';
            contentContainer.classList.add('content-loaded');
        }, 500);
        
        console.log("Current tournament data:", CURRENT_TOURNAMENT);
        console.log("Current scores:", CURRENT_SCORES);
    } catch (error) {
        console.error('Error loading data:', error);
        showMessage('Error loading data. Please refresh the page.', 'error');
        
        // Hide loading overlay even on error
        loadingOverlay.style.display = 'none';
        contentContainer.classList.add('content-loaded');
    }
}

// Populate player dropdown
function populatePlayers() {
    // Clear existing options except the default one
    while (playerSelect.options.length > 1) {
        playerSelect.remove(1);
    }
    
    // Add players to dropdown
    PLAYERS.forEach(player => {
        const option = document.createElement('option');
        option.value = player;
        option.textContent = player;
        playerSelect.appendChild(option);
    });
}

// Update current tournament info
function updateCurrentTournament() {
    if (!CURRENT_TOURNAMENT) return;
    
    // Format the current tournament info
    currentTournamentDiv.textContent = `Week ${CURRENT_TOURNAMENT.week} – ${CURRENT_TOURNAMENT.period}`;
    
    // Set up countdown
    updateCountdown();
    
    // Update countdown every second
    setInterval(updateCountdown, 1000);
}

// Update countdown timer
function updateCountdown() {
    if (!CURRENT_TOURNAMENT) return;
    
    const now = new Date();
    const endDate = new Date(CURRENT_TOURNAMENT.endDate);
    const timeLeft = endDate - now;
    
    if (timeLeft <= 0) {
        countdownDiv.textContent = "Tournament ended";
        
        // Reload data if tournament has ended
        if (timeLeft > -60000 && timeLeft <= 0) { // Within a minute of ending
            loadData(); // Reload to get new tournament
        }
        return;
    }
    
    // Calculate days, hours, minutes, seconds
    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
    
    countdownDiv.textContent = `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

// Display current leaderboard
function displayCurrentLeaderboard() {
    // Clear existing content
    currentLeaderboardDiv.innerHTML = '';
    
    // Add title
    const title = document.createElement('h3');
    title.textContent = 'Current Tournament Leaderboard';
    currentLeaderboardDiv.appendChild(title);
    
    if (CURRENT_SCORES.length === 0) {
        const noScoresMsg = document.createElement('p');
        noScoresMsg.textContent = 'No scores submitted yet for this tournament';
        noScoresMsg.style.textAlign = 'center';
        currentLeaderboardDiv.appendChild(noScoresMsg);
        return;
    }
    
    // Create mini podium for current tournament
    const podiumDiv = document.createElement('div');
    podiumDiv.className = 'podium';
    
    // Create placeholders for all positions
    const secondPlace = document.createElement('div');
    secondPlace.className = 'podium-place';
    
    const firstPlace = document.createElement('div');
    firstPlace.className = 'podium-place';
    
    const thirdPlace = document.createElement('div');
    thirdPlace.className = 'podium-place';
    
    // Fill in data for available positions
    if (CURRENT_SCORES.length >= 1) {
        const firstPlaceDiv = document.createElement('div');
        firstPlaceDiv.className = 'first-place';
        
        const firstPlaceNum = document.createElement('div');
        firstPlaceNum.className = 'podium-number';
        firstPlaceNum.textContent = '1';
        
        const firstPlaceName = document.createElement('div');
        firstPlaceName.className = 'podium-name';
        firstPlaceName.textContent = CURRENT_SCORES[0].name;
        
        const firstPlaceScore = document.createElement('div');
        firstPlaceScore.className = 'podium-score';
        firstPlaceScore.textContent = CURRENT_SCORES[0].score;
        
        firstPlaceDiv.appendChild(firstPlaceNum);
        firstPlaceDiv.appendChild(firstPlaceName);
        firstPlaceDiv.appendChild(firstPlaceScore);
        firstPlace.appendChild(firstPlaceDiv);
    }
    
    if (CURRENT_SCORES.length >= 2) {
        const secondPlaceDiv = document.createElement('div');
        secondPlaceDiv.className = 'second-place';
        
        const secondPlaceNum = document.createElement('div');
        secondPlaceNum.className = 'podium-number';
        secondPlaceNum.textContent = '2';
        
        const secondPlaceName = document.createElement('div');
        secondPlaceName.className = 'podium-name';
        secondPlaceName.textContent = CURRENT_SCORES[1].name;
        
        const secondPlaceScore = document.createElement('div');
        secondPlaceScore.className = 'podium-score';
        secondPlaceScore.textContent = CURRENT_SCORES[1].score;
        
        secondPlaceDiv.appendChild(secondPlaceNum);
        secondPlaceDiv.appendChild(secondPlaceName);
        secondPlaceDiv.appendChild(secondPlaceScore);
        secondPlace.appendChild(secondPlaceDiv);
    }
    
    if (CURRENT_SCORES.length >= 3) {
        const thirdPlaceDiv = document.createElement('div');
        thirdPlaceDiv.className = 'third-place';
        
        const thirdPlaceNum = document.createElement('div');
        thirdPlaceNum.className = 'podium-number';
        thirdPlaceNum.textContent = '3';
        
        const thirdPlaceName = document.createElement('div');
        thirdPlaceName.className = 'podium-name';
        thirdPlaceName.textContent = CURRENT_SCORES[2].name;
        
        const thirdPlaceScore = document.createElement('div');
        thirdPlaceScore.className = 'podium-score';
        thirdPlaceScore.textContent = CURRENT_SCORES[2].score;
        
        thirdPlaceDiv.appendChild(thirdPlaceNum);
        thirdPlaceDiv.appendChild(thirdPlaceName);
        thirdPlaceDiv.appendChild(thirdPlaceScore);
        thirdPlace.appendChild(thirdPlaceDiv);
    }
    
    // Add all podium places in correct order
    podiumDiv.appendChild(secondPlace);
    podiumDiv.appendChild(firstPlace);
    podiumDiv.appendChild(thirdPlace);
    
    currentLeaderboardDiv.appendChild(podiumDiv);
}

// Display latest tournament results
function displayLatestResults() {
    if (TOURNAMENTS.length === 0) {
        // No tournaments yet
        lastTournamentTitle.textContent = "No previous tournament results yet";
        return;
    }
    
    const latestTournament = TOURNAMENTS[0]; // First tournament is the latest
    
    lastTournamentTitle.textContent = `Tournament Results for Week ${latestTournament.week} ${latestTournament.period}`;
    
    // Sort results by rank
    latestTournament.results.sort((a, b) => a.rank - b.rank);
    
    // Get top 6 results or fewer if not enough
    const topResults = latestTournament.results.slice(0, 6);
    
    // Reset all places first
    document.getElementById('first-place-name').textContent = "-";
    document.getElementById('first-place-score').textContent = "-";
    document.getElementById('second-place-name').textContent = "-";
    document.getElementById('second-place-score').textContent = "-";
    document.getElementById('third-place-name').textContent = "-";
    document.getElementById('third-place-score').textContent = "-";
    document.getElementById('fourth-place-name').textContent = "-";
    document.getElementById('fourth-place-score').textContent = "-";
    document.getElementById('fifth-place-name').textContent = "-";
    document.getElementById('fifth-place-score').textContent = "-";
    document.getElementById('sixth-place-name').textContent = "-";
    document.getElementById('sixth-place-score').textContent = "-";
    
    // Display available results
    topResults.forEach((result, index) => {
        switch (index) {
            case 0: // 1st place
                document.getElementById('first-place-name').textContent = result.name;
                document.getElementById('first-place-score').textContent = result.score;
                break;
            case 1: // 2nd place
                document.getElementById('second-place-name').textContent = result.name;
                document.getElementById('second-place-score').textContent = result.score;
                break;
            case 2: // 3rd place
                document.getElementById('third-place-name').textContent = result.name;
                document.getElementById('third-place-score').textContent = result.score;
                break;
            case 3: // 4th place
                document.getElementById('fourth-place-name').textContent = result.name;
                document.getElementById('fourth-place-score').textContent = result.score;
                break;
            case 4: // 5th place
                document.getElementById('fifth-place-name').textContent = result.name;
                document.getElementById('fifth-place-score').textContent = result.score;
                break;
            case 5: // 6th place
                document.getElementById('sixth-place-name').textContent = result.name;
                document.getElementById('sixth-place-score').textContent = result.score;
                break;
        }
    });
}

// Form submission
submitBtn.addEventListener('click', async function() {
    const player = playerSelect.value;
    const score = parseInt(scoreInput.value);
    
    if (!player) {
        showMessage('Please select your name', 'error');
        return;
    }
    
    if (!score || isNaN(score) || score < 0) {
        showMessage('Please enter a valid score', 'error');
        return;
    }
    
    // Show loading overlay
    loadingOverlay.style.display = 'flex';
    contentContainer.classList.remove('content-loaded');
    
    // Disable button during submission
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
    
    try {
        // Submit to Google Sheets API
        const response = await fetch(`${API_URL}?operation=submitScore&player=${encodeURIComponent(player)}&score=${score}`, {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showMessage('Score submitted successfully!', 'success');
            
            // Clear form
            playerSelect.selectedIndex = 0;
            scoreInput.value = '';
            
            // Reload data to get updated scores
            await loadData();
        } else {
            showMessage(result.message, 'error');
            
            // Hide loading overlay even on error
            loadingOverlay.style.display = 'none';
            contentContainer.classList.add('content-loaded');
        }
    } catch (error) {
        console.error('Error submitting score:', error);
        showMessage('Error submitting score. Please try again.', 'error');
        
        // Hide loading overlay on error
        loadingOverlay.style.display = 'none';
        contentContainer.classList.add('content-loaded');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit';
    }
});

// Show message
function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';
    
    setTimeout(() => {
        messageDiv.style.display = 'none';
    }, 3000);
}

// Modal handling
previousScoresBtn.addEventListener('click', function() {
    displayPreviousTournaments();
    previousModal.style.display = 'block';
});

closeModalBtn.addEventListener('click', function() {
    previousModal.style.display = 'none';
});

window.addEventListener('click', function(event) {
    if (event.target == previousModal) {
        previousModal.style.display = 'none';
    }
});

// Display all previous tournaments
function displayPreviousTournaments() {
    previousTournamentsDiv.innerHTML = '';
    
    if (TOURNAMENTS.length === 0) {
        const noTournamentsMsg = document.createElement('p');
        noTournamentsMsg.textContent = 'No previous tournament results yet.';
        previousTournamentsDiv.appendChild(noTournamentsMsg);
        return;
    }
    
    TOURNAMENTS.forEach(tournament => {
        const tournamentDiv = document.createElement('div');
        tournamentDiv.className = 'previous-tournament';
        
        const title = document.createElement('h3');
        title.textContent = `Tournament Results for Week ${tournament.week} ${tournament.period}`;
        tournamentDiv.appendChild(title);
        
        if (tournament.results.length === 0) {
            const noResultsMsg = document.createElement('p');
            noResultsMsg.textContent = 'No results for this tournament.';
            tournamentDiv.appendChild(noResultsMsg);
        } else {
            const list = document.createElement('ul');
            list.className = 'runner-list';
            
            // Sort results by rank
            tournament.results.sort((a, b) => a.rank - b.rank);
            
            tournament.results.forEach((result, index) => {
                const listItem = document.createElement('li');
                
                const position = document.createElement('span');
                position.className = 'runner-position';
                position.textContent = `${index + 1}.`;
                
                const name = document.createElement('span');
                name.textContent = result.name;
                
                const score = document.createElement('span');
                score.className = 'runner-score';
                score.textContent = result.score;
                
                listItem.appendChild(position);
                listItem.appendChild(name);
                listItem.appendChild(score);
                
                list.appendChild(listItem);
            });
            
            tournamentDiv.appendChild(list);
        }
        
        previousTournamentsDiv.appendChild(tournamentDiv);
    });
}

// Set up periodic polling to check for tournament updates (every 5 minutes)
setInterval(async () => {
    if (!API_URL) return; // Skip if API URL is not loaded yet
    
    try {
        const response = await fetch(`${API_URL}?operation=getCurrentTournament`);
        const newTournament = await response.json();
        
        // Compare with current tournament
        if (CURRENT_TOURNAMENT && (
            CURRENT_TOURNAMENT.week !== newTournament.week || 
            CURRENT_TOURNAMENT.period !== newTournament.period
        )) {
            // Tournament has changed, reload all data
            loadData();
            showMessage('Tournament has been updated', 'success');
        }
    } catch (error) {
        console.error('Error checking for tournament updates:', error);
    }
}, 5 * 60 * 1000); // Check every 5 minutes