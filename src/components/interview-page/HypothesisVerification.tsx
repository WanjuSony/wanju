'use client';

import { RealInterview } from '@/lib/types';
import { useState, useEffect, useRef } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { updateInterviewHypothesisReviewAction } from '@/app/actions';

interface Props {
    interview: RealInterview;
    projectId: string;
    studyId: string;
    researchQuestions: string[];
}

export function HypothesisVerification({ interview, projectId, studyId, researchQuestions }: Props) {
    const reviews = interview.hypothesisReviews || {};

    // Status color mapping
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'supported': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'refuted': return 'bg-rose-100 text-rose-700 border-rose-200';
            case 'partial': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'inconclusive': return 'bg-slate-100 text-slate-600 border-slate-200';
            default: return 'bg-white text-slate-400 border-slate-200 hover:border-slate-300';
        }
    };

    const handleUpdate = async (index: number, status: string, comment: string) => {
        try {
            await updateInterviewHypothesisReviewAction(
                projectId,
                studyId,
                interview.id,
                index.toString(),
                status as any,
                comment
            );
        } catch (e) {
            console.error('Failed to update hypothesis review', e);
        }
    };

    return (
        <div className="space-y-4">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <span className="text-xl">🧪</span>
                가설 검증 (Hypothesis Verification)
            </h3>

            <div className="grid gap-4">
                {researchQuestions.map((question, index) => {
                    const review = reviews[index.toString()] || { status: 'unreviewed', comment: '' };

                    return (
                        <HypothesisItem
                            key={index}
                            index={index}
                            question={question}
                            initialStatus={review.status}
                            initialComment={review.comment}
                            onSave={(status, comment) => handleUpdate(index, status, comment)}
                        />
                    );
                })}

                {researchQuestions.length === 0 && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center text-slate-500 text-sm">
                        등록된 가설이 없습니다.
                    </div>
                )}
            </div>
        </div>
    );
}

// Sub-component to handle independent state and debouncing
function HypothesisItem({ index, question, initialStatus, initialComment, onSave }: {
    index: number;
    question: string;
    initialStatus: string;
    initialComment: string;
    onSave: (status: string, comment: string) => void
}) {
    const [status, setStatus] = useState(initialStatus);
    const [comment, setComment] = useState(initialComment);
    const commentRef = useRef(initialComment);

    const handleStatusChange = (newStatus: string) => {
        setStatus(newStatus);
        onSave(newStatus, comment);
    };

    const handleCommentBlur = () => {
        if (comment !== commentRef.current) {
            onSave(status, comment);
            commentRef.current = comment;
        }
    };

    return (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-indigo-100 transition-colors">
            <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1 space-y-3">
                    <div className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 font-bold text-xs flex items-center justify-center mt-0.5">
                            Q{index + 1}
                        </span>
                        <p className="text-slate-800 font-medium text-sm leading-relaxed">{question}</p>
                    </div>

                    {/* Status Selection */}
                    <div className="flex flex-wrap gap-2 pl-9">
                        {[
                            { value: 'supported', label: '✅ 입증됨 (Supported)' },
                            { value: 'refuted', label: '❌ 반박됨 (Refuted)' },
                            { value: 'partial', label: '⚠️ 부분 입증 (Partial)' },
                            { value: 'inconclusive', label: '❓ 판단 불가 (Inconclusive)' }
                        ].map((option) => (
                            <button
                                key={option.value}
                                onClick={() => handleStatusChange(option.value)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all
                                    ${status === option.value
                                        ? 'ring-2 ring-offset-1 ' + (
                                            option.value === 'supported' ? 'bg-emerald-50 text-emerald-700 border-emerald-500 ring-emerald-500' :
                                                option.value === 'refuted' ? 'bg-rose-50 text-rose-700 border-rose-500 ring-rose-500' :
                                                    option.value === 'partial' ? 'bg-amber-50 text-amber-700 border-amber-500 ring-amber-500' :
                                                        'bg-slate-50 text-slate-700 border-slate-500 ring-slate-500'
                                        )
                                        : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                    }`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Comment Area */}
                <div className="md:w-1/3 flex-shrink-0 pl-9 md:pl-0">
                    <TextareaAutosize
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        onBlur={handleCommentBlur}
                        placeholder="검증 근거 및 비고 작성 (작성 후 커서를 떼면 자동 저장)"
                        className="w-full text-sm p-3 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all resize-none leading-relaxed"
                        minRows={3}
                    />
                </div>
            </div>
        </div>
    );
}
