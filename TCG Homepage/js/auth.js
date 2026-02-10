/**
 * TC Grüze Website
 * Authentifizierungsskript für den Mitgliederbereich
 * 
 * Hinweis: Dies ist eine einfache clientseitige Authentifizierung für Demonstrationszwecke.
 * In einer Produktionsumgebung sollte eine serverseitige Authentifizierung implementiert werden.
 */

document.addEventListener('DOMContentLoaded', function () {
    // Initialisiere die Authentifizierungsfunktionalität
    initAuth();
});

/**
 * Initialisiere die Authentifizierungsfunktionalität
 */
function initAuth() {
    // Prüfe, ob wir auf der Login-Seite sind
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // Prüfe, ob wir auf einer geschützten Seite sind
    const membersOnlyContent = document.querySelector('.members-only');
    if (membersOnlyContent) {
        // Überprüfe, ob der Benutzer eingeloggt ist
        if (!isLoggedIn()) {
            // Wenn nicht eingeloggt, leite zur Login-Seite weiter
            redirectToLogin();
        }
    }

    // Logout-Button-Funktionalität
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }
}

/**
 * Behandelt den Login-Vorgang
 * @param {Event} e - Das Submit-Event des Formulars
 */
function handleLogin(e) {
    e.preventDefault();

    // Formularfelder abrufen
    const passwordField = document.getElementById('password');
    const usernameField = document.getElementById('username');

    // Check if this is password-only login (members area) or username+password login
    if (passwordField && !usernameField) {
        // Password-only login for members area
        const password = passwordField.value;

        if (!password) {
            showLoginError('Bitte geben Sie das Passwort ein.');
            return;
        }

        // Check against club password
        if (password === '1978') {
            // Erfolgreiche Anmeldung
            setLoggedIn(true);

            // Weiterleitung zum Dashboard
            window.location.href = 'dashboard.html';
        } else {
            // Fehlgeschlagene Anmeldung
            showLoginError('Ungültiges Passwort. Bitte versuchen Sie es erneut.');
        }
    } else {
        // Username + password login (legacy/admin)
        const username = usernameField ? usernameField.value : '';
        const password = passwordField ? passwordField.value : '';

        // Einfache Validierung
        if (!username || !password) {
            showLoginError('Bitte geben Sie Benutzername und Passwort ein.');
            return;
        }

        // Demo-Anmeldedaten (in einer echten Anwendung würde dies serverseitig überprüft)
        if (username === 'demo' && password === 'password') {
            // Erfolgreiche Anmeldung
            setLoggedIn(true);

            // Weiterleitung zum Dashboard
            window.location.href = 'dashboard.html';
        } else {
            // Fehlgeschlagene Anmeldung
            showLoginError('Ungültiger Benutzername oder Passwort.');
        }
    }
}

/**
 * Behandelt den Logout-Vorgang
 */
function handleLogout() {
    // Benutzer ausloggen
    setLoggedIn(false);

    // Zur Startseite weiterleiten
    window.location.href = '../../index.html';
}

/**
 * Zeigt eine Fehlermeldung im Login-Formular an
 * @param {string} message - Die anzuzeigende Fehlermeldung
 */
function showLoginError(message) {
    const errorElement = document.getElementById('login-error');

    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
}

/**
 * Überprüft, ob der Benutzer eingeloggt ist
 * @returns {boolean} - true, wenn der Benutzer eingeloggt ist, sonst false
 */
function isLoggedIn() {
    return localStorage.getItem('isLoggedIn') === 'true';
}

/**
 * Setzt den Login-Status des Benutzers
 * @param {boolean} status - Der Login-Status (true = eingeloggt, false = ausgeloggt)
 */
function setLoggedIn(status) {
    if (status) {
        localStorage.setItem('isLoggedIn', 'true');
    } else {
        localStorage.removeItem('isLoggedIn');
    }
}

/**
 * Leitet zur Login-Seite weiter
 */
function redirectToLogin() {
    // Aktuelle URL speichern, um nach dem Login zurückzukehren
    const currentPath = window.location.pathname;
    localStorage.setItem('tcgrueze_redirect', currentPath);

    // Zur Login-Seite weiterleiten
    window.location.href = '/pages/members/index.html';
}

/**
 * Leitet zur ursprünglichen Seite zurück (nach erfolgreichem Login)
 */
function redirectToOriginal() {
    const redirectPath = localStorage.getItem('tcgrueze_redirect');

    if (redirectPath) {
        localStorage.removeItem('tcgrueze_redirect');
        window.location.href = redirectPath;
    } else {
        // Standardmässig zum Dashboard weiterleiten
        window.location.href = '/pages/members/dashboard.html';
    }
}

