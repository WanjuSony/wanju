const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');

// 1. Manually read key from .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
let apiKey = process.env.GOOGLE_API_KEY;

if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    const match = content.match(/^GOOGLE_API_KEY=(.*)$/m);
    if (match) apiKey = match[1].trim();
}

console.log("Testing Key:", apiKey ? apiKey.substring(0, 10) + "..." : "NONE");

async function test() {
    if (!apiKey) throw new Error("No Key");

    const genAI = new GoogleGenerativeAI(apiKey);

    try {
        console.log("Attempt 1: gemini-1.5-flash-001");
        const model1 = genAI.getGenerativeModel({ model: "gemini-1.5-flash-001" });
        const res1 = await model1.generateContent("Hello");
        console.log("SUCCESS: gemini-1.5-flash-001 works.", res1.response.text());
        return;
    } catch (e) {
        console.log("gemini-1.5-flash-001 Failed:", e.message);
    }

    try {
        console.log("Attempt 2: gemini-1.5-flash"); // Short alias
        const model2 = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const res2 = await model2.generateContent("Hello");
        console.log("SUCCESS: gemini-1.5-flash works.", res2.response.text());
        return;
    } catch (e) {
        console.log("gemini-1.5-flash Failed:", e.message);
    }

    try {
        console.log("Attempt 3: gemini-pro");
        const model3 = genAI.getGenerativeModel({ model: "gemini-pro" });
        const res3 = await model3.generateContent("Hello");
        console.log("SUCCESS: gemini-pro works.", res3.response.text());
        return;
    } catch (e) {
        console.log("gemini-pro Failed:", e.message);
    }

    // Test gemini-flash-latest
    try {
        console.log("Attempt 4: gemini-flash-latest");
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
        const res = await model.generateContent("Hello");
        console.log("SUCCESS: gemini-flash-latest works.", res.response.text());
        return;
    } catch (e) {
        console.log("gemini-flash-latest Failed:", e.message);
    }
}

test();
