const path         = window.location.pathname;
const isDetailPage = /\/courses\/\d+\/assignments\/\d+/.test(path) || path.includes('mock-assignment-detail');
const isListPage   = /\/courses\/\d+\/assignments\/?(\?.*)?$/.test(path)  || path.includes('mock-assignment-list');

if (isDetailPage) {
  waitForElement('#assignment_show, .assignment-title, h1.title', injectDetailButton);
} else if (isListPage) {
  injectListButtons();
  observeAssignmentList();
}

// ── Detail page ───────────────────────────────────────────────────────────────

function injectDetailButton() {
  if (document.querySelector('.ctd-btn')) return;

  const titleEl =
    document.querySelector('#assignment_show h1') ||
    document.querySelector('h1.title') ||
    document.querySelector('.assignment-title h1') ||
    document.querySelector('h1');
  if (!titleEl) return;

  const btn     = createButton(extractDetailData());
  const wrapper = document.createElement('span');
  wrapper.className = 'ctd-btn-wrapper ctd-detail';
  wrapper.appendChild(btn);
  titleEl.after(wrapper);
}

function extractDetailData() {
  const titleEl =
    document.querySelector('#assignment_show h1') ||
    document.querySelector('h1.title') ||
    document.querySelector('h1');

  const descEl =
    document.querySelector('#assignment_show .description') ||
    document.querySelector('.assignment-description') ||
    document.querySelector('[data-testid="assignment-description"]') ||
    document.querySelector('.user_content');

  const dueDateEl =
    document.querySelector('.assignment-date-due .date_text') ||
    document.querySelector('.due_date_display') ||
    document.querySelector('[data-testid="due-dates"] time') ||
    document.querySelector('.assignment_dates .date_text') ||
    document.querySelector('time[data-testid]');

  return {
    title:      titleEl?.textContent?.trim() || document.title,
    description: descEl?.innerHTML?.trim()   || null,
    dueDateRaw: dueDateEl?.getAttribute('datetime') || dueDateEl?.textContent?.trim() || null,
  };
}

// ── List page ─────────────────────────────────────────────────────────────────

function injectListButtons() {
  const rows = document.querySelectorAll(
    '.assignment.ig-published, li.assignment, .ig-row, [data-testid="assignment-list-item"]'
  );

  rows.forEach((row) => {
    if (row.querySelector('.ctd-btn')) return;

    const titleAnchor =
      row.querySelector('.ig-title a') ||
      row.querySelector('.title a') ||
      row.querySelector('a[href*="/assignments/"]');
    if (!titleAnchor) return;

    const dueDateEl =
      row.querySelector('.due_date_display') ||
      row.querySelector('.assignment-date-due .date_text') ||
      row.querySelector('[class*="due"]');

    const btn     = createButton({
      title:      titleAnchor.textContent.trim(),
      description: null,
      dueDateRaw: dueDateEl?.getAttribute('datetime') || dueDateEl?.textContent?.trim() || null,
    });
    const wrapper = document.createElement('span');
    wrapper.className = 'ctd-btn-wrapper ctd-list';
    wrapper.appendChild(btn);
    titleAnchor.after(wrapper);
  });
}

function observeAssignmentList() {
  const target = document.querySelector('#content, #assignment_group_list, main') || document.body;
  new MutationObserver(injectListButtons).observe(target, { childList: true, subtree: true });
}

// ── Button ────────────────────────────────────────────────────────────────────

function createButton(data) {
  const btn = document.createElement('button');
  btn.className = 'ctd-btn';
  btn.title = 'Add to Microsoft To Do';
  btn.setAttribute('aria-label', `Add "${data.title}" to Microsoft To Do`);
  setButtonState(btn, 'idle');
  btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); handleAddToTodo(btn, data); });
  return btn;
}

async function handleAddToTodo(btn, data) {
  setButtonState(btn, 'loading');
  try {
    const res = await chrome.runtime.sendMessage({
      type: 'ADD_TASK',
      data: { title: data.title, description: data.description, dueDateTime: parseDueDate(data.dueDateRaw) },
    });
    if (res.success) {
      setButtonState(btn, 'success');
      showToast('Added to Microsoft To Do!', 'success');
      setTimeout(() => setButtonState(btn, 'idle'), 3000);
    } else {
      throw new Error(res.error);
    }
  } catch (err) {
    setButtonState(btn, 'idle');
    if (err.message?.includes('NOT_AUTHENTICATED')) {
      showToast('Please sign in — click the extension icon.', 'error');
    } else {
      showToast(`Error: ${err.message}`, 'error');
    }
  }
}

function setButtonState(btn, state) {
  btn.dataset.state = state;
  btn.disabled = state === 'loading';
  btn.innerHTML = {
    idle: `<svg class="ctd-icon" viewBox="0 0 20 20" fill="none"><path d="M9 1a8 8 0 100 16A8 8 0 009 1zm3.54 6.46l-4 4a.75.75 0 01-1.06 0l-2-2a.75.75 0 111.06-1.06L8 9.94l3.47-3.47a.75.75 0 111.06 1.06z" fill="currentColor"/></svg><span>Add to To Do</span>`,
    loading: `<span class="ctd-spinner"></span><span>Adding…</span>`,
    success: `<svg class="ctd-icon" viewBox="0 0 20 20" fill="none"><path d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" fill="currentColor"/></svg><span>Added!</span>`,
  }[state] || '';
}

// ── Due date ──────────────────────────────────────────────────────────────────

function parseDueDate(raw) {
  if (!raw) return null;
  const d = new Date(/^\d{4}-\d{2}-\d{2}/.test(raw) ? raw : raw.replace(' at ', ' ').replace(/(\d)(am|pm)/i, '$1 $2'));
  return isNaN(d) ? null : d.toISOString().replace('Z', '');
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function showToast(message, type = 'success') {
  document.querySelector('.ctd-toast')?.remove();
  const toast = Object.assign(document.createElement('div'), {
    className: `ctd-toast ctd-toast--${type}`,
    textContent: message,
  });
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('ctd-toast--visible'));
  setTimeout(() => { toast.classList.remove('ctd-toast--visible'); setTimeout(() => toast.remove(), 300); }, 4000);
}

// ── Utility ───────────────────────────────────────────────────────────────────

function waitForElement(selector, callback, timeout = 5000) {
  if (document.querySelector(selector)) return callback();
  const observer = new MutationObserver(() => {
    if (document.querySelector(selector)) { observer.disconnect(); callback(); }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), timeout);
}
