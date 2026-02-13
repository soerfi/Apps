/**
 * TC Grüze Website
 * Authentication Script for Members Area
 * 
 * Security Note:
 * This client-side authentication uses SHA-256 hashing to hide the password from casual view.
 * However, FOR TRUE SECURITY, files should be protected server-side (e.g. .htaccess or backend auth).
 * Client-side checks can be bypassed by knowledgeable users.
 */

// SHA-256 Hash of "1978"
const CLUB_PASSWORD_HASH = '46635b56d3c7f0b7bb26adae2a1692debbfd145d4a0986a9137fe91e73e70360';

document.addEventListener('DOMContentLoaded', function () {
    initAuth();
});

/**
 * Initialize Authentication
 */
function initAuth() {
    // 1. Handle Login Form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        // If already logged in, redirect to dashboard immediately
        if (isLoggedIn()) {
            window.location.href = 'dashboard.html';
            return;
        }

        loginForm.addEventListener('submit', handleLogin);
        // Do NOT clear session here to allow persistent login during session
    }

    // 2. Protect Members-Only Pages
    const membersOnlyContent = document.querySelector('.members-only');
    if (membersOnlyContent) {
        if (!isLoggedIn()) {
            redirectToLogin();
        }
    }

    // 3. Handle Logout
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }

    // 4. Intercept Download Links (UX Protection)
    // Prevents accidental access to protected files if not logged in
    document.addEventListener('click', function (e) {
        const link = e.target.closest('a');
        if (link && link.href.includes('/downloads/') && !isLoggedIn()) {
            // Prevent download and redirect to login
            e.preventDefault();
            alert("Bitte logge dich ein, um Dokumente herunterzuladen.");
            redirectToLogin();
        }
    });

    // 5. Update UI based on auth state
    updateAuthUI();
}

/**
 * Update UI elements based on auth state
 */
function updateAuthUI() {
    const authLink = document.querySelector('.nav-auth-link'); // Helper if we add "Login/Logout" to nav
    if (authLink) {
        if (isLoggedIn()) {
            authLink.textContent = 'Logout';
            authLink.href = '#';
            authLink.addEventListener('click', (e) => {
                e.preventDefault();
                handleLogout();
            });
        } else {
            authLink.textContent = 'Members';
            authLink.href = '/pages/members/index.html';
        }
    }
}

/**
 * Handle Login
 */
async function handleLogin(e) {
    e.preventDefault();

    const passwordField = document.getElementById('password');
    if (!passwordField) return;

    const password = passwordField.value;

    if (!password) {
        showLoginError('Bitte geben Sie das Passwort ein.');
        return;
    }

    try {
        // Verify Password Hash
        const hash = await sha256(password);

        if (hash === CLUB_PASSWORD_HASH) {
            // Success
            setLoggedIn(true);
            window.location.href = 'dashboard.html';
        } else {
            // Failed
            showLoginError('Ungültiges Passwort.');
        }
    } catch (error) {
        console.error("Auth Error:", error);
        showLoginError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.');
    }
}

/**
 * Generate SHA-256 Hash
 */
async function sha256(message) {
    // Encode as UTF-8
    const msgBuffer = new TextEncoder().encode(message);
    // Hash the message
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    // Convert ArrayBuffer to Hex String
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Handle Logout
 */
function handleLogout() {
    setLoggedIn(false);
    window.location.href = '../../index.html';
}

/**
 * Show Error Message
 */
function showLoginError(message) {
    const errorElement = document.getElementById('login-error');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
}

/**
 * Check Login State
 * Uses sessionStorage (cleared when browser closes) instead of localStorage for better security
 */
function isLoggedIn() {
    return sessionStorage.getItem('isLoggedIn') === 'true';
}

/**
 * Set Login State
 */
function setLoggedIn(status) {
    if (status) {
        sessionStorage.setItem('isLoggedIn', 'true');
    } else {
        sessionStorage.removeItem('isLoggedIn');
    }
}

/**
 * Redirect to Login
 */
function redirectToLogin() {
    sessionStorage.setItem('tcgrueze_redirect', window.location.pathname);
    // Determine path to login page based on current location
    // Simply going to /pages/members/index.html works if absolute path is supported
    // Otherwise, we can try relative
    if (window.location.pathname.includes('/pages/members/')) {
        window.location.href = 'index.html';
    } else {
        window.location.href = '../../pages/members/index.html';
    }
}

