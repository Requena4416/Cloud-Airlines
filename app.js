// app.js — Frontend-only logic for Cloud Airlines policy portal
// app.js — Live AWS logic for Cloud Airlines policy portal

/* --------------------------- AWS CONFIGURATION --------------------------- */
const AWS_CONFIG = {
    region: 'us-east-2', 
    userPoolId: 'us-east-2_fc4M53IX4',      
    clientId: 'kc4mcnokhmo0a75knie0ljaf4',    
    identityPoolId: 'us-east-2:2197d3cd-ebf5-4902-8515-68891991917e' 
};

// Initialize the Cognito User Pool object
const poolData = { UserPoolId: AWS_CONFIG.userPoolId, ClientId: AWS_CONFIG.clientId };
const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);

/* --------------------------- UI Content Data --------------------------- */
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

/* ---------------------- AWS API Functions ---------------------- */

// 1. Real Cognito Authentication
function apiAuth(email, password) {
    return new Promise((resolve, reject) => {
        const authDetails = new AmazonCognitoIdentity.AuthenticationDetails({
            Username: email,
            Password: password
        });

        const cognitoUser = new AmazonCognitoIdentity.CognitoUser({
            Username: email,
            Pool: userPool
        });

        cognitoUser.authenticateUser(authDetails, {
            onSuccess: (session) => {
                const idToken = session.getIdToken().getJwtToken();

                // Connect to Identity Pool for temporary AWS credentials
                AWS.config.region = AWS_CONFIG.region;
                AWS.config.credentials = new AWS.CognitoIdentityCredentials({
                    IdentityPoolId: AWS_CONFIG.identityPoolId,
                    Logins: {
                        [`cognito-idp.${AWS_CONFIG.region}.amazonaws.com/${AWS_CONFIG.userPoolId}`]: idToken
                    }
                });

                // Refresh credentials to ensure browser has active keys
                AWS.config.credentials.refresh((err) => {
                    if (err) return reject(err);
                    resolve({ 
                        email: email, 
                        name: session.getIdToken().payload.name || email 
                    });
                });
            },
            onFailure: (err) => reject(err),
            newPasswordRequired: (userAttributes) => {
                const newPassword = prompt("Temporary password detected. Please set a new permanent password:");
                if (!newPassword) return reject(new Error("Password change required."));
                
                cognitoUser.completeNewPasswordChallenge(newPassword, {}, {
                    onSuccess: () => {
                        alert("Password updated! Please log in with your new password.");
                        window.location.reload();
                    },
                    onFailure: (err) => reject(err)
                });
            }
        });
    });
}

// 2. Real DynamoDB Submission
async function apiSubmitUpdateRequest(payload) {
    const docClient = new AWS.DynamoDB.DocumentClient();
    const params = {
        TableName: "CloudAirlines_Data",
        Item: {
            "employee_id": payload.user,
            "record_id": payload.timestamp,
            "deptId": payload.deptId,
            "docId": payload.docId,
            "comment": payload.comment
        }
    };
    return docClient.put(params).promise();
}

/* ---------------------- Helper API functions ---------------------- */
function apiFetchDepartments() {
  return new Promise((resolve) => setTimeout(() => resolve(MOCK_DEPARTMENTS), 300));
}

function apiFetchDocumentsForDept(deptId) {
  return new Promise((resolve) => setTimeout(() => resolve(MOCK_DOCUMENTS[deptId] || []), 300));
}

function apiFetchDocument(docId) {
  return new Promise((resolve) => {
    setTimeout(() => {
      for (const k of Object.keys(MOCK_DOCUMENTS)) {
        const d = MOCK_DOCUMENTS[k].find(x => x.id === docId);
        if (d) return resolve(Object.assign({ department: k }, d));
      }
      resolve(null);
    }, 300);
  });
}

/* ---------------------- DOM / App Logic ---------------------- */

function escapeHtml(s){
  if (!s && s !== 0) return '';
  return String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
}

// Login logic
if (document.getElementById('login-form')) {
  const form = document.getElementById('login-form');
  const errEl = document.getElementById('login-error');

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    errEl.hidden = true;
    const email = form.email.value.trim();
    const password = form.password.value;

    try {
      const user = await apiAuth(email, password);
      localStorage.setItem('cloud_user', JSON.stringify(user));
      window.location.href = 'dashboard.html';
    } catch (err) {
      errEl.textContent = err.message || 'Sign in failed.';
      errEl.hidden = false;
    }
  });
}

// Dashboard logic
if (document.getElementById('dept-list') || document.getElementById('folders')) {
  const user = (() => {
    try { return JSON.parse(localStorage.getItem('cloud_user')); } catch(e){return null}
  })();
  
  if (!user) {
    window.location.href = 'index.html';
  } else {
    const userEl = document.getElementById('user-email');
    if (userEl) userEl.textContent = user.email || user.name || '';

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('cloud_user');
      window.location.href = 'index.html';
    });

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
    a.addEventListener('click', (ev) => { ev.preventDefault(); onDeptClick(d); });
    list.appendChild(a);
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
  const docsArea = document.getElementById('documents');
  const folders = document.getElementById('folders');
  const title = document.getElementById('current-dept');
  if (title) title.textContent = dept.name;
  if (folders) folders.hidden = true;
  if (docsArea) docsArea.hidden = false;

  docsArea.innerHTML = '<div class="muted">Loading documents...</div>';
  const docs = await apiFetchDocumentsForDept(dept.id);
  docsArea.innerHTML = '';
  docs.forEach(doc => {
    const d = document.createElement('div');
    d.className = 'doc-item';
    d.innerHTML = `<strong>${escapeHtml(doc.title)}</strong><br><small>Updated: ${escapeHtml(doc.updated)}</small>`;
    docsArea.appendChild(d);
  });
}

/* ---------------------- Update Policies Logic ---------------------- */
const updateBtn = document.getElementById('update-btn');
const updateModal = document.getElementById('update-modal');
const updateForm = document.getElementById('update-form');
const updateCancel = document.getElementById('update-cancel');

if (updateBtn) updateBtn.addEventListener('click', () => {
    updateModal.classList.add('show');
    updateModal.hidden = false;
});

if (updateCancel) updateCancel.addEventListener('click', () => {
    updateModal.classList.remove('show');
    updateModal.hidden = true;
});

if (updateForm) updateForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = JSON.parse(localStorage.getItem('cloud_user'));
    const payload = {
        user: user.email,
        deptId: document.getElementById('update-dept').value,
        docId: document.getElementById('update-doc').value,
        comment: document.getElementById('update-comment').value.trim(),
        timestamp: new Date().toISOString()
    };

    try {
        await apiSubmitUpdateRequest(payload);
        updateModal.classList.remove('show');
        updateModal.hidden = true;
        alert('Update request submitted to AWS DynamoDB!');
    } catch (err) {
        console.error(err);
        alert('Failed to submit: ' + err.message);
    }
});