'use client';

import { useState } from 'react';
import { Project } from '@/lib/types';
import Link from 'next/link';
import { updateProjectAction } from '@/app/actions';
import { ProjectStatusBadge } from '@/components/ProjectStatusBadge';

interface Props {
    project: Project;
    activeTab: string;
    counts: {
        studies: number;
        personas: number;
        knowledge: number;
    }
}

export function ProjectHeader({ project, activeTab, counts }: Props) {
    const [isEditing, setIsEditing] = useState(false);

    return (
        <header className="bg-white border-b border-slate-200">
            <div className="max-w-7xl mx-auto w-full px-8 pt-8">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
                    <div className="flex-1">
                        <Link href="/" className="text-slate-400 hover:text-slate-600 text-xs font-bold mb-3 flex items-center gap-1 transition-colors uppercase tracking-widest">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
                            Back to Projects
                        </Link>
                        <div className="flex items-center gap-4">
                            <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-none">{project.title}</h1>
                            <button
                                onClick={() => setIsEditing(true)}
                                className="p-2 text-slate-300 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-all"
                                title="Edit Project"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
                                </svg>
                            </button>
                        </div>
                        {project.description && (
                            <p className="mt-3 text-slate-500 text-sm max-w-2xl leading-relaxed font-medium">
                                {project.description}
                            </p>
                        )}
                        <ProjectStatusBadge projectId={project.id} currentStatus={project.status} className="mt-4" />
                    </div>
                </div>

                <div className="flex gap-1 md:gap-4 overflow-x-auto pb-px">
                    <Link
                        href={`/projects/${project.id}?tab=studies`}
                        className={`px-4 pb-4 text-sm font-bold transition-all border-b-2 whitespace-nowrap ${activeTab === 'studies'
                            ? 'border-brand-600 text-brand-600'
                            : 'border-transparent text-slate-400 hover:text-slate-600'
                            }`}
                    >
                        Interviews / Research <span className="ml-1 text-[10px] bg-slate-100 px-1.5 py-0.5 rounded-full text-slate-400 transition-colors uppercase">{counts.studies}</span>
                    </Link>
                    <Link
                        href={`/projects/${project.id}?tab=personas`}
                        className={`px-4 pb-4 text-sm font-bold transition-all border-b-2 whitespace-nowrap ${activeTab === 'personas'
                            ? 'border-brand-600 text-brand-600'
                            : 'border-transparent text-slate-400 hover:text-slate-600'
                            }`}
                    >
                        Personas <span className="ml-1 text-[10px] bg-slate-100 px-1.5 py-0.5 rounded-full text-slate-400 transition-colors uppercase">{counts.personas}</span>
                    </Link>
                    <Link
                        href={`/projects/${project.id}?tab=knowledge`}
                        className={`px-4 pb-4 text-sm font-bold transition-all border-b-2 whitespace-nowrap ${activeTab === 'knowledge'
                            ? 'border-brand-600 text-brand-600'
                            : 'border-transparent text-slate-400 hover:text-slate-600'
                            }`}
                    >
                        Knowledge Base <span className="ml-1 text-[10px] bg-slate-100 px-1.5 py-0.5 rounded-full text-slate-400 transition-colors uppercase">{counts.knowledge}</span>
                    </Link>
                    <Link
                        href={`/projects/${project.id}?tab=ai-chat`}
                        className={`px-4 pb-4 text-sm font-bold transition-all border-b-2 whitespace-nowrap ${activeTab === 'ai-chat'
                            ? 'border-brand-600 text-brand-600'
                            : 'border-transparent text-slate-400 hover:text-slate-600'
                            }`}
                    >
                        Project Strategy AI <span className="ml-1 text-[10px] bg-brand-50 text-brand-600 px-1.5 py-0.5 rounded-full transition-colors uppercase font-black">AI</span>
                    </Link>
                </div>
            </div>

            {/* Edit Modal */}
            {isEditing && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-slate-800">프로젝트 수정하기</h3>
                            <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
                        </div>
                        <form action={async (formData) => {
                            await updateProjectAction(project.id, formData);
                            setIsEditing(false);
                        }}>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">프로젝트 제목</label>
                                    <input
                                        name="title"
                                        defaultValue={project.title}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-brand-500"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">프로젝트 설명</label>
                                    <textarea
                                        name="description"
                                        defaultValue={project.description}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-brand-500 h-24 resize-none"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">목표 (Goal)</label>
                                    <textarea
                                        name="goal"
                                        defaultValue={project.goal}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-brand-500 h-20 resize-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">완료 기준 (Exit Criteria)</label>
                                    <textarea
                                        name="exitCriteria"
                                        defaultValue={project.exitCriteria}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-brand-500 h-20 resize-none"
                                    />
                                </div>
                            </div>
                            <div className="bg-slate-50 px-6 py-4 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsEditing(false)}
                                    className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-600 font-bold text-sm hover:bg-slate-50"
                                >
                                    취소
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-brand-600 text-white rounded-lg font-bold text-sm hover:bg-brand-700"
                                >
                                    저장하기
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </header>
    );
}
