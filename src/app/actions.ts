'use server';

import { generatePersona, generatePersonaFromContext } from '@/lib/llm-service';
import { parseTranscript } from '@/lib/transcript';
import { Persona } from '@/lib/types';

export async function createPersonaAction(filename: string): Promise<Persona | null> {
    const transcript = await parseTranscript(filename);
    if (!transcript) return null;

    // In the future, we will retrieve the API key from env or user input
    const apiKey = process.env.OPENAI_API_KEY;

    const persona = await generatePersona(transcript, apiKey);
    return persona;
}

import { createProject, getProject, saveProjectData } from '@/lib/store/projects';
import { redirect } from 'next/navigation';
import { StudyPlan } from '@/lib/types';

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

    const data = await getProject(id);
    if (!data) return;

    data.project.title = title;
    data.project.description = description;
    data.project.goal = goal;
    data.project.exitCriteria = exitCriteria;

    await saveProjectData(data);
    redirect(`/projects/${id}`);
}

export async function createStudyAction(projectId: string, title: string, plan: StudyPlan, participantIds: string[]) {
    const data = await getProject(projectId);
    if (!data) return;

    const newStudy = {
        id: Date.now().toString(),
        projectId,
        title: title || plan.purpose, // Use provided title or fallback to purpose
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

import { analyzeTranscript } from '@/lib/analysis-service';
import { RealInterview } from '@/lib/types';

export async function addInterviewAction(projectId: string, studyId: string, filename: string) {
    const data = await getProject(projectId);
    if (!data) return;

    // Parse the transcript file
    const transcript = await parseTranscript(filename);
    if (!transcript) throw new Error("Transcript not found");

    // Run the formatting engine
    const structuredInsights = await analyzeTranscript(transcript);

    const newInterview: RealInterview = {
        id: Date.now().toString(),
        projectId,
        title: transcript.title,
        transcriptId: filename,
        date: new Date().toISOString(),
        structuredData: structuredInsights,
        content: transcript.rawContent
    };

    const studyIndex = data.studies.findIndex(s => s.id === studyId);
    if (studyIndex === -1) return;

    data.studies[studyIndex].sessions.push(newInterview);

    // Auto-update status
    if (data.studies[studyIndex].status === 'planning') {
        data.studies[studyIndex].status = 'fieldwork';
    }

    await saveProjectData(data);
    // Since we are now on a dynamic route, we might need revalidatePath, but redirect is fine for demo
    redirect(`/projects/${projectId}/studies/${studyId}`);
}

import { parseTranscriptContent } from '@/lib/transcript';

export async function addInterviewFromContentAction(projectId: string, studyId: string, filename: string, content: string) {
    const data = await getProject(projectId);
    if (!data) return;

    // Parse the transcript content
    const transcript = parseTranscriptContent(content, filename.replace('.txt', ''));

    // Run the formatting engine
    const structuredInsights = await analyzeTranscript(transcript);

    const newInterview: RealInterview = {
        id: Date.now().toString(),
        projectId,
        title: transcript.title,
        transcriptId: 'uploaded-' + Date.now(),
        date: new Date().toISOString(),
        structuredData: structuredInsights,
        content: transcript.rawContent
    };

    const studyIndex = data.studies.findIndex(s => s.id === studyId);
    if (studyIndex === -1) return;

    data.studies[studyIndex].sessions.push(newInterview);

    // Auto-update status
    if (data.studies[studyIndex].status === 'planning') {
        data.studies[studyIndex].status = 'fieldwork';
    }

    await saveProjectData(data);
    redirect(`/projects/${projectId}/studies/${studyId}`);
}

import mammoth from 'mammoth';
import { Buffer } from 'buffer';

export async function uploadTranscriptAction(projectId: string, studyId: string, formData: FormData) {
    const file = formData.get('file') as File;
    if (!file) return;

    const buffer = Buffer.from(await file.arrayBuffer());
    let content = '';

    if (file.name.toLowerCase().endsWith('.docx')) {
        try {
            const result = await mammoth.extractRawText({ buffer });
            content = result.value;
            console.log(`Extracted ${content.length} chars from DOCX`);
        } catch (e) {
            console.error("Mammoth extraction failed:", e);
            throw new Error("Failed to read DOCX file.");
        }
    } else {
        content = await file.text();
    }

    if (!content.trim()) {
        throw new Error("File is empty or content could not be extracted.");
    }

    // Reuse existing logic from addInterviewFromContentAction
    // or just call it if we could, but better to keep it clean here or refactor.

    const data = await getProject(projectId);
    if (!data) return;

    // Parse the transcript content
    const transcript = parseTranscriptContent(content, file.name.replace(/\.(txt|docx)$/, ''));

    // Run the formatting engine
    const structuredInsights = await analyzeTranscript(transcript);

    const newInterview: RealInterview = {
        id: Date.now().toString(),
        projectId,
        title: transcript.title,
        transcriptId: 'uploaded-' + Date.now(),
        date: new Date().toISOString(),
        structuredData: structuredInsights,
        content: transcript.rawContent
    };

    const studyIndex = data.studies.findIndex(s => s.id === studyId);
    if (studyIndex === -1) return;

    data.studies[studyIndex].sessions.push(newInterview);

    if (data.studies[studyIndex].status === 'planning') {
        data.studies[studyIndex].status = 'fieldwork';
    }

    await saveProjectData(data);

    redirect(`/projects/${projectId}/studies/${studyId}`);
}

// Phase 4: Persona Actions
export async function createManualPersonaAction(projectId: string, name: string, role: string, characteristics: string) {
    const data = await getProject(projectId);
    if (!data) return;

    if (!data.personas) data.personas = [];

    const newPersona: Persona = {
        id: Date.now().toString(),
        name,
        role,
        company: 'N/A', // Simple for now
        background: characteristics,
        psychographics: { values: [], motivations: [], painPoints: [] },
        behavioral: { communicationStyle: '', decisionMakingProcess: '' }
    };

    data.personas.push(newPersona);
    await saveProjectData(data);

    redirect(`/projects/${projectId}?tab=personas`);
}

export async function createAIGeneratedPersonaAction(projectId: string, formData: FormData) {
    const data = await getProject(projectId);
    if (!data) return;

    if (!data.personas) data.personas = [];

    const jobRole = formData.get('role') as string;
    const file = formData.get('file') as File;
    let fileContent = '';

    if (file && file.size > 0) {
        fileContent = await extractContent(file);
    }

    // Use project title/desc as context
    const projectContext = `${data.project.title}: ${data.project.description}`;

    // 1. Generate Persona
    // In Phase 5, we use the new context-aware generation
    const newPersona = await generatePersonaFromContext(projectContext, jobRole, fileContent);

    data.personas.push(newPersona);
    await saveProjectData(data);

    redirect(`/projects/${projectId}?tab=personas`);
}

import { GuideBlock } from '@/lib/types';

export async function updateDiscussionGuideAction(projectId: string, studyId: string, blocks: GuideBlock[], logSummary?: string) {
    const data = await getProject(projectId);
    if (!data) return;

    const studyIndex = data.studies.findIndex(s => s.id === studyId);
    if (studyIndex === -1) return;

    const oldGuideLength = data.studies[studyIndex].discussionGuide.length;
    data.studies[studyIndex].discussionGuide = blocks;
    data.studies[studyIndex].updatedAt = new Date().toISOString();

    // Add Change Log
    if (!data.studies[studyIndex].changeLogs) data.studies[studyIndex].changeLogs = [];

    if (logSummary) {
        data.studies[studyIndex].changeLogs.push({
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            type: 'guide',
            summary: logSummary
        });
    } else if (blocks.length !== oldGuideLength) {
        // Auto-detect if no summary provided
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

    // No redirect needed if used via client component with refresh
}

export async function updateStudyPlanAction(projectId: string, studyId: string, plan: StudyPlan) {
    const data = await getProject(projectId);
    if (!data) return;

    const studyIndex = data.studies.findIndex(s => s.id === studyId);
    if (studyIndex === -1) return;

    data.studies[studyIndex].plan = plan;
    // Do not overwrite title with purpose. Title is now independent.
    // data.studies[studyIndex].title = plan.purpose;
    data.studies[studyIndex].updatedAt = new Date().toISOString();

    await saveProjectData(data);

    redirect(`/projects/${projectId}/studies/${studyId}`);
}

import { deleteProject } from '@/lib/store/projects';

export async function deleteProjectAction(projectId: string) {
    await deleteProject(projectId);
    redirect('/');
}

export async function deleteStudyAction(projectId: string, studyId: string) {
    const data = await getProject(projectId);
    if (!data) return;

    data.studies = data.studies.filter(s => s.id !== studyId);
    await saveProjectData(data);

    redirect(`/projects/${projectId}`);
}

import { generatePersonaResponse } from '@/lib/llm-service';

export async function chatWithPersonaAction(projectId: string, personaId: string, history: { role: string, content: string }[]) {
    const data = await getProject(projectId);
    if (!data) return "Error: Project not found";

    const persona = data.personas?.find(p => p.id === personaId);
    if (!persona) return "Error: Persona not found";

    // Find the study context if possible, or just use project context.
    // Ideally we pass studyId, but looking at the signature, I forgot to add it.
    // For now, let's use Project Context + generic "Research Interview".
    const context = `
    Project: ${data.project.title}
    Description: ${data.project.description}
    We are conducting a research interview to understand user needs regarding this project.
    `;

    return await generatePersonaResponse(persona, history, context);
}

import { SimulationSession } from '@/lib/types';

export async function saveSimulationAction(projectId: string, studyId: string, session: SimulationSession) {
    const data = await getProject(projectId);
    if (!data) return;

    const study = data.studies.find(s => s.id === studyId);
    if (!study) return;

    if (!study.simulationSessions) {
        study.simulationSessions = [];
    }

    const existingIndex = study.simulationSessions.findIndex(s => s.id === session.id);
    if (existingIndex >= 0) {
        study.simulationSessions[existingIndex] = session;
    } else {
        study.simulationSessions.push(session);
    }

    await saveProjectData(data);
}

import { generateSimulationAnalysis } from '@/lib/llm-service';

export async function analyzeSimulationAction(projectId: string, studyId: string, sessionId: string) {
    const data = await getProject(projectId);
    if (!data) return;

    const study = data.studies.find(s => s.id === studyId);
    if (!study) return;

    if (!study.simulationSessions) return;

    const sessionIndex = study.simulationSessions.findIndex(s => s.id === sessionId);
    if (sessionIndex === -1) return;

    const session = study.simulationSessions[sessionIndex];

    const context = {
        purpose: study.plan.purpose,
        questions: study.plan.researchQuestions,
        projectTitle: data.project.title,
        projectDescription: data.project.description
    };

    const messages = session.messages.map(m => ({
        role: m.role,
        content: m.text
    }));

    const insights = await generateSimulationAnalysis(messages, context);

    study.simulationSessions[sessionIndex].insights = insights;
    await saveProjectData(data);
}

export async function analyzeMessagesAction(projectId: string, studyId: string, messages: { role: string, content: string }[]) {
    const data = await getProject(projectId);
    if (!data) return "Error: Project not found";

    const study = data.studies.find(s => s.id === studyId);
    if (!study) return "Error: Study not found";

    const context = {
        purpose: study.plan.purpose,
        questions: study.plan.researchQuestions,
        projectTitle: data.project.title,
        projectDescription: data.project.description
    };

    return await generateSimulationAnalysis(messages, context);
}

// Phase 8: Knowledge Injection Actions
import { KnowledgeDocument } from '@/lib/types';

async function extractContent(file: File): Promise<string> {
    const buffer = Buffer.from(await file.arrayBuffer());
    if (file.name.toLowerCase().endsWith('.docx')) {
        const result = await mammoth.extractRawText({ buffer });
        return result.value;
    }
    return await file.text();
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

    // Refresh current page
}

export async function addPersonaDocumentAction(projectId: string, personaId: string, formData: FormData) {
    const data = await getProject(projectId);
    if (!data) return;

    const persona = data.personas?.find(p => p.id === personaId);
    if (!persona) return;

    const file = formData.get('file') as File;

    if (!file) return;

    const content = await extractContent(file);
    if (!content.trim()) throw new Error("File content is empty");

    if (!persona.documents) persona.documents = [];

    const newDoc: KnowledgeDocument = {
        id: Date.now().toString(),
        title: file.name,
        fileName: file.name,
        content,
        type: 'persona_context',
        createdAt: new Date().toISOString()
    };

    persona.documents.push(newDoc);
    await saveProjectData(data);
}

export async function removeProjectDocumentAction(projectId: string, docId: string) {
    const data = await getProject(projectId);
    if (!data || !data.project.documents) return;

    data.project.documents = data.project.documents.filter(d => d.id !== docId);
    await saveProjectData(data);
}

export async function removePersonaDocumentAction(projectId: string, personaId: string, docId: string) {
    const data = await getProject(projectId);
    if (!data) return;
    const persona = data.personas?.find(p => p.id === personaId);
    if (!persona || !persona.documents) return;

    persona.documents = persona.documents.filter(d => d.id !== docId);
    await saveProjectData(data);
}

export async function updateStudyTitleAction(projectId: string, studyId: string, newTitle: string) {
    const data = await getProject(projectId);
    if (!data) return;

    const study = data.studies.find(s => s.id === studyId);
    if (!study) return;

    study.title = newTitle;
    study.updatedAt = new Date().toISOString();

    await saveProjectData(data);
    // revalidatePath(`/projects/${projectId}/studies/${studyId}`); // If needed
}
