'use client';

import { useState } from 'react';
import Link from 'next/link';
import { updateStudyTitleAction } from '@/app/actions';
import { ResearchStudy } from '@/lib/types';

interface Props {
    projectTitle: string;
    study: ResearchStudy;
}

export function StudyHeader({ projectTitle, study }: Props) {
    const [isEditing, setIsEditing] = useState(false);
    const [title, setTitle] = useState(study.title || study.plan.purpose);
    const [isLoading, setIsLoading] = useState(false);

    const handleSave = async () => {
        setIsLoading(true);
        try {
            await updateStudyTitleAction(study.projectId, study.id, title);
            setIsEditing(false);
        } catch (e) {
            console.error(e);
            alert('Failed to update title');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <header className="bg-white border-b border-slate-200 px-8 py-6">
            <div className="max-w-7xl mx-auto w-full">
                <Link href={`/projects/${study.projectId}`} className="text-slate-500 hover:text-slate-800 text-sm mb-4 inline-block">
                    &larr; 프로젝트로 돌아가기
                </Link>
                <div className="flex justify-between items-start">
                    <div className="w-full">
                        <span className="text-brand-600 text-xs font-bold uppercase tracking-wider mb-2 block">
                            {study.plan.methodology.type}
                        </span>

                        {isEditing ? (
                            <div className="flex items-center gap-2 mb-2 max-w-3xl">
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="text-3xl font-bold text-slate-900 border-b-2 border-brand-500 focus:outline-none w-full"
                                    autoFocus
                                />
                                <button
                                    onClick={handleSave}
                                    disabled={isLoading}
                                    className="bg-brand-600 text-white px-3 py-1 rounded text-sm font-bold disabled:opacity-50 whitespace-nowrap"
                                >
                                    {isLoading ? 'Saving...' : 'Save'}
                                </button>
                                <button
                                    onClick={() => {
                                        setIsEditing(false);
                                        setTitle(study.title || study.plan.purpose);
                                    }}
                                    className="text-slate-500 hover:text-slate-800 text-sm font-bold whitespace-nowrap"
                                >
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 mb-2 group">
                                <h1 className="text-3xl font-bold text-slate-900">
                                    {title}
                                </h1>
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-brand-600 transition p-1"
                                    title="Edit Title"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
                                    </svg>
                                </button>
                            </div>
                        )}

                        <div className="flex items-center gap-2 text-sm text-slate-500">
                            <span>{projectTitle}</span>
                            <span>•</span>
                            <span>{new Date(study.createdAt).toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}
