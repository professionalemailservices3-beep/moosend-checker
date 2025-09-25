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
    errorBox.classList.add('hidden'); // Hide old errors

    if (!domain) {
        alert('Please enter a valid domain name.');
        return;
    }

    const mainBtn = document.getElementById('mainBtn');
    const loader = document.getElementById('loader');
    const currentDnsResults = document.getElementById('currentDnsResults');

    mainBtn.disabled = true;
    loader.classList.remove('hidden');
    currentDnsResults.classList.add('hidden');

    try {
        const response = await fetch(`/.netlify/functions/dns-query?domain=${domain}`);

        // NEW: Check if the response was successful
        if (!response.ok) {
            // Create a detailed error message
            throw new Error(`Status: ${response.status} (${response.statusText})\nThis means the API function failed or was not found.`);
        }

        const data = await response.json();

        document.getElementById('txtRecords').textContent = data.txt.length > 0 ? data.txt.join('\n') : 'No TXT records found.';
        document.getElementById('cnameRecords').textContent = data.cname.length > 0 ? data.cname.join('\n') : 'No CNAME records found.';

        currentDnsResults.classList.remove('hidden');
        document.getElementById('dkimSection').classList.remove('hidden');

        mainBtn.dataset.state = 'dnsChecked';
        document.getElementById('btnText').textContent = 'Generate Records';
        document.getElementById('btnIcon').classList.remove('hidden');

    } catch (error) {
        // NEW: Display the detailed error directly on the page
        errorBox.textContent = `Error: ${error.message}\n\nPlease check your Netlify deploy logs for more details.`;
        errorBox.classList.remove('hidden');
    } finally {
        mainBtn.disabled = false;
        loader.classList.add('hidden');
    }
}

function handleGenerateRecords() {
    // This function remains the same as before
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
    const fetchedTxtRecordsContent = document.getElementById('txtRecords').textContent;
    const fetchedTxtRecords = fetchedTxtRecordsContent.includes('No TXT records found.') ? [] : fetchedTxtRecordsContent.split('\n');
    const existingSpf = fetchedTxtRecords.find(record => record.startsWith('v=spf1'));
    const moosendSpf = 'include:spfa.mailendo.com';
    let spfRecordValue = '';
    if (existingSpf) {
        let cleanExistingSpf = existingSpf.replace(/^"|"$/g, '');
        const parts = cleanExistingSpf.split(' ');
        if (!parts.includes(moosendSpf)) {
            parts.splice(parts.length - 1, 0, moosendSpf);
        }
        spfRecordValue = parts.join(' ');
    } else {
        spfRecordValue = `v=spf1 ${moosendSpf} ~all`;
    }
    const dkimHost = `ms._domainkey.${domain}`;
    const dkimRecordValue = `v=DKIM1; k=rsa; p=${dkimValue}`;
    generatedContainer.innerHTML = `
        <h2>Generated Records for Moosend</h2>
        <div class="record-section">
            <h3>DKIM Record</h3>
            <p>Add the following TXT record to your DNS:</p>
            <div class="generated-record-display">
                <p><strong>Record Type:</strong> TXT</p>
                <p><strong>Record Host:</strong> <span class="record-host">${dkimHost}</span></p>
                <p><strong>Record Value:</strong></p>
                <div class="dns-output">${dkimRecordValue}</div>
            </div>
        </div>
        <div class="record-section">
            <h3>SPF Record</h3>
            <p>Add or update your SPF record with the following:</p>
            <div class="generated-record-display">
                <p><strong>Record Type:</strong> TXT</p>
                <p><strong>Record Host:</strong> <span class="record-host">@</span></p>
                <p><strong>Record Value:</strong></p>
                <div class="dns-output">${spfRecordValue}</div>
            </div>
        </div>
    `;
    pageWrapper.appendChild(generatedContainer);
    mainBtn.disabled = true;
    mainBtn.style.opacity = '0.6';
}