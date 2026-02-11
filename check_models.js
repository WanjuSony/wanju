const fs = require('fs');
const path = require('path');
const https = require('https');

// Load Env
const envPath = path.resolve(process.cwd(), '.env.local');
let apiKey = '';
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/^GOOGLE_API_KEY=(.*)$/m);
    if (match) apiKey = match[1].trim();
}

if (!apiKey) {
    console.error("No GOOGLE_API_KEY found in .env.local");
    process.exit(1);
}

console.log(`Checking models with API Key: ${apiKey.substring(0, 5)}...`);

const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

https.get(url, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            if (json.error) {
                console.error("API Error:", json.error);
            } else if (json.models) {
                console.log("Available Models:");
                const validModels = json.models.filter(m => m.supportedGenerationMethods.includes("generateContent"));
                validModels.forEach(m => console.log(`- ${m.name} (${m.displayName})`));

                // Recommendation
                const preferred = [
                    'models/gemini-1.5-flash',
                    'models/gemini-1.5-pro',
                    'models/gemini-1.0-pro',
                    'models/gemini-pro'
                ];

                const best = preferred.find(p => validModels.find(m => m.name === p)) || validModels[0]?.name;
                console.log(`\nRecommended Model: ${best}`);
            } else {
                console.log("No models found?", json);
            }
        } catch (e) {
            console.error("Parse Error:", e);
            console.log("Raw Data:", data);
        }
    });
}).on('error', err => {
    console.error("Network Error:", err);
});
