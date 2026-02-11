'use client';

import { StudyPlan } from '@/lib/types';
import { useState, useTransition } from 'react';
import { updateStudyPlanFieldsAction } from '@/app/actions';

interface Props {
    plan: StudyPlan;
    projectId: string;
    studyId: string;
}

export function StudyPlanView({ plan, projectId, studyId }: Props) {
    const [editingSection, setEditingSection] = useState<'background' | 'target' | 'utilization' | 'purpose' | null>(null);
    const [draftContent, setDraftContent] = useState('');
    const [isPending, startTransition] = useTransition();

    const handleEditStart = (section: 'background' | 'target' | 'utilization' | 'purpose', content: string) => {
        setEditingSection(section);
        setDraftContent(content || '');
    };

    const handleSave = () => {
        if (!editingSection) return;

        startTransition(async () => {
            try {
                const update: Partial<StudyPlan> = {};
                if (editingSection === 'background') update.background = draftContent;
                if (editingSection === 'target') update.target = draftContent;
                if (editingSection === 'utilization') update.utilization = draftContent;
                if (editingSection === 'purpose') update.purpose = draftContent;

                await updateStudyPlanFieldsAction(projectId, studyId, update);
                setEditingSection(null);
            } catch (e) {
                console.error(e);
                alert('저장 실패');
            }
        });
    };

    const renderSection = (title: string, content: string, sectionKey: 'background' | 'target' | 'utilization' | 'purpose', icon: string) => (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm group hover:border-brand-200 transition-colors relative">
            <div className="flex justify-between items-center mb-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <span className="text-base">{icon}</span>
                    {title}
                </h4>
                {editingSection !== sectionKey && (
                    <button
                        onClick={() => handleEditStart(sectionKey, content)}
                        className="text-brand-400 hover:text-brand-700 hover:bg-brand-50 p-1 rounded opacity-0 group-hover:opacity-100 transition-all text-xs font-bold flex items-center gap-1"
                    >
                        <span>✏️ Edit</span>
                    </button>
                )}
            </div>
            {editingSection === sectionKey ? (
                <div className="space-y-3 animate-in fade-in duration-200">
                    <textarea
                        value={draftContent}
                        onChange={(e) => setDraftContent(e.target.value)}
                        className="w-full text-sm p-3 border border-brand-200 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none resize-none bg-white leading-relaxed min-h-[120px]"
                        placeholder={`${title}을(를) 입력하세요...`}
                        autoFocus
                    />
                    <div className="flex justify-end gap-2">
                        <button
                            onClick={() => setEditingSection(null)}
                            className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                            disabled={isPending}
                        >
                            취소
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-3 py-1.5 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
                            disabled={isPending}
                        >
                            {isPending ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                            {isPending ? '저장 중...' : '저장하기'}
                        </button>
                    </div>
                </div>
            ) : (
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {content || <span className="text-slate-400 italic">내용이 없습니다.</span>}
                </p>
            )}
        </div>
    );

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {renderSection('배경 (Background)', plan.background, 'background', '🎯')}
            {renderSection('목적 (Purpose)', plan.purpose, 'purpose', '🚩')}
            {renderSection('타겟 (Target)', plan.target, 'target', '👥')}
            {renderSection('활용 계획 (Utilization)', plan.utilization, 'utilization', '🚀')}
        </div>
    );
}
