const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');

// 1. Manually read key (same logic as gemini-utils)
const envPath = path.resolve(process.cwd(), '.env.local');
let apiKey = process.env.GOOGLE_API_KEY;

if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    const match = content.match(/^GOOGLE_API_KEY=(.*)$/m);
    if (match) apiKey = match[1].trim();
}

console.log("Testing Key:", apiKey ? apiKey.substring(0, 5) + "..." : "NONE");

async function test() {
    if (!apiKey) throw new Error("No Key");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    try {
        const result = await model.generateContent("Hello, are you working?");
        console.log("Response:", result.response.text());
        console.log("SUCCESS: Key is valid and working for text.");
    } catch (e) {
        console.error("FAILURE:", e.message);
    }
}

test();
