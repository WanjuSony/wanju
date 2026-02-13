import { useRef, useEffect, useState, useMemo } from 'react';
import { RealInterview } from '@/lib/types';
import { parseTranscriptContent } from '@/lib/transcript-parser';

interface TranscriptTabProps {
    interview: RealInterview;
    transcriptData: any;
    speakers: { id: string; name: string; role: 'interviewer' | 'participant' }[];
    setSpeakers: (speakers: { id: string; name: string; role: 'interviewer' | 'participant' }[]) => void;
    handleSaveSpeakers: () => void;
    isSavingSpeakers: boolean;
    audioRef: React.RefObject<HTMLAudioElement | null>;
    currentTime: number;
    duration: number;
    playbackRate: number;
    isPlaying: boolean;
    togglePlay: () => void;
    handleSpeedChange: () => void;
    handleSeek: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleTimeUpdate: () => void;
    handleLoadedMetadata: () => void;
    handleUploadAudio: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleUploadTranscript: (e: React.ChangeEvent<HTMLInputElement>) => void;
    isUploading: boolean;
    currentSegmentIndex: number;
    handleJumpToTimestamp: (ref: string) => void;
    handleAutoTranscribeClick: () => void;
    formatTime: (seconds: number) => string;
    // New props for inline setup
    speakerCount?: number;
    setSpeakerCount?: (count: number) => void;
    interviewerName?: string;
    setInterviewerName?: (name: string) => void;
    onStartTranscription?: () => void;
    onDeleteSpeaker?: (speakerId: string) => void;
}

export function TranscriptTab({
    interview,
    transcriptData,
    speakers,
    setSpeakers,
    handleSaveSpeakers,
    isSavingSpeakers,
    audioRef,
    currentTime,
    duration,
    playbackRate,
    isPlaying,
    togglePlay,
    handleSpeedChange,
    handleSeek,
    handleTimeUpdate,
    handleLoadedMetadata,
    handleUploadAudio,
    handleUploadTranscript,
    isUploading,
    currentSegmentIndex,
    handleJumpToTimestamp,
    handleAutoTranscribeClick,
    formatTime,
    speakerCount = 2,
    setSpeakerCount,
    interviewerName,
    setInterviewerName,
    onStartTranscription,
    onDeleteSpeaker
}: TranscriptTabProps) {
    const [showSpeakerSettings, setShowSpeakerSettings] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);

    // New state to allow playing video audio if audio file is missing
    const [useVideoAudio, setUseVideoAudio] = useState(false);

    // Auto-scroll to active segment
    useEffect(() => {
        if (isPlaying && currentSegmentIndex !== -1) {
            const element = document.getElementById(`segment-${currentSegmentIndex}`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, [currentSegmentIndex, isPlaying]);

    const getSpeakerColor = (speakerName: string) => {
        const s = speakers.find(s => s.id === speakerName || s.name === speakerName);
        if (s?.role === 'interviewer') return 'bg-indigo-50 text-indigo-700 border-indigo-100';
        return 'bg-amber-50 text-amber-700 border-amber-100';
    };

    const getSpeakerDisplayName = (speakerName: string) => {
        const s = speakers.find(s => s.id === speakerName);
        return s ? s.name : speakerName;
    };

    // Determine effective media URL
    const mediaUrl = interview.audioUrl || (useVideoAudio ? interview.videoUrl : null);
    const canUseVideoAudio = !interview.audioUrl && interview.videoUrl;

    // Auto-enable video audio if audio is missing but video exists
    useEffect(() => {
        if (canUseVideoAudio) {
            setUseVideoAudio(true);
        }
    }, [canUseVideoAudio]);

    return (
        <div className="flex-1 overflow-y-auto p-4 bg-slate-50 relative scroll-smooth space-y-6">
            {/* Media Sync Buttons - Only show when we need to add the OTHER media type */}
            {(interview.audioUrl || interview.content || canUseVideoAudio) && (
                <div className="flex justify-end gap-2 p-2 mb-2 items-center">
                    {/* Video Audio Toggle Button */}
                    {canUseVideoAudio && (
                        <button
                            onClick={() => setUseVideoAudio(!useVideoAudio)}
                            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold cursor-pointer transition shadow-sm border
                                ${useVideoAudio
                                    ? 'bg-indigo-100 text-indigo-700 border-indigo-200 ring-1 ring-indigo-300'
                                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-indigo-600'}`}
                        >
                            <span className="text-sm">{useVideoAudio ? '🔊' : '🔇'}</span>
                            <span>{useVideoAudio ? '비디오 오디오 사용 중' : '비디오로 재생하기'}</span>
                        </button>
                    )}

                    {!interview.audioUrl && (
                        <label className={`inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-full text-[10px] font-bold cursor-pointer transition shadow-sm ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                            {isUploading ? '...' : (
                                <>
                                    <span className="text-sm">🎙️</span>
                                    <span>녹음 추가</span>
                                </>
                            )}
                            <input
                                type="file"
                                accept=".mp3,.wav,.m4a"
                                className="hidden"
                                disabled={isUploading}
                                onChange={handleUploadAudio}
                            />
                        </label>
                    )}
                    {!interview.content && (
                        <label className={`inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-full text-[10px] font-bold cursor-pointer transition shadow-sm ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                            {isUploading ? '...' : (
                                <>
                                    <span className="text-sm">📄</span>
                                    <span>텍스트 추가</span>
                                </>
                            )}
                            <input
                                type="file"
                                accept=".txt,.docx,.pdf"
                                className="hidden"
                                disabled={isUploading}
                                onChange={handleUploadTranscript}
                            />
                        </label>
                    )}
                </div>
            )}

            {/* Sticky Audio Player */}
            {mediaUrl && (
                <div className="sticky top-0 bg-white/90 backdrop-blur-md border-b border-indigo-50 px-4 py-3 z-30 shadow-sm flex items-center gap-3 rounded-lg mx-2 mt-2 mb-2 animate-in fade-in slide-in-from-top-2 duration-300">
                    <audio
                        ref={audioRef}
                        src={mediaUrl}
                        preload="metadata"
                        onTimeUpdate={handleTimeUpdate}
                        onLoadedMetadata={handleLoadedMetadata}
                        onDurationChange={handleLoadedMetadata}
                        onEnded={() => { /* Handled in parent mostly? Need verify */ }}
                        className="hidden"
                    />

                    <button
                        onClick={togglePlay}
                        className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 transition shadow-sm flex-shrink-0"
                    >
                        {isPlaying ? '⏸' : '▶'}
                    </button>

                    <div className="flex-1 flex items-center gap-2">
                        <span className="text-[10px] font-mono text-slate-500 w-8 text-right">{formatTime(currentTime)}</span>
                        <input
                            type="range"
                            min="0"
                            max={duration || 0}
                            value={currentTime}
                            onChange={handleSeek}
                            className="flex-1 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-indigo-600 [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:scale-110 transition-all"
                        />
                        <span className="text-[10px] font-mono text-slate-500 w-8">{formatTime(duration)}</span>
                    </div>

                    <div className="flex items-center gap-1 border-l border-slate-200 pl-3 ml-2">
                        <button
                            onClick={handleSpeedChange}
                            className="text-[10px] font-bold text-slate-500 hover:text-indigo-600 w-8 text-center"
                        >
                            x{playbackRate}
                        </button>
                    </div>
                </div>
            )}

            {/* Speaker Manager Toggle */}
            {transcriptData && (
                <div className="mb-4">
                    <button
                        onClick={() => setShowSpeakerSettings(!showSpeakerSettings)}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-all duration-200 group
                                    ${showSpeakerSettings
                                ? 'bg-slate-50 border-slate-200 text-slate-800'
                                : 'bg-white border-dashed border-slate-300 text-slate-500 hover:border-indigo-300 hover:text-indigo-600'
                            }`}
                    >
                        <span className="text-xs font-bold flex items-center gap-2">
                            <span className="text-lg">👥</span>
                            화자 설정 (Speaker Settings)
                        </span>
                        <span className={`transition-transform duration-200 ${showSpeakerSettings ? 'rotate-180' : ''}`}>
                            <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </span>
                    </button>

                    {showSpeakerSettings && (
                        <div className="mt-2 bg-white rounded-xl border border-slate-200 p-5 shadow-sm animate-in fade-in slide-in-from-top-1 duration-200">
                            <div className="flex justify-between items-center mb-4">
                                <div>
                                    <h4 className="font-bold text-slate-800 text-sm">화자 정보 수정</h4>
                                    <p className="text-xs text-slate-400 mt-1">대화의 화자를 식별하여 이름을 변경하세요.</p>
                                </div>
                                {isSavingSpeakers && (
                                    <span className="text-xs text-indigo-500 font-bold animate-pulse">
                                        저장 중...
                                    </span>
                                )}
                            </div>
                            <div className="space-y-2">
                                {speakers.map((s, idx) => (
                                    <div key={idx} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-100 group/speaker">
                                        <div className="w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-400 shadow-sm flex-shrink-0">
                                            {idx + 1}
                                        </div>

                                        <div className="flex-1 flex items-center gap-2">
                                            <input
                                                value={s.name}
                                                onChange={e => {
                                                    const newSpeakers = [...speakers];
                                                    newSpeakers[idx].name = e.target.value;
                                                    setSpeakers(newSpeakers);
                                                }}
                                                className="flex-1 text-sm font-bold text-slate-700 bg-white border border-slate-200 rounded-md px-2 py-1.5 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 outline-none transition"
                                                placeholder={`Speaker ${idx + 1}`}
                                            />
                                            <div className="relative">
                                                <select
                                                    value={s.role}
                                                    onChange={e => {
                                                        const newSpeakers = [...speakers];
                                                        newSpeakers[idx].role = e.target.value as 'interviewer' | 'participant';
                                                        setSpeakers(newSpeakers);
                                                    }}
                                                    className={`appearance-none pl-2 pr-6 py-1.5 rounded-md text-xs font-bold border cursor-pointer focus:outline-none transition
                                                                    ${s.role === 'interviewer'
                                                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                                            : 'bg-white text-slate-600 border-slate-200'
                                                        }`}
                                                >
                                                    <option value="interviewer">인터뷰어</option>
                                                    <option value="participant">참여자</option>
                                                </select>
                                                <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                                                    <svg width="8" height="5" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                        <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                    </svg>
                                                </div>
                                            </div>

                                            {/* Delete Speaker Button (Only if > 2 speakers) */}
                                            {speakers.length > 2 && onDeleteSpeaker && (
                                                <button
                                                    onClick={() => {
                                                        if (confirm(`'${s.name}' 화자를 삭제하시겠습니까?\n이 화자의 모든 대화 내용이 함께 삭제됩니다.`)) {
                                                            onDeleteSpeaker(s.id);
                                                        }
                                                    }}
                                                    className="w-6 h-6 flex items-center justify-center rounded-md bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 transition opacity-0 group-hover/speaker:opacity-100"
                                                    title="화자 삭제"
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Use fallback if transcriptData is missing OR segments provided are empty */}
            {(!transcriptData || (transcriptData.segments && transcriptData.segments.length === 0)) && interview.content && (
                <div className="text-slate-500 text-sm whitespace-pre-wrap p-4 bg-white rounded-lg border border-slate-200">
                    {interview.content}
                </div>
            )}

            {(!transcriptData || (transcriptData.segments.length === 0)) && !interview.content && !interview.audioUrl && !canUseVideoAudio && (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400 gap-4 bg-white rounded-xl border border-dashed border-slate-200">
                    <div className="text-4xl">🎙️</div>
                    <div className="text-center">
                        <p className="font-bold text-slate-600">등록된 녹취록이나 음성이 없습니다.</p>
                        <p className="text-xs mt-1">인터뷰 내용을 업로드하거나 녹음 파일을 등록하여 분석을 시작하세요.</p>
                    </div>
                    <div className="flex gap-3 mt-4">
                        <label className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl text-sm font-bold cursor-pointer transition flex items-center gap-2 shadow-md hover:shadow-lg hover:-translate-y-0.5 transform duration-200">
                            <span>📄 텍스트 업로드</span>
                            <input type="file" accept=".txt,.docx,.pdf" className="hidden" onChange={handleUploadTranscript} />
                        </label>
                        <label className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-6 py-3 rounded-xl text-sm font-bold cursor-pointer transition flex items-center gap-2 shadow-sm hover:shadow-md hover:-translate-y-0.5 transform duration-200">
                            <span>🎙️ 녹음 파일 업로드</span>
                            <input type="file" accept=".mp3,.wav,.m4a" className="hidden" onChange={handleUploadAudio} />
                        </label>
                    </div>
                </div>
            )}

            {!transcriptData && !interview.content && (interview.audioUrl || canUseVideoAudio) && (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400 gap-6 bg-white rounded-xl border border-dashed border-slate-200">
                    <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center text-3xl animate-pulse">
                        ✨
                    </div>
                    <div className="text-center max-w-sm">
                        <p className="font-bold text-slate-800 text-lg">
                            {canUseVideoAudio ? '비디오 파일이 준비되었습니다!' : '녹음 파일이 준비되었습니다!'}
                        </p>
                        <p className="text-sm text-slate-500 mt-2">
                            AI가 대화 내용을 텍스트로 변환하고 핵심 인사이트를 추출합니다.
                        </p>
                    </div>

                    {/* Inline Speaker Setup - Replaces Modal */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 w-full max-w-xs">
                        {isTranscribing ? (
                            <div className="flex flex-col items-center justify-center py-6 text-indigo-600 space-y-3">
                                <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                                <p className="text-xs font-bold animate-pulse">오디오 파일을 변환하고 있습니다...</p>
                                <p className="text-[10px] text-slate-400">약 1~2분 정도 소요됩니다.</p>
                            </div>
                        ) : (
                            <>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 text-center">인터뷰어 이름 (선택)</label>
                                <input
                                    type="text"
                                    value={interviewerName}
                                    onChange={(e) => setInterviewerName && setInterviewerName(e.target.value)}
                                    placeholder="예: 김민수 연구원"
                                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs mb-4 focus:border-indigo-500 outline-none font-bold text-center"
                                />
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 text-center">화자 수 설정 (Speakers)</label>
                                <div className="flex gap-1 mb-4">
                                    {[1, 2, 3, 4, 5].map(num => (
                                        <button
                                            key={num}
                                            onClick={() => setSpeakerCount && setSpeakerCount(num)}
                                            className={`flex-1 py-1.5 rounded-md text-xs font-bold transition border
                                                ${speakerCount === num
                                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                                                }`}
                                        >
                                            {num}명
                                        </button>
                                    ))}
                                </div>
                                <button
                                    onClick={async () => {
                                        setIsTranscribing(true);
                                        try {
                                            if (onStartTranscription) await onStartTranscription();
                                            else if (handleAutoTranscribeClick) await handleAutoTranscribeClick();
                                        } catch (e) {
                                            console.error(e);
                                            setIsTranscribing(false);
                                            alert("분석 시작 실패 :(");
                                        }
                                    }}
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg font-bold transition-all shadow-md hover:shadow-indigo-200 flex items-center justify-center gap-2 active:scale-95"
                                >
                                    <span className="text-lg">🚀</span>
                                    <span>분석 시작하기</span>
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Transcript Timeline */}
            <div className="space-y-6 pb-20">
                {transcriptData?.segments.map((segment: any, idx: number) => {
                    const isActive = idx === currentSegmentIndex;
                    // FIX: Interviewer -> Right, Participant -> Left
                    const speakerMeta = speakers.find(s => s.id === segment.speaker || s.name === segment.speaker);
                    const isInterviewer = speakerMeta
                        ? speakerMeta.role === 'interviewer'
                        : (segment.speaker.toLowerCase().includes('interviewer') || segment.speaker === 'Speaker 1');

                    return (
                        <div
                            key={idx}
                            id={`segment-${idx}`}
                            className={`group flex gap-4 transition-all duration-300 ${isActive ? 'scale-[1.01]' : ''} ${isInterviewer ? 'flex-row-reverse' : 'flex-row'}`}
                            data-timestamp={segment.timestamp}
                        >
                            {/* Removed sidebar timestamp button per request */}

                            <div className={`flex-1 min-w-0 max-w-[85%] ${isInterviewer ? 'text-right' : 'text-left'}`}>
                                <div className={`flex items-center gap-2 mb-1.5 ${isInterviewer ? 'flex-row-reverse' : 'flex-row'}`}>
                                    <span className="text-xs font-bold text-slate-500">
                                        {getSpeakerDisplayName(segment.speaker)}
                                    </span>
                                    {/* Optional: Add Jump Button here if needed, but keeping it clean for now */}
                                    <button
                                        onClick={() => handleJumpToTimestamp(segment.timestamp)}
                                        className="text-[10px] text-slate-300 hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        Jump
                                    </button>
                                </div>
                                <div className={`inline-block text-sm leading-relaxed whitespace-pre-wrap rounded-2xl px-5 py-3 shadow-sm transition-all text-left ${isActive
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 ring-2 ring-indigo-200'
                                    : isInterviewer
                                        ? 'bg-indigo-50 text-indigo-900 border border-indigo-100 rounded-tr-none'
                                        : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none'
                                    }`}>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleJumpToTimestamp(segment.timestamp);
                                        }}
                                        className={`inline-flex items-center justify-center text-[10px] font-mono font-bold mr-2 px-1.5 py-0.5 rounded cursor-pointer select-none transition-colors border
                                            ${isActive
                                                ? 'bg-indigo-500 text-white border-indigo-600 hover:bg-indigo-400'
                                                : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200'
                                            }`}
                                    >
                                        {segment.timestamp}
                                    </button>
                                    {segment.text}
                                </div>
                            </div>
                        </div>
                    );
                })}

                {/* REMOVED: "Transcript Ready" block as per user request. We assume analysis happens automatically or via other means. */}
            </div>
        </div>
    );
}
