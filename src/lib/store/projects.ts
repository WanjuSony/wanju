import { supabase } from '@/lib/supabase';
import { Project, ProjectData, Persona, ResearchStudy, RealInterview, StructuredInsight, KnowledgeDocument, WeeklyReport, ChatSession, SimulationSession } from '../types';

// Helper to map DB rows to Types
// Note: JSONB columns are returned as objects, so we cast them.

export async function getAllProjects(): Promise<Project[]> {
    const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching projects:', error);
        return [];
    }

    // Map DB fields to Project type if necessary (snake_case to camelCase handled by JS usually? No, Supabase returns what is in DB)
    // DB columns: id, title, description, goal, exit_criteria, status, created_at, updated_at, order
    // Project type: id, title, description, goal, exitCriteria, createdAt, updatedAt, status, order

    return data.map((row: any) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        goal: row.goal,
        exitCriteria: row.exit_criteria,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        order: row.order
    }));
}

export async function getProject(id: string): Promise<ProjectData | null> {
    const { data: projectData, error } = await supabase
        .from('projects')
        .select(`
            *,
            personas (*),
            studies (
                *,
                interviews (
                    *,
                    insights (*)
                ),
                reports (*),
                simulation_sessions (*)
            ),
            chat_sessions (*)
        `)
        .eq('id', id)
        .single();

    if (error || !projectData) {
        console.error('Error fetching project:', error?.message || 'Unknown error', error?.details || '');
        return null;
    }

    // Map Personas
    const personas: Persona[] = (projectData.personas || []).map((row: any) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        avatar: row.avatar,
        role: row.characteristics?.role || '',
        background: row.characteristics?.background || '',
        characteristics: row.characteristics,
        ...row.characteristics
    }));

    // Map Studies
    const studies: ResearchStudy[] = (projectData.studies || []).map((studyRow: any) => {
        // Map Interviews
        const sessions: RealInterview[] = (studyRow.interviews || [])
            .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0) || new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .map((interviewRow: any) => {
                // Map Insights
                const structuredData: StructuredInsight[] = (interviewRow.insights || []).map((r: any) => ({
                    id: r.id,
                    type: r.type,
                    content: r.content,
                    source: r.source || 'ai',
                    evidence: r.evidence,
                    importance: r.importance,
                    meaning: r.meaning,
                    recommendation: r.recommendation,
                    researchQuestion: r.research_question,
                    sourceSegmentId: r.source_segment_id
                }));

                return {
                    id: interviewRow.id,
                    projectId: id,
                    studyId: studyRow.id,
                    title: interviewRow.title,
                    transcriptId: '',
                    date: interviewRow.date,
                    startTime: interviewRow.start_time,
                    endTime: interviewRow.end_time,
                    structuredData,
                    summary: interviewRow.summary,
                    content: interviewRow.transcript || '', // Might be empty in lightweight view
                    interviewerFeedback: interviewRow.interviewer_feedback,
                    participants: interviewRow.participants,
                    speakers: Array.isArray(interviewRow.participants) ? interviewRow.participants : [],
                    participantId: interviewRow.participant_id,
                    audioUrl: interviewRow.recording_url,
                    videoUrl: interviewRow.recording_url,
                    duration: interviewRow.duration,
                    note: interviewRow.notes || {},
                    segments: interviewRow.segments || [],
                    sortOrder: interviewRow.sort_order
                };
            });

        // Map Reports
        const reports: WeeklyReport[] = (studyRow.reports || []).map((r: any) => ({
            id: r.id,
            createdAt: r.created_at,
            title: r.title,
            interviewIds: r.interview_ids || [],
            content: r.content
        }));

        // Map Simulation Sessions
        const simulationSessions: SimulationSession[] = (studyRow.simulation_sessions || []).map((sim: any) => {
            try {
                return {
                    id: sim.id,
                    personaId: sim.persona_id,
                    createdAt: sim.created_at,
                    messages: sim.messages || [],
                    insights: sim.insights || undefined,
                    summary: sim.summary || undefined,
                    structuredData: sim.structured_data || undefined
                };
            } catch (err) {
                console.error("Error mapping simulation session:", err);
                return null;
            }
        }).filter(Boolean) as SimulationSession[];

        return {
            id: studyRow.id,
            projectId: id,
            title: studyRow.title,
            description: studyRow.description,
            createdAt: studyRow.created_at,
            updatedAt: studyRow.created_at,
            status: studyRow.status || 'planning',
            plan: {
                purpose: studyRow.description || studyRow.questions?.purpose || '',
                ...studyRow.questions
            },
            sessions,
            simulationSessions, // Attach simulation sessions
            reports, // Attach reports
            discussionGuide: studyRow.questions?.discussionGuide || [],
            participantIds: [],
            changeLogs: []
        };
    });

    // Map Chat Sessions
    const chatSessions: ChatSession[] = (projectData.chat_sessions || []).map((s: any) => ({
        id: s.id,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
        messages: s.messages || [],
        selectedContextIds: s.selected_context_ids || []
    })).sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return {
        project: {
            id: projectData.id,
            title: projectData.title,
            description: projectData.description,
            goal: projectData.goal,
            exitCriteria: projectData.exit_criteria,
            status: projectData.status,
            createdAt: projectData.created_at,
            updatedAt: projectData.updated_at,
            order: projectData.order,
            documents: projectData.documents || [],
            chatSessions // Add mapped chat sessions
        },
        studies,
        personas
    };
}

export async function createProject(title: string, description: string, goal: string, exitCriteria: string): Promise<string> {
    const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now().toString().slice(-4);

    const { error } = await supabase
        .from('projects')
        .insert({
            id,
            title,
            description,
            goal,
            exit_criteria: exitCriteria,
            status: 'planning'
        });

    if (error) throw error;
    return id;
}

export async function saveProjectData(data: ProjectData): Promise<void> {
    // 1. Upsert Project
    const { error: projectError } = await supabase.from('projects').upsert({
        id: data.project.id,
        title: data.project.title,
        description: data.project.description,
        goal: data.project.goal,
        exit_criteria: data.project.exitCriteria,
        status: data.project.status,
        documents: data.project.documents,
        updated_at: new Date().toISOString()
    });
    if (projectError) {
        console.error("Failed to upsert project:", projectError);
        throw new Error(`Failed to upsert project: ${projectError.message}`);
    }

    // 2. Upsert Personas
    for (const p of data.personas) {
        const { error: personaError } = await supabase.from('personas').upsert({
            id: p.id,
            project_id: data.project.id,
            name: p.name,
            description: p.description,
            avatar: p.avatar,
            characteristics: p // Storing full object in jsonb
        });
        if (personaError) {
            console.error("Failed to upsert persona:", personaError);
            throw new Error(`Failed to upsert persona: ${personaError.message}`);
        }
    }

    // 3. Upsert Studies
    for (const s of data.studies) {
        const studyPayload = {
            id: s.id,
            project_id: data.project.id,
            title: s.title,
            description: s.plan.purpose,
            status: s.status,
            questions: { ...s.plan, discussionGuide: s.discussionGuide } // Storing complex plan in jsonb
        };
        console.log("Upserting Study Payload: ", JSON.stringify(studyPayload, null, 2));

        const { error: studyError } = await supabase.from('studies').upsert(studyPayload);
        if (studyError) {
            console.error("Failed to upsert study:", studyError);
            throw new Error(`Failed to upsert study: ${studyError.message}`);
        }

        // 4. Upsert Interviews (Sessions)
        for (const i of s.sessions) {
            await supabase.from('interviews').upsert({
                id: i.id,
                study_id: s.id,
                project_id: data.project.id,
                title: i.title,
                date: i.date,
                start_time: i.startTime,
                end_time: i.endTime,
                transcript: i.content,
                summary: i.summary,
                recording_url: i.audioUrl || i.videoUrl, // Map URL
                duration: i.duration,
                participants: i.speakers || i.participants || [], // Map speakers -> participants (JSONB)
                participant_id: i.participantId,
                interviewer_feedback: i.interviewerFeedback, // Save Feedback
                notes: i.note,
                segments: i.segments
            });

            // 5. Upsert Insights
            for (const ins of i.structuredData) {
                await supabase.from('insights').upsert({
                    id: ins.id,
                    interview_id: i.id,
                    project_id: data.project.id,
                    type: ins.type,
                    content: ins.content,
                    evidence: ins.evidence || '',
                    importance: ins.importance || '',
                    meaning: ins.meaning || '',
                    recommendation: ins.recommendation || '',
                    research_question: ins.researchQuestion || '',
                    source_segment_id: ins.sourceSegmentId || ''
                });
            }
        }

        // 6. Upsert Reports
        for (const r of (s.reports || [])) {
            await supabase.from('reports').upsert({
                id: r.id,
                project_id: data.project.id,
                study_id: s.id,
                title: r.title,
                content: r.content,
                created_at: r.createdAt,
                interview_ids: r.interviewIds
            });
        }

        // 7. Upsert Simulation Sessions
        for (const sim of (s.simulationSessions || [])) {
            await supabase.from('simulation_sessions').upsert({
                id: sim.id,
                study_id: s.id,
                project_id: data.project.id,
                persona_id: sim.personaId,
                created_at: sim.createdAt,
                messages: sim.messages,
                insights: sim.insights,
                summary: sim.summary,
                structured_data: sim.structuredData
            });
        }
    }
}

export async function deleteProject(id: string): Promise<void> {
    await supabase.from('projects').delete().eq('id', id);
}

export async function deleteStudy(id: string): Promise<void> {
    const { error } = await supabase.from('studies').delete().eq('id', id);
    if (error) {
        console.error("Failed to delete study:", error);
        throw new Error(`Failed to delete study: ${error.message}`);
    }
}

export async function deleteInterview(id: string): Promise<void> {
    await supabase.from('interviews').delete().eq('id', id);
}

export async function deleteInsight(id: string): Promise<void> {
    await supabase.from('insights').delete().eq('id', id);
}

export async function getInterview(id: string): Promise<RealInterview | null> {
    const { data, error } = await supabase
        .from('interviews')
        .select(`
            *,
            insights (*)
        `)
        .eq('id', id)
        .single();

    if (error || !data) return null;

    const structuredData: StructuredInsight[] = (data.insights || []).map((r: any) => ({
        id: r.id,
        type: r.type,
        content: r.content,
        source: r.source || 'user',
        evidence: r.evidence,
        importance: r.importance,
        meaning: r.meaning,
        recommendation: r.recommendation,
        researchQuestion: r.research_question,
        sourceSegmentId: r.source_segment_id
    }));

    return {
        id: data.id,
        projectId: data.project_id,
        studyId: data.study_id,
        title: data.title,
        transcriptId: '',
        date: data.date,
        startTime: data.start_time,
        endTime: data.end_time,
        structuredData,
        summary: data.summary,
        content: data.transcript,
        interviewerFeedback: data.interviewer_feedback,
        participants: data.participants,
        speakers: Array.isArray(data.participants) ? data.participants : [],
        participantId: data.participant_id,
        audioUrl: data.recording_url,
        videoUrl: data.recording_url,
        note: {},
        segments: data.segments,
        sortOrder: data.sort_order
    };
}

export async function updateInterviewFeedback(interviewId: string, feedback: string): Promise<void> {
    const { error } = await supabase
        .from('interviews')
        .update({ interviewer_feedback: feedback })
        .eq('id', interviewId);

    if (error) {
        console.error(`[updateInterviewFeedback] Failed to update feedback for ${interviewId}:`, error);
        throw error;
    }
    console.log(`[updateInterviewFeedback] Successfully updated feedback for ${interviewId}`);
}
