import gsap from 'gsap';

class Portfolio {
  constructor() {
    this.config = null;
    this.currentCategory = null;
    this.currentImageIndex = 0;
    this.isAnimating = false;
    this.images = [];
    this.isSlideshowActive = false;
    this.slideshowInterval = null;

    this.elements = {
      loader: document.getElementById('loader'),
      loaderLogo: document.querySelector('.logo-loader'),
      landingScreen: document.getElementById('landing-screen'),
      navLinks: document.querySelector('.nav-links'),
      galleryContainer: document.getElementById('gallery-container'),
      galleryUI: document.getElementById('gallery-ui'),
      aboutSection: document.getElementById('about-section'),
      prevBtn: document.getElementById('prev-btn'),
      nextBtn: document.getElementById('next-btn'),
      currentCatEl: document.getElementById('current-category'),
      currentTitleEl: document.getElementById('current-title'),
      totalEl: document.getElementById('progress-total'),
      currentIdxEl: document.getElementById('progress-current'),
      progressBar: document.getElementById('progress-bar'),
      logo: document.querySelector('.logo a'),
      closeAbout: document.getElementById('close-about'),
      slideshowBtn: document.getElementById('slideshow-btn')
    };

    this.init();
  }

  async init() {
    try {
      const resp = await fetch('/config.json?v=' + Date.now());
      this.config = await resp.json();

      this.renderMenu();
      this.setupEventListeners();
      this.initialAnimation();
    } catch (err) {
      console.error("Failed to load config", err);
    }
  }

  renderMenu() {
    let html = '';
    this.config.categories.forEach((cat) => {
      if (cat.id === 'about') {
        html += `
                <li class="nav-link-item">
                    <a href="#" data-type="about" class="nav-link-anchor group block">
                        <span class="nav-link-title text-5xl md:text-8xl text-white hover:text-gray-400 transition-colors uppercase">${cat.label}</span>
                    </a>
                </li>`;
      } else {
        html += `
                <li class="nav-link-item mb-4 md:mb-8">
                    <div class="nav-link-title text-5xl md:text-8xl text-white cursor-default uppercase">${cat.label}</div>
                    <div class="flex gap-6 mt-2">
                        ${cat.subcategories.map(sub => `
                            <a href="#" data-id="${sub.id}" class="category-link text-xs uppercase tracking-[0.3em] text-gray-500 hover:text-white transition-all duration-300 font-medium">${sub.label}</a>
                        `).join('')}
                    </div>
                </li>`;
      }
    });
    this.elements.navLinks.innerHTML = html;
  }

  setupEventListeners() {
    this.elements.logo.addEventListener('click', (e) => {
      e.preventDefault();
      this.showLanding();
    });

    this.elements.navLinks.addEventListener('click', (e) => {
      const link = e.target.closest('.category-link');
      if (link) {
        e.preventDefault();
        this.loadCategory(link.dataset.id);
      }
      const aboutLink = e.target.closest('[data-type="about"]');
      if (aboutLink) {
        e.preventDefault();
        this.showAbout();
      }
    });

    this.elements.closeAbout.addEventListener('click', (e) => {
      e.preventDefault();
      this.showLanding();
    });

    this.elements.nextBtn.addEventListener('click', () => {
      this.stopSlideshow();
      this.nextImage();
    });
    this.elements.prevBtn.addEventListener('click', () => {
      this.stopSlideshow();
      this.prevImage();
    });

    this.elements.slideshowBtn.addEventListener('click', () => this.toggleSlideshow());

    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { this.stopSlideshow(); this.nextImage(); }
      if (e.key === 'ArrowLeft') { this.stopSlideshow(); this.prevImage(); }
      if (e.key === 'Escape') this.showLanding();
      if (e.key === ' ') { e.preventDefault(); this.toggleSlideshow(); }
    });
  }

  initialAnimation() {
    const tl = gsap.timeline();
    // Snappy, stylish loader
    tl.to(this.elements.loaderLogo, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.6, ease: "power4.out" })
      .to(this.elements.loaderLogo, { opacity: 0, scale: 1.05, filter: 'blur(10px)', duration: 0.4, ease: "power4.in" }, "+=0.4")
      .to(this.elements.loader, { yPercent: -100, duration: 0.7, ease: "expo.inOut" })
      .from("header .logo", { x: -20, opacity: 0, duration: 0.8, ease: "power4.out" }, "-=0.3")
      .from(".nav-link-item", { y: 40, opacity: 0, stagger: 0.08, duration: 1, ease: "power4.out" }, "-=0.5");
  }

  showLanding() {
    this.stopSlideshow();
    const tl = gsap.timeline();
    tl.to([this.elements.galleryContainer, this.elements.galleryUI, this.elements.aboutSection], {
      opacity: 0,
      duration: 0.5,
      pointerEvents: 'none',
      ease: "power2.inOut"
    })
      .to(this.elements.landingScreen, {
        opacity: 1,
        y: 0,
        duration: 0.6,
        pointerEvents: 'all',
        ease: "power4.out"
      })
      .fromTo(".nav-link-item", { y: 20, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.05, duration: 0.6 }, "-=0.4");

    this.currentCategory = null;
  }

  loadCategory(catId) {
    let selectedSub = null;
    this.config.categories.forEach(cat => {
      if (cat.subcategories) {
        const found = cat.subcategories.find(sub => sub.id === catId);
        if (found) selectedSub = found;
      }
    });

    if (!selectedSub) return;

    this.currentCategory = selectedSub;
    this.currentImageIndex = 0;
    this.images = selectedSub.images;

    this.elements.currentCatEl.innerText = selectedSub.label;
    this.elements.totalEl.innerText = String(this.images.length).padStart(2, '0');

    this.renderGallery();
    this.updateGalleryUI();

    const tl = gsap.timeline();
    tl.to(this.elements.landingScreen, { opacity: 0, y: -20, duration: 0.5, pointerEvents: 'none', ease: "power2.in" })
      .to(this.elements.galleryContainer, { opacity: 1, duration: 0.7, pointerEvents: 'all' }, "-=0.2")
      .to(this.elements.galleryUI, { opacity: 1, duration: 0.7, pointerEvents: 'all' }, "-=0.4");
  }

  renderGallery() {
    this.elements.galleryContainer.innerHTML = '';
    if (this.images.length === 0) {
      this.elements.galleryContainer.innerHTML = `<div class="flex items-center justify-center h-full text-gray-500 font-light tracking-widest text-sm uppercase px-8 text-center">No images found.</div>`;
      return;
    }

    this.images.forEach((imgObj, idx) => {
      const slide = document.createElement('div');
      slide.className = `gallery-slide ${idx === 0 ? 'active' : ''}`;

      const imgPath = typeof imgObj === 'string' ? imgObj : imgObj.file;
      slide.style.backgroundImage = `url('/images/${this.currentCategory.path}/${imgPath}')`;
      slide.innerHTML = `<div class="slide-overlay"></div>`;
      this.elements.galleryContainer.appendChild(slide);
    });
  }

  nextImage() {
    if (this.isAnimating || this.images.length <= 1) return;
    this.changeImage((this.currentImageIndex + 1) % this.images.length);
  }

  prevImage() {
    if (this.isAnimating || this.images.length <= 1) return;
    this.changeImage((this.currentImageIndex - 1 + this.images.length) % this.images.length);
  }

  changeImage(newIndex) {
    if (this.isAnimating) return;
    this.isAnimating = true;

    const slides = this.elements.galleryContainer.querySelectorAll('.gallery-slide');
    const currentSlide = slides[this.currentImageIndex];
    const nextSlide = slides[newIndex];

    // Prepare next slide (hidden but ready)
    gsap.set(nextSlide, { opacity: 0, filter: 'blur(30px)', scale: 1.1, zIndex: 10 });
    gsap.set(currentSlide, { zIndex: 5 });

    const tl = gsap.timeline({
      onComplete: () => {
        currentSlide.classList.remove('active');
        nextSlide.classList.add('active');
        this.isAnimating = false;
      }
    });

    // Synchronized UI and Image transition
    // 1. UI Fades out as image starts blurring
    tl.to([this.elements.currentTitleEl, this.elements.currentIdxEl], {
      opacity: 0,
      y: 10,
      duration: 0.4,
      ease: "power2.in",
      onComplete: () => {
        this.currentImageIndex = newIndex;
        this.updateGalleryUI();
      }
    }, 0);

    tl.to(currentSlide, {
      opacity: 0,
      filter: 'blur(40px)',
      scale: 0.9,
      duration: 1.2,
      ease: "power2.inOut"
    }, 0);

    // 2. UI Fades in as image blurs into focus
    tl.to([this.elements.currentTitleEl, this.elements.currentIdxEl], {
      opacity: 1,
      y: 0,
      duration: 0.8,
      ease: "power3.out"
    }, 0.6);

    tl.to(nextSlide, {
      opacity: 1,
      filter: 'blur(0px)',
      scale: 1,
      duration: 1.5,
      ease: "power4.out"
    }, 0.4);
  }

  updateGalleryUI() {
    this.elements.currentIdxEl.innerText = String(this.currentImageIndex + 1).padStart(2, '0');

    const imgObj = this.images[this.currentImageIndex];
    let displayName = "";
    if (imgObj) {
      if (typeof imgObj === 'string') {
        displayName = imgObj.split('.')[0].replace(/-/g, ' ');
      } else {
        displayName = imgObj.name || imgObj.file.split('.')[0].replace(/-/g, ' ');
      }
    }
    this.elements.currentTitleEl.innerText = displayName;

    const progress = this.images.length > 0 ? ((this.currentImageIndex + 1) / this.images.length) * 100 : 0;
    this.elements.progressBar.style.width = `${progress}%`;
  }

  toggleSlideshow() {
    if (this.isSlideshowActive) {
      this.stopSlideshow();
    } else {
      this.startSlideshow();
    }
  }

  startSlideshow() {
    if (this.images.length <= 1) return;
    this.isSlideshowActive = true;
    this.elements.slideshowBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
    this.elements.slideshowBtn.classList.add('active');

    this.slideshowInterval = setInterval(() => {
      this.nextImage();
    }, 5000);
  }

  stopSlideshow() {
    this.isSlideshowActive = false;
    clearInterval(this.slideshowInterval);
    this.elements.slideshowBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
    this.elements.slideshowBtn.classList.remove('active');
  }

  showAbout() {
    const about = this.config.categories.find(c => c.id === 'about');
    document.getElementById('about-title').innerText = about.content.title;
    document.getElementById('about-text').innerText = about.content.text;
    document.getElementById('about-contact').href = `mailto:${about.content.contact}`;

    const tl = gsap.timeline();
    tl.to(this.elements.landingScreen, { opacity: 0, duration: 0.5, pointerEvents: 'none' })
      .to(this.elements.aboutSection, { opacity: 1, duration: 0.8, pointerEvents: 'all' });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new Portfolio();
});
