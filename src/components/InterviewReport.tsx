'use client';

import { RealInterview, StructuredInsight } from '@/lib/types';
import ReactMarkdown from 'react-markdown';
import { useState } from 'react';

interface Props {
    interview: RealInterview;
}

export function InterviewReport({ interview }: Props) {
    const insights = interview.structuredData || [];
    const [coppied, setCoppied] = useState(false);

    // Group insights by type
    const facts = insights.filter(i => i.type === 'fact');
    const actions = insights.filter(i => i.type === 'action');
    const findings = insights.filter(i => i.type === 'insight');

    const handleCopyAll = () => {
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
            });
        }

        navigator.clipboard.writeText(text);
        setCoppied(true);
        setTimeout(() => setCoppied(false), 2000);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[calc(100vh-140px)]">
            {/* Left: Transcript */}
            <div className="bg-white rounded-xl border border-slate-200 flex flex-col overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <div className="font-bold text-slate-800 text-sm">Transcript</div>
                    <div className="text-xs text-slate-400">
                        {interview.transcriptId}
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
                    <pre className="whitespace-pre-wrap font-mono text-xs text-slate-600 leading-relaxed">
                        {interview.content || "No transcript content available."}
                    </pre>
                </div>
            </div>

            {/* Right: Insights */}
            <div className="bg-white rounded-xl border border-slate-200 flex flex-col overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        <span className="text-lg">💡</span>
                        Structured Insights
                    </div>
                    <button
                        onClick={handleCopyAll}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-white hover:border-slate-300 transition flex items-center gap-1 text-slate-600 bg-white shadow-sm"
                    >
                        {coppied ? '✅ Copied!' : '📋 Copy to Notion'}
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">

                    {/* Findings */}
                    {findings.length > 0 && (
                        <div>
                            <h3 className="text-sm font-bold text-brand-900 bg-brand-50 px-3 py-2 rounded-lg mb-3 inline-block">
                                Key Insights
                            </h3>
                            <div className="space-y-3">
                                {findings.map(item => <InsightCard key={item.id} item={item} />)}
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    {actions.length > 0 && (
                        <div>
                            <h3 className="text-sm font-bold text-emerald-900 bg-emerald-50 px-3 py-2 rounded-lg mb-3 inline-block">
                                Action Items & Recommendations
                            </h3>
                            <div className="space-y-3">
                                {actions.map(item => <InsightCard key={item.id} item={item} />)}
                            </div>
                        </div>
                    )}

                    {/* Facts */}
                    {facts.length > 0 && (
                        <div>
                            <h3 className="text-sm font-bold text-slate-700 bg-slate-100 px-3 py-2 rounded-lg mb-3 inline-block">
                                Key Facts
                            </h3>
                            <div className="space-y-3">
                                {facts.map(item => <InsightCard key={item.id} item={item} />)}
                            </div>
                        </div>
                    )}

                    {insights.length === 0 && (
                        <div className="text-center py-10 text-slate-400">
                            No structured insights found.
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}

function InsightCard({ item }: { item: StructuredInsight }) {
    return (
        <div className="flex gap-3 p-4 rounded-xl border border-slate-200 hover:border-brand-300 transition bg-white shadow-sm group">
            <div className={`w-1 rounded-full flex-shrink-0 self-stretch ${item.type === 'insight' ? 'bg-brand-500' :
                item.type === 'action' ? 'bg-emerald-500' : 'bg-slate-300'
                }`}></div>
            <div className="flex-1 min-w-0">
                <div className="prose prose-sm prose-slate max-w-none mb-1">
                    <ReactMarkdown>{item.content}</ReactMarkdown>
                </div>

                {item.meaning && (
                    <div className="bg-slate-50 p-2 rounded-lg mt-2 text-xs text-slate-600">
                        <span className="font-bold text-slate-400 uppercase text-[10px]">Why / Context</span>
                        <div className="mt-1"><ReactMarkdown>{item.meaning}</ReactMarkdown></div>
                    </div>
                )}

                {item.recommendation && (
                    <div className="bg-emerald-50/50 p-2 rounded-lg mt-2 text-xs text-emerald-700 border border-emerald-100">
                        <span className="font-bold text-emerald-400 uppercase text-[10px]">Recommendation</span>
                        <div className="mt-1 font-medium"><ReactMarkdown>{item.recommendation}</ReactMarkdown></div>
                    </div>
                )}

                {item.sourceSegmentId && (
                    <p className="text-[10px] text-slate-300 mt-2 text-right group-hover:text-slate-400 transition">
                        Ref: {item.sourceSegmentId}
                    </p>
                )}
            </div>
        </div>
    );
}
