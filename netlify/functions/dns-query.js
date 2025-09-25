const dns = require('dns').promises;

exports.handler = async function (event, context) {
    const { domain } = event.queryStringParameters;
    if (!domain) return { statusCode: 400, body: JSON.stringify({ error: 'Domain is required' }) };

    try {
        const [txtRecords, cnameRecords, dmarcRecords, mxRecords] = await Promise.all([
            dns.resolveTxt(domain).catch(() => []),
            dns.resolveCname(domain).catch(() => []),
            dns.resolveTxt(`_dmarc.${domain}`).catch(() => []),
            dns.resolveMx(domain).catch(() => []) // New MX check
        ]);

        return {
            statusCode: 200,
            body: JSON.stringify({
                txt: txtRecords.map(r => r.join(' ')),
                cname: cnameRecords,
                dmarc: dmarcRecords.map(r => r.join(' ')),
                mx: mxRecords, // Return MX records
            }),
        };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to query DNS records.' }) };
    }
};