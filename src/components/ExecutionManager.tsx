'use client';

import { useState, useEffect, useId } from 'react';
import { formatDate } from '@/lib/date-utils';


import { uploadTranscriptAction, deleteInterviewAction, updateInterviewMetadataAction, createPersonaFromInterviewAction, updateInterviewTitleAction, uploadInterviewVideoAction, uploadInterviewAudioAction, updateStudySessionsOrderAction, linkPersonaToInterviewAction } from '@/app/actions';
import { RealInterview, StructuredInsight } from '@/lib/types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { uploadFileWithTus } from '@/lib/tus-upload';

import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Persona } from '@/lib/types';

interface Props {
    projectId: string;
    studyId: string;
    interviews: RealInterview[];
    personas: Persona[];
}

export function ExecutionManager({ projectId, studyId, interviews: initialInterviews, personas }: Props) {
    const router = useRouter();
    const [interviews, setInterviews] = useState(initialInterviews);

    useEffect(() => {
        setInterviews(initialInterviews);
    }, [initialInterviews]);

    const [addMode, setAddMode] = useState<'select' | 'upload' | null>(null);
    const [textFile, setTextFile] = useState<File | null>(null);
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [participantId, setParticipantId] = useState<string>('new');

    // Editing States
    const [editingDateId, setEditingDateId] = useState<string | null>(null);
    const [syncingId, setSyncingId] = useState<string | null>(null);

    // New Interview Metadata States
    const [interviewDate, setInterviewDate] = useState(new Date().toISOString().split('T')[0]);
    const [startTime, setStartTime] = useState('10:00');
    const [endTime, setEndTime] = useState('11:00');

    // Editing Metadata Temp State
    const [tempMetadata, setTempMetadata] = useState<{ date: string; startTime: string; endTime: string } | null>(null);

    const handleAdd = async () => {
        setLoading(true);
        try {
            if (!textFile && !audioFile && !videoFile) return;

            const formData = new FormData();
            if (textFile) formData.append('file_text', textFile);

            if (audioFile) {
                const fileName = `${Date.now()}-${audioFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

                // Use TUS for files > 6MB, otherwise standard upload
                if (audioFile.size > 6 * 1024 * 1024) {
                    setUploadProgress(0);
                    const publicUrl = await uploadFileWithTus('uploads', audioFile, fileName, (p) => setUploadProgress(p));
                    formData.append('audio_url', publicUrl);
                } else {
                    const { error } = await supabase.storage.from('uploads').upload(fileName, audioFile, { upsert: true });
                    if (error) throw new Error("음성 파일 업로드 실패: " + error.message);
                    const { data } = supabase.storage.from('uploads').getPublicUrl(fileName);
                    formData.append('audio_url', data.publicUrl);
                }
            }

            if (videoFile) {
                const fileName = `${Date.now()}-${videoFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

                // Use TUS for files > 6MB, otherwise standard upload
                if (videoFile.size > 6 * 1024 * 1024) {
                    setUploadProgress(0);
                    const publicUrl = await uploadFileWithTus('uploads', videoFile, fileName, (p) => setUploadProgress(p));
                    formData.append('video_url', publicUrl);
                } else {
                    const { error } = await supabase.storage.from('uploads').upload(fileName, videoFile, { upsert: true });
                    if (error) throw new Error("동영상 파일 업로드 실패: " + error.message);
                    const { data } = supabase.storage.from('uploads').getPublicUrl(fileName);
                    formData.append('video_url', data.publicUrl);
                }
            }

            formData.append('date', interviewDate);
            formData.append('startTime', startTime);
            formData.append('endTime', endTime);
            formData.append('participantId', participantId);

            // [FIX] Await the returned interview object for immediate UI update
            const newInterview = await uploadTranscriptAction(projectId, studyId, formData);

            if (newInterview) {
                setInterviews(prev => [...prev, newInterview]);
            }

            alert("인터뷰가 성공적으로 추가되었습니다! 페르소나가 새롭게 생성되거나 정보가 업데이트되었습니다.");

            router.refresh(); // Fetch new data from server to be sure

            setAddMode(null);
            setTextFile(null);
            setAudioFile(null);
            setVideoFile(null);
            alert("인터뷰가 성공적으로 추가되었습니다! 페르소나가 새롭게 생성되거나 정보가 업데이트되었습니다.");

            router.refresh(); // Fetch new data from server to be sure

            setAddMode(null);
            setTextFile(null);
            setAudioFile(null);
            setVideoFile(null);
            setParticipantId('new');
            setUploadProgress(null);
        } catch (e: any) {
            setUploadProgress(null);
            if (e.message === 'NEXT_REDIRECT') return;
            console.error("Upload failed in ExecutionManager:", e);
            alert(e.message || "Failed to analyze interview");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (interviewId: string) => {
        if (!confirm('정말 이 인터뷰를 삭제하시겠습니까?')) return;
        try {
            await deleteInterviewAction(projectId, studyId, interviewId);
        } catch (e: any) {
            if (e.message !== 'NEXT_REDIRECT') console.error(e);
        }
    };

    const handleMetadataUpdate = async (interviewId: string, metadata: { date?: string; startTime?: string; endTime?: string }) => {
        try {
            await updateInterviewMetadataAction(projectId, studyId, interviewId, metadata);
            setEditingDateId(null);
        } catch (e: any) {
            if (e.message === 'NEXT_REDIRECT') {
                setEditingDateId(null);
                return;
            }
            console.error(e);
        }
    };


    const handleSyncAudio = async (interviewId: string, file: File) => {
        setSyncingId(interviewId);
        try {
            const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
            let publicUrl = '';

            if (file.size > 6 * 1024 * 1024) {
                publicUrl = await uploadFileWithTus('uploads', file, fileName);
            } else {
                const { error } = await supabase.storage.from('uploads').upload(fileName, file, { upsert: true });
                if (error) throw new Error("음성 파일 업로드 실패: " + error.message);
                const { data } = supabase.storage.from('uploads').getPublicUrl(fileName);
                publicUrl = data.publicUrl;
            }

            const formData = new FormData();
            formData.append('fileUrl', publicUrl);
            await uploadInterviewAudioAction(projectId, studyId, interviewId, formData);
            alert("녹음 파일이 연결되었습니다.");
        } catch (e: any) {
            console.error(e);
            alert("녹음 연결 실패: " + e.message);
        } finally {
            setSyncingId(null);
            setUploadProgress(null);
        }
    };

    const handleSyncVideo = async (interviewId: string, file: File) => {
        setSyncingId(interviewId);
        try {
            const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
            let publicUrl = '';

            if (file.size > 6 * 1024 * 1024) {
                setUploadProgress(0);
                publicUrl = await uploadFileWithTus('uploads', file, fileName, (p) => setUploadProgress(p));
            } else {
                const { error } = await supabase.storage.from('uploads').upload(fileName, file, { upsert: true });
                if (error) throw new Error("비디오 파일 업로드 실패: " + error.message);
                const { data } = supabase.storage.from('uploads').getPublicUrl(fileName);
                publicUrl = data.publicUrl;
            }

            const formData = new FormData();
            formData.append('fileUrl', publicUrl);
            await uploadInterviewVideoAction(projectId, studyId, interviewId, formData);
            alert("비디오 파일이 연결되었습니다.");
        } catch (e: any) {
            console.error(e);
            alert("비디오 연결 실패: " + e.message);
        } finally {
            setSyncingId(null);
            setUploadProgress(null);
        }
    };

    const handleLinkPersona = async (interviewId: string, personaId: string) => {
        try {
            await linkPersonaToInterviewAction(projectId, studyId, interviewId, personaId);
            router.refresh();
        } catch (e) {
            console.error(e);
            alert('연결 실패');
        }
    };


    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Fix hydration mismatch by providing stable ID
    const dndContextId = useId();

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = interviews.findIndex(i => i.id === active.id);
            const newIndex = interviews.findIndex(i => i.id === over.id);

            const newOrder = arrayMove(interviews, oldIndex, newIndex);
            setInterviews(newOrder);

            try {
                await updateStudySessionsOrderAction(projectId, studyId, newOrder.map(i => i.id));
            } catch (e) {
                console.error("Failed to update order:", e);
                setInterviews(interviews); // Rollback
            }
        }
    };

    return (
        <div className="space-y-8">
            {/* Header / Actions */}
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                    <span className="text-xl">📊</span> 실전 인터뷰 세션
                </h3>
                <button
                    onClick={() => setAddMode('select')}
                    className="text-xs bg-brand-600 hover:bg-brand-700 text-white px-3 py-2 rounded-lg font-bold transition flex items-center gap-1"
                >
                    + 인터뷰 추가
                </button>
            </div>
            <p className="text-slate-500 text-sm mb-4">영상/음성 파일이나 텍스트 기록(Transcript)을 업로드하여 언어/비언어적 정보를 포함한 심층 분석을 받아보세요.</p>

            {/* Add Modal / Form */}
            {addMode && (
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm animate-in fade-in zoom-in-95 duration-200">

                    {addMode === 'select' ? (
                        <div className="space-y-6 text-center py-8">
                            <h4 className="font-black text-2xl text-slate-800 mb-2">인터뷰 추가 방식 선택</h4>
                            <p className="text-slate-500 mb-8">새로운 인터뷰를 어떻게 시작하시겠습니까?</p>

                            <div className="grid grid-cols-2 gap-6 max-w-2xl mx-auto">
                                <button
                                    onClick={() => router.push(`/projects/${projectId}/studies/${studyId}/live`)}
                                    className="group flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-slate-100 bg-slate-50 hover:border-red-200 hover:bg-red-50 hover:shadow-xl transition-all duration-300"
                                >
                                    <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center text-3xl shadow-sm mb-4 group-hover:scale-110 transition-transform">
                                        🎙️
                                    </div>
                                    <h5 className="font-black text-lg text-slate-800 mb-1">직접 녹화하기</h5>
                                    <p className="text-xs text-slate-500 font-medium">Live Interview</p>
                                    <div className="mt-4 px-4 py-1.5 bg-white rounded-full text-[10px] font-bold text-red-500 border border-red-100 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0">
                                        실시간 녹음 및 노트 작성
                                    </div>
                                </button>

                                <button
                                    onClick={() => setAddMode('upload')}
                                    className="group flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-slate-100 bg-slate-50 hover:border-indigo-200 hover:bg-indigo-50 hover:shadow-xl transition-all duration-300"
                                >
                                    <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center text-3xl shadow-sm mb-4 group-hover:scale-110 transition-transform">
                                        📤
                                    </div>
                                    <h5 className="font-black text-lg text-slate-800 mb-1">파일 업로드</h5>
                                    <p className="text-xs text-slate-500 font-medium">Upload Files</p>
                                    <div className="mt-4 px-4 py-1.5 bg-white rounded-full text-[10px] font-bold text-indigo-500 border border-indigo-100 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0">
                                        음성, 영상, 텍스트 분석
                                    </div>
                                </button>
                            </div>

                            <button onClick={() => setAddMode(null)} className="mt-8 text-slate-400 hover:text-slate-600 text-sm font-bold underline">
                                취소하기
                            </button>
                        </div>
                    ) : (
                        // Upload Form Mode
                        <>
                            <div className="flex justify-between items-center mb-6">
                                <h4 className="font-bold text-slate-800">인터뷰 기록 업로드</h4>
                                <button onClick={() => setAddMode('select')} className="text-xs text-slate-400 font-bold hover:text-slate-600">← 뒤로가기</button>
                            </div>

                            <div className="min-h-[100px] mb-4 space-y-6">
                                {/* Persona Selection */}
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                    <label className="block text-xs font-black text-slate-500 mb-3 uppercase tracking-wider">👤 인터뷰 대상자 (Persona)</label>
                                    <select
                                        value={participantId}
                                        onChange={(e) => setParticipantId(e.target.value)}
                                        className="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-white focus:ring-2 ring-brand-500 outline-none transition-all"
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
                                    <p className="text-[11px] text-slate-400 mt-2 font-medium">
                                        * 선택한 페르소나의 정보가 이번 인터뷰 내용을 토대로 자동으로 업데이트됩니다.
                                    </p>
                                </div>

                                {/* Date & Time Settings */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">📅 날짜 (Date)</label>
                                        <input
                                            type="date"
                                            value={interviewDate}
                                            onChange={(e) => setInterviewDate(e.target.value)}
                                            className="w-full p-2 border border-slate-200 rounded-lg text-sm font-bold"
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">시작</label>
                                            <input
                                                type="time"
                                                value={startTime}
                                                onChange={(e) => setStartTime(e.target.value)}
                                                className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">종료</label>
                                            <input
                                                type="time"
                                                value={endTime}
                                                onChange={(e) => setEndTime(e.target.value)}
                                                className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Text File Input */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-2 uppercase flex justify-between">
                                        <span>📄 텍스트 (Transcript)</span>
                                        {textFile && <span className="text-brand-600 cursor-pointer hover:underline" onClick={() => setTextFile(null)}>삭제</span>}
                                    </label>
                                    <div className={`border-2 border-dashed rounded-lg p-4 text-center transition cursor-pointer relative ${textFile ? 'border-brand-200 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                                        <input
                                            type="file"
                                            accept=".txt,.docx"
                                            onChange={(e) => setTextFile(e.target.files?.[0] || null)}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        />
                                        <div className="text-slate-500 text-sm">
                                            {textFile ? (
                                                <div className="font-bold text-brand-600 flex items-center justify-center gap-2">
                                                    📄 {textFile.name}
                                                </div>
                                            ) : (
                                                <span>인터뷰 녹취록 (.txt, .docx) 선택</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Audio File Input */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-2 uppercase flex justify-between">
                                        <span>🎙️ 녹음 파일 (Recording/Audio)</span>
                                        {audioFile && <span className="text-brand-600 cursor-pointer hover:underline" onClick={() => setAudioFile(null)}>삭제</span>}
                                    </label>
                                    <div className={`border-2 border-dashed rounded-lg p-4 text-center transition cursor-pointer relative ${audioFile ? 'border-brand-200 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                                        <input
                                            type="file"
                                            accept=".mp3,.wav,.m4a,.flac,.aac"
                                            onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        />
                                        <div className="text-slate-500 text-sm">
                                            {audioFile ? (
                                                <div className="font-bold text-brand-600 flex items-center justify-center gap-2">
                                                    🎙️ {audioFile.name}
                                                </div>
                                            ) : (
                                                <span>녹음 파일 (.mp3, .wav, .m4a) 선택</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Video File Input */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-2 uppercase flex justify-between">
                                        <span>🎥 비디오 파일 (Media/Video)</span>
                                        {videoFile && <span className="text-brand-600 cursor-pointer hover:underline" onClick={() => setVideoFile(null)}>삭제</span>}
                                    </label>
                                    <div className={`border-2 border-dashed rounded-lg p-4 text-center transition cursor-pointer relative ${videoFile ? 'border-brand-200 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                                        <input
                                            type="file"
                                            accept=".mp4,.mov,.webm"
                                            onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        />
                                        <div className="text-slate-500 text-sm">
                                            {videoFile ? (
                                                <div className="font-bold text-brand-600 flex items-center justify-center gap-2">
                                                    🎥 {videoFile.name}
                                                </div>
                                            ) : (
                                                <span>영상 파일 (.mp4, .mov) 선택</span>
                                            )}
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-2">
                                        * 녹음과 비디오를 각각 또는 한꺼번에 등록할 수 있습니다.
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-3 justify-end pt-4 border-t border-slate-50">
                                <button
                                    onClick={() => setAddMode(null)}
                                    className="px-4 py-2 text-slate-500 hover:text-slate-800 text-sm font-bold"
                                >
                                    취소
                                </button>
                                <button
                                    onClick={handleAdd}
                                    disabled={loading || (!textFile && !audioFile && !videoFile)}
                                    className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-bold hover:bg-brand-700 disabled:opacity-50 min-w-[100px] shadow-sm relative overflow-hidden"
                                >
                                    {/* Progress Background */}
                                    {uploadProgress !== null && (
                                        <div
                                            className="absolute top-0 left-0 h-full bg-brand-500/50 transition-all duration-300"
                                            style={{ width: `${uploadProgress}%` }}
                                        />
                                    )}
                                    <span className="relative z-10">
                                        {loading ? (uploadProgress !== null ? `업로드 중... ${uploadProgress}%` : '분석 중...') : '업로드 및 분석 시작'}
                                    </span>
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* List of Interviews */}
            {interviews.length === 0 ? (
                !addMode && (
                    <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
                        <p className="text-slate-400">아직 진행된 인터뷰가 없습니다. <br />녹음본(Transcript)을 업로드하여 분석을 시작하세요.</p>
                    </div>
                )
            ) : (
                <div className="rounded-lg border border-slate-200 bg-white">
                    <DndContext
                        id={dndContextId}
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                                <tr>
                                    <th className="px-4 py-3 w-10"></th>
                                    <th className="px-4 py-3 w-1/3 text-xs uppercase tracking-wider">Persona</th>
                                    <th className="px-4 py-3 w-1/3 text-xs uppercase tracking-wider">Date</th>
                                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wider">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                <SortableContext
                                    items={interviews.map(i => i.id)}
                                    strategy={verticalListSortingStrategy}
                                >
                                    {interviews.map((interview, index) => (
                                        <SortableRow
                                            key={interview.id}
                                            interview={interview}
                                            projectId={projectId}
                                            studyId={studyId}
                                            personas={personas}
                                            editingDateId={editingDateId}
                                            setEditingDateId={setEditingDateId}
                                            tempMetadata={tempMetadata}
                                            setTempMetadata={setTempMetadata}
                                            handleMetadataUpdate={handleMetadataUpdate}
                                            syncingId={syncingId}
                                            handleSyncAudio={handleSyncAudio}
                                            handleSyncVideo={handleSyncVideo}
                                            handleLinkPersona={handleLinkPersona}
                                            handleDelete={handleDelete}
                                            router={router}
                                            index={index}
                                        />
                                    ))}
                                </SortableContext>
                            </tbody>
                        </table>
                    </DndContext>
                </div>
            )}
        </div>
    );
}

interface SortableRowProps {
    interview: RealInterview;
    projectId: string;
    studyId: string;
    personas: Persona[];
    editingDateId: string | null;
    setEditingDateId: (id: string | null) => void;
    tempMetadata: any;
    setTempMetadata: (meta: any) => void;
    handleMetadataUpdate: (id: string, meta: any) => void;
    syncingId: string | null;
    handleSyncAudio: (id: string, file: File) => void;
    handleSyncVideo: (id: string, file: File) => void;
    handleLinkPersona: (interviewId: string, personaId: string) => void;
    handleDelete: (id: string) => void;
    router: any;
    index: number;
}

function SortableRow({
    interview,
    projectId,
    studyId,
    personas,
    editingDateId,
    setEditingDateId,
    tempMetadata,
    setTempMetadata,
    handleMetadataUpdate,
    syncingId,
    handleSyncAudio,
    handleSyncVideo,
    handleLinkPersona,
    handleDelete,
    router,
    index
}: SortableRowProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: interview.id });

    const [personaMenuOpen, setPersonaMenuOpen] = useState(false);
    const [isLinking, setIsLinking] = useState(false);

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : undefined,
        position: isDragging ? 'relative' as const : undefined,
        backgroundColor: isDragging ? '#f8fafc' : undefined,
    };

    return (
        <tr
            ref={setNodeRef}
            style={style}
            className={`hover:bg-slate-50 transition group cursor-pointer ${isDragging ? 'shadow-lg ring-1 ring-brand-200' : ''}`}
            onClick={() => router.push(`/projects/${projectId}/studies/${studyId}/interview/${interview.id}`)}
        >
            <td className="px-4 py-2 cursor-grab active:cursor-grabbing" {...attributes} {...listeners}>
                <div className="text-slate-300 group-hover:text-slate-400 flex items-center gap-2">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 6h2v2H8V6zm6 0h2v2h-2V6zm-6 4h2v2H8v-2zm6 0h2v2h-2v-2zm-6 4h2v2H8v-2zm6 0h2v2h-2v-2zm-6 4h2v2H8v-2zm6 0h2v2h-2v-2z" />
                    </svg>
                    <span className="font-bold text-xs w-4 text-center text-slate-400">{index + 1}</span>
                </div>
            </td>
            <td className="px-4 py-2 whitespace-nowrap relative">
                {interview.participantId ? (
                    (() => {
                        const persona = personas.find(p => p.id === interview.participantId);
                        return (
                            <div className="flex items-center gap-2 group/persona relative">
                                {persona ? (
                                    <>
                                        <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-xs text-indigo-700">
                                            {persona.name.charAt(0)}
                                        </div>
                                        <div>
                                            <span className="font-bold text-slate-900 block text-xs">{persona.name}</span>
                                            <span className="text-[10px] text-slate-400">{persona.role}</span>
                                        </div>
                                    </>
                                ) : (
                                    <span className="text-xs text-slate-400">Linked (ID: {interview.participantId.slice(-4)})</span>
                                )}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setPersonaMenuOpen(!personaMenuOpen);
                                    }}
                                    className="opacity-0 group-hover/persona:opacity-100 ml-2 p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-indigo-600 transition"
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                    </svg>
                                </button>
                            </div>
                        );
                    })()
                ) : (
                    <div onClick={e => e.stopPropagation()} className="relative">
                        <button
                            onClick={() => setPersonaMenuOpen(!personaMenuOpen)}
                            className="text-[10px] border border-dashed border-slate-300 rounded-lg px-2 py-1.5 bg-slate-50 hover:bg-white hover:border-brand-300 hover:text-brand-600 text-slate-400 font-bold flex items-center gap-1 transition"
                        >
                            <span className="text-xs">👤</span> 페르소나 연결...
                        </button>
                    </div>
                )}

                {personaMenuOpen && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setPersonaMenuOpen(false); }}></div>
                        <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-xl shadow-xl border border-slate-200 z-50 p-2 animate-in fade-in zoom-in-95 duration-200 max-h-60 overflow-y-auto" onClick={e => e.stopPropagation()}>
                            <div className="text-[10px] font-black text-slate-400 px-2 py-1 uppercase">Select Persona</div>
                            {personas.filter(p => p.source === 'real').map(p => (
                                <button
                                    key={p.id}
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        setIsLinking(true);
                                        try {
                                            await handleLinkPersona(interview.id, p.id);
                                            setPersonaMenuOpen(false);
                                        } finally {
                                            setIsLinking(false);
                                        }
                                    }}
                                    disabled={isLinking}
                                    className={`w-full text-left px-2 py-2 rounded-lg text-xs font-bold hover:bg-slate-50 flex items-center gap-2 transition ${isLinking ? 'opacity-50' : ''}`}
                                >
                                    <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs text-slate-500">
                                        {p.name.charAt(0)}
                                    </div>
                                    <span className="truncate flex-1">{p.name}</span>
                                    {isLinking && <span className="animate-spin ml-auto text-xs">⏳</span>}
                                </button>
                            ))}
                            <div className="border-t border-slate-100 my-1"></div>
                            <button
                                onClick={async (e) => {
                                    e.stopPropagation();
                                    if (confirm('이 인터뷰 내용을 분석하여 새로운 페르소나를 생성하시겠습니까?')) {
                                        setIsLinking(true);
                                        try {
                                            await createPersonaFromInterviewAction(projectId, studyId, interview.id);
                                            alert('새로운 페르소나가 생성되었습니다.');
                                            setPersonaMenuOpen(false);
                                        } catch (err) {
                                            console.error(err);
                                            alert('생성 실패');
                                        } finally {
                                            setIsLinking(false);
                                        }
                                    }
                                }}
                                disabled={isLinking}
                                className="w-full text-left px-2 py-2 rounded-lg text-xs font-bold text-brand-600 hover:bg-brand-50 flex items-center gap-2"
                            >
                                <span className="w-6 h-6 rounded-full bg-brand-100 flex items-center justify-center text-xs">+</span>
                                <span>새 페르소나 생성</span>
                            </button>
                        </div>
                    </>
                )}
            </td>
            <td className="px-4 py-2 text-slate-500 whitespace-nowrap">
                {editingDateId === interview.id ? (
                    <div className="relative">
                        <div className="absolute top-0 left-0 bg-white p-3 rounded-xl border border-slate-200 shadow-xl animate-in fade-in zoom-in-95 duration-200 min-w-[240px] z-50 mt-1" onClick={e => e.stopPropagation()}>
                            <div className="grid grid-cols-1 gap-3">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 mb-1.5 uppercase tracking-wider">📅 날짜 설정</label>
                                    <input
                                        type="date"
                                        value={tempMetadata?.date || ''}
                                        onChange={(e) => setTempMetadata((prev: any) => prev ? { ...prev, date: e.target.value } : null)}
                                        className="w-full p-2 border border-slate-200 rounded-lg text-sm font-bold bg-slate-50 focus:bg-white transition-colors"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">시작</label>
                                        <input
                                            type="time"
                                            value={tempMetadata?.startTime || ''}
                                            onChange={(e) => setTempMetadata((prev: any) => prev ? { ...prev, startTime: e.target.value } : null)}
                                            className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">종료</label>
                                        <input
                                            type="time"
                                            value={tempMetadata?.endTime || ''}
                                            onChange={(e) => setTempMetadata((prev: any) => prev ? { ...prev, endTime: e.target.value } : null)}
                                            className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2 justify-end mt-4 pt-3 border-t border-slate-100">
                                <button
                                    onClick={() => setEditingDateId(null)}
                                    className="px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-slate-600 transition"
                                >
                                    취소
                                </button>
                                <button
                                    onClick={() => {
                                        if (tempMetadata) {
                                            handleMetadataUpdate(interview.id, tempMetadata);
                                            setTempMetadata(null);
                                        }
                                    }}
                                    className="bg-brand-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-brand-700 shadow-sm transition"
                                >
                                    저장
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div
                        className="cursor-pointer hover:bg-slate-100 p-2 -m-2 rounded transition flex flex-col gap-0.5 group/date text-left w-fit"
                        onClick={(e) => {
                            e.stopPropagation();
                            setEditingDateId(interview.id);
                            setTempMetadata({
                                date: interview.date,
                                startTime: interview.startTime || '10:00',
                                endTime: interview.endTime || '11:00'
                            });
                        }}
                    >
                        <div className="font-bold text-slate-700 block">
                            {formatDate(interview.date)}
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                            <span>🕒 {interview.startTime || '--:--'} ~ {interview.endTime || '--:--'}</span>
                            <span className="opacity-0 group-hover/date:opacity-50 text-[10px] ml-auto">✏️</span>
                        </div>
                    </div>
                )}
            </td>
            <td className="px-4 py-2 text-left whitespace-nowrap">
                <div className="flex gap-2 justify-start items-center" onClick={e => e.stopPropagation()}>

                    <Link
                        href={`/projects/${projectId}/studies/${studyId}/interview/${interview.id}`}
                        className="text-xs text-brand-600 font-bold hover:underline bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg transition"
                    >
                        결과 보기
                    </Link>
                    <button
                        onClick={() => handleDelete(interview.id)}
                        className="text-slate-400 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition"
                        title="Delete Interview"
                    >
                        🗑️
                    </button>
                </div>
            </td>
        </tr>
    );
}
