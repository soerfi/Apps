(function () {
    const placeholder = document.getElementById('main-nav-placeholder');
    if (!placeholder) return;

    const root = placeholder.dataset.root || './';

    const navHTML = `
    <nav id="main-nav">
        <div class="container">
            <a href="${root}index.html" class="logo">
                <img src="${root}images/icons/tc_grueze_logo-white.svg" alt="TC Grüze Logo" style="height: 50px;">
            </a>
            <button class="mobile-nav-toggle" onclick="toggleMobileMenu()">
                <span></span>
                <span></span>
                <span></span>
            </button>
            <div class="nav-inner">
                <ul class="nav-menu">
                    <li><a href="${root}index.html">Home</a></li>
                    <li class="nav-item-dropdown">
                        <a href="${root}pages/club/index.html">Club</a>
                        <ul class="dropdown-menu">
                            <li><a href="${root}pages/club/index.html">Über uns</a></li>
                            <li><a href="${root}pages/club/jahresprogramm.html">Jahresprogramm</a></li>
                            <li><a href="${root}pages/club/geschichte.html">Geschichte</a></li>
                        </ul>
                    </li>
                    <li><a href="${root}pages/mitgliedschaft/index.html">Mitgliedschaft</a></li>
                    <li class="nav-item-dropdown">
                        <a href="${root}pages/sport/index.html">Sport</a>
                        <ul class="dropdown-menu">
                            <li><a href="${root}pages/sport/index.html">Tennis</a></li>
                            <li><a href="${root}pages/sport/pickleball.html">Pickleball</a></li>
                        </ul>
                    </li>
                    <li><a href="${root}pages/events/index.html">Events</a></li>
                    <li class="nav-item-dropdown">
                        <a href="${root}pages/info/index.html">Info</a>
                        <ul class="dropdown-menu">
                            <li><a href="${root}pages/info/index.html">Info</a></li>
                            <li><a href="${root}pages/kontakt/index.html">Kontakt</a></li>
                            <li><a href="${root}pages/club/jahresprogramm.html">Jahresprogramm</a></li>
                            <li><a href="${root}pages/info/spielzeiten.html">Spielzeiten</a></li>
                            <li><a href="${root}pages/info/reglement.html">Reglement</a></li>
                            <li><a href="${root}pages/info/sponsoren.html">Sponsoren</a></li>
                            <li><a href="${root}pages/impressum/index.html">Impressum</a></li>
                        </ul>
                    </li>
                    <li><a href="${root}pages/members/index.html">Members</a></li>
                </ul>
                <div class="nav-cta mobile-hide">
                    <a href="https://www.eversports.ch/sb/tennis-und-squash-grueze-ag-1" class="btn-join external-link"
                        target="_blank" rel="noopener noreferrer">Platz buchen</a>
                </div>
            </div>
        </div>
    </nav>
    `;

    placeholder.outerHTML = navHTML;

    // Highlight active link
    // We do this by checking if the link href matches the current file name
    // This is simple but effective for static sites
    const currentPath = window.location.pathname;
    const filename = currentPath.substring(currentPath.lastIndexOf('/') + 1) || 'index.html';

    // Also handle directory index (e.g. /pages/club/ matches /pages/club/index.html)
    // Actually, checking if the href *ends with* the filename is usually enough for simple structures,
    // but full path matching is safer if there are duplicate filenames (like index.html).
    // Let's rely on the fact that existing logic in main.js "initActiveNav" does this nicely.
    // BUT main.js does it on DOMContentLoaded. We just injected styles/HTML.
    // main.js will run AFTER this script finishes (if this script is sync and before main.js).
    // So main.js logic will pick it up!
})();
