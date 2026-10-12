/**
 * SHOBHA EDUCATION TRUST — MAIN INTERACTION SCRIPT
 * Master Frontend Controller
 */

import { initCampusMap, initHomeCampusMap } from './map.js';

function initApp() {
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
  try {
    initCampusMap();
    initHomeCampusMap();
  } catch (err) {
    console.warn('Campus map init skipped:', err);
  }
}

// Ensure execution whether document is still loading or already parsed (fixes Vercel production bundles)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

/**
 * Mobile Navigation Drawer Toggle & Backdrop
 */
function initMobileMenu() {
  const toggleBtns = document.querySelectorAll('.mobile-menu-toggle');
  const navMenu = document.querySelector('.nav-mobile-drawer, .nav-menu');

  if (!toggleBtns.length || !navMenu) return;

  // Hoist drawer to document.body to ensure ancestor CSS never hides or clips it
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
    navMenu.setAttribute('aria-hidden', 'false');
    toggleBtns.forEach(btn => {
      btn.classList.add('active');
      btn.setAttribute('aria-expanded', 'true');
    });
    backdrop.classList.add('active');
    document.body.classList.add('nav-drawer-open');
    document.body.style.overflow = 'hidden';
  };

  const closeDrawer = () => {
    navMenu.classList.remove('open');
    navMenu.setAttribute('aria-hidden', 'true');
    toggleBtns.forEach(btn => {
      btn.classList.remove('active');
      btn.setAttribute('aria-expanded', 'false');
    });
    backdrop.classList.remove('active');
    document.body.classList.remove('nav-drawer-open');
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
  const closeBtns = navMenu.querySelectorAll('.nav-drawer-close, [data-close-drawer]');
  closeBtns.forEach(btn => btn.addEventListener('click', (e) => {
    e.preventDefault();
    closeDrawer();
  }));

  // Close when clicking any nav link or enquiry trigger inside drawer
  navMenu.querySelectorAll('.nav-link, .nav-strip-link, [data-open-enquiry]').forEach(link => {
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
 * Shared Enquiry Form Submission Handler with inline validation,
 * spam honeypot check, duplicate prevention, and API integration.
 */
function setupEnquiryFormHandler(form, { successEl, alertEl, submitBtn, refIdEl, onReset } = {}) {
  if (!form) return;

  const getVal = (name) => (form.querySelector(`[name="${name}"]`)?.value || '').trim();
  const getField = (name) => form.querySelector(`[name="${name}"]`);
  const getErrorEl = (name) => {
    const input = getField(name);
    if (!input) return null;
    return form.querySelector(`#err-${input.id}`) || form.parentElement?.querySelector(`#err-${input.id}`);
  };

  function clearErrors() {
    form.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
    form.querySelectorAll('.field-error').forEach(el => {
      el.textContent = '';
      el.classList.remove('visible');
    });
    if (alertEl) {
      alertEl.style.display = 'none';
      alertEl.textContent = '';
      alertEl.className = 'form-alert';
    }
  }

  function setFieldError(name, msg) {
    const input = getField(name);
    if (input) {
      input.classList.add('is-invalid');
      input.setAttribute('aria-invalid', 'true');
    }
    const errEl = getErrorEl(name);
    if (errEl) {
      errEl.textContent = msg;
      errEl.classList.add('visible');
    }
  }

  // Clear errors dynamically as the user types or selects
  form.querySelectorAll('input, select, textarea').forEach(input => {
    const clearSelf = () => {
      input.classList.remove('is-invalid');
      input.removeAttribute('aria-invalid');
      const errEl = form.querySelector(`#err-${input.id}`) || form.parentElement?.querySelector(`#err-${input.id}`);
      if (errEl) {
        errEl.textContent = '';
        errEl.classList.remove('visible');
      }
    };
    input.addEventListener('input', clearSelf);
    input.addEventListener('change', clearSelf);
  });

  // Attach submit listener
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    // 1. Anti-Spam Honeypot check
    const hpVal = form.querySelector('[name="_hp_address"]')?.value || '';
    if (hpVal) {
      console.warn('[Enquiry] Anti-spam honeypot triggered.');
      return;
    }

    const name = getVal('name');
    const email = getVal('email');
    const phone = getVal('phone');
    const category = getVal('category');
    const institutionOrProgramme = getVal('institutionOrProgramme');
    const subject = getVal('subject');
    const message = getVal('message');

    let hasError = false;
    let firstInvalidInput = null;

    if (!name || name.length < 2) {
      setFieldError('name', 'Full Name is required (minimum 2 characters).');
      hasError = true;
      if (!firstInvalidInput) firstInvalidInput = getField('name');
    } else if (name.length > 100) {
      setFieldError('name', 'Full Name cannot exceed 100 characters.');
      hasError = true;
      if (!firstInvalidInput) firstInvalidInput = getField('name');
    }

    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/;
    if (!email) {
      setFieldError('email', 'Email Address is required.');
      hasError = true;
      if (!firstInvalidInput) firstInvalidInput = getField('email');
    } else if (!emailRegex.test(email) || email.length > 150) {
      setFieldError('email', 'Please enter a valid email address.');
      hasError = true;
      if (!firstInvalidInput) firstInvalidInput = getField('email');
    }

    const digitsOnly = phone.replace(/[^0-9]/g, '');
    if (!phone) {
      setFieldError('phone', 'Mobile Number is required.');
      hasError = true;
      if (!firstInvalidInput) firstInvalidInput = getField('phone');
    } else if (digitsOnly.length < 10 || digitsOnly.length > 15) {
      setFieldError('phone', 'Please enter a valid mobile number with at least 10 digits.');
      hasError = true;
      if (!firstInvalidInput) firstInvalidInput = getField('phone');
    }

    const validCategories = [
      'General Enquiry',
      'Admissions',
      'Courses and Eligibility',
      'Fee Enquiry',
      'Campus and Facilities',
      'Other'
    ];
    if (!category || !validCategories.includes(category)) {
      setFieldError('category', 'Please select an enquiry category from the list.');
      hasError = true;
      if (!firstInvalidInput) firstInvalidInput = getField('category');
    }

    if (!subject || subject.length < 3) {
      setFieldError('subject', 'Subject is required (minimum 3 characters).');
      hasError = true;
      if (!firstInvalidInput) firstInvalidInput = getField('subject');
    } else if (subject.length > 200) {
      setFieldError('subject', 'Subject cannot exceed 200 characters.');
      hasError = true;
      if (!firstInvalidInput) firstInvalidInput = getField('subject');
    }

    if (!message || message.length < 10) {
      setFieldError('message', 'Message is required (minimum 10 characters).');
      hasError = true;
      if (!firstInvalidInput) firstInvalidInput = getField('message');
    } else if (message.length > 3000) {
      setFieldError('message', 'Message cannot exceed 3,000 characters.');
      hasError = true;
      if (!firstInvalidInput) firstInvalidInput = getField('message');
    }

    if (hasError) {
      if (firstInvalidInput) firstInvalidInput.focus();
      return;
    }

    // 2. Loading indicator and disable duplicate submissions
    const originalBtnContent = submitBtn ? submitBtn.innerHTML : 'SUBMIT ENQUIRY';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="btn-spinner"></span> TRANSMITTING ENQUIRY...';
    }

    try {
      const res = await fetch('/api/v1/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          phone,
          category,
          institutionOrProgramme,
          subject,
          message
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // Clear form only after successful backend confirmation
        form.reset();
        clearErrors();

        if (successEl) {
          form.style.display = 'none';
          successEl.style.display = 'block';
          if (refIdEl && data.referenceId) {
            refIdEl.textContent = data.referenceId;
          }
        }
      } else {
        // Useful error message while preserving entered user data
        const errMsg = data.error || 'Failed to submit enquiry. Please review your fields and try again.';
        if (alertEl) {
          alertEl.textContent = errMsg;
          alertEl.className = 'form-alert error';
          alertEl.style.display = 'block';
          alertEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
          alert(errMsg);
        }
      }
    } catch (err) {
      console.error('[Enquiry] Transmission error:', err);
      const errMsg = 'Network communication failure. Please verify your connection or contact our campus helpline directly.';
      if (alertEl) {
        alertEl.textContent = errMsg;
        alertEl.className = 'form-alert error';
        alertEl.style.display = 'block';
      } else {
        alert(errMsg);
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnContent;
      }
    }
  });
}

/**
 * Institutional Enquiry Modal — Universal across all pages
 */
function initEnquiryModal() {
  let modal = document.getElementById('enquiryModal');

  // Upgrade older static modal if present in HTML
  if (modal && (!modal.querySelector('[name="category"]') || !modal.querySelector('[name="email"]'))) {
    modal.remove();
    modal = null;
  }

  // Inject full production-ready modal if missing
  if (!modal) {
    const modalMarkup = `
    <div class="modal-backdrop" id="enquiryModal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
      <div class="modal-container" style="max-width: 620px; max-height: 90vh; overflow-y: auto;">
        <div class="modal-header">
          <div>
            <span style="font-size: 11px; color: var(--color-accent-yellow); font-weight: 800; letter-spacing: 1px; text-transform: uppercase;">SHOBHA EDUCATION TRUST</span>
            <h3 id="modalTitle" style="margin: 2px 0 0; font-size: 18px;">INSTITUTIONAL ENQUIRY DESK</h3>
          </div>
          <button type="button" class="modal-close-btn" aria-label="Close modal">&times;</button>
        </div>
        <div class="modal-body" style="padding: 24px;">
          <div class="form-alert" id="modalEnquiryAlert" style="display:none;" role="alert"></div>

          <form id="enquiryForm" novalidate>
            <!-- Anti-Spam Honeypot Field -->
            <input type="text" name="_hp_address" id="modalHpAddress" style="display:none !important; position:absolute; left:-9999px;" tabindex="-1" autocomplete="off" aria-hidden="true">

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; margin-bottom: 14px;">
              <div class="form-group" style="margin-bottom: 0;">
                <label for="modalFullName" class="form-label">Full Name *</label>
                <input type="text" id="modalFullName" name="name" class="form-control" required placeholder="e.g. Rahul Singh" autocomplete="name">
                <div class="field-error" id="err-modalFullName" aria-live="polite"></div>
              </div>

              <div class="form-group" style="margin-bottom: 0;">
                <label for="modalEmail" class="form-label">Email Address *</label>
                <input type="email" id="modalEmail" name="email" class="form-control" required placeholder="e.g. rahul@example.com" autocomplete="email">
                <div class="field-error" id="err-modalEmail" aria-live="polite"></div>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; margin-bottom: 14px;">
              <div class="form-group" style="margin-bottom: 0;">
                <label for="modalPhone" class="form-label">Mobile Number *</label>
                <input type="tel" id="modalPhone" name="phone" class="form-control" required placeholder="10-digit mobile number" autocomplete="tel">
                <div class="field-error" id="err-modalPhone" aria-live="polite"></div>
              </div>

              <div class="form-group" style="margin-bottom: 0;">
                <label for="modalCategory" class="form-label">Enquiry Category *</label>
                <select id="modalCategory" name="category" class="form-control" required>
                  <option value="">Select Category</option>
                  <option value="General Enquiry">General Enquiry</option>
                  <option value="Admissions">Admissions</option>
                  <option value="Courses and Eligibility">Courses and Eligibility</option>
                  <option value="Fee Enquiry">Fee Enquiry</option>
                  <option value="Campus and Facilities">Campus and Facilities</option>
                  <option value="Other">Other</option>
                </select>
                <div class="field-error" id="err-modalCategory" aria-live="polite"></div>
              </div>
            </div>

            <div class="form-group" style="margin-bottom: 14px;">
              <label for="modalInstitution" class="form-label">Institution / Programme (Optional)</label>
              <input type="text" id="modalInstitution" name="institutionOrProgramme" class="form-control" placeholder="e.g. Sarveshwaree Mahavidyalaya (B.A.) / ITI / D.El.Ed">
              <div class="field-error" id="err-modalInstitution" aria-live="polite"></div>
            </div>

            <div class="form-group" style="margin-bottom: 14px;">
              <label for="modalSubject" class="form-label">Subject *</label>
              <input type="text" id="modalSubject" name="subject" class="form-control" required placeholder="Brief summary of your enquiry">
              <div class="field-error" id="err-modalSubject" aria-live="polite"></div>
            </div>

            <div class="form-group" style="margin-bottom: 18px;">
              <label for="modalMessage" class="form-label">Message *</label>
              <textarea id="modalMessage" name="message" class="form-control" rows="3" required placeholder="Detail your enquiry or requirements..."></textarea>
              <div class="field-error" id="err-modalMessage" aria-live="polite"></div>
            </div>

            <button type="submit" id="btnSubmitEnquiry" class="btn btn-accent" style="width: 100%; padding: 12px; font-weight: 700;">
              SUBMIT ENQUIRY
            </button>
          </form>

          <div id="enquirySuccess" style="display: none; padding: 24px 12px; text-align: center;">
            <div style="font-size: 32px; margin-bottom: 8px;">✓</div>
            <h4 style="color: #065F46; font-size: 18px; margin-bottom: 6px;">ENQUIRY TRANSMITTED</h4>
            <p style="color: #047857; font-size: 14px; line-height: 1.6; margin-bottom: 16px;" id="modalSuccessText">
              Your enquiry has been delivered directly to the institution's official administration email address (<span id="modalSuccessRecipient">sanjayjourno2009@gmail.com</span>).
            </p>
            <div style="background-color: #F8FAFC; border: 1px dashed #CBD5E1; border-radius: var(--radius-xs); padding: 10px 16px; margin-bottom: 18px; display: inline-block;">
              <span style="font-size: 12px; color: var(--color-text-secondary); text-transform: uppercase; font-weight: 700;">Reference ID:</span>
              <strong id="modalRefIdDisplay" style="font-family: monospace; font-size: 14px; color: var(--color-primary-navy); margin-left: 6px;">-</strong>
            </div>
            <div>
              <button type="button" id="btnModalSubmitAnother" class="btn btn-outline-navy" style="font-size: 12.5px; padding: 8px 16px;">
                Submit Another Enquiry
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalMarkup);
    modal = document.getElementById('enquiryModal');
  }

  // Modal open triggers with global delegation
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-open-enquiry], a[href="#enquiryModal"], .open-enquiry-modal');
    if (trigger) {
      e.preventDefault();
      modal = document.getElementById('enquiryModal');
      if (!modal) return;
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
      const nameInput = modal.querySelector('#modalFullName, input[name="name"]');
      if (nameInput) setTimeout(() => nameInput.focus(), 100);
    }
  });

  const closeModal = () => {
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  };

  // Close handlers
  document.addEventListener('click', (e) => {
    if (e.target.closest('.modal-close-btn') || e.target === modal) {
      closeModal();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && modal.classList.contains('active')) {
      closeModal();
    }
  });

  // Wire up modal form handler
  const form = modal.querySelector('#enquiryForm');
  const successEl = modal.querySelector('#enquirySuccess');
  const alertEl = modal.querySelector('#modalEnquiryAlert');
  const submitBtn = modal.querySelector('#btnSubmitEnquiry');
  const refIdEl = modal.querySelector('#modalRefIdDisplay');

  setupEnquiryFormHandler(form, { successEl, alertEl, submitBtn, refIdEl });

  // Handle "Submit Another Enquiry" in modal
  const btnReset = modal.querySelector('#btnModalSubmitAnother');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      if (successEl) successEl.style.display = 'none';
      if (form) form.style.display = 'block';
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
  const alertEl = document.getElementById('contactFormAlert');
  const submitBtn = document.getElementById('contactSubmitBtn');
  const refIdEl = document.getElementById('contactRefIdDisplay');

  if (!form || !successBox) return;

  setupEnquiryFormHandler(form, { successEl: successBox, alertEl, submitBtn, refIdEl });

  const btnReset = document.getElementById('btnContactSubmitAnother');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      successBox.style.display = 'none';
      form.style.display = 'block';
    });
  }
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
      if (!href || href.startsWith('#!')) return;
      if (href === '#') {
        e.preventDefault();
        return;
      }

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
      if (history.replaceState) {
        history.replaceState(null, null, href);
      }
    });
  });
}


