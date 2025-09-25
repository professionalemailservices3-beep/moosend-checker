document.getElementById('mainBtn').addEventListener('click', () => handleDnsCheck());
document.getElementById('domain').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        event.preventDefault();
        handleDnsCheck();
    }
});
document.getElementById('resetBtn').addEventListener('click', resetApp);

function handleDnsCheck() {
    const state = document.getElementById('mainBtn').dataset.state || 'initial';
    if (state === 'initial') {
        performDnsQuery();
    } else {
        handleGenerateRecords();
    }
}

async function performDnsQuery() {
    const domain = document.getElementById('domain').value;
    const errorBox = document.getElementById('error-box');
    errorBox.classList.add('hidden');

    if (!domain) {
        alert('Please enter a valid domain name.');
        return;
    }

    const mainBtn = document.getElementById('mainBtn');
    const loader = document.getElementById('loader');
    const resultsSection = document.getElementById('results-section');

    mainBtn.disabled = true;
    loader.classList.remove('hidden');
    resultsSection.classList.remove('hidden');
    document.getElementById('resetBtn').classList.remove('hidden');

    try {
        const response = await fetch(`/.netlify/functions/dns-query?domain=${domain}`);
        if (!response.ok) throw new Error(`Status: ${response.status} (${response.statusText})\nThis means the API function failed or was not found.`);
        const data = await response.json();

        const spfRecord = data.txt.find(record => record.startsWith('v=spf1'));
        const hasMoosendSpf = spfRecord && spfRecord.includes('include:spfa.mailendo.com');
        updateSpfStatus(spfRecord, hasMoosendSpf);

        const hasDmarc = data.dmarc.length > 0;
        updateStatusItem('dmarc', hasDmarc, 'DMARC Record Found', 'No DMARC Record Found');

        const rawRecordsContainer = document.getElementById('raw-records');
        if (spfRecord) {
            parseAndDisplaySpf(spfRecord);
            const otherTxt = data.txt.filter(record => !record.startsWith('v=spf1'));
            if (otherTxt.length > 0) {
                document.getElementById('otherTxtRecords').textContent = otherTxt.join('\n');
                document.getElementById('otherTxtHeader').classList.remove('hidden');
            }
            rawRecordsContainer.classList.remove('hidden');
        } else {
            rawRecordsContainer.classList.add('hidden');
        }

        // Always show DKIM section and Generate button after check
        document.getElementById('dkimSection').classList.remove('hidden');
        mainBtn.dataset.state = 'dnsChecked';
        document.getElementById('btnText').textContent = 'Generate Moosend Records';
        document.getElementById('btnIcon').classList.remove('hidden');

    } catch (error) {
        errorBox.textContent = `Error: ${error.message}`;
        errorBox.classList.remove('hidden');
        resultsSection.classList.add('hidden');
    } finally {
        mainBtn.disabled = false;
        loader.classList.add('hidden');
    }
}

function handleGenerateRecords() {
    const domain = document.getElementById('domain').value;
    const dkimValue = document.getElementById('dkimValue').value;
    const mainContainer = document.getElementById('mainContainer');
    const pageWrapper = document.querySelector('.page-wrapper');
    const mainBtn = document.getElementById('mainBtn');

    if (!dkimValue) {
        alert('Please paste your Moosend DKIM value to generate the records.');
        return;
    }

    mainContainer.classList.add('moved-left');

    const generatedContainer = document.createElement('div');
    generatedContainer.className = 'container generated-records';

    const spfRecord = document.getElementById('spfRecordParsed').textContent ? document.getElementById('spfRecordParsed').textContent.split(' ').join(' ') : null;
    const hasMoosendSpf = spfRecord && spfRecord.includes('include:spfa.mailendo.com');
    const hasDmarc = document.getElementById('dmarc-status').classList.contains('valid');

    generatedContainer.innerHTML = `
        <h2>Moosend Configuration</h2>
        ${generateSpfCard(spfRecord, hasMoosendSpf)}
        ${generateDkimCard(domain, dkimValue)}
        ${generateDmarcCard(domain, hasDmarc)}
    `;

    pageWrapper.appendChild(generatedContainer);
    mainBtn.disabled = true;
    mainBtn.style.opacity = '0.6';

    // Add event listeners to all new copy buttons
    generatedContainer.querySelectorAll('.copy-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const textToCopy = e.currentTarget.dataset.copy;
            copyToClipboard(textToCopy, e.currentTarget);
        });
    });
}

function generateSpfCard(existingSpf, hasMoosendSpf) {
    let instruction, value;
    const moosendSpf = 'include:spfa.mailendo.com';

    if (hasMoosendSpf) {
        instruction = "Your SPF record is already correctly configured for Moosend. No action is needed.";
        value = existingSpf;
    } else if (existingSpf) {
        instruction = "Your domain has an SPF record, but it's missing the Moosend value. **Update your existing record** to match the value below.";
        const parts = existingSpf.split(' ');
        if (!parts.includes(moosendSpf)) {
            parts.splice(parts.length - 1, 0, moosendSpf);
        }
        value = parts.join(' ');
    } else {
        instruction = "Your domain does not have an SPF record. Create a new TXT record with the following details:";
        value = `v=spf1 ${moosendSpf} ~all`;
    }

    return `
        <div class="record-card">
            <h3>SPF Record</h3>
            <p class="instruction">${instruction}</p>
            <div class="record-entry">
                <span class="record-label">Type</span>
                <span class="record-value">TXT</span>
                <span></span> </div>
            <div class="record-entry">
                <span class="record-label">Host</span>
                <span class="record-value">@</span>
                <button class="copy-btn" data-copy="@" title="Copy"><i class="fas fa-copy"></i></button>
            </div>
            <div class="record-entry">
                <span class="record-label">Value</span>
                <span class="record-value">${value}</span>
                <button class="copy-btn" data-copy="${value}" title="Copy"><i class="fas fa-copy"></i></button>
            </div>
        </div>`;
}

function generateDkimCard(domain, dkimValue) {
    const host = `ms._domainkey.${domain}`;
    const value = `v=DKIM1; k=rsa; p=${dkimValue}`;
    return `
        <div class="record-card">
            <h3>DKIM Record</h3>
            <p class="instruction">Add this TXT record to enable Moosend to digitally sign your emails, proving they came from you.</p>
            <div class="record-entry">
                <span class="record-label">Type</span>
                <span class="record-value">TXT</span>
                <span></span>
            </div>
            <div class="record-entry">
                <span class="record-label">Host</span>
                <span class="record-value">${host}</span>
                <button class="copy-btn" data-copy="${host}" title="Copy"><i class="fas fa-copy"></i></button>
            </div>
            <div class="record-entry">
                <span class="record-label">Value</span>
                <span class="record-value">${value}</span>
                <button class="copy-btn" data-copy="${value}" title="Copy"><i class="fas fa-copy"></i></button>
            </div>
        </div>`;
}

function generateDmarcCard(domain, hasDmarc) {
    if (hasDmarc) return '';
    const host = `_dmarc.${domain}`;
    const value = `v=DMARC1; p=none; rua=mailto:dmarc-reports@${domain}`;
    return `
        <div class="record-card">
            <h3>DMARC Record (Recommended)</h3>
            <p class="instruction">Your domain is missing a DMARC record. We highly recommend adding one to improve security. You can start with this basic policy.</p>
            <div class="record-entry">
                <span class="record-label">Type</span>
                <span class="record-value">TXT</span>
                <span></span>
            </div>
            <div class="record-entry">
                <span class="record-label">Host</span>
                <span class="record-value">${host}</span>
                <button class="copy-btn" data-copy="${host}" title="Copy"><i class="fas fa-copy"></i></button>
            </div>
            <div class="record-entry">
                <span class="record-label">Value</span>
                <span class="record-value">${value}</span>
                <button class="copy-btn" data-copy="${value}" title="Copy"><i class="fas fa-copy"></i></button>
            </div>
        </div>`;
}

function copyToClipboard(text, buttonElement) {
    navigator.clipboard.writeText(text).then(() => {
        const originalIcon = buttonElement.innerHTML;
        buttonElement.innerHTML = `<i class="fas fa-check" style="color: green;"></i>`;
        setTimeout(() => {
            buttonElement.innerHTML = originalIcon;
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy text: ', err);
    });
}

function resetApp() {
    document.getElementById('domain').value = '';
    document.getElementById('dkimValue').value = '';

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

    document.getElementById('mainContainer').classList.remove('moved-left');
    const generatedContainer = document.querySelector('.generated-records');
    if (generatedContainer) {
        generatedContainer.remove();
    }
}

// Helper functions from before, no changes needed to these
function updateStatusItem(type, isValid, validText, invalidText, statusClass = '') {
    const statusEl = document.getElementById(`${type}-status`);
    const iconEl = document.getElementById(`${type}-status-icon`);
    const textEl = document.getElementById(`${type}-status-text`);
    statusEl.className = `status-item ${statusClass || (isValid ? 'valid' : 'invalid')}`;
    iconEl.className = `fas ${isValid ? 'fa-check-circle' : 'fa-times-circle'}`;
    textEl.textContent = isValid ? validText : invalidText;
}

function updateSpfStatus(spfRecord, hasMoosendSpf) {
    if (hasMoosendSpf) {
        updateStatusItem('spf', true, 'SPF is Valid for Moosend', '', 'valid');
    } else if (spfRecord) {
        updateStatusItem('spf', false, '', 'SPF needs Moosend value', 'warning');
        document.getElementById('spf-status-icon').className = 'fas fa-exclamation-triangle';
    } else {
        updateStatusItem('spf', false, '', 'No SPF Record Found', 'invalid');
    }
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