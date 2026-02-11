'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Project, ResearchStudy, Persona, RealInterview } from '@/lib/types';
import { PersonaManager } from '@/components/PersonaManager';
import { ProjectKnowledgeBase } from '@/components/ProjectKnowledgeBase';
import { ProjectAIChat } from '@/components/ProjectAIChat';
import DeleteStudyButton from '@/components/DeleteStudyButton';
import { StudyStatusSelector } from '@/components/StudyStatusSelector';
import { ProjectHeader } from '@/components/ProjectHeader';
import { formatDate } from '@/lib/date-utils';

interface ProjectDetailClientProps {
    project: Project;
    studies: ResearchStudy[];
    personas: Persona[];
}

export default function ProjectDetailClient({ project, studies, personas }: ProjectDetailClientProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    // Initialize tab from URL or default to 'studies'
    // We use local state for immediate UI updates
    const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'studies');

    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
        // Update URL without refreshing the page (shallow routing)
        const params = new URLSearchParams(searchParams.toString());
        params.set('tab', tab);
        router.replace(`/projects/${project.id}?${params.toString()}`, { scroll: false });
    };

    const allInterviews = studies.flatMap(s => s.sessions);

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <ProjectHeader
                project={project}
                activeTab={activeTab}
                onTabChange={handleTabChange} // We need to update ProjectHeader to accept this prop
                counts={{
                    studies: studies.length,
                    personas: personas?.length || 0,
                    knowledge: project.documents?.length || 0
                }}
            />

            <main className="flex-1 p-8 max-w-7xl mx-auto w-full">
                {activeTab === 'studies' && (
                    <div className="space-y-8 animate-in fade-in duration-300">
                        {studies.length === 0 ? (
                            <div className="bg-white border-2 border-dashed border-slate-200 text-center rounded-[2.5rem] p-24 shadow-sm">
                                <span className="text-6xl mb-6 block font-bold tracking-tight">🔎</span>
                                <h3 className="text-2xl font-black text-slate-900 mb-2">No research studies yet</h3>
                                <p className="text-slate-500 mb-8 max-w-sm mx-auto font-medium">
                                    Start your first research study for this project.
                                </p>
                                <Link
                                    href={`/projects/${project.id}/studies/new`}
                                    className="bg-brand-600 text-white px-8 py-3 rounded-2xl font-black hover:bg-brand-700 transition shadow-xl shadow-brand-100 flex items-center gap-2 mx-auto w-fit"
                                >
                                    <span>+</span> Plan New Interview
                                </Link>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="flex justify-end">
                                    <Link
                                        href={`/projects/${project.id}/studies/new`}
                                        className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-brand-100 transition-all hover:scale-[1.02] active:scale-[0.98] text-sm flex items-center gap-2"
                                    >
                                        <span className="text-xl">+</span> Add New Interview
                                    </Link>
                                </div>
                                <div className="grid grid-cols-1 gap-6">
                                    {studies.map(study => (
                                        <div key={study.id} className="group relative">
                                            <div className="absolute inset-0 bg-brand-600 rounded-[2.5rem] translate-y-3 opacity-0 group-hover:opacity-10 transition-all duration-300"></div>
                                            <div className="relative bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-500 flex flex-col">
                                                <Link
                                                    href={`/projects/${project.id}/studies/${study.id}`}
                                                    className="absolute inset-0 z-10"
                                                    aria-label={`View details for ${study.title}`}
                                                />
                                                <div className="absolute top-0 left-0 w-2 h-full bg-brand-500 rounded-l-[2.5rem] opacity-0 group-hover:opacity-100 transition-opacity z-20"></div>

                                                <div className="relative z-0">
                                                    <div className="flex justify-between items-start mb-6">
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <span className="text-[10px] font-black text-brand-600 bg-brand-50 border border-brand-100 px-2.5 py-1 rounded-full uppercase tracking-widest shadow-sm">
                                                                    {study.plan.methodology.type}
                                                                </span>
                                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                                    Created {formatDate(study.createdAt)}
                                                                </span>
                                                            </div>
                                                            <h3 className="text-2xl font-black text-slate-900 group-hover:text-brand-600 transition tracking-tight leading-tight">
                                                                {study.title}
                                                            </h3>
                                                        </div>
                                                        <StudyStatusSelector
                                                            projectId={project.id}
                                                            studyId={study.id}
                                                            currentStatus={study.status}
                                                            readonly={true}
                                                        />
                                                    </div>
                                                    <div className="mt-6 mb-4 space-y-2">
                                                        {study.plan?.researchQuestions?.slice(0, 3).map((question, idx) => {
                                                            const verifications = study.plan?.hypothesisVerifications || {};
                                                            const status = verifications[idx.toString()]?.status;

                                                            let badge = null;
                                                            if (status === 'supported') {
                                                                badge = <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border bg-emerald-100 text-emerald-800 border-emerald-200">✅ 입증됨</span>;
                                                            } else if (status === 'refuted') {
                                                                badge = <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border bg-rose-100 text-rose-800 border-rose-200">❌ 반박됨</span>;
                                                            } else if (status === 'partial') {
                                                                badge = <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border bg-amber-100 text-amber-800 border-amber-200">⚠️ 부분 입증</span>;
                                                            } else {
                                                                badge = <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border bg-slate-50 text-slate-500 border-slate-200">⏳ 진행 중</span>;
                                                            }

                                                            return (
                                                                <div key={idx} className="flex items-center gap-2 group/q">
                                                                    <div className="flex-shrink-0">
                                                                        {badge}
                                                                    </div>
                                                                    <p className="text-xs text-slate-500 font-medium truncate group-hover/q:text-slate-700 transition-colors">
                                                                        {question}
                                                                    </p>
                                                                </div>
                                                            );
                                                        })}
                                                        {study.plan?.researchQuestions && study.plan.researchQuestions.length > 3 && (
                                                            <p className="text-[10px] text-slate-400 pl-6">
                                                                +{study.plan.researchQuestions.length - 3} more hypotheses
                                                            </p>
                                                        )}
                                                        {(!study.plan?.researchQuestions || study.plan.researchQuestions.length === 0) && (
                                                            <p className="text-xs text-slate-300 italic pl-1">No hypotheses defined</p>
                                                        )}
                                                    </div>

                                                    <div className="flex justify-between items-center mt-auto pt-4 border-t border-slate-50">
                                                        <div className="flex items-center gap-4 text-sm font-black">
                                                            <span className="text-brand-600 group-hover:translate-x-1 transition-transform inline-block">
                                                                Manage Study &rarr;
                                                            </span>
                                                            <span className="text-slate-400 font-bold bg-slate-50 px-3 py-1 rounded-xl">
                                                                {study.sessions.length} Interviews / {new Set(study.sessions.map(s => s.participantId).filter(Boolean)).size} Personas
                                                            </span>
                                                        </div>
                                                        <div className="relative z-20">
                                                            <DeleteStudyButton projectId={project.id} studyId={study.id} />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'personas' && (
                    <div className="animate-in fade-in duration-300">
                        <PersonaManager projectId={project.id} personas={personas || []} interviews={allInterviews} studies={studies} />
                    </div>
                )}

                {activeTab === 'knowledge' && (
                    <div className="animate-in fade-in duration-300">
                        <ProjectKnowledgeBase project={project} />
                    </div>
                )}

                {activeTab === 'ai-chat' && (
                    <div className="animate-in fade-in duration-300">
                        <ProjectAIChat project={project} studies={studies} personas={personas || []} />
                    </div>
                )}
            </main>
        </div>
    );
}
