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
    const { data: projectData, error } = await supabase
        .from('projects')
        .select(`
            *,
            personas (*),
            studies (
                *,
                interviews: sessions (
                    *,
                    insights (*)
                )
            )
        `)
        .eq('id', id)
        .single();

    if (error || !projectData) {
        console.error('Error fetching project:', error);
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
        // Map Interviews (Sessions)
        const sessions: RealInterview[] = (studyRow.interviews || []).map((interviewRow: any) => {
            // Map Insights
            const structuredData: StructuredInsight[] = (interviewRow.insights || []).map((r: any) => ({
                id: r.id,
                type: r.type,
                content: r.content,
                source: 'user',
                evidence: r.evidence,
                importance: r.importance
            }));

            return {
                id: interviewRow.id,
                projectId: id,
                studyId: studyRow.id,
                title: interviewRow.title,
                transcriptId: '',
                date: interviewRow.date,
                structuredData,
                summary: interviewRow.summary,
                content: interviewRow.transcript,
                participants: interviewRow.participants,
                audioUrl: interviewRow.recording_url, // Map DB column to type field
                videoUrl: interviewRow.recording_url, // Assuming same column for now or check DB schema?
                // Note: DB has 'recording_url' but Type has 'audioUrl'/'videoUrl'. 
                // We'll map to audioUrl if it looks like audio, but strictly speaking we might need checking.
                // For now, simple mapping:
            };
        });

        // Ensure sessions are RealInterview[]
        // Need to handle missing fields if type requires them.

        return {
            id: studyRow.id,
            projectId: id,
            title: studyRow.title,
            description: studyRow.description,
            createdAt: studyRow.created_at,
            updatedAt: studyRow.created_at,
            status: 'planning', // DB missing status?
            plan: {
                purpose: studyRow.description || '',
                ...studyRow.questions
            },
            sessions,
            discussionGuide: studyRow.questions?.discussionGuide || [],
            participantIds: [],
            changeLogs: []
        };
    });

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
            order: projectData.order
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
