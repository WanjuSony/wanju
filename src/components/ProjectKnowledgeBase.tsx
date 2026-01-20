'use client';

import { useState } from 'react';
import { Project, KnowledgeDocument } from '@/lib/types';
import { addProjectDocumentAction, removeProjectDocumentAction } from '@/app/actions';

interface Props {
    project: Project;
}

export function ProjectKnowledgeBase({ project }: Props) {
    const [isUploading, setIsUploading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [docType, setDocType] = useState<KnowledgeDocument['type']>('project_spec');

    const handleUpload = async () => {
        if (!file) return;

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', docType);

            await addProjectDocumentAction(project.id, formData);

            setIsUploading(false);
            setFile(null);
            setDocType('project_spec');
        } catch (e: any) {
            alert(e.message || "Upload failed");
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (docId: string) => {
        if (!confirm('Are you sure you want to delete this document?')) return;
        try {
            await removeProjectDocumentAction(project.id, docId);
        } catch (e: any) {
            alert("Failed to delete");
        }
    };

    const documents = project.documents || [];

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-slate-900">프로젝트 지식 저장소 (Knowledge Base)</h2>
                    <p className="text-slate-500 text-sm mt-1">
                        AI가 프로젝트의 맥락을 이해하도록 기획서, 가이드라인, 기존 리서치 자료 등을 업로드하세요.
                    </p>
                </div>
                <button
                    onClick={() => setIsUploading(true)}
                    className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-sm hover:shadow-md transition flex items-center gap-2 transform hover:-translate-y-0.5"
                >
                    <span className="text-xl">+</span> 자료 추가
                </button>
            </div>

            {isUploading && (
                <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-xl animate-in fade-in zoom-in-95 duration-200">
                    <h3 className="font-bold text-slate-800 mb-6 text-lg">새 자료 업로드</h3>
                    <div className="space-y-5">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">파일 선택 (.txt, .docx)</label>
                            <input
                                type="file"
                                accept=".txt,.docx"
                                onChange={(e) => setFile(e.target.files?.[0] || null)}
                                className="block w-full text-sm text-slate-500
                                file:mr-4 file:py-2.5 file:px-5
                                file:rounded-xl file:border-0
                                file:text-sm file:font-bold
                                file:bg-brand-50 file:text-brand-700
                                hover:file:bg-brand-100 transition cursor-pointer"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">문서 유형</label>
                            <select
                                value={docType}
                                onChange={(e) => setDocType(e.target.value as any)}
                                className="w-full p-3 border border-slate-200 rounded-xl text-sm focus:ring-2 ring-brand-500 outline-none bg-slate-50/50"
                            >
                                <option value="project_spec">기획서 / 요구사항 정의서</option>
                                <option value="guideline">디자인 / 리서치 가이드라인</option>
                                <option value="other">기타 참고 자료</option>
                            </select>
                        </div>
                        <div className="flex justify-end gap-3 pt-4">
                            <button
                                onClick={() => setIsUploading(false)}
                                className="px-5 py-2.5 text-slate-500 hover:text-slate-800 text-sm font-bold bg-slate-50 rounded-xl hover:bg-slate-100"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleUpload}
                                disabled={!file || uploading}
                                className="px-6 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-bold hover:bg-brand-700 disabled:opacity-50 shadow-md transition"
                            >
                                {uploading ? '업로드 중...' : '업로드'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {documents.length === 0 ? (
                <div className="text-center py-16 bg-white border border-slate-100 rounded-2xl shadow-sm">
                    <div className="text-4xl mb-4">📂</div>
                    <p className="text-slate-500 font-medium">등록된 자료가 없습니다.</p>
                    <button onClick={() => setIsUploading(true)} className="text-brand-600 text-sm font-bold mt-2 hover:underline">자료를 추가하여 AI의 이해도를 높이세요</button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {documents.map(doc => (
                        <div key={doc.id} className="bg-white p-6 rounded-2xl border border-slate-100 hover:shadow-lg transition-all duration-300 group relative cursor-default">
                            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition">
                                <button
                                    onClick={() => handleDelete(doc.id)}
                                    className="text-slate-300 hover:text-red-500 p-1.5 hover:bg-red-50 rounded-full transition"
                                    title="Delete"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                </button>
                            </div>
                            <div className="flex items-center gap-4 mb-4">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-sm
                                    ${doc.fileName.endsWith('.docx') ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-500'}
                                `}>
                                    {doc.fileName.endsWith('.docx') ? 'docx' : 'txt'}
                                </div>
                                <div>
                                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${doc.type === 'project_spec' ? 'bg-brand-50 text-brand-600 border-brand-100' :
                                        doc.type === 'guideline' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                            'bg-slate-50 text-slate-500 border-slate-100'
                                        }`}>
                                        {doc.type === 'project_spec' ? '기획서' :
                                            doc.type === 'guideline' ? '가이드라인' : '기타'}
                                    </span>
                                    <h4 className="font-bold text-slate-800 text-sm truncate w-40 mt-1.5" title={doc.title}>
                                        {doc.title}
                                    </h4>
                                </div>
                            </div>
                            <p className="text-xs text-slate-500 line-clamp-3 mb-4 bg-slate-50 p-3 rounded-xl leading-relaxed">
                                {doc.content.substring(0, 100)}...
                            </p>
                            <div className="text-[10px] text-slate-300 text-right font-mono">
                                {new Date(doc.createdAt).toLocaleDateString()}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
