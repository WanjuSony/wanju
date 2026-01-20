import { Transcript } from './types';
import { StructuredInsight } from './types';

import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

export async function analyzeTranscript(transcript: Transcript): Promise<StructuredInsight[]> {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
        console.warn("No GOOGLE_API_KEY found, returning mock data.");
        await new Promise(resolve => setTimeout(resolve, 1500));
        return [
            {
                id: '1',
                type: 'fact',
                content: "API Key Not Found. This is a mock insight.",
                sourceSegmentId: '00:00:00'
            }
        ];
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: "gemini-flash-latest", // Fallback to 'latest' alias as specific versions are hitting quota/404 issues
        generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2,
        }
    });

    const prompt = `
    You are an expert UX Researcher.
    Analyze the attached transcript and extract key findings.
    
    Output JSON format:
    {
        "insights": [
            {
                "type": "fact" | "insight" | "action",
                "content": "Description of the finding",
                "meaning": "Why this matters (optional, for insights)",
                "recommendation": "Actionable step (optional, for actions)",
                "sourceSegmentId": "Timestamp (e.g. 00:04:20) if available"
            }
        ]
    }

    Rules:
    1. "fact": Objective user statement or observation.
    2. "insight": Deeper interpretation of user behavior or need.
    3. "action": Concrete recommendation for product improvement.
    4. Extract at least 5-10 distinct items.
    5. Prioritize "insight" and "action" over simple facts.
    6. Respond in KOREAN (한국어).

    TRANSCRIPT:
    ${transcript.rawContent}
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        const parsed = JSON.parse(text);

        return parsed.insights.map((item: any, index: number) => ({
            id: Date.now().toString() + index,
            ...item
        }));

    } catch (e) {
        console.error("Gemini Analysis Failed:", e);
        return [];
    }
}
