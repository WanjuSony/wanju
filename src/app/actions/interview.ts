'use server';

import { getProject, saveProjectData, deleteInterview, deleteInsight, getInterview } from '@/lib/store/projects';
import { revalidatePath } from 'next/cache';
import { RealInterview, Persona } from '@/lib/types';
import { transcribeMedia } from '@/lib/transcription-service';
import { parseTranscriptContent, parseTranscript } from '@/lib/transcript';
import mammoth from 'mammoth';
// @ts-ignore
import pdf from 'pdf-parse/lib/pdf-parse.js';
import { Buffer } from 'buffer';
import fs from 'fs';
import path from 'path';
import { safeParseJSON } from '@/lib/transcript-json-parser';
import { supabase } from '@/lib/supabase';
import os from 'os';
import { pipeline } from 'stream';
import { promisify } from 'util';
import { Readable } from 'stream';

const streamPipeline = promisify(pipeline);

async function extractContent(file: File): Promise<string> {
    const buffer = Buffer.from(await file.arrayBuffer());
    if (file.name.toLowerCase().endsWith('.docx')) {
        console.log(`[DEBUG] Extracting DOCX: ${file.name}, size: ${file.size} bytes`);
        const result = await mammoth.extractRawText({ buffer });
        console.log(`[DEBUG] Extraction result length: ${result.value?.length || 0}`);
        if (!result.value || result.value.trim().length === 0) {
            console.warn(`[DEBUG] Mammoth returned empty text for ${file.name}. Messages:`, (result as any).messages);
        }
        return result.value;
    }
    if (file.name.toLowerCase().endsWith('.pdf')) {
        const data = await pdf(buffer);
        return data.text;
    }
    return await file.text();
}

export async function addInterviewAction(projectId: string, studyId: string, filename: string) {
    const transcript = await parseTranscript(filename);
    if (!transcript) return;

    const data = await getProject(projectId);
    if (!data) return;

    const studyIndex = data.studies.findIndex(s => s.id === studyId);
    if (studyIndex === -1) return;

    // Surgical Insert
    const newInterviewId = Date.now().toString();
    const { error } = await supabase.from('interviews').insert({
        id: newInterviewId,
        project_id: projectId,
        study_id: studyId,
        title: filename,
        date: new Date().toISOString().split('T')[0],
        start_time: '10:00',
        end_time: '11:00',
        transcript: transcript.rawContent,
        segments: transcript.segments,
        summary: '',
        notes: {},
        participants: []
    });

    if (error) {
        console.error("Failed to insert interview:", error);
        return;
    }

    // Update study status to 'fieldwork' if needed
    if (data.studies[studyIndex].status === 'planning') {
        await supabase.from('studies').update({ status: 'fieldwork' }).eq('id', studyId);
    }

    revalidatePath(`/projects/${projectId}/studies/${studyId}`);
}

export async function addInterviewFromContentAction(projectId: string, studyId: string, filename: string, content: string) {
    const transcript = parseTranscriptContent(content, filename);

    const data = await getProject(projectId);
    if (!data) throw new Error("Project not found");

    const studyIndex = data.studies.findIndex(s => s.id === studyId);
    if (studyIndex === -1) throw new Error("Study not found");

    // Surgical Insert
    const newInterviewId = Date.now().toString();
    const { error } = await supabase.from('interviews').insert({
        id: newInterviewId,
        project_id: projectId,
        study_id: studyId,
        title: filename,
        date: new Date().toISOString().split('T')[0],
        start_time: '10:00',
        end_time: '11:00',
        transcript: transcript.rawContent,
        segments: transcript.segments,
        summary: '',
        notes: {},
        participants: []
    });

    if (error) throw new Error(`Failed to insert interview: ${error.message}`);

    if (data.studies[studyIndex].status === 'planning') {
        await supabase.from('studies').update({ status: 'fieldwork' }).eq('id', studyId);
    }

    revalidatePath(`/projects/${projectId}/studies/${studyId}`);
}

export async function uploadTranscriptAction(projectId: string, studyId: string, formData: FormData) {
    const fileText = formData.get('file_text') as File | null;
    const fileAudio = formData.get('file_audio') as File | null;
    const fileVideo = formData.get('file_video') as File | null;

    // Legacy support or bulk upload
    const legacyFiles = formData.getAll('files') as File[];

    const data = await getProject(projectId);
    if (!data) throw new Error('Project not found');

    const studyIndex = data.studies.findIndex(s => s.id === studyId);
    if (studyIndex === -1) throw new Error('Study not found');

    // 1. Handle single interview creation with mixed media (ExecutionManager case)
    if (fileText || fileAudio || fileVideo) {
        const participantId = formData.get('participantId') as string;
        const date = formData.get('date') as string || new Date().toISOString().split('T')[0];
        const startTime = formData.get('startTime') as string || '10:00';
        const endTime = formData.get('endTime') as string || '11:00';

        let content = '';
        let summary = '';
        let structuredData: any[] = [];
        let transcriptId = '';
        let title = '';

        // Process Transcript Text
        if (fileText) {
            const textContent = await extractContent(fileText);
            const transcript = parseTranscriptContent(textContent, fileText.name);
            content = transcript.rawContent;
            summary = '';
            transcriptId = fileText.name;
            title = fileText.name.replace(/\.[^/.]+$/, "");
        }

        // Process Audio/Video Uploads
        let audioUrl: string | undefined = undefined;
        let videoUrl: string | undefined = undefined;

        const uploadFileToSupabase = async (file: File) => {
            const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
            const { error } = await supabase.storage.from('uploads').upload(fileName, file, {
                upsert: true
            });
            if (error) {
                console.error("Supabase Storage Upload Error:", error);
                throw new Error("Failed to upload file to Supabase Storage");
            }
            const { data: publicUrlData } = supabase.storage.from('uploads').getPublicUrl(fileName);
            return publicUrlData.publicUrl;
        };

        if (fileAudio) {
            audioUrl = await uploadFileToSupabase(fileAudio);
            if (!title) title = fileAudio.name.replace(/\.[^/.]+$/, "");
        }

        if (fileVideo) {
            videoUrl = await uploadFileToSupabase(fileVideo);
            if (!title) title = fileVideo.name.replace(/\.[^/.]+$/, "");
        }

        if (!title) title = `Interview - ${date}`;

        const newInterview: RealInterview = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
            projectId,
            studyId,
            transcriptId, // might be empty if only audio
            title,
            date,
            startTime,
            endTime,
            structuredData,
            summary,
            content,
            audioUrl,
            videoUrl,
            participantId: participantId === 'new' ? undefined : participantId,
            note: {}
        };

        data.studies[studyIndex].sessions.push(newInterview);
    }
    // 2. Handle legacy bulk text upload (if 'files' still used elsewhere)
    else if (legacyFiles.length > 0) {
        for (const file of legacyFiles) {
            const content = await extractContent(file);
            const transcript = parseTranscriptContent(content, file.name);

            const newInterview: RealInterview = {
                id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                projectId,
                studyId,
                transcriptId: file.name,
                title: file.name.replace(/\.[^/.]+$/, ""),
                date: new Date().toISOString().split('T')[0],
                startTime: '10:00',
                endTime: '11:00',
                structuredData: [],
                summary: '', // Transcript details...
                content: transcript.rawContent,
                note: {}
            };

            data.studies[studyIndex].sessions.push(newInterview);
        }
    }

    if (data.studies[studyIndex].status === 'planning') {
        data.studies[studyIndex].status = 'fieldwork';
    }

    await saveProjectData(data);
    revalidatePath(`/projects/${projectId}/studies/${studyId}`);
}

export async function uploadInterviewTranscriptAction(projectId: string, studyId: string, interviewId: string, formData: FormData) {
    const file = formData.get('file') as File;
    if (!file) return;

    const data = await getProject(projectId);
    if (!data) return;

    const study = data.studies.find(s => s.id === studyId);
    if (!study) return;

    const interview = study.sessions.find(i => i.id === interviewId);
    if (!interview) return;

    const content = await extractContent(file);

    if (!content || content.trim().length === 0) {
        console.error(`[ERROR] Extraction yielded empty content for file: ${file.name}`);
        throw new Error("파일에서 텍스트를 추출하지 못했습니다. (내용 없음 또는 추출 실패)");
    }

    const transcript = parseTranscriptContent(content, file.name);

    // Surgical Update for Reliability
    const { error } = await supabase.from('interviews').update({
        transcript: transcript.rawContent,
        segments: transcript.segments
    }).eq('id', interviewId);

    if (error) {
        console.error("Failed to update interview transcript:", error);
        throw new Error(`DB Update Failed: ${error.message}`);
    } else {
        console.log(`[DEBUG] Successfully updated transcript for interview ${interviewId}. Raw length: ${transcript.rawContent.length}, Segments: ${transcript.segments.length}`);
    }

    revalidatePath(`/projects/${projectId}/studies/${studyId}/interviews/${interviewId}`);
    return await getInterview(interviewId);
}

export async function uploadInterviewAudioAction(projectId: string, studyId: string, interviewId: string, formData: FormData) {
    const file = formData.get('file') as File;
    if (!file) return;

    const data = await getProject(projectId);
    if (!data) return;

    const study = data.studies.find(s => s.id === studyId);
    const interview = study?.sessions.find(i => i.id === interviewId);
    if (!interview) return;

    const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const { error } = await supabase.storage.from('uploads').upload(fileName, file, {
        upsert: true
    });

    if (error) {
        console.error("Supabase Storage Upload Error:", error);
        return;
    }

    const { data: publicUrlData } = supabase.storage.from('uploads').getPublicUrl(fileName);
    // Surgical Update for Reliability
    // We update recording_url. Note: Our system uses one URL field for both audio/video in many places, 
    // but the DB column is 'recording_url'. 
    await supabase.from('interviews').update({
        recording_url: publicUrlData.publicUrl
    }).eq('id', interviewId);

    revalidatePath(`/projects/${projectId}/studies/${studyId}/interviews/${interviewId}`);
    return await getInterview(interviewId);
}

export async function uploadInterviewVideoAction(projectId: string, studyId: string, interviewId: string, formData: FormData) {
    const file = formData.get('file') as File;
    if (!file) return;

    const data = await getProject(projectId);
    if (!data) return;

    const study = data.studies.find(s => s.id === studyId);
    const interview = study?.sessions.find(i => i.id === interviewId);
    if (!interview) return;

    const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const { error } = await supabase.storage.from('uploads').upload(fileName, file, {
        upsert: true
    });

    if (error) {
        console.error("Supabase Storage Upload Error:", error);
        return;
    }

    const { data: publicUrlData } = supabase.storage.from('uploads').getPublicUrl(fileName);
    // Surgical Update
    await supabase.from('interviews').update({
        recording_url: publicUrlData.publicUrl
    }).eq('id', interviewId);

    revalidatePath(`/projects/${projectId}/studies/${studyId}/interviews/${interviewId}`);
    return await getInterview(interviewId);
}

export async function uploadLiveInterviewAction(projectId: string, studyId: string, formData: FormData) {
    const audioFile = formData.get('audioFile') as File | null;
    const notesStr = formData.get('notes') as string;
    const notes = JSON.parse(notesStr || '{}');
    const participantId = formData.get('participantId') as string;

    const startTimeIso = formData.get('startTime') as string;
    const endTimeIso = formData.get('endTime') as string;
    const durationVal = formData.get('duration');
    const duration = durationVal ? parseInt(durationVal as string) : 0;

    const formatTime = (iso: string) => {
        if (!iso) return '';
        return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const startTimeFormatted = startTimeIso ? formatTime(startTimeIso) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const endTimeFormatted = endTimeIso ? formatTime(endTimeIso) : '';

    const data = await getProject(projectId);
    if (!data) throw new Error('Project not found');

    const studyIndex = data.studies.findIndex(s => s.id === studyId);
    if (studyIndex === -1) throw new Error('Study not found');

    let savedAudioUrl = undefined;
    if (audioFile && audioFile.size > 0) {
        try {
            const ext = path.extname(audioFile.name) || '.webm';
            const fileName = `live-audio-${Date.now()}${ext}`;

            const { error } = await supabase.storage.from('uploads').upload(fileName, audioFile, {
                upsert: true
            });

            if (error) {
                console.error("Supabase Storage Live Upload Error:", error);
            } else {
                const { data: publicUrlData } = supabase.storage.from('uploads').getPublicUrl(fileName);
                savedAudioUrl = publicUrlData.publicUrl;
            }
        } catch (e) {
            console.error("Failed to save live audio file:", e);
        }
    }

    const newInterview: RealInterview = {
        id: Date.now().toString(),
        projectId,
        studyId,
        transcriptId: `live-${Date.now()}`,
        title: `Live Interview - ${new Date().toLocaleDateString()}`,
        date: new Date().toISOString().split('T')[0],
        startTime: startTimeFormatted,
        endTime: endTimeFormatted,
        duration: duration,
        structuredData: [],
        summary: 'Live interview recording.',
        content: '',
        segments: [],
        audioUrl: savedAudioUrl,
        participantId: participantId === 'new' ? undefined : participantId,
        note: notes
    };

    data.studies[studyIndex].sessions.push(newInterview);

    if (data.studies[studyIndex].status === 'planning') {
        data.studies[studyIndex].status = 'fieldwork';
    }

    await saveProjectData(data);
    revalidatePath(`/projects/${projectId}/studies/${studyId}`);
    return newInterview.id;
}

export async function saveInterviewVideoUrlAction(projectId: string, studyId: string, interviewId: string, url: string) {
    const data = await getProject(projectId);
    if (!data) return;

    const study = data.studies.find(s => s.id === studyId);
    const interview = study?.sessions.find(i => i.id === interviewId);
    if (!interview) return;

    // Surgical Update
    await supabase.from('interviews').update({
        recording_url: url
    }).eq('id', interviewId);

    revalidatePath(`/projects/${projectId}/studies/${studyId}/interviews/${interviewId}`);
    return await getInterview(interviewId);
}

async function downloadFile(url: string, fileName: string): Promise<string> {
    const tempDir = os.tmpdir();
    const filePath = path.join(tempDir, fileName);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    if (!response.body) throw new Error('Response body is null');

    const writer = fs.createWriteStream(filePath);
    // @ts-ignore - Readable.fromWeb exists in Node 18+ which is used by Vercel
    await streamPipeline(Readable.fromWeb(response.body), writer);
    return filePath;
}

export async function autoTranscribeMediaAction(projectId: string, studyId: string, interviewId: string, speakerCount: number = 2, interviewerName: string = "") {
    const data = await getProject(projectId);
    if (!data) throw new Error("Project not found");

    const study = data.studies.find(s => s.id === studyId);
    if (!study) throw new Error("Study not found");

    const interview = study.sessions.find(i => i.id === interviewId);
    if (!interview) throw new Error("Interview not found");

    if (!interview.audioUrl && !interview.videoUrl) {
        throw new Error("No media (audio/video) found for transcription.");
    }

    const mediaUrl = interview.audioUrl || interview.videoUrl;
    if (!mediaUrl) throw new Error("Media URL is missing");

    let mediaPath = "";
    const isUrl = mediaUrl.startsWith('http');

    if (isUrl) {
        const ext = path.extname(new URL(mediaUrl).pathname) || '.mp3';
        mediaPath = await downloadFile(mediaUrl, `transcribe-${interviewId}${ext}`);
    } else {
        mediaPath = path.join(process.cwd(), 'public', mediaUrl);
    }

    const ext = path.extname(mediaPath).toLowerCase();
    let mimeType = 'audio/mp3';
    if (ext === '.wav') mimeType = 'audio/wav';
    if (ext === '.m4a') mimeType = 'audio/mp4';
    if (ext === '.mp4') mimeType = 'video/mp4';
    if (ext === '.webm') mimeType = 'video/webm';

    try {
        const resultText = await transcribeMedia(mediaPath, mimeType, speakerCount, interviewerName, mediaPath);

        // 1. Attempt Safe JSON Parsing (Preferred)
        let segments = safeParseJSON(resultText);
        let content = "";

        if (segments && segments.length > 0) {
            console.log(`[Validation PASS] Parsed ${segments.length} JSON segments.`);
            // Generate raw content from structured data for search/display fallback
            content = segments.map(s => `${s.speaker} ${s.timestamp}: ${s.text}`).join('\n\n');
        } else {
            console.log("[Validation WARN] JSON parse failed or empty. Falling back to text parser.");

            // 2. Fallback: Parse as Text
            content = resultText;
            try {
                const parsedTranscript = parseTranscriptContent(content, interview.title);
                segments = parsedTranscript.segments;
                if (!segments || segments.length === 0) {
                    console.warn("[Validation FAIL] Text parser also found 0 segments. Treating as raw block.");
                }
            } catch (parseErr) {
                console.error("Fallback parsing failed", parseErr);
                segments = [];
            }
        }

        interview.content = content;
        interview.segments = segments;

        // Auto-initialize speaker metadata if missing
        if (segments.length > 0 && (!interview.speakers || interview.speakers.length === 0)) {
            const uniqueSpeakerNames = Array.from(new Set(segments.map(s => s.speaker)));
            interview.speakers = uniqueSpeakerNames.map((name, idx) => ({
                id: name,
                name: (name === 'Speaker 1' || idx === 0) && interviewerName ? interviewerName : name,
                role: (idx === 0 || name.toLowerCase().includes('interviewer')) ? 'interviewer' : 'participant' as 'interviewer' | 'participant'
            }));
        }

        await saveProjectData(data);
        revalidatePath(`/projects/${projectId}/studies/${studyId}/interviews/${interviewId}`);

        return { success: true, transcript: content };
    } catch (error: any) {
        console.error("Transcription failed:", error);
        throw new Error(`Transcription failed: ${error.message}`);
    }
}

export async function deleteInterviewAction(projectId: string, studyId: string, interviewId: string) {
    await deleteInterview(interviewId);
    revalidatePath(`/projects/${projectId}/studies/${studyId}`);
}

export async function updateInterviewMetadataAction(
    projectId: string,
    studyId: string,
    interviewId: string,
    metadata: { date?: string; startTime?: string; endTime?: string }
) {
    const updates: any = {};
    if (metadata.date) updates.date = metadata.date;
    if (metadata.startTime) updates.start_time = metadata.startTime;
    if (metadata.endTime) updates.end_time = metadata.endTime;

    if (Object.keys(updates).length === 0) return;

    const { error } = await supabase
        .from('interviews')
        .update(updates)
        .eq('id', interviewId);

    if (error) {
        console.error("Failed to update interview metadata:", error);
        throw new Error("Failed to update interview metadata");
    }

    revalidatePath(`/projects/${projectId}/studies/${studyId}`);
}

export async function updateInterviewTitleAction(projectId: string, studyId: string, interviewId: string, newTitle: string) {
    const data = await getProject(projectId);
    if (!data) throw new Error("Project not found");

    const study = data.studies.find(s => s.id === studyId);
    if (!study) throw new Error("Study not found");

    const interview = study.sessions.find(s => s.id === interviewId);
    if (!interview) throw new Error("Interview not found");

    interview.title = newTitle;
    await saveProjectData(data);
    revalidatePath(`/projects/${projectId}/studies/${studyId}`);
}

export async function updateSpeakerInfoAction(projectId: string, studyId: string, interviewId: string, speakers: { id: string, name: string, role: 'interviewer' | 'participant' }[]) {
    // Optimization: Update directly via Supabase
    // Map 'speakers' to 'participants' column (JSONB) as per our new logic

    const { error } = await supabase
        .from('interviews')
        .update({ participants: speakers }) // 'participants' column holds speaker info now
        .eq('id', interviewId);

    if (error) {
        console.error("Failed to update speakers:", error);
        throw new Error("Failed to update speakers");
    }

    revalidatePath(`/projects/${projectId}/studies/${studyId}/interviews/${interviewId}`);
}

export async function linkPersonaToInterviewAction(projectId: string, studyId: string, interviewId: string, personaId: string) {
    // 1. Direct DB Update for Interview (Fast)
    const { error } = await supabase
        .from('interviews')
        .update({ participant_id: personaId })
        .eq('id', interviewId);

    if (error) {
        console.error("Failed to link persona:", error);
        throw new Error("Failed to link persona");
    }

    // 2. Background/Legacy Update for Project JSON (Reverse Link)
    // We treat this as secondary to ensure UI responsiveness for the interview list
    // Ideally this should be decoupled or Personas should be in DB too.
    // For now, we perform the fetch-modify-save pattern but we don't await the SAVE if we want extreme speed?
    // No, Vercel functions kill unawaited promises.
    // We will keep it but `revalidatePath` will fetch the new DB data for the interview list.

    // Check if we can skip the heavy JSON save if we only care about the forward link.
    // The user's complaint is about the "Interview Session" list.
    // Let's TRY omitting the JSON save for now to test performance.
    // If reverse links are needed elsewhere, we might need a separate action or DB migration for Personas.

    revalidatePath(`/projects/${projectId}/studies/${studyId}`);
}

export async function updateInterviewNoteAction(
    projectId: string,
    studyId: string,
    interviewId: string,
    notes: Record<string, string>
) {
    const data = await getProject(projectId);
    if (!data) throw new Error("Project not found");

    const study = data.studies.find(s => s.id === studyId);
    if (!study) throw new Error("Study not found");

    const interview = study.sessions?.find(s => s.id === interviewId);
    if (!interview) throw new Error("Interview not found");

    interview.note = notes;

    await saveProjectData(data);
    revalidatePath(`/projects/${projectId}`);
}
export async function deleteInsightAction(projectId: string, studyId: string, interviewId: string, insightId: string) {
    await deleteInsight(insightId);
    revalidatePath(`/projects/${projectId}/studies/${studyId}/interviews/${interviewId}`);
}

export async function updateInsightAction(projectId: string, studyId: string, interviewId: string, insightId: string, updates: any) {
    // Optimization: Update directly via Supabase to avoid full re-serialization overhead
    // We still fetch project to ensure hierarchy validity if strictly needed, but for speed we can skip if we trust IDs
    // However, we need to return 'void' or similar. 

    // 1. Prepare update object (map keys from camelCase to snake_case if needed)
    const dbUpdates: any = {};
    if (updates.content !== undefined) dbUpdates.content = updates.content;
    if (updates.type !== undefined) dbUpdates.type = updates.type;
    if (updates.meaning !== undefined) dbUpdates.meaning = updates.meaning;
    if (updates.recommendation !== undefined) dbUpdates.recommendation = updates.recommendation;
    if (updates.sourceSegmentId !== undefined) dbUpdates.source_segment_id = updates.sourceSegmentId;
    if (updates.researchQuestion !== undefined) dbUpdates.research_question = updates.researchQuestion;
    // evidence is removed from UI but keep for compatibility if needed? No, user deleted it.

    if (Object.keys(dbUpdates).length === 0) return;

    const { error } = await supabase
        .from('insights')
        .update(dbUpdates)
        .eq('id', insightId);

    if (error) {
        console.error("Failed to update insight:", error);
        throw new Error("Failed to update insight");
    }

    revalidatePath(`/projects/${projectId}/studies/${studyId}/interviews/${interviewId}`);
}
export async function updateInsightOrderAction(projectId: string, studyId: string, interviewId: string, orderedInsightIds: string[]) {
    const data = await getProject(projectId);
    if (!data) throw new Error("Project not found");

    const study = data.studies.find(s => s.id === studyId);
    if (!study) throw new Error("Study not found");

    const interview = study.sessions.find(s => s.id === interviewId);
    if (!interview) throw new Error("Interview not found");

    if (interview.structuredData) {
        // Create a map for quick lookup
        const insightsMap = new Map(interview.structuredData.map(i => [i.id, i]));

        // Reconstruct array based on order
        const newOrder = orderedInsightIds
            .map(id => insightsMap.get(id))
            .filter((i): i is any => i !== undefined);

        // Append any missing items (newly added meanwhile?)
        const currentIds = new Set(orderedInsightIds);
        const missingItems = interview.structuredData.filter(i => !currentIds.has(i.id));

        interview.structuredData = [...newOrder, ...missingItems];

        await saveProjectData(data);
        revalidatePath(`/projects/${projectId}/studies/${studyId}/interviews/${interviewId}`);
    }
}

export async function updateInterviewHypothesisReviewAction(
    projectId: string,
    studyId: string,
    interviewId: string,
    reviewIndex: string,
    status: 'supported' | 'refuted' | 'partial' | 'inconclusive' | 'pending',
    comment: string
) {
    const data = await getProject(projectId);
    if (!data) throw new Error("Project not found");

    const study = data.studies.find(s => s.id === studyId);
    if (!study) throw new Error("Study not found");

    const interview = study.sessions.find(s => s.id === interviewId);
    if (!interview) throw new Error("Interview not found");

    if (!interview.hypothesisReviews) {
        interview.hypothesisReviews = {};
    }

    interview.hypothesisReviews[reviewIndex] = {
        status,
        comment
    };

    await saveProjectData(data);
    revalidatePath(`/projects/${projectId}/studies/${studyId}/interviews/${interviewId}`);
}

export async function deleteSpeakerAction(projectId: string, studyId: string, interviewId: string, speakerIdToDelete: string) {
    // 1. Fetch current data to compute new state
    const data = await getProject(projectId);
    if (!data) throw new Error("Project not found");

    const study = data.studies.find(s => s.id === studyId);
    if (!study) throw new Error("Study not found");

    const interview = study.sessions.find(s => s.id === interviewId);
    if (!interview) throw new Error("Interview not found");

    // 2. Filter out the speaker
    const updatedSpeakers = (interview.speakers || []).filter(s => s.id !== speakerIdToDelete && s.name !== speakerIdToDelete);

    // 3. Filter out transcript segments
    let newContent = interview.content || "";
    let updatedSegments: any[] = interview.segments || [];

    // If no existing segments, parse content first
    if (!updatedSegments || updatedSegments.length === 0) {
        try {
            // Re-parse content to ensure we have segments
            const parsed = parseTranscriptContent(newContent, interview.title);
            updatedSegments = parsed.segments || [];
        } catch (e) {
            console.error("Error parsing transcript:", e);
            updatedSegments = [];
        }
    }

    if (updatedSegments && updatedSegments.length > 0) {
        // Filter out segments where speaker matches ID or Name, OR if it's "Transcript" (often mapped to Unknown)
        const speakerToDeleteObj = (interview.speakers || []).find(s => s.id === speakerIdToDelete);
        const speakerName = speakerToDeleteObj ? speakerToDeleteObj.name : speakerIdToDelete;

        const originalLength = updatedSegments.length;

        updatedSegments = updatedSegments.filter((s: any) => {
            const sName = (s.speaker || "").trim();

            // Exact Match on ID or Name
            const isTarget = sName === speakerIdToDelete || sName === speakerName;

            // Special handling for "Unknown" deletion requests
            // If deleting "Unknown", also remove "Transcript", "System" generated speakers
            const isUnknownTarget = (speakerIdToDelete === 'Unknown' || speakerIdToDelete === 'Transcript') &&
                (sName === 'Unknown' || sName === 'Transcript' || sName === 'System');

            return !isTarget && !isUnknownTarget;
        });

        // Only reconstruct if we actually filtered something or if we have content
        if (updatedSegments.length !== originalLength || updatedSegments.length > 0) {
            newContent = updatedSegments.map((s: any) => `${s.speaker} ${s.timestamp}: ${s.text}`).join('\n\n');
        } else if (updatedSegments.length === 0 && originalLength > 0) {
            // If we filtered everything out, content is empty
            newContent = "";
        }
    }

    // 4. Update DB directly - BOTH transcript AND segments
    const { error } = await supabase
        .from('interviews')
        .update({
            participants: updatedSpeakers,
            transcript: newContent,
            segments: updatedSegments
        })
        .eq('id', interviewId);

    if (error) {
        console.error("Failed to delete speaker:", error);
        throw new Error("Failed to delete speaker");
    }

    revalidatePath(`/projects/${projectId}/studies/${studyId}/interviews/${interviewId}`);
}

export async function getInterviewAction(id: string) {
    return await getInterview(id);
}
