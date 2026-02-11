'use client';

import { useState, useRef, useEffect } from 'react';
import { chatWithStudyAction, createChatSessionAction, deleteChatSessionAction, updateChatSessionContextAction, generateImageAction } from '@/app/actions';
import { ChatSession, RealInterview, SimulationSession, Persona, GuideBlock } from '@/lib/types';
import TextareaAutosize from 'react-textarea-autosize';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

interface Message {
    role: 'user' | 'model';
    text: string;
    attachments?: { name: string; type: 'image' | 'file'; data?: string }[];
}

interface Props {
    projectId: string;
    studyId: string;
    initialSessions: ChatSession[];
    interviews: RealInterview[];
    simulations: SimulationSession[];
    personas: Persona[];
    discussionGuide: GuideBlock[];
}

export function StudyAIChat({ projectId, studyId, initialSessions, interviews, simulations, personas }: Props) {
    const [sessions, setSessions] = useState<ChatSession[]>(initialSessions);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(initialSessions.length > 0 ? initialSessions[initialSessions.length - 1].id : null);

    // Default to all selected or session defaults
    const [selectedContextIds, setSelectedContextIds] = useState<Set<string>>(new Set());

    // Initialize tags when session changes
    useEffect(() => {
        if (activeSessionId) {
            const currentSession = sessions.find(s => s.id === activeSessionId);
            if (currentSession && currentSession.selectedContextIds) {
                setSelectedContextIds(new Set(currentSession.selectedContextIds));
            } else {
                // Default fallback if no saved context
                setSelectedContextIds(new Set([
                    ...interviews.map(i => i.id),
                    ...simulations.map(s => s.id),
                    'guide'
                ]));
            }
        }
    }, [activeSessionId, sessions]);

    // Attachments State
    const [attachments, setAttachments] = useState<{ file: File; preview?: string }[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [input, setInput] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [modelType, setModelType] = useState<'flash' | 'pro'>('flash');
    const bottomRef = useRef<HTMLDivElement>(null);

    // Get current session and messages
    const activeSession = sessions.find(s => s.id === activeSessionId);
    const messages = activeSession?.messages || [];

    // Auto-create session if none exists
    useEffect(() => {
        if (sessions.length === 0 && !activeSessionId) {
            handleNewChat();
        }
    }, []);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, activeSessionId]);

    const handleNewChat = async () => {
        setIsGenerating(true);
        try {
            const newSession = await createChatSessionAction(projectId, studyId);
            setSessions(prev => [...prev, newSession]);
            setActiveSessionId(newSession.id);
        } catch (error) {
            console.error("Failed to create chat session", error);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('정말 이 대화를 삭제하시겠습니까?')) return;

        try {
            await deleteChatSessionAction(projectId, studyId, sessionId);
            setSessions(prev => prev.filter(s => s.id !== sessionId));
            if (activeSessionId === sessionId) {
                setActiveSessionId(null);
            }
        } catch (error) {
            console.error("Failed to delete session", error);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newAttachments = Array.from(e.target.files).map(file => ({
                file,
                preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
            }));
            setAttachments(prev => [...prev, ...newAttachments]);
        }
        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const convertFileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
        });
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;
        const newAttachments: { file: File; preview?: string }[] = [];

        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const file = items[i].getAsFile();
                if (file) {
                    newAttachments.push({
                        file,
                        preview: URL.createObjectURL(file)
                    });
                }
            }
        }

        if (newAttachments.length > 0) {
            e.preventDefault(); // Prevent default paste if we handled it as attachment
            setAttachments(prev => [...prev, ...newAttachments]);
        }
    };

    const handleSend = async () => {
        const messageText = activeCommand ? `${activeCommand} ${input}` : input;

        if ((!messageText.trim() && attachments.length === 0) || isGenerating || !activeSessionId) return;

        const userMsg = messageText.trim();
        const currentAttachments = [...attachments]; // Capture current state
        setInput('');
        setAttachments([]);
        setActiveCommand(null); // Reset command mode

        // Slash Command Detection: /image or /이미지 or /그려줘
        if (userMsg.startsWith('/image ') || userMsg.startsWith('/이미지 ') || userMsg.startsWith('/그려줘 ')) {
            const prompt = userMsg.replace(/^\/(image|이미지|그려줘)\s+/, '');

            // Add user message to UI immediately
            setSessions(prev => prev.map(s =>
                s.id === activeSessionId
                    ? {
                        ...s,
                        messages: [...s.messages, { role: 'user', text: userMsg }],
                        updatedAt: new Date().toISOString()
                    }
                    : s
            ));

            setIsGenerating(true);

            try {
                // Call Image Generation Action
                const imageBase64 = await generateImageAction(prompt);

                if (imageBase64) {
                    const imageAttachment = {
                        name: 'Generated Image',
                        type: 'image' as const,
                        data: `data:image/png;base64,${imageBase64}`
                    };

                    setSessions(prev => prev.map(s =>
                        s.id === activeSessionId
                            ? {
                                ...s,
                                messages: [...s.messages, {
                                    role: 'model',
                                    text: `"${prompt}"에 대한 이미지를 생성했습니다.`,
                                    attachments: [imageAttachment]
                                }],
                                updatedAt: new Date().toISOString()
                            }
                            : s
                    ));
                } else {
                    setSessions(prev => prev.map(s =>
                        s.id === activeSessionId
                            ? { ...s, messages: [...s.messages, { role: 'model', text: '죄송합니다. 이미지 생성에 실패했습니다.' }] }
                            : s
                    ));
                }

            } catch (err) {
                console.error("Image Gen Error", err);
                setSessions(prev => prev.map(s =>
                    s.id === activeSessionId
                        ? { ...s, messages: [...s.messages, { role: 'model', text: '이미지 생성 중 오류가 발생했습니다.' }] }
                        : s
                ));
            } finally {
                setIsGenerating(false);
            }
            return; // Stop here, don't do normal chat
        }

        // Prepare attachments for Display (Optimistic)
        const displayAttachments = currentAttachments.map(att => ({
            name: att.file.name,
            type: att.file.type.startsWith('image/') ? 'image' as const : 'file' as const,
            data: att.preview // Use preview blob for immediate display if image
        }));

        // Optimistic Update
        setSessions(prev => prev.map(s =>
            s.id === activeSessionId
                ? {
                    ...s,
                    messages: [...s.messages, { role: 'user', text: userMsg, attachments: displayAttachments }],
                    updatedAt: new Date().toISOString()
                }
                : s
        ));

        setIsGenerating(true);

        try {
            // Convert files to Base64 for Server Action
            const payloadAttachments = await Promise.all(currentAttachments.map(async (att) => ({
                name: att.file.name,
                type: att.file.type.startsWith('image/') ? 'image' as const : 'file' as const,
                data: await convertFileToBase64(att.file)
            })));

            const history = messages.map(m => ({ role: m.role, text: m.text }));
            const response = await chatWithStudyAction(
                projectId,
                studyId,
                activeSessionId,
                history,
                userMsg,
                modelType,
                Array.from(selectedContextIds),
                payloadAttachments
            );

            setSessions(prev => prev.map(s =>
                s.id === activeSessionId
                    ? { ...s, messages: [...s.messages, { role: 'model', text: response }], updatedAt: new Date().toISOString() }
                    : s
            ));
        } catch (error) {
            console.error(error);
            setSessions(prev => prev.map(s =>
                s.id === activeSessionId
                    ? { ...s, messages: [...s.messages, { role: 'model', text: '죄송합니다. 오류가 발생했습니다.' }] }
                    : s
            ));
        } finally {
            setIsGenerating(false);
        }
    };

    const toggleContext = async (id: string) => {
        const newSet = new Set(selectedContextIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedContextIds(newSet);

        // Persist change
        if (activeSessionId) {
            await updateChatSessionContextAction(projectId, studyId, activeSessionId, Array.from(newSet));
            setSessions(prev => prev.map(s =>
                s.id === activeSessionId
                    ? { ...s, selectedContextIds: Array.from(newSet) }
                    : s
            ));
        }
    };

    // Format date for history sidebar
    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
    };

    const getPersonaName = (personaId: string) => {
        const persona = personas.find(p => p.id === personaId);
        return persona ? persona.name : 'Unknown';
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert('복사되었습니다!');
    };

    const [activeCommand, setActiveCommand] = useState<string | null>(null);
    const [showCommandMenu, setShowCommandMenu] = useState(false);
    const [selectedCommandIndex, setSelectedCommandIndex] = useState(0); // Added for keyboard nav
    const [isDragging, setIsDragging] = useState(false);
    const commandMenuRef = useRef<HTMLDivElement>(null);

    const onDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const onDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setIsDragging(false);
    };

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const files = Array.from(e.dataTransfer.files);
            const newAttachments = files.map(file => ({
                file,
                preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
            }));
            setAttachments(prev => [...prev, ...newAttachments]);
        }
    };

    const commands = [
        { label: '/이미지', description: '이미지 생성하기', icon: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg> }
    ];

    // Close command menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (commandMenuRef.current && !commandMenuRef.current.contains(event.target as Node)) {
                setShowCommandMenu(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Reset selection when menu opens
    useEffect(() => {
        if (showCommandMenu) {
            setSelectedCommandIndex(0);
        }
    }, [showCommandMenu]);

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;

        // Check for command trigger if not already in command mode
        if (!activeCommand) {
            if (val === '/') {
                setShowCommandMenu(true);
            } else if (val === '' || !val.startsWith('/')) {
                setShowCommandMenu(false);
            }

            // Auto-detect command typing (e.g. user types "/그려줘 " manually)
            if (val === '/그려줘 ' || val === '/image ' || val === '/이미지 ') {
                setActiveCommand('/이미지');
                setInput('');
                setShowCommandMenu(false);
                return;
            }
        }

        setInput(val);
    };

    const selectCommand = (command: string) => {
        setActiveCommand(command);
        setInput('');
        setShowCommandMenu(false);
        // Focus back to textarea
    };

    return (
        <div className="flex h-[650px] bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Sidebar: Session History */}
            <div className="w-[220px] bg-slate-50 border-r border-slate-200 flex flex-col">
                <div className="p-3 border-b border-slate-200">
                    <button
                        onClick={handleNewChat}
                        className="w-full bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50 font-bold text-xs py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm"
                    >
                        <span>+</span> 새 대화 시작
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {[...sessions].reverse().map(session => (
                        <div
                            key={session.id}
                            onClick={() => setActiveSessionId(session.id)}
                            className={`group w-full text-left p-3 rounded-lg text-xs transition-all relative cursor-pointer ${activeSessionId === session.id
                                ? 'bg-white border-slate-200 shadow-sm ring-1 ring-slate-200'
                                : 'hover:bg-slate-100 border border-transparent'
                                }`}
                        >
                            <div className={`font-bold mb-1 pr-4 ${activeSessionId === session.id ? 'text-slate-800' : 'text-slate-600'}`}>
                                {session.messages.filter(m => m.role === 'user')[0]?.text.slice(0, 15) || '새로운 대화'}...
                            </div>
                            <div className="text-slate-400 text-[10px]">
                                {formatDate(session.updatedAt || session.createdAt)}
                            </div>

                            {/* Delete Button (Visible on Hover) */}
                            <button
                                onClick={(e) => handleDeleteSession(session.id, e)}
                                className="absolute top-2 right-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                title="대화 삭제"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Chat Area */}
            <div
                className="flex-1 flex flex-col min-w-0 relative"
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
            >
                {/* Drag Overlay */}
                {isDragging && (
                    <div className="absolute inset-0 z-50 bg-indigo-50/90 backdrop-blur-sm border-2 border-dashed border-indigo-400 m-2 rounded-xl flex flex-col items-center justify-center text-indigo-600 animate-in fade-in duration-200 pointer-events-none">
                        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-4"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                        <p className="text-xl font-bold">여기에 파일을 놓으세요</p>
                    </div>
                )}
                {/* Header */}
                <div className="bg-white border-b border-slate-200 p-4 flex justify-between items-center z-10">
                    <div className="flex items-center gap-2">
                        <span className="text-xl">🤝</span>
                        <h3 className="font-bold text-slate-800">인터뷰 도우미</h3>
                    </div>

                    {/* Model Selector */}
                    <div className="flex bg-slate-50 rounded-lg border border-slate-200 p-1">
                        <button
                            onClick={() => setModelType('flash')}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${modelType === 'flash'
                                ? 'bg-white text-indigo-700 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            ⚡️ Flash
                        </button>
                        <button
                            onClick={() => setModelType('pro')}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${modelType === 'pro'
                                ? 'bg-white text-purple-700 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            🧠 Pro
                        </button>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-5 bg-slate-50">
                    {messages.length === 0 && !isGenerating && (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                            <span className="text-4xl text-slate-200">💭</span>
                            <p className="text-sm">대화를 시작해보세요!</p>
                        </div>
                    )}

                    {messages.map((msg, i) => (
                        <div key={i} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'user' ? (
                                <div className="max-w-[85%] bg-indigo-600 text-white px-4 py-3 rounded-2xl rounded-br-none shadow-sm text-sm leading-relaxed whitespace-pre-wrap">
                                    {msg.attachments && msg.attachments.length > 0 && (
                                        <div className="mb-2 flex flex-wrap gap-2">
                                            {msg.attachments.map((att, idx) => (
                                                <div key={idx} className="bg-white/20 rounded-lg p-2 flex items-center gap-2 max-w-full overflow-hidden">
                                                    {att.type === 'image' ? (
                                                        <div className="w-12 h-12 bg-black/20 rounded relative flex-shrink-0 overflow-hidden">
                                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                                            <img src={att.data || att.url} alt={att.name} className="w-full h-full object-cover" />
                                                        </div>
                                                    ) : (
                                                        <div className="w-10 h-10 bg-white/20 rounded flex items-center justify-center flex-shrink-0">
                                                            <span className="text-lg">📄</span>
                                                        </div>
                                                    )}
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="text-xs truncate font-medium">{att.name}</span>
                                                        <span className="text-[10px] opacity-70 uppercase">{att.type}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {/* Slash Command Rendering */}
                                    {(msg.text.startsWith('/image ') || msg.text.startsWith('/그려줘 ') || msg.text.startsWith('/이미지 ')) ? (
                                        <div className="flex flex-col gap-1">
                                            <span className="inline-flex self-start items-center gap-1 bg-white/20 dark:bg-black/20 px-2 py-0.5 rounded text-xs font-bold text-indigo-100 uppercase tracking-wide">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                                                {msg.text.split(' ')[0]}
                                            </span>
                                            <span>{msg.text.substring(msg.text.indexOf(' ') + 1)}</span>
                                        </div>
                                    ) : (
                                        msg.text
                                    )}
                                </div>
                            ) : (
                                <div className="max-w-[85%] bg-white border border-slate-200 rounded-2xl rounded-bl-none shadow-sm group overflow-hidden">
                                    {msg.attachments && msg.attachments.length > 0 && (
                                        <div className="p-2 pb-0 flex flex-wrap gap-2">
                                            {msg.attachments.map((att, idx) => (
                                                <div key={idx} className="bg-slate-50 rounded-lg border border-slate-100 p-1 flex flex-col gap-2 max-w-full">
                                                    {att.type === 'image' ? (
                                                        <div className="relative rounded overflow-hidden">
                                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                                            <img
                                                                src={att.data || att.url}
                                                                alt={att.name}
                                                                className="max-w-full h-auto max-h-[400px] object-contain rounded bg-checkerboard"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="w-10 h-10 bg-white/20 rounded flex items-center justify-center flex-shrink-0">
                                                            <span className="text-lg">📄</span>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <div className="px-5 py-4 text-sm text-slate-800 prose prose-slate prose-sm max-w-none prose-headings:font-bold prose-h1:text-lg prose-h2:text-base prose-h3:text-sm prose-p:leading-relaxed prose-pre:bg-slate-100 prose-pre:text-slate-700">
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                            rehypePlugins={[rehypeRaw]}
                                        >
                                            {msg.text}
                                        </ReactMarkdown>
                                    </div>
                                    <div className="px-2 py-1 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity border-t border-slate-50">
                                        <button
                                            onClick={() => copyToClipboard(msg.text)}
                                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-md transition-colors text-xs flex items-center gap-1"
                                            title="답변 복사"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                            </svg>
                                            <span className="font-medium">복사</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                    {isGenerating && (
                        <div className="flex justify-start">
                            <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-none px-4 py-3 text-sm text-slate-500 shadow-sm animate-pulse flex items-center gap-2">
                                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></span>
                                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                            </div>
                        </div>
                    )}
                    <div ref={bottomRef} />
                </div>

                {/* Input Controls */}
                <div className="bg-white border-t border-slate-200 flex flex-col relative">
                    {/* Command Menu Popup */}
                    {showCommandMenu && (
                        <div
                            ref={commandMenuRef}
                            className="absolute bottom-full left-4 mb-2 w-64 bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden z-20 animate-in fade-in slide-in-from-bottom-2 duration-200"
                        >
                            <div className="bg-slate-50 px-3 py-2 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                명령어 추천
                            </div>
                            <div className="p-1">
                                {commands.map((cmd, idx) => (
                                    <button
                                        key={cmd.label}
                                        onClick={() => selectCommand(cmd.label)}
                                        onMouseEnter={() => setSelectedCommandIndex(idx)}
                                        className={`w-full text-left px-3 py-2 rounded-md flex items-center gap-2 transition-colors group ${selectedCommandIndex === idx ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-indigo-50 hover:text-indigo-700'
                                            }`}
                                    >
                                        <div className={`w-6 h-6 rounded flex items-center justify-center ${selectedCommandIndex === idx ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600'
                                            }`}>
                                            {cmd.icon}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold">{cmd.label}</span>
                                            <span className="text-[10px] opacity-70">{cmd.description}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Context Selector (Wrapped) */}
                    <div className="border-b border-slate-100 p-3 flex flex-wrap items-center gap-2 px-4 bg-slate-50/50">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">Context:</span>
                        <button
                            key="guide"
                            onClick={() => toggleContext('guide')}
                            className={`text-[11px] px-2.5 py-1 rounded-full border transition-all ${selectedContextIds.has('guide')
                                ? 'bg-amber-50 border-amber-200 text-amber-700 font-bold shadow-sm'
                                : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                                }`}
                        >
                            📝 인터뷰 가이드
                        </button>
                        {interviews.map((interview, idx) => {
                            let displayName = `🎤 ${interview.title}`;
                            const persona = interview.participantId ? personas.find(p => p.id === interview.participantId) : null;
                            if (persona) {
                                displayName = `🎤 ${idx + 1}. ${persona.name}`;
                            }

                            return (
                                <button
                                    key={interview.id}
                                    onClick={() => toggleContext(interview.id)}
                                    className={`text-[11px] px-2.5 py-1 rounded-full border transition-all ${selectedContextIds.has(interview.id)
                                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-bold shadow-sm'
                                        : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                                        }`}
                                >
                                    {displayName}
                                </button>
                            );
                        })}
                        {simulations.map(sim => (
                            <button
                                key={sim.id}
                                onClick={() => toggleContext(sim.id)}
                                className={`text-[11px] px-2.5 py-1 rounded-full border transition-all ${selectedContextIds.has(sim.id)
                                    ? 'bg-purple-50 border-purple-200 text-purple-700 font-bold shadow-sm'
                                    : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                                    }`}
                            >
                                🤖 Sim: {getPersonaName(sim.personaId)}
                            </button>
                        ))}
                    </div>

                    {/* Text Input */}
                    <div className="p-4 bg-slate-50 border-t border-slate-100">
                        {/* Attachments Preview */}
                        {attachments.length > 0 && (
                            <div className="flex gap-2 mb-2 p-2 overflow-x-auto">
                                {attachments.map((att, idx) => (
                                    <div key={idx} className="relative group bg-white border border-slate-200 rounded-lg p-2 pr-6 flex items-center gap-2 shadow-sm">
                                        {att.file.type.startsWith('image/') ? (
                                            <div className="w-10 h-10 bg-slate-100 rounded overflow-hidden">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src={att.preview} alt="preview" className="w-full h-full object-cover" />
                                            </div>
                                        ) : (
                                            <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded flex items-center justify-center">
                                                <span className="text-lg">📄</span>
                                            </div>
                                        )}
                                        <div className="flex flex-col max-w-[120px]">
                                            <span className="text-xs truncate font-medium text-slate-700">{att.file.name}</span>
                                            <span className="text-[10px] text-slate-400">{(att.file.size / 1024).toFixed(1)}KB</span>
                                        </div>
                                        <button
                                            onClick={() => removeAttachment(idx)}
                                            className="absolute top-1 right-1 text-slate-400 hover:text-red-500 bg-white rounded-full p-0.5 hover:bg-slate-50"
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="relative flex items-end gap-2 bg-white border border-slate-200 rounded-xl p-2 shadow-sm focus-within:ring-2 focus-within:ring-indigo-100 focus-within:border-indigo-400 transition-all">
                            {/* File Input */}
                            <input
                                type="file"
                                multiple
                                accept="image/*,.pdf,.docx,.txt"
                                ref={fileInputRef}
                                className="hidden"
                                onChange={handleFileSelect}
                            />

                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex-shrink-0 mb-1"
                                title="파일 첨부"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                                </svg>
                            </button>

                            {/* Active Command Tag */}
                            {activeCommand && (
                                <div className="flex-shrink-0 flex items-center gap-1 bg-indigo-50 border border-indigo-100 text-indigo-600 px-2 py-1 rounded-md mb-1.5 animate-in fade-in zoom-in duration-200">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                                    <span className="text-xs font-bold">{activeCommand}</span>
                                    <button
                                        onClick={() => setActiveCommand(null)}
                                        className="ml-1 hover:text-red-500 rounded-full hover:bg-red-50 p-0.5 transition-colors"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                    </button>
                                </div>
                            )}

                            <TextareaAutosize
                                minRows={1}
                                maxRows={5}
                                placeholder={activeCommand ? "어떤 이미지를 생성할까요?" : (attachments.length > 0 ? "파일에 대해 질문하세요..." : "/ (슬래시)를 입력하여 명령어 확인...")}
                                className="w-full bg-transparent border-none text-sm outline-none px-2 py-2.5 resize-none text-slate-700 placeholder:text-slate-400 leading-relaxed"
                                value={input}
                                onChange={handleInputChange}
                                onPaste={handlePaste}
                                onKeyDown={(e) => {
                                    if (showCommandMenu) {
                                        if (e.key === 'ArrowUp') {
                                            e.preventDefault();
                                            setSelectedCommandIndex(prev => Math.max(0, prev - 1));
                                            return;
                                        }
                                        if (e.key === 'ArrowDown') {
                                            e.preventDefault();
                                            setSelectedCommandIndex(prev => Math.min(commands.length - 1, prev + 1));
                                            return;
                                        }
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            selectCommand(commands[selectedCommandIndex].label);
                                            return;
                                        }
                                    }

                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend();
                                    }
                                    if (e.key === 'Escape') {
                                        setShowCommandMenu(false);
                                    }
                                    if (e.key === 'Backspace' && input === '' && activeCommand) {
                                        setActiveCommand(null);
                                    }
                                }}
                            />

                            <button
                                onClick={handleSend}
                                disabled={(!input.trim() && attachments.length === 0) || isGenerating}
                                className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-colors shadow-sm flex-shrink-0 mb-1"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="22" y1="2" x2="11" y2="13"></line>
                                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
