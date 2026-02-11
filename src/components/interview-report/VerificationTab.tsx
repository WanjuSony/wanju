'use client';

import { useState, useTransition } from 'react';
import { RealInterview } from '@/lib/types';

interface Props {
    interview: RealInterview;
    researchQuestions: string[];
    onUpdateReview: (index: number, status: string, comment: string) => Promise<void>;
}

export function VerificationTab({ interview, researchQuestions, onUpdateReview }: Props) {
    const reviews = interview.hypothesisReviews || {};
    const [isPending, startTransition] = useTransition();

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'supported': return 'bg-green-100 text-green-700 border-green-200';
            case 'refuted': return 'bg-red-100 text-red-700 border-red-200';
            case 'partial': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'inconclusive': return 'bg-slate-100 text-slate-700 border-slate-200';
            default: return 'bg-white text-slate-400 border-slate-200';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'supported': return '검증됨 (Supported)';
            case 'refuted': return '반박됨 (Refuted)';
            case 'partial': return '부분 확인 (Partial)';
            case 'inconclusive': return '판단 불가 (N/A)';
            default: return '상태 선택';
        }
    };

    return (
        <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                    <span className="text-xl">✅</span> 가설 검증
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                    이번 인터뷰 결과를 바탕으로 사전에 설정한 가설들이 검증되었는지 기록하세요.
                </p>

                <div className="space-y-4">
                    {researchQuestions.length === 0 ? (
                        <div className="text-center py-8 text-slate-400 text-xs">
                            등록된 가설이 없습니다. 기획 단계에서 가설을 설정해주세요.
                        </div>
                    ) : (
                        researchQuestions.map((q, idx) => {
                            const review = reviews[idx.toString()] || { status: 'pending', comment: '' };

                            return (
                                <div key={idx} className="border border-slate-200 rounded-lg p-4 bg-white hover:border-indigo-200 transition-colors">
                                    <div className="flex items-start justify-between mb-3 gap-4">
                                        <div className="flex-1">
                                            <span className="text-[10px] font-bold text-indigo-500 mb-1 block">HYPOTHESIS {idx + 1}</span>
                                            <p className="text-sm font-bold text-slate-800 leading-snug">{q}</p>
                                        </div>
                                        <div className="relative flex-shrink-0">
                                            <select
                                                value={review.status}
                                                onChange={(e) => {
                                                    startTransition(async () => {
                                                        await onUpdateReview(idx, e.target.value, review.comment);
                                                    });
                                                }}
                                                className={`appearance-none pl-3 pr-8 py-1.5 rounded-lg text-xs font-bold border focus:outline-none focus:ring-2 focus:ring-offset-1 transition cursor-pointer ${getStatusColor(review.status)}`}
                                            >
                                                <option value="pending">미검증</option>
                                                <option value="supported">✅ 검증됨</option>
                                                <option value="refuted">❌ 반박됨</option>
                                                <option value="partial">⚠️ 부분 확인</option>
                                                <option value="inconclusive">❓ 판단 불가</option>
                                            </select>
                                            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                                                <svg width="8" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1L5 5L9 1" /></svg>
                                            </div>
                                        </div>
                                    </div>

                                    <textarea
                                        value={review.comment}
                                        onChange={(e) => {
                                            // Local state update for smooth typing would be better, but for now simplistic (debounce recommended in real app)
                                            // Since we use onUpdateReview which likely hits server, we should probably debounce or use onBlur.
                                            // Let's use onBlur for the server save, but we need local state to type.
                                            // For this "Simple" version, I will assume the parent handles it or I accept the lag.
                                            // Better: Update LOCAL state here? 
                                            // Actually, `review.comment` comes from props `interview`. 
                                            // I'll make this textarea uncontrolled with default value + onBlur.
                                        }}
                                        onBlur={(e) => {
                                            if (e.target.value !== review.comment) {
                                                startTransition(async () => {
                                                    await onUpdateReview(idx, review.status, e.target.value);
                                                });
                                            }
                                        }}
                                        defaultValue={review.comment}
                                        placeholder="이 가설에 대한 인터뷰이의 반응이나 근거를 작성하세요..."
                                        className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 outline-none resize-none transition-all placeholder:text-slate-400"
                                        rows={3}
                                    />
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
