async function test() {
    try {
        console.log("Fetching aspirin...");
        const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/aspirin/synonyms/JSON`;
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        console.log("Status:", res.status);
        const text = await res.text();
        console.log("Response length:", text.length);
        console.log("Preview:", text.substring(0, 200));

        try {
            const data = JSON.parse(text);
            const synonymsList = data?.InformationList?.Information?.[0]?.Synonym || [];
            console.log("Found", synonymsList.length, "synonyms");
            console.log("Top 3:", synonymsList.slice(0, 3));

            const joined = synonymsList.slice(0, 10).join(", ");
            console.log("Final string:", joined);
        } catch (e) {
            console.log("Parse error:", e);
        }
    } catch (e) {
        console.log("Error:", e);
    }
}
test();
