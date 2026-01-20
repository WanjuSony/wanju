'use client';

import { useState } from 'react';
import { Project } from '@/lib/types';
import Link from 'next/link';
import { updateProjectAction } from '@/app/actions';

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
        <header className="bg-white border-b border-slate-200 px-8 py-6 pb-0">
            <div className="max-w-7xl mx-auto w-full">
                <div className="mb-6">
                    <Link href="/" className="text-slate-500 hover:text-slate-800 text-sm mb-2 inline-block">
                        &larr; 전체 프로젝트 목록
                    </Link>
                    <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-3xl font-bold text-slate-900">{project.title}</h1>
                        <button
                            onClick={() => setIsEditing(true)}
                            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1"
                        >
                            ✏️ 프로젝트 수정하기
                        </button>
                    </div>
                </div>

                <div className="flex gap-8">
                    <Link
                        href={`/projects/${project.id}?tab=studies`}
                        className={`pb-4 text-sm font-medium transition border-b-2 ${activeTab === 'studies'
                            ? 'border-brand-600 text-brand-600'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                            }`}
                    >
                        인터뷰 / 리서치 ({counts.studies})
                    </Link>
                    <Link
                        href={`/projects/${project.id}?tab=personas`}
                        className={`pb-4 text-sm font-medium transition border-b-2 ${activeTab === 'personas'
                            ? 'border-brand-600 text-brand-600'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                            }`}
                    >
                        페르소나 ({counts.personas})
                    </Link>
                    <Link
                        href={`/projects/${project.id}?tab=knowledge`}
                        className={`pb-4 text-sm font-medium transition border-b-2 ${activeTab === 'knowledge'
                            ? 'border-brand-600 text-brand-600'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                            }`}
                    >
                        지식 저장소 ({counts.knowledge})
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
                                        defaultValue={project.goal} // Type error here potentially if Project type not fully updated in some context, but we updated types.ts
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
