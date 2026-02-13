'use client';

import { useState, useEffect, useRef } from 'react';
import { Project, ResearchStudy, Persona, ChatSession } from '@/lib/types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { chatWithProjectAction, createProjectChatSessionAction, deleteProjectChatSessionAction } from '@/app/actions';
import { formatDate } from '@/lib/date-utils';

interface Message {
    role: 'user' | 'model';
    text: string;
}

interface Props {
    project: Project;
    studies: ResearchStudy[];
    personas: Persona[];
}

export function ProjectAIChat({ project: initialProject, studies, personas }: Props) {
    const [project, setProject] = useState(initialProject);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(
        project.chatSessions && project.chatSessions.length > 0 ? project.chatSessions[0].id : null
    );
    const activeSession = project.chatSessions?.find(s => s.id === activeSessionId);

    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [model, setModel] = useState<'flash' | 'pro'>('flash');
    const [selectedContextIds, setSelectedContextIds] = useState<string[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [activeSession?.messages, isLoading]);

    // Update selected context when switching sessions
    useEffect(() => {
        if (activeSession) {
            setSelectedContextIds(activeSession.selectedContextIds || []);
        }
    }, [activeSessionId]);

    // Auto-create session if none exist
    useEffect(() => {
        if (!activeSessionId && (!project.chatSessions || project.chatSessions.length === 0)) {
            handleNewChat();
        }
    }, [activeSessionId, project.chatSessions]);

    const [isCreatingSession, setIsCreatingSession] = useState(false);

    const handleNewChat = async () => {
        if (isCreatingSession) return;
        setIsCreatingSession(true);
        try {
            const newSession = await createProjectChatSessionAction(project.id);
            setProject(prev => ({
                ...prev,
                chatSessions: [newSession, ...(prev.chatSessions || [])]
            }));
            setActiveSessionId(newSession.id);
        } catch (error) {
            console.error('Failed to create chat session:', error);
        } finally {
            setIsCreatingSession(false);
        }
    };

    const handleDeleteChat = async (e: React.MouseEvent, sessionId: string) => {
        e.stopPropagation();
        if (!confirm('이 대화 세션을 삭제하시겠습니까?')) return;

        try {
            await deleteProjectChatSessionAction(project.id, sessionId);
            setProject(prev => ({
                ...prev,
                chatSessions: prev.chatSessions?.filter(s => s.id !== sessionId)
            }));
            if (activeSessionId === sessionId) {
                const remaining = project.chatSessions?.filter(s => s.id !== sessionId);
                setActiveSessionId(remaining && remaining.length > 0 ? remaining[0].id : null);
            }
        } catch (error) {
            console.error('Failed to delete chat session:', error);
        }
    };

    const toggleContext = (id: string) => {
        setSelectedContextIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const [attachments, setAttachments] = useState<{ name: string; type: 'image' | 'file'; data: string; mimeType: string }[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleSend = async () => {
        if ((!input.trim() && attachments.length === 0) || isLoading || !activeSessionId) return;

        const messageText = input;
        const messageAttachments = [...attachments];

        setInput('');
        setAttachments([]);
        setIsLoading(true);

        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }

        // Optimistic update
        setProject(prev => {
            const newSessions = [...(prev.chatSessions || [])];
            const idx = newSessions.findIndex(s => s.id === activeSessionId);
            if (idx !== -1) {
                newSessions[idx] = {
                    ...newSessions[idx],
                    messages: [...newSessions[idx].messages, {
                        role: 'user',
                        text: messageText,
                        attachments: messageAttachments.map(a => ({
                            name: a.name,
                            type: a.type,
                            data: a.data
                        }))
                    }],
                    selectedContextIds: selectedContextIds
                };
            }
            return { ...prev, chatSessions: newSessions };
        });

        try {
            const response = await chatWithProjectAction(
                project.id,
                activeSessionId,
                activeSession?.messages || [],
                messageText,
                model,
                selectedContextIds,
                messageAttachments
            );

            // Update with model response
            setProject(prev => {
                const newSessions = [...(prev.chatSessions || [])];
                const idx = newSessions.findIndex(s => s.id === activeSessionId);
                if (idx !== -1) {
                    newSessions[idx] = {
                        ...newSessions[idx],
                        messages: [...newSessions[idx].messages, { role: 'model', text: response }]
                    };
                }
                return { ...prev, chatSessions: newSessions };
            });
        } catch (error) {
            console.error('Chat error:', error);
            setProject(prev => {
                const newSessions = [...(prev.chatSessions || [])];
                const idx = newSessions.findIndex(s => s.id === activeSessionId);
                if (idx !== -1) {
                    newSessions[idx] = {
                        ...newSessions[idx],
                        messages: [...newSessions[idx].messages, { role: 'model', text: '죄송합니다. 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }]
                    };
                }
                return { ...prev, chatSessions: newSessions };
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        for (let i = 0; i < files.length; i++) {
            await processFile(files[i]);
        }
    };

    const handlePaste = async (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                e.preventDefault();
                const blob = items[i].getAsFile();
                if (blob) await processFile(blob);
            }
        }
    };

    const processFile = (file: File) => {
        return new Promise<void>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const dataUrl = e.target?.result as string;
                const base64 = dataUrl.split(',')[1];
                const mimeType = file.type || 'application/octet-stream';

                setAttachments(prev => [...prev, {
                    name: file.name,
                    type: file.type.startsWith('image/') ? 'image' : 'file',
                    data: base64, // Keep full dataUrl or split depends on backend needs. Backend expects raw base64 usually? 
                    // Let's store raw base64 for API consistency
                    mimeType: mimeType
                }]);
                resolve();
            };
            reader.readAsDataURL(file);
        });
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value);
        e.target.style.height = 'auto';
        e.target.style.height = `${e.target.scrollHeight}px`;
    };

    return (
        <div className="h-[calc(100vh-280px)] flex bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
            {/* Sidebar */}
            <div className="w-80 border-r border-slate-100 flex flex-col bg-slate-50/30">
                <div className="p-6">
                    <button
                        onClick={handleNewChat}
                        disabled={isCreatingSession}
                        className="w-full bg-white border border-slate-200 hover:border-brand-500 hover:text-brand-600 text-slate-700 py-3 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                    >
                        {isCreatingSession ? (
                            <>
                                <span className="animate-spin text-brand-500">↻</span>
                                <span className="text-brand-600">대화 생성 중...</span>
                            </>
                        ) : (
                            <>
                                <span>+</span> 새 대화 시작하기
                            </>
                        )}
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-4 space-y-2 pb-6">
                    <div className="px-2 mb-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">최근 대화 목록</span>
                    </div>
                    {project.chatSessions?.map((session) => (
                        <div
                            key={session.id}
                            onClick={() => setActiveSessionId(session.id)}
                            className={`group relative p-4 rounded-2xl cursor-pointer transition-all border ${activeSessionId === session.id
                                ? 'bg-brand-50 border-brand-100'
                                : 'bg-transparent border-transparent hover:bg-slate-100'
                                }`}
                        >
                            <div className="flex flex-col gap-1 pr-6">
                                <span className={`text-[13px] font-bold truncate ${activeSessionId === session.id ? 'text-brand-700' : 'text-slate-700'
                                    }`}>
                                    {session.messages.find(m => m.role === 'user')?.text || '새로운 대화'}
                                </span>
                                <span className="text-[11px] text-slate-400 font-medium">
                                    {formatDate(session.createdAt)}
                                </span>
                            </div>
                            <button
                                onClick={(e) => handleDeleteChat(e, session.id)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 flex flex-col min-w-0 bg-white">
                {/* Header */}
                <div className="border-b border-slate-100 p-8 flex justify-between items-start">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="text-2xl">🧑‍💻</span>
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">프로젝트 도우미</h2>
                        </div>
                        <p className="text-slate-500 text-sm font-medium">
                            전반적인 진행 상황이나 다음 단계에 대해 질문해보세요. 아래에서 분석에 포함할 연구(Study)나 문서를 선택할 수 있습니다.
                        </p>
                    </div>

                    {/* Model Selector */}
                    <div className="flex bg-slate-100 p-1 rounded-xl gap-1 shrink-0 ml-4">
                        <button
                            onClick={() => setModel('flash')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${model === 'flash' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            Flash
                        </button>
                        <button
                            onClick={() => setModel('pro')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${model === 'pro' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            Pro
                        </button>
                    </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-8 space-y-6">
                    {activeSession?.messages.length === 1 && (
                        <div className="text-center py-16">
                            <span className="text-6xl mb-6 block">💬</span>
                            <h3 className="text-xl font-black text-slate-900 mb-3">전략적 의사결정을 지원합니다</h3>
                            <p className="text-slate-500 font-medium max-w-md mx-auto mb-8 leading-relaxed">
                                프로젝트 전반의 데이터를 바탕으로 무엇이든 물어보세요!
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto">
                                {[
                                    "우리가 설정한 프로젝트 목표를 달성했나요?",
                                    "진행한 인터뷰들에서 발견된 공통된 패턴은 무엇인가요?",
                                    "다음에는 어떤 유형의 유저를 인터뷰해야 할까요?",
                                    "지금까지의 핵심 인사이트를 요약해줘."
                                ].map((suggestion, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => {
                                            if (!input) setInput(suggestion);
                                        }}
                                        className="bg-slate-50 hover:bg-brand-50 border border-slate-200 hover:border-brand-200 rounded-2xl p-4 text-sm font-medium text-slate-700 hover:text-brand-700 transition-all text-left"
                                    >
                                        "{suggestion}"
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeSession?.messages.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] ${msg.role === 'user'
                                ? 'bg-brand-600 text-white rounded-[1.5rem] px-6 py-4'
                                : 'bg-slate-50 text-slate-900 rounded-[1.5rem] px-6 py-4 border border-slate-100'
                                }`}>
                                {msg.attachments && msg.attachments.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {msg.attachments.map((att, aIdx) => (
                                            <div key={aIdx} className="bg-white/20 rounded-lg p-1">
                                                {att.type === 'image' ? (
                                                    <img
                                                        src={att.url || (att.data ? `data:${att.mimeType || 'image/png'};base64,${att.data}` : '')}
                                                        alt={att.name}
                                                        className="max-h-32 rounded-md"
                                                    />
                                                ) : (
                                                    <div className="flex items-center gap-2 p-2 text-xs">
                                                        <span>📎</span>
                                                        <span>{att.name}</span>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {msg.role === 'user' ? (
                                    <p className="font-medium whitespace-pre-wrap">{msg.text}</p>
                                ) : (
                                    <div className="prose prose-sm max-w-none prose-slate">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                                    </div>
                                )}
                                {msg.role === 'model' && (
                                    <button
                                        onClick={() => handleCopy(msg.text)}
                                        className="mt-3 text-xs text-slate-400 hover:text-brand-600 font-bold transition-colors flex items-center gap-1"
                                    >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                        복사하기
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}

                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-slate-50 rounded-[1.5rem] px-6 py-4 border border-slate-100">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-brand-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                    <div className="w-2 h-2 bg-brand-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                    <div className="w-2 h-2 bg-brand-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Context Selector & Input Area */}
                <div className="border-t border-slate-100 p-6 bg-slate-50/20">
                    <div className="max-w-5xl mx-auto w-full">
                        {/* Context Selector Bar */}
                        <div className="flex items-center gap-3 mb-4 overflow-x-auto pb-2 no-scrollbar">
                            <div className="flex items-center gap-2 shrink-0 border-r border-slate-200 pr-3 mr-1">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">분석 데이터 선택:</span>
                            </div>

                            {/* Studies */}
                            {studies.map(study => (
                                <button
                                    key={study.id}
                                    onClick={() => toggleContext(study.id)}
                                    className={`shrink-0 px-4 py-1.5 rounded-full text-[11px] font-bold transition-all border ${selectedContextIds.includes(study.id)
                                        ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-100'
                                        : 'bg-white border-slate-200 text-slate-500 hover:border-blue-400'
                                        }`}
                                >
                                    📊 {study.title}
                                </button>
                            ))}

                            {/* Knowledge Documents */}
                            {project.documents?.map(doc => (
                                <button
                                    key={doc.id}
                                    onClick={() => toggleContext(`doc_${doc.id}`)}
                                    className={`shrink-0 px-4 py-1.5 rounded-full text-[11px] font-bold transition-all border ${selectedContextIds.includes(`doc_${doc.id}`)
                                        ? 'bg-amber-600 border-amber-600 text-white shadow-md shadow-amber-100'
                                        : 'bg-white border-slate-200 text-slate-500 hover:border-amber-400'
                                        }`}
                                >
                                    📄 {doc.title}
                                </button>
                            ))}

                            {studies.length === 0 && (!project.documents || project.documents.length === 0) && (
                                <span className="text-xs text-slate-400 font-medium">선택 가능한 연구나 문서가 없습니다.</span>
                            )}
                        </div>

                        {/* Attachments Preview */}
                        {attachments.length > 0 && (
                            <div className="flex items-center gap-2 mb-3 overflow-x-auto py-1">
                                {attachments.map((file, idx) => (
                                    <div key={idx} className="relative group bg-white border border-slate-200 rounded-xl p-2 flex items-center gap-2 shadow-sm">
                                        {file.type === 'image' ? (
                                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                                                <img src={`data:${file.mimeType};base64,${file.data}`} className="w-full h-full object-cover" />
                                            </div>
                                        ) : (
                                            <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                                                <span className="text-lg">📄</span>
                                            </div>
                                        )}
                                        <span className="text-xs font-medium text-slate-600 max-w-[100px] truncate">{file.name}</span>
                                        <button
                                            onClick={() => removeAttachment(idx)}
                                            className="absolute -top-2 -right-2 bg-slate-800 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex gap-4 items-end">
                            <div className="flex-1 bg-white border border-slate-200 rounded-2xl focus-within:ring-2 ring-brand-500 focus-within:border-transparent transition-all shadow-sm">
                                <textarea
                                    ref={textareaRef}
                                    value={input}
                                    onChange={handleInput}
                                    onKeyDown={handleKeyDown}
                                    onPaste={handlePaste}
                                    placeholder={
                                        selectedContextIds.length > 0
                                            ? "선택된 데이터를 바탕으로 질문을 입력하세요... (Shit+Enter로 줄바꿈, 이미지 붙여넣기 가능)"
                                            : "전략적 질문을 입력하세요... (Shit+Enter로 줄바꿈, 이미지 붙여넣기 가능)"
                                    }
                                    className="w-full px-6 py-4 rounded-2xl outline-none resize-none max-h-60 min-h-[56px] bg-transparent text-sm font-medium font-sans"
                                    rows={1}
                                    disabled={isLoading}
                                />
                                <div className="px-4 pb-2 flex justify-between items-center">
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                                            title="파일 첨부"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                            </svg>
                                        </button>
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            className="hidden"
                                            multiple
                                            accept="image/*,.pdf,.txt,.docx"
                                            onChange={handleFileSelect}
                                        />
                                    </div>
                                    <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">
                                        Shift + Enter for new line
                                    </span>
                                </div>
                            </div>

                            <button
                                onClick={handleSend}
                                disabled={isLoading || (!input.trim() && attachments.length === 0)}
                                className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-4 rounded-2xl font-black shadow-lg shadow-brand-100 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shrink-0 h-[56px] flex items-center justify-center"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
