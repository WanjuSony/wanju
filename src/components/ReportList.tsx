'use client';

import { useState } from 'react';
import { RealInterview, WeeklyReport, Persona, ResearchStudy } from '@/lib/types';
import { createWeeklyReportAction, deleteWeeklyReportAction, updateWeeklyReportTitleAction } from '@/app/actions';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
    projectId: string;
    studyId: string;
    reports: WeeklyReport[];
    interviews: RealInterview[];
    personas?: Persona[];
    studies?: ResearchStudy[];
}

export function ReportList({ projectId, studyId, reports = [], interviews, personas = [], studies = [] }: Props) {
    // ... hooks ...
    const [isCreating, setIsCreating] = useState(false);
    const [selectedInterviews, setSelectedInterviews] = useState<string[]>([]);
    const [title, setTitle] = useState('');
    const [userComments, setUserComments] = useState('');
    const [generating, setGenerating] = useState(false);
    const [editingReportId, setEditingReportId] = useState<string | null>(null);
    const [editingTitle, setEditingTitle] = useState('');

    // Modal State
    const [viewingReport, setViewingReport] = useState<WeeklyReport | null>(null);

    const handleToggleInterview = (id: string) => {
        if (selectedInterviews.includes(id)) {
            setSelectedInterviews(prev => prev.filter(i => i !== id));
        } else {
            setSelectedInterviews(prev => [...prev, id]);
        }
    };

    const handleCreate = async () => {
        if (selectedInterviews.length === 0) return alert("최소 1개의 인터뷰를 선택해주세요.");
        setGenerating(true);
        try {
            await createWeeklyReportAction(projectId, studyId, selectedInterviews, title, userComments);
            setIsCreating(false);
            setSelectedInterviews([]);
            setTitle('');
            setUserComments('');
        } catch (e) {
            console.error(e);
            alert("리포트 생성 실패 due to server error");
        } finally {
            setGenerating(false);
        }
    };

    const handleDelete = async (reportId: string) => {
        if (!confirm("정말 이 리포트를 삭제하시겠습니까?")) return;
        setViewingReport(null); // Close modal if open
        await deleteWeeklyReportAction(projectId, studyId, reportId);
    };

    const handleEditStart = (report: WeeklyReport) => {
        setEditingReportId(report.id);
        setEditingTitle(report.title);
    };

    const handleEditSave = async (reportId: string) => {
        if (!editingTitle.trim()) return;
        setEditingReportId(null);
        await updateWeeklyReportTitleAction(projectId, studyId, reportId, editingTitle);
    };

    const handleCopy = () => {
        if (!viewingReport) return;
        navigator.clipboard.writeText(viewingReport.content);
        alert("리포트 내용이 클립보드에 복사되었습니다.");
    };

    return (
        <div className="animate-in fade-in duration-300">
            {/* Header with consistent styling */}
            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
                <h3 className="font-bold text-slate-900">주간 리포트</h3>
                <button
                    onClick={() => setIsCreating(true)}
                    className="text-xs bg-brand-600 hover:bg-brand-700 text-white px-3 py-2 rounded-lg font-bold flex items-center gap-1 transition shadow-sm"
                >
                    + 리포트 생성
                </button>
            </div>

            {isCreating && (
                <div className="bg-white border border-brand-200 rounded-xl p-4 shadow-lg mb-6 text-sm">
                    <h4 className="font-bold text-slate-900 mb-4 border-b pb-2">새 리포트 설정</h4>

                    <div className="mb-3">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">제목</label>
                        <input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="예: 2024년 1월 3주차 리서치 요약"
                            className="w-full border rounded p-2"
                        />
                    </div>

                    <div className="mb-3">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex justify-between">
                            <span>꼭 포함할 내용 (선택)</span>
                            <span className="text-brand-600 font-normal">AI에게 힌트 주기</span>
                        </label>
                        <textarea
                            value={userComments}
                            onChange={(e) => setUserComments(e.target.value)}
                            placeholder="예: 이번 인터뷰에서 30대 여성들의 구매 패턴 변화가 중요했어. 이 부분을 강조해줘."
                            className="w-full border rounded p-2 h-20 resize-none placeholder:text-slate-300"
                        />
                    </div>

                    <div className="mb-4">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">인터뷰 선택 ({selectedInterviews.length})</label>
                        <div className="max-h-40 overflow-y-auto border rounded p-2 bg-slate-50 space-y-1">
                            {interviews.length === 0 ? (
                                <p className="text-xs text-slate-400 p-1">인터뷰 없음</p>
                            ) : (
                                interviews.map(int => {
                                    let displayTitle = int.title;
                                    const persona = int.participantId ? personas.find(p => p.id === int.participantId) : null;
                                    const study = studies.find(s => s.id === int.studyId);

                                    if (persona && study) {
                                        const idx = study.sessions.findIndex(s => s.id === int.id);
                                        if (idx !== -1) {
                                            displayTitle = `${idx + 1}. ${persona.name}`;
                                        }
                                    }

                                    return (
                                        <label key={int.id} className="flex items-center gap-2 p-1.5 hover:bg-white rounded cursor-pointer border border-transparent hover:border-slate-200">
                                            <input
                                                type="checkbox"
                                                checked={selectedInterviews.includes(int.id)}
                                                onChange={() => handleToggleInterview(int.id)}
                                                className="rounded text-brand-600 focus:ring-brand-500"
                                            />
                                            <div className="truncate text-xs text-slate-700 font-medium">
                                                {displayTitle}
                                                <span className="text-slate-400 ml-2 font-normal">{int.date}</span>
                                            </div>
                                        </label>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end gap-2">
                        <button
                            onClick={() => setIsCreating(false)}
                            className="px-3 py-1.5 text-slate-500 hover:bg-slate-100 rounded text-xs font-bold"
                            disabled={generating}
                        >
                            취소
                        </button>
                        <button
                            onClick={handleCreate}
                            disabled={generating || selectedInterviews.length === 0}
                            className="px-4 py-2 bg-brand-600 text-white rounded text-xs font-bold hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2"
                        >
                            {generating ? (
                                <>
                                    <span className="animate-spin">↻</span>
                                    <span>생성 중...</span>
                                </>
                            ) : (
                                <span>생성하기</span>
                            )}
                        </button>
                    </div>
                </div>
            )}

            <div className="space-y-3">
                {reports.length === 0 ? (
                    <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        <p className="text-xs text-slate-400">생성된 리포트가 없습니다.</p>
                        <p className="text-[10px] text-slate-300 mt-1">인터뷰를 선택하여 팀원들과 공유할 리포트를 만들어보세요.</p>
                    </div>
                ) : (
                    reports.map(report => (
                        <div
                            key={report.id}
                            onClick={() => setViewingReport(report)}
                            className="bg-white border border-slate-200 rounded-lg p-3 hover:shadow-md transition cursor-pointer group hover:border-brand-200"
                        >
                            <div className="flex items-center gap-3">
                                <div className="bg-brand-50 text-brand-600 p-2 rounded-lg group-hover:bg-brand-100 transition">
                                    📑
                                </div>
                                <div className="flex-1">
                                    {editingReportId === report.id ? (
                                        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                            <input
                                                value={editingTitle}
                                                onChange={e => setEditingTitle(e.target.value)}
                                                className="text-sm font-bold border-b border-brand-500 focus:outline-none bg-transparent px-0 py-0.5 flex-1 min-w-0"
                                                autoFocus
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') handleEditSave(report.id);
                                                    if (e.key === 'Escape') setEditingReportId(null);
                                                }}
                                            />
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => handleEditSave(report.id)}
                                                    className="p-1 text-green-600 hover:bg-green-50 rounded-full transition"
                                                    title="저장"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                                </button>
                                                <button
                                                    onClick={() => setEditingReportId(null)}
                                                    className="p-1 text-slate-400 hover:bg-slate-100 rounded-full transition"
                                                    title="취소"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="group/title flex items-center gap-2">
                                            <h4 className="font-bold text-sm text-slate-800 group-hover:text-brand-700 truncate">{report.title}</h4>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleEditStart(report);
                                                }}
                                                className="opacity-0 group-hover/title:opacity-100 text-slate-400 hover:text-brand-600 transition p-1 hover:bg-slate-100 rounded"
                                                title="이름 수정"
                                            >
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                                            </button>
                                        </div>
                                    )}
                                    <p className="text-[10px] text-slate-400 mt-0.5">
                                        {new Date(report.createdAt).toISOString().split('T')[0]} • 인터뷰 {report.interviewIds.length}건
                                    </p>
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(report.id);
                                    }}
                                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition opacity-0 group-hover:opacity-100"
                                    title="리포트 삭제"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modal for Viewing Report */}
            {viewingReport && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setViewingReport(null)}>
                    <div
                        className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-2xl">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">{viewingReport.title}</h2>
                                <p className="text-xs text-slate-500">생성일: {new Date(viewingReport.createdAt).toISOString().replace('T', ' ').substring(0, 16)}</p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        const blob = new Blob([viewingReport.content], { type: 'text/markdown' });
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `${viewingReport.title}.md`;
                                        a.click();
                                    }}
                                    className="text-xs font-bold px-3 py-2 bg-white border border-slate-300 rounded hover:bg-slate-50 text-slate-700 flex items-center gap-1"
                                >
                                    📥 다운로드
                                </button>
                                <button
                                    onClick={handleCopy}
                                    className="text-xs font-bold px-3 py-2 bg-white border border-slate-300 rounded hover:bg-slate-50 text-slate-700 flex items-center gap-1"
                                >
                                    📋 복사하기
                                </button>
                                <button
                                    onClick={() => handleDelete(viewingReport.id)}
                                    className="text-xs font-bold px-3 py-2 bg-white border border-red-200 rounded hover:bg-red-50 text-red-500"
                                >
                                    삭제
                                </button>
                                <button
                                    onClick={() => setViewingReport(null)}
                                    className="ml-2 text-slate-400 hover:text-slate-600 p-1"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 bg-white">
                            <article className="prose prose-slate max-w-none prose-headings:font-bold prose-h1:text-2xl prose-h2:text-xl prose-h2:border-b prose-h2:pb-2 prose-h2:mt-8 prose-p:text-slate-700 prose-li:text-slate-700 prose-table:border prose-th:bg-slate-100 prose-th:p-2 prose-td:p-2 prose-td:border prose-th:border">
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                        table: ({ node, ...props }) => <table className="border-collapse border border-slate-200 w-full text-sm my-4" {...props} />,
                                        th: ({ node, ...props }) => <th className="border border-slate-200 bg-slate-100 p-2 font-bold text-slate-700 text-left" {...props} />,
                                        td: ({ node, ...props }) => <td className="border border-slate-200 p-2 text-slate-600 align-top" {...props} />
                                    }}
                                >
                                    {viewingReport.content}
                                </ReactMarkdown>
                            </article>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
