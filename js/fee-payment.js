/**
 * SHOBHA EDUCATION TRUST — ONLINE FEE PAYMENT & TRANSACTION STATUS VERIFICATION
 * Unified Payment Wizard & In-Page Verification Desk + Official Receipt Viewer
 */

let selectedCategory = null;
let verifiedQuote = null;
let studentData = {};
let qrSettings = null;

// DOM Elements - Wizard
const step1El = document.getElementById('stepContainer1');
const step2El = document.getElementById('stepContainer2');
const step3El = document.getElementById('stepContainer3');
const ind1 = document.getElementById('stepIndicator1');
const ind2 = document.getElementById('stepIndicator2');
const ind3 = document.getElementById('stepIndicator3');
const btnNextToStep2 = document.getElementById('btnNextToStep2');
const categoriesContainer = document.getElementById('feeCategoriesList');

// DOM Elements - Tabs & Panels
const tabModePay = document.getElementById('tabModePay');
const tabModeStatus = document.getElementById('tabModeStatus');
const paymentWizardContainer = document.getElementById('paymentWizardContainer');
const transactionStatusSection = document.getElementById('transactionStatusSection');

// DOM Elements - Status Cards
const statusSearchForm = document.getElementById('statusSearchForm');
const statusSearchInput = document.getElementById('statusSearchInput');
const statusLookupLoading = document.getElementById('statusLookupLoading');
const statusInitialPrompt = document.getElementById('statusInitialPrompt');
const pendingStatusCard = document.getElementById('pendingStatusCard');
const verifiedReceiptCard = document.getElementById('verifiedReceiptCard');
const disapprovedStatusCard = document.getElementById('disapprovedStatusCard');
const errorStatusCard = document.getElementById('errorStatusCard');
const errorStatusMessage = document.getElementById('errorStatusMessage');

// =============================================================================
// TAB SWITCHING (Make Payment vs Check Status)
// =============================================================================

export function showPaymentTab() {
  if (tabModePay) {
    tabModePay.classList.add('active');
    tabModePay.setAttribute('aria-selected', 'true');
  }
  if (tabModeStatus) {
    tabModeStatus.classList.remove('active');
    tabModeStatus.setAttribute('aria-selected', 'false');
  }
  if (paymentWizardContainer) paymentWizardContainer.style.display = 'block';
  if (transactionStatusSection) transactionStatusSection.style.display = 'none';
}

export function showStatusTab(refToQuery = null) {
  if (tabModeStatus) {
    tabModeStatus.classList.add('active');
    tabModeStatus.setAttribute('aria-selected', 'true');
  }
  if (tabModePay) {
    tabModePay.classList.remove('active');
    tabModePay.setAttribute('aria-selected', 'false');
  }
  if (paymentWizardContainer) paymentWizardContainer.style.display = 'none';
  if (transactionStatusSection) transactionStatusSection.style.display = 'block';

  const targetRef = refToQuery || (statusSearchInput ? statusSearchInput.value.trim() : null);
  if (targetRef) {
    if (statusSearchInput) statusSearchInput.value = targetRef;
    lookupTransactionStatus(targetRef);
  } else {
    hideAllStatusCards();
    if (statusInitialPrompt) statusInitialPrompt.style.display = 'block';
  }
}

function hideAllStatusCards() {
  if (statusLookupLoading) statusLookupLoading.style.display = 'none';
  if (statusInitialPrompt) statusInitialPrompt.style.display = 'none';
  if (pendingStatusCard) pendingStatusCard.style.display = 'none';
  if (verifiedReceiptCard) verifiedReceiptCard.style.display = 'none';
  if (disapprovedStatusCard) disapprovedStatusCard.style.display = 'none';
  if (errorStatusCard) errorStatusCard.style.display = 'none';
}

// =============================================================================
// 1. FETCH QR & FEE CATEGORIES
// =============================================================================

async function loadQRSettings() {
  try {
    const res = await fetch('/api/public/payments/qr-config');
    const data = await res.json();
    if (res.ok && data.success && data.settings) {
      qrSettings = data.settings;
      const qrImg = document.getElementById('qrDisplayImage');
      const upiText = document.getElementById('qrUpiIdText');
      const accText = document.getElementById('qrAccountNameText');
      if (qrImg) qrImg.src = qrSettings.qrImageUrl || 'assets/qr.png';
      if (upiText) upiText.textContent = qrSettings.upiId || 'shobhaeducationtrust@upi';
      if (accText) accText.textContent = qrSettings.accountName || 'Shobha Education Trust';
    }
  } catch (e) {
    console.warn('Using default QR configuration');
  }
}

async function loadFeeCategories() {
  if (!categoriesContainer) return;
  try {
    const res = await fetch('/api/payments/options');
    const data = await res.json();

    if (!res.ok || !data.success || !data.categories || data.categories.length === 0) {
      categoriesContainer.innerHTML = `
        <div style="grid-column: 1 / -1; text-align:center; padding: 40px; color: var(--color-text-muted);">
          Currently, there are no published fee categories open for public online payment.
        </div>
      `;
      return;
    }

    categoriesContainer.innerHTML = data.categories.map(cat => `
      <div class="fee-card" data-category-id="${cat.id}">
        <div>
          <div class="fee-card-institution">${cat.institution}</div>
          <h4 class="fee-card-title">${cat.name}</h4>
          <p class="fee-card-desc">${cat.description || 'Session: ' + cat.academicSession}</p>
        </div>
        <div class="fee-card-price-row">
          <span class="fee-price-val">₹${cat.amountRupees}</span>
          <span class="fee-price-session">${cat.academicSession}</span>
        </div>
      </div>
    `).join('');

    document.querySelectorAll('.fee-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.fee-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        const catId = card.getAttribute('data-category-id');
        selectedCategory = data.categories.find(c => c.id === catId);
        if (btnNextToStep2) btnNextToStep2.disabled = false;
      });
    });

    // Check if course query param exists in URL
    const urlParams = new URLSearchParams(window.location.search);
    const courseParam = urlParams.get('course');
    if (courseParam) {
      let match = null;
      if (courseParam === 'deled' || courseParam === 'btc') {
        match = data.categories.find(c => c.name.includes('D.El.Ed'));
      } else if (courseParam === 'iti') {
        match = data.categories.find(c => c.name.includes('ITI'));
      } else if (courseParam === 'ba') {
        match = data.categories.find(c => c.name.includes('B.A.'));
      }
      if (match) {
        const cardEl = document.querySelector(`[data-category-id="${match.id}"]`);
        if (cardEl) {
          cardEl.click();
          if (btnNextToStep2) btnNextToStep2.click();
        }
      }
    }

  } catch (err) {
    categoriesContainer.innerHTML = `<div style="grid-column: 1 / -1; text-align:center; color:#DC2626; padding:30px;">Error loading fee options.</div>`;
  }
}

// =============================================================================
// 2. WIZARD STEP NAVIGATION
// =============================================================================

function setupWizardHandlers() {
  // Copy UPI button
  const btnCopyUpi = document.getElementById('btnCopyUpi');
  if (btnCopyUpi) {
    btnCopyUpi.addEventListener('click', () => {
      const upiText = document.getElementById('qrUpiIdText')?.textContent || '';
      if (upiText) {
        navigator.clipboard.writeText(upiText).then(() => {
          alert(`UPI ID "${upiText}" copied to clipboard!`);
        });
      }
    });
  }

  // Step 1 -> Step 2
  if (btnNextToStep2) {
    btnNextToStep2.addEventListener('click', async () => {
      if (!selectedCategory) return;
      btnNextToStep2.disabled = true;

      try {
        const res = await fetch('/api/payments/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ feeCategoryId: selectedCategory.id })
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Quote failed');

        verifiedQuote = data.quote;
        if (step1El) step1El.style.display = 'none';
        if (step2El) step2El.style.display = 'block';
        if (ind1) {
          ind1.classList.remove('active');
          ind1.classList.add('completed');
        }
        if (ind2) ind2.classList.add('active');
        window.scrollTo({ top: 200, behavior: 'smooth' });
      } catch (err) {
        alert(err.message);
      } finally {
        btnNextToStep2.disabled = false;
      }
    });
  }

  // Step 2 Back to Step 1
  const btnBackToStep1 = document.getElementById('btnBackToStep1');
  if (btnBackToStep1) {
    btnBackToStep1.addEventListener('click', () => {
      if (step2El) step2El.style.display = 'none';
      if (step1El) step1El.style.display = 'block';
      if (ind2) ind2.classList.remove('active');
      if (ind1) {
        ind1.classList.remove('completed');
        ind1.classList.add('active');
      }
    });
  }

  // Step 2 Form Submit -> Step 3
  const studentForm = document.getElementById('studentDetailsForm');
  if (studentForm) {
    studentForm.addEventListener('submit', (e) => {
      e.preventDefault();
      studentData = {
        studentName: document.getElementById('studentFullName')?.value.trim() || '',
        district: (document.getElementById('studentDistrict')?.value || 'Jaunpur').trim(),
        rollNumber: document.getElementById('studentRollNumber')?.value.trim() || '',
        email: document.getElementById('studentEmail')?.value.trim() || '',
        phone: document.getElementById('studentPhone')?.value.trim() || '',
        notes: document.getElementById('studentNotes')?.value.trim() || ''
      };

      const instAmt = document.getElementById('instructionAmountText');
      const summAmt = document.getElementById('summaryPayAmount');
      const summTitle = document.getElementById('summaryFeeTitle');
      if (instAmt) instAmt.textContent = verifiedQuote.amountRupees;
      if (summAmt) summAmt.textContent = verifiedQuote.amountRupees;
      if (summTitle) summTitle.textContent = verifiedQuote.name;

      const dateInput = document.getElementById('paymentDateInput');
      if (dateInput) {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        dateInput.value = now.toISOString().slice(0, 16);
      }

      if (step2El) step2El.style.display = 'none';
      if (step3El) step3El.style.display = 'block';
      if (ind2) {
        ind2.classList.remove('active');
        ind2.classList.add('completed');
      }
      if (ind3) ind3.classList.add('active');
      window.scrollTo({ top: 200, behavior: 'smooth' });
    });
  }

  // Step 3 Back to Step 2
  const btnBackToStep2 = document.getElementById('btnBackToStep2');
  if (btnBackToStep2) {
    btnBackToStep2.addEventListener('click', () => {
      if (step3El) step3El.style.display = 'none';
      if (step2El) step2El.style.display = 'block';
      if (ind3) ind3.classList.remove('active');
      if (ind2) {
        ind2.classList.remove('completed');
        ind2.classList.add('active');
      }
    });
  }

  // Screenshot Upload Handler
  const screenshotInput = document.getElementById('screenshotUploadInput');
  if (screenshotInput) {
    screenshotInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const statusEl = document.getElementById('screenshotUploadStatus');
      if (statusEl) statusEl.textContent = 'Uploading screenshot proof...';

      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await fetch('/api/admin/upload', {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        if (res.ok && data.success) {
          const hiddenInput = document.getElementById('screenshotUrlHidden');
          if (hiddenInput) hiddenInput.value = data.file.url;
          if (statusEl) {
            statusEl.textContent = `✓ Uploaded: ${data.file.originalName}`;
            statusEl.style.color = '#059669';
          }
        } else if (statusEl) {
          statusEl.textContent = 'File attached locally.';
        }
      } catch (err) {
        if (statusEl) statusEl.textContent = 'Screenshot attached.';
      }
    });
  }

  // Step 3 Form Submit -> Submit UTR & Immediately Show Transaction Status!
  const submitUtrForm = document.getElementById('submitUtrForm');
  if (submitUtrForm) {
    submitUtrForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('btnSubmitPayment');
      const alertBox = document.getElementById('submitAlertBox');
      if (alertBox) alertBox.style.display = 'none';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'SUBMITTING VERIFICATION RECORD...';
      }

      const utrNumber = document.getElementById('utrNumberInput')?.value.trim() || '';
      const paymentDate = document.getElementById('paymentDateInput')?.value || '';
      const screenshotUrl = document.getElementById('screenshotUrlHidden')?.value || '';

      try {
        const res = await fetch('/api/payments/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            feeCategoryId: verifiedQuote.feeCategoryId,
            studentDetails: studentData,
            utrNumber,
            upiId: utrNumber,
            screenshotUrl,
            paymentDate
          })
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Submission failed');
        }

        // Show Transaction Status Section right here on this page!
        const refId = data.referenceId;
        window.history.pushState(null, '', `?ref=${encodeURIComponent(refId)}`);
        showStatusTab(refId);

        // Smooth scroll to status container
        const statusEl = document.getElementById('transactionStatusSection');
        if (statusEl) {
          statusEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      } catch (err) {
        if (alertBox) {
          alertBox.textContent = `Error: ${err.message}`;
          alertBox.style.display = 'block';
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'REQUEST VERIFICATION →';
        }
      }
    });
  }
}

// =============================================================================
// 3. TRANSACTION STATUS LOOKUP & RECEIPT RENDERING
// =============================================================================

// Helper: Robust currency formatting that safely parses numeric or string amount values
export function formatCurrencyRupees(orderObj) {
  if (!orderObj) return '0';
  if (typeof orderObj.amount === 'number' && !isNaN(orderObj.amount)) {
    return orderObj.amount.toLocaleString('en-IN');
  }
  if (typeof orderObj.amountPaise === 'number' && !isNaN(orderObj.amountPaise)) {
    return (orderObj.amountPaise / 100).toLocaleString('en-IN');
  }
  if (orderObj.amountRupees !== undefined && orderObj.amountRupees !== null) {
    const raw = String(orderObj.amountRupees).replace(/[^0-9.]/g, '');
    const num = parseFloat(raw);
    if (!isNaN(num)) return num.toLocaleString('en-IN');
    return String(orderObj.amountRupees);
  }
  return '0';
}

export async function lookupTransactionStatus(reference) {
  const trimmedRef = reference ? reference.trim() : '';
  if (!trimmedRef) return;

  // Reject search attempts made solely with numeric UTR / UPI numbers
  if (/^\d{10,14}$/.test(trimmedRef)) {
    hideAllStatusCards();
    if (errorStatusCard) errorStatusCard.style.display = 'block';
    if (errorStatusMessage) {
      errorStatusMessage.textContent = 'Status lookup is strictly restricted to your official Tracking Reference ID (e.g. SET-PAY-...). UPI UTR numbers cannot be used for search.';
    }
    return;
  }

  hideAllStatusCards();
  if (statusLookupLoading) statusLookupLoading.style.display = 'block';

  try {
    const res = await fetch(`/api/payments/status/${encodeURIComponent(trimmedRef)}`);
    const data = await res.json();

    if (statusLookupLoading) statusLookupLoading.style.display = 'none';

    if (!res.ok || !data.success || !data.order) {
      if (errorStatusCard) errorStatusCard.style.display = 'block';
      if (errorStatusMessage) {
        errorStatusMessage.textContent = data.error || 'Transaction record not found. Please verify your official Reference ID (e.g. SET-PAY-...).';
      }
      return;
    }

    const order = data.order;
    const formattedAmount = formatCurrencyRupees(order);

    if (order.status === 'pending' || order.status === 'initiated') {
      // -------------------------------------------------------------
      // PENDING STATE
      // -------------------------------------------------------------
      if (pendingStatusCard) pendingStatusCard.style.display = 'block';
      const elRef = document.getElementById('pendingRefCode');
      const elInst = document.getElementById('pendingInstName');
      const elName = document.getElementById('pendingStudentName');
      const elRoll = document.getElementById('pendingRollNo');
      const elFee = document.getElementById('pendingFeeName');
      const elUtr = document.getElementById('pendingUtrVal');
      const elAmt = document.getElementById('pendingAmountVal');

      if (elRef) elRef.textContent = order.referenceId;
      if (elInst) elInst.textContent = order.institution || 'Sarveshwaree Mahavidyalaya';
      if (elName) elName.textContent = order.studentName || '-';
      if (elRoll) elRoll.textContent = order.rollNumber || 'Under Enrollment';
      if (elFee) elFee.textContent = order.feeName || 'Tuition Fee';
      if (elUtr) elUtr.textContent = order.utrNumber || 'Under Review';
      if (elAmt) elAmt.textContent = formattedAmount;

    } else if (order.status === 'verified' || order.status === 'successful') {
      // -------------------------------------------------------------
      // VERIFIED / APPROVED STATE -> RENDER OFFICIAL RECEIPT
      // -------------------------------------------------------------
      let receipt = {};
      try {
        const rcptRes = await fetch(`/api/payments/receipt/${encodeURIComponent(order.referenceId)}`);
        const rcptData = await rcptRes.json();
        if (rcptData.success && rcptData.receipt) receipt = rcptData.receipt;
      } catch (e) {}

      if (verifiedReceiptCard) verifiedReceiptCard.style.display = 'block';

      const rInst = document.getElementById('receiptInstName');
      const rRef = document.getElementById('valReceiptNo');
      const rUtr = document.getElementById('valUtrNo');
      const rName = document.getElementById('valStudentName');
      const rRoll = document.getElementById('valRollNo');
      const rFee = document.getElementById('valFeeName');
      const rSess = document.getElementById('valSession');
      const rAmt = document.getElementById('valAmountRupees');
      const rHash = document.getElementById('valVerificationHash');
      const rBy = document.getElementById('valVerifiedByText');
      const rTime = document.getElementById('receiptTimestamp');

      if (rInst) rInst.textContent = order.institution || 'Sarveshwaree Mahavidyalaya';
      if (rRef) rRef.textContent = order.referenceId;
      if (rUtr) rUtr.textContent = order.utrNumber || receipt.utrNumber || 'N/A';
      if (rName) rName.textContent = order.studentName || '-';
      if (rRoll) rRoll.textContent = order.rollNumber || 'N/A';
      if (rFee) rFee.textContent = order.feeName || 'Tuition Fee';
      if (rSess) rSess.textContent = order.academicSession || '2026-2027';
      if (rAmt) rAmt.textContent = formattedAmount;
      if (rHash) rHash.textContent = receipt.verificationHash || `SHA256-SET-${order.referenceId}`;
      if (rBy) rBy.textContent = `Verified by: ${order.verifiedBy || 'Campus Administrative Desk'}`;
      if (rTime) {
        const d = order.verifiedAt || order.submittedAt || new Date();
        rTime.textContent = `Verified: ${new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;
      }

    } else if (order.status === 'rejected' || order.status === 'disapproved') {
      // -------------------------------------------------------------
      // DISAPPROVED STATE
      // -------------------------------------------------------------
      if (disapprovedStatusCard) disapprovedStatusCard.style.display = 'block';
      const dNotes = document.getElementById('disapprovedNotesText');
      const dRef = document.getElementById('disapprovedRefCode');
      const dUtr = document.getElementById('disapprovedUtrCode');

      if (dNotes) {
        dNotes.textContent = order.adminNotes || order.rejectionReason || 'UTR transaction reference number could not be reconciled with the institutional bank ledger.';
      }
      if (dRef) dRef.textContent = order.referenceId;
      if (dUtr) dUtr.textContent = order.utrNumber || 'N/A';
    }

  } catch (err) {
    if (statusLookupLoading) statusLookupLoading.style.display = 'none';
    if (errorStatusCard) errorStatusCard.style.display = 'block';
    if (errorStatusMessage) errorStatusMessage.textContent = err.message || 'Unable to connect to verification desk.';
  }
}

// =============================================================================
// 4. INITIALIZATION & EVENT LISTENERS
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
  // Setup tabs
  if (tabModePay) {
    tabModePay.addEventListener('click', () => {
      showPaymentTab();
      window.history.pushState(null, '', window.location.pathname);
    });
  }

  if (tabModeStatus) {
    tabModeStatus.addEventListener('click', () => {
      const currentRef = statusSearchInput?.value.trim();
      showStatusTab(currentRef || null);
    });
  }

  // Status search form submit
  if (statusSearchForm) {
    statusSearchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = statusSearchInput?.value.trim();
      if (val) {
        window.history.pushState(null, '', `?ref=${encodeURIComponent(val)}`);
        lookupTransactionStatus(val);
      }
    });
  }

  // Prompt button to switch to payment tab
  const btnSwitchToPayTab = document.getElementById('btnSwitchToPayTab');
  if (btnSwitchToPayTab) {
    btnSwitchToPayTab.addEventListener('click', showPaymentTab);
  }

  // Error back button
  const btnErrorBackToPay = document.getElementById('btnErrorBackToPay');
  if (btnErrorBackToPay) {
    btnErrorBackToPay.addEventListener('click', showPaymentTab);
  }

  // Re-submit button on disapproved card
  const btnResubmit = document.getElementById('btnResubmitPayment');
  if (btnResubmit) {
    btnResubmit.addEventListener('click', () => {
      showPaymentTab();
      window.scrollTo({ top: 200, behavior: 'smooth' });
    });
  }

  // Copy ref button on pending card
  const btnCopyPendingRef = document.getElementById('btnCopyPendingRef');
  if (btnCopyPendingRef) {
    btnCopyPendingRef.addEventListener('click', () => {
      const code = document.getElementById('pendingRefCode')?.textContent;
      if (code) {
        navigator.clipboard.writeText(code).then(() => {
          alert(`Tracking reference "${code}" copied to clipboard!`);
        });
      }
    });
  }

  // Refresh status button on pending card
  const btnRefreshPending = document.getElementById('btnRefreshPendingStatus');
  if (btnRefreshPending) {
    btnRefreshPending.addEventListener('click', () => {
      const code = document.getElementById('pendingRefCode')?.textContent;
      if (code) lookupTransactionStatus(code);
    });
  }

  // Setup wizard handlers
  setupWizardHandlers();

  // Load server configs
  loadQRSettings();
  loadFeeCategories();

  // Check URL query param for tracking ref
  const urlParams = new URLSearchParams(window.location.search);
  const refParam = urlParams.get('ref');
  if (refParam) {
    showStatusTab(refParam);
  } else {
    showPaymentTab();
  }
});
