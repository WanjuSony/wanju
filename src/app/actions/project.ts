'use server';

import { createProject, getProject, saveProjectData, deleteProject, deleteStudy } from '@/lib/store/projects';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { StudyPlan, GuideBlock, KnowledgeDocument, RealInterview, SimulationSession } from '@/lib/types';
import { chatWithProjectStrategicAI, describeImageForContext } from '@/lib/llm-service';
import mammoth from 'mammoth';
// @ts-ignore
import pdf from 'pdf-parse/lib/pdf-parse.js';
import { Buffer } from 'buffer';
import { supabase } from '@/lib/supabase';

async function extractContent(file: File): Promise<string> {
    const buffer = Buffer.from(await file.arrayBuffer());

    // Image Handling (PNG, JPG, WEBP)
    if (file.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(file.name)) {
        const base64 = buffer.toString('base64');
        const mimeType = file.type || (file.name.endsWith('.png') ? 'image/png' : 'image/jpeg');
        return await describeImageForContext(base64, mimeType, file.name);
    }

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

export async function createNewProjectAction(formData: FormData) {
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const goal = formData.get('goal') as string;
    const exitCriteria = formData.get('exitCriteria') as string;

    if (!title) return;

    const newId = await createProject(title, description, goal, exitCriteria);
    redirect(`/projects/${newId}`);
}

export async function updateProjectAction(id: string, formData: FormData) {
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const goal = formData.get('goal') as string;
    const exitCriteria = formData.get('exitCriteria') as string;
    const status = formData.get('status') as any;

    const data = await getProject(id);
    if (!data) return;

    if (title !== null) data.project.title = title;
    if (description !== null) data.project.description = description;
    if (goal !== null) data.project.goal = goal;
    if (exitCriteria !== null) data.project.exitCriteria = exitCriteria;
    if (status !== null) data.project.status = status;

    await saveProjectData(data);
    revalidatePath(`/projects/${id}`);
    revalidatePath('/');
}

export async function createStudyAction(projectId: string, title: string, plan: StudyPlan, participantIds: string[]) {
    const data = await getProject(projectId);
    if (!data) return;

    const newStudy = {
        id: Date.now().toString(),
        projectId,
        title: title || plan.purpose,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'planning' as const,
        plan,
        sessions: [],
        participantIds: [],
        discussionGuide: [],
        changeLogs: []
    };

    data.studies.push(newStudy);
    await saveProjectData(data);

    redirect(`/projects/${projectId}/studies/${newStudy.id}/guide`);
}

export async function updateStudyPlanFieldsAction(projectId: string, studyId: string, fields: Partial<StudyPlan>) {
    const data = await getProject(projectId);
    if (!data) return;

    const studyIndex = data.studies.findIndex(s => s.id === studyId);
    if (studyIndex === -1) return;

    data.studies[studyIndex].plan = {
        ...data.studies[studyIndex].plan,
        ...fields
    };

    data.studies[studyIndex].updatedAt = new Date().toISOString();

    await saveProjectData(data);
    revalidatePath(`/projects/${projectId}/studies/${studyId}`);
}

export async function updateDiscussionGuideAction(projectId: string, studyId: string, blocks: GuideBlock[], logSummary?: string) {
    const data = await getProject(projectId);
    if (!data) return;

    const studyIndex = data.studies.findIndex(s => s.id === studyId);
    if (studyIndex === -1) return;

    const oldGuideLength = data.studies[studyIndex].discussionGuide.length;
    data.studies[studyIndex].discussionGuide = blocks;
    data.studies[studyIndex].updatedAt = new Date().toISOString();

    if (!data.studies[studyIndex].changeLogs) data.studies[studyIndex].changeLogs = [];

    if (logSummary) {
        data.studies[studyIndex].changeLogs.push({
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            type: 'guide',
            summary: logSummary
        });
    } else if (blocks.length !== oldGuideLength) {
        const diff = blocks.length - oldGuideLength;
        const autoSummary = diff > 0 ? `Added ${diff} items` : `Removed ${Math.abs(diff)} items`;
        data.studies[studyIndex].changeLogs.push({
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            type: 'guide',
            summary: autoSummary
        });
    }

    await saveProjectData(data);
    revalidatePath(`/projects/${projectId}/studies/${studyId}`);
}

export async function updateStudyPlanAction(projectId: string, studyId: string, plan: StudyPlan) {
    const data = await getProject(projectId);
    if (!data) return;

    const studyIndex = data.studies.findIndex(s => s.id === studyId);
    if (studyIndex === -1) return;

    data.studies[studyIndex].plan = plan;
    data.studies[studyIndex].updatedAt = new Date().toISOString();

    await saveProjectData(data);
    redirect(`/projects/${projectId}/studies/${studyId}`);
}

export async function deleteProjectAction(projectId: string) {
    await deleteProject(projectId);
    redirect('/');
}

export async function deleteStudyAction(projectId: string, studyId: string) {
    await deleteStudy(studyId);
    redirect(`/projects/${projectId}`);
}

export async function addProjectDocumentAction(projectId: string, formData: FormData) {
    const data = await getProject(projectId);
    if (!data) return;

    const file = formData.get('file') as File;
    const type = formData.get('type') as KnowledgeDocument['type'] || 'project_spec';

    if (!file) return;

    const content = await extractContent(file);
    if (!content.trim()) throw new Error("File content is empty");

    if (!data.project.documents) data.project.documents = [];

    const newDoc: KnowledgeDocument = {
        id: Date.now().toString(),
        title: file.name,
        fileName: file.name,
        content,
        type,
        createdAt: new Date().toISOString()
    };

    data.project.documents.push(newDoc);
    await saveProjectData(data);
    revalidatePath(`/projects/${projectId}`);
}

export async function removeProjectDocumentAction(projectId: string, docId: string) {
    const data = await getProject(projectId);
    if (!data || !data.project.documents) return;

    data.project.documents = data.project.documents.filter(d => d.id !== docId);
    await saveProjectData(data);
    revalidatePath(`/projects/${projectId}`);
}

export async function updateStudyTitleAction(projectId: string, studyId: string, newTitle: string) {
    const data = await getProject(projectId);
    if (!data) return;

    const study = data.studies.find(s => s.id === studyId);
    if (!study) return;

    study.title = newTitle;
    study.updatedAt = new Date().toISOString();

    await saveProjectData(data);
}

export async function updateStudySessionsOrderAction(projectId: string, studyId: string, sessionIds: string[]) {
    // Optimization: Update directly via Supabase to avoid full JSON re-serialization
    // This makes reordering instant.

    // Create an array of update promises
    const updatePromises = sessionIds.map((id, index) =>
        supabase
            .from('interviews')
            .update({ sort_order: index })
            .eq('id', id)
    );

    // Execute all updates in parallel
    await Promise.all(updatePromises);

    revalidatePath(`/projects/${projectId}/studies/${studyId}`);
}

export async function updateSimulationSessionsOrderAction(projectId: string, studyId: string, simulationIds: string[]) {
    const data = await getProject(projectId);
    if (!data) throw new Error("Project not found");

    const study = data.studies.find(s => s.id === studyId);
    if (!study) throw new Error("Study not found");

    if (study.simulationSessions) {
        const reordered = simulationIds.map(id => study.simulationSessions!.find(s => s.id === id)).filter(Boolean) as SimulationSession[];
        study.simulationSessions = reordered;
    }

    await saveProjectData(data);
}

export async function updateStudyStatusAction(projectId: string, studyId: string, status: 'planning' | 'recruiting' | 'fieldwork' | 'analysis' | 'done') {
    const data = await getProject(projectId);
    if (!data) throw new Error("Project not found");

    const study = data.studies.find(s => s.id === studyId);
    if (!study) throw new Error("Study not found");

    study.status = status;
    study.updatedAt = new Date().toISOString();

    await saveProjectData(data);
    revalidatePath(`/projects/${projectId}`);
}

export async function createProjectChatSessionAction(projectId: string) {
    const newSessionId = Date.now().toString();
    const newSession = {
        id: newSessionId,
        project_id: projectId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        messages: [{ role: 'model', text: '안녕하세요! 프로젝트의 진행 상황, 목표 달성 여부, 다음 단계에 대해 무엇이든 물어보세요. 제가 도와드릴게요. 😊' }],
        selected_context_ids: []
    };

    const { error } = await supabase
        .from('chat_sessions')
        .insert(newSession);

    if (error) throw error;
    // Removed revalidatePath for instant response. UI handles local state update.
    return {
        id: newSession.id,
        createdAt: newSession.created_at,
        updatedAt: newSession.updated_at,
        messages: newSession.messages as any[],
        selectedContextIds: []
    };
}

export async function deleteProjectChatSessionAction(projectId: string, sessionId: string) {
    const { error } = await supabase
        .from('chat_sessions')
        .delete()
        .eq('id', sessionId);

    if (error) throw error;

    revalidatePath(`/projects/${projectId}`);
}

export async function chatWithProjectAction(
    projectId: string,
    sessionId: string,
    history: { role: 'user' | 'model', text: string }[],
    message: string,
    modelType: 'flash' | 'pro',
    selectedContextIds: string[] = [],
    attachments: { name: string; type: 'image' | 'file'; data: string; mimeType: string }[] = []
) {
    const data = await getProject(projectId);
    if (!data) throw new Error("Project not found");

    const project = data.project;
    const studies = data.studies;
    const personas = data.personas;

    // 1. Fetch current session messages to append
    const { data: sessionData, error: fetchError } = await supabase
        .from('chat_sessions')
        .select('messages')
        .eq('id', sessionId)
        .single();

    if (fetchError) throw fetchError;

    const currentMessages = sessionData.messages || [];

    // Add user message locally for context building if needed, 
    // but LLM uses history + message arguments.

    let context = `# Project Context\n\n`;
    context += `**Project Title:** ${project.title}\n`;
    context += `**Description:** ${project.description || 'N/A'}\n`;
    context += `**Goal:** ${project.goal || 'N/A'}\n`;
    context += `**Exit Criteria:** ${project.exitCriteria || 'N/A'}\n\n`;

    if (personas && personas.length > 0) {
        context += `## Personas Pool\n`;
        personas.forEach(p => {
            context += `- **${p.name}** (${p.role}): ${p.background.slice(0, 100)}...\n`;
        });
        context += '\n';
    }

    const selectedDocIds = selectedContextIds.filter(id => id.startsWith('doc_'));
    const selectedDocs = project.documents?.filter(d => selectedDocIds.includes(`doc_${d.id}`)) || [];

    if (selectedDocs.length > 0) {
        context += `## Selected Knowledge Documents\n\n`;
        selectedDocs.forEach(doc => {
            context += `### Document: ${doc.title}\n`;
            context += `${doc.content}\n\n`;
        });
    }

    const selectedStudyIds = selectedContextIds.filter(id => !id.startsWith('doc_'));
    const selectedStudies = studies.filter(s => selectedStudyIds.includes(s.id));

    if (selectedStudies.length > 0) {
        context += `## Selected Research Studies Data\n\n`;
        selectedStudies.forEach(study => {
            context += `### Study: ${study.title} (${study.status.toUpperCase()})\n`;
            context += `- **Purpose:** ${study.plan.purpose}\n`;
            context += `- **Methodology:** ${study.plan.methodology.type}\n`;

            if (study._insights && study._insights.length > 0) {
                context += `- **Key Insights:**\n`;
                study._insights.forEach((insight: any) => {
                    context += `  * [${insight.type.toUpperCase()}] ${insight.content}\n`;
                });
            }
            context += '\n';
        });
    } else if (selectedContextIds.length === 0) {
        context += `## Research Overview\nTotal studies: ${studies.length}\n`;
        studies.forEach(s => {
            context += `- ${s.title}: ${s.status}\n`;
        });
    }

    // Extract images for LLM
    const images = attachments
        .filter(a => a.type === 'image' && a.data)
        .map(a => ({
            data: a.data,
            mimeType: a.mimeType
        }));

    const responseText = await chatWithProjectStrategicAI(
        history.slice(-10), // Limit history to prevent token bloat
        message,
        context.slice(0, 30000), // Hard cap context size
        modelType,
        images
    );

    // 2. Persist BOTH user message and model response directly
    const newUserMessage = {
        role: 'user',
        text: message,
        attachments: attachments.map(a => ({
            name: a.name,
            type: a.type,
            data: a.data,
            mimeType: a.mimeType
        }))
    };
    const newModelMessage = { role: 'model', text: responseText };

    const updatedMessages = [...currentMessages, newUserMessage, newModelMessage];

    const { error: updateError } = await supabase
        .from('chat_sessions')
        .update({
            messages: updatedMessages,
            selected_context_ids: selectedContextIds,
            updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);

    if (updateError) throw updateError;

    // Using revalidatePath to refresh UI data
    revalidatePath(`/projects/${projectId}`);

    return responseText;
}
