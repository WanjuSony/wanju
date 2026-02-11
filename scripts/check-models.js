const fs = require('fs');
const path = require('path');
const https = require('https');

let apiKey = process.env.GOOGLE_API_KEY;

if (!apiKey) {
    try {
        const envPath = path.join(__dirname, '..', '.env.local');
        if (fs.existsSync(envPath)) {
            const envContent = fs.readFileSync(envPath, 'utf8');
            const match = envContent.match(/GOOGLE_API_KEY=(.*)/);
            if (match) {
                apiKey = match[1].trim().replace(/["']/g, ''); // Remove quotes if any
            }
        }
    } catch (e) {
        console.error("Error reading .env.local:", e);
    }
}

if (!apiKey) {
    console.log("No API Key found in env or .env.local");
    process.exit(1);
}

const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            if (json.models) {
                console.log("Available Models:");
                json.models.forEach(m => {
                    if (m.name.includes('gemini')) {
                        console.log(`- ${m.name} (${m.supportedGenerationMethods.join(', ')})`);
                    }
                });
            } else {
                console.log("Error response:", json);
            }
        } catch (e) {
            console.error("Parse error:", e);
        }
    });
}).on('error', (e) => {
    console.error("Request error:", e);
});
