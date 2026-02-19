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

import { parseTranscriptContent as parseRobust } from './transcript-parser';

export const parseTranscriptContent = (rawContent: string, title: string): Transcript => {
    // DEPRECATED LOGIC REPLACED BY ROBUST PARSER
    const parsed = parseRobust(rawContent, title);

    return {
        id: title, // Maintain backward compatibility for ID
        title: parsed.title,
        headers: parsed.headers,
        segments: parsed.segments,
        rawContent: parsed.rawContent
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
