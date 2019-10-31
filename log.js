function ISODateString(d) {
    const pad = (n) => (n < 10 ? '0' + n : n);

    return (
        d.getUTCFullYear() +
        '-' +
        pad(d.getUTCMonth() + 1) +
        '-' +
        pad(d.getUTCDate()) +
        'T' +
        pad(d.getUTCHours()) +
        ':' +
        pad(d.getUTCMinutes()) +
        ':' +
        pad(d.getUTCSeconds()) +
        'Z'
    );
}

module.exports = {
    info(txt) {
        console.log(`[${ISODateString(new Date())}] INFO ${txt}`);
    },
};
