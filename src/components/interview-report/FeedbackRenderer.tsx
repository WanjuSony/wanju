import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
    feedback: string;
    onJump: (ref: string) => void;
}

export function FeedbackRenderer({ feedback, onJump }: Props) {
    // Try to parse JSON first
    const data = useMemo(() => {
        try {
            // Clean up potentially messy JSON (sometimes AI adds markdown blocks)
            const clean = feedback.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(clean);
        } catch (e) {
            return null;
        }
    }, [feedback]);

    if (!data || !data.score) {
        // Fallback to Markdown
        return (
            <div className="text-slate-600 leading-relaxed whitespace-pre-line feedback-content">
                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                        a: ({ node, href, children, ...props }) => {
                            if (href && href.startsWith('ts:')) {
                                const timestamp = href.replace('ts:', '');
                                return (
                                    <button
                                        onClick={() => onJump(timestamp)}
                                        className="text-indigo-600 font-bold hover:underline cursor-pointer bg-indigo-50 px-1 rounded mx-0.5 inline-block"
                                        title={`Jump to ${timestamp}`}
                                    >
                                        {children} ⏱️
                                    </button>
                                );
                            }
                            return <a href={href} className="text-blue-600 hover:underline" {...props}>{children}</a>;
                        },
                        table: ({ children }) => <div className="overflow-x-auto my-4"><table className="min-w-full divide-y divide-slate-200 border border-slate-200 text-sm">{children}</table></div>,
                        thead: ({ children }) => <thead className="bg-slate-50">{children}</thead>,
                        th: ({ children }) => <th className="px-3 py-2 text-left font-bold text-slate-700 border-b border-slate-200 whitespace-nowrap">{children}</th>,
                        td: ({ children }) => <td className="px-3 py-2 align-top text-slate-600 border-b border-slate-100">{children}</td>,
                        tr: ({ children }) => <tr className="hover:bg-slate-50/50 transition-colors">{children}</tr>
                    }}
                >
                    {feedback}
                </ReactMarkdown>
            </div>
        );
    }

    // New Card UI
    // Ensure score is treated as a number
    const scoreVal = typeof data.score === 'string' ? parseInt(data.score.replace(/[^0-9]/g, '')) || 0 : data.score;

    const getScoreColor = (s: number) => {
        if (s >= 70) return 'text-emerald-700 bg-emerald-50 border-emerald-200 ring-emerald-100'; // Good/Excellent (70+)
        if (s >= 50) return 'text-amber-700 bg-amber-50 border-amber-200 ring-amber-100'; // Needs Improvement (50-69)
        return 'text-rose-700 bg-rose-50 border-rose-200 ring-rose-100'; // Poor (<50)
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Score Header (Top Priority) - Compact Natural Style */}
            <div className="flex items-center justify-between p-5 bg-white rounded-xl border border-slate-100 shadow-sm relative overflow-hidden">
                <div className={`absolute inset-0 opacity-[0.03] transition-colors ${scoreVal >= 70 ? 'bg-emerald-600' : 'bg-amber-600'}`}></div>
                <div className="flex items-center gap-4 relative z-10 w-full">
                    <div className="flex-1">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-0.5">종합 점수 (Overall Score)</div>
                        <div className="text-xs text-slate-400">커버리지, 깊이, 중립성, 흐름을 기반으로 함</div>
                    </div>
                    <div className={`text-3xl font-black ${getScoreColor(scoreVal).split(' ')[0]}`}>
                        <span className="tracking-tight">{scoreVal}</span>
                        <span className="text-lg text-slate-300 font-medium ml-1">/100</span>
                    </div>
                </div>
            </div>

            {/* Overall Critique */}
            {data.overall_critique && (
                <div className="bg-indigo-50/50 p-6 rounded-xl border border-indigo-100 text-slate-700 leading-relaxed relative text-sm">
                    <div className="font-bold text-indigo-900 mb-2 flex items-center gap-2 text-xs uppercase tracking-wider">
                        <span>📝</span> 종합 요약 (Overall Summary)
                    </div>
                    {data.overall_critique}
                </div>
            )}

            {/* Strengths */}
            {data.strengths && data.strengths.length > 0 && (
                <div>
                    <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                        <span>✅</span> 강점 (Strengths)
                    </h4>
                    <div className="flex flex-wrap gap-2">
                        {data.strengths.map((s: any, idx: number) => {
                            const isObj = typeof s === 'object';
                            const text = isObj ? s.strength : s;
                            const quote = isObj ? s.quote : null;
                            const timestamp = isObj ? s.timestamp : null;

                            return (
                                <div key={idx} className="bg-white border border-emerald-100 p-3 rounded-xl shadow-sm hover:border-emerald-300 transition flex flex-col gap-2 group">
                                    <div className="flex justify-between items-start gap-2">
                                        <div className="text-slate-800 font-medium text-sm flex-1 leading-snug">
                                            {text}
                                        </div>
                                        {timestamp && (
                                            <button
                                                onClick={() => onJump(timestamp)}
                                                className="text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded text-xs font-mono font-bold transition flex items-center gap-1 flex-shrink-0 cursor-pointer"
                                            >
                                                ⏱️ {timestamp}
                                            </button>
                                        )}
                                    </div>
                                    {quote && (
                                        <div className="text-xs text-slate-500 italic bg-slate-50 p-2 rounded border border-slate-100 group-hover:bg-emerald-50/20 group-hover:border-emerald-100 transition-colors">
                                            "{quote}"
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Improvements */}
            {data.improvements && data.improvements.length > 0 && (
                <div>
                    <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                        <span>🚀</span> 개선 필요 영역 (Areas for Improvement)
                    </h4>
                    <div className="space-y-3">
                        {data.improvements.map((item: any, idx: number) => (
                            <div key={idx} className="bg-white p-4 rounded-xl border border-amber-100 shadow-sm hover:border-amber-300 transition group">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="bg-amber-50 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-100">
                                        놓친 기회 (Missed Opportunity)
                                    </span>
                                    {item.timestamp && (
                                        <button
                                            onClick={() => onJump(item.timestamp)}
                                            className="flex items-center gap-1 text-xs font-mono text-slate-400 bg-slate-50 px-2 py-1 rounded hover:bg-indigo-50 hover:text-indigo-600 transition"
                                        >
                                            ⏱️ {item.timestamp}
                                        </button>
                                    )}
                                </div>

                                <div className="text-slate-800 text-sm font-medium mb-2">
                                    "{item.critique}"
                                </div>

                                <div className="bg-slate-50 p-3 rounded-lg text-xs space-y-2">
                                    <div className="text-slate-500">
                                        <span className="font-bold text-slate-400">사용자 발화:</span> "{item.quote || item.original_quote || "Unknown"}"
                                    </div>
                                    <div className="text-indigo-700 font-medium">
                                        <span className="font-bold text-indigo-400">추천 질문:</span> "{item.correct_question}"
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
