import { Persona, Transcript } from './types';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Mock Persona kept for fallback or reference
const MOCK_PERSONA: Persona = {
    id: "mock-id",
    name: "Ada Chen Rekhi",
    role: "Executive Coach & Founder",
    company: "Notejoy",
    background: "Former SVP of Marketing at SurveyMonkey, founded Connected.",
    psychographics: {
        motivations: ["Building meaningful relationships", "Knowledge sharing"],
        painPoints: ["Inefficient career paths"],
        values: ["Growth", "Autonomy"]
    },
    behavioral: {
        communicationStyle: "Articulate, reflective",
        decisionMakingProcess: "Uses 'Curiosity Loops'"
    }
};

export async function generatePersona(transcript: Transcript, apiKey?: string): Promise<Persona> {
    return {
        id: "generated-id",
        name: "Generated Persona",
        role: "Unknown",
        company: "Unknown",
        background: "Generated from transcript...",
        psychographics: { values: [], motivations: [], painPoints: [] },
        behavioral: { communicationStyle: "", decisionMakingProcess: "" }
    };
}

export async function generatePersonaFromContext(projectContext: string, jobRole: string, additionalContext: string = ''): Promise<Persona> {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
        // Fallback Mock
        await new Promise(resolve => setTimeout(resolve, 1500));
        return {
            id: Date.now().toString(),
            name: "Mock Persona (No Key)",
            role: jobRole,
            company: "Mock Corp",
            background: "API Key was unavailable, so this mock persona was generated.",
            psychographics: { values: [], motivations: [], painPoints: [] },
            behavioral: { communicationStyle: "", decisionMakingProcess: "" },
            basis: "Mock generation due to missing API key.",
            lifestyle: "Unknown",
            interviewGuide: { checkPoints: [], communicationTips: [] }
        };
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: "gemini-flash-latest", // Fallback to 'latest' alias
        generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
    You are an expert User Researcher.
    Create a detailed USER PERSONA based on the Project Context, Target Role, and any Reference Material.
    
    Context:
    - Project: ${projectContext}
    - Target Role: ${jobRole}
    - Reference Material (Interview Scripts, etc): 
      ${additionalContext.slice(0, 5000)} (Truncated if too long)

    Output JSON format:
    {
        "name": "Korean Name",
        "role": "Job Title",
        "company": "Company Type/Name",
        "background": "Detailed professional background and current situation",
        "basis": "Explain specificially WHY this persona was created based on the context/reference.",
        "lifestyle": "Description of their daily life, habits, and tech usage patterns.",
        "mbti": "ESTJ, INFP, etc.",
        "socialRelationships": "Description of their social circle, influence level, and relationship with colleagues/friends.",
        "linguisticTraits": "Specific words they use, tone of voice, speed of speech, dialect, etc.",
        "emotionalNeeds": {
            "deficiencies": ["What they lack emotionally..."],
            "desires": ["What they deeply crave..."]
        },
        "psychographics": {
            "values": ["Value 1..."],
            "motivations": ["Motivation 1..."],
            "painPoints": ["Pain Point 1..."]
        },
        "behavioral": {
            "communicationStyle": "General communication style description",
            "decisionMakingProcess": "Description"
        },
        "interviewGuide": {
            "checkPoints": ["Verification Question 1", "Verification Question 2"],
            "communicationTips": ["Tip 1", "Tip 2"]
        }
    }

    Rules:
    1. Make it realistic and specific to the Korean market context.
    2. Respond in KOREAN (한국어).
    3. If Reference Material is provided, heavily base the 'basis', 'lifestyle' and 'psychographics' on it.
    `;

    try {
        const result = await model.generateContent(prompt);
        let text = result.response.text();

        // Clean markdown code blocks if present
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();

        const parsed = JSON.parse(text);

        return {
            id: Date.now().toString(),
            ...parsed
        };

    } catch (e) {
        console.error("Gemini Persona Gen Failed:", e);
        throw e;
    }
}

export async function generatePersonaResponse(persona: Persona, history: { role: string, content: string }[], context: string): Promise<string> {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) return `(System: GOOGLE_API_KEY is missing. I cannot reply as ${persona.name}.)`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" }); // Updated model

    const systemPrompt = `
    You are ${persona.name}.
    Role: ${persona.role} at ${persona.company || 'a company'}.
    Background: ${persona.background}
    Communication Style: ${persona.behavioral?.communicationStyle}
    Decision Making: ${persona.behavioral?.decisionMakingProcess}
    
    Context of this conversation:
    ${context}

    You are participating in a user research interview. Answer the interviewer's questions naturally, staying in character.
    
    CRITICAL BEHAVIOR RULES:
    1. **SHORT ANSWERS**: Keep your answers SHORT (max 3-4 sentences). Do NOT give a lecture.
    2. **PASSIVE**: Only answer EXACTLY what was asked. Do not volunteer extra context or background unless probing questions are asked. Leave room for the researcher to ask "Why?".
    3. **NO LISTS**: Do NOT use numbered lists. Speak in a continuous, natural flow.
    4. **Conversational**: Use fillers (음.. 사실, 그게..) and colloquial Korean. 
    5. **NO BOLD TEXT**: Do NOT use bold text (**...**) anywhere. Keep it plain text.
    6. **Citations**: Add "[출처: ...]" at the bottom if needed.

    Respond in KOREAN (한국어).
    `;

    // Construct chat history
    // Gemini uses { role: 'user' | 'model', parts: [{ text: ... }] }
    // We map 'interviewer' -> 'user', 'persona' -> 'model'
    // But since this is a stateless call, we might just pass the whole thing as a prompt or use chat session.
    // Let's use startChat for better context handling.

    try {
        const chat = model.startChat({
            history: [
                {
                    role: "user",
                    parts: [{ text: systemPrompt + "\n\n(System: The interview begins now.)" }]
                },
                {
                    role: "model",
                    parts: [{ text: "(Nods) 네, 알겠습니다. 질문해 주세요." }]
                },
                // Add previous history
                ...history.map(m => ({
                    role: m.role === 'interviewer' ? 'user' : 'model',
                    parts: [{ text: m.content }]
                }))
            ]
        });

        // The last message is usually from the user (interviewer), but the history array passed here includes ALL messages including the latest one?
        // Usually `history` in `chatWithPersonaAction` includes the latest user message.
        // Wait, `chat.sendMessage` expects the *new* message.
        // If `history` contains the last user message, we should pop it out.

        // Let's check `chatWithPersonaAction`. It passes `history`.
        // If the last item is from 'interviewer', that's the prompt.

        let prompt = "";
        const historyForChat = [...history]; // Clone
        const lastMsg = historyForChat[historyForChat.length - 1];

        if (lastMsg && lastMsg.role === 'interviewer') {
            prompt = lastMsg.content;
            historyForChat.pop(); // Remove it from history to send it as `sendMessage`
        } else {
            // Should not happen if user just sent a message
            prompt = "(System: Please continue)";
        }

        const chatSession = model.startChat({
            history: [
                {
                    role: "user",
                    parts: [{ text: systemPrompt }]
                },
                {
                    role: "model",
                    parts: [{ text: "네, 준비되었습니다. 편하게 질문해 주세요." }]
                },
                ...historyForChat.map(m => ({
                    role: m.role === 'interviewer' ? 'user' : 'model',
                    parts: [{ text: m.content }]
                }))
            ]
        });

        const result = await chatSession.sendMessage(prompt);
        return result.response.text();

    } catch (e) {
        console.error('Gemini Service Error:', e);
        return "(System: Internal Error generating response)";
    }
}

export async function generateSimulationAnalysis(
    messages: { role: string, content: string }[],
    context: { purpose: string, questions: string[], projectTitle: string, projectDescription: string }
): Promise<string> {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) return "Error: API Key missing";

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" }); // Updated model

    const transcriptText = messages.map(m => `[${m.role.toUpperCase()}]: ${m.content}`).join('\n');

    const prompt = `
    You are an expert UX Researcher. 
    Analyze the following simulated interview conversation to extract key insights.
    
    Research Context:
    - Project: ${context.projectTitle} (${context.projectDescription})
    - Research Purpose: ${context.purpose}
    - Key Research Questions: 
    ${context.questions.map((q, i) => `${i + 1}. ${q}`).join('\n    ')}

    TRANSCRIPT:
    ${transcriptText}

    Goal:
    Provide a concise analysis of the simulation result. 
    Did the questions effectively gather the information needed to answer the research questions?
    What key insights were gained from this persona?
    Any recommendation for follow-up questions?

    Format the output in Markdown.
    Respond in KOREAN (한국어).
    `;

    try {
        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (e) {
        console.error(e);
        return "Error generated analysis.";
    }
}
