document.getElementById('mainBtn').addEventListener('click', async () => {
    const mainBtn = document.getElementById('mainBtn');
    const state = mainBtn.dataset.state || 'initial';

    switch (state) {
        case 'initial':
            await handleCheckDns();
            break;
        case 'dnsChecked':
            handleGenerateRecords();
            break;
    }
});

async function handleCheckDns() {
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

    try {
        const response = await fetch(`/.netlify/functions/dns-query?domain=${domain}`);
        if (!response.ok) {
            throw new Error(`Status: ${response.status} (${response.statusText})\nThis means the API function failed or was not found.`);
        }
        const data = await response.json();

        // -- Update Status UI --
        const spfRecord = data.txt.find(record => record.startsWith('v=spf1'));
        const hasMoosendSpf = spfRecord && spfRecord.includes('include:spfa.mailendo.com');

        updateSpfStatus(spfRecord, hasMoosendSpf);

        const hasDmarc = data.dmarc.length > 0;
        updateStatusItem('dmarc', hasDmarc, 'DMARC Record Found', 'No DMARC Record Found');

        // -- Display Parsed SPF and Other TXT Records --
        const rawRecordsContainer = document.getElementById('raw-records');
        if (spfRecord) {
            parseAndDisplaySpf(spfRecord);
            const otherTxt = data.txt.filter(record => !record.startsWith('v=spf1'));
            displayOtherTxt(otherTxt);
            rawRecordsContainer.classList.remove('hidden');
        } else {
            rawRecordsContainer.classList.add('hidden');
        }

        // Move to next step only if Moosend SPF is missing
        if (!hasMoosendSpf) {
            document.getElementById('dkimSection').classList.remove('hidden');
            mainBtn.dataset.state = 'dnsChecked';
            document.getElementById('btnText').textContent = 'Generate Moosend Records';
            document.getElementById('btnIcon').classList.remove('hidden');
        } else {
            mainBtn.style.display = 'none'; // Hide button if everything is perfect
        }

    } catch (error) {
        errorBox.textContent = `Error: ${error.message}\n\nPlease check your Netlify deploy logs for more details.`;
        errorBox.classList.remove('hidden');
        resultsSection.classList.add('hidden');
    } finally {
        mainBtn.disabled = false;
        loader.classList.add('hidden');
    }
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
    container.innerHTML = ''; // Clear previous results
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

function displayOtherTxt(otherTxtRecords) {
    const container = document.getElementById('otherTxtRecords');
    const header = document.getElementById('otherTxtHeader');
    if (otherTxtRecords.length > 0) {
        container.textContent = otherTxtRecords.join('\n');
        container.classList.remove('hidden');
        header.classList.remove('hidden');
    } else {
        container.classList.add('hidden');
        header.classList.add('hidden');
    }
}

function handleGenerateRecords() {
    // This function remains largely the same but has a new section for the "already configured" state.
    const domain = document.getElementById('domain').value;
    const mainContainer = document.getElementById('mainContainer');
    const pageWrapper = document.querySelector('.page-wrapper');
    const mainBtn = document.getElementById('mainBtn');

    mainContainer.classList.add('moved-left');

    const generatedContainer = document.createElement('div');
    generatedContainer.className = 'container generated-records';

    const fetchedTxtRecords = document.getElementById('spfRecordParsed').textContent.split(' ');
    const existingSpf = fetchedTxtRecords.join(' ');
    const hasMoosendSpf = existingSpf.includes('include:spfa.mailendo.com');
    const dkimValue = document.getElementById('dkimValue').value;

    let spfSection = '';

    if (hasMoosendSpf) {
        spfSection = `
        <div class="record-section">
            <h3>SPF Record</h3>
            <p>Your SPF record is already correctly configured for Moosend. No action is needed.</p>
            <div class="dns-output">${existingSpf}</div>
        </div>`;
    } else {
        if (!dkimValue) {
            alert('Please paste your Moosend DKIM value.');
            return; // Only require DKIM if we're generating new records
        }
        const moosendSpf = 'include:spfa.mailendo.com';
        let spfRecordValue = '';
        let spfInstruction = '';

        if (existingSpf) {
            spfInstruction = `Your domain already has an SPF record. You must merge the Moosend value into it. **Do not create a second SPF record.** Update your existing record to look like this:`;
            const parts = existingSpf.split(' ');
            if (!parts.includes(moosendSpf)) {
                parts.splice(parts.length - 1, 0, moosendSpf);
            }
            spfRecordValue = parts.join(' ');
        } else {
            spfInstruction = `Your domain does not have an SPF record. Add the following new record to your DNS:`;
            spfRecordValue = `v=spf1 ${moosendSpf} ~all`;
        }
        spfSection = `
        <div class="record-section">
            <h3>SPF Record</h3>
            <p>${spfInstruction}</p>
            <div class="generated-record-display">
                <p><strong>Record Type:</strong> TXT</p>
                <p><strong>Record Host:</strong> <span class="record-host">@</span></p>
                <p><strong>Record Value:</strong></p>
                <div class="dns-output">${spfRecordValue}</div>
            </div>
        </div>`;
    }

    const dkimHost = `ms._domainkey.${domain}`;
    const dkimRecordValue = `v=DKIM1; k=rsa; p=${dkimValue}`;
    const dkimSection = !dkimValue ? '' : `
        <div class="record-section">
            <h3>DKIM Record</h3>
            <p>Add the following TXT record to your DNS. This enables Moosend to sign your emails, proving they came from you.</p>
            <div class="generated-record-display">
                <p><strong>Record Type:</strong> TXT</p>
                <p><strong>Record Host:</strong> <span class="record-host">${dkimHost}</span></p>
                <p><strong>Record Value:</strong></p>
                <div class="dns-output">${dkimRecordValue}</div>
            </div>
        </div>`;

    const hasDmarc = document.getElementById('dmarc-status').classList.contains('valid');
    let dmarcSectionHtml = '';
    if (!hasDmarc) {
        dmarcSectionHtml = `
        <div class="record-section">
            <h3>DMARC Record (Recommended)</h3>
            <p>Your domain is missing a DMARC record. This is highly recommended for email security. You can start with this basic policy:</p>
            <div class="generated-record-display">
                <p><strong>Record Type:</strong> TXT</p>
                <p><strong>Record Host:</strong> <span class="record-host">_dmarc</span></p>
                <p><strong>Record Value:</strong></p>
                <div class="dns-output">v=DMARC1; p=none; rua=mailto:dmarc-reports@${domain}</div>
            </div>
        </div>`;
    }

    generatedContainer.innerHTML = `
        <h2>Moosend Configuration</h2>
        ${spfSection}
        ${dkimSection}
        ${dmarcSectionHtml}
    `;

    pageWrapper.appendChild(generatedContainer);
    mainBtn.disabled = true;
    mainBtn.style.opacity = '0.6';
}