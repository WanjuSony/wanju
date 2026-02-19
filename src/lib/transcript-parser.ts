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

    // Enhanced Regex Patterns for Better Speaker Detection

    // Pattern 1: Universal format with timestamp - "Speaker Name (00:00): text" or "Speaker Name [00:00] text"
    const universalRegex = /^([^\d\n].+?)(?:\s+|:\s*|,\s*)[\(\[]?(\d{1,2}:\d{2}(?::\d{2})?)[\)\]]?\s*(?::|-)?\s*(.*)/;

    // Pattern 2: Korean speaker format - "화자1", "참여자1", "면접관" etc with timestamp
    const koreanSpeakerRegex = /^(화자|참여자|인터뷰어|면접관|응답자|질문자)\s*(\d+)?\s*[\(\[]?(\d{1,2}:\d{2}(?::\d{2})?)[\)\]]?\s*(?::|-|:)?\s*(.*)/;

    // Pattern 3: Tight chat format - "Name 3:30text" (no space between time and text)
    const chatRegex = /^([^\d\n].+?)\s+(\d{1,2}:\d{2})(.*)/;

    // Pattern 4: Simple speaker with timestamp in parentheses - "Speaker (00:00:15)"
    const speakerParenRegex = /^(.+?)\s*\((\d{1,2}:\d{2}(?::\d{2})?)\)\s*:?\s*(.*)/;

    // Metadata patterns to explicitly identify as headers (not speakers)
    const metadataPatterns = [
        /^\d{4}년/,         // Year start like "2026년"
        /^\d{2}\.\d{2}\.\d{2}/, // Date dot format
        /^\d+분 \d+초/,     // Duration format "31분 43초"
        /^\d+시간/,         // Duration start with hour
        /^\d{1,2}:\d{2}$/,  // Just a time like "7:03"
        /^녹음녹화/,         // Recording label
        /^Recording/i       // English recording label
    ];

    for (const line of lines) {
        if (!line.trim()) continue;
        const trimmedLine = line.trim();

        // 1. Check if it's a known metadata line
        const isMetadata = metadataPatterns.some(p => p.test(trimmedLine));

        // 2. Check if it matches any Speaker+Timestamp pattern
        // Try multiple patterns in order of specificity
        const match = trimmedLine.match(koreanSpeakerRegex) ||
            trimmedLine.match(speakerParenRegex) ||
            trimmedLine.match(chatRegex) ||
            trimmedLine.match(universalRegex);

        if (match && !isMetadata) {
            // It looks like a speaker line AND isn't explicit metadata

            console.log('[DEBUG] Speaker pattern matched:', {
                line: trimmedLine.substring(0, 50),
                speaker: match[1],
                timestamp: match[2] || match[3]
            });

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
            // For Korean regex, combine group 1 and 2 (e.g., "화자" + "1")
            if (trimmedLine.match(koreanSpeakerRegex)) {
                currentSpeaker = match[1].trim() + (match[2] || '');
                currentTimestamp = match[3]?.trim() || '00:00';
                const restOfLog = match[4] || "";
                const cleanText = restOfLog.replace(/^[:\s()]+/, '');
                if (cleanText) currentTextBuffer.push(cleanText);
            } else {
                currentSpeaker = match[1].trim();
                currentSpeaker = currentSpeaker.replace(/[:()]+$/, '').trim(); // Remove trailing colons
                currentTimestamp = match[2]?.trim() || '00:00';
                const restOfLog = match[3] || "";
                const cleanText = restOfLog.replace(/^[:\s()]+/, '');
                if (cleanText) currentTextBuffer.push(cleanText);
            }

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

            // No active speaker pattern found -> treat as header/metadata
            // DO NOT automatically create a "Transcript" speaker
            // This was causing all content to be grouped under one speaker
            if (!isMetadata) {
                console.warn('[PARSER WARNING] Line does not match speaker pattern:', trimmedLine.substring(0, 50));
            }
            headers.push(trimmedLine);
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

    // VALIDATION: Check if we detected multiple speakers
    if (segments.length === 0 && rawContent.trim().length > 0) {
        console.error('[PARSER ERROR] No speaker patterns detected in transcript. Content length:', rawContent.length);
        console.error('[PARSER ERROR] First 500 chars:', rawContent.substring(0, 500));
        console.error('[PARSER ERROR] This usually means the transcript format does not match expected patterns.');
        console.error('[PARSER ERROR] Expected formats: "Speaker Name (00:00): text" or "화자1 00:00: text"');

        // Create a fallback segment with clear error indication
        segments.push({
            id: 'seg-parse-error',
            speaker: 'PARSE_ERROR_NO_SPEAKERS_DETECTED',
            timestamp: '00:00',
            text: '⚠️ 파싱 오류: 화자 패턴을 찾을 수 없습니다. 전사 파일 형식을 확인해주세요.\n\n' + rawContent
        });
    } else if (segments.length > 0) {
        // Check if all segments have the same speaker (possible parsing issue)
        const uniqueSpeakers = new Set(segments.map(s => s.speaker));
        if (uniqueSpeakers.size === 1) {
            console.warn('[PARSER WARNING] All segments assigned to single speaker:', Array.from(uniqueSpeakers)[0]);
            console.warn('[PARSER WARNING] This may indicate a parsing issue. Total segments:', segments.length);
        } else {
            console.log('[PARSER SUCCESS] Detected', uniqueSpeakers.size, 'unique speakers:', Array.from(uniqueSpeakers));
        }
    }

    return {
        title: title || 'Transcript',
        headers,
        segments,
        rawContent
    };
};
