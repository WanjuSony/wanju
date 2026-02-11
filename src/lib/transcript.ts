import fs from 'fs/promises';
import path from 'path';
import { Transcript, TranscriptSegment } from './types';

// Hardcoded path for now, but could be an env var
const ARCHIVE_PATH = "/Users/invaiz/Documents/develop/UX Research/Lenny's Podcast Transcripts Archive [public]";

export const getTranscriptFiles = async (): Promise<string[]> => {
    try {
        const files = await fs.readdir(ARCHIVE_PATH);
        return files.filter(f => f.endsWith('.txt'));
    } catch (error) {
        console.error("Error reading archive directory:", error);
        return [];
    }
};

export const parseTranscriptContent = (rawContent: string, title: string): Transcript => {
    // Regex logic to parse segments
    // Example: Lenny (00:00:36):
    const segments: TranscriptSegment[] = [];
    const lines = rawContent.split('\n');

    let currentSpeaker = '';
    let currentTimestamp = '';
    let currentTextBuffer: string[] = [];

    const speakerRegex = /^(.+?) \((\d{2}:\d{2}:\d{2})\):/;

    for (const line of lines) {
        const match = line.match(speakerRegex);
        if (match) {
            // If we have a previous segment accumulating, push it
            if (currentSpeaker && currentTextBuffer.length > 0) {
                segments.push({
                    speaker: currentSpeaker,
                    timestamp: currentTimestamp,
                    text: currentTextBuffer.join('\n').trim()
                });
                currentTextBuffer = [];
            }

            currentSpeaker = match[1].trim();
            currentTimestamp = match[2].trim();

            // The rest of the line might be text, or empty
            const restOfLine = line.substring(match[0].length).trim();
            if (restOfLine) {
                currentTextBuffer.push(restOfLine);
            }
        } else {
            // It's a continuation of the previous speaker
            if (currentSpeaker) {
                if (line.trim() !== '') {
                    currentTextBuffer.push(line.trim());
                }
            }
        }
    }

    // Push the last segment
    if (currentSpeaker && currentTextBuffer.length > 0) {
        segments.push({
            speaker: currentSpeaker,
            timestamp: currentTimestamp,
            text: currentTextBuffer.join('\n').trim()
        });
    }

    // Fallback: If no segments were parsed (typical for unstructured docs), create one generic segment
    if (segments.length === 0 && rawContent.trim().length > 0) {
        segments.push({
            speaker: 'Unknown',
            timestamp: '00:00:00',
            text: rawContent.trim()
        });
    }

    return {
        id: title, // Use title as ID for now or caller handles it
        title,
        headers: [],
        segments,
        rawContent
    };
};

export const parseTranscript = async (filename: string): Promise<Transcript | null> => {
    try {
        const filePath = path.join(ARCHIVE_PATH, filename);
        const rawContent = await fs.readFile(filePath, 'utf-8');
        return parseTranscriptContent(rawContent, filename.replace('.txt', ''));
    } catch (error) {
        console.error(`Error parsing transcript ${filename}:`, error);
        return null;
    }
};
