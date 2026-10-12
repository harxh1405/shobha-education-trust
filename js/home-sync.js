/**
 * SHOBHA EDUCATION TRUST — HOMEPAGE LIVE SYNC & NEWS DISPATCHES
 * Fetches the first 5 latest news, dispatches & circulars sorted by date.
 */

let currentSyncHash = '';
let isFetching = false;

export async function loadHomepageNews(isSilent = false) {
  const container = document.getElementById('homepageNewsList');
  if (!container || isFetching) return;
  isFetching = true;

  const syncPill = document.getElementById('homeLiveSyncPill');
  const syncStatusText = document.getElementById('homeSyncStatusText');

  if (!isSilent) {
    if (syncPill) syncPill.classList.add('syncing');
    if (syncStatusText) syncStatusText.textContent = 'Syncing...';
  }

  try {
    const res = await fetch('/api/public/all?limit=30');
    const data = await res.json();
    if (res.ok && data.success && data.items && data.items.length > 0) {
      // Sort strictly by latest publicationDate or eventStartDate descending
      const sorted = [...data.items].sort((a, b) => {
        const dateA = new Date(a.eventStartDate || a.publicationDate || a.createdAt || 0);
        const dateB = new Date(b.eventStartDate || b.publicationDate || b.createdAt || 0);
        return dateB - dateA;
      });

      // User requirement: Only display the first 5 latest ones
      const latestFive = sorted.slice(0, 5);

      container.innerHTML = latestFive.map(item => {
        const rawDate = item.eventStartDate || item.publicationDate || item.createdAt;
        const date = rawDate ? new Date(rawDate) : new Date();
        const day = String(date.getDate()).padStart(2, '0');
        const my = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase();

        const fileUrl = (item.fileAttachment && item.fileAttachment.url) ? item.fileAttachment.url : (item.documentUrl || '');
        const rawFileName = (item.fileAttachment && item.fileAttachment.originalName) ? item.fileAttachment.originalName : (item.documentName || (fileUrl ? fileUrl.split('/').pop() : ''));
        const ext = rawFileName.includes('.') ? '.' + rawFileName.split('.').pop() : '';
        const fileName = (rawFileName && rawFileName.length > 22) ? `${rawFileName.slice(0, 16)}...${ext}` : rawFileName;
        const catName = item.category || (item.contentType ? item.contentType.toUpperCase() : 'Notice');

        const docBadge = fileUrl ? `
          <div style="margin-top: 8px; max-width: 100%;">
            <span class="doc-download-pill" style="font-size: 11.5px; padding: 4px 10px; display: inline-flex; max-width: 100%; word-break: break-all;">
              📄 Attached Document: ${fileName} ↗
            </span>
          </div>
        ` : '';

        // Note: No arrows inside the individual news/event boxes per user requirement.
        return `
          <a href="news.html" class="news-editorial-item animate-fade-in" style="text-decoration: none;">
            <div class="news-date-badge">
              <span class="news-date-day">${day}</span>
              <span class="news-date-my">${my}</span>
            </div>
            <div class="news-content-col">
              <div style="display: flex; gap: 6px; align-items: center; margin-bottom: 4px; flex-wrap: wrap;">
                <span class="resource-tag" style="background: var(--color-blue-tint); color: var(--color-primary-navy); font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 2px;">${catName}</span>
                <span style="font-size: 11px; color: var(--color-text-muted);">${item.institution || 'Sarveshwaree Mahavidyalaya'}</span>
              </div>
              <h4>${item.title}</h4>
              <p>${item.summary || item.description || ''}</p>
              ${docBadge}
            </div>
          </a>
        `;
      }).join('');

      if (syncStatusText) {
        const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        syncStatusText.textContent = `Auto-Sync: Live (${nowStr})`;
      }
    }
  } catch (e) {
    if (!isSilent) console.warn('Using fallback news preview on homepage:', e);
  } finally {
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
          loadHomepageNews(true);
        }
        currentSyncHash = data.syncHash;
      }
    }
  } catch (e) {}
}

// Initial setup
document.addEventListener('DOMContentLoaded', () => {
  const manualRefreshBtn = document.getElementById('homeManualRefreshBtn');
  if (manualRefreshBtn) {
    manualRefreshBtn.addEventListener('click', () => loadHomepageNews(false));
  }

  loadHomepageNews(false);
  setInterval(pollSyncStatus, 8000);

  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const channel = new BroadcastChannel('set_content_channel');
      channel.onmessage = () => loadHomepageNews(true);
    } catch (err) {}
  }

  window.addEventListener('storage', (e) => {
    if (e.key === 'set_content_updated') loadHomepageNews(true);
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) pollSyncStatus();
  });
});
