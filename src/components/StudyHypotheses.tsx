'use client';

import { useState, useTransition } from 'react';
import { updateStudyPlanFieldsAction } from '@/app/actions';
import { RealInterview } from '@/lib/types';

interface Props {
    projectId: string;
    studyId: string;
    initialQuestions: string[];
    verifications?: Record<string, {
        status: 'supported' | 'refuted' | 'partial' | 'inconclusive' | 'pending';
        evidence: string;
    }>;
    sessions?: RealInterview[];
}

export function StudyHypotheses({ projectId, studyId, initialQuestions, verifications, sessions = [] }: Props) {
    const [questions, setQuestions] = useState(initialQuestions);
    const [localVerifications, setLocalVerifications] = useState(verifications || {});

    // Edit Questions Mode
    const [isEditingQuestions, setIsEditingQuestions] = useState(false);
    const [draftQuestions, setDraftQuestions] = useState(initialQuestions);

    // UX: Dropdown state for status selection
    const [openStatusMenuIndex, setOpenStatusMenuIndex] = useState<number | null>(null);

    // UX: Show/Hide Unlinked
    const [unlinkedVisibleSet, setUnlinkedVisibleSet] = useState<Set<number>>(new Set());

    // Evidence Edit State
    const [expandedEvidence, setExpandedEvidence] = useState<Set<number>>(new Set());

    const [isPending, startTransition] = useTransition();

    // --- Question Editing Logic ---

    const handleEditQuestions = () => {
        setDraftQuestions(questions);
        setIsEditingQuestions(true);
    };

    const handleCancelEditQuestions = () => {
        setIsEditingQuestions(false);
        setDraftQuestions(questions);
    };

    const handleSaveQuestions = () => {
        startTransition(async () => {
            try {
                const cleanQuestions = draftQuestions.filter(q => q.trim() !== '');
                await updateStudyPlanFieldsAction(projectId, studyId, { researchQuestions: cleanQuestions });
                setQuestions(cleanQuestions);
                setIsEditingQuestions(false);
            } catch (e) {
                console.error(e);
                alert('저장 중 오류가 발생했습니다.');
            }
        });
    };

    const handleQuestionChange = (index: number, value: string) => {
        const newDraft = [...draftQuestions];
        newDraft[index] = value;
        setDraftQuestions(newDraft);
    };

    const handleAddQuestion = () => {
        setDraftQuestions([...draftQuestions, '']);
    };

    const handleRemoveQuestion = (index: number) => {
        const newDraft = draftQuestions.filter((_, i) => i !== index);
        setDraftQuestions(newDraft);
    };

    // --- Verification Logic ---

    const handleStatusChange = (index: number, status: string) => {
        const idxStr = index.toString();
        const current = localVerifications[idxStr] || { status: 'pending', evidence: '' };

        const updated = {
            ...localVerifications,
            [idxStr]: { ...current, status: status as any }
        };

        setLocalVerifications(updated);
        setOpenStatusMenuIndex(null);

        startTransition(async () => {
            await updateStudyPlanFieldsAction(projectId, studyId, { hypothesisVerifications: updated });
        });
    };

    const handleEvidenceChange = (index: number, value: string) => {
        const idxStr = index.toString();
        const current = localVerifications[idxStr] || { status: 'pending', evidence: '' };

        const updated = {
            ...localVerifications,
            [idxStr]: { ...current, evidence: value }
        };

        setLocalVerifications(updated);
    };

    const handleEvidenceBlur = (index: number) => {
        startTransition(async () => {
            await updateStudyPlanFieldsAction(projectId, studyId, { hypothesisVerifications: localVerifications });
        });
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'supported': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
            case 'refuted': return 'bg-rose-100 text-rose-800 border-rose-200';
            case 'partial': return 'bg-amber-100 text-amber-800 border-amber-200';
            case 'inconclusive': return 'bg-slate-100 text-slate-600 border-slate-200';
            default: return 'bg-slate-50 text-slate-500 border-slate-200'; // pending
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'supported': return '✅ 입증됨';
            case 'refuted': return '❌ 반박됨';
            case 'partial': return '⚠️ 부분 입증';
            case 'inconclusive': return '❓ 판단 불가';
            default: return '⏳ 진행 중';
        }
    };

    // Helper to extract insights from sessions for a specific question
    const getRelatedInsights = (questionIndex: number, questionText: string, includeUnlinked: boolean = false) => {
        const results: {
            sessionTitle: string;
            sessionId: string;
            type: 'review' | 'insight';
            content: string;
            status?: string;
        }[] = [];

        // DEBUG: Check data flow
        if (questionIndex === 0) {
            console.log(`[StudyHypotheses] Checking insights for Q${questionIndex}:`, { sessionsCount: sessions.length, questionText });
        }

        sessions.forEach((session, sessionIndex) => {
            // Determine display title
            // User Request: Use title by default ("1. 문정호 대표님"), 
            // but if it's the generic "Live Interview" (e.g. for Personas), try to use Participant Name ("김여름님").
            let displayTitle = session.title;
            // Enhanced Regex: Matches "Live Interview", "Transcript", "트랜스크립트", "Untitled", or simple file extensions/defaults
            // Also optionally matches leading numbers/dots e.g. "4. Transcript"
            const isGenericTitle = session.title.match(/^(?:\d+[\.\s]*)?(Live Interview|Transcript|트랜스크립트|Untitled|Unknown)/i);

            if (isGenericTitle) {
                const participant = session.speakers?.find(s => s.role === 'participant');
                const participantName = participant ? participant.name : '참여자';
                displayTitle = `${sessionIndex + 1}. ${participantName}`;
            }

            // 1. Manual User Reviews (Verification Tab)
            const review = session.hypothesisReviews?.[questionIndex.toString()];
            // Legacy support: check message vs comment
            const legacyReview = review as any;

            // Strict check: Must have content OR a meaningful status change
            const hasContent = (review && review.comment) || (legacyReview && legacyReview.message);
            const hasStatus = review && review.status && review.status !== 'pending';

            if (hasContent || hasStatus) {
                results.push({
                    sessionTitle: displayTitle,
                    sessionId: session.id,
                    type: 'review',
                    content: (review && review.comment) || (legacyReview && legacyReview.message) || '(코멘트 없음)',
                    status: review?.status
                });
            }

            // 2. AI Structured Insights
            if (session.structuredData) {
                session.structuredData.forEach(insight => {
                    const qText = questionText.trim().toLowerCase();
                    const iQuestion = insight.researchQuestion ? insight.researchQuestion.trim().toLowerCase() : '';
                    const iContent = insight.content ? insight.content.trim().toLowerCase() : '';

                    let isMatch = false;

                    // 1. Check 'researchQuestion' field
                    if (iQuestion) {
                        // Text Matching
                        const isTextMatch = qText === iQuestion ||
                            iQuestion.includes(qText) ||
                            qText.includes(iQuestion) ||
                            (qText.length > 20 && iQuestion.includes(qText.slice(0, 20)));

                        // Index Matching (e.g. "Q1. ...", "Regarding RQ1")
                        // Match anywhere in string, look for digit after Q/RQ/Question
                        const prefixMatch = iQuestion.match(/(?:rq|q|question)\s*[\.\:\-\)]?\s*(\d+)/i);
                        const isIndexMatch = prefixMatch && parseInt(prefixMatch[1]) === (questionIndex + 1);

                        if (isTextMatch || isIndexMatch) isMatch = true;
                    }

                    // 2. Check 'content' field for Index Prefix (Backup)
                    if (!isMatch && iContent) {
                        const prefixMatch = iContent.match(/(?:rq|q|question)\s*[\.\:\-\)]?\s*(\d+)/i);
                        if (prefixMatch && parseInt(prefixMatch[1]) === (questionIndex + 1)) {
                            isMatch = true;
                        }
                    }

                    if (isMatch) {
                        // If we only want relevant ones
                        if (!includeUnlinked) {
                            results.push({
                                sessionTitle: displayTitle,
                                sessionId: session.id,
                                type: 'insight',
                                content: insight.content
                            });
                        }
                    }

                    // Fallback Logic: Collect unlinked insights
                    else if (includeUnlinked && !isMatch) {
                        // Only add if explicitly NOT matched
                        results.push({
                            sessionTitle: displayTitle,
                            sessionId: session.id,
                            type: 'insight',
                            content: insight.content
                        });
                    }
                });
            }
        });

        return results;
    };

    return (
        <div className="bg-brand-50/50 rounded-xl border border-brand-100/50 p-6 shadow-sm group hover:border-brand-200 transition-colors">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                    <div className="bg-brand-100 text-brand-600 w-8 h-8 rounded-lg flex items-center justify-center text-lg">
                        🧪
                    </div>
                    <div>
                        <h3 className="font-extrabold text-brand-700 text-sm">검증해야 할 리서치 질문 (Verification Goals)</h3>
                        <p className="text-[11px] text-brand-400 mt-0.5 font-medium">인터뷰를 통해 검증이 필요한 핵심 리서치 질문들입니다.</p>
                    </div>
                </div>

                <div className="flex gap-2">
                    {isEditingQuestions ? (
                        <>
                            <button
                                onClick={handleCancelEditQuestions}
                                className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-white/50 rounded transition"
                                disabled={isPending}
                            >
                                취소
                            </button>
                            <button
                                onClick={handleSaveQuestions}
                                disabled={isPending}
                                className="px-3 py-1.5 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded transition shadow-sm disabled:opacity-50"
                            >
                                {isPending ? '저장...' : '완료'}
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={handleEditQuestions}
                            className="px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 border shadow-sm bg-white text-brand-600 border-brand-200 hover:bg-brand-50"
                        >
                            ✏️ 리서치 질문 수정
                        </button>
                    )}
                </div>
            </div>

            {isEditingQuestions ? (
                <div className="space-y-3 pl-1">
                    {draftQuestions.map((q, i) => (
                        <div key={i} className="flex gap-3 items-start animate-in fade-in slide-in-from-left-2 duration-300" style={{ animationDelay: `${i * 50}ms` }}>
                            <span className="text-brand-600 font-extrabold text-xs mt-3 w-6 text-right">Q{i + 1}.</span>
                            <div className="flex-1 relative group/item">
                                <textarea
                                    value={q}
                                    onChange={(e) => handleQuestionChange(i, e.target.value)}
                                    className="w-full p-2.5 text-xs font-medium border border-brand-200 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none resize-none transition-all bg-white"
                                    rows={1}
                                    placeholder="가설을 입력하세요..."
                                    style={{ minHeight: '42px' }}
                                />
                                <button
                                    onClick={() => handleRemoveQuestion(i)}
                                    className="absolute right-2 top-2.5 text-slate-300 hover:text-red-500 opacity-0 group-hover/item:opacity-100 transition-opacity"
                                    title="삭제"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                    ))}
                    <div className="pl-9">
                        <button
                            onClick={handleAddQuestion}
                            className="text-xs font-bold text-brand-500 hover:text-brand-700 hover:bg-brand-100/50 px-4 py-2.5 rounded-lg transition-all w-full border border-dashed border-brand-300 hover:border-brand-400 flex items-center justify-center gap-2"
                        >
                            <span>+</span> 질문 추가하기
                        </button>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {questions.length > 0 ? (
                        questions.map((q, i) => {
                            const review = localVerifications[i.toString()] || { status: 'pending', evidence: '' };
                            const relatedInsights = getRelatedInsights(i, q);

                            return (
                                <div key={i} className="flex flex-col gap-2 px-2 py-2 hover:bg-brand-50/50 rounded-lg transition-colors group/item border border-transparent hover:border-brand-100 relative">
                                    <div className="flex gap-2.5 items-center">
                                        <div
                                            className="flex items-center gap-2 cursor-pointer select-none"
                                            onClick={() => {
                                                const newExpanded = new Set(expandedEvidence);
                                                if (newExpanded.has(i)) newExpanded.delete(i);
                                                else newExpanded.add(i);
                                                setExpandedEvidence(newExpanded);
                                            }}
                                        >
                                            <span className="text-brand-600 font-extrabold whitespace-nowrap text-xs">Q{i + 1}.</span>
                                            <span className="text-slate-400 hover:text-slate-600 transition-colors">
                                                {expandedEvidence.has(i) ? (
                                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                ) : (
                                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                                                    </svg>
                                                )}
                                            </span>
                                        </div>

                                        <div className="flex-1">
                                            <div className="flex items-start md:items-center gap-2 flex-col md:flex-row flex-wrap">
                                                <span className="leading-relaxed text-slate-800 text-xs font-medium mr-1 cursor-pointer"
                                                    onClick={() => {
                                                        const newExpanded = new Set(expandedEvidence);
                                                        if (newExpanded.has(i)) newExpanded.delete(i);
                                                        else newExpanded.add(i);
                                                        setExpandedEvidence(newExpanded);
                                                    }}
                                                >{q}</span>

                                                <div className="relative">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setOpenStatusMenuIndex(openStatusMenuIndex === i ? null : i);
                                                        }}
                                                        className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold border transition-all hover:brightness-95 ${getStatusColor(review.status || 'pending')}`}
                                                    >
                                                        {getStatusLabel(review.status || 'pending')}
                                                    </button>

                                                    {openStatusMenuIndex === i && (
                                                        <>
                                                            <div
                                                                className="fixed inset-0 z-40 cursor-default"
                                                                onClick={() => setOpenStatusMenuIndex(null)}
                                                            />
                                                            <div className="absolute top-full left-0 mt-1 w-32 bg-white rounded-lg shadow-xl border border-slate-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                                                {[
                                                                    { value: 'pending', label: '⏳ 진행 중' },
                                                                    { value: 'supported', label: '✅ 입증됨' },
                                                                    { value: 'refuted', label: '❌ 반박됨' },
                                                                    { value: 'partial', label: '⚠️ 부분 입증' },
                                                                    { value: 'inconclusive', label: '❓ 판단 불가' }
                                                                ].map((opt) => (
                                                                    <button
                                                                        key={opt.value}
                                                                        onClick={() => handleStatusChange(i, opt.value)}
                                                                        className={`w-full text-left px-3 py-2 text-[11px] font-bold hover:bg-slate-50 transition-colors flex items-center gap-2
                                                                            ${review.status === opt.value ? 'bg-brand-50 text-brand-700' : 'text-slate-600'}`}
                                                                    >
                                                                        {opt.label}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </>
                                                    )}
                                                </div>

                                                {/* Insight Count Badge */}
                                                {relatedInsights.length > 0 && !expandedEvidence.has(i) && (
                                                    <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full font-bold">
                                                        {relatedInsights.length}개 인사이트
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {expandedEvidence.has(i) && (
                                        <div className="pl-7 pr-2 animate-in fade-in slide-in-from-top-1 duration-200 mt-2 space-y-4">
                                            {/* Overall Study Evidence */}
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-400 mb-1.5 block">종합 검증 의견</label>
                                                <textarea
                                                    value={review.evidence || ''}
                                                    onChange={(e) => handleEvidenceChange(i, e.target.value)}
                                                    onBlur={() => handleEvidenceBlur(i)}
                                                    placeholder="전체 데이터를 종합했을 때 이 가설에 대한 결론은 무엇인가요?"
                                                    className="w-full text-[11px] text-slate-600 bg-white p-3 rounded border border-slate-200 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 outline-none resize-none leading-relaxed min-h-[80px]"
                                                />
                                            </div>

                                            {/* Related Interviews/Insights */}
                                            <div className="bg-white rounded-lg border border-slate-100 p-3">
                                                <h4 className="text-[10px] font-bold text-slate-500 mb-3 flex items-center gap-2">
                                                    <span>🧠</span> 관련 인터뷰 인사이트 ({relatedInsights.length})
                                                </h4>

                                                {relatedInsights.length > 0 && (
                                                    <div className="space-y-3">
                                                        {relatedInsights.map((insight, idx) => (
                                                            <div key={idx} className="flex gap-2 items-start border-b border-slate-50 last:border-0 pb-2 last:pb-0">
                                                                <div className="shrink-0 mt-0.5">
                                                                    {insight.type === 'review' ? (
                                                                        <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-bold">Review</span>
                                                                    ) : (
                                                                        <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded font-bold">Insight</span>
                                                                    )}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-[11px] text-slate-700 leading-relaxed font-medium mb-1">
                                                                        {insight.content}
                                                                        {insight.status && (
                                                                            <span className={`ml-1.5 text-[9px] px-1 rounded border inline-block ${insight.status === 'supported' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                                                insight.status === 'refuted' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                                                                                    'bg-slate-50 text-slate-500 border-slate-100'
                                                                                }`}>
                                                                                {getStatusLabel(insight.status)}
                                                                            </span>
                                                                        )}
                                                                    </p>
                                                                    <p className="text-[10px] text-slate-400 flex items-center gap-1">
                                                                        <span>출처:</span>
                                                                        <a href={`/projects/${projectId}/studies/${studyId}/interview/${insight.sessionId}`} className="hover:text-brand-600 underline decoration-slate-200 hover:decoration-brand-300">
                                                                            {insight.sessionTitle}
                                                                        </a>
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Always Show Unlinked Insights Toggle if available */}
                                                {getRelatedInsights(i, q, true).length > 0 && (
                                                    <div className={`mt-4 pt-3 ${relatedInsights.length > 0 ? 'border-t border-slate-100' : ''}`}>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const newSet = new Set(unlinkedVisibleSet);
                                                                if (newSet.has(i)) newSet.delete(i);
                                                                else newSet.add(i);
                                                                setUnlinkedVisibleSet(newSet);
                                                            }}
                                                            className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-slate-600 mb-2 transition-colors w-full text-left"
                                                        >
                                                            <span>{unlinkedVisibleSet.has(i) ? '▼' : '▶'}</span>
                                                            <span>📌 분류되지 않은 전체 인사이트 ({getRelatedInsights(i, q, true).length})</span>
                                                        </button>

                                                        {unlinkedVisibleSet.has(i) && (
                                                            <div className="space-y-3 opacity-75 animate-in fade-in slide-in-from-top-1 duration-200 pl-2 border-l-2 border-slate-100 mt-2">
                                                                {getRelatedInsights(i, q, true).slice(0, 10).map((insight, idx) => (
                                                                    <div key={`unlinked-${idx}`} className="flex gap-2 items-start border-b border-slate-50 last:border-0 pb-2 last:pb-0">
                                                                        <div className="shrink-0 mt-0.5">
                                                                            <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold">General</span>
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className="text-[11px] text-slate-700 leading-relaxed font-medium mb-1">
                                                                                {insight.content}
                                                                            </p>
                                                                            <p className="text-[10px] text-slate-400 flex items-center gap-1">
                                                                                <span>출처:</span>
                                                                                <a href={`/projects/${projectId}/studies/${studyId}/interview/${insight.sessionId}`} className="hover:text-brand-600 underline decoration-slate-200 hover:decoration-brand-300">
                                                                                    {insight.sessionTitle}
                                                                                </a>
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                                {getRelatedInsights(i, q, true).length > 10 && (
                                                                    <p className="text-[10px] text-slate-400 text-center italic">
                                                                        ... and {getRelatedInsights(i, q, true).length - 10} more items
                                                                    </p>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Debug Info: Only show if expanded */}
                                                {unlinkedVisibleSet.has(i) && (
                                                    <div className="mt-4 pt-4 border-t border-slate-50">
                                                        <details className="text-[10px] text-slate-300">
                                                            <summary className="cursor-pointer hover:text-slate-500">Debug Data Info</summary>
                                                            <pre className="mt-2 bg-slate-50 p-2 rounded overflow-auto max-h-40 text-[9px] text-slate-500">
                                                                {JSON.stringify({
                                                                    sessionsCount: sessions.length,
                                                                    firstSession: sessions[0] ? {
                                                                        id: sessions[0].id,
                                                                        title: sessions[0].title,
                                                                        first3Insights: sessions[0].structuredData?.slice(0, 3).map(i => ({
                                                                            rqRaw: i.researchQuestion,
                                                                            contentStart: i.content.slice(0, 30)
                                                                        }))
                                                                    } : 'No sessions'
                                                                }, null, 2)}
                                                            </pre>
                                                        </details>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    ) : (
                        <div className="text-center py-6">
                            <p className="text-brand-400 italic text-xs mb-3">등록된 가설이 없습니다.</p>
                            <button
                                onClick={handleEditQuestions}
                                className="text-xs font-bold text-brand-600 bg-brand-50 hover:bg-brand-100 px-4 py-2 rounded-lg transition-colors inline-flex items-center gap-2"
                            >
                                <span>+</span> 첫 번째 가설 추가하기
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

