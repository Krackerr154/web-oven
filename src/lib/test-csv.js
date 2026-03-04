const Papa = require('papaparse');
const fs = require('fs');

const url = "https://docs.google.com/spreadsheets/d/1fakhZGefVarmqFOcjZ4FrMZTodSriMIYGoCV57z5PAg/export?format=csv&gid=1766823686";

fetch(url)
    .then(r => r.text())
    .then(csvText => {
        const results = Papa.parse(csvText, { header: true });
        const output = JSON.stringify({
            headers: results.meta.fields,
            data: results.data.slice(0, 3)
        }, null, 2);
        fs.writeFileSync('src/lib/test-csv-output.json', output);
    })
    .catch(console.error);
