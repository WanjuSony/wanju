import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";
import { getGeminiModel, withRetry, getDynamicApiKey, getDynamicOpenAIKey } from "./gemini-utils";
import path from "path";
import fs from "fs";
import OpenAI from "openai";

export async function uploadToGemini(filePath: string, mimeType: string) {
    const apiKey = getDynamicApiKey();
    if (!apiKey) throw new Error("GOOGLE_API_KEY is not set in env or .env.local");

    const fileManager = new GoogleAIFileManager(apiKey);

    try {
        const uploadResult = await fileManager.uploadFile(filePath, {
            mimeType,
            displayName: path.basename(filePath),
        });

        const file = uploadResult.file;
        console.log(`Uploaded file ${file.displayName} as: ${file.name}`);
        return file;
    } catch (error) {
        console.error("Error uploading to Gemini:", error);
        throw error;
    }
}

export async function waitForProcessing(fileName: string) {
    const apiKey = getDynamicApiKey();
    if (!apiKey) throw new Error("GOOGLE_API_KEY is not set in env or .env.local");
    const fileManager = new GoogleAIFileManager(apiKey);

    let file = await withRetry(() => fileManager.getFile(fileName));
    while (file.state === FileState.PROCESSING) {
        process.stdout.write(".");
        await new Promise((resolve) => setTimeout(resolve, 10000)); // Check every 10s (Avoid 15 RPM limit)
        file = await withRetry(() => fileManager.getFile(fileName));
    }

    if (file.state === FileState.FAILED) {
        throw new Error("Video processing failed.");
    }

    console.log(`\nFile ${file.displayName} is ready for processing.`);
    return file;
}

// Helper: Run Gemini Transcription
export async function runGeminiTranscription(fileUri: string, mimeType: string, speakerCount: number, interviewerName: string, durationSeconds?: string, useJson: boolean = true, model?: any): Promise<string> {
    const apiKey = getDynamicApiKey();
    if (!apiKey) {
        throw new Error("Gemini API Key is missing.");
    }

    // Use passed model OR dynamically select best available model
    const geminiModel = model || await getGeminiModel(apiKey);

    let prompt = "";
    if (useJson) {
        prompt = `
            Listen to the audio. Identify exactly ${speakerCount} distinct speakers by voice.
            
            Context:
            - This is a user research interview.
            - The Interviewer is likely: ${interviewerName || "Speaker 1"}.
            - One speaker (Interviewer) asks most of the questions.
            - The other speaker(s) (Participant/Respondent) provides detailed answers.

            OUTPUT FORMAT: JSON Array
            [
                {
                    "speaker": "Speaker 1",
                    "timestamp": "00:00",
                    "text": "Hello."
                },
                ...
            ]

            RULES:
            1. Use "Speaker 1", "Speaker 2"... as labels. 
            2. If you can confidently identify who is the Interviewer (${interviewerName}), you may use that name instead of "Speaker X", but keep it consistent.
            3. Strictly separate turn-taking. If speaker changes, make a new object.
            4. Do NOT include "Speaker" in the "text" field.
            5. "timestamp" must be MM:SS.
            6. IGNORE background noise or silence. 
        `;
    } else {
        // FALLBACK TEXT PROMPT (Legacy/Robust)
        prompt = `
            Listen to the audio. There are ${speakerCount} distinct speakers.
            Transcribe the conversation verbatim, identifying who is speaking based on their voice.

            Format:
            Speaker 1 [00:00]: Text...
            Speaker 2 [00:05]: Text...

            Rules:
            1. Identify speakers by their unique voice. You MUST use "Speaker 1", "Speaker 2".
            2. Start a new line whenever the speaker changes.
            3. Do NOT hallucinate.
            4. Include timestamps [MM:SS].
        `;
    }

    const result = await withRetry(async () => {
        return await geminiModel.generateContent([
            { fileData: { mimeType, fileUri } },
            { text: prompt }
        ]);
    });

    const text = result.response.text();
    console.log("---------------------------------------------------");
    console.log(`[DEBUG] RAW GEMINI (${useJson ? 'JSON' : 'TEXT'}) START`);
    console.log(text.substring(0, 500) + "..."); // log only start
    console.log(`[DEBUG] RAW GEMINI END`);
    console.log("---------------------------------------------------");

    if (useJson) {
        try {
            const jsonStr = text.replace(/```json|```/g, '').trim();
            const data = JSON.parse(jsonStr);
            if (Array.isArray(data)) {
                // MERGE Logic: Combine consecutive segments from the same speaker
                const mergedData: any[] = [];
                data.forEach((item: any, index: number) => {
                    const prev = mergedData[mergedData.length - 1];
                    if (prev && prev.speaker === item.speaker) {
                        prev.text += "\n" + item.text;
                    } else {
                        mergedData.push({ ...item });
                    }
                });

                // RETURN JSON STRING directly to preserve structure for frontend
                return JSON.stringify(mergedData, null, 2);
            }
        } catch (e) {
            console.error("JSON Parse Failed in JSON Mode, attempting raw return check...", e);
        }
    }

    // Text Mode or JSON Fallback
    let processedText = text;
    // Basic cleanup for text mode
    if (!useJson) {
        // Ensure standard newlines for our parser
        processedText = processedText.replace(/([^\n])\s*(Speaker|화자)/g, '$1\n$2');
        processedText = processedText.replace(/\[(\d{1,2}:\d{2})\]/g, '$1');
    }
    return processedText;
}

// Helper: Run Whisper Transcription
async function runWhisperTranscription(localFilePath: string, speakerCount: number, interviewerName: string): Promise<string> {
    if (!localFilePath || !fs.existsSync(localFilePath)) {
        throw new Error("Local file path missing or invalid. Cannot use OpenAI fallback.");
    }

    const openAIKey = getDynamicOpenAIKey();
    if (!openAIKey) {
        throw new Error("OpenAI API Key is missing. Cannot use fallback transcription.");
    }

    const openai = new OpenAI({ apiKey: openAIKey });

    console.log("Starting OpenAI Whisper Transcription (Verbose JSON)...");

    const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(localFilePath),
        model: "whisper-1",
        language: "ko", // Optimize for Korean
        response_format: "verbose_json",
        timestamp_granularities: ["segment"],
        prompt: `Conversation with ${speakerCount} speakers. Interviewer: ${interviewerName}. Transcribe exactly what is said.`
    }) as any;

    console.log("OpenAI Transcription Complete.");

    let formattedTranscript = "";

    if (transcription.segments) {
        formattedTranscript = transcription.segments.map((seg: any) => {
            const start = new Date(seg.start * 1000).toISOString().substr(14, 5); // MM:SS
            // Default to 'Speaker' for Whisper as it cannot diarize
            return `Speaker ${start}: ${seg.text.trim()}`;
        }).join("\n\n");
    } else {
        formattedTranscript = transcription.text;
    }

    return formattedTranscript;
}


// Helper to count unique speakers in text
function checkUniqueSpeakers(text: string): number {
    // Matches "Speaker 1", "Speaker A", "화자 1" etc.
    // Also checks JSON structure if present
    const speakerMatches = text.match(/"speaker":\s*"([^"]+)"/g);
    if (speakerMatches) {
        const unique = new Set(speakerMatches.map(s => s.toLowerCase()));
        return unique.size;
    }

    // Fallback for raw text
    const textMatches = text.match(/(Speaker|화자|참여자|질문자|면접관|응답자)\s*\d+/gi);
    if (textMatches) {
        const unique = new Set(textMatches.map(s => s.toLowerCase()));
        return unique.size;
    }

    return 1; // Default to 1 if no distinct patterns found
}

export async function transcribeMedia(fileUri: string, mimeType: string, speakerCount: number = 2, interviewerName: string = "", localFilePath?: string, durationSeconds?: string): Promise<string> {

    console.log(`\n=== [TRANSCRIPTION START] ===`);
    console.log(`Params: speakerCount=${speakerCount}, mimeType=${mimeType}`);
    console.log(`Strategy: ${speakerCount > 1 ? 'Multi-Speaker (Gemini Priority)' : 'Single-Speaker (Whisper Priority)'}`);

    let finalTranscript = "";

    // UPLOAD STEP (Global scope): Upload if local file, so Step 1 and 3 can use it.
    let geminiFileUri = fileUri;

    // Optimization: Only upload if we are likely to use Gemini (Step 1 or fallback Step 3)
    // If speakerCount == 1, we try Whisper first (Step 2). To optimize, we *could* wait.
    // However, to ensure reliability given recent errors, let's proactively upload if it's local.
    if ((speakerCount > 1 || true) && !fileUri.startsWith('http') && fs.existsSync(fileUri)) {
        try {
            console.log(`[Step 0] Uploading local file to Gemini: ${fileUri}`);
            const upload = await uploadToGemini(fileUri, mimeType);
            const processedFile = await waitForProcessing(upload.name);
            geminiFileUri = processedFile.uri;
            console.log(`[Step 0] File ready at URI: ${geminiFileUri}`);
        } catch (e) {
            console.error("Upload failed (safe to ignore if using Whisper only):", e);
        }
    }

    // 1. Priority: Multi-speaker -> Gemini Pro (Native Diarization)
    if (speakerCount > 1) {
        console.log(`[Step 1] Attempting Gemini Pro (Target: >= 2 Speakers)...`);
        try {
            // Force Pro model for Diarization quality
            const proModel = await getGeminiModel(getDynamicApiKey()!, true);

            // Step 1: Use JSON mode for structural safety
            const trans = await runGeminiTranscription(geminiFileUri, mimeType, speakerCount, interviewerName, durationSeconds, true, proModel);


            // VALIDATION: Check unique speakers
            const uniqueCount = checkUniqueSpeakers(trans);
            console.log(`[Validation] Gemini Output Unique Speakers: ${uniqueCount}`);

            if (uniqueCount < 2) {
                console.warn(`[Validation FAIL] Requested ${speakerCount} speakers but found only ${uniqueCount}. RETRYING Gemini...`);
                // Do NOT fallback to Whisper (which guarantees 1 speaker). Retry Gemini!
                throw new Error(`Diarization Failed: Found ${uniqueCount} speakers.`);
            } else {
                console.log(`[Validation PASS] Diarization successful.`);
                return trans;
            }

        } catch (e: any) {
            console.error(`[Step 1 FAIL] Gemini Error/Validation Fail: ${e.message}`);
            // If Gemini fails, we skip Whisper (since it can't diarize) and go straight to Step 3 (Final Retry)
            // unless it was a network error. But for logic errors (1 speaker), Whisper is useless.
            console.log("[Step 1] Skipping Whisper fallback because it cannot diarize.");
        }
    } else {
        console.log(`[Step 1 SKIP] Single speaker requested.`);
    }

    // 2. Priority: Single Speaker ONLY -> Whisper
    // If we are here and speakerCount > 1, it means Gemini failed. Wihsper is not a valid fallback for diarization (Speaker 1 issues).
    // So we ONLY use Whisper if speakerCount === 1 OR if we really want to transcribe content regardless of speakers.
    // User hates "Speaker 1" result, so for Multi-speaker, we should AVOID Whisper if possible.

    let whisperError = null;
    if (speakerCount === 1 && localFilePath && fs.existsSync(localFilePath)) {
        // ... Normal Whisper Logic for Single Speaker ...
        // (Existing code OK here, but we guard it with speakerCount === 1)
        console.log(`[Step 2] Single Speaker -> Attempting Whisper...`);
        try {
            // Check file size for Whisper (Limit is 25 MB)
            const stats = fs.statSync(localFilePath);
            const fileSizeInMB = (stats.size / 1024 / 1024);

            if (fileSizeInMB <= 24) {
                const trans = await runWhisperTranscription(localFilePath, speakerCount, interviewerName);
                if (trans && trans.trim().length > 0) {
                    console.log("[Step 2 SUCCESS] Whisper transcription complete.");
                    // No warning needed here as it's explicitly for single speaker
                    return trans;
                }
            } else {
                console.log(`[Step 2 SKIP] File too large for Whisper (${fileSizeInMB.toFixed(2)} MB).`);
            }
        } catch (e: any) {
            console.error("[Step 2 FAIL] Whisper Failed:", e.message);
            whisperError = e;
        }
    } else if (speakerCount > 1) {
        console.log(`[Step 2 SKIP] Multi-speaker request. Skipping Whisper to avoid 'Speaker 1' grouping.`);
    }

    console.log(`[Step 3] Final Resort: Gemini Retry (Mode: TEXT_FALLBACK)`);
    try {
        // Retry with useJson = false (Text mode) to avoid JSON syntax errors causing full failure
        // We reuse the geminiFileUri potentially uploaded in Step 0
        // Force Pro for multi-speaker quality even in fallback
        const currentModel = (speakerCount > 1) ? await getGeminiModel(getDynamicApiKey()!, true) : undefined;
        const trans = await runGeminiTranscription(geminiFileUri, mimeType, speakerCount, interviewerName, durationSeconds, false, currentModel);

        // We do NOT strictly validate uniqueness here because it's the last resort. Better something than nothing.
        // But we log it.
        const uniqueCount = checkUniqueSpeakers(trans || "");
        console.log(`[Final Result] Unique Speakers found: ${uniqueCount}`);

        if (!trans || trans.trim().length === 0) {
            throw new Error("Gemini returned empty transcript.");
        }
        return trans;
    } catch (geminiError: any) {
        let errorMsg = `All Transcription Attempts Failed.\nLast Error (Gemini): ${geminiError.message}`;
        if (whisperError) {
            errorMsg += `\nPrevious Error (Whisper): ${whisperError.message}`;
        }
        console.error("[FINAL FAIL]", errorMsg);
        throw new Error(errorMsg);
    }
}
