import { TranscriptSegment } from './types';

export const parseTranscriptContent = (rawContent: string, title?: string) => {
    const segments: TranscriptSegment[] = [];
    const headers: string[] = [];

    // Pre-check: Is it JSON?
    try {
        const trimmed = rawContent.trim();

        // Robust extraction: Find the first '[' and last ']' (or curly braces)
        const firstBracket = trimmed.indexOf('[');
        const lastBracket = trimmed.lastIndexOf(']');
        const firstCurly = trimmed.indexOf('{');
        const lastCurly = trimmed.lastIndexOf('}');

        let jsonCandidate = "";

        // Prefer array if available and looks valid
        if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
            jsonCandidate = trimmed.substring(firstBracket, lastBracket + 1);
        } else if (firstCurly !== -1 && lastCurly !== -1 && lastCurly > firstCurly) {
            jsonCandidate = trimmed.substring(firstCurly, lastCurly + 1);
        }

        if (jsonCandidate) {
            const parsed = JSON.parse(jsonCandidate);
            const dataArray = Array.isArray(parsed) ? parsed : (parsed.segments || parsed.transcript || []);

            if (Array.isArray(dataArray) && dataArray.length > 0) {
                // Map JSON to Segments
                dataArray.forEach((item: any, idx: number) => {
                    segments.push({
                        id: `seg-${idx}`,
                        speaker: item.speaker || item.role || `Speaker ${idx}`,
                        timestamp: item.time || item.timestamp || '00:00',
                        text: item.text || item.content || item.message || ''
                    });
                });

                return {
                    title: title || 'Transcript',
                    headers: [],
                    segments,
                    rawContent
                };
            }
        }
    } catch (e) {
        // Not JSON, proceed to text parsing
        console.warn("JSON parse attempt failed, falling back to text", e);
    }

    console.log('[DEBUG] Parsing content sample:', rawContent.substring(0, 200).replace(/\n/g, '\\n'));

    // Normalize line endings (handle \r for legacy Mac/Word exports)
    const lines = rawContent.split(/\r\n|\r|\n/);

    let currentSpeaker = '';
    let currentTimestamp = '';
    let currentTextBuffer: string[] = [];

    // Regex explanation:
    // Group 1: Speaker Name (start of line)
    // Group 2: Timestamp (MM:SS or HH:MM:SS), optionally wrapped in [], (), or just bare.
    // Separators: Can be space, colon, or nothing.
    const universalRegex = /^([^\d\n].+?)(?:\s+|:\s*|,\s*)[\(\[]?(\d{1,2}:\d{2}(?::\d{2})?)[\)\]]?\s*(?::|-)?\s*(.*)/;

    // [NEW] Robust Chat Regex for "Name Time Text" format (e.g. "나리 3:30예.네")
    // Handles cases where text immediately follows time, or tight spacing
    const chatRegex = /^([^\d\n].+?)\s+(\d{1,2}:\d{2})(.*)/;

    // Metadata patterns to explicitly identify as headers
    const metadataPatterns = [
        /^\d{4}년/,         // Year start like "2026년"
        /^\d{2}\.\d{2}\.\d{2}/, // Date dot format
        /^\d+분 \d+초/,     // Duration format "31분 43초"
        /^\d+시간/,         // Duration start with hour
        /^\d{1,2}:\d{2}$/,  // Just a time like "7:03"
        /^녹음녹화/          // Recording label
    ];

    for (const line of lines) {
        if (!line.trim()) continue;
        const trimmedLine = line.trim();

        // 1. Check if it's a known metadata line
        const isMetadata = metadataPatterns.some(p => p.test(trimmedLine));

        // 2. Check if it matches the Speaker+Timestamp pattern
        // Try specific chat regex first, then universal
        const match = trimmedLine.match(chatRegex) || trimmedLine.match(universalRegex);

        if (match && !isMetadata) {
            // It looks like a speaker line AND isn't explicit metadata

            // Push previous speaker's segment if exists
            if (currentSpeaker && currentTextBuffer.length > 0) {
                segments.push({
                    id: `seg-${segments.length}`,
                    speaker: currentSpeaker,
                    timestamp: currentTimestamp,
                    text: currentTextBuffer.join('\n').trim()
                });
                currentTextBuffer = [];
            }

            // Start new speaker segment
            currentSpeaker = match[1].trim();
            currentSpeaker = currentSpeaker.replace(/[:()]+$/, '').trim(); // Remove trailing colons

            currentTimestamp = match[2].trim();
            const restOfLog = match[3] || "";
            const cleanText = restOfLog.replace(/^[:\s()]+/, ''); // Remove leading colon/space/parentheses from text

            if (cleanText) currentTextBuffer.push(cleanText);

        } else if (currentSpeaker) {
            // If we have an active speaker, this is likely a continuation of their speech
            currentTextBuffer.push(trimmedLine);
        } else {
            // Fallback: Check for simple "Speaker:" pattern without timestamp
            // e.g. "Speaker 1: Hello"
            const simpleMatch = trimmedLine.match(/^([^:]+):\s*(.*)/);
            if (simpleMatch && !isMetadata) {
                const potentialSpeaker = simpleMatch[1].trim();
                // Arbitrary length check to avoid capturing normal sentences with colons
                if (potentialSpeaker.length < 20) {
                    if (currentSpeaker && currentTextBuffer.length > 0) {
                        segments.push({
                            id: `seg-${segments.length}`,
                            speaker: currentSpeaker,
                            timestamp: currentTimestamp || '00:00',
                            text: currentTextBuffer.join('\n').trim()
                        });
                        currentTextBuffer = [];
                    }
                    currentSpeaker = potentialSpeaker;
                    currentTextBuffer.push(simpleMatch[2].trim());
                    continue;
                }
            }

            // No active speaker yet, and didn't match speaker regex -> It's a Header or just raw text
            headers.push(trimmedLine);
            // If we really haven't found a speaker yet, maybe treat this line as content for "Unknown"?
            if (!currentSpeaker && !isMetadata) {
                // Lazy init "Unknown" speaker to capture unstructured text
                currentSpeaker = "Transcript";
                currentTextBuffer.push(trimmedLine);
            }
        }
    }

    // Push the final segment
    if (currentSpeaker && currentTextBuffer.length > 0) {
        segments.push({
            id: `seg-${segments.length}`,
            speaker: currentSpeaker,
            timestamp: currentTimestamp || '00:00',
            text: currentTextBuffer.join('\n').trim()
        });
    }

    // ABSOLUTE FALLBACK: If still no segments, puts everything in one
    if (segments.length === 0 && rawContent.trim().length > 0) {
        segments.push({
            id: 'seg-fallback',
            speaker: 'System',
            timestamp: '00:00',
            text: rawContent
        });
    }

    return {
        title: title || 'Transcript',
        headers,
        segments,
        rawContent
    };
};
