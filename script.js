// DOM Elements
const welcomeScreen = document.getElementById('welcome-screen');
const settingsScreen = document.getElementById('settings-screen');
const gameScreen = document.getElementById('game-screen');
const welcomeStartBtn = document.getElementById('welcome-start-btn');
const settingsStartBtn = document.getElementById('settings-start-btn');
const adultToggle = document.getElementById('adult-toggle');
const readToggle = document.getElementById('read-toggle');
const languageSelect = document.getElementById('language-select');
const questionText = document.getElementById('question-text');
const questionCard = document.getElementById('question-card');
const speakButton = document.getElementById('speak-button');
const nextBtn = document.getElementById('next-btn');
const finishBtn = document.getElementById('finish-btn');
const bubblesContainer = document.getElementById('bubbles');

// Ultra-simple menu elements (iOS compatible)
const simpleBurger = document.getElementById('simple-burger');
const simpleDropdown = document.getElementById('simple-dropdown');
const howToPlayLink = document.getElementById('how-to-play-link');
const aboutUsLink = document.getElementById('about-us-link');
const joinCommunityLink = document.getElementById('join-community-link');
const howToPlayModal = document.getElementById('how-to-play-modal');
const aboutUsModal = document.getElementById('about-us-modal');
const joinCommunityModal = document.getElementById('join-community-modal');
const closeHowToPlay = document.getElementById('close-how-to-play');
const closeAboutUs = document.getElementById('close-about-us');
const closeJoinCommunity = document.getElementById('close-join-community');
const contactUsLink = document.getElementById('contact-us-link');

// Game state
let questions = [];
let filteredQuestions = [];
let currentQuestionIndex = -1;
let selectedLanguage = 'Question'; // Default to English
let includeAdult = false;
let readQuestion = true;
let speechSynthesisActive = false;
let menuOpen = false;

// RTL languages list
const rtlLanguages = ['Arabic', 'Arabic_translation', 'Hebrew', 'Hebrew_translation', 'Farsi', 'Farsi_translation'];

// Create bubbles for background animation
function createBubbles() {
    bubblesContainer.innerHTML = '';
    const numberOfBubbles = 50;
    
    for (let i = 0; i < numberOfBubbles; i++) {
        const bubble = document.createElement('div');
        bubble.classList.add('bubble');
        
        // Random properties
        const size = Math.random() * 60 + 10; // 10-70px
        const left = Math.random() * 100; // 0-100%
        const delay = Math.random() * 8; // 0-8s delay
        const duration = Math.random() * 8 + 8; // 8-16s duration
        
        // Set styles
        bubble.style.width = `${size}px`;
        bubble.style.height = `${size}px`;
        bubble.style.left = `${left}%`;
        bubble.style.animationDelay = `${delay}s`;
        bubble.style.animationDuration = `${duration}s`;
        
        bubblesContainer.appendChild(bubble);
    }
}

// --- Questions come from the published Google Sheet (CSV), live-editable ---
// Hala edits the Sheet; "Publish to web" serves this fixed CSV URL and the
// site picks up changes automatically. The bundled data.json is a snapshot
// FALLBACK so the game never breaks if the sheet is ever unreachable.
const QUESTIONS_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSDAXKkq_mhS3qNVCNygaRMWWifO4Zq9nPBwsmMTRJFat1ALAk79r_hxgKodxwq8ia-r8HSRGyPOBaP/pub?output=csv";

async function fetchQuestions() {
    const bust = `_=${new Date().getTime()}`;

    // 1) Live data from the published sheet
    try {
        const res = await fetch(`${QUESTIONS_CSV_URL}&${bust}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const parsed = csvToQuestions(await res.text());
        if (!parsed.length) throw new Error('no rows parsed');
        questions = parsed;
        populateLanguageDropdown();
        console.log(`Loaded ${questions.length} questions from the live sheet`);
        return questions;
    } catch (err) {
        console.warn('Live sheet unavailable — using bundled data.json:', err);
    }

    // 2) Fallback: the snapshot shipped with the site
    try {
        const res = await fetch(`./data.json?${bust}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        questions = await res.json();
        populateLanguageDropdown();
        console.log(`Loaded ${questions.length} questions from data.json (fallback)`);
        return questions;
    } catch (error) {
        console.error('Error fetching questions:', error);
        return [];
    }
}

// Convert published-sheet CSV text into the same object shape as data.json
// (adds a 1-based ID; coerces the Adult column to a real boolean).
function csvToQuestions(text) {
    const rows = parseCsv(text);
    if (rows.length < 2) return [];
    const headers = rows[0].map(h => h.trim());
    const out = [];
    for (let i = 1; i < rows.length; i++) {
        const cells = rows[i];
        if (cells.length === 1 && cells[0].trim() === '') continue; // blank line
        const obj = { ID: out.length + 1 };
        headers.forEach((h, j) => {
            const raw = cells[j] !== undefined ? cells[j] : '';
            obj[h] = (h === 'Adult') ? (String(raw).trim().toUpperCase() === 'TRUE') : raw;
        });
        if (obj.Question && String(obj.Question).trim() !== '') out.push(obj);
    }
    return out;
}

// RFC-4180 CSV parser: handles quoted fields, "" escapes, and commas or
// newlines inside quotes. Returns an array of string arrays.
function parseCsv(text) {
    const rows = [];
    let row = [], field = '', inQuotes = false;
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inQuotes) {
            if (c === '"') {
                if (text[i + 1] === '"') { field += '"'; i++; }
                else inQuotes = false;
            } else field += c;
        } else if (c === '"') {
            inQuotes = true;
        } else if (c === ',') {
            row.push(field); field = '';
        } else if (c === '\n') {
            row.push(field); rows.push(row); row = []; field = '';
        } else {
            field += c;
        }
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows;
}

// Populate language dropdown based on available translations
function populateLanguageDropdown() {
    // Clear existing options except English
    while (languageSelect.options.length > 1) {
        languageSelect.remove(1);
    }
    
    // Add language options based on available translations
    if (questions.length > 0) {
        const languageKeys = new Set();
        
        // Collect all potential language keys from all questions
        questions.forEach(question => {
            Object.keys(question).forEach(key => {
                if (key.endsWith('_translation') || 
                    (key !== 'Question' && key !== 'Adult' && key !== 'id' && 
                     !key.includes('_') && typeof question[key] === 'string')) {
                    languageKeys.add(key);
                }
            });
        });
                
        // Add each language to the dropdown
        languageKeys.forEach(key => {
            let displayName = key;
            let valueKey = key;
            
            // Format the display name
            if (key.endsWith('_translation')) {
                displayName = key.replace('_translation', '');
                valueKey = key;
            }
            
            // Capitalize the first letter
            displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1);
            
            // Create and add the option
            const option = document.createElement('option');
            option.value = valueKey;
            option.textContent = displayName;
            languageSelect.appendChild(option);
        });
    }
}

// Filter questions based on settings
function filterQuestions() {
    filteredQuestions = questions.filter(q => {
        // Filter by adult content
        if (!includeAdult && q.Adult) {
            return false;
        }
        
        // Check if selected language translation exists
        const key = selectedLanguage;
        if (key !== 'Question' && (!q[key] || q[key].trim() === '')) {
            return false;
        }
        
        return true;
    });
    
    // Shuffle questions
    shuffleArray(filteredQuestions);
    
    return filteredQuestions;
}

// Fisher-Yates shuffle algorithm
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Get next question
function getNextQuestion() {
    if (filteredQuestions.length === 0) {
        return null;
    }
    
    currentQuestionIndex = (currentQuestionIndex + 1) % filteredQuestions.length;
    return filteredQuestions[currentQuestionIndex];
}

// Display question
function displayQuestion(question) {
    if (!question) {
        questionText.textContent = "No more questions available. Game over!";
        return;
    }
    
    // Display question in selected language
    const questionContent = selectedLanguage === 'Question' 
        ? question.Question 
        : question[selectedLanguage];
    
    questionText.textContent = questionContent || question.Question; // Fallback to English if translation missing
    
    // Add RTL class for Arabic, Hebrew, and Farsi
    if (rtlLanguages.includes(selectedLanguage)) {
        questionText.classList.add('rtl');
    } else {
        questionText.classList.remove('rtl');
    }
    
    // Add celebration animation
    questionCard.classList.remove('celebrate');
    void questionCard.offsetWidth; // Trigger reflow
    questionCard.classList.add('celebrate');
    
    // Auto-read question if enabled
    if (readQuestion) {
        speakText(questionContent || question.Question);
    }
    
    // Check for overflow after displaying new question
    checkCardOverflow();
}

// Text-to-speech function
function speakText(text) {
    if (speechSynthesisActive) {
        window.speechSynthesis.cancel();
    }
    
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Set language based on selection
        if (selectedLanguage === 'Question') {
            utterance.lang = 'en-US';
        } else if (selectedLanguage === 'عربى_translation' || selectedLanguage === 'Arabic') {
            utterance.lang = 'ar-EG'; // Changed from ar-SA (Saudi) to ar-EG (Egyptian)
        } else if (selectedLanguage === 'فارسی_translation' || selectedLanguage === 'Farsi') {
            utterance.lang = 'fa-IR';
        } else if (selectedLanguage === 'French_translation') {
            utterance.lang = 'fr-FR';
        } else if (selectedLanguage === 'German_translation') {
            utterance.lang = 'de-DE';
        } else if (selectedLanguage === 'Español_translation') {
            utterance.lang = 'es-ES';
        } else if (selectedLanguage === 'Chinese_translation') {
            utterance.lang = 'zh-CN';
        } else if (selectedLanguage === 'Japanese_translation') {
            utterance.lang = 'ja-JP';
        } else if (selectedLanguage === 'Korean_translation') {
            utterance.lang = 'ko-KR';
        } else if (selectedLanguage === 'Russian_translation') {
            utterance.lang = 'ru-RU';
        } else if (selectedLanguage === 'Portuguese_translation') {
            utterance.lang = 'pt-PT';
        } else if (selectedLanguage === 'Italian_translation') {
            utterance.lang = 'it-IT';
        } else if (selectedLanguage === 'Hindi_translation') {
            utterance.lang = 'hi-IN';
        } else if (selectedLanguage === 'Turkish_translation') {
            utterance.lang = 'tr-TR';
        } else if (selectedLanguage === 'Dutch_translation') {
            utterance.lang = 'nl-NL';
        } else if (selectedLanguage === 'Polish_translation') {
            utterance.lang = 'pl-PL';
        } else if (selectedLanguage === 'Swedish_translation') {
            utterance.lang = 'sv-SE';
        } else if (selectedLanguage === 'Greek_translation') {
            utterance.lang = 'el-GR';
        } else if (selectedLanguage === 'Hebrew_translation') {
            utterance.lang = 'he-IL';
        } else {
            // Handle any other language format - extract language code from the key
            const langKey = selectedLanguage.replace('_translation', '').toLowerCase();
            const langMap = {
                'arabic': 'ar-EG', // Changed from ar-SA to ar-EG
                'arabic_translation': 'ar-EG', // Changed from ar-SA to ar-EG
                'farsi': 'fa-IR',
                'farsi_translation': 'fa-IR',
                'french': 'fr-FR',
                'german': 'de-DE',
                'spanish': 'es-ES',
                'chinese': 'zh-CN',
                'japanese': 'ja-JP',
                'korean': 'ko-KR',
                'russian': 'ru-RU',
                'portuguese': 'pt-PT',
                'italian': 'it-IT',
                'hindi': 'hi-IN',
                'turkish': 'tr-TR',
                'dutch': 'nl-NL',
                'polish': 'pl-PL',
                'swedish': 'sv-SE',
                'greek': 'el-GR',
                'hebrew': 'he-IL'
            };
            
            utterance.lang = langMap[langKey] || 'en-US'; // Default to English if unknown
        }
        
        speechSynthesisActive = true;
        
        utterance.onend = function() {
            speechSynthesisActive = false;
        };
        
        window.speechSynthesis.speak(utterance);
    }
}

// Check if card content is overflowing and add appropriate class
function checkCardOverflow() {
    if (questionCard && questionText) {
        // Check if content exceeds visible area
        if (questionText.scrollHeight > questionCard.clientHeight - 80) { // 80px buffer for padding
            questionCard.classList.add('overflow');
        } else {
            questionCard.classList.remove('overflow');
        }
    }
}

// Event Listeners for Game
welcomeStartBtn.addEventListener('click', function() {
    welcomeScreen.style.display = 'none';
    settingsScreen.style.display = 'block';
});

settingsStartBtn.addEventListener('click', function() {
    // Get settings
    includeAdult = adultToggle.checked;
    readQuestion = readToggle.checked;
    selectedLanguage = languageSelect.value;
    
    // Filter questions based on settings
    filterQuestions();
    
    // Display first question
    const firstQuestion = getNextQuestion();
    displayQuestion(firstQuestion);
    
    // Show game screen
    settingsScreen.style.display = 'none';
    gameScreen.style.display = 'flex';
});

nextBtn.addEventListener('click', function() {
    const nextQuestion = getNextQuestion();
    displayQuestion(nextQuestion);
});

speakButton.addEventListener('click', function() {
    if (currentQuestionIndex >= 0 && currentQuestionIndex < filteredQuestions.length) {
        const question = filteredQuestions[currentQuestionIndex];
        const questionContent = selectedLanguage === 'Question' 
            ? question.Question 
            : question[selectedLanguage];
        speakText(questionContent || question.Question);
    }
});

finishBtn.addEventListener('click', function() {
    // Reset game state
    currentQuestionIndex = -1;
    
    // Return to welcome screen
    gameScreen.style.display = 'none';
    welcomeScreen.style.display = 'block';
});

// Ultra-simple menu event handlers (iOS compatible)
// Toggle dropdown
simpleBurger.onclick = function() {
    if (menuOpen) {
        simpleDropdown.style.display = 'none';
        menuOpen = false;
    } else {
        simpleDropdown.style.display = 'block';
        menuOpen = true;
    }
};

// How to Play link
howToPlayLink.onclick = function(e) {
    e.preventDefault();
    howToPlayModal.style.display = 'block';
    simpleDropdown.style.display = 'none';
    menuOpen = false;
};

// About Us link
aboutUsLink.onclick = function(e) {
    e.preventDefault();
    aboutUsModal.style.display = 'block';
    simpleDropdown.style.display = 'none';
    menuOpen = false;
};

// Join Community link
joinCommunityLink.onclick = function(e) {
    e.preventDefault();
    joinCommunityModal.style.display = 'block';
    simpleDropdown.style.display = 'none';
    menuOpen = false;
};

// Close modals
closeHowToPlay.onclick = function(e) {
    e.preventDefault();
    howToPlayModal.style.display = 'none';
};

closeAboutUs.onclick = function(e) {
    e.preventDefault();
    aboutUsModal.style.display = 'none';
};

closeJoinCommunity.onclick = function(e) {
    e.preventDefault();
    joinCommunityModal.style.display = 'none';
};

// Close menu and modals when tapping elsewhere
document.addEventListener('click', function(e) {
    // Check if click is outside the burger and dropdown
    if (menuOpen && e.target !== simpleBurger && !simpleBurger.contains(e.target) && 
        e.target !== simpleDropdown && !simpleDropdown.contains(e.target)) {
        simpleDropdown.style.display = 'none';
        menuOpen = false;
    }
    
    // Check if click is on modal background (not content)
    if (e.target === howToPlayModal) {
        howToPlayModal.style.display = 'none';
    }
    if (e.target === aboutUsModal) {
        aboutUsModal.style.display = 'none';
    }
    if (e.target === joinCommunityModal) {
        joinCommunityModal.style.display = 'none';
    }
}, false);

// Initialize the game
window.addEventListener('DOMContentLoaded', async function() {
    createBubbles();
    await fetchQuestions();
    
    // Set up observers for overflow detection
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList' || mutation.type === 'characterData') {
                checkCardOverflow();
            }
        });
    });
    
    // Start observing the question text for changes
    if (questionText) {
        observer.observe(questionText, { 
            childList: true, 
            characterData: true,
            subtree: true
        });
    }
    
    // Ensure buttons are visible initially and after a short delay
    ensureButtonsVisible();
    
    // Run again after a delay to catch any issues
    setTimeout(ensureButtonsVisible, 500);
    setTimeout(ensureButtonsVisible, 1000);
    setTimeout(ensureButtonsVisible, 2000);
});

// Function to ensure buttons are always visible
function ensureButtonsVisible() {
    if (nextBtn && finishBtn) {
        // Force visibility CSS properties
        nextBtn.style.display = 'flex';
        nextBtn.style.visibility = 'visible';
        nextBtn.style.opacity = '1';
        nextBtn.style.zIndex = '9999';
        nextBtn.style.position = 'fixed';
        
        finishBtn.style.display = 'flex';
        finishBtn.style.visibility = 'visible';
        finishBtn.style.opacity = '1';
        finishBtn.style.zIndex = '9999';
        finishBtn.style.position = 'fixed';
        
        // Ensure proper positioning based on orientation
        if (window.matchMedia("(orientation: landscape)").matches) {
            nextBtn.style.bottom = '20px';
            nextBtn.style.right = '20px';
            
            finishBtn.style.top = '15px';
            finishBtn.style.left = '15px';
        } else {
            nextBtn.style.bottom = '30px';
            nextBtn.style.right = '30px';
            
            finishBtn.style.top = '20px';
            finishBtn.style.left = '20px';
        }
    }
}

// Check for overflow and button visibility on orientation change and resize
window.addEventListener('orientationchange', function() {
    checkCardOverflow();
    ensureButtonsVisible();
});

window.addEventListener('resize', function() {
    checkCardOverflow();
    ensureButtonsVisible();
});

// Recreate bubbles on resize
window.addEventListener('resize', function() {
    createBubbles();
});

// Initialize viewport for devices with notches
function setViewportForDevicesWithNotch() {
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
        viewport.content = "width=device-width, initial-scale=1.0, viewport-fit=cover";
    }
}

// Add this to the event listeners section (after the Join Community link handler)
// Contact Us link
contactUsLink.onclick = function(e) {
    // No need to prevent default since we want to use the native mailto: functionality
    // Just close the dropdown
    simpleDropdown.style.display = 'none';
    menuOpen = false;
};
// Call once at startup
setViewportForDevicesWithNotch();