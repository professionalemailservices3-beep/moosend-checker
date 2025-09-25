const dns = require('dns').promises;

exports.handler = async function (event, context) {
    const { domain } = event.queryStringParameters;

    if (!domain) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Domain is required' }),
        };
    }

    try {
        // Fetch all three record types in parallel for speed
        const [txtRecords, cnameRecords, dmarcRecords] = await Promise.all([
            dns.resolveTxt(domain).catch(() => []), // For SPF
            dns.resolveCname(domain).catch(() => []), // For CNAME
            dns.resolveTxt(`_dmarc.${domain}`).catch(() => []) // For DMARC
        ]);

        return {
            statusCode: 200,
            body: JSON.stringify({
                txt: txtRecords.map(record => record.join(' ')),
                cname: cnameRecords,
                dmarc: dmarcRecords.map(record => record.join(' ')),
            }),
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to query DNS records.' }),
        };
    }
};