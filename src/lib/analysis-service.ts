import { Transcript } from './types';
import { StructuredInsight } from './types';
import { UNIVERSAL_UX_PRINCIPLES } from './research-knowledge';

import { GoogleAIFileManager, FileState } from '@google/generative-ai/server';
import { getGeminiModel, withRetry, getDynamicApiKey, getDynamicOpenAIKey } from "./gemini-utils";
import { writeFile, unlink } from 'fs/promises';
import path from 'path';
import os from 'os';
import OpenAI from "openai";

interface AnalysisContext {
    projectTitle: string;
    projectDescription: string;
    methodologies?: string[];
    researchQuestions?: string[];
}

// Helper for OpenAI Fallback
async function callOpenAI(prompt: string, jsonMode: boolean = false): Promise<string> {
    const openAIKey = getDynamicOpenAIKey();
    if (!openAIKey) throw new Error("OpenAI API Key missing for fallback.");

    const openai = new OpenAI({ apiKey: openAIKey });
    const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: jsonMode ? { type: "json_object" } : { type: "text" },
        temperature: 0.2,
    });

    return completion.choices[0].message.content || "";
}

export async function analyzeTranscript(transcript: Transcript, context?: AnalysisContext): Promise<{ summary: string; insights: StructuredInsight[] }> {
    // Safety Check: If transcript is empty/missing, return default state immediately.
    if (!transcript.rawContent || transcript.rawContent.length < 50 || transcript.rawContent.includes("(No Transcript Provided)")) {
        return {
            summary: "Transcript not available for analysis. Please upload an Audio File to generate a transcript first.",
            insights: []
        };
    }

    const projectContextStr = context ? `
    PROJECT CONTEXT:
    Title: ${context.projectTitle}
    Description: ${context.projectDescription}
    
    CUSTOM METHODOLOGIES PROVIDED:
    ${context.methodologies?.join('\n\n') || "None"}
    ` : "";

    const researchQuestionsStr = context?.researchQuestions && context.researchQuestions.length > 0
        ? `\n    RESEARCH QUESTIONS TO ANSWER:\n    ${context.researchQuestions.map((q, i) => `RQ${i + 1}: ${q}`).join('\n    ')}\n`
        : "";

    const prompt = `
    You are an expert UX Researcher with 20 years of experience.
    Your goal is to analyze the attached interview transcript and extract distinct, actionable insights based on OBJECTIVE evidence.
    
    ${UNIVERSAL_UX_PRINCIPLES}

    ${projectContextStr}
    ${researchQuestionsStr}
    
    Output JSON format:
    {
        "summary": "Start with '## 1. 개요 (Overview)' and '## 2. 주요 테마 (Key Themes)'. Use Markdown. Detailed summary of the interview.",
        "insights": [
            {
                "type": "fact" | "insight" | "action",
                "content": "Description of the finding",
                "meaning": "Why this matters / Context (REQUIRED). Explain the background or significance of this finding.",
                "recommendation": "Actionable step (optional, for actions)",
                "sourceSegmentId": "Best matching Timestamp (MM:SS). FIND THE CLOSEST MATCHING QUOTE. Do not leave empty.",
                "researchQuestion": "The specific research question (RQ1, RQ2...) this insight answers. Categorize into the most relevant one from the list above. If it doesn't fit any, use 'General'."
            }
        ]
    }

    Rules:
    1. Extract at least 5-10 distinct items.
    2. Prioritize "insight" and "action".
    3. **CRITICAL: RESPOND ONLY IN KOREAN (한국어). Do not output English.**
    4. CITATION IS MANDATORY (Time or Quote). **Every insight MUST have a sourceSegmentId (MM:SS).**
    5. **meaning (Why) is REQUIRED.** Don't just state the fact, explain *why* it is important to the user.
    6. **CRITICAL: sourceSegmentId MUST be 'MM:SS' format. Do NOT translate it (e.g. NOT '도입부').**

    TRANSCRIPT:
    ${transcript.rawContent}
    `;

    let textResponse = "";

    try {
        // Try Gemini
        const apiKey = getDynamicApiKey();
        if (!apiKey) throw new Error("No Gemini Key");

        const model = await getGeminiModel(apiKey, true); // PREFER PRO MODEL
        const result = await withRetry(async () => {
            return await model.generateContent({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: "application/json", temperature: 0.2 }
            });
        });
        textResponse = result.response.text();

    } catch (e: any) {
        console.error("Gemini Analysis Failed. Falling back to OpenAI...", e.message);
        try {
            textResponse = await callOpenAI(prompt, true);
        } catch (openaiError: any) {
            return {
                summary: "Analysis failed (Both Gemini & OpenAI).",
                insights: [{ id: 'err', type: 'fact', content: `Error: ${openaiError.message}`, sourceSegmentId: 'System' }]
            };
        }
    }

    try {
        // Clean and Parse
        textResponse = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(textResponse);

        if (!parsed.insights || !Array.isArray(parsed.insights)) throw new Error("Invalid JSON structure");

        return {
            summary: parsed.summary || "Summary not generated.",
            insights: parsed.insights.map((item: any, index: number) => ({
                id: Date.now().toString() + index,
                ...item
            }))
        };
    } catch (parseError) {
        return {
            summary: "Analysis failed to parse.",
            insights: []
        };
    }
}

export async function analyzeSimulation(
    messages: { role: string, text: string }[],
    context?: AnalysisContext
): Promise<{ summary: string; insights: StructuredInsight[] }> {
    if (messages.length < 2) {
        return {
            summary: "More conversation is needed for analysis.",
            insights: []
        };
    }

    const transcriptContent = messages.map(m => `[${m.role.toUpperCase()}]: ${m.text}`).join('\n');

    // We repurpose analyzeTranscript's core logic but with a simplified transcript object
    // or just call analyzeTranscript with a mock object.
    const mockTranscript = {
        id: 'simulation',
        title: 'Simulation Session',
        headers: [],
        segments: [],
        rawContent: transcriptContent
    };

    return analyzeTranscript(mockTranscript, context);
}

// Modified to return standard StructuredInsight format relative to the whole interview
export async function analyzeVideoForInsights(videoBuffer: Buffer, mimeType: string, context?: AnalysisContext): Promise<{ summary: string; insights: StructuredInsight[] }> {
    const apiKey = getDynamicApiKey();
    if (!apiKey) throw new Error("Gemini API Key Missing");

    const tempFilePath = path.join(os.tmpdir(), `upload-video-${Date.now()}.mp4`);
    await writeFile(tempFilePath, videoBuffer);

    try {
        const fileManager = new GoogleAIFileManager(apiKey);
        const uploadResult = await fileManager.uploadFile(tempFilePath, { mimeType, displayName: "Video Analysis Source" });

        let file = await fileManager.getFile(uploadResult.file.name);
        while (file.state === FileState.PROCESSING) {
            await new Promise((resolve) => setTimeout(resolve, 5000));
            file = await fileManager.getFile(uploadResult.file.name);
        }

        if (file.state === FileState.FAILED) throw new Error("Video processing failed.");

        const model = await getGeminiModel(apiKey, true); // PREFER PRO
        const projectContextStr = context ? `
        PROJECT CONTEXT:
        Title: ${context.projectTitle}
        Description: ${context.projectDescription}
        ` : "";

        const researchQuestionsStr = context?.researchQuestions && context.researchQuestions.length > 0
            ? `\n        RESEARCH QUESTIONS TO ANSWER:\n        ${context.researchQuestions.map((q, i) => `RQ${i + 1}: ${q}`).join('\n        ')}\n`
            : "";

        const prompt = `
        You are an expert UX Researcher. Analyze this user interview video.
        
        ${UNIVERSAL_UX_PRINCIPLES}
        ${projectContextStr}
        ${researchQuestionsStr}

        Output JSON format:
        {
            "summary": "A 3-5 sentence high-level summary of the interview.",
            "insights": [
                {
                    "type": "fact" | "insight" | "action",
                    "content": "Description",
                    "meaning": "Why this matters",
                    "recommendation": "Actionable step",
                    "sourceSegmentId": "Timestamp (MM:SS) where this occurred",
                    "researchQuestion": "The specific research question (RQ1, RQ2...) this insight answers. If it doesn't fit any, use 'General'."
                }
            ]
        }

        Rules:
        1. Extract 5-10 distinct insights.
        2. **CRITICAL: RESPOND ONLY IN KOREAN.**
        3. **CRITICAL: Use EXACT MM:SS timestamps from the video.**
        `;

        const result = await withRetry(async () => {
            return await model.generateContent({
                contents: [
                    { role: "user", parts: [{ fileData: { mimeType: uploadResult.file.mimeType, fileUri: uploadResult.file.uri } }] },
                    { role: "user", parts: [{ text: prompt }] }
                ],
                generationConfig: { responseMimeType: "application/json" }
            });
        });

        const parsed = JSON.parse(result.response.text());

        return {
            summary: parsed.summary || "Video summary not generated.",
            insights: parsed.insights.map((item: any, i: number) => ({
                id: `vid-${Date.now()}-${i}`,
                ...item
            }))
        };

    } catch (e: any) {
        console.error("Video Analysis For Insights Failed:", e);
        throw new Error(`Video Analysis Failed: ${e.message}`);
    } finally {
        await unlink(tempFilePath).catch(console.error);
    }
}

// Kept for backward compatibility but unused
export async function analyzeVideo(videoBuffer: Buffer, mimeType: string, context?: AnalysisContext): Promise<StructuredInsight[]> {
    return [];
}

export async function generateSummary(transcript: Transcript, context?: AnalysisContext): Promise<string> {
    const prompt = `
    Summarize this transcript (3-5 paragraphs).
    Cover main topics, sentiment, pain points.
    Structure: Overview, Key Themes, Conclusion.
    **CRITICAL: RESPOND ONLY IN KOREAN (한국어).**
    
    TRANSCRIPT:
    ${transcript.rawContent.slice(0, 500000)}
    `;

    try {
        const apiKey = getDynamicApiKey();
        if (!apiKey) throw new Error("No Gemini Key");

        const model = await getGeminiModel(apiKey);
        const result = await withRetry(async () => await model.generateContent(prompt));
        return result.response.text();

    } catch (e: any) {
        console.warn("Gemini Summary Failed, trying OpenAI...", e.message);
        try {
            return await callOpenAI(prompt);
        } catch (openaiErr) {
            return "Failed to generate summary.";
        }
    }
}

export async function generateInterviewerFeedback(transcript: Transcript, discussionGuide: string[], context?: AnalysisContext): Promise<string> {
    // Safety Check
    if (!transcript.rawContent || transcript.rawContent.length < 50 || transcript.rawContent.includes("(No Transcript Provided)")) {
        return JSON.stringify({
            score: 0,
            overall_critique: "Transcript is too short or missing for meaningful feedback.",
            strengths: [],
            improvements: []
        });
    }

    const prompt = `
    You are a Senior UX Research Manager. Critique the Interviewer's performance.
    
    Discussion Guide:
    ${discussionGuide.length > 0 ? discussionGuide.join('\n- ') : "None"}
    
    Evaluate: Coverage, Depth, Neutrality, Flow.
    
    Output simple JSON:
    {
      "score": 0-100,
      "strengths": [{ "strength": "...", "timestamp": "MM:SS" }],
      "improvements": [{ "timestamp": "MM:SS", "critique": "...", "correct_question": "...", "quote": "Actual phrasing used by interviewer" }],
      "overall_critique": "..."
    }
    
    **CRITICAL: RESPOND ONLY IN KOREAN (한국어). Do not output English.**
    **CRITICAL: Use EXACT timestamps (MM:SS) found in the transcript. Do NOT translate timestamps (e.g. NOT '도입부').**
    
    TRANSCRIPT:
    ${transcript.rawContent.slice(0, 150000)}
    `;

    try {
        const apiKey = getDynamicApiKey();
        if (!apiKey) throw new Error("No Gemini Key");

        const model = await getGeminiModel(apiKey, true); // PREFER PRO
        const result = await withRetry(async () => {
            return await model.generateContent({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: "application/json" }
            });
        });

        // Return raw text, but ensure it looks like JSON if possible
        const text = result.response.text();
        if (!text || text.trim().length === 0) throw new Error("Empty response from AI");
        return text;

    } catch (e: any) {
        console.warn("Gemini Feedback Failed, trying OpenAI...", e.message);
        try {
            return await callOpenAI(prompt, true);
        } catch (openaiErr: any) {
            console.error("Feedback Generation Failed completely:", openaiErr);
            throw new Error(`AI Analysis Failed: ${openaiErr.message || "Unknown error"}`);
        }
    }
}
