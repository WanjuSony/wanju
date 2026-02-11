'use server';

import { getProject, saveProjectData } from '@/lib/store/projects';
import { updatePersonaWithNewTranscript } from '@/lib/llm-service';
import { revalidatePath } from 'next/cache';
import { Persona } from '@/lib/types';

export async function reanalyzePersonaAction(projectId: string, personaId: string) {
    const data = await getProject(projectId);
    if (!data) throw new Error("Project not found");

    const personaIndex = data.personas.findIndex(p => p.id === personaId);
    if (personaIndex === -1) throw new Error("Persona not found");

    const persona = data.personas[personaIndex];

    // Flatten all studies' sessions to search for links
    const allSessions = data.studies.flatMap(s => s.sessions);

    // 1. Identify linked sessions through multiple methods (Robust Search)
    const trackedIds = new Set(persona.interviewIds || []);
    if (persona.sourceId) trackedIds.add(persona.sourceId);

    const linkedSessions = allSessions.filter(s =>
        trackedIds.has(s.id) || s.participantId === persona.id
    );

    if (linkedSessions.length === 0) {
        throw new Error("No interviews linked to this persona to analyze.");
    }

    // 2. Sync links back to persona if they were missing (Self-healing)
    const foundIds = linkedSessions.map(s => s.id);
    const missingIds = foundIds.filter(id => !trackedIds.has(id));

    if (missingIds.length > 0) {
        if (!persona.interviewIds) persona.interviewIds = [];
        persona.interviewIds = Array.from(new Set([...persona.interviewIds, ...foundIds]));
    }

    // Combine transcripts
    // Limit total length to avoid token limits (approx 50k chars or so?)
    // Gemini Pro handles 1M tokens, so we are safe with full text usually.
    // But let's be safe.

    let combinedTranscript = linkedSessions.map(s => `
    [Interview: ${s.title}]
    [Date: ${s.date}]
    ${s.content || s.summary || "(No Content)"}
    `).join("\n\n-----------------\n\n");

    const projectContext = `
        Title: ${data.project.title}
        Description: ${data.project.description}
        Goal: ${data.project.goal}
    `;

    // Call LLM Service
    // We are "re-analyzing", which means updating the persona with the aggregate data.
    // The existing function `updatePersonaWithNewTranscript` name implies "New Transcript", but logic works for "Refining with provided transcript".
    const updatedPersona = await updatePersonaWithNewTranscript(persona, combinedTranscript, projectContext);

    // Save
    data.personas[personaIndex] = updatedPersona;
    await saveProjectData(data);

    revalidatePath(`/projects/${projectId}`);
    return updatedPersona;
}
