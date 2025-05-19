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
const currentScoresModal = document.getElementById('current-scores-modal');
const previousTournamentsDiv = document.getElementById('previous-tournaments');
const loadingOverlay = document.getElementById('loading-overlay');
const contentContainer = document.getElementById('content-container');
const currentLeaderboardDiv = document.getElementById('current-leaderboard');

// Initialize with auto-refresh
// Load data immediately when page loads
window.addEventListener('DOMContentLoaded', function() {
    // Set up score input formatting
    setupScoreInputFormatting();
    
    // Set up modal event listeners
    setupModalEventListeners();
    
    // Load the config, then load the data
    loadConfig().then(() => {
        loadData();
    }).catch(error => {
        console.error('Error loading config:', error);
        showMessage('Error loading configuration. Please refresh the page.', 'error');
        loadingOverlay.style.display = 'none';
        contentContainer.classList.add('content-loaded');
    });
});

// Set up modal event listeners
function setupModalEventListeners() {
    // Previous scores modal
    previousScoresBtn.addEventListener('click', function() {
        displayPreviousTournaments();
        previousModal.style.display = 'block';
    });
    
    closeModalBtn.addEventListener('click', function() {
        previousModal.style.display = 'none';
    });
    
    // Current scores modal
    const currentScoresBtn = document.getElementById('current-scores-btn');
    const currentScoresModal = document.getElementById('current-scores-modal');
    const currentCloseBtn = document.querySelector('.current-close');
    
    currentScoresBtn.addEventListener('click', function() {
        displayAllCurrentScores();
        currentScoresModal.style.display = 'block';
    });
    
    currentCloseBtn.addEventListener('click', function() {
        currentScoresModal.style.display = 'none';
    });
    
    // Close modals when clicking outside
    window.addEventListener('click', function(event) {
        if (event.target == previousModal) {
            previousModal.style.display = 'none';
        }
        if (event.target == currentScoresModal) {
            currentScoresModal.style.display = 'none';
        }
    });
}

// Set up score input formatting
function setupScoreInputFormatting() {
    // Add input event listener for formatting
    scoreInput.addEventListener('input', function(e) {
        // Get current cursor position
        const cursorPos = this.selectionStart;
        
        // Store the number of dots before the cursor
        const textBeforeCursor = this.value.substring(0, cursorPos);
        const dotsBeforeCursor = (textBeforeCursor.match(/\./g) || []).length;
        
        // Allow only numeric input
        let value = this.value.replace(/[^\d]/g, ''); // Remove all non-digits
        
        // Enforce 8 character limit
        if (value.length > 8) {
            value = value.substring(0, 8);
        }
        
        // Format with dots from right to left (proper thousand separators)
        const formattedValue = value.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        
        // Set the formatted value
        this.value = formattedValue;
        
        // Calculate new cursor position
        if (cursorPos > 0) {
            // Count dots in the new formatted text before where cursor was
            const newTextBeforeCursor = formattedValue.substring(0, cursorPos + (formattedValue.length - this.value.length));
            const newDotsBeforeCursor = (newTextBeforeCursor.match(/\./g) || []).length;
            
            // Adjust cursor position based on dots difference
            const dotsDiff = newDotsBeforeCursor - dotsBeforeCursor;
            const newCursorPos = cursorPos + dotsDiff;
            
            // Set cursor position
            this.setSelectionRange(newCursorPos, newCursorPos);
        }
    });
    
    // Prevent invalid keypress events (only allow numbers)
    scoreInput.addEventListener('keypress', function(e) {
        const charCode = (e.which) ? e.which : e.keyCode;
        
        // Allow only numeric input (0-9)
        if (charCode > 31 && (charCode < 48 || charCode > 57)) {
            e.preventDefault();
            return false;
        }
        
        // Also prevent if we've already reached 8 digits (excluding dots)
        const currentDigits = this.value.replace(/\./g, '').length;
        if (currentDigits >= 8) {
            e.preventDefault();
            return false;
        }
        
        return true;
    });
    
    // Handle paste events to ensure only numbers are pasted
    scoreInput.addEventListener('paste', function(e) {
        e.preventDefault();
        
        // Get pasted data
        let pastedText = '';
        if (window.clipboardData && window.clipboardData.getData) {
            // For IE
            pastedText = window.clipboardData.getData('Text');
        } else if (e.clipboardData && e.clipboardData.getData) {
            // For other browsers
            pastedText = e.clipboardData.getData('text/plain');
        }
        
        // Process pasted text to only keep numbers
        const numericText = pastedText.replace(/[^\d]/g, '').substring(0, 8);
        
        // Get current value without dots
        let currentValueNoFormat = this.value.replace(/\./g, '');
        
        // Insert at cursor position or replace selection
        if (this.selectionStart !== undefined) {
            const startPos = this.selectionStart;
            const endPos = this.selectionEnd;
            
            // Calculate new value respecting selection and max length
            const beforeSelection = currentValueNoFormat.substring(0, startPos);
            const afterSelection = currentValueNoFormat.substring(endPos);
            
            // Make sure we don't exceed 8 digits
            let newValueNoFormat = beforeSelection + numericText + afterSelection;
            if (newValueNoFormat.length > 8) {
                newValueNoFormat = newValueNoFormat.substring(0, 8);
            }
            
            // Format the value with dots
            const formattedValue = newValueNoFormat.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
            
            // Update the input
            this.value = formattedValue;
            
            // Calculate cursor position
            const newCursorPos = startPos + numericText.length;
            // Set cursor position - need to adjust for any dots that were added
            setTimeout(() => {
                // Count dots added before cursor position
                const newValueBeforeCursor = newValueNoFormat.substring(0, newCursorPos);
                const dotsAdded = (newValueBeforeCursor.match(/\B(?=(\d{3})+(?!\d))/g) || []).length;
                
                this.setSelectionRange(newCursorPos + dotsAdded, newCursorPos + dotsAdded);
            }, 0);
        } else {
            // Fallback for browsers without selection support
            let newValueNoFormat = numericText;
            if (newValueNoFormat.length > 8) {
                newValueNoFormat = newValueNoFormat.substring(0, 8);
            }
            
            this.value = newValueNoFormat.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        }
    });
}

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
            .sort((a, b) => b.score - a.score);
        
        // Top 3 for podium
        const podiumScores = CURRENT_SCORES.slice(0, 3);
        
        // Load tournament results
        const resultsResponse = await fetch(`${API_URL}?operation=getResults`);
        TOURNAMENTS = await resultsResponse.json();
        
        // Update the UI
        populatePlayers();
        updateCurrentTournament();
        displayCurrentLeaderboard(podiumScores);
        
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

// Format number with dots for display - proper formatting from right to left
function formatNumberWithDots(number) {
    // Convert to string and ensure it's a valid number
    if (!number && number !== 0) return '-';
    
    // Convert number to string
    const numStr = number.toString();
    
    // Format number with dots every 3 digits from the right
    // This uses a regex with look-ahead to add dots every 3 digits
    return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// Display current leaderboard
function displayCurrentLeaderboard(topScores) {
    // Clear existing content
    currentLeaderboardDiv.innerHTML = '';
    
    // Add title
    const title = document.createElement('h3');
    title.textContent = 'Current Tournament Leaderboard';
    currentLeaderboardDiv.appendChild(title);
    
    // Add the "Check all scores" button
    const checkScoresBtn = document.createElement('button');
    checkScoresBtn.id = 'current-scores-btn';
    checkScoresBtn.className = 'current-scores-button';
    checkScoresBtn.textContent = 'Check all scores';
    checkScoresBtn.addEventListener('click', function() {
        displayAllCurrentScores();
        document.getElementById('current-scores-modal').style.display = 'block';
    });
    currentLeaderboardDiv.appendChild(checkScoresBtn);
    
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
    
    // Use the topScores which are the top 3
    const displayScores = topScores || CURRENT_SCORES.slice(0, 3);
    
    // Fill in data for available positions
    if (displayScores.length >= 1) {
        const firstPlaceDiv = document.createElement('div');
        firstPlaceDiv.className = 'first-place';
        
        const firstPlaceNum = document.createElement('div');
        firstPlaceNum.className = 'podium-number';
        firstPlaceNum.textContent = '1';
        
        const firstPlaceName = document.createElement('div');
        firstPlaceName.className = 'podium-name';
        firstPlaceName.textContent = displayScores[0].name;
        
        const firstPlaceScore = document.createElement('div');
        firstPlaceScore.className = 'podium-score';
        firstPlaceScore.textContent = formatNumberWithDots(displayScores[0].score);
        
        firstPlaceDiv.appendChild(firstPlaceNum);
        firstPlaceDiv.appendChild(firstPlaceName);
        firstPlaceDiv.appendChild(firstPlaceScore);
        firstPlace.appendChild(firstPlaceDiv);
    }
    
    if (displayScores.length >= 2) {
        const secondPlaceDiv = document.createElement('div');
        secondPlaceDiv.className = 'second-place';
        
        const secondPlaceNum = document.createElement('div');
        secondPlaceNum.className = 'podium-number';
        secondPlaceNum.textContent = '2';
        
        const secondPlaceName = document.createElement('div');
        secondPlaceName.className = 'podium-name';
        secondPlaceName.textContent = displayScores[1].name;
        
        const secondPlaceScore = document.createElement('div');
        secondPlaceScore.className = 'podium-score';
        secondPlaceScore.textContent = formatNumberWithDots(displayScores[1].score);
        
        secondPlaceDiv.appendChild(secondPlaceNum);
        secondPlaceDiv.appendChild(secondPlaceName);
        secondPlaceDiv.appendChild(secondPlaceScore);
        secondPlace.appendChild(secondPlaceDiv);
    }
    
    if (displayScores.length >= 3) {
        const thirdPlaceDiv = document.createElement('div');
        thirdPlaceDiv.className = 'third-place';
        
        const thirdPlaceNum = document.createElement('div');
        thirdPlaceNum.className = 'podium-number';
        thirdPlaceNum.textContent = '3';
        
        const thirdPlaceName = document.createElement('div');
        thirdPlaceName.className = 'podium-name';
        thirdPlaceName.textContent = displayScores[2].name;
        
        const thirdPlaceScore = document.createElement('div');
        thirdPlaceScore.className = 'podium-score';
        thirdPlaceScore.textContent = formatNumberWithDots(displayScores[2].score);
        
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

// Display all current scores in the modal
function displayAllCurrentScores() {
    const currentScoresListDiv = document.getElementById('current-scores-list');
    currentScoresListDiv.innerHTML = '';
    
    if (CURRENT_SCORES.length === 0) {
        const noScoresMsg = document.createElement('p');
        noScoresMsg.textContent = 'No scores submitted yet for this tournament.';
        currentScoresListDiv.appendChild(noScoresMsg);
        return;
    }
    
    // Add tournament info
    const tournamentInfo = document.createElement('p');
    tournamentInfo.innerHTML = `<strong>Current Tournament:</strong> Week ${CURRENT_TOURNAMENT.week} - ${CURRENT_TOURNAMENT.period}`;
    tournamentInfo.style.textAlign = 'center';
    tournamentInfo.style.marginBottom = '20px';
    currentScoresListDiv.appendChild(tournamentInfo);
    
    // Create list to display all scores
    const scoresList = document.createElement('ul');
    scoresList.className = 'runner-list';
    
    // Add each player's score to the list
    CURRENT_SCORES.forEach((player, index) => {
        const listItem = document.createElement('li');
        
        const position = document.createElement('span');
        position.className = 'runner-position';
        position.textContent = `${index + 1}.`;
        
        const name = document.createElement('span');
        name.textContent = player.name;
        
        const score = document.createElement('span');
        score.className = 'runner-score';
        score.textContent = formatNumberWithDots(player.score);
        
        listItem.appendChild(position);
        listItem.appendChild(name);
        listItem.appendChild(score);
        
        scoresList.appendChild(listItem);
    });
    
    currentScoresListDiv.appendChild(scoresList);
}

// Display latest tournament results
function displayLatestResults() {
    if (TOURNAMENTS.length === 0) {
        // No tournaments yet
        lastTournamentTitle.textContent = "No previous tournament results yet";
        return;
    }
    
    const latestTournament = TOURNAMENTS[0]; // First tournament is the latest
    
    // Check if the latest tournament has any results
    if (!latestTournament.results || latestTournament.results.length === 0) {
        lastTournamentTitle.textContent = "No previous tournament results yet";
        return;
    }
    
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
    
    // Display available results with formatted scores
    topResults.forEach((result, index) => {
        const formattedScore = formatNumberWithDots(result.score);
        
        switch (index) {
            case 0: // 1st place
                document.getElementById('first-place-name').textContent = result.name;
                document.getElementById('first-place-score').textContent = formattedScore;
                break;
            case 1: // 2nd place
                document.getElementById('second-place-name').textContent = result.name;
                document.getElementById('second-place-score').textContent = formattedScore;
                break;
            case 2: // 3rd place
                document.getElementById('third-place-name').textContent = result.name;
                document.getElementById('third-place-score').textContent = formattedScore;
                break;
            case 3: // 4th place
                document.getElementById('fourth-place-name').textContent = result.name;
                document.getElementById('fourth-place-score').textContent = formattedScore;
                break;
            case 4: // 5th place
                document.getElementById('fifth-place-name').textContent = result.name;
                document.getElementById('fifth-place-score').textContent = formattedScore;
                break;
            case 5: // 6th place
                document.getElementById('sixth-place-name').textContent = result.name;
                document.getElementById('sixth-place-score').textContent = formattedScore;
                break;
        }
    });
}

// Form submission
submitBtn.addEventListener('click', async function() {
    const player = playerSelect.value;
    const scoreFormatted = scoreInput.value.replace(/\./g, ''); // Remove dots for processing
    const score = parseInt(scoreFormatted);
    
    if (!player) {
        showMessage('Please select your name', 'error');
        return;
    }
    
    if (!scoreFormatted || isNaN(score) || score <= 0) {
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
        // Submit to Google Sheets API (send score without formatting)
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
                score.textContent = formatNumberWithDots(result.score);
                
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