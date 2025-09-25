// --- Event Listeners ---
document.getElementById('mainBtn').addEventListener('click', handleDnsCheck);
document.getElementById('domain').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); handleDnsCheck(); } });
document.getElementById('resetBtn').addEventListener('click', resetApp);
document.getElementById('dkimLookupBtn').addEventListener('click', handleDkimLookup);

// --- Core Functions ---
function handleDnsCheck() {
    const state = document.getElementById('mainBtn').dataset.state || 'initial';
    if (state === 'initial') performDnsQuery();
    else handleGenerateRecords();
}

async function performDnsQuery() {
    clearPreviousResults();
    const domain = document.getElementById('domain').value;
    if (!domain) { alert('Please enter a valid domain name.'); return; }

    const mainBtn = document.getElementById('mainBtn'), loader = document.getElementById('loader'), resultsSection = document.getElementById('results-section');
    mainBtn.disabled = true;
    loader.classList.remove('hidden');
    resultsSection.classList.remove('hidden');
    document.getElementById('resetBtn').classList.remove('hidden');

    try {
        const response = await fetch(`/.netlify/functions/dns-query?domain=${domain}`);
        if (!response.ok) throw new Error(`Status: ${response.status} (${response.statusText})`);
        const data = await response.json();

        // Update Status UI with all checks
        updateStatusItem('mx', data.mx.length > 0, 'MX Records Found', 'No MX Records Found');
        const spfRecord = data.txt.find(r => r.startsWith('v=spf1'));
        updateSpfStatus(spfRecord, spfRecord && spfRecord.includes('include:spfa.mailendo.com'));
        updateStatusItem('dmarc', data.dmarc.length > 0, 'DMARC Record Found', 'No DMARC Record Found');

        // Display Parsed SPF and Other TXT records
        const rawRecordsContainer = document.getElementById('raw-records');
        if (spfRecord) {
            parseAndDisplaySpf(spfRecord);
            const otherTxt = data.txt.filter(r => !r.startsWith('v=spf1'));
            if (otherTxt.length > 0) {
                document.getElementById('otherTxtRecords').textContent = otherTxt.join('\n');
                document.getElementById('otherTxtHeader').classList.remove('hidden');
            }
            rawRecordsContainer.classList.remove('hidden');
        }

        // Show DKIM section and update button
        document.getElementById('dkimSection').classList.remove('hidden');
        mainBtn.dataset.state = 'dnsChecked';
        document.getElementById('btnText').textContent = 'Generate Final Records';
        document.getElementById('btnIcon').classList.remove('hidden');
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
    if (!selector) { alert('Please enter a DKIM selector.'); return; }

    resultEl.textContent = 'Looking up...';
    resultEl.className = 'dkim-result-text';

    try {
        const response = await fetch(`/.netlify/functions/dkim-lookup?domain=${domain}&selector=${selector}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);

        document.getElementById('dkimValue').value = data.record[0];
        resultEl.textContent = '✅ DKIM record found and populated!';
        resultEl.classList.add('success');
    } catch (error) {
        resultEl.textContent = `❌ ${error.message}`;
        resultEl.classList.add('error');
    }
}

function handleGenerateRecords() {
    const dkimValue = document.getElementById('dkimValue').value;
    if (!dkimValue) { alert('Please lookup or paste a DKIM value to generate the records.'); return; }

    document.getElementById('mainContainer').classList.add('moved-left');
    const generatedContainer = document.createElement('div');
    generatedContainer.className = 'container generated-records';

    const spfRecordString = document.getElementById('raw-records').classList.contains('hidden') ? null : Array.from(document.getElementById('spfRecordParsed').childNodes).map(node => node.textContent).join(' ');
    const hasMoosendSpf = spfRecordString && spfRecordString.includes('include:spfa.mailendo.com');
    const hasDmarc = document.getElementById('dmarc-status').classList.contains('valid');
    const domain = document.getElementById('domain').value;

    generatedContainer.innerHTML = `
        <h2>Email Configuration</h2>
        ${generateSpfCard(spfRecordString, hasMoosendSpf)}
        ${generateDkimCard(domain, dkimValue)}
        ${generateDmarcCard(domain, hasDmarc)}
    `;

    document.querySelector('.page-wrapper').appendChild(generatedContainer);
    document.getElementById('mainBtn').disabled = true;

    generatedContainer.querySelectorAll('.copy-btn').forEach(button => {
        button.addEventListener('click', (e) => copyToClipboard(e.currentTarget.dataset.copy, e.currentTarget));
    });
}

// --- UI Generation & Helpers --- (Most functions from here are helpers for the core logic above)
function generateSpfCard(existingSpf, hasMoosendSpf) {
    let instruction, value;
    const moosendSpf = 'include:spfa.mailendo.com';

    if (hasMoosendSpf) { instruction = "Your SPF record is already correctly configured. No action is needed."; value = existingSpf; }
    else if (existingSpf) { instruction = "Your domain has an SPF record, but it's missing the Moosend value. **Update your existing record** to match the value below."; const parts = existingSpf.split(' '); if (!parts.includes(moosendSpf)) parts.splice(parts.length - 1, 0, moosendSpf); value = parts.join(' '); }
    else { instruction = "Your domain does not have an SPF record. Create a new TXT record with the following details:"; value = `v=spf1 ${moosendSpf} ~all`; }

    return `<div class="record-card"><h3>SPF Record</h3><p class="instruction">${instruction}</p><div class="record-entry"><span class="record-label">Type</span><span class="record-value">TXT</span><span></span></div><div class="record-entry"><span class="record-label">Host</span><span class="record-value">@</span><button class="copy-btn" data-copy="@" title="Copy"><i class="far fa-copy"></i></button></div><div class="record-entry"><span class="record-label">Value</span><span class="record-value">${value}</span><button class="copy-btn" data-copy="${value}" title="Copy"><i class="far fa-copy"></i></button></div></div>`;
}

function generateDkimCard(domain, dkimValue) {
    const host = `ms._domainkey`; // Domain is added by DNS providers automatically
    const value = dkimValue; // The full value is now looked up
    return `<div class="record-card"><h3>DKIM Record</h3><p class="instruction">Add this TXT record to enable Moosend to digitally sign your emails.</p><div class="record-entry"><span class="record-label">Type</span><span class="record-value">TXT</span><span></span></div><div class="record-entry"><span class="record-label">Host</span><span class="record-value">${host}</span><button class="copy-btn" data-copy="${host}" title="Copy"><i class="far fa-copy"></i></button></div><div class="record-entry"><span class="record-label">Value</span><span class="record-value">${value}</span><button class="copy-btn" data-copy="${value}" title="Copy"><i class="far fa-copy"></i></button></div></div>`;
}

function generateDmarcCard(domain, hasDmarc) {
    if (hasDmarc) return '';
    const host = `_dmarc`;
    const value = `v=DMARC1; p=none; rua=mailto:dmarc-reports@${domain}`;
    return `<div class="record-card"><h3>DMARC Record (Recommended)</h3><p class="instruction">Your domain is missing a DMARC record. We highly recommend adding one to improve security.</p><div class="record-entry"><span class="record-label">Type</span><span class="record-value">TXT</span><span></span></div><div class="record-entry"><span class="record-label">Host</span><span class="record-value">${host}</span><button class="copy-btn" data-copy="${host}" title="Copy"><i class="far fa-copy"></i></button></div><div class="record-entry"><span class="record-label">Value</span><span class="record-value">${value}</span><button class="copy-btn" data-copy="${value}" title="Copy"><i class="far fa-copy"></i></button></div></div>`;
}

function resetApp() {
    document.getElementById('domain').value = '';
    document.getElementById('dkimValue').value = '';
    document.getElementById('dkimSelector').value = 'ms';
    document.getElementById('dkimLookupResult').textContent = '';

    document.getElementById('error-box').classList.add('hidden');
    document.getElementById('results-section').classList.add('hidden');
    document.getElementById('dkimSection').classList.add('hidden');
    document.getElementById('resetBtn').classList.add('hidden');

    const mainBtn = document.getElementById('mainBtn');
    mainBtn.disabled = false;
    mainBtn.dataset.state = 'initial';
    mainBtn.style.opacity = '1';
    document.getElementById('btnText').textContent = 'Check DNS';
    document.getElementById('btnIcon').classList.add('hidden');

    clearPreviousResults();
}

function clearPreviousResults() {
    document.getElementById('mainContainer').classList.remove('moved-left');
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
    if (hasMoosendSpf) updateStatusItem('spf', true, 'SPF is Valid for Moosend', '', 'valid');
    else if (spfRecord) { updateStatusItem('spf', false, '', 'SPF needs Moosend value', 'warning'); document.getElementById('spf-status-icon').className = 'fas fa-exclamation-triangle'; }
    else updateStatusItem('spf', false, '', 'No SPF Record Found', 'invalid');
}

function parseAndDisplaySpf(spfRecord) {
    const container = document.getElementById('spfRecordParsed');
    container.innerHTML = '';
    const mechanisms = spfRecord.replace(/"/g, '').split(' ');
    mechanisms.forEach(mech => {
        const span = document.createElement('span');
        span.className = 'spf-mechanism';
        let type = 'unknown';
        if (mech.startsWith('v=')) type = 'version';
        else if (mech.startsWith('include:')) type = 'include';
        else if (mech.startsWith('ip4:') || mech.startsWith('ip6:')) type = 'ip4';
        else if (mech.endsWith('all')) type = 'all';
        span.classList.add(`spf-${type}`);
        span.textContent = mech;
        container.appendChild(span);
    });
}