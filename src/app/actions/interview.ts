'use server';

import { getProject, saveProjectData, deleteInterview, deleteInsight } from '@/lib/store/projects';
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

async function extractContent(file: File): Promise<string> {
    const buffer = Buffer.from(await file.arrayBuffer());
    if (file.name.toLowerCase().endsWith('.docx')) {
        const result = await mammoth.extractRawText({ buffer });
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

    const newInterview: RealInterview = {
        id: Date.now().toString(),
        projectId,
        studyId,
        transcriptId: filename,
        title: filename,
        date: new Date().toISOString().split('T')[0],
        startTime: '10:00',
        endTime: '11:00',
        structuredData: [],
        summary: '',
        content: transcript.rawContent,
        note: {}
    };

    data.studies[studyIndex].sessions.push(newInterview);
    await saveProjectData(data);

    revalidatePath(`/projects/${projectId}/studies/${studyId}`);
}

export async function addInterviewFromContentAction(projectId: string, studyId: string, filename: string, content: string) {
    const transcript = parseTranscriptContent(content, filename);

    const data = await getProject(projectId);
    if (!data) throw new Error("Project not found");

    const studyIndex = data.studies.findIndex(s => s.id === studyId);
    if (studyIndex === -1) throw new Error("Study not found");

    const newInterview: RealInterview = {
        id: Date.now().toString(),
        projectId,
        studyId,
        transcriptId: filename,
        title: filename,
        date: new Date().toISOString().split('T')[0],
        startTime: '10:00',
        endTime: '11:00',
        structuredData: [],
        summary: '',
        content: transcript.rawContent,
        note: {}
    };

    data.studies[studyIndex].sessions.push(newInterview);
    await saveProjectData(data);

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
    const transcript = parseTranscriptContent(content, file.name);

    interview.content = transcript.rawContent;
    // interview.summary = ''; // Do not overwrite summary if not available
    interview.transcriptId = file.name;

    await saveProjectData(data);
    revalidatePath(`/projects/${projectId}/studies/${studyId}/interviews/${interviewId}`);
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
    interview.audioUrl = publicUrlData.publicUrl;

    await saveProjectData(data);
    revalidatePath(`/projects/${projectId}/studies/${studyId}/interviews/${interviewId}`);
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
    interview.videoUrl = publicUrlData.publicUrl;

    await saveProjectData(data);
    revalidatePath(`/projects/${projectId}/studies/${studyId}/interviews/${interviewId}`);
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

    interview.videoUrl = url;
    await saveProjectData(data);
    revalidatePath(`/projects/${projectId}/studies/${studyId}/interviews/${interviewId}`);
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

    const mediaPath = path.join(process.cwd(), 'public', mediaUrl);

    const ext = path.extname(mediaPath).toLowerCase();
    let mimeType = 'audio/mp3';
    if (ext === '.wav') mimeType = 'audio/wav';
    if (ext === '.m4a') mimeType = 'audio/mp4';
    if (ext === '.mp4') mimeType = 'video/mp4';
    if (ext === '.webm') mimeType = 'video/webm';

    try {
        const resultText = await transcribeMedia(mediaPath, mimeType, speakerCount, interviewerName);

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
    const data = await getProject(projectId);
    if (!data) throw new Error("Project not found");

    const study = data.studies.find(s => s.id === studyId);
    if (!study) throw new Error("Study not found");

    const interview = study.sessions.find(s => s.id === interviewId);
    if (!interview) throw new Error("Interview not found");

    if (metadata.date) interview.date = metadata.date;
    if (metadata.startTime) interview.startTime = metadata.startTime;
    if (metadata.endTime) interview.endTime = metadata.endTime;

    await saveProjectData(data);
    revalidatePath(`/projects/${projectId}/studies/${studyId}/interviews/${interviewId}`);
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
    const data = await getProject(projectId);
    if (!data) throw new Error("Project not found");

    const study = data.studies.find(s => s.id === studyId);
    if (!study) throw new Error("Study not found");

    const interview = study.sessions.find(s => s.id === interviewId);
    if (!interview) throw new Error("Interview not found");

    interview.speakers = speakers;

    await saveProjectData(data);
    revalidatePath(`/projects/${projectId}/studies/${studyId}/interviews/${interviewId}`);
}

export async function linkPersonaToInterviewAction(projectId: string, studyId: string, interviewId: string, personaId: string) {
    const data = await getProject(projectId);
    if (!data) throw new Error("Project not found");

    const study = data.studies.find(s => s.id === studyId);
    if (!study) throw new Error("Study not found");

    const interview = study.sessions.find(s => s.id === interviewId);
    if (!interview) throw new Error("Interview not found");

    interview.participantId = personaId;

    // Update Persona reverse link
    const persona = data.personas.find(p => p.id === personaId);
    if (persona) {
        if (!persona.interviewIds) persona.interviewIds = [];
        if (!persona.interviewIds.includes(interviewId)) {
            persona.interviewIds.push(interviewId);
        }

        // Update Interview Title to "N. [Persona Name]"
        const interviewIndex = study.sessions.findIndex(s => s.id === interviewId);
        if (interviewIndex !== -1) {
            interview.title = `${interviewIndex + 1}. ${persona.name}`;
        }
    }

    await saveProjectData(data);
    revalidatePath(`/projects/${projectId}/studies/${studyId}`);
    revalidatePath(`/projects/${projectId}`);
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
    const data = await getProject(projectId);
    if (!data) throw new Error("Project not found");

    const study = data.studies.find(s => s.id === studyId);
    if (!study) throw new Error("Study not found");

    const interview = study.sessions.find(s => s.id === interviewId);
    if (!interview) throw new Error("Interview not found");

    if (interview.structuredData) {
        const insightIndex = interview.structuredData.findIndex(i => i.id === insightId);
        if (insightIndex !== -1) {
            interview.structuredData[insightIndex] = {
                ...interview.structuredData[insightIndex],
                ...updates
            };
            await saveProjectData(data);
            revalidatePath(`/projects/${projectId}/studies/${studyId}/interviews/${interviewId}`);
        }
    }
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
