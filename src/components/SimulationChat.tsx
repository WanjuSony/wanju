'use client';

import { useState, useRef, useEffect } from 'react';
import { Persona, GuideBlock, SimulationSession } from '@/lib/types';
import { chatWithPersonaAction, saveSimulationAction, analyzeMessagesAction } from '@/app/actions';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';


interface Message {
    id: string;
    role: 'interviewer' | 'persona';
    text: string;
}

interface Props {
    projectId: string;
    studyId: string;
    personas: Persona[]; // Available cast for this study
    guide: GuideBlock[];
    initialSession?: SimulationSession;
}

export function SimulationChat({ projectId, studyId, personas, guide, initialSession }: Props) {
    const router = useRouter();
    const [step, setStep] = useState<'selection' | 'chat'>(initialSession ? 'chat' : 'selection');
    const [selectedPersonaId, setSelectedPersonaId] = useState<string>(initialSession?.personaId || '');
    const activePersona = personas.find(p => p.id === selectedPersonaId);

    const [messages, setMessages] = useState<Message[]>(initialSession ? initialSession.messages : []);
    const [activeSessionId, setActiveSessionId] = useState<string>(initialSession?.id || '');

    const [askedQuestionIds, setAskedQuestionIds] = useState<Set<string>>(new Set());

    // Analysis State
    const [showAnalysis, setShowAnalysis] = useState(!!initialSession?.insights);
    const [analysisResult, setAnalysisResult] = useState<string>(initialSession?.insights || '');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Initial message when chat starts
    // Initial message when chat starts or Resume
    useEffect(() => {
        if (step === 'chat' && activePersona) {

            // 1. If no messages, init greeting
            if (messages.length === 0) {
                setMessages([{ id: 'init', role: 'persona', text: `Hi, I'm ${activePersona.name}. Thanks for having me today.` }]);
            } else {
                // 2. Sync already asked questions from history
                const asked = new Set<string>();
                // Simple heuristic: if message content matches guide content
                // Note: Ideally we should store questionId in message metadata
                guide.forEach(g => {
                    if (g.type === 'question') {
                        const match = messages.some(m => m.role === 'interviewer' && m.text === g.content);
                        if (match) asked.add(g.id);
                    }
                });
                setAskedQuestionIds(asked);
            }
        }
    }, [step, activePersona, guide]); // Intentionally removed messages.length to run only on init/step change


    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async (text: string, questionId?: string) => {
        if (!text.trim() || !activePersona) return;

        const newMsg: Message = { id: Date.now().toString(), role: 'interviewer', text };
        const updatedMessages = [...messages, newMsg];

        setMessages(updatedMessages);
        setInput('');
        setIsTyping(true);

        if (questionId) {
            setAskedQuestionIds(prev => {
                const newSet = new Set(prev);
                newSet.add(questionId);
                return newSet;
            });
        }

        try {
            const history = updatedMessages.map(m => ({
                role: m.role,
                content: m.text
            }));

            const responseText = await chatWithPersonaAction(projectId, activePersona.id, history);

            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'persona',
                text: responseText || "(No response)"
            };

            setMessages(prev => [...prev, aiMsg]);
        } catch (e) {
            console.error(e);
            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'persona', text: "(Error: Failed to get response)" }]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleAnalyze = async () => {
        if (messages.length < 2) {
            alert("Not enough conversation to analyze.");
            return;
        }
        setIsAnalyzing(true);
        setShowAnalysis(true);
        try {
            const history = messages.map(m => ({
                role: m.role,
                content: m.text
            }));
            const result = await analyzeMessagesAction(projectId, studyId, history);
            setAnalysisResult(result || "No insights generated.");
        } catch (e) {
            console.error(e);
            setAnalysisResult("Error generating analysis.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleSave = async () => {
        if (!activePersona) return;
        setIsSaving(true);
        try {
            const sessionId = activeSessionId || Date.now().toString();

            await saveSimulationAction(projectId, studyId, {
                id: sessionId,
                personaId: activePersona.id,
                createdAt: initialSession?.createdAt || new Date().toISOString(),
                messages: messages,
                insights: analysisResult || undefined
            });

            if (!activeSessionId) {
                // First save: redirect to the permanent URL
                setActiveSessionId(sessionId);
                router.replace(`/projects/${projectId}/studies/${studyId}/simulation/${sessionId}`);
            } else {
                // Subsequent save: just notify
                alert("Session saved successfully.");
            }
        } catch (e) {
            console.error("Failed to save simulation", e);
            alert("Failed to save simulation session.");
        } finally {
            setIsSaving(false);
        }
    };

    // Step 1: Persona Selection
    if (step === 'selection') {
        return (
            <div className="flex flex-col items-center justify-center h-[600px] max-w-4xl mx-auto">
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Select a Persona</h2>
                <p className="text-slate-500 mb-8">Who would you like to interview today?</p>

                {personas.length === 0 ? (
                    <div className="text-center bg-white p-8 rounded-xl border border-dashed border-slate-300">
                        <p className="text-slate-500 mb-4">No personas found for this project.</p>
                        <Link
                            href={`/projects/${projectId}?tab=personas`}
                            className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-2 rounded-lg font-bold text-sm transition"
                        >
                            + Create New Persona
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full px-4">
                        {personas.map(p => (
                            <button
                                key={p.id}
                                onClick={() => {
                                    setSelectedPersonaId(p.id);
                                    setStep('chat');
                                }}
                                className="flex flex-col text-left bg-white p-6 rounded-xl border border-slate-200 hover:border-brand-500 hover:shadow-md transition group"
                            >
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center font-bold text-lg group-hover:bg-brand-600 group-hover:text-white transition">
                                        {p.name.charAt(0)}
                                    </div>
                                    <div>
                                        <div className="font-bold text-slate-900 group-hover:text-brand-700">{p.name}</div>
                                        <div className="text-xs text-slate-500">{p.role}</div>
                                    </div>
                                </div>
                                <div className="text-sm text-slate-600 line-clamp-2">
                                    {p.background}
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    const handleExport = () => {
        if (!activePersona) return;

        const date = new Date().toLocaleDateString();
        const header = `[Persona Interview Export]\nDate: ${date}\nProject: ${projectId}\n\n`;

        const personaDetails = `[Persona Profile]\nName: ${activePersona.name}\nRole: ${activePersona.role}\nCompany: ${activePersona.company}\nBackground: ${activePersona.background}\n\nTraits:\n- Comm Style: ${activePersona.behavioral.communicationStyle}\n- Decision Making: ${activePersona.behavioral.decisionMakingProcess}\n- MBTI: ${activePersona.mbti || 'N/A'}\n\n`;

        const transcript = messages.map(m => {
            const speaker = m.role === 'interviewer' ? 'Researcher' : activePersona.name;
            return `${speaker}: ${m.text}`;
        }).join('\n\n');

        const content = header + personaDetails + "[Transcript]\n" + transcript;

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${activePersona.name}_Interview_${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // Step 2: Chat Interface
    return (
        <div className="flex gap-6 h-[calc(100vh-200px)] min-h-[600px] relative transition-all duration-300">
            {/* Guide - Hide on mobile if needed or just flex wrap */}
            <div className="w-1/4 min-w-[250px] bg-white border border-slate-200 rounded-xl p-4 flex flex-col h-full hidden md:flex">
                <div className="mb-4">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Interviewing</label>
                    <div className="w-full p-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-800 bg-slate-50 flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs">
                            {activePersona?.name.charAt(0)}
                        </div>
                        {activePersona?.name}
                    </div>
                    <button
                        onClick={() => setStep('selection')}
                        className="text-xs text-brand-600 hover:underline mt-1 ml-1"
                    >
                        Change Persona
                    </button>
                </div>

                <div className="flex justify-between items-center mb-2 border-t border-slate-100 pt-4">
                    <h3 className="font-bold text-slate-800 text-sm">Discussion Guide</h3>
                    <span className="text-xs text-slate-400 font-medium">
                        {askedQuestionIds.size} / {guide.filter(g => g.type === 'question').length} Checked
                    </span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                    {guide.map((block, i) => {
                        const isAsked = askedQuestionIds.has(block.id);
                        const isScript = block.type === 'script';

                        return (
                            <button
                                key={block.id}
                                onClick={() => handleSend(block.content, block.type === 'question' ? block.id : undefined)}
                                disabled={isAsked}
                                className={`w-full text-left text-xs p-3 rounded-lg border transition duration-150 flex gap-2 items-start group
                                    ${isAsked
                                        ? 'bg-slate-50 border-slate-100 text-slate-400 cursor-default'
                                        : isScript
                                            ? 'bg-amber-50 border-amber-100 text-slate-700 hover:bg-amber-100'
                                            : 'bg-white hover:bg-brand-50 hover:text-brand-700 border-slate-200 hover:border-brand-200'
                                    }`}
                            >
                                <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0
                                    ${isAsked ? 'bg-green-100 border-green-200 text-green-600' :
                                        isScript ? 'border-amber-300 text-amber-500 bg-amber-100' :
                                            'border-slate-300 text-transparent group-hover:border-brand-300'}
                                `}>
                                    {isAsked && "✓"}
                                    {isScript && "S"}
                                </div>
                                <span className={isAsked ? 'line-through decoration-slate-300' : ''}>
                                    {block.content}
                                </span>
                            </button>
                        );
                    })}
                    {guide.length === 0 && (
                        <div className="text-slate-400 text-xs italic text-center p-4">
                            No guide questions defined. <br />
                            Go to 'Interview Guide' to add questions.
                        </div>
                    )}
                </div>
            </div>

            {/* Chat Area */}
            <div className={`flex-1 bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden h-full shadow-lg transition-all duration-300`}>
                <div className="bg-slate-50 border-b border-slate-100 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-brand-600 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                            {activePersona?.name.charAt(0)}
                        </div>
                        <div>
                            <div className="text-base font-bold text-slate-900">{activePersona?.name}</div>
                            <div className="text-xs text-slate-500">{activePersona?.role}</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleExport}
                            className="text-xs bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1"
                        >
                            📥 Export
                        </button>
                        <div className="w-px h-4 bg-slate-300 mx-1"></div>
                        <button
                            onClick={() => setShowAnalysis(!showAnalysis)}
                            className={`text-xs px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1
                                ${showAnalysis ? 'bg-brand-100 text-brand-700' : 'bg-white border border-slate-200 text-slate-600 hover:bg-brand-50'}
                            `}
                        >
                            <span className="text-lg">✨</span>
                            {showAnalysis ? 'Hide Insight' : 'Insight'}
                        </button>
                        <div className="w-px h-4 bg-slate-300 mx-1"></div>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="text-xs bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg font-bold transition disabled:opacity-50"
                        >
                            {isSaving ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
                    {messages.map(m => (
                        <div key={m.id} className={`flex ${m.role === 'interviewer' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] rounded-2xl px-5 py-3 text-sm shadow-sm prose prose-sm max-w-none ${m.role === 'interviewer'
                                ? 'bg-brand-600 text-white rounded-br-none prose-invert'
                                : 'bg-white text-slate-800 rounded-bl-none border border-slate-100'
                                }`}>
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                        p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />
                                    }}
                                >
                                    {m.text}
                                </ReactMarkdown>
                            </div>
                        </div>
                    ))}
                    {isTyping && (
                        <div className="flex justify-start">
                            <div className="bg-white border border-slate-100 rounded-2xl rounded-bl-none px-4 py-3 text-slate-400 text-xs flex gap-1 shadow-sm">
                                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-75"></span>
                                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-150"></span>
                            </div>
                        </div>
                    )}
                    <div ref={bottomRef} />
                </div>

                <div className="p-4 border-t border-slate-200 bg-white">
                    <div className="flex gap-2 max-w-4xl mx-auto">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend(input)}
                            placeholder="Type your message..."
                            className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 text-sm"
                        />
                        <button
                            onClick={() => handleSend(input)}
                            disabled={!input.trim()}
                            className="bg-brand-600 hover:bg-brand-700 text-white px-6 rounded-xl font-bold text-sm transition disabled:opacity-50 shadow-sm"
                        >
                            Send
                        </button>
                    </div>
                </div>
            </div>

            {/* Analysis Panel */}
            {showAnalysis && (
                <div className="w-1/3 min-w-[300px] bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden shadow-lg animate-in slide-in-from-right duration-300">
                    <div className="bg-brand-50 border-b border-brand-100 p-4 flex justify-between items-center">
                        <div className="font-bold text-brand-900 flex items-center gap-2">
                            <span className="text-xl">✨</span> AI Insight Analysis
                        </div>
                        <button
                            onClick={() => setShowAnalysis(false)}
                            className="text-brand-400 hover:text-brand-700"
                        >
                            &times;
                        </button>
                    </div>

                    <div className="bg-white border-b border-slate-100 p-3 flex justify-end">
                        <button
                            onClick={handleAnalyze}
                            disabled={isAnalyzing}
                            className={`w-full text-xs py-2 rounded-lg font-bold transition flex items-center justify-center gap-1
                                ${isAnalyzing ? 'bg-slate-100 text-slate-400' : 'bg-brand-600 hover:bg-brand-700 text-white shadow-sm'}
                            `}
                        >
                            {isAnalyzing ? (
                                <>
                                    <div className="w-3 h-3 border-2 border-slate-300 border-t-brand-600 rounded-full animate-spin"></div>
                                    Updating...
                                </>
                            ) : (
                                <>
                                    <span>🔄</span> Update Insight
                                </>
                            )}
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-5 relative">
                        {analysisResult && !isAnalyzing && (
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(analysisResult);
                                    alert('Analysis copied to clipboard!');
                                }}
                                className="absolute top-2 right-2 text-xs bg-white border border-slate-200 px-2 py-1 rounded shadow-sm hover:bg-slate-50 text-slate-500 z-10"
                            >
                                📋 Copy
                            </button>
                        )}

                        {isAnalyzing ? (
                            <div className="flex flex-col items-center justify-center h-40 text-brand-400 gap-2">
                                <div className="w-6 h-6 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
                                <span className="text-xs">Analyzing conversation...</span>
                            </div>
                        ) : analysisResult ? (
                            <div className="prose prose-sm prose-slate max-w-none">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{analysisResult}</ReactMarkdown>
                            </div>
                        ) : (
                            <div className="text-center text-slate-400 text-sm mt-10 p-4">
                                <p>No specific insights yet.</p>
                                <p className="mt-2">Click 'Update Insight' above to analyze the conversation.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
