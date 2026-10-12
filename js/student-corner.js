/**
 * SHOBHA EDUCATION TRUST — STUDENT CORNER CLIENT CONTROLLER
 * Dynamic public academic repository with live multi-layer auto-sync
 */

let activeTab = 'all';
let currentSyncHash = '';
let isFetching = false;
let autoSyncTimer = null;

export async function loadResources(isSilent = false) {
  const feedContainer = document.getElementById('resourcesFeedContainer');
  const searchInput = document.getElementById('resourceSearchInput');
  const instSelect = document.getElementById('institutionFilterSelect');
  const sessionSelect = document.getElementById('sessionFilterSelect');
  const countText = document.getElementById('resourceCountText');
  const syncPill = document.getElementById('scLiveSyncPill');
  const syncStatusText = document.getElementById('scSyncStatusText');

  if (!feedContainer || isFetching) return;
  isFetching = true;

  if (!isSilent) {
    if (!feedContainer.children.length) {
      feedContainer.innerHTML = '<div class="empty-resources-box">Connecting to server & synchronizing resources...</div>';
    } else {
      feedContainer.classList.add('feed-loading');
    }
    if (syncPill) syncPill.classList.add('syncing');
    if (syncStatusText) syncStatusText.textContent = 'Syncing...';
  }

  if (countText) countText.textContent = 'Updating...';

  const search = searchInput ? searchInput.value.trim() : '';
  const institution = instSelect ? instSelect.value : 'all';
  const session = sessionSelect ? sessionSelect.value : 'all';

  let endpoint = activeTab === 'all' ? '/api/public/all' : `/api/public/${activeTab}`;
  let url = `${endpoint}?limit=50`;
  if (search) url += `&search=${encodeURIComponent(search)}`;
  if (institution && institution !== 'all') url += `&institution=${encodeURIComponent(institution)}`;
  if (session && session !== 'all') url += `&session=${encodeURIComponent(session)}`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to fetch resources');
    }

    const items = data.items || [];
    if (countText) {
      countText.textContent = `${items.length} ${items.length === 1 ? 'Resource' : 'Resources'} Available`;
    }

    if (items.length === 0) {
      feedContainer.innerHTML = `
        <div class="empty-resources-box">
          <h4 style="font-size: 16px; color: var(--color-primary-navy); margin-bottom: 6px;">No Published Items Found</h4>
          <p style="font-size: 13.5px;">There are no documents currently published under this category matching your selected filter criteria. New uploads by the administrator will automatically appear here.</p>
        </div>
      `;
      return;
    }

    feedContainer.innerHTML = items.map(item => {
      const dateStr = item.publicationDate ? new Date(item.publicationDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
      const fileUrl = (item.fileAttachment && item.fileAttachment.url) ? item.fileAttachment.url : (item.documentUrl || '');
      const rawFileName = (item.fileAttachment && item.fileAttachment.originalName) ? item.fileAttachment.originalName : (item.documentName || (fileUrl ? fileUrl.split('/').pop() : ''));
      const ext = rawFileName.includes('.') ? '.' + rawFileName.split('.').pop() : '';
      const fileName = (rawFileName && rawFileName.length > 24) ? `${rawFileName.slice(0, 18)}...${ext}` : rawFileName;
      const fileSize = (item.fileAttachment && item.fileAttachment.sizeBytes) ? ` (${Math.round(item.fileAttachment.sizeBytes / 1024)} KB)` : '';
      const hasFile = Boolean(fileUrl);

      const catName = item.category || (item.contentType ? item.contentType.toUpperCase() : 'Academic');

      let extraSection = '';
      if (item.contentType === 'results') {
        extraSection = `
          <div style="background: #F8FAFC; border-left: 3px solid var(--color-supporting-blue); padding: 12px 16px; margin: 12px 0; border-radius: var(--radius-xs); font-size: 13px;">
            <strong>Official University Verification:</strong> Individual student scorecards and authenticated mark sheets are verified directly through the official university portal at <a href="https://vbspu.ac.in" target="_blank" style="color: var(--color-supporting-blue); font-weight:700;">vbspu.ac.in ↗</a>. No private student marks or personal details are disclosed openly to protect scholar privacy.
          </div>
        `;
      }

      return `
        <article class="resource-card animate-fade-in">
          <div class="resource-card-meta">
            <span class="resource-tag">${catName}</span>
            <span>•</span>
            <strong>${item.institution || 'Sarveshwaree Mahavidyalaya'}</strong>
            ${item.programme ? `<span>•</span> <span>${item.programme}</span>` : ''}
            <span>•</span>
            <span>Session: ${item.academicSession || '2026-2027'}</span>
            ${item.noticeNumber ? `<span>•</span> <span>Ref: ${item.noticeNumber}</span>` : ''}
            <span style="margin-left: auto; color: var(--color-text-secondary); font-weight: 500;">📅 ${dateStr}</span>
          </div>

          <h3 class="resource-card-title">${item.title}</h3>

          ${item.summary ? `<p style="font-size: 14.5px; font-weight: 500; color: var(--color-primary-navy); margin-bottom: 8px;">${item.summary}</p>` : ''}
          ${item.description ? `<p class="resource-card-desc">${item.description}</p>` : ''}
          ${extraSection}

          <div class="resource-card-footer">
            <div>
              <span style="font-size: 12px; color: var(--color-text-muted);">
                Status: <strong style="color: #059669;">✓ Verified Official Server Record</strong>
              </span>
            </div>
            <div>
              ${hasFile ? `
                <a href="${fileUrl}" target="_blank" class="doc-download-pill" title="Download official verified document file: ${rawFileName}">
                  <span>📄 Download Official Document ↗</span>
                  <span class="doc-size-badge">${fileName}${fileSize}</span>
                </a>
              ` : `
                <span style="font-size: 12.5px; color: var(--color-text-secondary); font-style: italic;">
                  Official circular notified on campus board
                </span>
              `}
            </div>
          </div>
        </article>
      `;
    }).join('');

    if (syncStatusText) {
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      syncStatusText.textContent = `Auto-Sync: Live (${nowStr})`;
    }
  } catch (err) {
    if (!isSilent) {
      feedContainer.innerHTML = `
        <div class="empty-resources-box" style="border-color: #FCA5A5; background: #FEF2F2; color: #991B1B;">
          Unable to load resources from backend: ${err.message}. Please check connection.
        </div>
      `;
      if (countText) countText.textContent = 'Error';
    }
  } finally {
    feedContainer.classList.remove('feed-loading');
    if (syncPill) syncPill.classList.remove('syncing');
    isFetching = false;
  }
}

async function pollSyncStatus() {
  try {
    const res = await fetch('/api/public/sync-status?_t=' + Date.now());
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.syncHash) {
        if (currentSyncHash && currentSyncHash !== data.syncHash) {
          loadResources(true);
        }
        currentSyncHash = data.syncHash;
      }
    }
  } catch (e) {}
}

document.addEventListener('DOMContentLoaded', () => {
  const tabButtons = document.querySelectorAll('.student-tab-btn');
  const searchInput = document.getElementById('resourceSearchInput');
  const instSelect = document.getElementById('institutionFilterSelect');
  const sessionSelect = document.getElementById('sessionFilterSelect');
  const manualRefreshBtn = document.getElementById('scManualRefreshBtn');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeTab = btn.getAttribute('data-tab');
      if (history.replaceState) {
        history.replaceState(null, null, '#' + activeTab);
      } else {
        window.location.hash = activeTab;
      }
      loadResources(false);
    });
  });

  const initialHash = window.location.hash.replace('#', '');
  if (initialHash && ['all', 'timetables', 'syllabus', 'results', 'downloads', 'forms', 'notices'].includes(initialHash)) {
    activeTab = initialHash === 'forms' ? 'downloads' : initialHash;
    tabButtons.forEach(b => {
      if (b.getAttribute('data-tab') === activeTab) b.classList.add('active');
      else b.classList.remove('active');
    });
  }

  window.addEventListener('hashchange', () => {
    const h = window.location.hash.replace('#', '');
    const mapped = h === 'forms' ? 'downloads' : h;
    if (mapped && ['all', 'timetables', 'syllabus', 'results', 'downloads', 'notices'].includes(mapped) && mapped !== activeTab) {
      activeTab = mapped;
      tabButtons.forEach(b => {
        if (b.getAttribute('data-tab') === activeTab) b.classList.add('active');
        else b.classList.remove('active');
      });
      loadResources(false);
    }
  });

  let searchTimeout;
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => loadResources(false), 250);
    });
  }
  if (instSelect) instSelect.addEventListener('change', () => loadResources(false));
  if (sessionSelect) sessionSelect.addEventListener('change', () => loadResources(false));
  if (manualRefreshBtn) manualRefreshBtn.addEventListener('click', () => loadResources(false));

  loadResources(false);
  autoSyncTimer = setInterval(pollSyncStatus, 8000);

  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const channel = new BroadcastChannel('set_content_channel');
      channel.onmessage = () => loadResources(true);
    } catch (err) {}
  }

  window.addEventListener('storage', (e) => {
    if (e.key === 'set_content_updated') loadResources(true);
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) pollSyncStatus();
  });
});
