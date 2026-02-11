
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '.env.local');
let apiKey = process.env.GOOGLE_API_KEY;

if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    const match = envConfig.match(/GOOGLE_API_KEY=(.*)/);
    if (match) {
        apiKey = match[1].trim();
        if (apiKey.startsWith('"') || apiKey.startsWith("'")) apiKey = apiKey.slice(1, -1);
    }
}

async function run() {
    const genAI = new GoogleGenerativeAI(apiKey);
    try {
        const models = await genAI.getGenerativeModel({ model: "gemini-1.5-flash" }).apiKey; // Dummy to init? No, use GoogleGenerativeAI instance directly? No, SDK doesn't expose listModels on the instance directly easily in some versions.
        // Actually, looking at docs: genAI.getGenerativeModel is the main entry.
        // But there is no listModels on the instance.
        // I might need to use the REST API to list models or check if the SDK exports a listModels function.

        // Let's try to just fetch the list via REST, it's safer.
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();

        if (data.models) {
            console.log("Available Models:");
            data.models.forEach(m => {
                if (m.name.includes('imagen') || m.supportedGenerationMethods.includes('generateImage') || m.supportedGenerationMethods.includes('image')) {
                    console.log(`- ${m.name} (${m.supportedGenerationMethods})`);
                }
            });
            // Also print all names just in case
            console.log("\nAll Model Names:");
            data.models.forEach(m => console.log(m.name));
        } else {
            console.log("No models found or error:", data);
        }

    } catch (e) {
        console.error("Error:", e);
    }
}

run();
