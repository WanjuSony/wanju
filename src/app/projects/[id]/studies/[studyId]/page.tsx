import { getProject } from '@/lib/store/projects';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ExecutionManager } from '@/components/ExecutionManager';
import DiscussionGuideBuilder from '@/components/DiscussionGuideBuilder';
import { getTranscriptFiles } from '@/lib/transcript';

interface Props {
    params: Promise<{
        id: string;
        studyId: string;
    }>
}

import { StudyHeader } from '@/components/StudyHeader';

// ... (imports)

export default async function StudyPage({ params }: Props) {
    const { id, studyId } = await params;
    const data = await getProject(id);
    const availableFiles = await getTranscriptFiles();

    if (!data) {
        notFound();
    }

    const study = data.studies.find(s => s.id === studyId);
    if (!study) {
        notFound();
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <StudyHeader projectTitle={data.project.title} study={study} />

            <main className="flex-1 p-8 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Research Plan Summary */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                        <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
                            <h3 className="font-bold text-slate-900">인터뷰 설계 요약</h3>
                            <Link
                                href={`/projects/${id}/studies/${studyId}/edit-plan`}
                                className="text-xs font-bold text-slate-500 hover:text-brand-600 bg-white border border-slate-200 hover:border-brand-300 px-3 py-1.5 rounded-lg transition shadow-sm flex items-center gap-1.5"
                            >
                                <span>⚙️</span> 수정하기
                            </Link>
                        </div>

                        <div className="space-y-5">
                            <div>
                                <h4 className="text-xs font-bold text-slate-400 uppercase">검증해야 할 가설 (핵심 질문)</h4>
                                <ul className="text-sm font-medium text-slate-800 mt-2 space-y-2 p-3 bg-brand-50 rounded-lg border border-brand-100">
                                    {study.plan.researchQuestions.map((q, i) => (
                                        <li key={i} className="flex gap-2">
                                            <span className="text-brand-500 font-bold">Q{i + 1}.</span>
                                            {q}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-slate-400 uppercase">인터뷰 배경</h4>
                                <p className="text-sm text-slate-700 mt-1">{study.plan.background}</p>
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-slate-400 uppercase">타겟 고객 (응답자)</h4>
                                <p className="text-sm text-slate-700 mt-1">{study.plan.target}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: Execution / Sessions */}
                <div className="lg:col-span-2 space-y-8">

                    {/* Discussion Guide Section */}
                    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                <span className="text-xl">📝</span> 인터뷰 가이드
                            </h3>
                            <Link
                                href={`/projects/${id}/studies/${studyId}/guide`}
                                className="text-xs font-bold text-slate-500 hover:text-brand-600 bg-white border border-slate-200 hover:border-brand-300 px-3 py-1.5 rounded-lg transition shadow-sm flex items-center gap-1.5"
                            >
                                <span>✏️</span> 수정하기
                            </Link>
                        </div>

                        {(!study.discussionGuide || study.discussionGuide.length === 0) ? (
                            <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-lg">
                                아직 작성된 가이드가 없습니다. <br />
                                <Link href={`/projects/${id}/studies/${studyId}/guide`} className="text-brand-600 underline">지금 작성하기</Link>
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-[300px] overflow-hidden relative">
                                <ul className="space-y-3 text-sm text-slate-600">
                                    {study.discussionGuide.slice(0, 3).map((block, i) => (
                                        <li key={i} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                            <span className={`text-xs font-bold uppercase mr-2 ${block.type === 'script' ? 'text-slate-400' : 'text-brand-500'}`}>
                                                {block.type === 'script' ? 'SCRIPT' : 'Q'}
                                            </span>
                                            {block.content}
                                        </li>
                                    ))}
                                </ul>
                                {study.discussionGuide.length > 3 && (
                                    <div className="absolute bottom-0 w-full h-20 bg-gradient-to-t from-white to-transparent flex items-end justify-center pb-2">
                                        <Link href={`/projects/${id}/studies/${studyId}/guide`} className="text-brand-600 text-sm font-bold hover:underline">
                                            전체 {study.discussionGuide.length}개 항목 보기
                                        </Link>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                <span className="text-xl">🤖</span> 사전 시뮬레이션
                            </h3>
                            {study.simulationSessions && study.simulationSessions.length > 0 && (
                                <Link
                                    href={`/projects/${id}/studies/${studyId}/simulation`}
                                    className="text-xs bg-brand-600 hover:bg-brand-700 text-white px-3 py-2 rounded-lg font-bold transition flex items-center gap-1"
                                >
                                    + 인터뷰 시작
                                </Link>
                            )}
                        </div>

                        <p className="text-sm text-slate-500 mb-4">캐스팅된 AI 페르소나와 대화하며 기획 내용을 검증해보세요.</p>

                        {(!study.simulationSessions || study.simulationSessions.length === 0) ? (
                            <div className="bg-slate-50 rounded-lg p-8 text-center">
                                <p className="text-slate-500 mb-6">
                                    캐스팅된 AI 페르소나와 대화하며, 작성된 인터뷰 가이드를 기반으로 사전 인터뷰를 진행해보세요.
                                </p>
                                <Link
                                    href={`/projects/${id}/studies/${studyId}/simulation`}
                                    className="inline-flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-6 py-3 rounded-xl font-bold transition shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                                >
                                    <span className="text-xl">🤖</span> 시뮬레이션 시작하기
                                </Link>
                            </div>
                        ) : (
                            <div className="overflow-hidden rounded-lg border border-slate-200">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                                        <tr>
                                            <th className="px-4 py-3">Persona</th>
                                            <th className="px-4 py-3">Date</th>
                                            <th className="px-4 py-3 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {study.simulationSessions.map((session) => {
                                            const persona = data.personas?.find(p => p.id === session.personaId);
                                            return (
                                                <tr key={session.id} className="hover:bg-slate-50 transition group">
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center font-bold text-xs">
                                                                {persona?.name.charAt(0) || '?'}
                                                            </div>
                                                            <div>
                                                                <span className="font-bold text-slate-900 block">{persona?.name || 'Unknown'}</span>
                                                                <span className="text-xs text-slate-400">{persona?.role}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-500">
                                                        {new Date(session.createdAt).toLocaleString()}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <Link
                                                            href={`/projects/${id}/studies/${studyId}/simulation/${session.id}`}
                                                            className="text-xs text-brand-600 font-bold hover:underline bg-brand-50 px-3 py-1.5 rounded-full"
                                                        >
                                                            결과 보기
                                                        </Link>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm min-h-[500px]">
                        <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <span className="text-xl">📊</span> 실전 인터뷰
                        </h3>
                        <ExecutionManager
                            projectId={id}
                            studyId={studyId}
                            interviews={study.sessions}
                            availableFiles={availableFiles}
                        />
                    </div>
                </div>
            </main>
        </div>
    );
}
