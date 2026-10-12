/**
 * SHOBHA EDUCATION TRUST — NEWS, CIRCULARS & DISPATCHES CLIENT CONTROLLER
 * Full editorial dynamic dispatches with category filtering and auto-sync
 */

let currentCategory = 'all';
let currentSyncHash = '';
let isFetching = false;
let autoSyncTimer = null;

export async function loadDynamicNews(category = 'all', isSilent = false) {
  const container = document.getElementById('newsEditorialList');
  const syncPill = document.getElementById('newsLiveSyncPill');
  const syncStatusText = document.getElementById('newsSyncStatusText');

  if (!container || isFetching) return;
  isFetching = true;

  if (!isSilent) {
    if (!container.children.length || container.querySelector('.skeleton-card')) {
      container.innerHTML = `
        <div class="skeleton-card api-fade-in">
          <div class="skeleton-shimmer skeleton-line subtitle"></div>
          <div class="skeleton-shimmer skeleton-line title"></div>
          <div class="skeleton-shimmer skeleton-line desc"></div>
        </div>
        <div class="skeleton-card api-fade-in">
          <div class="skeleton-shimmer skeleton-line subtitle" style="width: 25%;"></div>
          <div class="skeleton-shimmer skeleton-line title" style="width: 50%;"></div>
          <div class="skeleton-shimmer skeleton-line desc" style="width: 80%;"></div>
        </div>
        <div class="skeleton-card api-fade-in">
          <div class="skeleton-shimmer skeleton-line subtitle" style="width: 30%;"></div>
          <div class="skeleton-shimmer skeleton-line title" style="width: 65%;"></div>
          <div class="skeleton-shimmer skeleton-line desc" style="width: 90%;"></div>
        </div>
      `;
    } else {
      container.classList.add('feed-loading');
    }
    if (syncPill) syncPill.classList.add('syncing');
    if (syncStatusText) syncStatusText.textContent = 'Syncing...';
  }

  try {
    let url = '/api/public/news-and-events?limit=40';
    if (category && category !== 'all') {
      url += `&category=${encodeURIComponent(category)}`;
    }

    const res = await fetch(url);
    const data = await res.json();
    if (res.ok && data.success && data.items && data.items.length > 0) {
      container.innerHTML = data.items.map(item => {
        const rawDate = item.eventStartDate || item.publicationDate || item.createdAt;
        const date = rawDate ? new Date(rawDate) : new Date();
        const day = String(date.getDate()).padStart(2, '0');
        const my = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase();

        const fileUrl = (item.fileAttachment && item.fileAttachment.url) ? item.fileAttachment.url : (item.documentUrl || '');
        const rawFileName = (item.fileAttachment && item.fileAttachment.originalName) ? item.fileAttachment.originalName : (item.documentName || (fileUrl ? fileUrl.split('/').pop() : ''));
        const ext = rawFileName.includes('.') ? '.' + rawFileName.split('.').pop() : '';
        const fileName = (rawFileName && rawFileName.length > 24) ? `${rawFileName.slice(0, 18)}...${ext}` : rawFileName;
        const fileSize = (item.fileAttachment && item.fileAttachment.sizeBytes) ? ` (${Math.round(item.fileAttachment.sizeBytes / 1024)} KB)` : '';

        const fileLink = fileUrl ? `
          <div style="margin-top: 12px; width: 100%; max-width: 100%;">
            <a href="${fileUrl}" target="_blank" class="doc-download-pill" style="text-decoration: none;" title="Download verified circular document: ${rawFileName}">
              <span>📄 View / Download Attached Document ↗</span>
              <span class="doc-size-badge">${fileName}${fileSize}</span>
            </a>
          </div>
        ` : '';

        const typeLabel = item.contentType ? item.contentType.toUpperCase() : 'NOTICE';
        const noticeRef = item.noticeNumber ? `Ref: <strong>${item.noticeNumber}</strong> • ` : '';
        const venueInfo = item.venue ? `📍 Venue: <strong>${item.venue}</strong> • ` : '';

        return `
          <article class="news-editorial-item animate-fade-in">
            <div class="news-date-badge">
              <span class="news-date-day">${day}</span>
              <span class="news-date-my">${my}</span>
            </div>
            <div class="news-content-col">
              <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 6px; flex-wrap: wrap;">
                <span class="resource-tag" style="background: var(--color-blue-tint); color: var(--color-primary-navy); font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: 2px;">${typeLabel}</span>
                <span style="font-size: 12px; color: var(--color-text-muted);">${item.category || 'Institutional'}</span>
              </div>
              <h4 style="font-size: 18px; margin-bottom: 6px; color: var(--color-primary-navy);">${item.title}</h4>
              <p style="font-size: 14px; color: var(--color-text-secondary); line-height: 1.55; margin-bottom: 8px;">${item.summary || item.description || ''}</p>
              <div style="font-size: 12.5px; color: var(--color-supporting-blue); font-weight: 600;">
                ${noticeRef}${venueInfo}${item.institution || 'Sarveshwaree Mahavidyalaya'}
              </div>
              ${fileLink}
            </div>
          </article>
        `;
      }).join('');

      if (syncStatusText) {
        const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        syncStatusText.textContent = `Auto-Sync: Live (${nowStr})`;
      }
    } else {
      container.innerHTML = `
        <div style="background: #FFFFFF; border: 1px solid var(--color-border); border-radius: 4px; padding: 36px; text-align: center;">
          <h4 style="font-size: 16px; color: var(--color-primary-navy); margin-bottom: 6px;">No Dispatches in this Section</h4>
          <p style="font-size: 13.5px; color: var(--color-text-muted); margin: 0;">Currently there are no circulars or events published under this category. Any new uploads from the server will automatically appear here.</p>
        </div>
      `;
    }
  } catch (e) {
    if (!isSilent) console.warn('Fallback loading dispatches:', e);
  } finally {
    container.classList.remove('feed-loading');
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
          loadDynamicNews(currentCategory, true);
        }
        currentSyncHash = data.syncHash;
      }
    }
  } catch (e) {}
}

document.addEventListener('DOMContentLoaded', () => {
  const manualRefreshBtn = document.getElementById('newsManualRefreshBtn');
  if (manualRefreshBtn) {
    manualRefreshBtn.addEventListener('click', () => {
      loadDynamicNews(currentCategory, false);
    });
  }

  document.querySelectorAll('.filter-pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCategory = btn.getAttribute('data-category') || 'all';
      loadDynamicNews(currentCategory, false);
    });
  });

  loadDynamicNews('all', false);
  autoSyncTimer = setInterval(pollSyncStatus, 8000);

  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const channel = new BroadcastChannel('set_content_channel');
      channel.onmessage = () => loadDynamicNews(currentCategory, true);
    } catch (err) {}
  }

  window.addEventListener('storage', (e) => {
    if (e.key === 'set_content_updated') {
      loadDynamicNews(currentCategory, true);
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) pollSyncStatus();
  });
});
