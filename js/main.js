/**
 * SHOBHA EDUCATION TRUST — MAIN INTERACTION SCRIPT
 * Master Frontend Controller
 */

document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  initHeaderScroll();
  initCampusGallery();
  initBackToTop();
  initEnquiryModal();
  initScrollAnimations();
  initCounterTickers();
  initAdmissionTabs();
  initProgrammeFilter();
  initContactForm();
  initSmoothAnchorScroll();
});

/**
 * Mobile Navigation Drawer Toggle & Backdrop
 */
function initMobileMenu() {
  const toggleBtns = document.querySelectorAll('.mobile-menu-toggle');
  const navMenu = document.querySelector('.nav-mobile-drawer, .nav-menu');

  if (!toggleBtns.length || !navMenu) return;

  // Hoist drawer to document.body to ensure ancestor CSS (display:none on header-nav-strip) never hides it
  if (navMenu.parentElement && navMenu.parentElement !== document.body) {
    document.body.appendChild(navMenu);
  }

  // Create backdrop if not already in DOM
  let backdrop = document.querySelector('.nav-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.className = 'nav-backdrop';
    document.body.appendChild(backdrop);
  }

  const openDrawer = () => {
    navMenu.classList.add('open');
    toggleBtns.forEach(btn => {
      btn.classList.add('active');
      btn.setAttribute('aria-expanded', 'true');
    });
    backdrop.classList.add('active');
    document.body.style.overflow = 'hidden';
  };

  const closeDrawer = () => {
    navMenu.classList.remove('open');
    toggleBtns.forEach(btn => {
      btn.classList.remove('active');
      btn.setAttribute('aria-expanded', 'false');
    });
    backdrop.classList.remove('active');
    document.body.style.overflow = '';
  };

  toggleBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (navMenu.classList.contains('open')) {
        closeDrawer();
      } else {
        openDrawer();
      }
    });
  });

  backdrop.addEventListener('click', (e) => {
    e.preventDefault();
    closeDrawer();
  });

  // Close when clicking explicit close buttons inside drawer
  const closeBtns = document.querySelectorAll('.nav-drawer-close, [data-close-drawer]');
  closeBtns.forEach(btn => btn.addEventListener('click', (e) => {
    e.preventDefault();
    closeDrawer();
  }));

  // Close when clicking any nav link
  navMenu.querySelectorAll('.nav-link, .nav-strip-link').forEach(link => {
    link.addEventListener('click', () => {
      closeDrawer();
    });
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && navMenu.classList.contains('open')) {
      closeDrawer();
    }
  });
}

/**
 * Campus Photo Gallery & Lightbox Controller (/campus)
 */
function initCampusGallery() {
  const filterBtns = document.querySelectorAll('.gallery-filter-btn');
  const galleryCards = Array.from(document.querySelectorAll('.gallery-card'));
  const lightbox = document.getElementById('galleryLightboxModal');

  if (!galleryCards.length) return;

  let currentCategory = 'all';
  let activeIndex = 0;

  function getVisibleCards() {
    return galleryCards.filter(card => {
      const cat = card.getAttribute('data-category');
      return currentCategory === 'all' || cat === currentCategory;
    });
  }

  // Filter Buttons
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      currentCategory = btn.getAttribute('data-filter') || 'all';

      galleryCards.forEach(card => {
        const cat = card.getAttribute('data-category');
        if (currentCategory === 'all' || cat === currentCategory) {
          card.style.display = '';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });

  if (!lightbox) return;

  const lightboxImg = lightbox.querySelector('.lightbox-img');
  const captionEl = lightbox.querySelector('.lightbox-caption-text');
  const counterEl = lightbox.querySelector('.lightbox-counter-badge');
  const closeBtn = lightbox.querySelector('.lightbox-close-btn');
  const prevBtn = lightbox.querySelector('.lightbox-nav-prev');
  const nextBtn = lightbox.querySelector('.lightbox-nav-next');

  function updateLightbox(index) {
    const visibleCards = getVisibleCards();
    if (!visibleCards.length) return;

    if (index < 0) index = visibleCards.length - 1;
    if (index >= visibleCards.length) index = 0;

    activeIndex = index;
    const card = visibleCards[activeIndex];
    const imgEl = card.querySelector('.gallery-card-img');
    const caption = card.getAttribute('data-caption') || (imgEl ? imgEl.alt : '');
    const src = card.getAttribute('data-full-img') || (imgEl ? imgEl.src : '');

    if (lightboxImg) lightboxImg.src = src;
    if (captionEl) captionEl.textContent = caption;
    if (counterEl) counterEl.textContent = `${activeIndex + 1} / ${visibleCards.length}`;
  }

  function openLightbox(index) {
    updateLightbox(index);
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
  }

  // Card click triggers
  galleryCards.forEach(card => {
    card.addEventListener('click', () => {
      const visibleCards = getVisibleCards();
      const idx = visibleCards.indexOf(card);
      if (idx !== -1) {
        openLightbox(idx);
      }
    });
  });

  if (closeBtn) closeBtn.addEventListener('click', closeLightbox);
  if (prevBtn) prevBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    updateLightbox(activeIndex - 1);
  });
  if (nextBtn) nextBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    updateLightbox(activeIndex + 1);
  });

  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) {
      closeLightbox();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('active')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') updateLightbox(activeIndex - 1);
    if (e.key === 'ArrowRight') updateLightbox(activeIndex + 1);
  });
}

/**
 * Back to Top Floating Button
 */
function initBackToTop() {
  const btn = document.querySelector('.back-to-top-btn');
  if (!btn) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 400) {
      btn.classList.add('visible');
    } else {
      btn.classList.remove('visible');
    }
  }, { passive: true });

  btn.addEventListener('click', () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });
}

/**
 * Admission Enquiry Modal
 */
function initEnquiryModal() {
  const triggers = document.querySelectorAll('[data-open-enquiry]');
  const modal = document.getElementById('enquiryModal');
  const closeBtn = document.querySelector('.modal-close-btn');

  if (!modal) return;

  triggers.forEach(trigger => {
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    });
  });

  const closeModal = () => {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  };

  if (closeBtn) closeBtn.addEventListener('click', closeModal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeModal();
    }
  });

  // Handle Form Submission Mock
  const form = document.getElementById('enquiryForm');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const successMsg = document.getElementById('enquirySuccess');
      if (successMsg) {
        form.style.display = 'none';
        successMsg.style.display = 'block';
        setTimeout(() => {
          closeModal();
          form.reset();
          form.style.display = 'block';
          successMsg.style.display = 'none';
        }, 3000);
      }
    });
  }
}

/**
 * Admission Guidelines Tab Controller (/admissions)
 */
function initAdmissionTabs() {
  const tabBtns = document.querySelectorAll('.admission-tab-btn');
  const tabPanels = document.querySelectorAll('.admission-tab-panel');

  if (!tabBtns.length || !tabPanels.length) return;

  function switchTab(targetId) {
    tabBtns.forEach(btn => {
      const isTarget = btn.getAttribute('data-tab') === targetId || btn.getAttribute('href') === `#${targetId}`;
      btn.classList.toggle('active', isTarget);
      btn.setAttribute('aria-selected', isTarget ? 'true' : 'false');
    });

    tabPanels.forEach(panel => {
      const isTarget = panel.id === targetId || panel.getAttribute('data-tab-content') === targetId;
      panel.classList.toggle('active', isTarget);
    });
  }

  tabBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = btn.getAttribute('data-tab');
      if (targetId) {
        switchTab(targetId);
        // update hash without scroll jump
        history.replaceState(null, null, `#${targetId}`);
      }
    });
  });

  // Check URL hash on page load
  const hash = window.location.hash.replace('#', '');
  if (hash) {
    const validIds = ['ba', 'deled', 'iti', 'paravet'];
    if (validIds.includes(hash)) {
      switchTab(hash);
      const targetElem = document.getElementById(hash);
      if (targetElem) {
        setTimeout(() => {
          targetElem.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 150);
      }
    }
  }
}

/**
 * Programme Category Filter (/programmes)
 */
function initProgrammeFilter() {
  const filterBtns = document.querySelectorAll('.filter-tab-btn');
  const programmeCards = document.querySelectorAll('[data-category]');

  if (!filterBtns.length || !programmeCards.length) return;

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filter = btn.getAttribute('data-filter');

      programmeCards.forEach(card => {
        if (filter === 'all' || card.getAttribute('data-category') === filter) {
          card.style.display = 'block';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });
}

/**
 * Contact Page Form Submission Handler
 */
function initContactForm() {
  const form = document.getElementById('contactPageForm');
  const successBox = document.getElementById('contactPageSuccess');

  if (!form || !successBox) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    form.style.display = 'none';
    successBox.style.display = 'block';
  });
}

/**
 * Header Scroll Elevation Shadow
 */
function initHeaderScroll() {
  const header = document.querySelector('.site-header-fixed, .main-header');
  if (!header) return;

  const handleScroll = () => {
    if (window.scrollY > 20) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();
}

/**
 * High-Performance Collegiate Scroll Reveal Animations
 */
function initScrollAnimations() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.querySelectorAll('.animate-reveal, .anim-fade-up, .anim-fade-down, .anim-scale-in, .dual-heading').forEach(el => {
      el.classList.add('revealed');
    });
    return;
  }

  const elements = document.querySelectorAll(
    '.animate-reveal, .anim-fade-up, .anim-fade-down, .anim-scale-in, .dual-heading, .timeline-track-desktop, .stagger-grid'
  );

  if (!elements.length) return;

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        obs.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.10,
    rootMargin: '0px 0px -40px 0px'
  });

  elements.forEach(el => observer.observe(el));
}

/**
 * Interactive Number Counter Tickers (Smooth Count-Up)
 */
function initCounterTickers() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const counterElements = document.querySelectorAll('.counter-val, [data-count-to]');
  if (!counterElements.length) return;

  const easeOutQuart = (x) => 1 - Math.pow(1 - x, 4);

  const startCount = (el) => {
    const rawTarget = el.getAttribute('data-count-to') || el.innerText.replace(/[^0-9]/g, '');
    const target = parseInt(rawTarget, 10);
    if (isNaN(target)) return;

    const prefix = el.getAttribute('data-count-prefix') || '';
    const suffix = el.getAttribute('data-count-suffix') || (el.innerText.includes('+') ? '+' : '');
    const duration = 1600; // ms
    const startTime = performance.now();

    const update = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutQuart(progress);
      const current = Math.floor(easedProgress * target);

      el.textContent = `${prefix}${current}${suffix}`;

      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        el.textContent = `${prefix}${target}${suffix}`;
      }
    };

    requestAnimationFrame(update);
  };

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        startCount(entry.target);
        obs.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.25
  });

  counterElements.forEach(el => observer.observe(el));
}

/**
 * Smooth Anchor Scroll Offset for Fixed Institutional Navigation
 */
function initSmoothAnchorScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (!href || href === '#' || href.startsWith('#!')) return;

      const targetElem = document.querySelector(href);
      if (!targetElem) return;

      e.preventDefault();

      const header = document.querySelector('.site-header-fixed, .site-header, .main-header');
      const headerOffset = header ? header.offsetHeight : 126;
      const elementPosition = targetElem.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset - 20;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });

      // Update URL hash without jumping
      if (history.pushState) {
        history.pushState(null, null, href);
      }
    });
  });
}


