(() => {
  'use strict';

  let injected = false;

  async function fetchData() {
    const [forges, feed] = await Promise.all([
      fetch('/api/forges').then(r => r.json()),
      fetch('/api/user/feed?latest=true').then(r => r.json()).catch(() => []),
    ]);

    let repos = [], page = 1, chunk;
    do {
      chunk = await fetch(`/api/repos?page=${page}&perPage=50`).then(r => r.json());
      repos = repos.concat(chunk);
      page++;
    } while (chunk.length === 50);

    const feedMap = new Map((feed || []).map(f => [f.repo_id, f]));
    const reposByForge = new Map();
    for (const repo of repos) {
      if (!reposByForge.has(repo.forge_id)) reposByForge.set(repo.forge_id, []);
      reposByForge.get(repo.forge_id).push({ ...repo, lastPipeline: feedMap.get(repo.id) || null });
    }

    return forges
      .map(forge => ({
        ...forge,
        repos: (reposByForge.get(forge.id) || []).sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.type.localeCompare(b.type));
  }

  function mdiSvg(cssClass, path) {
    return `<svg class="${cssClass}" viewBox="0 0 24 24" fill="currentColor"><path d="${path}"/></svg>`;
  }

  const MDI = {
    checkCircle:                   "M12 2C6.5 2 2 6.5 2 12S6.5 22 12 22 22 17.5 22 12 17.5 2 12 2M10 17L5 12L6.41 10.59L10 14.17L17.59 6.58L19 8L10 17Z",
    closeCircle:                   "M12,2C17.53,2 22,6.47 22,12C22,17.53 17.53,22 12,22C6.47,22 2,17.53 2,12C2,6.47 6.47,2 12,2M15.59,7L12,10.59L8.41,7L7,8.41L10.59,12L7,15.59L8.41,17L12,13.41L15.59,17L17,15.59L13.41,12L17,8.41L15.59,7Z",
    radioboxIndeterminate:         "M8.46 8.46C9.4 7.53 10.67 7 12 7C13.33 7 14.6 7.53 15.54 8.46L8.46 15.54C7.53 14.6 7 13.33 7 12C7 10.67 7.53 9.4 8.46 8.46M8.17 2.76C9.39 2.26 10.69 2 12 2C13.31 2 14.61 2.26 15.83 2.76C17.04 3.26 18.14 4 19.07 4.93C20 5.86 20.74 6.96 21.24 8.17C21.74 9.39 22 10.69 22 12C22 14.65 20.95 17.2 19.07 19.07C17.2 20.95 14.65 22 12 22C10.69 22 9.39 21.74 8.17 21.24C6.96 20.74 5.86 20 4.93 19.07C3.05 17.2 2 14.65 2 12C2 9.35 3.05 6.8 4.93 4.93C5.86 4 6.96 3.26 8.17 2.76M6.34 17.66C7.84 19.16 9.88 20 12 20C14.12 20 16.16 19.16 17.66 17.66C19.16 16.16 20 14.12 20 12C20 9.88 19.16 7.84 17.66 6.34C16.16 4.84 14.12 4 12 4C9.88 4 7.84 4.84 6.34 6.34C4.84 7.84 4 9.88 4 12C4 14.12 4.84 16.16 6.34 17.66Z",
    radioboxBlank:                 "M12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z",
    minusCircle:                   "M17,13H7V11H17M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z",
    playCircle:                    "M10,16.5V7.5L16,12M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z",
    stopCircle:                    "M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M9,9H15V15H9",
  };

  const STATUS_ICON = {
    success:  mdiSvg("wpc-status text-wp-state-ok-100",  MDI.checkCircle),
    failure:  mdiSvg("wpc-status text-wp-error-100",  MDI.closeCircle),
    error:    mdiSvg("wpc-status text-wp-error-100",  MDI.closeCircle),
    killed:   mdiSvg("wpc-status text-wp-state-neutral-100",  MDI.closeCircle),
    running:  mdiSvg("wpc-status text-wp-state-info-100",  MDI.radioboxIndeterminate),
    started:  mdiSvg("wpc-status text-wp-state-info-100",  MDI.radioboxIndeterminate),
    pending:  mdiSvg("wpc-status text-wp-state-warn-100",  MDI.radioboxBlank),
    created:  mdiSvg("wpc-status text-wp-state-warn-100",  MDI.radioboxBlank),
    skipped:  mdiSvg("wpc-status text-wp-state-neutral-100",  MDI.minusCircle),
    canceled: mdiSvg("wpc-status text-wp-state-neutral-100",  MDI.minusCircle),
    blocked:  mdiSvg("wpc-status text-wp-state-neutral-100",  MDI.playCircle),
    declined: mdiSvg("wpc-status text-wp-error-100",  MDI.stopCircle),
  };

  function timeAgo(ts) {
    if (!ts) return '';
    const s = Math.floor((Date.now() / 1000) - ts);
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  }

  function renderRepo(repo) {
    const p = repo.lastPipeline;
    const icon = p ? (STATUS_ICON[p.status] || STATUS_ICON.pending) : '';
    const meta = p
      ? `<span class="wpc-pipeline-msg">${p.message || p.event || ''}</span><span class="wpc-pipeline-time">${timeAgo(p.started)}</span>`
      : '<span class="wpc-pipeline-msg wpc-pipeline-msg--none">No pipelines</span>';

    return `
      <a class="wpc-repo-card" href="/repos/${repo.id}">
        <div class="wpc-repo-top">
          <span class="wpc-repo-name">${repo.full_name}</span>
          ${repo.private ? `<svg class="wpc-lock" viewBox="0 0 16 16" fill="currentColor"><path d="M11 6V5a3 3 0 0 0-6 0v1H3v8h10V6h-2zm-4-1a1 1 0 0 1 2 0v1H7V5z"/></svg>` : ''}
        </div>
        <div class="wpc-repo-bottom">${icon}${meta}</div>
      </a>`;
  }

  function renderBody(data) {
    if (!data.length) return '<div class="wpc-empty">No forges found</div>';

    return data.map(forge => {
      const forgeLabel = forge
        ? `<span class="wpc-forge-label">${forge.url}</span>`
        : '';
      const cards = forge.repos.length
        ? `<div class="wpc-repo-grid">${forge.repos.map(renderRepo).join('')}</div>`
        : '<div class="wpc-empty-forge">No repos</div>';

      return `
        <div class="wpc-forge">
          <div class="wpc-forge-header">
            <span class="wpc-forge-type">${forge.type}</span>
            ${forgeLabel}
          </div>
          ${cards}
        </div>`;
    }).join('');
  }

  function buildModal() {
    const el = document.createElement('dialog');
    el.id = 'wpc-modal';
    el.innerHTML = `
      <div class="wpc-modal-inner">
        <div class="wpc-modal-header">
          <span>Forges</span>
          <button class="wpc-close" id="wpc-close" aria-label="Close">✕</button>
        </div>
        <div class="wpc-modal-body" id="wpc-modal-body">
          <div class="wpc-loading">Loading…</div>
        </div>
      </div>
    `;
    return el;
  }

  function openModal(modal) {
    modal.showModal();
    fetchData()
      .then(data => { document.getElementById('wpc-modal-body').innerHTML = renderBody(data); })
      .catch(e => { console.error(e);document.getElementById('wpc-modal-body').innerHTML = '<div class="wpc-empty">Failed to load. Are you logged in?</div>'; });
  }

  function extension() {
    if (injected) return;
    const nav = document.querySelector('nav');
    if (!nav) return;
    injected = true;

    const navItem = document.createElement('div');
    navItem.id = 'wpc-nav-item';
    navItem.innerHTML = `
      <button class="wpc-trigger" id="wpc-trigger" title="Repositories by forge">
        Forges
        <svg class="wpc-chevron" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    `;

    const first = nav.firstElementChild;
    nav.insertBefore(navItem, first.nextSibling);

    const modal = buildModal();
    document.body.appendChild(modal);

    document.getElementById('wpc-trigger').addEventListener('click', () => openModal(modal));
    document.getElementById('wpc-close').addEventListener('click', () => modal.close());
    modal.addEventListener('click', e => {
      if (e.target === modal) { modal.close(); return; }
      const link = e.target.closest('a');
      if (link) {modal.close();}
    });
  }

  const observer = new MutationObserver(() => {
    if (!injected && document.querySelector('nav')) {
      extension();
      if (injected) observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
