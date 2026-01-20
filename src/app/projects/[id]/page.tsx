import { getProject } from '@/lib/store/projects';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { PersonaManager } from '@/components/PersonaManager';
import { ProjectKnowledgeBase } from '@/components/ProjectKnowledgeBase';
import DeleteStudyButton from '@/components/DeleteStudyButton';

import { ProjectHeader } from '@/components/ProjectHeader';

interface Props {
    params: Promise<{
        id: string;
    }>;
    searchParams: Promise<{
        tab?: string;
    }>
}

export default async function ProjectPage({ params, searchParams }: Props) {
    const { id } = await params;
    const { tab } = await searchParams;
    const activeTab = tab || 'studies';

    const data = await getProject(id);

    if (!data) {
        notFound();
    }

    const { project, studies, personas } = data;

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <ProjectHeader
                project={project}
                activeTab={activeTab}
                counts={{
                    studies: studies.length,
                    personas: personas?.length || 0,
                    knowledge: project.documents?.length || 0
                }}
            />

            <main className="flex-1 p-8 max-w-7xl mx-auto w-full">
                {activeTab === 'studies' && (
                    <div className="space-y-6">
                        <div className="flex justify-end">
                            <Link
                                href={`/projects/${project.id}/studies/new`}
                                className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-sm hover:shadow-md transition flex items-center gap-2 transform hover:-translate-y-0.5"
                            >
                                <span className="text-xl">+</span>
                                <span>새 인터뷰 기획</span>
                            </Link>
                        </div>

                        {studies.length === 0 ? (
                            <div className="bg-white border text-center rounded-2xl p-12 shadow-sm border-slate-100">
                                <h3 className="text-lg font-bold text-slate-900 mb-2">아직 기획된 인터뷰가 없습니다</h3>
                                <p className="text-slate-500 mb-6">새 인터뷰 기획 버튼을 눌러 시작해보세요.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-6">
                                {studies.map(study => (
                                    <div key={study.id} className="bg-white border border-slate-100 rounded-2xl p-7 hover:shadow-lg transition-all duration-300 group cursor-pointer relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-1.5 h-full bg-brand-500 opacity-80"></div>
                                        <div className="flex justify-between items-start mb-5">
                                            <div>
                                                <span className="text-xs font-bold text-brand-600 bg-brand-50 px-2 py-1 rounded mb-2 inline-block">
                                                    {study.plan.methodology.type} • {new Date(study.createdAt).toLocaleDateString()}
                                                </span>
                                                <h3 className="text-xl font-bold text-slate-800 group-hover:text-brand-600 transition tracking-tight">
                                                    {study.title}
                                                </h3>
                                            </div>
                                            <span className={`px-3 py-1 text-xs font-bold rounded-full uppercase
                                                ${study.status === 'planning' ? 'bg-slate-100 text-slate-600' :
                                                    study.status === 'fieldwork' ? 'bg-green-50 text-green-700' :
                                                        study.status === 'done' ? 'bg-brand-50 text-brand-700' : 'bg-slate-50 text-slate-500'}
                                            `}>
                                                {study.status === 'planning' ? '기획중' :
                                                    study.status === 'recruiting' ? '모집중' :
                                                        study.status === 'fieldwork' ? '진행중' :
                                                            study.status === 'analysis' ? '분석중' : '완료'}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-8 mb-6 border-t border-slate-50 pt-5">
                                            <div>
                                                <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">타겟 고객</h4>
                                                <p className="text-sm text-slate-700 line-clamp-2 leading-relaxed">{study.plan.target}</p>
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">핵심 질문</h4>
                                                <p className="text-sm text-slate-700 line-clamp-2 leading-relaxed">{study.plan.researchQuestions[0]}...</p>
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-center text-sm font-bold">
                                            <Link href={`/projects/${project.id}/studies/${study.id}`} className="text-brand-600 hover:text-brand-800 transition flex items-center gap-1">
                                                인터뷰 상세 보기 {study.sessions.length > 0 && `(${study.sessions.length} sessions)`} &rarr;
                                            </Link>
                                            <DeleteStudyButton projectId={project.id} studyId={study.id} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'personas' && (
                    <PersonaManager projectId={project.id} personas={personas || []} />
                )}

                {activeTab === 'knowledge' && (
                    <ProjectKnowledgeBase project={project} />
                )}
            </main>
        </div>
    );
}
