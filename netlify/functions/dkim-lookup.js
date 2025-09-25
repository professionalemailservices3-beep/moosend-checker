const dns = require('dns').promises;

exports.handler = async function (event, context) {
    const { domain, selector } = event.queryStringParameters;
    if (!domain || !selector) return { statusCode: 400, body: JSON.stringify({ error: 'Domain and selector are required' }) };

    try {
        const dkimRecord = await dns.resolveTxt(`${selector}._domainkey.${domain}`);
        return {
            statusCode: 200,
            body: JSON.stringify({ record: dkimRecord.map(r => r.join(' ')) }),
        };
    } catch (error) {
        // If lookup fails, it's a 404, not a server error
        return { statusCode: 404, body: JSON.stringify({ error: 'DKIM record not found for that selector.' }) };
    }
};