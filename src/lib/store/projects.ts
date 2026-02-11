import { supabase } from '@/lib/supabase';
import { Project, ProjectData, Persona, ResearchStudy, RealInterview, StructuredInsight, KnowledgeDocument } from '../types';

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
    // 1. Fetch Project
    const { data: projectRow, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();

    if (projectError || !projectRow) return null;

    const project: Project = {
        id: projectRow.id,
        title: projectRow.title,
        description: projectRow.description,
        goal: projectRow.goal,
        exitCriteria: projectRow.exit_criteria,
        status: projectRow.status,
        createdAt: projectRow.created_at,
        updatedAt: projectRow.updated_at,
        order: projectRow.order
    };

    // 2. Fetch Personas
    const { data: personaRows } = await supabase
        .from('personas')
        .select('*')
        .eq('project_id', id);

    const personas: Persona[] = (personaRows || []).map((row: any) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        avatar: row.avatar,
        role: row.characteristics?.role || '',
        background: row.characteristics?.background || '',
        characteristics: row.characteristics,
        // Map legacy fields if they exist in JSON
        ...row.characteristics
    }));

    // 3. Fetch Studies
    const { data: studyRows } = await supabase
        .from('studies')
        .select('*')
        .eq('project_id', id);

    const studies: ResearchStudy[] = [];

    for (const studyRow of (studyRows || [])) {
        // Fetch Interviews for this study
        const { data: interviewRows } = await supabase
            .from('interviews')
            .select('*')
            .eq('study_id', studyRow.id);

        const sessions: RealInterview[] = [];

        for (const interviewRow of (interviewRows || [])) {
            // Fetch Insights
            const { data: insightRows } = await supabase
                .from('insights')
                .select('*')
                .eq('interview_id', interviewRow.id);

            const structuredData: StructuredInsight[] = (insightRows || []).map((r: any) => ({
                id: r.id,
                type: r.type,
                content: r.content,
                source: 'user', // Default or need column
                evidence: r.evidence,
                importance: r.importance
            }));

            sessions.push({
                id: interviewRow.id,
                projectId: id,
                studyId: studyRow.id,
                title: interviewRow.title,
                transcriptId: '', // Legacy/Check usage
                date: interviewRow.date,
                structuredData,
                summary: interviewRow.summary,
                content: interviewRow.transcript, // Mapped from DB 'transcript'
                participants: interviewRow.participants,
                audioUrl: interviewRow.recording_url,
                videoUrl: interviewRow.recording_url, // Map consistently
                note: {}, // Default empty note if not in DB
                // Add fields that might be missing in DB but needed in Type
            } as any);
        }

        studies.push({
            id: studyRow.id,
            projectId: id,
            title: studyRow.title,
            description: studyRow.description, // Type has description? Check type
            createdAt: studyRow.created_at,
            updatedAt: studyRow.created_at, // DB might not have updated_at for studies
            status: 'planning', // DB missing status?
            plan: {
                purpose: studyRow.description || '',
                // ... map other plan fields from JSON or columns
                ...studyRow.questions // Assumption
            } as any,
            sessions,
            discussionGuide: studyRow.questions?.discussionGuide || [],
            participantIds: [],
            changeLogs: []
        } as any);
    }

    return {
        project,
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
    await supabase.from('projects').upsert({
        id: data.project.id,
        title: data.project.title,
        description: data.project.description,
        goal: data.project.goal,
        exit_criteria: data.project.exitCriteria,
        status: data.project.status,
        updated_at: new Date().toISOString()
    });

    // 2. Upsert Personas
    for (const p of data.personas) {
        await supabase.from('personas').upsert({
            id: p.id,
            project_id: data.project.id,
            name: p.name,
            description: p.description,
            avatar: p.avatar,
            characteristics: p // Storing full object in jsonb
        });
    }

    // 3. Upsert Studies
    for (const s of data.studies) {
        await supabase.from('studies').upsert({
            id: s.id,
            project_id: data.project.id,
            title: s.title,
            description: s.plan.purpose,
            questions: { ...s.plan, discussionGuide: s.discussionGuide } // Storing complex plan in jsonb
        });

        // 4. Upsert Interviews (Sessions)
        for (const i of s.sessions) {
            await supabase.from('interviews').upsert({
                id: i.id,
                study_id: s.id,
                project_id: data.project.id,
                title: i.title,
                date: i.date,
                transcript: i.content,
                summary: i.summary,
                recording_url: i.audioUrl || i.videoUrl, // Map URL
                participants: i.participants || {}
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
                    importance: ins.importance || '' // Check type compatibility
                });
            }
        }
    }
}

export async function deleteProject(id: string): Promise<void> {
    await supabase.from('projects').delete().eq('id', id);
}

export async function deleteStudy(id: string): Promise<void> {
    await supabase.from('studies').delete().eq('id', id);
}

export async function deleteInterview(id: string): Promise<void> {
    await supabase.from('interviews').delete().eq('id', id);
}

export async function deleteInsight(id: string): Promise<void> {
    await supabase.from('insights').delete().eq('id', id);
}
