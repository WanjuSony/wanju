'use client';

import { RealInterview, StructuredInsight, GuideBlock, Persona, StudyPlan } from '@/lib/types';
import ReactMarkdown from 'react-markdown';
import { useState, useTransition, useMemo, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { reanalyzeInterviewAction, addManualInsightAction, generateSummaryAction, generateFeedbackAction, createPersonaFromInterviewAction, uploadInterviewVideoAction, uploadInterviewAudioAction, saveInterviewVideoUrlAction, autoTranscribeMediaAction, uploadInterviewTranscriptAction, updateSpeakerInfoAction, linkPersonaToInterviewAction, updateInterviewNoteAction, updatePersonaAction, deleteInsightAction, updateInsightAction, updateInsightOrderAction, updateInterviewHypothesisReviewAction, deleteSpeakerAction, getInterviewAction } from '@/app/actions';
import { supabase } from '@/lib/supabase';


import { PersonaDetail } from './PersonaDetail';
import remarkGfm from 'remark-gfm';
import { parseTranscriptContent } from '@/lib/transcript-parser';
import { uploadFileWithTus } from '@/lib/tus-upload';
import Link from 'next/link';
import TextareaAutosize from 'react-textarea-autosize';
import { InsightsTab } from './interview-report/InsightsTab';
import { SummaryTab } from './interview-report/SummaryTab';
import { FeedbackTab } from './interview-report/FeedbackTab';
import { TranscriptTab } from './interview-report/TranscriptTab';
import { VideoTab } from './interview-report/VideoTab';
import { MemoTab } from './interview-report/MemoTab';


interface Props {
    interview: RealInterview;
    projectId: string;
    studyId: string;
    guideBlocks: GuideBlock[];
    personas: Persona[];
    projectTitle: string;
    studyTitle: string;
    allInterviews?: RealInterview[];
    researchQuestions?: string[];
}

// ... imports

// Helper to normalize timestamps (e.g. "1:05" -> "01:05", "00:03" -> "00:03")
// actually simpler: just strip non-digits to compare, or convert to seconds.
// For ID matching, let's keep it simple: Remove all colons and pad if necessary?
// A safer approach for "Ref: 0:03" vs "00:03" is to try both.
const normalizedId = (ts: string) => `transcript-${ts.replace(/:/g, '-')}`;

export function InterviewReport({ interview: initialInterview, projectId, studyId, guideBlocks = [], personas = [], studyTitle, allInterviews = [], researchQuestions = [] }: Props) {

    const [interview, setInterview] = useState<RealInterview>(initialInterview);
    const [isLoadingFull, setIsLoadingFull] = useState(false);
    const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

    useEffect(() => {
        setHasLoadedOnce(false);
    }, [interview.id]);

    // Sync State with Props (Fix for Re-analysis not updating UI)
    useEffect(() => {
        setInterview(initialInterview);
    }, [initialInterview]);

    useEffect(() => {
        // If content is empty (lightweight fetch) AND we haven't tried loading yet
        if (!interview.content && !isLoadingFull && !hasLoadedOnce) {
            setIsLoadingFull(true);
            getInterviewAction(interview.id).then(fullData => {
                if (fullData) {
                    setInterview(fullData);
                }
                setHasLoadedOnce(true);
            }).catch(err => {
                console.error("Full data fetch failed:", err);
                setHasLoadedOnce(true);
            }).finally(() => {
                setIsLoadingFull(false);
            });
        }
    }, [interview.id, interview.content, isLoadingFull, hasLoadedOnce]);

    const insights = interview.structuredData || [];
    const [coppied, setCoppied] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [showAddInsight, setShowAddInsight] = useState(false);
    const [highlightedTimestamp, setHighlightedTimestamp] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [showSpeakerSettings, setShowSpeakerSettings] = useState(false);
    const router = useRouter();

    const linkedPersona = personas.find(p => p.id === interview.participantId);
    const [isLinkingPersona, setIsLinkingPersona] = useState(false);

    const handleLinkPersona = async (personaId: string) => {
        try {
            await linkPersonaToInterviewAction(projectId, studyId, interview.id, personaId);
            setIsLinkingPersona(false);
            router.refresh();
        } catch (e) {
            alert("Failed to link persona");
        }
    };


    // Group insights by type
    const facts = insights.filter(i => i.type === 'fact');
    const actions = insights.filter(i => i.type === 'action');
    const findings = insights.filter(i => i.type === 'insight');

    // Parse transcript for chat view
    const transcriptData = useMemo(() => {
        // 1. Prefer pre-calculated/stored structured segments
        if (interview.segments && interview.segments.length > 0) {
            return {
                title: interview.title,
                headers: [],
                segments: interview.segments,
                rawContent: interview.content || ''
            };
        }

        // 2. Fallback: Parse from raw content
        if (!interview.content || !interview.content.trim()) return null;
        return parseTranscriptContent(interview.content, interview.title);
    }, [interview.segments, interview.content, interview.title]);

    // identify unique speakers to assign colors
    const uniqueSpeakers = useMemo(() => {
        if (!transcriptData) return [];
        const speakers = new Set(transcriptData.segments.map(s => s.speaker));
        return Array.from(speakers);
    }, [transcriptData]);

    const makeId = (ts: string) => `transcript-${ts.replace(/:/g, '-')}`;

    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);

    // Initial Speaker State from DB or extraction
    const [speakers, setSpeakers] = useState(interview.speakers || []);
    const [isSavingSpeakers, setIsSavingSpeakers] = useState(false);
    const [activeTab, setActiveTab] = useState<'transcript' | 'memo' | 'video'>('transcript');
    const [showTranscribeSetup, setShowTranscribeSetup] = useState(false);
    const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
    const [speakerCount, setSpeakerCount] = useState<number>(2);
    const [interviewerNameInput, setInterviewerNameInput] = useState<string>('');
    const [pendingAction, setPendingAction] = useState<string | null>(null);

    // Initialize speakers if empty but transcript exists
    useMemo(() => {
        if (uniqueSpeakers.length > 0 && speakers.length === 0) {
            const initialSpeakers = uniqueSpeakers.map((name, idx) => ({
                id: name,
                name: name,
                role: (idx === 0 ? 'interviewer' : 'participant') as 'interviewer' | 'participant'
            }));
            setSpeakers(initialSpeakers);
        }
    }, [uniqueSpeakers, speakers.length]);

    // Auto-save speakers with debounce
    useEffect(() => {
        // Skip initial render or empty state if needed (though empty array is valid)
        // We compare with interview.speakers to see if dirty? 
        // For simplicity, just debounce save whenever `speakers` changes relative to last save.
        // But `speakers` changes on every keystroke.

        const timer = setTimeout(async () => {
            // Only save if speakers differs from initial/saved state? 
            // Ideally yes, but deep comparison might be overkill. 
            // Let's just save if speakers is populated.
            if (speakers.length > 0) {
                setIsSavingSpeakers(true);
                try {
                    await updateSpeakerInfoAction(projectId, studyId, interview.id, speakers);
                    // Update the "initial" state reference? 
                    // Actually server action revalidates, so interview.speakers might update,
                    // but we don't want to overwrite local state while typing.
                } catch (e) {
                    console.error("Auto-save failed", e);
                } finally {
                    setIsSavingSpeakers(false);
                }
            }
        }, 1000); // 1s debounce

        return () => clearTimeout(timer);
    }, [speakers, projectId, studyId, interview.id]);

    const handleSaveSpeakers = async () => {
        // Manual trigger (optional, might remove from UI but keep function if needed)
        setIsSavingSpeakers(true);
        try {
            await updateSpeakerInfoAction(projectId, studyId, interview.id, speakers);
        } catch (e) {
            console.error(e);
            alert('화자 정보 저장 실패');
        } finally {
            setIsSavingSpeakers(false);
        }
    };

    const hasAudio = !!interview.audioUrl;
    const hasVideo = !!interview.videoUrl;



    const handleJumpToTimestamp = (ref: string) => {
        if (!ref) return;
        const cleanRef = ref.trim();

        // 1. Handle Media Playback
        const targetTime = parseTimestamp(cleanRef);
        if (!isNaN(targetTime)) {
            if (audioRef.current) {
                audioRef.current.currentTime = targetTime;
                audioRef.current.play().catch(e => console.log('Autoplay prevented', e));
                setIsPlaying(true);
            }
            if (videoRef.current) {
                videoRef.current.currentTime = targetTime;
                videoRef.current.play().catch(e => console.log('Video autoplay prevented', e));
                setIsPlaying(true);
            }
        }

        // 2. Tab Navigation & Scrolling
        // If we are in 'video' tab, STAY there. Do not switch.
        if (activeTab === 'video') {
            // Do not switch to transcript tab if the user is explicitly in video tab.
            // Just seek (done above).
            return;
        }

        // For other tabs (transcript, memo), switch to transcript to show context
        if (activeTab !== 'transcript') {
            setActiveTab('transcript');
            setTimeout(() => scrollToSegment(cleanRef), 150);
        } else {
            scrollToSegment(cleanRef);
        }
    };

    const scrollToSegment = (ref: string) => {
        // Try to find element by data-timestamp attribute
        // Direct match
        let element = document.querySelector(`div[data-timestamp="${ref}"]`);

        if (!element) {
            // Fallback heuristics for format mismatches (e.g. "1:05" vs "01:05")
            // Try adding leading zero
            if (/^\d:\d{2}/.test(ref)) {
                element = document.querySelector(`div[data-timestamp="0${ref}"]`);
            }
            // Try removing leading zero
            else if (/^0\d:\d{2}/.test(ref)) {
                element = document.querySelector(`div[data-timestamp="${ref.substring(1)}"]`);
            }
        }

        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setHighlightedTimestamp(ref);

            // Also try to find exact timestamp match attribute for better accuracy
            const foundTimestamp = element.getAttribute('data-timestamp');
            if (foundTimestamp) setHighlightedTimestamp(foundTimestamp);

            setTimeout(() => setHighlightedTimestamp(null), 3000);
        } else {
            console.warn(`Could not find segment for timestamp: ${ref}`);
        }
    };

    const handleCopyAll = () => {
        // ... (keep existing handleCopyAll logic if it was here, but in replace_file_content we focus on the changed block. 
        // Wait, I need to include handleCopyAll if I am replacing a big block or I can leave it if I target specific lines.
        // Let me target the component body specifically to cover handleJumpToTimestamp and the Render loop.)
        // This tool call seems to target a large chunk (lines 47-182). I should preserve handleCopyAll.

        let text = `# ${interview.title} - AI Insights\n\n`;

        if (findings.length > 0) {
            text += `## Key Insights\n`;
            findings.forEach(i => {
                text += `### ${i.content}\n`;
                if (i.meaning) text += `- **Why:** ${i.meaning}\n`;
                if (i.sourceSegmentId) text += `- *Ref:* ${i.sourceSegmentId}\n`;
                text += '\n';
            });
        }

        if (actions.length > 0) {
            text += `## Action Items\n`;
            actions.forEach(i => {
                text += `- [ ] **${i.content}**\n`;
                if (i.recommendation) text += `  - Recommendation: ${i.recommendation}\n`;
                text += '\n';
            });
        }

        if (facts.length > 0) {
            text += `## Key Facts\n`;
            facts.forEach(i => {
                text += `- ${i.content}\n`;
                text += '\n';
            });
        }

        navigator.clipboard.writeText(text);
        setCoppied(true);
        setTimeout(() => setCoppied(false), 2000);
    };

    const handleDeleteInsight = async (insightId: string) => {
        try {
            // Optimistic Update? For delete, maybe simpler to just wait.
            // But user experience is better with optimistic.
            // Since we rely on props `interview`, we can't easily optimistic update without local state override or `useOptimistic`.
            // For now, let's keep it simple (server action + revalidate).
            await deleteInsightAction(projectId, studyId, interview.id, insightId);
        } catch (e) {
            console.error(e);
            alert('인사이트 삭제 실패');
        }
    };

    const handleUpdateInsight = async (insightId: string, data: any) => {
        try {
            await updateInsightAction(projectId, studyId, interview.id, insightId, data);
        } catch (e) {
            console.error(e);
            alert('인사이트 수정 실패');
        }
    };


    const handleReanalyze = () => {
        if (!interview.content) {
            alert("전사 데이터(Transcript)가 없습니다. 먼저 오디오를 업로드하거나 전사를 완료해주세요.");
            return;
        }

        console.log("[InterviewReport] Starting Reanalysis...");
        setPendingAction('insights');
        startTransition(async () => {
            try {
                await reanalyzeInterviewAction(projectId, studyId, interview.id);
                console.log("[InterviewReport] Reanalysis Action Complete. Refreshing...");
                router.refresh();
            } catch (e: any) {
                console.error("Reanalysis failed:", e);
                alert(`분석 실패: ${e.message}`);
            } finally {
                setPendingAction(null);
            }
        });
    };



    const handleAutoTranscribeClick = () => {
        setShowTranscribeSetup(true);
    };

    const confirmTranscribe = () => {
        if (!interview.audioUrl && !interview.id) return;

        setPendingAction('transcribe');
        startTransition(async () => {
            try {
                await autoTranscribeMediaAction(projectId, studyId, interview.id, speakerCount, interviewerNameInput);
                setShowTranscribeSetup(false);
            } catch (e: any) {
                alert("전사 실패: " + e.message);
            } finally {
                setPendingAction(null);
            }
        });
    };

    const [videoTabMode, setVideoTabMode] = useState<'upload' | 'embed'>('upload');
    const [embedInput, setEmbedInput] = useState('');
    const [isChangingVideo, setIsChangingVideo] = useState(false);

    const handleUploadTranscript = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        try {
            const updatedInterview = await uploadInterviewTranscriptAction(projectId, studyId, interview.id, formData);
            if (updatedInterview) {
                setInterview(updatedInterview as any);
            }
            alert('텍스트가 성공적으로 등록되었습니다.');
            router.refresh();
        } catch (error) {
            console.error(error);
            alert('업로드 실패');
        } finally {
            setIsUploading(false);
        }
    };

    const handleUploadAudio = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
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
            const updatedInterview = await uploadInterviewAudioAction(projectId, studyId, interview.id, formData);
            if (updatedInterview) {
                setInterview(updatedInterview as any);
            }
            alert('녹음 파일이 등록되었습니다.');
            router.refresh();
        } catch (error: any) {
            console.error(error);
            alert('업로드 실패: ' + (error.message || '알 수 없는 오류'));
        } finally {
            setIsUploading(false);
        }
    };

    const handleUploadVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
            let publicUrl = '';

            if (file.size > 6 * 1024 * 1024) {
                publicUrl = await uploadFileWithTus('uploads', file, fileName);
            } else {
                const { error } = await supabase.storage.from('uploads').upload(fileName, file, { upsert: true });
                if (error) throw new Error("비디오 파일 업로드 실패: " + error.message);
                const { data } = supabase.storage.from('uploads').getPublicUrl(fileName);
                publicUrl = data.publicUrl;
            }

            const formData = new FormData();
            formData.append('fileUrl', publicUrl);
            const updatedInterview = await uploadInterviewVideoAction(projectId, studyId, interview.id, formData);
            if (updatedInterview) {
                setInterview(updatedInterview as any);
            }
            alert('비디오 파일이 등록되었습니다.');
            router.refresh();
        } catch (error: any) {
            console.error(error);
            alert('업로드 실패: ' + (error.message || '알 수 없는 오류'));
        } finally {
            setIsUploading(false);
        }
    };

    const handleSaveVideoUrl = async (url: string) => {
        if (!url.trim()) return;
        setIsUploading(true); // Reusing isUploading for this action
        try {
            const updatedInterview = await saveInterviewVideoUrlAction(projectId, studyId, interview.id, url);
            if (updatedInterview) {
                setInterview(updatedInterview as any);
            }
            alert('비디오 링크가 등록되었습니다.');
            router.refresh();
        } catch (e) {
            console.error(e);
            alert('링크 저장 실패');
        } finally {
            setIsUploading(false);
        }
    };

    const handleDeleteSpeaker = async (speakerId: string) => {
        setIsSavingSpeakers(true);
        try {
            await deleteSpeakerAction(projectId, studyId, interview.id, speakerId);
            // Optimistic update for local state
            const newSpeakers = speakers.filter(s => s.id !== speakerId);
            setSpeakers(newSpeakers);
            router.refresh(); // Refresh to update transcript content
        } catch (e) {
            console.error(e);
            alert('화자 삭제 실패');
        } finally {
            setIsSavingSpeakers(false);
        }
    };



    // Parse Notes
    const notes = useMemo(() => {
        if (!interview.note) return {};
        if (typeof interview.note === 'string') {
            try {
                return JSON.parse(interview.note as string);
            } catch (e) {
                return {};
            }
        }
        return interview.note;
    }, [interview.note]);
    const [rightPanelTab, setRightPanelTab] = useState<'insights' | 'feedback' | 'summary'>('insights');

    // ... existing hooks


    // Audio Player State
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [playbackRate, setPlaybackRate] = useState(1.0);

    // Initialize speakers if empty but transcript exists
    useEffect(() => {
        if (uniqueSpeakers.length > 0 && speakers.length === 0) {
            const initialSpeakers = uniqueSpeakers.map((name, idx) => ({
                id: name,
                name: name,
                role: (idx === 0 || name.toLowerCase().includes('interviewer')) ? 'interviewer' : 'participant' as 'interviewer' | 'participant'
            }));
            setSpeakers(initialSpeakers);
        }
    }, [uniqueSpeakers, speakers]);

    const togglePlay = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };



    const handleSpeedChange = () => {
        const speeds = [0.5, 1.0, 1.25, 1.5, 2.0];
        const nextIdx = (speeds.indexOf(playbackRate) + 1) % speeds.length;
        const nextSpeed = speeds[nextIdx];
        if (audioRef.current) {
            audioRef.current.playbackRate = nextSpeed;
            setPlaybackRate(nextSpeed);
        }
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
            // Retry duration if missing
            if (duration === 0 && isFinite(audioRef.current.duration) && audioRef.current.duration > 0) {
                setDuration(audioRef.current.duration);
            }
        }
    };

    const handleLoadedMetadata = () => {
        let dur = 0;
        if (audioRef.current && isFinite(audioRef.current.duration) && audioRef.current.duration > 0) {
            dur = audioRef.current.duration;
        }

        // Prioritize explicit duration from DB if audio metadata fails or is 0
        if ((!dur || dur === 0) && interview.duration) {
            dur = interview.duration;
        }

        // Fallback: Calculate from interview start/end time
        if ((!dur || dur === 0) && interview.startTime && interview.endTime) {
            const start = parseTimestamp(interview.startTime);
            const end = parseTimestamp(interview.endTime);
            if (end > start) {
                dur = end - start;
            }
        }

        if (dur > 0) setDuration(dur);
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = Number(e.target.value);
        if (audioRef.current) {
            audioRef.current.currentTime = time;
            setCurrentTime(time);
        }
    };

    const formatTime = (seconds: number) => {
        if (!seconds || isNaN(seconds)) return '0:00';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const parseTimestamp = (timeStr: string) => {
        if (!timeStr) return 0;
        const parts = timeStr.split(':').map(Number);
        if (parts.length === 2) return parts[0] * 60 + parts[1];
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
        return 0;
    };

    const currentSegmentIndex = useMemo(() => {
        if (!transcriptData?.segments || currentTime === 0) return -1;

        // Find the last segment that started before or at currentTime
        for (let i = transcriptData.segments.length - 1; i >= 0; i--) {
            const segTime = parseTimestamp(transcriptData.segments[i].timestamp);
            if (segTime <= currentTime + 0.5) { // 0.5s buffer
                return i;
            }
        }
        return -1;
    }, [currentTime, transcriptData]);

    // Auto-scroll to active segment
    useEffect(() => {
        if (isPlaying && currentSegmentIndex !== -1) {
            const element = document.getElementById(`segment-${currentSegmentIndex}`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, [currentSegmentIndex, isPlaying]);

    const handleNoteUpdate = async (blockId: string, value: string) => {
        const newNotes = { ...notes, [blockId]: value };
        // Optimistic update?
        // Actually, we use `notes` from `interview.note`.
        // To support local editing without lag, we should allow the textarea to manage its own state or update a local state replica.
        // But `notes` comes from `useMemo` on `interview.note`.
        // Let's rely on defaultValue and onBlur to save. 
        // Or better: Controlled component approach if we want to update the "Notes" map shown.
        // Given complexity, let's use `defaultValue` with `onBlur` for saving, 
        // but since `notes` might change from server revalidation, sticky focus might be tricky.
        // Let's use a blurred save.

        await updateInterviewNoteAction(projectId, studyId, interview.id, newNotes);
    };

    return (
        <div className="flex flex-col h-full">


            {/* Dynamic Interactive Header */}
            <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-40 shadow-sm">
                <div className="flex items-center gap-4">
                    <Link
                        href={`/projects/${projectId}/studies/${studyId}?tab=execution`}
                        className="text-slate-500 hover:text-slate-800 text-sm font-bold flex items-center gap-1"
                    >
                        &larr; Back to Study
                    </Link>
                    <div className="w-px h-4 bg-slate-200"></div>
                    <div>
                        <div className="flex items-center gap-2 relative">
                            {linkedPersona ? (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setSelectedPersona(linkedPersona)}
                                        className="text-lg font-bold text-slate-800 hover:text-indigo-600 flex items-center gap-2 transition"
                                    >
                                        <span className="text-indigo-600">👤</span>
                                        {/* Preserve index if it exists in the title (e.g., "2. ") */}

                                        {linkedPersona.name}
                                    </button>
                                    <button
                                        onClick={() => setIsLinkingPersona(!isLinkingPersona)}
                                        className="text-slate-400 hover:text-indigo-600 p-1 rounded-md hover:bg-slate-50 transition"
                                    >
                                        <svg width="8" height="5" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setIsLinkingPersona(!isLinkingPersona)}
                                    className="text-lg font-bold text-slate-400 hover:text-indigo-600 flex items-center gap-2 transition group"
                                >
                                    <div className="w-8 h-8 rounded-full bg-slate-100 group-hover:bg-indigo-50 border border-slate-200 border-dashed flex items-center justify-center transition">
                                        <span className="text-slate-400 group-hover:text-indigo-500 text-sm">＋</span>
                                    </div>
                                    <span>Link Persona</span>
                                </button>
                            )}

                            {/* Persona Selector Popover */}
                            {isLinkingPersona && (
                                <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 p-2 z-50 animate-in fade-in zoom-in-50 duration-200">
                                    <h4 className="text-xs font-bold text-slate-500 mb-2 px-2">Select Persona</h4>
                                    <div className="max-h-60 overflow-y-auto space-y-1">
                                        {personas.filter(p => p.source === 'real').length > 0 ? personas.filter(p => p.source === 'real').map(p => (
                                            <button
                                                key={p.id}
                                                disabled={isPending}
                                                onClick={() => {
                                                    setPendingAction(`linkPersona-${p.id}`);
                                                    startTransition(async () => {
                                                        try {
                                                            await handleLinkPersona(p.id);
                                                        } finally {
                                                            setPendingAction(null);
                                                        }
                                                    });
                                                }}
                                                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2
                                                    ${p.id === interview.participantId
                                                        ? 'bg-indigo-50 text-indigo-700'
                                                        : 'text-slate-700 hover:bg-slate-50'
                                                    } ${isPending ? 'opacity-50 cursor-wait' : ''}`}
                                            >
                                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 overflow-hidden flex-shrink-0 border border-slate-200">
                                                    {pendingAction === `linkPersona-${p.id}` ? (
                                                        <svg className="animate-spin h-3 w-3 text-slate-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                        </svg>
                                                    ) : (
                                                        p.name ? p.name.charAt(0).toUpperCase() : '?'
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="truncate font-bold">{p.name || "Unknown"}</div>
                                                    <div className="text-[10px] text-slate-400 font-normal truncate">{p.role}</div>
                                                </div>
                                                {p.id === interview.participantId && <span className="text-indigo-600">✓</span>}
                                            </button>
                                        )) : (
                                            <div className="text-xs text-slate-400 p-2 text-center">No personas found.</div>
                                        )}
                                        <button
                                            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold text-brand-600 hover:bg-brand-50 flex items-center gap-2 border-t border-slate-100 mt-1 pt-2 transition ${isPending ? 'opacity-50 cursor-wait' : ''}`}
                                            disabled={isPending}
                                            onClick={() => {
                                                setPendingAction('createPersona');
                                                startTransition(async () => {
                                                    try {
                                                        await createPersonaFromInterviewAction(projectId, studyId, interview.id);
                                                        setIsLinkingPersona(false);
                                                        router.refresh();
                                                    } catch (e) {
                                                        alert("Failed to create persona");
                                                    } finally {
                                                        setPendingAction(null);
                                                    }
                                                });
                                            }}
                                        >
                                            <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-bold border border-brand-200">
                                                {isPending && pendingAction === 'createPersona' ? (
                                                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                ) : '+'}
                                            </div>
                                            <div className="flex-1">
                                                <div className="font-black">Create from Interview</div>
                                                <div className="text-[10px] text-brand-400 font-normal">Extract persona from this session</div>
                                            </div>
                                        </button>
                                        <div className="border-t border-slate-100 my-1"></div>
                                        <button
                                            onClick={() => router.push(`/projects/${projectId}?tab=personas`)}
                                            className="w-full text-left px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-50 flex items-center justify-center"
                                        >
                                            Manage All Personas
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Close overlay for popover */}
                            {isLinkingPersona && (
                                <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsLinkingPersona(false)}></div>
                            )}
                        </div>
                        <p className="text-xs text-slate-500" suppressHydrationWarning>
                            {interview.date} {interview.startTime ? `• ${interview.startTime}` : ''} • {studyTitle}
                        </p>
                    </div>
                </div >
            </header >

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[calc(100vh-140px)]">
                {/* Left: Transcript / Media / Summary Panel */}
                <div className="bg-white rounded-xl border border-slate-200 flex flex-col overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center text-slate-500">
                        <div className="flex bg-slate-200/50 p-1 rounded-lg">
                            <button
                                onClick={() => setActiveTab('transcript')}
                                className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${activeTab === 'transcript' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                💬 녹취록 (Transcript)
                            </button>
                            <button
                                onClick={() => setActiveTab('video')}
                                className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${activeTab === 'video' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                🎥 미디어 (Media)
                            </button>
                            <button
                                onClick={() => setActiveTab('memo')}
                                className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${activeTab === 'memo' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                🗒️ 메모 (Memo)
                            </button>
                        </div>
                    </div>

                    {activeTab === 'transcript' && (
                        <div className="flex-1 flex flex-col min-h-0 relative">
                            {isLoadingFull && (
                                <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="animate-spin text-brand-600 text-2xl">↻</div>
                                        <p className="text-xs font-bold text-slate-500">데이터를 불러오는 중...</p>
                                    </div>
                                </div>
                            )}
                            <TranscriptTab
                                interview={interview}
                                transcriptData={transcriptData}
                                speakers={speakers}
                                setSpeakers={setSpeakers}
                                handleSaveSpeakers={handleSaveSpeakers}
                                isSavingSpeakers={isSavingSpeakers}
                                audioRef={audioRef}
                                currentTime={currentTime}
                                duration={duration}
                                playbackRate={playbackRate}
                                isPlaying={isPlaying}
                                togglePlay={togglePlay}
                                handleSpeedChange={handleSpeedChange}
                                handleSeek={handleSeek}
                                handleTimeUpdate={handleTimeUpdate}
                                handleLoadedMetadata={handleLoadedMetadata}
                                handleUploadAudio={handleUploadAudio}
                                handleUploadTranscript={handleUploadTranscript}
                                isUploading={isUploading}
                                currentSegmentIndex={currentSegmentIndex}
                                handleJumpToTimestamp={handleJumpToTimestamp}
                                handleAutoTranscribeClick={handleAutoTranscribeClick}
                                formatTime={formatTime}
                                speakerCount={speakerCount}
                                setSpeakerCount={setSpeakerCount}
                                interviewerName={interviewerNameInput}
                                setInterviewerName={setInterviewerNameInput}
                                onStartTranscription={confirmTranscribe}
                                onDeleteSpeaker={handleDeleteSpeaker}
                            />
                        </div>
                    )}

                    {activeTab === 'video' && (
                        <VideoTab
                            videoUrl={interview.videoUrl}
                            handleSaveVideoUrl={handleSaveVideoUrl}
                            handleUploadVideo={handleUploadVideo}
                            isUploading={isUploading}
                            videoRef={videoRef}
                        />
                    )}

                    {activeTab === 'memo' && (
                        <MemoTab
                            notes={notes}
                            handleNoteUpdate={handleNoteUpdate}
                            guideBlocks={guideBlocks}
                        />
                    )}
                </div>

                {/* Right Panel: Insights and Feedback */}
                <div className="bg-white rounded-xl border border-slate-200 flex flex-col overflow-hidden shadow-sm h-full relative">
                    {isPending && (pendingAction === rightPanelTab) && (
                        <div className="absolute top-0 left-0 w-full h-1 bg-indigo-100 z-50 overflow-hidden">
                            <div className="h-full bg-indigo-600 animate-indeterminate-progress origin-left"></div>
                        </div>
                    )}
                    <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                        <div className="flex bg-slate-200/50 p-1 rounded-lg">
                            <button
                                onClick={() => setRightPanelTab('summary')}
                                className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${rightPanelTab === 'summary' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                📝 요약
                            </button>
                            <button
                                onClick={() => setRightPanelTab('insights')}
                                className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${rightPanelTab === 'insights' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                💡 인사이트
                            </button>

                            <button
                                onClick={() => setRightPanelTab('feedback')}
                                className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${rightPanelTab === 'feedback' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                🙋 피드백
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                            {rightPanelTab === 'summary' && interview.summary && interview.summary !== 'Live interview recording.' ? (
                                <button
                                    onClick={() => {
                                        setPendingAction('summary');
                                        startTransition(async () => {
                                            await generateSummaryAction(projectId, studyId, interview.id);
                                            setPendingAction(null);
                                        });
                                    }}
                                    disabled={isPending}
                                    className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1
                                    ${isPending
                                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                            : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                        }`}
                                >
                                    {isPending ? '생성 중...' : '⚡ 재 요약하기'}
                                </button>
                            ) : rightPanelTab === 'insights' && insights.length > 0 ? (
                                <>
                                    <button onClick={() => setShowAddInsight(true)} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition">+ Add</button>
                                    <button
                                        onClick={handleReanalyze}
                                        disabled={isPending || !interview.content}
                                        title={!interview.content ? "전사 데이터가 필요합니다" : ""}
                                        className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1
                                        ${isPending || !interview.content
                                                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                                : 'bg-brand-50 text-brand-700 border-brand-200 hover:bg-brand-100'
                                            }`}
                                    >
                                        {isPending && pendingAction === 'insights' ? '분석 중...' : '🔄 재분석'}
                                    </button>
                                </>
                            ) : rightPanelTab === 'feedback' && (interview.interviewerFeedback || interview.content) ? (
                                <button
                                    onClick={() => {
                                        if (!interview.content) {
                                            alert("전사 데이터가 없습니다.");
                                            return;
                                        }
                                        console.log("[InterviewReport] Starting Feedback Generation...");
                                        setPendingAction('feedback');
                                        startTransition(async () => {
                                            try {
                                                await generateFeedbackAction(projectId, studyId, interview.id);
                                                console.log("[InterviewReport] Feedback Action Complete. Refreshing...");
                                                router.refresh();
                                            } catch (e: any) {
                                                console.error("Feedback generation failed:", e);
                                                alert(`평가 실패: ${e.message}`);
                                            } finally {
                                                setPendingAction(null);
                                            }
                                        });
                                    }}
                                    disabled={isPending || !interview.content}
                                    title={!interview.content ? "전사 데이터가 필요합니다" : ""}
                                    className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1
                                    ${isPending || !interview.content
                                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                            : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                        }`}
                                >
                                    {isPending ? '평가 중...' : (interview.interviewerFeedback ? '⚡ 재평가하기' : '🎓 평가 시작하기')}
                                </button>
                            ) : null}


                            <button onClick={handleCopyAll} className="p-1.5 rounded-lg border bg-white hover:bg-slate-50">{coppied ? '✅' : '📋'}</button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6">
                        {(!transcriptData && !interview.content && !interview.audioUrl && !interview.videoUrl && insights.length === 0) ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4">
                                <div className="text-4xl filter grayscale opacity-30">🔒</div>
                                <div className="text-center">
                                    <p className="font-bold text-slate-600">분석 데이터가 없습니다.</p>
                                    <p className="text-xs mt-1 text-slate-400">분석을 시작하려면 좌측 패널에서<br />녹취록이나 음성 파일을 등록해주세요.</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                <>
                                    {rightPanelTab === 'insights' && (
                                        <InsightsTab
                                            interview={interview}
                                            isAnalyzing={isPending && pendingAction === 'insights'}
                                            showAddInsight={showAddInsight}
                                            onAddInsightCancel={() => setShowAddInsight(false)}
                                            onAddInsightSubmit={async (data) => {
                                                await addManualInsightAction(projectId, studyId, interview.id, data);
                                                setShowAddInsight(false);
                                            }}
                                            onReanalyze={handleReanalyze}
                                            onJump={handleJumpToTimestamp}
                                            researchQuestions={researchQuestions}
                                            onDeleteInsight={handleDeleteInsight}
                                            onUpdateInsight={handleUpdateInsight}
                                        />
                                    )}
                                    {rightPanelTab === 'summary' && (
                                        <SummaryTab
                                            interview={interview}
                                            isAnalyzing={isPending && pendingAction === 'summary'}
                                            onGenerate={() => {
                                                setPendingAction('summary');
                                                startTransition(async () => {
                                                    await generateSummaryAction(projectId, studyId, interview.id);
                                                    setPendingAction(null);
                                                });
                                            }}
                                        />
                                    )}
                                    {rightPanelTab === 'feedback' && (
                                        <FeedbackTab
                                            interview={interview}
                                            isAnalyzing={isPending && pendingAction === 'feedback'}
                                            onGenerate={() => {
                                                setPendingAction('feedback');
                                                startTransition(async () => {
                                                    try {
                                                        await generateFeedbackAction(projectId, studyId, interview.id);
                                                    } catch (e: any) {
                                                        alert("피드백 생성 실패: " + (e.message || "알 수 없는 오류"));
                                                    } finally {
                                                        setPendingAction(null);
                                                    }
                                                });
                                            }}
                                            onJump={handleJumpToTimestamp}
                                        />
                                    )}
                                </>
                            </>
                        )}
                    </div>
                </div>
            </div>


            {
                selectedPersona && (
                    <PersonaDetail
                        persona={selectedPersona}
                        interviews={allInterviews.filter(i => i.participantId === selectedPersona.id)}
                        projectId={projectId}
                        onClose={() => setSelectedPersona(null)}
                        onSave={async (updated) => {
                            await updatePersonaAction(projectId, updated);
                            setSelectedPersona(updated); // Update local state if we kept it open, but we close it below? 
                            // Actually previous code closed it. Let's keep it consistent or improve it.
                            // If I close it, I don't need to update selectedPersona.
                            setSelectedPersona(null);
                            router.refresh();
                        }}
                    />
                )
            }
        </div >
    );
}
