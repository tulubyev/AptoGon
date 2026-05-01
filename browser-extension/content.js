// HSI Verified Human — Content Script
// Injects the Verified Human badge next to username elements on supported sites

(function () {
  'use strict';

  // Don't run on HSI own pages
  if (
    location.hostname.includes('homosapience.org') ||
    location.hostname === 'localhost'
  ) return;

  // ─── Site-specific selectors ───────────────────────────────────────────────
  const SITE_CONFIGS = [
    // GitHub
    {
      match: /github\.com/,
      selectors: [
        'span.p-name',            // profile name
        '.author a',              // issue/PR author
        '.timeline-comment-header .author',
        'a.user-mention',
        '.commit-author',
      ],
      type: 'inline',
    },
    // Reddit (new UI)
    {
      match: /reddit\.com/,
      selectors: [
        'a[data-testid="post_author_link"]',
        'a[data-testid="comment_author_link"]',
        'span[data-testid="post-author-username"]',
      ],
      type: 'inline',
    },
    // Twitter / X
    {
      match: /(twitter|x)\.com/,
      selectors: [
        '[data-testid="User-Name"] span',
        '[data-testid="UserName"] span',
      ],
      type: 'inline',
    },
    // Hacker News
    {
      match: /news\.ycombinator\.com/,
      selectors: ['.hnuser', 'a.hnuser'],
      type: 'inline',
    },
    // Discord web
    {
      match: /discord\.com/,
      selectors: [
        'span[class*="username"]',
        'h3[class*="name"]',
      ],
      type: 'inline',
    },
    // Telegram web
    {
      match: /web\.telegram\.org/,
      selectors: [
        '.peer-title',
        '.info .peer-title',
      ],
      type: 'inline',
    },
  ];

  // ─── Badge SVG (inline, no external request needed) ────────────────────────
  function createBadgeElement(credential) {
    const badge = document.createElement('span');
    badge.className = 'hsi-badge';
    badge.setAttribute('title', `Verified Human · ${credential.did?.slice(0, 20)}... · Confidence: ${Math.round((credential.confidence ?? 0) * 100)}% · ${credential.daysLeft}d left`);
    badge.setAttribute('aria-label', 'Verified Human by HSI');
    badge.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 3px;
      margin-left: 5px;
      padding: 1px 6px;
      background: linear-gradient(135deg, #7c3aed, #06b6d4);
      border-radius: 20px;
      font-size: 10px;
      font-weight: 700;
      color: white;
      font-family: Inter, system-ui, sans-serif;
      vertical-align: middle;
      cursor: pointer;
      text-decoration: none;
      white-space: nowrap;
      box-shadow: 0 1px 3px rgba(124,58,237,0.3);
      line-height: 1.6;
      position: relative;
      z-index: 9999;
    `;
    badge.textContent = '✦ Human';

    // Click opens info tooltip
    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      showBadgeTooltip(badge, credential);
    });

    return badge;
  }

  // ─── Tooltip overlay ───────────────────────────────────────────────────────
  let activeTooltip = null;

  function showBadgeTooltip(anchor, credential) {
    if (activeTooltip) activeTooltip.remove();

    const tooltip = document.createElement('div');
    tooltip.className = 'hsi-tooltip';

    const did = credential.did ?? 'unknown';
    const shortDid = did.length > 20 ? did.slice(0, 16) + '...' + did.slice(-6) : did;
    const conf = Math.round((credential.confidence ?? 0) * 100);
    const issued = credential.issuanceDate
      ? new Date(credential.issuanceDate).toLocaleDateString()
      : '—';
    const daysLeft = credential.daysLeft ?? '?';

    tooltip.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#06b6d4);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">✦</div>
        <div>
          <div style="font-weight:800;font-size:13px;color:#111827;">Verified Human</div>
          <div style="font-size:10px;color:#7c3aed;font-weight:600;">HSI · homosapience.org</div>
        </div>
      </div>
      <div style="background:#f9fafb;border-radius:8px;padding:10px 12px;margin-bottom:10px;font-size:11px;line-height:1.8;">
        <div><span style="color:#9ca3af;">DID:</span> <span style="font-family:monospace;color:#374151;">${shortDid}</span></div>
        <div><span style="color:#9ca3af;">Confidence:</span> <span style="color:#059669;font-weight:700;">${conf}%</span></div>
        <div><span style="color:#9ca3af;">Verified:</span> <span style="color:#374151;">${issued}</span></div>
        <div><span style="color:#9ca3af;">Valid for:</span> <span style="color:#374151;">${daysLeft} days</span></div>
      </div>
      <div style="font-size:10px;color:#9ca3af;text-align:center;">
        Gesture biometrics · Ed25519 · Aptos on-chain
      </div>
    `;

    tooltip.style.cssText = `
      position: fixed;
      z-index: 2147483647;
      background: white;
      border: 1.5px solid #e9d5ff;
      border-radius: 14px;
      padding: 14px 16px;
      width: 240px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.15);
      font-family: Inter, system-ui, sans-serif;
    `;

    document.body.appendChild(tooltip);
    activeTooltip = tooltip;

    // Position near anchor
    const rect = anchor.getBoundingClientRect();
    const tooltipLeft = Math.min(rect.left, window.innerWidth - 260);
    const tooltipTop = rect.bottom + 8;
    tooltip.style.left = tooltipLeft + 'px';
    tooltip.style.top = tooltipTop + 'px';

    // Close on outside click
    setTimeout(() => {
      document.addEventListener('click', () => {
        tooltip.remove();
        activeTooltip = null;
      }, { once: true });
    }, 0);
  }

  // ─── Main injection logic ──────────────────────────────────────────────────
  let credential = null;
  let injectedCount = 0;
  const INJECTED_ATTR = 'data-hsi-badge';

  function injectBadges() {
    if (!credential || credential.status !== 'valid') return;

    const hostname = location.hostname;
    const config = SITE_CONFIGS.find(c => c.match.test(hostname));
    if (!config) return;

    for (const selector of config.selectors) {
      const elements = document.querySelectorAll(selector + `:not([${INJECTED_ATTR}])`);
      elements.forEach(el => {
        el.setAttribute(INJECTED_ATTR, '1');
        const badge = createBadgeElement(credential);
        el.parentNode?.insertBefore(badge, el.nextSibling);
        injectedCount++;
      });
    }
  }

  // Request credential from background
  function init() {
    chrome.runtime.sendMessage({ type: 'GET_CREDENTIAL' }, (response) => {
      if (chrome.runtime.lastError) return;
      credential = response;

      if (credential.status === 'valid') {
        injectBadges();

        // Watch for dynamic content (SPAs)
        const observer = new MutationObserver(() => injectBadges());
        observer.observe(document.body, { childList: true, subtree: true });
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
