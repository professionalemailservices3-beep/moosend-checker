// --- Global State ---
let appMode = 'lookup';
let currentDomain = '';

// --- Event Listeners ---
document.getElementById('startLookupBtn').addEventListener('click', () => startApp('lookup'));
document.getElementById('startSetupBtn').addEventListener('click', () => startApp('setup'));
document.getElementById('switchToSetupBtn').addEventListener('click', () => startApp('setup'));
document.getElementById('mainBtn').addEventListener('click', handleMainButtonClick);
document.getElementById('domain').addEventListener('input', (e) => {
    currentDomain = e.target.value;
    const mainBtn = document.getElementById('mainBtn');
    if (mainBtn.dataset.state === 'dnsChecked') {
        mainBtn.dataset.state = 'initial';
        const btnText = appMode === 'lookup' ? 'Lookup Domain' : 'Check DNS';
        mainBtn.querySelector('#btnText').textContent = btnText;
        mainBtn.querySelector('#btnIcon').classList.add('hidden');
        document.getElementById('dkimSection').classList.add('hidden');
        document.getElementById('results-section').classList.add('hidden');
        document.getElementById('dkimValue').value = '';
        clearPreviousResults();
    }
});
document.getElementById('domain').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); handleMainButtonClick(); } });
document.getElementById('dkimLookupBtn').addEventListener('click', handleDkimLookup);

// --- Core Functions ---
function startApp(mode) {
    appMode = mode;
    document.getElementById('welcome-screen').classList.add('hidden');
    document.getElementById('app-container').classList.remove('hidden');
    document.getElementById('domain').value = currentDomain;

    if (appMode === 'lookup') {
        document.getElementById('app-title').textContent = 'DNS Record Lookup';
        document.getElementById('app-subtitle').textContent = 'Enter a domain to see its live email authentication records.';
        document.getElementById('mainBtn').querySelector('#btnText').textContent = 'Lookup Domain';
    } else {
        document.getElementById('app-title').textContent = 'Setup Email Authentication';
        document.getElementById('app-subtitle').textContent = 'Check your domain and generate the necessary records for Moosend.';
        document.getElementById('mainBtn').querySelector('#btnText').textContent = 'Check DNS';
    }
    resetApp(true);
}

function handleMainButtonClick() {
    const state = document.getElementById('mainBtn').dataset.state || 'initial';
    if (state === 'initial') performDnsQuery();
    else handleGenerateRecords();
}

async function performDnsQuery() {
    clearPreviousResults();
    const domain = document.getElementById('domain').value;
    if (!domain) { alert('Please enter a valid domain name.'); return; }
    currentDomain = domain;

    const mainBtn = document.getElementById('mainBtn'), loader = document.getElementById('loader'), resultsSection = document.getElementById('results-section');
    mainBtn.disabled = true;
    loader.classList.remove('hidden');
    resultsSection.classList.remove('hidden');

    try {
        const response = await fetch(`/.netlify/functions/dns-query?domain=${domain}`);
        if (!response.ok) throw new Error(`Status: ${response.status} (${response.statusText})`);
        const data = await response.json();

        updateStatusItem('mx', data.mx.length > 0, 'MX Records Found', 'No MX Records Found');
        const spfRecord = data.txt.find(r => r.startsWith('v=spf1'));
        updateSpfStatus(spfRecord, spfRecord && spfRecord.includes('include:spfa.mailendo.com'));
        const dmarcRecord = data.dmarc.find(r => r.startsWith('v=DMARC1'));
        updateStatusItem('dmarc', !!dmarcRecord, 'DMARC Record Found', 'No DMARC Record Found');

        const rawRecordsContainer = document.getElementById('raw-records');
        document.getElementById('spfRecordParsed').innerHTML = spfRecord ? createPillHtml(spfRecord, 'spf') : 'No SPF record found.';
        document.getElementById('dmarcRecordParsed').innerHTML = dmarcRecord ? createPillHtml(dmarcRecord, 'dmarc') : '';
        if (dmarcRecord) document.getElementById('dmarc-header').classList.remove('hidden');
        if (spfRecord || dmarcRecord) rawRecordsContainer.classList.remove('hidden');

        if (appMode === 'lookup') {
            document.getElementById('switchToSetupBtn').classList.remove('hidden');
            mainBtn.style.display = 'none';
        } else {
            document.getElementById('dkimSection').classList.remove('hidden');
            mainBtn.dataset.state = 'dnsChecked';
            mainBtn.querySelector('#btnText').textContent = 'Generate Final Records';
            mainBtn.querySelector('#btnIcon').classList.remove('hidden');
        }
    } catch (error) {
        document.getElementById('error-box').textContent = `Error: ${error.message}`;
        document.getElementById('error-box').classList.remove('hidden');
        resultsSection.classList.add('hidden');
    } finally {
        mainBtn.disabled = false;
        loader.classList.add('hidden');
    }
}

async function handleDkimLookup() {
    const domain = document.getElementById('domain').value;
    const selector = document.getElementById('dkimSelector').value;
    const resultEl = document.getElementById('dkimLookupResult');
    const dkimValueTextarea = document.getElementById('dkimValue');
    if (!selector) { alert('Please enter a DKIM selector.'); return; }

    resultEl.textContent = 'Looking up...';
    resultEl.className = 'dkim-result-text';
    dkimValueTextarea.classList.add('hidden');

    try {
        const response = await fetch(`/.netlify/functions/dkim-lookup?domain=${domain}&selector=${selector}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        dkimValueTextarea.value = data.record[0];
        resultEl.textContent = '✅ DKIM record found!';
        resultEl.classList.add('success');
    } catch (error) {
        resultEl.textContent = `❌ ${error.message} Please paste the value below.`;
        resultEl.classList.add('error');
        dkimValueTextarea.classList.remove('hidden');
    }
}

function handleGenerateRecords() {
    const dkimValue = document.getElementById('dkimValue').value;
    if (!dkimValue) { alert('Please lookup or paste a DKIM value to generate the records.'); return; }

    document.getElementById('app-container').classList.add('moved-left');
    const generatedContainer = document.createElement('div');
    generatedContainer.className = 'container generated-records';

    const spfRecordString = Array.from(document.getElementById('spfRecordParsed').childNodes).map(node => node.textContent).join(' ');
    const hasMoosendSpf = spfRecordString && spfRecordString.includes('include:spfa.mailendo.com');
    const hasDmarc = document.getElementById('dmarc-status').classList.contains('valid');
    const domain = document.getElementById('domain').value;

    generatedContainer.innerHTML = `<h2>Email Configuration</h2>
        ${generateSpfCard(spfRecordString, hasMoosendSpf)}
        ${generateDkimCard(domain, dkimValue)}
        ${generateDmarcCard(domain, hasDmarc)}
        <button id="resetBtnProminent" class="reset-btn-prominent">Start Over</button>`;

    document.querySelector('.page-wrapper').appendChild(generatedContainer);
    document.getElementById('mainBtn').disabled = true;

    generatedContainer.querySelectorAll('.copy-btn').forEach(button => {
        button.addEventListener('click', (e) => copyToClipboard(e.currentTarget.dataset.copy, e.currentTarget));
    });
    generatedContainer.querySelector('#resetBtnProminent').addEventListener('click', () => resetApp(false));
}

// --- UI Generation & Helpers ---
function createPillHtml(recordString, type) {
    const parts = recordString.replace(/"/g, '').split(/;\s*|\s+/);
    return parts.filter(part => part).map(part => {
        let pillType = 'unknown';
        if (type === 'spf') {
            if (part.startsWith('v=')) pillType = 'version';
            else if (part.startsWith('include:')) pillType = 'include';
            else if (part.startsWith('ip4:') || part.startsWith('ip6:')) pillType = 'ip';
            else if (part.endsWith('all')) pillType = 'all';
            const moosendClass = part.includes('spfa.mailendo.com') ? ' moosend-spf' : '';
            return `<span class="dns-pill ${pillType}${moosendClass}">${part}</span>`;
        } else {
            if (part.startsWith('v=')) pillType = 'version';
            else if (part.startsWith('p=')) pillType = 'dmarc-policy';
            else if (part.startsWith('k=')) pillType = 'dkim-tag';
            else pillType = 'dmarc-tag';
            return `<span class="dns-pill ${pillType}">${part}</span>`;
        }
    }).join('');
}
function generateSpfCard(existingSpf, hasMoosendSpf) {
    let instruction, value; const moosendSpf = 'include:spfa.mailendo.com';
    const tooltip = `<span class="tooltip-wrapper"><i class="far fa-question-circle"></i><span class="tooltip-text">An SPF (Sender Policy Framework) record lists all the servers authorized to send email on behalf of your domain. This helps prevent spammers from spoofing your domain.</span></span>`;
    if (hasMoosendSpf) { instruction = "Your SPF record is already correctly configured."; value = existingSpf; }
    else if (existingSpf) { instruction = "Your domain has an SPF record, but it's missing the Moosend value. **Update your existing record** to match the value below."; const parts = existingSpf.split(' '); if (!parts.includes(moosendSpf)) parts.splice(parts.length - 1, 0, moosendSpf); value = parts.join(' '); }
    else { instruction = "Your domain does not have an SPF record. Create a new TXT record with the following details:"; value = `v=spf1 ${moosendSpf} ~all`; }
    return `<div class="record-card"><h3>SPF Record</h3><p class="instruction">${instruction}${tooltip}</p><div class="record-entry"><span class="record-label">Host</span><span class="record-value">@</span><button class="copy-btn" data-copy="@" title="Copy"><i class="far fa-copy"></i></button></div><div class="record-entry"><span class="record-label">Value</span><div class="dns-output-parsed">${createPillHtml(value, 'spf')}</div><button class="copy-btn" data-copy="${value}" title="Copy"><i class="far fa-copy"></i></button></div></div>`;
}
function generateDkimCard(domain, dkimValue) {
    const host = `ms._domainkey`;
    const tooltip = `<span class="tooltip-wrapper"><i class="far fa-question-circle"></i><span class="tooltip-text">A DKIM (DomainKeys Identified Mail) record adds a digital signature to your emails, allowing receiving servers to verify that the email was actually sent by you and hasn't been tampered with.</span></span>`;
    return `<div class="record-card"><h3>DKIM Record</h3><p class="instruction">Add this TXT record to enable Moosend to digitally sign your emails.${tooltip}</p><div class="record-entry"><span class="record-label">Host</span><span class="record-value">${host}</span><button class="copy-btn" data-copy="${host}" title="Copy"><i class="far fa-copy"></i></button></div><div class="record-entry"><span class="record-label">Value</span><div class="dns-output-parsed">${createPillHtml(dkimValue, 'dkim')}</div><button class="copy-btn" data-copy="${dkimValue}" title="Copy"><i class="far fa-copy"></i></button></div></div>`;
}
function generateDmarcCard(domain, hasDmarc) {
    if (hasDmarc) return '';
    const host = `_dmarc`;
    // FIX: Simplified DMARC value per user request
    const value = `v=DMARC1; p=none;`;
    const tooltip = `<span class="tooltip-wrapper"><i class="far fa-question-circle"></i><span class="tooltip-text">A DMARC record tells receiving mail servers what to do with emails that fail SPF or DKIM checks (e.g., do nothing, quarantine, or reject). It also enables reporting on email activity.</span></span>`;
    return `<div class="record-card"><h3>DMARC Record (Recommended)</h3><p class="instruction">Your domain is missing a DMARC record. We highly recommend adding one to improve security.${tooltip}</p><div class="record-entry"><span class="record-label">Host</span><span class="record-value">${host}</span><button class="copy-btn" data-copy="${host}" title="Copy"><i class="far fa-copy"></i></button></div><div class="record-entry"><span class="record-label">Value</span><div class="dns-output-parsed">${createPillHtml(value, 'dmarc')}</div><button class="copy-btn" data-copy="${value}" title="Copy"><i class="far fa-copy"></i></button></div></div>`;
}

function resetApp(softReset = false) {
    if (!softReset) currentDomain = '';
    document.getElementById('domain').value = currentDomain;
    document.getElementById('dkimValue').value = '';
    document.getElementById('dkimSelector').value = 'ms';
    document.getElementById('dkimLookupResult').textContent = '';
    document.getElementById('error-box').classList.add('hidden');
    document.getElementById('results-section').classList.add('hidden');
    document.getElementById('dkimSection').classList.add('hidden');

    const mainBtn = document.getElementById('mainBtn');
    mainBtn.style.display = 'block';
    mainBtn.disabled = false;
    mainBtn.dataset.state = 'initial';
    document.getElementById('btnIcon').classList.add('hidden');
    clearPreviousResults();

    if (softReset) {
        const btnText = appMode === 'lookup' ? 'Lookup Domain' : 'Check DNS';
        mainBtn.querySelector('#btnText').textContent = btnText;
    } else {
        document.getElementById('welcome-screen').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
    }
}
function clearPreviousResults() {
    document.getElementById('app-container').classList.remove('moved-left');
    const generatedContainer = document.querySelector('.generated-records');
    if (generatedContainer) generatedContainer.remove();
}
function copyToClipboard(text, buttonElement) {
    navigator.clipboard.writeText(text).then(() => {
        const originalIcon = buttonElement.innerHTML;
        buttonElement.innerHTML = `<i class="fas fa-check" style="color: green;"></i>`;
        setTimeout(() => { buttonElement.innerHTML = originalIcon; }, 2000);
    }).catch(err => console.error('Failed to copy text: ', err));
}
function updateStatusItem(type, isValid, validText, invalidText, statusClass = '') {
    const statusEl = document.getElementById(`${type}-status`);
    const iconEl = document.getElementById(`${type}-status-icon`);
    const textEl = document.getElementById(`${type}-status-text`);
    statusEl.className = `status-item ${statusClass || (isValid ? 'valid' : 'invalid')}`;
    iconEl.className = `fas ${isValid ? 'fa-check-circle' : 'fa-times-circle'}`;
    textEl.textContent = isValid ? validText : invalidText;
}
function updateSpfStatus(spfRecord, hasMoosendSpf) {
    if (hasMoosendSpf) updateStatusItem('spf', true, 'SPF includes Moosend');
    else if (spfRecord) { updateStatusItem('spf', false, 'SPF needs Moosend value', null, 'warning'); document.getElementById('spf-status-icon').className = 'fas fa-exclamation-triangle'; }
    else updateStatusItem('spf', false, 'No SPF Record Found');
}