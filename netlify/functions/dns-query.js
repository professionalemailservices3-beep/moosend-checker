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
        const [txtRecords, cnameRecords] = await Promise.all([
            dns.resolveTxt(domain).catch(() => []),
            dns.resolveCname(domain).catch(() => []),
        ]);

        return {
            statusCode: 200,
            body: JSON.stringify({
                txt: txtRecords.map(record => record.join(' ')),
                cname: cnameRecords,
            }),
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to query DNS records.' }),
        };
    }
};