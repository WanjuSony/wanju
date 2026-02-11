import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import fs from "fs";
import path from "path";

// Function to read API Key dynamically (Hot-Reload)
export function getDynamicApiKey(): string | undefined {
    // 1. Try process.env first (in case of production deployment)
    let key = process.env.GOOGLE_API_KEY;

    // 2. In Local Development, Process.env might be stale. Read .env.local directly.
    if (process.env.NODE_ENV !== 'production') {
        try {
            const envPath = path.resolve(process.cwd(), '.env.local');
            if (fs.existsSync(envPath)) {
                const envContent = fs.readFileSync(envPath, 'utf8');
                const match = envContent.match(/^GOOGLE_API_KEY=(.*)$/m);
                if (match) {
                    key = match[1].trim();
                }
            }
        } catch (e) {
            console.error("Failed to read .env.local dynamically:", e);
        }
    }
    return key;
}

export function getDynamicOpenAIKey(): string | undefined {
    let key = process.env.OPENAI_API_KEY;
    if (process.env.NODE_ENV !== 'production') {
        try {
            const envPath = path.resolve(process.cwd(), '.env.local');
            if (fs.existsSync(envPath)) {
                const envContent = fs.readFileSync(envPath, 'utf8');
                const match = envContent.match(/^OPENAI_API_KEY=(.*)$/m);
                if (match) key = match[1].trim();
            }
        } catch (e) {
            console.error("Failed to read .env.local for OpenAI:", e);
        }
    }
    return key;
}

// Centralized Model Name
// Validated Model Cache
let cachedFlashModel: string | null = null;
let cachedProModel: string | null = null;

async function identifyBestGeminiModel(apiKey: string, preferPro: boolean = false): Promise<string> {
    if (preferPro && cachedProModel) return cachedProModel;
    if (!preferPro && cachedFlashModel) return cachedFlashModel;

    console.log(`Fetching available Gemini models (${preferPro ? 'Pro' : 'Flash'} Priority)...`);
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (!response.ok) {
            throw new Error(`Model List API Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const models = (data.models || []) as { name: string, supportedGenerationMethods: string[] }[];

        const validModels = models.filter(m => m.supportedGenerationMethods.includes("generateContent"));
        const validNames = validModels.map(m => m.name.replace("models/", ""));

        let priority: string[] = [];
        if (preferPro) {
            priority = [
                "gemini-2.5-pro",
                "gemini-2.0-pro-exp", // If exists
                "gemini-1.5-pro",
                "gemini-1.5-pro-001",
                "gemini-pro",
                // Fallback to high quality flash if pro missing
                "gemini-2.0-flash"
            ];
        } else {
            priority = [
                "gemini-2.0-flash",
                "gemini-2.0-flash-001",
                "gemini-2.5-flash",
                "gemini-1.5-flash",
                "gemini-1.5-flash-001",
            ];
        }

        for (const p of priority) {
            if (validNames.includes(p)) {
                console.log(`Selected Best Model (${preferPro ? 'Pro' : 'Flash'}): ${p}`);
                if (preferPro) cachedProModel = p;
                else cachedFlashModel = p;
                return p;
            }
        }

        // Fallback
        const fallback = validNames[0];
        console.log(`Selected Fallback Model: ${fallback}`);
        if (preferPro) cachedProModel = fallback;
        else cachedFlashModel = fallback;
        return fallback;

    } catch (e) {
        console.error("Failed to list models dynamically.", e);
        return preferPro ? "gemini-1.5-pro" : "gemini-2.0-flash";
    }
}

export async function getGeminiModel(apiKey: string, preferPro: boolean = false) {
    const modelName = await identifyBestGeminiModel(apiKey, preferPro);

    const genAI = new GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({
        model: modelName,
        safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ],
        generationConfig: {
            temperature: preferPro ? 0.3 : 0.0,
            topP: 0.8,
            topK: 40,
        }
    });
}

const MAX_RETRIES = 5;
const BASE_DELAY = 2000; // Start with 2 seconds

export async function withRetry<T>(operation: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
    try {
        return await operation();
    } catch (e: any) {
        // Retry on 429 (Too Many Requests), 503 (Service Unavailable), 500 (Internal), or JSON errors
        const msg = e.message || "";
        if (retries > 0 && (
            msg.includes("429") ||
            e.status === 429 ||
            msg.includes("503") ||
            e.status === 503 ||
            msg.includes("500") ||
            e.status === 500 ||
            msg.includes("Internal Server Error") ||
            msg.includes("JSON") ||
            msg.includes("Resource exhausted")
        )) {
            const attempt = MAX_RETRIES - retries + 1;
            console.warn(`Gemini API Error (Attempt ${attempt}/${MAX_RETRIES}): ${msg} - Retrying...`);

            // Exponential Backoff with Jitter: 2s, 4s, 8s, 16s, 32s +/- random
            const delay = (BASE_DELAY * Math.pow(2, attempt - 1)) + (Math.random() * 1000);

            await new Promise(resolve => setTimeout(resolve, delay));

            return withRetry(operation, retries - 1);
        }
        if (retries === 0) {
            throw new Error("Gemini API Quota Exhausted (429). Please use a different Google API Key.");
        }
        throw e;
    }
}
