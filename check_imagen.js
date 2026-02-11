
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
    // Try the user's requested model
    const modelName = "nano-banana-pro-preview";
    console.log(`Testing model: ${modelName}`);

    const model = genAI.getGenerativeModel({ model: modelName });

    try {
        const result = await model.generateContent("Draw a storyboard sketch of a user struggling with a complex kiosk interface.");
        console.log("Success!");
        console.log(JSON.stringify(result, null, 2));
    } catch (e) {
        console.error("Error with Nano Banana:", e.message);

        // Fallback test
        try {
            console.log("Retrying with imagen-4.0-generate-001...");
            const model2 = genAI.getGenerativeModel({ model: "imagen-4.0-generate-001" });
            const result2 = await model2.generateContent("Draw a cute robot."); // Note: SDK might not support image gen via generateContent for Imagen models directly without specific config
            console.log("Success with Imagen 4!");
            console.log(JSON.stringify(result2, null, 2));
        } catch (e2) {
            console.error("Error with Imagen 4:", e2.message);
        }
    }
}

run();
