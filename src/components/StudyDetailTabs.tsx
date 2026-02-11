'use client';

import { useState } from 'react';
import { StudySessionsLayout } from '@/components/StudySessionsLayout';
import DiscussionGuideBuilder from '@/components/DiscussionGuideBuilder';
import { ResearchStudy, ProjectData } from '@/lib/types';

import { StudyAIChat } from './StudyAIChat';
import { ReportList } from '@/components/ReportList';

interface Props {
    study: ResearchStudy;
    projectData: ProjectData;
    projectId: string;
    studyId: string;
}

import { updateStudyPlanFieldsAction } from '@/app/actions';
import { useTransition } from 'react';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';

export function StudyDetailTabs({ study, projectData, projectId, studyId }: Props) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const initialTab = (searchParams.get('tab') as any) || 'guide';

    const [activeTab, setActiveTab] = useState<'guide' | 'execution' | 'report' | 'chat'>(initialTab);
    const [editingSection, setEditingSection] = useState<'background' | 'target' | 'purpose' | 'utilization' | null>(null);
    const [draftContent, setDraftContent] = useState('');
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab && (tab === 'guide' || tab === 'execution' || tab === 'report' || tab === 'chat')) {
            setActiveTab(tab as any);
        }
    }, [searchParams]);

    const handleEditStart = (section: 'background' | 'target' | 'purpose' | 'utilization', content: string) => {
        setEditingSection(section);
        setDraftContent(content);
    };

    const handleTabChange = (tab: 'guide' | 'execution' | 'report' | 'chat') => {
        setActiveTab(tab);
        const params = new URLSearchParams(searchParams.toString());
        params.set('tab', tab);
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    };

    const handleSave = () => {
        if (!editingSection) return;

        startTransition(async () => {
            try {
                const update: any = {};
                if (editingSection === 'background') update.background = draftContent;
                if (editingSection === 'target') update.target = draftContent;
                if (editingSection === 'purpose') update.purpose = draftContent;
                if (editingSection === 'utilization') update.utilization = draftContent;

                await updateStudyPlanFieldsAction(projectId, studyId, update);
                setEditingSection(null);
            } catch (e) {
                console.error(e);
                alert('저장 실패');
            }
        });
    };

    return (
        <div className="space-y-6">
            {/* Tab Navigation */}
            <div className="flex bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm w-fit">
                <button
                    onClick={() => handleTabChange('guide')}
                    className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2
                        ${activeTab === 'guide'
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50'
                        }`}
                >
                    <span className="text-lg">📝</span>
                    인터뷰 가이드
                </button>
                <div className="w-px bg-slate-200 my-1 mx-1"></div>
                <button
                    onClick={() => handleTabChange('execution')}
                    className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2
                        ${activeTab === 'execution'
                            ? 'bg-slate-800 text-white shadow-md'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                        }`}
                >
                    <span className="text-lg">📊</span>
                    실전 & 시뮬레이션
                </button>
                <div className="w-px bg-slate-200 my-1 mx-1"></div>
                <button
                    onClick={() => handleTabChange('report')}
                    className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2
                        ${activeTab === 'report'
                            ? 'bg-emerald-600 text-white shadow-md'
                            : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50'
                        }`}
                >
                    <span className="text-lg">📈</span>
                    주간 리포트
                </button>
                <div className="w-px bg-slate-200 my-1 mx-1"></div>
                <button
                    onClick={() => handleTabChange('chat')}
                    className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2
                        ${activeTab === 'chat'
                            ? 'bg-purple-600 text-white shadow-md'
                            : 'text-slate-500 hover:text-purple-600 hover:bg-purple-50'
                        }`}
                >
                    <span className="text-lg">🤝</span>
                    인터뷰 도우미
                </button>
            </div>

            {/* Tab Content */}
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                {activeTab === 'guide' && (
                    <div className="space-y-4">
                        {/* Context Information moved here */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Background Section */}
                            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm group hover:border-brand-200 transition-colors">
                                <div className="flex justify-between items-center mb-1.5">
                                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">인터뷰 배경</h4>
                                    {editingSection !== 'background' && (
                                        <button
                                            onClick={() => handleEditStart('background', study.plan.background)}
                                            className="text-brand-400 hover:text-brand-700 hover:bg-brand-50 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-all"
                                            title="수정하기"
                                        >
                                            ✏️
                                        </button>
                                    )}
                                </div>
                                {editingSection === 'background' ? (
                                    <div className="space-y-2">
                                        <textarea
                                            value={draftContent}
                                            onChange={(e) => setDraftContent(e.target.value)}
                                            className="w-full text-xs p-2.5 border border-brand-200 rounded-lg focus:ring-1 focus:ring-brand-500 outline-none resize-none bg-brand-50/50 leading-relaxed"
                                            rows={5}
                                        />
                                        <div className="flex justify-end gap-1.5">
                                            <button
                                                onClick={() => setEditingSection(null)}
                                                className="px-2 py-1 text-[11px] font-bold text-slate-500 hover:bg-slate-100 rounded"
                                                disabled={isPending}
                                            >
                                                취소
                                            </button>
                                            <button
                                                onClick={handleSave}
                                                className="px-2 py-1 text-[11px] font-bold text-white bg-brand-600 hover:bg-brand-700 rounded shadow-sm"
                                                disabled={isPending}
                                            >
                                                {isPending ? '저장...' : '완료'}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{study.plan.background}</p>
                                )}
                            </div>

                            {/* Target Section */}
                            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm group hover:border-brand-200 transition-colors">
                                <div className="flex justify-between items-center mb-1.5">
                                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">타겟 고객 (응답자)</h4>
                                    {editingSection !== 'target' && (
                                        <button
                                            onClick={() => handleEditStart('target', study.plan.target)}
                                            className="text-brand-400 hover:text-brand-700 hover:bg-brand-50 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-all"
                                            title="수정하기"
                                        >
                                            ✏️
                                        </button>
                                    )}
                                </div>
                                {editingSection === 'target' ? (
                                    <div className="space-y-2">
                                        <textarea
                                            value={draftContent}
                                            onChange={(e) => setDraftContent(e.target.value)}
                                            className="w-full text-xs p-2.5 border border-brand-200 rounded-lg focus:ring-1 focus:ring-brand-500 outline-none resize-none bg-brand-50/50 leading-relaxed"
                                            rows={5}
                                        />
                                        <div className="flex justify-end gap-1.5">
                                            <button
                                                onClick={() => setEditingSection(null)}
                                                className="px-2 py-1 text-[11px] font-bold text-slate-500 hover:bg-slate-100 rounded"
                                                disabled={isPending}
                                            >
                                                취소
                                            </button>
                                            <button
                                                onClick={handleSave}
                                                className="px-2 py-1 text-[11px] font-bold text-white bg-brand-600 hover:bg-brand-700 rounded shadow-sm"
                                                disabled={isPending}
                                            >
                                                {isPending ? '저장...' : '완료'}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{study.plan.target}</p>
                                )}
                            </div>
                        </div>

                        {/* Purpose and Utilization Sections */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Purpose Section */}
                            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm group hover:border-brand-200 transition-colors">
                                <div className="flex justify-between items-center mb-1.5">
                                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                        <span>🚩</span> 연구 목적 (Purpose)
                                    </h4>
                                    {editingSection !== 'purpose' && (
                                        <button
                                            onClick={() => handleEditStart('purpose', study.plan.purpose)}
                                            className="text-brand-400 hover:text-brand-700 hover:bg-brand-50 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-all"
                                            title="수정하기"
                                        >
                                            ✏️
                                        </button>
                                    )}
                                </div>
                                {editingSection === 'purpose' ? (
                                    <div className="space-y-2">
                                        <textarea
                                            value={draftContent}
                                            onChange={(e) => setDraftContent(e.target.value)}
                                            className="w-full text-xs p-2.5 border border-brand-200 rounded-lg focus:ring-1 focus:ring-brand-500 outline-none resize-none bg-brand-50/50 leading-relaxed"
                                            rows={5}
                                            placeholder="이번 연구를 통해 얻고자 하는 핵심 질문이나 목표를 한 문장으로 정의해보세요."
                                        />
                                        <div className="flex justify-end gap-1.5">
                                            <button
                                                onClick={() => setEditingSection(null)}
                                                className="px-2 py-1 text-[11px] font-bold text-slate-500 hover:bg-slate-100 rounded"
                                                disabled={isPending}
                                            >
                                                취소
                                            </button>
                                            <button
                                                onClick={handleSave}
                                                className="px-2 py-1 text-[11px] font-bold text-white bg-brand-600 hover:bg-brand-700 rounded shadow-sm"
                                                disabled={isPending}
                                            >
                                                {isPending ? '저장...' : '완료'}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                                        {study.plan.purpose || <span className="text-slate-400 italic">내용이 없습니다.</span>}
                                    </p>
                                )}
                            </div>

                            {/* Utilization Section */}
                            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm group hover:border-brand-200 transition-colors">
                                <div className="flex justify-between items-center mb-1.5">
                                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                        <span>🚀</span> 활용 계획 (Utilization)
                                    </h4>
                                    {editingSection !== 'utilization' && (
                                        <button
                                            onClick={() => handleEditStart('utilization', study.plan.utilization)}
                                            className="text-brand-400 hover:text-brand-700 hover:bg-brand-50 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-all"
                                            title="수정하기"
                                        >
                                            ✏️
                                        </button>
                                    )}
                                </div>
                                {editingSection === 'utilization' ? (
                                    <div className="space-y-2">
                                        <textarea
                                            value={draftContent}
                                            onChange={(e) => setDraftContent(e.target.value)}
                                            className="w-full text-xs p-2.5 border border-brand-200 rounded-lg focus:ring-1 focus:ring-brand-500 outline-none resize-none bg-brand-50/50 leading-relaxed"
                                            rows={5}
                                            placeholder="연구 결과를 어떻게 활용할지, 의사결정에 어떻게 반영할지 구체적으로 적어주세요."
                                        />
                                        <div className="flex justify-end gap-1.5">
                                            <button
                                                onClick={() => setEditingSection(null)}
                                                className="px-2 py-1 text-[11px] font-bold text-slate-500 hover:bg-slate-100 rounded"
                                                disabled={isPending}
                                            >
                                                취소
                                            </button>
                                            <button
                                                onClick={handleSave}
                                                className="px-2 py-1 text-[11px] font-bold text-white bg-brand-600 hover:bg-brand-700 rounded shadow-sm"
                                                disabled={isPending}
                                            >
                                                {isPending ? '저장...' : '완료'}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                                        {study.plan.utilization || <span className="text-slate-400 italic">내용이 없습니다.</span>}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                            <DiscussionGuideBuilder
                                initialBlocks={study.discussionGuide || []}
                                researchQuestions={study.plan.researchQuestions || []}
                                projectId={projectId}
                                studyId={studyId}
                                otherStudies={projectData.studies.filter(s => s.id !== studyId)}
                            />
                        </div>
                    </div>
                )}
                {activeTab === 'execution' && (
                    <StudySessionsLayout
                        projectId={projectId}
                        studyId={studyId}
                        sessions={study.simulationSessions || []}
                        personas={projectData?.personas || []}
                        interviews={study.sessions}
                    />
                )}
                {activeTab === 'report' && (
                    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                        <ReportList
                            projectId={projectId}
                            studyId={studyId}
                            reports={study.reports || []}
                            interviews={study.sessions}
                            personas={projectData?.personas || []}
                            studies={projectData?.studies || []}
                        />
                    </div>
                )}
                {activeTab === 'chat' && (
                    <StudyAIChat
                        projectId={projectId}
                        studyId={studyId}
                        initialSessions={study.chatSessions || []}
                        interviews={study.sessions}
                        simulations={study.simulationSessions || []}
                        personas={projectData?.personas || []}
                        discussionGuide={study.discussionGuide || []}
                    />
                )}
            </div>
        </div>
    );
}
