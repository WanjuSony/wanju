'use server';

import {
    generatePersona,
    generatePersonaFromContext,
    generatePersonaFromTranscript,
    updatePersonaWithNewTranscript,
    generatePersonaResponse,
    generateInterviewSuggestion,
    chatWithStudyContext,
    generateImageFromPrompt
} from '@/lib/llm-service';
import { parseTranscript } from '@/lib/transcript';
import { Persona, SimulationSession, KnowledgeDocument } from '@/lib/types';
import { getProject, saveProjectData } from '@/lib/store/projects';
import { revalidatePath } from 'next/cache';
import mammoth from 'mammoth';
// @ts-ignore
import pdf from 'pdf-parse/lib/pdf-parse.js';
import { Buffer } from 'buffer';

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

export async function createPersonaAction(filename: string): Promise<Persona | null> {
    const transcript = await parseTranscript(filename);
    if (!transcript) return null;

    const apiKey = process.env.OPENAI_API_KEY;
    const persona = await generatePersona(transcript, apiKey);
    return persona;
}

export async function createManualPersonaAction(projectId: string, name: string, role: string, characteristics: string) {
    const data = await getProject(projectId);
    if (!data) return;

    if (!data.personas) data.personas = [];

    const newPersona: Persona = {
        id: Date.now().toString(),
        name,
        role,
        background: characteristics,
        psychographics: {
            motivations: [],
            painPoints: [],
            values: []
        },
        behavioral: {
            communicationStyle: '',
            decisionMakingProcess: ''
        },
        source: 'real'
    };

    data.personas.push(newPersona);
    await saveProjectData(data);
    revalidatePath(`/projects/${projectId}`);
}

export async function createAIGeneratedPersonaAction(projectId: string, formData: FormData) {
    const data = await getProject(projectId);
    if (!data) return;

    const context = formData.get('context') as string;
    const role = formData.get('role') as string || 'General User';

    const newPersona = await generatePersonaFromContext(
        `Project: ${data.project.title}\n${data.project.description}`,
        role,
        context
    );

    if (!data.personas) data.personas = [];
    data.personas.push(newPersona);

    await saveProjectData(data);
    revalidatePath(`/projects/${projectId}`);
}

export async function chatWithPersonaAction(projectId: string, personaId: string, history: { role: string, content: string }[]) {
    const data = await getProject(projectId);
    if (!data) throw new Error("Project not found");

    const persona = data.personas?.find(p => p.id === personaId);
    if (!persona) throw new Error("Persona not found");

    // Gather summaries and structured data from past interviews of this persona
    const pastInterviews = data.studies.flatMap(s => s.sessions).filter(i => i.participantId === personaId);

    let priorMemory = "";
    if (pastInterviews.length > 0) {
        priorMemory = "### PRIOR INTERVIEW MEMORY (What you've shared in past interviews)\n";
        pastInterviews.forEach((interview, idx) => {
            priorMemory += `#### Interview ${idx + 1}: ${interview.title}\n`;
            if (interview.summary) priorMemory += `Summary: ${interview.summary}\n`;
            if (interview.structuredData && interview.structuredData.length > 0) {
                priorMemory += `Key Points:\n`;
                interview.structuredData.forEach(insight => {
                    priorMemory += `- [${insight.type.toUpperCase()}] ${insight.content}\n`;
                });
            }
            priorMemory += "\n";
        });
    }

    const projectContextStr = `
        Title: ${data.project.title}
        Description: ${data.project.description}
        Prior Memory: ${priorMemory}
    `;

    const response = await generatePersonaResponse(persona, history.map(h => ({ role: h.role === 'persona' ? 'model' : 'user', content: h.content })), projectContextStr);
    return response;
}

export async function saveSimulationAction(projectId: string, studyId: string, session: SimulationSession) {
    const data = await getProject(projectId);
    if (!data) return;

    const studyIndex = data.studies.findIndex(s => s.id === studyId);
    if (studyIndex === -1) return;

    if (!data.studies[studyIndex].simulationSessions) {
        data.studies[studyIndex].simulationSessions = [];
    }

    data.studies[studyIndex].simulationSessions!.push({
        ...session,
        id: Date.now().toString()
    });

    await saveProjectData(data);
    revalidatePath(`/projects/${projectId}/studies/${studyId}`);
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

export async function removePersonaDocumentAction(projectId: string, personaId: string, docId: string) {
    const data = await getProject(projectId);
    if (!data) return;
    const persona = data.personas?.find(p => p.id === personaId);
    if (!persona || !persona.documents) return;

    persona.documents = persona.documents.filter(d => d.id !== docId);
    await saveProjectData(data);
}

export async function deleteSimulationSessionAction(projectId: string, studyId: string, sessionId: string) {
    const data = await getProject(projectId);
    if (!data) return;

    const study = data.studies.find(s => s.id === studyId);
    if (!study || !study.simulationSessions) return;

    study.simulationSessions = study.simulationSessions.filter(s => s.id !== sessionId);
    await saveProjectData(data);
    revalidatePath(`/projects/${projectId}/studies/${studyId}`);
}

export async function createPersonaFromInterviewAction(projectId: string, studyId: string, interviewId: string) {
    const data = await getProject(projectId);
    if (!data) throw new Error("Project not found");

    const study = data.studies.find(s => s.id === studyId);
    const interview = study?.sessions.find(i => i.id === interviewId);
    if (!interview || !interview.content) throw new Error("Interview or content not found");

    const projectContext = `
        Title: ${data.project.title}
        Description: ${data.project.description}
    `;

    const persona = await generatePersonaFromTranscript(interview.content, projectContext);
    if (!data.personas) data.personas = [];

    persona.source = 'real';
    // Link back to the interview
    persona.interviewIds = [interview.id];

    data.personas.push(persona);

    interview.participantId = persona.id;

    await saveProjectData(data);
    revalidatePath(`/projects/${projectId}`);
    return persona;
}

export async function updatePersonaAction(projectId: string, persona: Persona) {
    const data = await getProject(projectId);
    if (!data) return;

    if (!data.personas) return;
    const index = data.personas.findIndex(p => p.id === persona.id);
    if (index === -1) return;

    data.personas[index] = persona;
    await saveProjectData(data);
}

export async function generateAIInterviewQuestionAction(projectId: string, studyId: string, userIntent: string) {
    const data = await getProject(projectId);
    if (!data) throw new Error("Project not found");

    const study = data.studies.find(s => s.id === studyId);
    if (!study) throw new Error("Study not found");

    const suggestion = await generateInterviewSuggestion(
        userIntent,
        {
            projectTitle: data.project.title,
            projectDescription: data.project.description,
            researchQuestions: study.plan.researchQuestions
        }
    );
    return suggestion;
}

export async function createChatSessionAction(projectId: string, studyId: string) {
    const data = await getProject(projectId);
    if (!data) throw new Error("Project not found");

    const study = data.studies.find(s => s.id === studyId);
    if (!study) throw new Error("Study not found");

    if (!study.chatSessions) {
        study.chatSessions = [];
    }

    const newSession = {
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [{ role: 'model', text: '안녕하세요! 연구 결과에 대해 궁금한 점이 있으신가요? 각 인터뷰나 시뮬레이션의 내용을 물어보시면 상세히 답변해 드릴게요. 😊' }] as { role: 'user' | 'model', text: string }[]
    };

    study.chatSessions.push(newSession);

    await saveProjectData(data);
    revalidatePath(`/projects/${projectId}/studies/${studyId}`);
    return newSession;
}

export async function deleteChatSessionAction(projectId: string, studyId: string, sessionId: string) {
    const data = await getProject(projectId);
    if (!data) throw new Error("Project not found");

    const study = data.studies.find(s => s.id === studyId);
    if (!study) throw new Error("Study not found");

    if (study.chatSessions) {
        study.chatSessions = study.chatSessions.filter(s => s.id !== sessionId);
        await saveProjectData(data);
        revalidatePath(`/projects/${projectId}/studies/${studyId}`);
    }
}

export async function updateChatSessionContextAction(projectId: string, studyId: string, sessionId: string, contextIds: string[]) {
    const data = await getProject(projectId);
    if (!data) throw new Error("Project not found");

    const study = data.studies.find(s => s.id === studyId);
    if (!study) throw new Error("Study not found");

    if (study.chatSessions) {
        const session = study.chatSessions.find(s => s.id === sessionId);
        if (session) {
            session.selectedContextIds = contextIds;
            await saveProjectData(data);
        }
    }
}

export async function chatWithStudyAction(
    projectId: string,
    studyId: string,
    sessionId: string,
    history: { role: 'user' | 'model', text: string }[],
    message: string,
    modelType: 'flash' | 'pro',
    selectedContextIds: string[] = [],
    attachments: { name: string; type: 'image' | 'file'; data: string }[] = []
) {
    const data = await getProject(projectId);
    if (!data) throw new Error("Project not found");

    const study = data.studies.find(s => s.id === studyId);
    if (!study) throw new Error("Study not found");

    if (!study.chatSessions) study.chatSessions = [];
    const sessionIndex = study.chatSessions.findIndex(s => s.id === sessionId);

    // Process attachments
    let processedMessage = message;
    const images: { data: string; mimeType: string }[] = [];
    const savedAttachments: { name: string; type: 'image' | 'file' }[] = []; // for saving to history without big data

    if (attachments && attachments.length > 0) {
        for (const att of attachments) {
            savedAttachments.push({ name: att.name, type: att.type });

            if (att.type === 'image') {
                // Assume data is base64 like "data:image/png;base64,..."
                const matches = att.data.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
                if (matches && matches.length === 3) {
                    images.push({
                        mimeType: matches[1],
                        data: matches[2]
                    });
                }
            } else if (att.type === 'file') {
                // For document files, we need to extract text.
                // Since `extractContent` takes a File object, and we have base64, we might need a different approach 
                // or just decode it here if we can. 
                // However, simplistic text extraction from base64 might be complex without 'mammoth' buffer support.
                // Re-using extractContent requires a Buffer.
                try {
                    const matches = att.data.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
                    if (matches && matches.length === 3) {
                        const buffer = Buffer.from(matches[2], 'base64');
                        let text = "";

                        if (att.name.toLowerCase().endsWith('.docx')) {
                            const result = await mammoth.extractRawText({ buffer });
                            text = result.value;
                        } else if (att.name.toLowerCase().endsWith('.pdf')) {
                            const pdfData = await pdf(buffer);
                            text = pdfData.text;
                        } else {
                            // Plain text fallback
                            text = buffer.toString('utf-8');
                        }

                        processedMessage += `\n\n[Attached File Content: ${att.name}]\n${text}\n[End of File Content]`;
                    }
                } catch (e) {
                    console.error("Failed to parse attachment", att.name, e);
                    processedMessage += `\n(Failed to read content of ${att.name})`;
                }
            }
        }
    }


    if (sessionIndex !== -1) {
        study.chatSessions[sessionIndex].messages.push({
            role: 'user',
            text: message, // Save original message
            attachments: savedAttachments
        });
        study.chatSessions[sessionIndex].selectedContextIds = selectedContextIds;
        study.chatSessions[sessionIndex].updatedAt = new Date().toISOString();
    }

    // Fix: Match raw IDs as sent by frontend
    const selectedInterviews = study.sessions.filter(i => selectedContextIds.includes(i.id));
    const selectedSimulations = study.simulationSessions?.filter(s => selectedContextIds.includes(s.id)) || [];

    let contextStr = `
        Purpose: ${study.plan.purpose}
        Background: ${study.plan.background}
    `;

    if (selectedContextIds.includes('guide')) {
        contextStr += `\n### Discussion Guide\n${study.discussionGuide?.map(b => `- [${b.type}] ${b.content}`).join('\n') || 'None'}\n`;
    }

    if (selectedInterviews.length > 0) {
        contextStr += "\n### Selected Real Interviews (Transcripts & Insights)\n";
        selectedInterviews.forEach((interview, idx) => {
            contextStr += `\n#### [Interview ${idx + 1}] Title: ${interview.title}\n`;
            contextStr += `Date: ${interview.date}\n`;

            if (interview.summary) {
                contextStr += `Summary: ${interview.summary}\n`;
            }

            if (interview.structuredData && interview.structuredData.length > 0) {
                contextStr += `> Key Insights:\n`;
                interview.structuredData.forEach(insight => {
                    contextStr += `  - [${insight.type.toUpperCase()}] ${insight.content}\n`;
                });
            }

            if (interview.interviewerFeedback) {
                contextStr += `> Interviewer Feedback: ${interview.interviewerFeedback}\n`;
            }

            if (interview.content) {
                // Limit transcript length to avoid blowing up context too much, 
                // but keep it generous for "flash"/1M context models. 
                // 50,000 chars is roughly 10-15k tokens.
                const contentSnippet = interview.content.length > 50000
                    ? interview.content.substring(0, 50000) + "...(truncated)"
                    : interview.content;
                contextStr += `> Transcript (Content):\n${contentSnippet}\n`;
            } else if (interview.audioUrl) {
                contextStr += `(Audio available but no transcript text found.)\n`;
            }
            contextStr += `\n---\n`;
        });
    }

    if (selectedSimulations.length > 0) {
        contextStr += "\n### Selected Simulation Sessions\n";
        selectedSimulations.forEach((sim, idx) => {
            contextStr += `\n#### [Simulation ${idx + 1}]\n`;
            // Find persona name if possible
            const persona = data.personas?.find(p => p.id === sim.personaId);
            if (persona) contextStr += `Persona: ${persona.name} (${persona.role})\n`;

            if (sim.messages) {
                const dialogue = sim.messages.map(m => `${m.role === 'interviewer' ? 'Interviewer' : 'Persona'}: ${m.text}`).join('\n');
                contextStr += `> Dialogue:\n${dialogue}\n`;
            }
            contextStr += `\n---\n`;
        });
    }

    const responseText = await chatWithStudyContext(history, processedMessage, contextStr, modelType, images);

    if (sessionIndex !== -1) {
        study.chatSessions[sessionIndex].messages.push({ role: 'model', text: responseText });
        study.chatSessions[sessionIndex].updatedAt = new Date().toISOString();
        await saveProjectData(data);
        revalidatePath(`/projects/${projectId}/studies/${studyId}`);
    }

    return responseText;
}

export async function deletePersonaAction(projectId: string, personaId: string) {
    const data = await getProject(projectId);
    if (!data || !data.personas) return;

    data.personas = data.personas.filter(p => p.id !== personaId);
    await saveProjectData(data);
    revalidatePath(`/projects/${projectId}`);
}

export async function generateImageAction(prompt: string): Promise<string | null> {
    try {
        const imageBase64 = await generateImageFromPrompt(prompt);
        return imageBase64;
    } catch (e) {
        console.error("Generate Image Action Failed:", e);
        return null;
    }
}

