async function handleCheckDns() {
    const domain = document.getElementById('domain').value;
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
        // This is the corrected line
        const response = await fetch(`/.netlify/functions/dns-query?domain=${domain}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);

        document.getElementById('txtRecords').textContent = data.txt.length > 0 ? data.txt.join('\n') : 'No TXT records found.';
        document.getElementById('cnameRecords').textContent = data.cname.length > 0 ? data.cname.join('\n') : 'No CNAME records found.';

        currentDnsResults.classList.remove('hidden');
        document.getElementById('dkimSection').classList.remove('hidden');

        // Update button for next step
        mainBtn.dataset.state = 'dnsChecked';
        document.getElementById('btnText').textContent = 'Generate Records';
        document.getElementById('btnIcon').classList.remove('hidden');

    } catch (error) {
        alert(`Error: ${error.message}. Please ensure your backend server is running.`);
    } finally {
        mainBtn.disabled = false;
        loader.classList.add('hidden');
    }
}