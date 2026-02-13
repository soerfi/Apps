/**
 * TC Grüze Website - Modern Enhancements
 * Handles scroll animations, sticky navigation, and core interactivity.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Initialize core components
    initStickyNav();
    initScrollReveal();
    initSmoothScrolling();
    initFormValidation();
    initActiveNav();
    initDropdowns();
    initHeroParallax();
});

// ... [Keep existing code until initTiltEffect] ...


/**
 * Hero Parallax Effect
 * Moves background image strictly on Y-axis
 */
function initHeroParallax() {
    const hero = document.querySelector('.hero');
    if (!hero) return;

    window.addEventListener('scroll', () => {
        const scrolled = window.scrollY;
        if (scrolled > hero.offsetHeight) return;

        // Move background down at 40% of scroll speed
        // Assumes background-position-x is handled by CSS (e.g. center or 75%)
        // We only touch the Y component. Center is usually 50%.
        // We add pixels to move it.
        const yPos = 50 + (scrolled * 0.05); // move percentage slightly

        // Since original CSS has `background-position: 75% center`, we need to preserve X
        // We'll read the computed style for X if we want to be safe, or just hardcode if we know it.
        // The CSS has `background-position: 75% center;`.
        // Let's modify only the Y.

        hero.style.backgroundPosition = `75% calc(50% + ${scrolled * 0.4}px)`;
    });
}

/**
 * Dropdown Menu Interactivity (mainly for mobile)
 */
function initDropdowns() {
    const dropdowns = document.querySelectorAll('.nav-item-dropdown');

    dropdowns.forEach(dropdown => {
        const link = dropdown.querySelector('a');
        if (!link) return;

        link.addEventListener('click', function (e) {
            // Only handle click for mobile logic (when screen width is <= 992px)
            if (window.innerWidth <= 992) {
                e.preventDefault();
                dropdown.classList.toggle('active');

                // Close other dropdowns
                dropdowns.forEach(other => {
                    if (other !== dropdown) other.classList.remove('active');
                });
            }
        });
    });
}

/**
 * Sticky Navigation
 * Adds 'scrolled' class to nav and swaps logo version
 */
/**
 * Sticky Navigation
 * Adds 'scrolled' class to nav and swaps logo version
 * Optimized with requestAnimationFrame
 */
function initStickyNav() {
    const nav = document.getElementById('main-nav');
    const logoImg = nav?.querySelector('.logo img');
    if (!nav || !logoImg) return;

    // Get base path from current logo src to handle depth
    const originalSrc = logoImg.getAttribute('src');
    const basePath = originalSrc.substring(0, originalSrc.lastIndexOf('/') + 1);

    let ticking = false;

    const updateNav = () => {
        // Prevent nav changes while mobile menu is open to avoid visual jumping/transparency shifts
        if (document.body.classList.contains('menu-open')) {
            ticking = false;
            return;
        }

        if (window.scrollY > 50) {
            nav.classList.add('scrolled');
            logoImg.src = `${basePath}tc_grueze_logo.svg`;
        } else {
            nav.classList.remove('scrolled');
            // Check if page expects a white logo on dark background initially
            if (document.body.classList.contains('home-page') ||
                document.body.classList.contains('sub-page') ||
                document.body.classList.contains('sub-page-dark')) {
                logoImg.src = `${basePath}tc_grueze_logo-white.svg`;
            } else {
                logoImg.src = `${basePath}tc_grueze_logo.svg`;
            }
        }
        ticking = false;
    };

    const onScroll = () => {
        if (!ticking) {
            window.requestAnimationFrame(updateNav);
            ticking = true;
        }
    };

    window.addEventListener('scroll', onScroll);
    updateNav(); // Initial check
}

/**
 * Scroll Reveal Animations
 * Uses Intersection Observer to trigger animations on scroll
 */
function initScrollReveal() {
    const revealElements = document.querySelectorAll('.scroll-reveal');

    if (!revealElements.length) return;

    const observerOptions = {
        threshold: 0.05,
        rootMargin: '0px 0px -20px 0px'
    };

    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                // Optional: stop observing once revealed
                // revealObserver.unobserve(entry.target);
            }
        });
    }, observerOptions);

    revealElements.forEach(el => revealObserver.observe(el));
}

/**
 * Smooth Scrolling for Anchor Links
 */
function initSmoothScrolling() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href === '#') return;

            const target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                const offset = 80; // Nav height
                const bodyRect = document.body.getBoundingClientRect().top;
                const elementRect = target.getBoundingClientRect().top;
                const elementPosition = elementRect - bodyRect;
                const offsetPosition = elementPosition - offset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

/**
 * Basic Form Validation
 * Replaces alerts with inline feedback and animations
 */
function initFormValidation() {
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        form.addEventListener('submit', (e) => {
            const inputs = form.querySelectorAll('input[required], textarea[required]');
            let valid = true;
            let firstInvalid = null;

            // Remove existing error messages
            form.querySelectorAll('.error-message').forEach(el => el.remove());

            inputs.forEach(input => {
                if (!input.value.trim()) {
                    valid = false;
                    if (!firstInvalid) firstInvalid = input;

                    input.style.borderColor = 'var(--color-accent)';
                    input.classList.add('shake-animation');

                    // Add simple error message below field
                    const msg = document.createElement('span');
                    msg.className = 'error-message';
                    msg.style.color = 'var(--color-accent)';
                    msg.style.fontSize = '0.8rem';
                    msg.style.marginTop = '0.25rem';
                    msg.style.display = 'block';
                    msg.innerText = 'Dieses Feld ist erforderlich.';
                    input.parentNode.appendChild(msg);

                    // Remove shake class after animation
                    setTimeout(() => input.classList.remove('shake-animation'), 500);
                } else {
                    input.style.borderColor = '';
                }
            });

            if (!valid) {
                e.preventDefault();
                if (firstInvalid) firstInvalid.focus();
            }
        });
    });
}
/**
 * Active Navigation Highlighting
 */
function initActiveNav() {
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-menu a');

    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (currentPath.endsWith(href) || (currentPath.endsWith('/') && href === 'index.html')) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

/**
 * Mobile Menu Toggle
 */
function toggleMobileMenu() {
    const nav = document.getElementById('main-nav');
    const menuInner = document.querySelector('.nav-inner');
    const toggle = document.querySelector('.mobile-nav-toggle');

    if (nav && menuInner && toggle) {
        menuInner.classList.toggle('active');
        toggle.classList.toggle('active');
        document.body.classList.toggle('menu-open');

        // Reset dropdowns when closing menu
        if (!menuInner.classList.contains('active')) {
            document.querySelectorAll('.nav-item-dropdown').forEach(d => d.classList.remove('active'));
        }
    }
}


/**
 * Hero Parallax Effect
 * Moves background image strictly on Y-axis
 */
/**
 * Hero Parallax Effect
 * Moves background image strictly on Y-axis
 * Optimized with requestAnimationFrame for smooth performance
 */
function initHeroParallax() {
    const hero = document.querySelector('.hero');
    if (!hero) return;

    let ticking = false;

    const updateParallax = () => {
        const scrolled = window.scrollY;

        if (scrolled <= hero.offsetHeight) {
            // Move background down at 40% of scroll speed
            // Keeping X at 75% (from CSS)
            hero.style.backgroundPosition = `75% calc(50% + ${scrolled * 0.4}px)`;
        }
        ticking = false;
    };

    const onScroll = () => {
        if (!ticking) {
            window.requestAnimationFrame(updateParallax);
            ticking = true;
        }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
}

