// utils.js

window.fetchStartTime = null;
window.fetchUpdateInterval = null;

window.updateElapsedTime = function () {
    if (!window.fetchStartTime) return;

    const now = new Date();
    const elapsed = Math.floor((now - window.fetchStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;

    document.getElementById('fetch-elapsed-time').textContent =
        `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

window.getDOMElements = function () {
    return {
        fetchAmountInput: document.getElementById('fetch-amount'),
        progressData: document.querySelector('.progress-data'),
        progressBar: document.getElementById('progress-bar'),
        emailsProcessed: document.getElementById('emails-processed'),
        totalEmails: document.getElementById('total-emails'),
        currentSpeed: document.getElementById('current-speed'),
        remainingEmails: document.getElementById('remaining-emails'),
        eta: document.getElementById('eta'),
        fetchButton: document.getElementById('fetch-button'),
        stopFetchButton: document.getElementById('stop-fetch-button'),
        fetchStartTimeDisplay: document.getElementById('fetch-start-time')
    };
};

window.initializeProgressUI = function (elements) {
    elements.progressData.style.display = 'block';
    elements.progressBar.value = 0;
    elements.emailsProcessed.textContent = '0';
    elements.totalEmails.textContent = '0';
    elements.currentSpeed.textContent = '0';
    elements.remainingEmails.textContent = '0';
    elements.eta.textContent = 'Calculating...';
    elements.progressBar.style.display = 'block';
    elements.fetchButton.disabled = true;
    elements.fetchButton.style.backgroundColor = 'grey';
    elements.stopFetchButton.style.display = 'inline-block';
};

window.startMetadataTracking = function (elements) {
    window.fetchStartTime = new Date();
    elements.fetchStartTimeDisplay.textContent = window.fetchStartTime.toLocaleTimeString('en-GB', { hour12: false });

    if (window.fetchUpdateInterval) {
        clearInterval(window.fetchUpdateInterval);
    }
    window.fetchUpdateInterval = setInterval(window.updateElapsedTime, 1000);
};

window.resetFetchUI = function () {
    const progressBar = document.getElementById('progress-bar');
    const fetchButton = document.getElementById('fetch-button');
    const stopFetchButton = document.getElementById('stop-fetch-button');

    fetchButton.disabled = false;
    fetchButton.style.backgroundColor = '#0077b5';
    stopFetchButton.style.display = 'none';

    if (window.fetchUpdateInterval) {
        clearInterval(window.fetchUpdateInterval);
    }
};

window.updateProgressUI = function (progressData, elements) {
    const processed = progressData.processed || progressData.emails_processed || 0;
    const total = progressData.total || progressData.total_emails || 0;
    const percentage = total > 0 ? (processed / total) * 100 : 0;

    elements.emailsProcessed.textContent = processed;
    elements.totalEmails.textContent = total;
    elements.progressBar.value = percentage.toFixed(2);

    elements.currentSpeed.textContent = progressData.current_speed
        ? progressData.current_speed.toFixed(2)
        : '0';
    elements.remainingEmails.textContent = progressData.remaining_emails || 0;

    if (progressData.eta_formatted) {
        // Parse the ISO date string and format it
        const etaDate = new Date(progressData.eta_formatted);
        elements.eta.textContent = etaDate.toLocaleTimeString('en-GB', { hour12: false });
    } else if (progressData.eta_seconds !== undefined) {
        // Use your existing function if eta in seconds is available
        elements.eta.textContent = window.formatCurrentTimePlusSeconds(progressData.eta_seconds);
    } else {
        elements.eta.textContent = 'Calculating...';
    }
};

window.handleFetchStatus = function (progressData, progressInterval, elements) {
    const status = progressData.status;

    if (status === 'completed') {
        clearInterval(progressInterval);
        window.resetFetchUI();
        alert('Emails fetched successfully!');
    } else if (status === 'aborted') {
        clearInterval(progressInterval);
        window.resetFetchUI();
        alert('Email fetching has been aborted.');
    } else if (status === 'error') {
        clearInterval(progressInterval);
        window.resetFetchUI();
        alert(`Error: ${progressData.error}`);
    }
};

window.formatCurrentTimePlusSeconds = function (seconds) {
    const now = new Date();
    const etaDate = new Date(now.getTime() + (seconds * 1000));
    return etaDate.toLocaleTimeString('en-GB', { hour12: false });
};

window.updateAuthUI = function (isAuthenticated) {
    const authContent = document.getElementById('auth-content');
    const fetchButton = document.getElementById('fetch-button');
    const generateChartButton = document.getElementById('generate-chart-button');

    if (isAuthenticated) {
        authContent.innerHTML = `
            <div class="auth-status">
                <p style="color: green; margin-bottom: 10px;">
                    <i class="fas fa-check-circle"></i> Successfully authenticated with Gmail
                </p>
                <button onclick="handleLogout()" class="logout-btn">
                    <i class="fas fa-sign-out-alt"></i> Logout
                </button>
            </div>
        `;

        if (fetchButton) {
            fetchButton.disabled = false;
            fetchButton.style.backgroundColor = '#0077b5';
            fetchButton.style.cursor = 'pointer';
        }
        if (generateChartButton) {
            generateChartButton.disabled = false;
            generateChartButton.style.backgroundColor = '#0077b5';
            generateChartButton.style.cursor = 'pointer';
        }
    } else {
        authContent.innerHTML = `
            <button id="auth-button" onclick="window.location.href='/auth/gmail'" class="auth-btn">
                <i class="fab fa-google"></i>
                Authenticate with Gmail
            </button>
        `;

        if (fetchButton) {
            fetchButton.disabled = true;
            fetchButton.style.backgroundColor = 'grey';
            fetchButton.style.cursor = 'not-allowed';
        }
        if (generateChartButton) {
            generateChartButton.disabled = true;
            generateChartButton.style.backgroundColor = 'grey';
            generateChartButton.style.cursor = 'not-allowed';
        }
    }
};

window.startEmailFetch = async function (amount) {
    console.log('Attempting to start fetching emails with amount:', amount);
    try {
        const response = await fetch(`${window.BACKEND_URL}/fetch_emails`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ amount }),
        });

        console.log('Received response:', response.status, response.statusText);

        if (!response.ok) {
            const errorDetails = await response.text();
            console.error('Failed to start fetching emails:', errorDetails);
            throw new Error(`Failed to start fetching emails: ${errorDetails}`);
        }

        const data = await response.json();
        console.log('Fetch emails response data:', data);
        return data.taskId;
    } catch (error) {
        console.error('Error in startEmailFetch:', error);
        throw error;
    }
};

window.pollFetchProgress = function (taskId, elements) {
    const backendUrl = window.BACKEND_URL || '/data';

    const progressInterval = setInterval(async () => {
        try {
            const progressResponse = await fetch(`${backendUrl}/fetch_progress/${taskId}`);
            if (!progressResponse.ok) {
                throw new Error(`Failed to fetch progress: server responded with status ${progressResponse.status}`);
            }

            const progressData = await progressResponse.json();

            if (progressData.error) {
                throw new Error(`Error from server: ${progressData.error}`);
            }

            window.updateProgressUI(progressData, elements);
            window.handleFetchStatus(progressData, progressInterval, elements);
        } catch (error) {
            console.error('Error fetching progress:', error);
            clearInterval(progressInterval);
            window.resetFetchUI();
            alert(`An error occurred while fetching progress: ${error.message}`);
        }
    }, 1000); // Poll every 1 second
};
