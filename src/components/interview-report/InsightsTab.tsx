import React, { useState } from 'react';
import { RealInterview, StructuredInsight } from '@/lib/types';
import { AnalysisLoadingState } from './AnalysisLoadingState';
import { ManualInsightForm } from './ManualInsightForm';
import { InsightCard } from './InsightCard';

interface Props {
    interview: RealInterview;
    isAnalyzing: boolean;
    showAddInsight: boolean;
    onAddInsightCancel: () => void;
    onAddInsightSubmit: (data: any) => Promise<void>;
    onReanalyze: () => void;
    onJump: (ref: string) => void;
    researchQuestions?: string[];
    onDeleteInsight?: (id: string) => void;
    onUpdateInsight?: (id: string, data: any) => void;
}

export function InsightsTab({
    interview,
    isAnalyzing,
    showAddInsight,
    onAddInsightCancel,
    onAddInsightSubmit,
    onReanalyze,
    onJump,
    researchQuestions = [],
    onDeleteInsight,
    onUpdateInsight,
}: Props) {
    const insights = interview.structuredData || [];
    const facts = insights.filter(i => i.type === 'fact');
    const actions = insights.filter(i => i.type === 'action');
    const findings = insights.filter(i => i.type === 'insight');

    return (
        <div className="space-y-6">
            {showAddInsight && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={onAddInsightCancel}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-slate-200" onClick={e => e.stopPropagation()}>
                        <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center sticky top-0 z-10">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <span className="text-xl">✨</span> 새로운 인사이트 추가
                            </h3>
                            <button onClick={onAddInsightCancel} className="text-slate-400 hover:text-slate-600 transition">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                        <div className="p-6">
                            <ManualInsightForm
                                onCancel={onAddInsightCancel}
                                onSubmit={onAddInsightSubmit}
                                researchQuestions={researchQuestions}
                            />
                        </div>
                    </div>
                </div>
            )}

            {isAnalyzing ? (
                <AnalysisLoadingState message="인사이트를 분석하고 있습니다..." />
            ) : (
                <>
                    {(() => {
                        const grouped: Record<string, StructuredInsight[]> = {};

                        // Helper to find the index of a research question if the LLM output the exact string
                        const findRqIndex = (key: string) => {
                            const exactIndex = researchQuestions.findIndex(q => q.trim().toLowerCase() === key.trim().toLowerCase());
                            if (exactIndex !== -1) return exactIndex;

                            // Fallback to RQ1 notation match
                            const match = key.match(/RQ\s?(\d+)/i);
                            if (match) {
                                return parseInt(match[1]) - 1;
                            }
                            return -1;
                        };

                        findings.forEach(f => {
                            const rawKey = f.researchQuestion || 'General';
                            let rqKey = 'General';

                            const idx = findRqIndex(rawKey);
                            if (idx !== -1 && researchQuestions[idx]) {
                                rqKey = `RQ ${idx + 1}`;
                            } else if (rawKey !== 'General') {
                                // If it didn't match any index but is not General, keep it as its own bucket
                                rqKey = rawKey;
                            }

                            if (!grouped[rqKey]) grouped[rqKey] = [];
                            grouped[rqKey].push(f);
                        });

                        // Sort keys to ensure RQ 1, RQ 2, etc order (numeric sort). Non-RQ keys go to the end.
                        const sortedKeys = Object.keys(grouped).sort((a, b) => {
                            const numA = a.startsWith('RQ ') ? parseInt(a.replace(/\D/g, '')) : (a === 'General' ? 9999 : 1000);
                            const numB = b.startsWith('RQ ') ? parseInt(b.replace(/\D/g, '')) : (b === 'General' ? 9999 : 1000);
                            return numA - numB;
                        });

                        return sortedKeys.map((rqKey) => {
                            // Map "RQ 1" to actual text if available
                            let displayText = rqKey;
                            const rqMatch = rqKey.match(/RQ\s?(\d+)/i);
                            if (rqMatch && researchQuestions.length > 0) {
                                const idx = parseInt(rqMatch[1]) - 1;
                                if (researchQuestions[idx]) {
                                    displayText = `${rqKey}. ${researchQuestions[idx]}`;
                                }
                            }

                            return (
                                <div key={rqKey} className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <div className="h-px bg-slate-200 flex-1"></div>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 max-w-[80%] truncate" title={displayText}>
                                            {displayText}
                                        </span>
                                        <div className="h-px bg-slate-200 flex-1"></div>
                                    </div>
                                    <div className="space-y-3">
                                        {grouped[rqKey].map(item => (
                                            <InsightCard
                                                key={item.id}
                                                item={item}
                                                onJump={onJump}
                                                onDelete={onDeleteInsight}
                                                onUpdate={onUpdateInsight}
                                                researchQuestions={researchQuestions}
                                            />
                                        ))}
                                    </div>
                                </div>
                            );
                        });
                    })()}

                    {/* Actions and Facts */}
                    {actions.length > 0 && (
                        <div>
                            <h4 className="text-xs font-bold text-emerald-600 mb-3 bg-emerald-50 px-2 py-1 rounded inline-block">Action Items</h4>
                            <div className="space-y-3">
                                {actions.map(item => <InsightCard key={item.id} item={item} onJump={onJump} onDelete={onDeleteInsight} onUpdate={onUpdateInsight} researchQuestions={researchQuestions} />)}
                            </div>
                        </div>
                    )}

                    {facts.length > 0 && (
                        <div>
                            <h4 className="text-xs font-bold text-slate-500 mb-3 bg-slate-50 px-2 py-1 rounded inline-block">Key Facts</h4>
                            <div className="space-y-3">
                                {facts.map(item => <InsightCard key={item.id} item={item} onJump={onJump} onDelete={onDeleteInsight} onUpdate={onUpdateInsight} researchQuestions={researchQuestions} />)}
                            </div>
                        </div>
                    )}

                    {insights.length === 0 && (
                        <div className="p-10 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed text-xs space-y-4">
                            <p>분석된 인사이트가 없습니다.</p>
                            <button
                                onClick={onReanalyze}
                                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-indigo-700 transition"
                            >
                                🔄 분석 시작하기
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
