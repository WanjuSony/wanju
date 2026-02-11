import { Persona, Transcript } from './types';
import { getGeminiModel } from './gemini-utils';

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

    const model = await getGeminiModel(apiKey, true);

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

    const model = await getGeminiModel(apiKey); // Standard model for fast chat

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
    1. **Conversational**: Speak naturally like a real person. Do not sound like a robot or a formal assistant. Use fillers (음.. 사실, 그게..) and colloquial Korean suitable for your role.
    2. **Variable Length**: Your answers should be of natural length. Avoid being too short (one word) or giving long lectures. If the question requires explanation, give it. If it's a simple yes/no, answer simply but politely.
    3. **Context Aware**: If "PRIOR INTERVIEW MEMORY" is provided in the context, you MUST use it. You are the same person who gave that interview. Refer to your past experiences mentioned there.
    4. **NO LISTS**: Do NOT use numbered lists. Speak in a continuous, natural flow.
    5. **NO BOLD TEXT**: Do NOT use bold text (**...**) anywhere. Keep it plain text.

    Respond in KOREAN (한국어).
    `;

    // Construct chat history
    // Gemini uses { role: 'user' | 'model', parts: [{ text: ... }] }
    // We map 'interviewer' -> 'user', 'persona' -> 'model'
    // But since this is a stateless call, we might just pass the whole thing as a prompt or use chat session.
    // Let's use startChat for better context handling.

    try {
        // ... (preserving original logic for history assembly)
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

    const model = await getGeminiModel(apiKey, true); // Pro for Analysis

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

export async function generatePersonaFromTranscript(transcriptText: string, projectContext: string): Promise<Persona> {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API Key Missing");

    const model = await getGeminiModel(apiKey, true);

    const prompt = `
    You are an expert User Researcher.
    Analyze the provided **Interview Transcript** and reverse-engineer a **USER PERSONA** that represents the interviewee.
    
    Context:
    - Project: ${projectContext}
    
    Transcript:
    ${transcriptText.slice(0, 15000)} (Truncated if too long)

    Output JSON format:
    {
        "name": "Extract Name if mentioned, otherwise 'Interviewee (Alias)'",
        "role": "Extract Job Title/Role",
        "company": "Extract Company if mentioned",
        "background": "Summarize their professional background and current situation based on what they said.",
        "basis": "This persona is based on a real interview. Mention key distinctive traits observed.",
        "lifestyle": "Infer their daily life/habits from the conversation.",
        "mbti": "Infer likely MBTI (e.g. ENTJ) based on speech patterns.",
        "socialRelationships": "Infer social influence and relationships.",
        "linguisticTraits": "Describe their actual speech style observed in transcript.",
        "emotionalNeeds": {
            "deficiencies": ["Inferred emotional deficits"],
            "desires": ["Inferred deep desires"]
        },
        "psychographics": {
            "values": ["Inferred Values"],
            "motivations": ["Inferred Motivations"],
            "painPoints": ["Explicit/Implicit Pain Points mentioned"]
        },
        "behavioral": {
            "communicationStyle": "Describe how they talked (e.g. skeptical, enthusiastic)",
            "decisionMakingProcess": "Infer how they make decisions"
        },
        "interviewGuide": {
            "checkPoints": ["Key points that were verified"],
            "communicationTips": ["How to approach this type of person"]
        }
    }

    Rules:
    1. Be highly specific to the content of the interview.
    2. Respond in KOREAN (한국어).
    `;

    try {
        const result = await model.generateContent(prompt);
        let text = result.response.text();
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(text);

        return {
            id: Date.now().toString(),
            source: 'real',
            ...parsed
        };
    } catch (e: any) {
        console.error("Gemini Persona Extraction Failed:", e);
        // Fallback for demo stability
        return {
            id: Date.now().toString(),
            name: "Extracted Persona (Fallback)",
            role: "Unknown",
            background: "Failed to extract from transcript.",
            source: 'real',
            psychographics: { values: [], motivations: [], painPoints: [] },
            behavioral: { communicationStyle: "", decisionMakingProcess: "" }
        };
    }
}

export async function updatePersonaWithNewTranscript(existingPersona: Persona, transcriptText: string, projectContext: string): Promise<Persona> {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API Key Missing");

    const model = await getGeminiModel(apiKey, true);

    const prompt = `
    You are an expert User Researcher.
    Analyze the provided **New Interview Transcript** and use it to UPDATE and REFINE the existing **User Persona**.
    
    Current Persona Profile:
    ${JSON.stringify(existingPersona, null, 2)}
    
    Project Context:
    - Project: ${projectContext}
    
    New Transcript:
    ${transcriptText.slice(0, 15000)} (Truncated if too long)

    Guidelines for Update:
    1. Do not lose existing important information, but REFINED it if the new data provides better clarity.
    2. Add new pain points, motivations, or values learned from the new session.
    3. Update behavioral traits and emotional needs based on the latest interaction.
    4. Ensure the MBTI and linguistic traits reflect the totality of what we've seen.
    5. Maintain KOREAN (한국어) for all text fields.

    Output the FULL updated JSON in the same structure as the existing persona.
    `;

    try {
        const result = await model.generateContent(prompt);
        let text = result.response.text();
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(text);

        return {
            ...existingPersona,
            ...parsed,
            id: existingPersona.id, // Preserve ID
            source: 'real',
            interviewIds: existingPersona.interviewIds // Preserve historical list (will be updated in action)
        };
    } catch (e: any) {
        console.error("Gemini Persona Update Failed:", e);
        return existingPersona; // Fallback to current state
    }
}

export async function generateWeeklyReport(
    interviews: { title: string; date: string; content: string }[],
    context: { projectTitle: string; projectDescription: string; purpose: string; researchQuestions: string[] },
    additionalComments: string = ''
): Promise<string> {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API Key Missing");

    // Use Pro model for higher reasoning quality on hypothesis verification
    const model = await getGeminiModel(apiKey, true);

    const safeContext = {
        projectTitle: String(context?.projectTitle || "Unknown Project"),
        projectDescription: String(context?.projectDescription || ""),
        purpose: String(context?.purpose || ""),
        researchQuestions: Array.isArray(context?.researchQuestions) ? context.researchQuestions : []
    };

    if (interviews.length === 0) {
        return "# Report Generation Failed\n\nNo interview data selected.";
    }

    // Defensive: Ensure all content is string
    const interviewsText = interviews.map((int, i) => `
    [Interview ${i + 1}]
    Title: ${String(int.title)}
    Date: ${String(int.date)}
    Content:
    ${String(int.content).slice(0, 10000)}... 
    `).join('\n\n');

    const REPORT_PROMPT = `
    You are an expert User Researcher.
    Your task is to write a **Weekly User Research Report** focusing on **Hypothesis Verification** and **Evidence-Based Insights**.
    
    **Project Context**:
    - Project: ${safeContext.projectTitle}
    - Description: ${safeContext.projectDescription}
    - Research Purpose: ${safeContext.purpose}
    - **Core Research Questions (Hypotheses) to Verify**:
    ${safeContext.researchQuestions.map((q, i) => `  ${i + 1}. ${q}`).join('\n')}

    **Input Data**:
    ${interviewsText}

    **User Specific Focus (Must Include)**:
    ${additionalComments ? `The user explicitly requested: "${additionalComments}". Treat this as a priority.` : '(None)'}

    **Goal**:
    Analyze the interview data to determine the validity of each Core Research Question.
    Use statuses: ✅ 검증됨 (Verified), ⚠️ 부분 검증 (Partially Verified), ❓ 추가 검증 필요 (Need More Validation), ❌ 기각 (Rejected)
    **Use Confidence Score**: For each verification, estimate a confidence percentage (e.g., 90% verified).

    **FORMATTING RULES**:
    1. **Title**: If no specific title is requested, generate one based on the LATEST interview date in the format 'YY.MM.W주차 리포트' (e.g., '26.01.4주차 리포트').
    2. **Blockquote Style**: Use \`> \` for quotes.
    3. **Line Breaks**: Leave an empty line between quotes ONLY when they belong to DIFFERENT participants. Group quotes from same person nicely.
    4. **STRICT VERBATIM**: Do NOT summarize. NO HTML tags (like <cite>) inside the blockquote. Remove classification tags like "[Beginner]" from the quote text.
    5. **Attribution**: Format exactly as:
       > "Quote text here..."
       >
       > — Speaker Name

    **Report Structure**:
    
    # [Generate Title Here]
    
    ## 1. 개요 (Overview)
    - 참여 인원: ${interviews.length}명
    - 기간: [Date Range]
    
    ## 2. 가설 검증 (Hypothesis Verification)
    (For EACH Research Question...)
    - **Status**: [Status Icon] [Confidence Score]%
    - **Reasoning**: ...
    
    ## 3. 주요 발견점 (Key Insights)
    
    ## 4. 인상적인 인용구 (Voice of Customer)
    
    ## 5. 결론 및 제안 (Action Items)

    Respond in KOREAN (한국어).
    `;

    try {
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: String(REPORT_PROMPT) }] }]
        });
        return result.response.text();
    } catch (e: any) {
        console.warn("Pro Model Failed, falling back to Flash:", e.message);
        try {
            // Fallback to Flash
            const flashModel = await getGeminiModel(apiKey, false);
            const result = await flashModel.generateContent({
                contents: [{ role: 'user', parts: [{ text: String(REPORT_PROMPT) }] }]
            });
            return result.response.text();
        } catch (flashError: any) {
            console.error("Report Generation Failed (Flash):", flashError);
            return `# Report Generation Failed\n\n**Error Details:** ${flashError.message || JSON.stringify(flashError)}\n\nPlease try again later.`;
        }
    }
}

export async function generateInterviewSuggestion(
    userIntent: string,
    context: { projectTitle: string; projectDescription: string; researchQuestions: string[] }
): Promise<string> {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) return "Error: API Key missing";

    const model = await getGeminiModel(apiKey, true); // Pro for better questions

    const prompt = `
    You are an expert User Researcher.
    Your goal is to suggest a specific, high-quality interview question based on the user's intent.

    Context:
    - Project: ${context.projectTitle}
    - Description: ${context.projectDescription}
    - Research Questions: ${context.researchQuestions.join(', ')}

    User's Request: "${userIntent}"

    Task:
    Generate a single, well-phrased interview question that addresses the user's request.
    The question should be open-ended, non-leading, and easy to understand.
    Strictly output ONLY the question text. Do not add quotes or explanations.

    Respond in KOREAN (한국어).
    `;

    try {
        const result = await model.generateContent(prompt);
        return result.response.text().trim();
    } catch (e) {
        console.error("Suggestion Generation Failed:", e);
        return "AI 제안을 생성하는 중 오류가 발생했습니다.";
    }
}

export async function chatWithStudyContext(
    history: { role: 'user' | 'model', text: string }[],
    newMessage: string,
    context: string,
    modelType: 'flash' | 'pro' = 'flash',
    images: { data: string; mimeType: string }[] = []
): Promise<string> {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
        return "API Key is missing. Please configure GOOGLE_API_KEY.";
    }

    // Dynamic selection, preferring Pro if requested
    const model = await getGeminiModel(apiKey, modelType === 'pro');

    const chat = model.startChat({
        history: [
            {
                role: "user",
                parts: [{ text: `You are a specialized UX Research Assistant. You have access to the following project data (interviews/transcripts):\n\n${context}\n\nAnswer the user's questions based ONLY on this context. If the answer is not in the context, say so. Be concise and insightful.` }]
            },
            {
                role: "model",
                parts: [{ text: "Understood. I am ready to answer questions about the provided research context." }]
            },
            ...history.map(msg => ({
                role: msg.role,
                parts: [{ text: msg.text }]
            }))
        ]
    });

    try {
        const parts: any[] = [{ text: newMessage }];

        if (images && images.length > 0) {
            images.forEach(img => {
                parts.push({
                    inlineData: {
                        data: img.data,
                        mimeType: img.mimeType
                    }
                });
            });
        }

        const result = await chat.sendMessage(parts);
        const response = await result.response;
        return response.text();
    } catch (error: any) {
        console.error("Chat Error Detail:", error);
        return `Error: ${error.message || "Unknown error occurred"}`;
    }
}

export async function chatWithProjectStrategicAI(
    history: { role: 'user' | 'model', text: string }[],
    newMessage: string,
    context: string,
    modelType: 'flash' | 'pro' = 'flash',
    images: { data: string; mimeType: string }[] = []
): Promise<string> {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
        return "(System: API Key가 설정되지 않았습니다. GOOGLE_API_KEY를 확인해주세요.)";
    }

    // Dynamic selection, preferring Pro if requested
    const model = await getGeminiModel(apiKey, modelType === 'pro');

    const chat = model.startChat({
        history: [
            {
                role: "user",
                parts: [{
                    text: `당신은 전략적인 UX 리서치 어드바이저입니다. 프로젝트의 데이터(인터뷰, 인사이트, 페르소나 등)를 분석하여 팀이 올바른 의사결정을 내릴 수 있도록 돕는 것이 당신의 역할입니다.

제공된 프로젝트 컨텍스트:\n\n${context}\n\n위 컨텍스트를 바탕으로 사용자의 질문에 답변하세요.
항상 한국어(Korean)로 답변하세요.
답변은 구체적이고 데이터에 기반해야 하며, 프로젝트의 목표 달성 여부나 다음 단계에 대한 통찰력 있는 제안을 포함해야 합니다.
만약 컨텍스트에 없는 정보라면 솔직하게 모른다고 답변하세요.` }]
            },
            {
                role: "model",
                parts: [{ text: "준비되었습니다. 제공된 프로젝트 데이터를 바탕으로 전략적인 분석과 제안을 드리겠습니다. 무엇이 궁금하신가요?" }]
            },
            ...history.map(msg => ({
                role: msg.role,
                parts: [{ text: msg.text }]
            }))
        ]
    });

    try {
        const parts: any[] = [{ text: newMessage }];

        if (images && images.length > 0) {
            images.forEach(img => {
                parts.push({
                    inlineData: {
                        data: img.data,
                        mimeType: img.mimeType
                    }
                });
            });
        }

        const result = await chat.sendMessage(parts);
        const response = await result.response;
        return response.text();
    } catch (error: any) {
        console.error("Project AI Chat Error:", error);
        return `오류가 발생했습니다: ${error.message || "알 수 없는 오류"}`;
    }
}

export async function generateImageFromPrompt(prompt: string): Promise<string | null> {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
        console.error("API Key is missing for Image Generation");
        return null;
    }

    // Model selection: Try 'nano-banana-pro-preview' first, then 'imagen-3.0-generate-001'
    const modelsToTry = [
        "imagen-3.0-generate-001",
        "imagen-4.0-generate-001",
        "nano-banana-pro-preview"
    ];

    for (const modelName of modelsToTry) {
        try {
            // Construct the REST URL
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:predict?key=${apiKey}`;

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    instances: [{ prompt: prompt }],
                    parameters: {
                        sampleCount: 1
                    }
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.warn(`Model ${modelName} failed:`, errorData.error?.message || response.statusText);
                continue; // Try next model
            }

            const data = await response.json();
            // Expected format: { predictions: [ { bytesBase64Encoded: "..." } ] }
            if (data.predictions && data.predictions.length > 0 && data.predictions[0].bytesBase64Encoded) {
                return data.predictions[0].bytesBase64Encoded;
            } else if (data.predictions && data.predictions.length > 0 && data.predictions[0].mimeType && data.predictions[0].bytesBase64Encoded) {
                return data.predictions[0].bytesBase64Encoded;
            }

        } catch (e) {
            console.error(`Error generating image with ${modelName}:`, e);
        }
    }

    return null;
}
export async function describeImageForContext(
    base64Data: string,
    mimeType: string,
    filename: string
): Promise<string> {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) return "Error: API Key missing. Cannot analyze image.";

    // Use Pro model for vision analysis
    const model = await getGeminiModel(apiKey, true);

    const prompt = `
    You are an expert UX Researcher and UI Designer.
    Analyze the provided image (filename: ${filename}) in detail.
    
    Goal:
    Describe this image so that it can be used as **Textual Context** for a Large Language Model effectively.
    
    If it is a UI Screenshot:
    - Describe the layout, key elements, copy, and visual hierarchy.
    - Mention specific button labels, headlines, and calls to action.
    - Identify any usability issues or notable design patterns.

    If it is a Diagram/Chart:
    - Summarize the data, trends, and labels.
    - Explain the flow or relationship shown.

    If it is a Document Scan:
    - Extract the text content as accurately as possible.

    Format:
    [IMAGE TYPE]
    **Summary:** ...
    **Details:**
    - ...
    - ...

    Respond in KOREAN (한국어).
    `;

    try {
        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: base64Data,
                    mimeType: mimeType
                }
            }
        ]);
        return result.response.text();
    } catch (e: any) {
        console.error("Image Description Failed:", e);
        return `Error describing image: ${e.message}`;
    }
}
