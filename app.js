// app.js — Frontend-only logic for Cloud Airlines policy portal
// Uses mock data by default. Replace placeholder API functions with real AWS Cognito / API Gateway calls.

/* --------------------------- Mock data --------------------------- */
const MOCK_USERS = [
  { email: 'demo@cloudairlines.com', password: 'Password123', name: 'Demo User' }
];

const MOCK_DEPARTMENTS = [
  { id: 'hr', name: 'Human Resources', description: 'Policies for employees, benefits, and payroll.' },
  { id: 'rev', name: 'Reservations', description: 'Booking and reservation policies.' },
  { id: 'sal', name: 'Sales', description: 'Ticket sales and customer service policies.' }
];

const MOCK_DOCUMENTS = {
  hr: [
    { id: 'hr-1', title: 'Code of Conduct', updated: '2026-01-01' },
    { id: 'hr-2', title: 'Leave Policy', updated: '2025-11-10' }
  ],
  rev: [
    { id: 'rev-1', title: 'Booking Policy', updated: '2026-01-15' },
    { id: 'rev-2', title: 'Reservation Policy', updated: '2025-09-20' }
  ],
  sal: [
    { id: 'sal-1', title: 'Customer Service Policy', updated: '2025-12-01' },
    { id: 'sal-2', title: 'Ticketing and Sales', updated: '2026-01-05' }
  ]
};

/* ---------------------- Placeholder API functions ---------------------- */
// These functions mimic async API calls. Replace them with real calls to AWS Cognito and API Gateway.

function apiAuth(email, password) {
  // Placeholder: resolve with user object if credentials match mock, otherwise reject.
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const u = MOCK_USERS.find(x => x.email.toLowerCase() === email.toLowerCase() && x.password === password);
      if (u) resolve({ email: u.email, name: u.name });
      else reject(new Error('Invalid email or password'));
    }, 600);
  });
}

function apiFetchDepartments() {
  return new Promise((resolve) => setTimeout(() => resolve(MOCK_DEPARTMENTS), 300));
}

function apiFetchDocumentsForDept(deptId) {
  return new Promise((resolve) => setTimeout(() => resolve(MOCK_DOCUMENTS[deptId] || []), 300));
}

function apiFetchDocument(docId) {
  return new Promise((resolve) => {
    setTimeout(() => {
      // find doc in MOCK_DOCUMENTS
      for (const k of Object.keys(MOCK_DOCUMENTS)) {
        const d = MOCK_DOCUMENTS[k].find(x => x.id === docId);
        if (d) return resolve(Object.assign({ department: k }, d));
      }
      resolve(null);
    }, 300);
  });
}

/* ---------------------- DOM / App logic ---------------------- */

// Shared helpers
function qs(sel, root = document) { return root.querySelector(sel); }
function qsa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

/* ---------------------- Login page logic ---------------------- */
if (document.getElementById('login-form')) {
  const form = document.getElementById('login-form');
  const errEl = document.getElementById('login-error');

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    errEl.hidden = true;
    const email = form.email.value.trim();
    const password = form.password.value;

    if (!email || !password) {
      errEl.textContent = 'Please enter both email and password.';
      errEl.hidden = false;
      return;
    }

    try {
      const user = await apiAuth(email, password);
      // store user info in localStorage for demo; in production use secure tokens
      localStorage.setItem('cloud_user', JSON.stringify(user));
      // redirect to dashboard
      window.location.href = 'dashboard.html';
    } catch (err) {
      errEl.textContent = err.message || 'Sign in failed.';
      errEl.hidden = false;
    }
  });
}

/* ---------------------- Dashboard page logic ---------------------- */
if (document.getElementById('dept-list') || document.getElementById('folders')) {
  // ensure user present
  const user = (() => {
    try { return JSON.parse(localStorage.getItem('cloud_user')); } catch(e){return null}
  })();
  if (!user) {
    // Not signed in, send back to login
    window.location.href = 'index.html';
  } else {
    // populate header
    const userEl = document.getElementById('user-email');
    if (userEl) userEl.textContent = user.email || user.name || '';

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('cloud_user');
      window.location.href = 'index.html';
    });

    // load departments and render folders
    (async function initDashboard(){
      try {
        const depts = await apiFetchDepartments();
        renderDepartmentList(depts);
        renderFolders(depts);
      } catch (err) {
        console.error('Failed to load departments', err);
      }
    })();
  }
}

function renderDepartmentList(depts) {
  const list = document.getElementById('dept-list');
  if (!list) return;
  list.innerHTML = '';
  depts.forEach(d => {
    const a = document.createElement('a');
    a.href = '#';
    a.textContent = d.name;
    a.setAttribute('data-id', d.id);
    a.addEventListener('click', (ev) => { ev.preventDefault(); onDeptClick(d); });
    list.appendChild(a);
  });
}

/* ---------------------- Search functionality ---------------------- */
const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');

if (searchForm && searchInput) {
  let debounceTimer = null;
  searchInput.addEventListener('input', (ev) => {
    const q = ev.target.value.trim();
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => performSearch(q), 250);
  });

  searchForm.addEventListener('submit', (ev) => { ev.preventDefault(); performSearch(searchInput.value.trim()); });
}

async function performSearch(query) {
  const folders = document.getElementById('folders');
  const docsArea = document.getElementById('documents');

  if (!query) {
    // reset
    if (searchResults) searchResults.hidden = true;
    if (folders) folders.hidden = false;
    if (docsArea) docsArea.hidden = true;
    return;
  }

  if (folders) folders.hidden = true;
  if (docsArea) docsArea.hidden = true;
  if (searchResults) {
    searchResults.hidden = false;
    searchResults.innerHTML = '<div class="muted">Searching&hellip;</div>';
  }

  // simple client-side search across MOCK_DOCUMENTS
  const results = [];
  for (const dept of Object.keys(MOCK_DOCUMENTS)) {
    for (const doc of MOCK_DOCUMENTS[dept]) {
      if (doc.title.toLowerCase().includes(query.toLowerCase())) {
        results.push({ department: dept, ...doc });
      }
    }
  }

  if (!searchResults) return;
  if (results.length === 0) {
    searchResults.innerHTML = `<div class="muted">No policies found for "${escapeHtml(query)}".</div>`;
    return;
  }

  searchResults.innerHTML = '';
  results.forEach(r => {
    const item = document.createElement('div');
    item.className = 'item';
    item.innerHTML = `<strong>${escapeHtml(r.title)}</strong> <div class="meta">${escapeHtml(r.department.toUpperCase())} · Updated ${escapeHtml(r.updated)}</div>`;
    const open = document.createElement('a');
    open.href = '#';
    open.textContent = 'Open';
    open.style.float = 'right';
    open.addEventListener('click', (ev) => { ev.preventDefault(); onOpenDocument(r.id); });
    item.appendChild(open);
    searchResults.appendChild(item);
  });
}

function renderFolders(depts) {
  const container = document.getElementById('folders');
  if (!container) return;
  container.innerHTML = '';
  depts.forEach(d => {
    const card = document.createElement('div');
    card.className = 'folder-card';
    card.innerHTML = `<h3>${escapeHtml(d.name)}</h3><div class="muted">${escapeHtml(d.description)}</div>`;
    card.addEventListener('click', () => onDeptClick(d));
    container.appendChild(card);
  });
}

async function onDeptClick(dept) {
  const title = document.getElementById('current-dept');
  if (title) title.textContent = dept.name;

  const docsArea = document.getElementById('documents');
  const folders = document.getElementById('folders');
  if (folders) folders.hidden = true;
  if (docsArea) docsArea.hidden = false;

  docsArea.innerHTML = '<div class="muted">Loading documents...</div>';
  try {
    const docs = await apiFetchDocumentsForDept(dept.id);
    if (!docs || docs.length === 0) {
      docsArea.innerHTML = '<div class="muted">No documents found.</div>';
      return;
    }

    docsArea.innerHTML = '';
    docs.forEach(doc => {
      const d = document.createElement('div');
      d.className = 'doc-item';
      d.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><div>
        <strong>${escapeHtml(doc.title)}</strong>
        <div class="meta">Updated: ${escapeHtml(doc.updated)}</div>
      </div>
      <div><a href="#" data-id="${doc.id}" class="open-doc">Open</a></div></div>`;

      const link = d.querySelector('.open-doc');
      link.addEventListener('click', async (ev) => {
        ev.preventDefault();
        await onOpenDocument(doc.id);
      });

      docsArea.appendChild(d);
    });
  } catch (err) {
    docsArea.innerHTML = `<div class="error">Failed to load documents: ${escapeHtml(err.message || '')}</div>`;
  }
}

async function onOpenDocument(docId) {
  // In a real app we'd fetch the document content via API/Gateway.
  const doc = await apiFetchDocument(docId);
  if (!doc) {
    alert('Document not found.');
    return;
  }

  // For now show a simple placeholder modal via window.alert (keep frontend-only simple)
  alert(`${doc.title}\n\nDepartment: ${doc.department}\nLast updated: ${doc.updated}\n\n(This is a placeholder; replace with a document viewer or PDF loader.)`);
}

/* ---------------------- Utilities ---------------------- */
function escapeHtml(s){
  if (!s && s !== 0) return '';
  return String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
}

/* ---------------------- Update Policies modal & logic ---------------------- */
// Elements
const updateBtn = document.getElementById('update-btn');
const updateModal = document.getElementById('update-modal');
const updateDept = document.getElementById('update-dept');
const updateDoc = document.getElementById('update-doc');
const updateForm = document.getElementById('update-form');
const updateCancel = document.getElementById('update-cancel');

function getCurrentUser(){ try { return JSON.parse(localStorage.getItem('cloud_user')); } catch(e){ return null } }

// Open modal, populate departments/docs
function updatePolicies(){
  if (!updateModal) return;
  populateUpdateDepartments();
  updateModal.setAttribute('aria-hidden','false');
  updateModal.classList.add('show');
  setTimeout(()=> { if (updateDept) updateDept.focus(); }, 10);
}

function closeUpdateModal(){
  if (!updateModal) return;
  updateModal.setAttribute('aria-hidden','true');
  updateModal.classList.remove('show');
  if (updateForm) updateForm.reset();
}

function populateUpdateDepartments(){
  if (!updateDept) return;
  updateDept.innerHTML = '';
  MOCK_DEPARTMENTS.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.id; opt.textContent = d.name; updateDept.appendChild(opt);
  });
  populateUpdateDocs(updateDept.value || (MOCK_DEPARTMENTS[0] && MOCK_DEPARTMENTS[0].id));
}

function populateUpdateDocs(deptId){
  if (!updateDoc) return;
  updateDoc.innerHTML = '';
  const docs = MOCK_DOCUMENTS[deptId] || [];
  if (!docs.length){ const opt = document.createElement('option'); opt.value=''; opt.textContent='No documents available'; opt.disabled=true; updateDoc.appendChild(opt); return; }
  docs.forEach(doc => { const opt = document.createElement('option'); opt.value=doc.id; opt.textContent=doc.title; updateDoc.appendChild(opt); });
}

if (updateDept) updateDept.addEventListener('change',(e)=> populateUpdateDocs(e.target.value));
if (updateCancel) updateCancel.addEventListener('click',(e)=>{ e.preventDefault(); closeUpdateModal(); });
if (updateForm) updateForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const user = getCurrentUser();
  const payload = {
    user: user ? user.email : 'unknown',
    deptId: updateDept ? updateDept.value : '',
    docId: updateDoc ? updateDoc.value : '',
    comment: document.getElementById('update-comment') ? document.getElementById('update-comment').value.trim() : '',
    timestamp: new Date().toISOString()
  };
  try {
    await apiSubmitUpdateRequest(payload);
    closeUpdateModal();
    showToast('Update request submitted. Thank you.');
  } catch (err) {
    console.error('updatePolicies error', err);
    showToast('Failed to submit update request.');
  }
});

async function apiSubmitUpdateRequest(payload){
  // Placeholder: replace with API call to API Gateway + Lambda
  console.log('Submitting update request:', payload);
  return new Promise((resolve)=> setTimeout(resolve, 700));
}

function showToast(msg){
  let t = document.getElementById('toast');
  if (!t){ t = document.createElement('div'); t.id='toast'; t.className='toast'; t.setAttribute('role','status'); document.body.appendChild(t); }
  t.textContent = msg; t.hidden = false; t.style.opacity='1';
  setTimeout(()=>{ t.style.opacity='0'; setTimeout(()=> t.hidden = true, 400); }, 3000);
}

// wire update button
if (updateBtn) updateBtn.addEventListener('click', (ev)=>{ ev.preventDefault(); updatePolicies(); });

// close modal on backdrop click or ESC
document.addEventListener('click', (ev)=>{ if (!updateModal) return; if (ev.target === updateModal.querySelector('.modal-backdrop')) closeUpdateModal(); });
document.addEventListener('keydown', (ev)=>{ if (ev.key === 'Escape' && updateModal && updateModal.getAttribute('aria-hidden') === 'false') closeUpdateModal(); });


/* ---------------------- Notes for AWS integration ---------------------- */
/*
 - Replace `apiAuth` with Cognito authentication flow (Hosted UI or SRP via AWS SDK).
 - Replace `apiFetchDepartments`, `apiFetchDocumentsForDept`, and `apiFetchDocument`
   with calls to your API Gateway endpoints that return JSON data. Include
   proper authorization headers (Cognito JWT) when calling protected APIs.
 - Securely store tokens (use HttpOnly cookies or secure storage) in production.
 - Add error handling for network/API errors and token expiry; refresh tokens as needed.
*/