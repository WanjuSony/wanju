'use client';

import { useState } from 'react';
import { addInterviewAction, uploadTranscriptAction } from '@/app/actions';
import { RealInterview, StructuredInsight } from '@/lib/types';
import Link from 'next/link';

interface Props {
    projectId: string;
    studyId: string;
    interviews: RealInterview[];
    availableFiles: string[];
}

export function ExecutionManager({ projectId, studyId, interviews, availableFiles }: Props) {
    const [isAdding, setIsAdding] = useState(false);
    const [activeTab, setActiveTab] = useState<'upload' | 'archive'>('upload');
    const [selectedArchiveFile, setSelectedArchiveFile] = useState('');
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);

    const handleAdd = async () => {
        setLoading(true);
        try {
            if (activeTab === 'upload') {
                if (!uploadedFile) return;

                const formData = new FormData();
                formData.append('file', uploadedFile);

                await uploadTranscriptAction(projectId, studyId, formData);
            } else {
                if (!selectedArchiveFile) return;
                await addInterviewAction(projectId, studyId, selectedArchiveFile);
            }
            setIsAdding(false);
            setUploadedFile(null);
            setSelectedArchiveFile('');
        } catch (e: any) {
            console.error(e);
            alert(e.message || "Failed to analyze interview");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-8">
            {/* Header / Actions */}
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-bold text-slate-900">실전 인터뷰 세션</h3>
                    <p className="text-slate-500 text-sm">진행된 인터뷰 기록(Transcript)을 업로드하여 분석합니다.</p>
                </div>
                <button
                    onClick={() => setIsAdding(true)}
                    className="bg-slate-900 hover:bg-black text-white px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 shadow-sm"
                >
                    <span className="text-lg">+</span> 인터뷰 추가
                </button>
            </div>

            {/* Add Modal / Form */}
            {isAdding && (
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm animate-in fade-in zoom-in-95 duration-200">
                    <h4 className="font-bold text-slate-800 mb-4">인터뷰 기록 추가 (Transcript)</h4>

                    <div className="flex gap-6 mb-6 border-b border-slate-100">
                        <button
                            className={`text-sm font-bold pb-2 transition ${activeTab === 'upload' ? 'text-brand-600 border-b-2 border-brand-600' : 'text-slate-400 hover:text-slate-600'}`}
                            onClick={() => setActiveTab('upload')}
                        >
                            📂 파일 업로드
                        </button>
                        <button
                            className={`text-sm font-bold pb-2 transition ${activeTab === 'archive' ? 'text-brand-600 border-b-2 border-brand-600' : 'text-slate-400 hover:text-slate-600'}`}
                            onClick={() => setActiveTab('archive')}
                        >
                            🗄️ 아카이브에서 선택
                        </button>
                    </div>

                    <div className="min-h-[100px] mb-4">
                        {activeTab === 'upload' ? (
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">로컬 .txt 파일 선택</label>
                                <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center hover:bg-slate-50 transition cursor-pointer relative">
                                    <input
                                        type="file"
                                        accept=".txt,.docx"
                                        onChange={(e) => setUploadedFile(e.target.files?.[0] || null)}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    />
                                    <div className="text-slate-500">
                                        {uploadedFile ? (
                                            <div className="font-bold text-brand-600 flex items-center justify-center gap-2">
                                                📄 {uploadedFile.name}
                                            </div>
                                        ) : (
                                            <span className="text-sm">클릭하여 파일 선택 (또는 드래그 앤 드롭)</span>
                                        )}
                                    </div>
                                </div>
                                <p className="text-xs text-slate-400 mt-2">
                                    * .txt 및 .docx 파일 형식을 지원합니다.
                                </p>
                            </div>
                        ) : (
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">아카이브 파일 선택</label>
                                <select
                                    className="w-full text-sm p-3 border border-slate-200 rounded-lg outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                                    value={selectedArchiveFile}
                                    onChange={(e) => setSelectedArchiveFile(e.target.value)}
                                >
                                    <option value="">파일을 선택하세요...</option>
                                    {availableFiles.map(f => (
                                        <option key={f} value={f}>{f}</option>
                                    ))}
                                </select>
                                <p className="text-xs text-slate-400 mt-2">
                                    서버의 아카이브 폴더에 있는 파일을 선택합니다.
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-2 justify-end pt-4 border-t border-slate-50">
                        <button
                            onClick={() => setIsAdding(false)}
                            className="px-4 py-2 text-slate-500 hover:text-slate-800 text-sm font-bold"
                        >
                            취소
                        </button>
                        <button
                            onClick={handleAdd}
                            disabled={loading || (activeTab === 'upload' ? !uploadedFile : !selectedArchiveFile)}
                            className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-bold hover:bg-brand-700 disabled:opacity-50 min-w-[100px] shadow-sm"
                        >
                            {loading ? '분석 중...' : '업로드 및 분석 시작'}
                        </button>
                    </div>
                </div>
            )}

            {/* List of Interviews */}
            {interviews.length === 0 ? (
                !isAdding && (
                    <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
                        <p className="text-slate-400">아직 진행된 인터뷰가 없습니다. <br />녹음본(Transcript)을 업로드하여 분석을 시작하세요.</p>
                    </div>
                )
            ) : (
                <div className="overflow-hidden rounded-lg border border-slate-200">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-3">Interview Title</th>
                                <th className="px-6 py-3">Date</th>
                                <th className="px-6 py-3">Insights</th>
                                <th className="px-6 py-3 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {interviews.map((interview) => (
                                <tr key={interview.id} className="hover:bg-slate-50 transition group">
                                    <td className="px-6 py-4 font-bold text-slate-900">
                                        {interview.title}
                                    </td>
                                    <td className="px-6 py-4 text-slate-500 font-mono text-xs">
                                        {/* Use consistent formatting to avoid hydration mismatch */}
                                        {new Date(interview.date).toISOString().split('T')[0]}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <span className="bg-brand-50 text-brand-700 px-2.5 py-0.5 rounded-full text-xs font-bold border border-brand-100">
                                                {interview.structuredData.length} Items
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <Link
                                            href={`/projects/${projectId}/studies/${studyId}/interview/${interview.id}`}
                                            className="text-xs text-brand-600 font-bold hover:underline bg-brand-50 hover:bg-brand-100 px-4 py-2 rounded-lg transition"
                                        >
                                            View Analysis &rarr;
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
