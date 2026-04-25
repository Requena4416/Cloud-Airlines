/* --- CONFIG --- */
const AWS_CONFIG = {
    region: 'us-east-2', 
    userPoolId: 'us-east-2_fc4M53IX4',      
    clientId: 'kc4mcnokhmo0a75knie0ljaf4',    
    identityPoolId: 'us-east-2:2197d3cd-ebf5-4902-8515-68891991917e' 
};

const poolData = { UserPoolId: AWS_CONFIG.userPoolId, ClientId: AWS_CONFIG.clientId };
const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
const MOCK_DEPARTMENTS = [
    { id: 'hr', name: 'Human Resources', description: 'Employee benefits and payroll.' },
    { id: 'reservations', name: 'Reservations', description: 'Booking and seat management.' },
    { id: 'sales', name: 'Sales', description: 'Ticket sales and customer service.' }
];

/* --- AUTH (Used by Login Page) --- */
window.apiAuth = function(email, password) {
    return new Promise((resolve, reject) => {
        const authDetails = new AmazonCognitoIdentity.AuthenticationDetails({ Username: email, Password: password });
        const cognitoUser = new AmazonCognitoIdentity.CognitoUser({ Username: email, Pool: userPool });

        cognitoUser.authenticateUser(authDetails, {
            onSuccess: (session) => {
                setupAWSCredentials(session.getIdToken().getJwtToken());
                resolve({ email: email, name: session.getIdToken().payload.name || email });
            },
            onFailure: (err) => reject(err)
        });
    });
};

/* --- HELPER: Setup AWS Credentials --- */
function setupAWSCredentials(idToken) {
    AWS.config.region = AWS_CONFIG.region;
    AWS.config.credentials = new AWS.CognitoIdentityCredentials({
        IdentityPoolId: AWS_CONFIG.identityPoolId,
        Logins: { 
            [`cognito-idp.${AWS_CONFIG.region}.amazonaws.com/${AWS_CONFIG.userPoolId}`]: idToken 
        }
    });
}

/* --- DASHBOARD INIT --- */
document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(localStorage.getItem('cloud_user'));
    
    if (window.location.pathname.includes('dashboard.html')) {
        if (!user) { 
            window.location.href = 'index.html'; 
            return; 
        }

        // RE-ESTABLISH SESSION ON LOAD
        const cognitoUser = userPool.getCurrentUser();
        if (cognitoUser) {
            cognitoUser.getSession((err, session) => {
                if (!err && session.isValid()) {
                    setupAWSCredentials(session.getIdToken().getJwtToken());
                    document.getElementById('user-email').textContent = user.email;
                    initDashboard();
                    initModalLogic();
                } else {
                    localStorage.clear();
                    window.location.href = 'index.html';
                }
            });
        } else {
            window.location.href = 'index.html';
        }
    }
});

function initDashboard() {
    const depts = MOCK_DEPARTMENTS;
    const list = document.getElementById('dept-list');
    const folders = document.getElementById('folders');
    if (list) {
        list.innerHTML = depts.map(d => `<a href="#" class="dept-link" data-id="${d.id}" style="display:block; padding: 10px; text-decoration:none; color:#4a5568; border-radius:6px; margin-bottom:5px;">${d.name}</a>`).join('');
        list.querySelectorAll('.dept-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                onDeptClick(depts.find(d => d.id === e.target.dataset.id), e.target);
            });
        });
    }
        // Ensure this part in your app.js matches
    if (folders) {
        folders.innerHTML = depts.map(d => `
            <div class="folder-card" onclick="document.querySelector('[data-id=\\'${d.id}\\']').click()">
                <h3>${d.name}</h3>
                <p class="muted">${d.description}</p>
            </div>
        `).join('');
    }
}

async function onDeptClick(dept, linkEl) {
    const docsArea = document.getElementById('documents');
    document.querySelectorAll('.dept-link').forEach(l => { l.style.background = 'transparent'; l.style.color = '#4a5568'; });
    linkEl.style.background = '#e6fffa'; linkEl.style.color = '#2c7a7b';
    document.getElementById('current-dept').textContent = dept.name;
    document.getElementById('folders').hidden = true;
    docsArea.hidden = false;
    docsArea.innerHTML = 'Fetching Policies from S3...';
    
    try {
        // Now credentials won't be null because of the session check in DOMContentLoaded
        await AWS.config.credentials.refreshPromise();
        const s3 = new AWS.S3({ apiVersion: '2006-03-01', region: AWS_CONFIG.region });
        const data = await s3.listObjectsV2({ Bucket: 'cloud-airlines-documents', Prefix: `policies/${dept.id}/` }).promise();
        
        const files = data.Contents.filter(f => f.Key !== `policies/${dept.id}/`);
        docsArea.innerHTML = files.length ? '' : 'No policies found.';
        
        files.forEach(file => {
            const url = s3.getSignedUrl('getObject', { Bucket: 'cloud-airlines-documents', Key: file.Key, Expires: 300 });
            const div = document.createElement('div');
            div.style.padding = '15px';
            div.style.borderBottom = '1px solid #eee';
            div.innerHTML = `<strong>📄 ${file.Key.split('/').pop()}</strong><br><a href="${url}" target="_blank" style="color:#65a89a; font-size:0.85em;">Download Policy</a>`;
            docsArea.appendChild(div);
        });
    } catch (err) { 
        docsArea.innerHTML = `<div style="color:red">Unauthorized Access to Policy Files.</div>`; 
    }
}

/* --- MODAL LOGIC --- */
function initModalLogic() {
    const modal = document.getElementById('update-modal');
    const openBtn = document.getElementById('open-update-modal');
    const closeBtn = document.getElementById('close-modal-btn');
    const backdrop = document.getElementById('modal-backdrop');
    const updateForm = document.getElementById('update-form');

    const show = () => modal.style.display = 'flex';
    const hide = () => modal.style.display = 'none';

    if (openBtn) openBtn.onclick = show;
    if (closeBtn) closeBtn.onclick = hide;
    if (backdrop) backdrop.onclick = hide;

    if (updateForm) {
        updateForm.onsubmit = async (e) => {
            e.preventDefault();
            const user = JSON.parse(localStorage.getItem('cloud_user'));
            const docClient = new AWS.DynamoDB.DocumentClient();
            try {
                await docClient.put({
                    TableName: "CloudAirlines_Data",
                    Item: {
                        employee_id: user.email,
                        record_id: new Date().toISOString(),
                        deptId: document.getElementById('update-dept').value,
                        comment: document.getElementById('update-comment').value
                    }
                }).promise();
                alert("Request Logged in DynamoDB!");
                updateForm.reset();
                hide();
            } catch (err) { alert("DynamoDB Error: " + err.message); }
        };
    }
}