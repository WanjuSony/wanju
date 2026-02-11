'use client';

import { useState, useEffect } from 'react';
import { SimulationList } from '@/components/SimulationList';
import { ExecutionManager } from '@/components/ExecutionManager';
import { RealInterview, SimulationSession, Persona } from '@/lib/types';
import Link from 'next/link';

interface Props {
    projectId: string;
    studyId: string;
    sessions: SimulationSession[];
    personas: Persona[];
    interviews: RealInterview[];
}

export function StudySessionsLayout({ projectId, studyId, sessions, personas, interviews }: Props) {
    const [showRealInterviewsFirst, setShowRealInterviewsFirst] = useState(false);

    // Load preference from localStorage
    useEffect(() => {
        const savedFormat = localStorage.getItem('studyViewPreference');
        if (savedFormat === 'realFirst') {
            setShowRealInterviewsFirst(true);
        }
    }, []);

    const togglePreference = () => {
        const newValue = !showRealInterviewsFirst;
        setShowRealInterviewsFirst(newValue);
        localStorage.setItem('studyViewPreference', newValue ? 'realFirst' : 'simulationFirst');
    };

    return (
        <div className="space-y-8 relative">
            {/* Reorder Toggle */}
            <div className="absolute right-0 top-[-40px] flex items-center gap-2">
                <button
                    onClick={togglePreference}
                    className="text-xs font-bold text-slate-500 hover:text-brand-600 flex items-center gap-1 bg-white px-2 py-1 rounded border border-slate-200 shadow-sm transition"
                    title="Change Order"
                >
                    <span>⇅</span>
                    {showRealInterviewsFirst ? '사전 시뮬레이션 먼저 보기' : '실전 인터뷰 먼저 보기'}
                </button>
            </div>

            <div className={`flex flex-col gap-8 ${showRealInterviewsFirst ? 'flex-col-reverse' : 'flex-col'}`}>
                {/* Pre-simulation Section */}
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm order-1">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-slate-900 flex items-center gap-2">
                            <span className="text-xl">🤖</span> 사전 시뮬레이션
                        </h3>
                        {sessions && sessions.length > 0 && (
                            <Link
                                href={`/projects/${projectId}/studies/${studyId}/simulation`}
                                className="text-xs bg-brand-600 hover:bg-brand-700 text-white px-3 py-2 rounded-lg font-bold transition flex items-center gap-1"
                            >
                                + 인터뷰 시작
                            </Link>
                        )}
                    </div>

                    <p className="text-sm text-slate-500 mb-4">캐스팅된 AI 페르소나와 대화하며 기획 내용을 검증해보세요.</p>

                    <SimulationList
                        projectId={projectId}
                        studyId={studyId}
                        sessions={sessions || []}
                        personas={personas || []}
                    />
                </div>

                {/* Real Interview Section */}
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm order-2">
                    <ExecutionManager
                        projectId={projectId}
                        studyId={studyId}
                        interviews={interviews}
                        personas={personas}
                    />
                </div>
            </div>
        </div>
    );
}
