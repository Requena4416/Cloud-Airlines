// app.js — Frontend-only logic for Cloud Airlines policy portal
// app.js — Live AWS logic for Cloud Airlines policy portal

/* --------------------------- AWS CONFIGURATION --------------------------- */
const AWS_CONFIG = {
    region: 'us-east-2', 
    userPoolId: 'us-east-2_fc4M53IX4',      
    clientId: 'kc4mcnokhmo0a75knie0ljaf4',    
    identityPoolId: 'us-east-2:2197d3cd-ebf5-4902-8515-68891991917e' 
};

// Initialize Cognito User Pool
const poolData = { UserPoolId: AWS_CONFIG.userPoolId, ClientId: AWS_CONFIG.clientId };
const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);

/* --------------------------- UI Content Data --------------------------- */
const MOCK_DEPARTMENTS = [
  { id: 'hr', name: 'Human Resources', description: 'Policies for employees, benefits, and payroll.' },
  { id: 'reservations', name: 'Reservations', description: 'Booking and reservation policies.' },
  { id: 'sales', name: 'Sales', description: 'Ticket sales and customer service policies.' }
];

/* ---------------------- AWS API Functions ---------------------- */

// 1. Authenticate with Cognito and setup Identity Pool Credentials
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

                // Configure AWS SDK with the Identity Pool and JWT Token
                AWS.config.region = AWS_CONFIG.region;
                AWS.config.credentials = new AWS.CognitoIdentityCredentials({
                    IdentityPoolId: AWS_CONFIG.identityPoolId,
                    Logins: {
                        [`cognito-idp.${AWS_CONFIG.region}.amazonaws.com/${AWS_CONFIG.userPoolId}`]: idToken
                    }
                });

                // Refresh credentials to ensure the 'Admin' role is assumed
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
                        alert("Password updated! Please log in.");
                        window.location.reload();
                    },
                    onFailure: (err) => reject(err)
                });
            }
        });
    });
}

// 2. DynamoDB Submission
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

function apiFetchDepartments() {
  return new Promise((resolve) => setTimeout(() => resolve(MOCK_DEPARTMENTS), 300));
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

// Dashboard initialization
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
        console.error('Failed to load dashboard', err);
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
    a.dataset.deptId = d.id;
    a.addEventListener('click', (ev) => { ev.preventDefault(); onDeptClick(d, a); });
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

// MAIN S3 LOGIC: Fetches files based on folder name (dept.id)
async function onDeptClick(dept, linkEl) {
  const docsArea = document.getElementById('documents');
  const folders = document.getElementById('folders');
  const title = document.getElementById('current-dept');
  
  // Remove active class from all department links
  const list = document.getElementById('dept-list');
  if (list) {
    list.querySelectorAll('a').forEach(link => link.classList.remove('active'));
  }
  
  // Add active class to clicked link
  if (linkEl) linkEl.classList.add('active');
  
  if (title) title.textContent = dept.name;
  if (folders) folders.hidden = true;
  if (docsArea) docsArea.hidden = false;

  docsArea.innerHTML = '<div class="muted">Verifying credentials...</div>';

  try {
    // 1. RECOVERY LOGIC: If credentials are null, rebuild them from the active session
    if (!AWS.config.credentials) {
        const cognitoUser = userPool.getCurrentUser();
        if (cognitoUser) {
            await new Promise((resolve, reject) => {
                cognitoUser.getSession((err, session) => {
                    if (err) return reject(err);
                    const idToken = session.getIdToken().getJwtToken();
                    
                    AWS.config.region = AWS_CONFIG.region;
                    AWS.config.credentials = new AWS.CognitoIdentityCredentials({
                        IdentityPoolId: AWS_CONFIG.identityPoolId,
                        Logins: {
                            [`cognito-idp.${AWS_CONFIG.region}.amazonaws.com/${AWS_CONFIG.userPoolId}`]: idToken
                        }
                    });
                    resolve();
                });
            });
        } else {
            throw new Error("No active session found. Please log in again.");
        }
    }

    // 2. Refresh the credentials to assume the Admin Role
    await AWS.config.credentials.refreshPromise();
    
    // 3. Initialize S3
    const s3 = new AWS.S3({ 
      apiVersion: '2006-03-01', 
      region: AWS_CONFIG.region,
      signatureVersion: 'v4'
    });

    // 4. Fetch the data
    const s3Data = await s3.listObjectsV2({ 
      Bucket: 'cloud-airlines-documents',
      Prefix: `policies/${dept.id}/` 
    }).promise();

    docsArea.innerHTML = ''; 

    const files = s3Data.Contents.filter(item => item.Key !== `policies/${dept.id}/`);

    if (files.length === 0) {
      docsArea.innerHTML = `<div class="muted">No policies found in: policies/${dept.id}/</div>`;
    } else {
      files.forEach(file => {
        const url = s3.getSignedUrl('getObject', { 
          Bucket: 'cloud-airlines-documents', 
          Key: file.Key, 
          Expires: 300 
        });
        
        const fileName = file.Key.split('/').pop(); 
        const d = document.createElement('div');
        d.className = 'doc-item';
        d.innerHTML = `
          <strong>📄 ${escapeHtml(fileName)}</strong><br>
          <small><a href="${url}" target="_blank" style="color: #0056b3;">View / Download Policy</a></small>
        `;
        docsArea.appendChild(d);
      });
    }
  } catch (err) {
    console.error("S3 Error Details:", err);
    docsArea.innerHTML = `<div class="error">
      <strong>Access Denied</strong><br>
      <small>${err.message}</small>
    </div>`;
  }
}

/* ---------------------- Update Policies Modal Logic ---------------------- */
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
        alert('Update request submitted successfully!');
    } catch (err) {
        console.error(err);
        alert('Failed to submit: ' + err.message);
    }
});