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
});

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
function initStickyNav() {
    const nav = document.getElementById('main-nav');
    const logoImg = nav?.querySelector('.logo img');
    if (!nav || !logoImg) return;

    // Get base path from current logo src to handle depth
    const originalSrc = logoImg.getAttribute('src');
    const basePath = originalSrc.substring(0, originalSrc.lastIndexOf('/') + 1);

    const handleScroll = () => {
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
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial check
}

/**
 * Scroll Reveal Animations
 * Uses Intersection Observer to trigger animations on scroll
 */
function initScrollReveal() {
    const revealElements = document.querySelectorAll('.scroll-reveal');

    if (!revealElements.length) return;

    const observerOptions = {
        threshold: 0.15,
        rootMargin: '0px 0px -50px 0px'
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
 */
function initFormValidation() {
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        form.addEventListener('submit', (e) => {
            const inputs = form.querySelectorAll('input[required], textarea[required]');
            let valid = true;

            inputs.forEach(input => {
                if (!input.value.trim()) {
                    valid = false;
                    input.style.borderColor = 'var(--color-accent)';
                } else {
                    input.style.borderColor = '';
                }
            });

            if (!valid) {
                e.preventDefault();
                alert('Bitte füllen Sie alle erforderlichen Felder aus.');
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

