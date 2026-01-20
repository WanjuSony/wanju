'use client';

import { useState } from 'react';
import { SimulationSession, Persona } from '@/lib/types';
import { analyzeSimulationAction } from '@/app/actions';
import ReactMarkdown from 'react-markdown';
import { useRouter } from 'next/navigation';

interface Props {
    projectId: string;
    studyId: string;
    session: SimulationSession;
    persona?: Persona;
}

export function SimulationReport({ projectId, studyId, session, persona }: Props) {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const router = useRouter();

    const handleAnalyze = async () => {
        setIsAnalyzing(true);
        try {
            await analyzeSimulationAction(projectId, studyId, session.id);
            router.refresh(); // Refresh to show new insights
        } catch (e) {
            alert("Failed to analyze");
            console.error(e);
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[calc(100vh-140px)]">
            {/* Left: Chat Transcript */}
            <div className="bg-white rounded-xl border border-slate-200 flex flex-col overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center font-bold text-xs">
                            {persona?.name.charAt(0) || '?'}
                        </div>
                        <div>
                            <div className="font-bold text-slate-900 text-sm">{persona?.name || 'Unknown'}</div>
                            <div className="text-xs text-slate-500">{new Date(session.createdAt).toLocaleString()}</div>
                        </div>
                    </div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Transcript</div>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {session.messages.map((m) => (
                        <div key={m.id} className={`flex ${m.role === 'interviewer' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${m.role === 'interviewer'
                                    ? 'bg-brand-600 text-white rounded-br-none'
                                    : 'bg-slate-50 text-slate-800 rounded-bl-none border border-slate-100'
                                }`}>
                                {m.text}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right: Analysis */}
            <div className="bg-white rounded-xl border border-slate-200 flex flex-col overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        <span className="text-lg">🧠</span>
                        AI Insight Analysis
                    </div>
                    {!session.insights && (
                        <button
                            onClick={handleAnalyze}
                            disabled={isAnalyzing}
                            className="bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition disabled:opacity-50 flex items-center gap-1"
                        >
                            {isAnalyzing ? 'Analyzing...' : 'Generate Insights'}
                        </button>
                    )}
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                    {session.insights ? (
                        <div className="prose prose-sm prose-slate max-w-none">
                            <ReactMarkdown>{session.insights}</ReactMarkdown>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center p-8">
                            <div className="text-4xl mb-4 opacity-20">📊</div>
                            <p className="mb-4 text-sm">No insights generated yet.</p>
                            <button
                                onClick={handleAnalyze}
                                disabled={isAnalyzing}
                                className="bg-brand-50 text-brand-600 border border-brand-100 hover:bg-brand-100 px-4 py-2 rounded-lg text-sm font-bold transition disabled:opacity-50"
                            >
                                {isAnalyzing ? 'Analyzing...' : 'Analyze Interview Now'}
                            </button>
                            <p className="text-xs text-slate-400 mt-4 max-w-xs">
                                AI will analyze the conversation based on your Research Goals and Hypotheses.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
