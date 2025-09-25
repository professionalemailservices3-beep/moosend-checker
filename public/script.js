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
        const hasSpf = data.txt.some(record => record.startsWith('v=spf1'));
        updateStatusItem('spf', hasSpf, 'SPF Record Found', 'No SPF Record Found');

        const hasDmarc = data.dmarc.length > 0;
        updateStatusItem('dmarc', hasDmarc, 'DMARC Record Found', 'No DMARC Record Found');

        // Show raw TXT records if they exist
        if (data.txt.length > 0) {
            document.getElementById('txtRecords').textContent = data.txt.join('\n');
            document.getElementById('raw-records').classList.remove('hidden');
        } else {
            document.getElementById('raw-records').classList.add('hidden');
        }

        // Move to next step
        document.getElementById('dkimSection').classList.remove('hidden');
        mainBtn.dataset.state = 'dnsChecked';
        document.getElementById('btnText').textContent = 'Generate Moosend Records';
        document.getElementById('btnIcon').classList.remove('hidden');

    } catch (error) {
        errorBox.textContent = `Error: ${error.message}\n\nPlease check your Netlify deploy logs for more details.`;
        errorBox.classList.remove('hidden');
        resultsSection.classList.add('hidden');
    } finally {
        mainBtn.disabled = false;
        loader.classList.add('hidden');
    }
}

function updateStatusItem(type, isValid, validText, invalidText) {
    const statusEl = document.getElementById(`${type}-status`);
    const iconEl = document.getElementById(`${type}-status-icon`);
    const textEl = document.getElementById(`${type}-status-text`);

    statusEl.className = `status-item ${isValid ? 'valid' : 'invalid'}`;
    iconEl.className = `fas ${isValid ? 'fa-check-circle' : 'fa-times-circle'}`;
    textEl.textContent = isValid ? validText : invalidText;
}

function handleGenerateRecords() {
    const dkimValue = document.getElementById('dkimValue').value;
    if (!dkimValue) {
        alert('Please paste your Moosend DKIM value.');
        return;
    }

    const domain = document.getElementById('domain').value;
    const mainContainer = document.getElementById('mainContainer');
    const pageWrapper = document.querySelector('.page-wrapper');
    const mainBtn = document.getElementById('mainBtn');

    mainContainer.classList.add('moved-left');

    const generatedContainer = document.createElement('div');
    generatedContainer.className = 'container generated-records';

    const fetchedTxtRecords = document.getElementById('txtRecords').textContent.split('\n');
    const existingSpf = fetchedTxtRecords.find(record => record.startsWith('v=spf1'));
    const moosendSpf = 'include:spfa.mailendo.com';
    let spfRecordValue = '';
    let spfInstruction = '';

    if (existingSpf && !existingSpf.includes('No TXT records found.')) {
        spfInstruction = `Your domain already has an SPF record. You must merge the Moosend value into it. **Do not create a second SPF record.** Update your existing record to look like this:`;
        let cleanExistingSpf = existingSpf.replace(/^"|"$/g, '');
        const parts = cleanExistingSpf.split(' ');
        if (!parts.includes(moosendSpf)) {
            parts.splice(parts.length - 1, 0, moosendSpf);
        }
        spfRecordValue = parts.join(' ');
    } else {
        spfInstruction = `Your domain does not have an SPF record. Add the following new record to your DNS:`;
        spfRecordValue = `v=spf1 ${moosendSpf} ~all`;
    }

    const dkimHost = `ms._domainkey.${domain}`;
    const dkimRecordValue = `v=DKIM1; k=rsa; p=${dkimValue}`;

    const hasDmarc = document.getElementById('dmarc-status').classList.contains('valid');
    let dmarcSection = '';
    if (!hasDmarc) {
        dmarcSection = `
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
        <div class="record-section">
            <h3>SPF Record</h3>
            <p>${spfInstruction}</p>
            <div class="generated-record-display">
                <p><strong>Record Type:</strong> TXT</p>
                <p><strong>Record Host:</strong> <span class="record-host">@</span></p>
                <p><strong>Record Value:</strong></p>
                <div class="dns-output">${spfRecordValue}</div>
            </div>
        </div>
        <div class="record-section">
            <h3>DKIM Record</h3>
            <p>Add the following TXT record to your DNS. This enables Moosend to sign your emails, proving they came from you.</p>
            <div class="generated-record-display">
                <p><strong>Record Type:</strong> TXT</p>
                <p><strong>Record Host:</strong> <span class="record-host">${dkimHost}</span></p>
                <p><strong>Record Value:</strong></p>
                <div class="dns-output">${dkimRecordValue}</div>
            </div>
        </div>
        ${dmarcSection}
    `;

    pageWrapper.appendChild(generatedContainer);
    mainBtn.disabled = true;
    mainBtn.style.opacity = '0.6';
}