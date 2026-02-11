
import { TranscriptSegment } from './types';

/**
 * Robustly parses a JSON string (potentially wrapped in markdown code blocks)
 * and normalizes it into TranscriptSegment[].
 * 
 * Handles edge cases:
 * - Markdown fences (```json ... ```)
 * - Mismatched keys (time vs timestamp)
 * - Missing fields (speaker, text)
 * - Non-array validation
 */
export function safeParseJSON(jsonString: string): TranscriptSegment[] | null {
    if (!jsonString) return null;

    try {
        // 1. Clean Markdown Fences
        const cleanJson = jsonString
            .replace(/```json/g, '')
            .replace(/```/g, '')
            .trim();

        // 2. Parse
        const parsed = JSON.parse(cleanJson);

        // 3. Validate Array
        if (!Array.isArray(parsed)) {
            console.warn("[safeParseJSON] Parsed result is not an array:", parsed);
            return null;
        }

        // 4. Normalize & Map
        const segments: TranscriptSegment[] = parsed
            .map((item: any, index: number) => {
                const speaker = item.speaker || item.role || `Speaker ${index + 1}`;
                // Fallback priorities: timestamp -> time -> start -> "00:00"
                const timestamp = item.timestamp || item.time || item.start || "00:00";
                const text = item.text || item.message || item.content;

                // 5. Hard Validation: Must have text to be useful
                if (!text || typeof text !== 'string' || text.trim() === '') {
                    return null;
                }

                return {
                    id: `seg-${index}`,
                    speaker: String(speaker),
                    timestamp: String(timestamp),
                    text: String(text).trim()
                } as TranscriptSegment;
            })
            .filter((s): s is TranscriptSegment => s !== null); // Remove nulls

        // 6. Final safety check on length
        if (segments.length === 0) return null;

        return segments;

    } catch (e) {
        console.error("[safeParseJSON] Parse Failed:", e);
        return null;
    }
}
