'use client';

import { useState } from 'react';
import { Project, KnowledgeDocument } from '@/lib/types';
import { addProjectDocumentAction, removeProjectDocumentAction } from '@/app/actions';
import { formatDate } from '@/lib/date-utils';

interface Props {
    project: Project;
}

export function ProjectKnowledgeBase({ project }: Props) {
    const [isUploading, setIsUploading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [docType] = useState<KnowledgeDocument['type']>('project_spec');

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
        <div className="space-y-8">
            <div className="flex justify-between items-center mb-2">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Project Knowledge Base</h2>
                    <p className="text-slate-500 text-sm font-medium mt-1">Upload project specs and guidelines to help AI understand your research context.</p>
                </div>
                {!isUploading && (
                    <button
                        onClick={() => setIsUploading(true)}
                        className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-3 rounded-2xl font-black shadow-lg shadow-brand-100 transition-all hover:scale-[1.02] active:scale-[0.98] text-sm flex items-center gap-2"
                    >
                        <span className="text-xl">+</span> Add Document
                    </button>
                )}
            </div>

            {isUploading && (
                <div className="bg-white border border-slate-100 rounded-[2.5rem] p-10 shadow-xl animate-in fade-in zoom-in-95 duration-300 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-brand-500"></div>
                    <div className="max-w-2xl">
                        <h3 className="text-xl font-black text-slate-900 mb-2">Upload New Document</h3>
                        <p className="text-sm text-slate-500 mb-8 font-medium leading-relaxed">
                            Upload project specifications, research guidelines, or existing findings. AI will use these to provide more contextual responses.
                        </p>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">File Selection (Txt, PDF, Docx, Image)</label>
                                <input
                                    type="file"
                                    accept=".txt,.docx,.pdf,.png,.jpg,.jpeg,.webp"
                                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                                    className="block w-full text-sm text-slate-500 font-medium
                                    file:mr-4 file:py-2.5 file:px-5
                                    file:rounded-xl file:border-0
                                    file:text-[11px] file:font-black file:uppercase file:tracking-widest
                                    file:bg-brand-50 file:text-brand-700
                                    hover:file:bg-brand-100 transition-all cursor-pointer"
                                />
                            </div>
                            <div className="flex justify-end gap-4 pt-6">
                                <button
                                    onClick={() => setIsUploading(false)}
                                    className="px-6 py-3 text-slate-400 font-black text-sm hover:text-slate-600 transition-colors uppercase tracking-widest"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleUpload}
                                    disabled={!file || uploading}
                                    className="px-8 py-3 bg-brand-600 text-white rounded-2xl text-sm font-black hover:bg-brand-700 disabled:opacity-50 shadow-xl shadow-brand-100 transition-all hover:scale-[1.05]"
                                >
                                    {uploading ? 'Analyzing & Uploading...' : 'Upload'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {documents.length === 0 ? (
                <div className="text-center py-24 bg-white border-2 border-dashed border-slate-200 rounded-[2.5rem] shadow-sm">
                    <span className="text-6xl mb-6 block">📂</span>
                    <p className="text-xl font-black text-slate-900 mb-2">Knowledge Base is empty.</p>
                    <p className="text-slate-500 font-medium max-w-xs mx-auto mb-8">Upload documents or images to help AI understand your project better.</p>
                    {!isUploading && (
                        <button onClick={() => setIsUploading(true)} className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black hover:bg-slate-800 transition shadow-xl">
                            Add First Document
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {documents.map(doc => (
                        <div key={doc.id} className="group relative">
                            <div className="absolute inset-0 bg-brand-600 rounded-[2.5rem] translate-y-3 opacity-0 group-hover:opacity-10 transition-all duration-300"></div>
                            <div className="relative bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-500 flex flex-col h-full">
                                <div className="absolute top-0 left-0 w-2 h-full bg-brand-500 rounded-l-[2.5rem] opacity-0 group-hover:opacity-100 transition-opacity z-20"></div>

                                <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition z-30">
                                    <button
                                        onClick={() => handleDelete(doc.id)}
                                        className="text-slate-300 hover:text-red-500 transition-colors"
                                        title="Delete"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                    </button>
                                </div>
                                <div className="flex items-center gap-5 mb-6">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-[10px] font-black uppercase tracking-tighter shadow-sm transition-colors duration-300
                                        ${doc.fileName.toLowerCase().endsWith('.docx') ? 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white' :
                                            doc.fileName.toLowerCase().endsWith('.pdf') ? 'bg-red-50 text-red-600 group-hover:bg-red-600 group-hover:text-white' :
                                                /\.(png|jpe?g|webp)$/i.test(doc.fileName) ? 'bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white' :
                                                    'bg-slate-50 text-slate-500 group-hover:bg-slate-600 group-hover:text-white'}
                                    `}>
                                        {doc.fileName.toLowerCase().endsWith('.docx') ? 'docx' :
                                            doc.fileName.toLowerCase().endsWith('.pdf') ? 'pdf' :
                                                /\.(png|jpe?g|webp)$/i.test(doc.fileName) ? 'img' : 'txt'}
                                    </div>
                                    <div>
                                        <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full border tracking-widest ${doc.type === 'project_spec' ? 'bg-brand-50 text-brand-600 border-brand-100' :
                                            doc.type === 'guideline' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                'bg-slate-50 text-slate-500 border-slate-100'
                                            }`}>
                                            {doc.type === 'project_spec' ? 'Spec' :
                                                doc.type === 'guideline' ? 'Guide' : 'Other'}
                                        </span>
                                        <h4 className="font-black text-slate-900 group-hover:text-brand-600 transition truncate w-40 mt-1 tracking-tight" title={doc.title}>
                                            {doc.title}
                                        </h4>
                                    </div>
                                </div>
                                <p className="text-sm font-medium text-slate-500 line-clamp-3 mb-8 bg-slate-50 p-4 rounded-2xl leading-relaxed flex-1 italic">
                                    "{doc.content.substring(0, 120)}..."
                                </p>
                                <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest text-right">
                                    {formatDate(doc.createdAt)}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
