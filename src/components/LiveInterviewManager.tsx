'use client';

import { useState, useRef, useEffect } from 'react';
import { GuideBlock, Persona } from '@/lib/types';
import { LiveAudioRecorder } from './LiveAudioRecorder';
import { uploadLiveInterviewAction } from '@/app/actions';
import { useRouter } from 'next/navigation';
import TextareaAutosize from 'react-textarea-autosize';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
    projectId: string;
    studyId: string;
    guideBlocks: GuideBlock[];
    projectName: string;
    personas: Persona[];
}

export default function LiveInterviewManager({ projectId, studyId, guideBlocks, projectName, personas }: Props) {
    const router = useRouter();
    const [status, setStatus] = useState<'idle' | 'recording' | 'paused' | 'stopped'>('idle');
    const [activeTab, setActiveTab] = useState<'guide' | 'persona'>('guide');
    const [participantId, setParticipantId] = useState<string>('new');
    const [elapsedTime, setElapsedTime] = useState(0);
    const [blocks, setBlocks] = useState<GuideBlock[]>(guideBlocks);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Media Logic
    const [stream, setStream] = useState<MediaStream | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    // Time Tracking
    const startTimeRef = useRef<string | null>(null);

    // Note State: map blockId to string note
    const [notes, setNotes] = useState<Record<string, string>>({});
    const [isSaving, setIsSaving] = useState(false);

    // Timer Logic
    useEffect(() => {
        if (status === 'recording') {
            timerRef.current = setInterval(() => {
                setElapsedTime(prev => prev + 1);
            }, 1000);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [status]);

    const startRecording = async () => {
        try {
            const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setStream(audioStream);

            const mediaRecorder = new MediaRecorder(audioStream);
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorder.start(100);
            startTimeRef.current = new Date().toISOString();
            setStatus('recording');
        } catch (err) {
            console.error('Error accessing microphone:', err);
            alert('마이크 접근 권한이 필요합니다.');
        }
    };

    const togglePause = () => {
        if (!mediaRecorderRef.current) return;
        if (mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.pause();
            setStatus('paused');
        } else if (mediaRecorderRef.current.state === 'paused') {
            mediaRecorderRef.current.resume();
            setStatus('recording');
        }
    };

    const handleNoteChange = (blockId: string, text: string) => {
        setNotes(prev => ({
            ...prev,
            [blockId]: text
        }));
    };

    const handleAddQuestion = (index: number) => {
        const newBlock: GuideBlock = {
            id: `temp-${Date.now()}`,
            type: 'question',
            content: '새로운 질문'
        };

        const newBlocks = [...blocks];
        newBlocks.splice(index + 1, 0, newBlock);

        // Update order for subsequent blocks if needed, strictly speaking not needed for just rendering
        // but good practice if we were saving back to DB. For live session, just array order matters.

        setBlocks(newBlocks);

        // Auto focus logic could go here if we had ref to the new textarea
        setBlocks(newBlocks);

        // Auto focus logic could go here if we had ref to the new textarea
    };

    const handleDeleteBlock = (index: number) => {
        if (!confirm('정말 이 항목을 삭제하시겠습니까? 작성된 메모도 함께 사라집니다.')) return;

        const newBlocks = [...blocks];
        // Optional: Remove associated note from state if we want to be clean, 
        // but keeping it doesn't hurt (garbage collection not critical here)
        newBlocks.splice(index, 1);
        setBlocks(newBlocks);
    };

    const handleFinish = async () => {
        // Allow saving if there are notes even if no recording
        const hasNotes = Object.keys(notes).some(k => notes[k].trim().length > 0);
        if (status === 'idle' && !hasNotes && chunksRef.current.length === 0) {
            alert('녹음 내역이나 작성된 메모가 없습니다.');
            return;
        }

        if (status === 'recording' || status === 'paused') {
            if (!confirm('녹음을 종료하고 저장하시겠습니까?')) return;

            // Generate Blob immediately
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
                // Wait for onstop or just use chunks? MediaRecorder onstop is async.
                // We need to wrap this in a promise to ensure we get the final blob.

                await new Promise<void>((resolve) => {
                    if (!mediaRecorderRef.current) return resolve();
                    if (mediaRecorderRef.current.state === 'inactive') return resolve(); // Already stopped
                    mediaRecorderRef.current.onstop = () => {
                        // Stop tracks
                        stream?.getTracks().forEach(track => track.stop());
                        resolve();
                    };
                });
            }
        }

        setIsSaving(true);
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const endTime = new Date().toISOString();

        try {
            const formData = new FormData();
            const file = new File([blob], `recording-${Date.now()}.webm`, { type: 'audio/webm' });
            formData.append('audioFile', file);
            formData.append('notes', JSON.stringify(notes));
            formData.append('participantId', participantId);

            // Pass Start/End time
            if (startTimeRef.current) formData.append('startTime', startTimeRef.current);
            formData.append('endTime', endTime);
            formData.append('duration', elapsedTime.toString());

            const newInterviewId = await uploadLiveInterviewAction(projectId, studyId, formData);
            if (newInterviewId) {
                router.push(`/projects/${projectId}/studies/${studyId}/interview/${newInterviewId}`);
            } else {
                router.push(`/projects/${projectId}/studies/${studyId}`);
            }
        } catch (error) {
            console.error(error);
            alert('저장 중 오류가 발생했습니다.');
            setIsSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            {/* Header / Recorder Bar */}
            <div className="bg-white border-b border-slate-200 p-4 sticky top-0 z-50 shadow-md">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div>
                        <h1 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                            Live Interview
                        </h1>
                        <p className="text-xs text-slate-500 font-medium">{projectName}</p>
                    </div>

                    <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-4">
                        {status === 'idle' ? (
                            <button
                                onClick={startRecording}
                                className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-full font-bold shadow-lg shadow-red-200 transition-all hover:scale-105"
                            >
                                <div className="w-3 h-3 rounded-full bg-white animate-pulse"></div>
                                녹음 시작
                            </button>
                        ) : (
                            <LiveAudioRecorder
                                status={status}
                                elapsedTime={elapsedTime}
                                togglePause={togglePause}
                                audioStream={stream}
                            />
                        )}
                    </div>

                    <button
                        onClick={handleFinish}
                        disabled={isSaving}
                        className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-black text-sm hover:bg-slate-800 disabled:opacity-50 transition shadow-lg"
                    >
                        {isSaving ? '저장 중...' : '종료 및 저장'}
                    </button>
                </div>
            </div>

            {/* Guide Content */}
            <div className="flex-1 max-w-6xl mx-auto w-full p-8 pb-32">

                {/* Tabs */}
                <div className="flex gap-2 mb-6">
                    <button
                        onClick={() => setActiveTab('guide')}
                        className={`px-5 py-2.5 rounded-full font-bold text-sm transition-all ${activeTab === 'guide' ? 'bg-slate-900 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-100'}`}
                    >
                        📄 인터뷰 가이드
                    </button>
                    <button
                        onClick={() => setActiveTab('persona')}
                        className={`px-5 py-2.5 rounded-full font-bold text-sm transition-all ${activeTab === 'persona' ? 'bg-slate-900 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-100'}`}
                    >
                        👤 대상자 설정
                    </button>
                </div>

                {activeTab === 'guide' ? (
                    <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 p-10 min-h-full">
                        <h2 className="text-2xl font-black text-slate-800 mb-8 border-b border-slate-100 pb-4">인터뷰 가이드</h2>

                        <div className="space-y-8">
                            {blocks.length === 0 && <p className="text-slate-400 text-center py-10">가이드 내용이 없습니다. 먼저 가이드를 작성해주세요.</p>}

                            {blocks.map((block, index) => (
                                <div key={block.id} className="group relative">
                                    {/* Hover Zone for Adding Question */}
                                    <div className="absolute -bottom-6 left-0 w-full h-8 flex items-center justify-center opacity-0 hover:opacity-100 z-10 transition-opacity cursor-pointer group/add">
                                        <div className="w-full h-px bg-indigo-100 absolute top-1/2 left-0 group-hover/add:bg-indigo-300 transition-colors"></div>
                                        <button
                                            onClick={() => handleAddQuestion(index)}
                                            className="bg-indigo-50 text-indigo-600 border border-indigo-200 text-xs font-bold px-3 py-1 rounded-full shadow-sm hover:bg-indigo-600 hover:text-white transition-all relative z-20 flex items-center gap-1"
                                        >
                                            <span>+</span> 질문 추가
                                        </button>
                                    </div>

                                    {block.type === 'section' && (
                                        <div className="mt-12 mb-6 flex items-center gap-3">
                                            <div className="h-px bg-slate-200 flex-1"></div>
                                            <h3 className="text-lg font-black text-slate-800 bg-slate-100 px-4 py-1.5 rounded-lg border border-slate-200">
                                                {block.content}
                                            </h3>
                                            <div className="h-px bg-slate-200 flex-1"></div>
                                        </div>
                                    )}

                                    {block.type === 'script' && (
                                        <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100 text-slate-700 font-medium leading-relaxed my-4 relative overflow-hidden [&>p]:mb-4 last:[&>p]:mb-0 group/block">
                                            <button
                                                onClick={() => handleDeleteBlock(index)}
                                                className="absolute top-2 right-2 text-amber-300 hover:text-red-500 p-1 rounded hover:bg-amber-100 transition opacity-0 group-hover/block:opacity-100 z-10"
                                                title="삭제"
                                            >
                                                🗑️
                                            </button>
                                            <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-300"></div>
                                            <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest block mb-2">Script</span>
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    strong: ({ node, ...props }) => <span className="font-extrabold" {...props} />
                                                }}
                                            >
                                                {block.content.replace(/\n/g, '\n\n')}
                                            </ReactMarkdown>
                                        </div>
                                    )}

                                    {block.type === 'question' && (
                                        <div className="py-4 group/block relative">
                                            <button
                                                onClick={() => handleDeleteBlock(index)}
                                                className="absolute top-0 right-0 text-slate-300 hover:text-red-500 p-1.5 rounded-full hover:bg-red-50 transition opacity-0 group-hover/block:opacity-100"
                                                title="질문 삭제"
                                            >
                                                🗑️
                                            </button>
                                            <div className="flex gap-4 mb-4">
                                                <span className="text-xl font-black text-indigo-600 shrink-0">Q.</span>
                                                <div className="w-full">
                                                    <TextareaAutosize
                                                        value={block.content}
                                                        onChange={(e) => {
                                                            const newBlocks = [...blocks];
                                                            newBlocks[index].content = e.target.value;
                                                            setBlocks(newBlocks);
                                                        }}
                                                        placeholder="질문 내용을 입력하세요"
                                                        className="w-full text-lg font-bold text-slate-900 bg-transparent outline-none resize-none placeholder:text-slate-300 border border-transparent hover:border-slate-200 focus:border-indigo-300 rounded-lg p-1 -ml-1 transition-all"
                                                    />
                                                </div>
                                            </div>

                                            {/* Note Taking Area */}
                                            <div className="ml-9">
                                                <div className={`transition-all duration-300 border-2 rounded-2xl overflow-hidden bg-slate-50 focus-within:bg-white focus-within:border-indigo-500 focus-within:shadow-indigo-100 focus-within:shadow-lg ${notes[block.id] ? 'border-indigo-200 bg-white' : 'border-dashed border-slate-200 hover:border-slate-300'}`}>
                                                    <TextareaAutosize
                                                        minRows={2}
                                                        placeholder="메모 작성하기..."
                                                        className="w-full p-4 bg-transparent outline-none text-slate-700 font-medium resize-none placeholder:text-slate-400 text-sm leading-relaxed"
                                                        value={notes[block.id] || ''}
                                                        onChange={(e) => handleNoteChange(block.id, e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}

                            {/* Final Add Button at the very end */}
                            <div className="h-8 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer group/add">
                                <div className="w-full h-px bg-indigo-100 absolute top-1/2 left-0 group-hover/add:bg-indigo-300 transition-colors"></div>
                                <button
                                    onClick={() => handleAddQuestion(blocks.length - 1)}
                                    className="bg-indigo-50 text-indigo-600 border border-indigo-200 text-xs font-bold px-3 py-1 rounded-full shadow-sm hover:bg-indigo-600 hover:text-white transition-all relative z-20 flex items-center gap-1"
                                >
                                    <span>+</span> 질문 추가
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 p-10 min-h-full">
                        <h2 className="text-2xl font-black text-slate-800 mb-8 border-b border-slate-100 pb-4">인터뷰 대상자 설정</h2>
                        <div className="space-y-6">
                            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                <label className="block text-sm font-black text-slate-500 mb-4 uppercase tracking-wider">👤 인터뷰 대상자 (Persona)</label>
                                <select
                                    value={participantId}
                                    onChange={(e) => setParticipantId(e.target.value)}
                                    className="w-full p-4 border border-slate-200 rounded-xl text-base font-bold bg-white focus:ring-4 ring-brand-100 outline-none transition-all cursor-pointer"
                                >
                                    <option value="new">✨ 이 인터뷰이를 새 페르소나로 등록 (분석 기반)</option>
                                    <optgroup label="기존 페르소나 선택">
                                        {personas.filter(p => p.source === 'real').map(p => (
                                            <option key={p.id} value={p.id}>
                                                👤 {p.name} ({p.role})
                                            </option>
                                        ))}
                                    </optgroup>
                                </select>
                                <p className="text-sm text-slate-500 mt-4 leading-relaxed">
                                    * <strong>새로운 페르소나 생성</strong>: 인터뷰 내용을 바탕으로 AI가 자동으로 페르소나를 생성합니다.<br />
                                    * <strong>기존 페르소나 선택</strong>: 선택한 페르소나에 이번 인터뷰 내용이 추가되어 정보가 업데이트됩니다.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
