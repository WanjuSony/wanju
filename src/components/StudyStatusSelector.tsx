'use client';

import { useState } from 'react';
import { updateStudyStatusAction } from '@/app/actions';

type StudyStatus = 'planning' | 'recruiting' | 'fieldwork' | 'analysis' | 'done';

interface Props {
    projectId: string;
    studyId: string;
    currentStatus: StudyStatus;
    readonly?: boolean;
}

const statusMap: Record<StudyStatus, { label: string; color: string; bg: string }> = {
    planning: { label: '기획중', color: 'text-slate-600', bg: 'bg-slate-100' },
    recruiting: { label: '모집중', color: 'text-blue-600', bg: 'bg-blue-50' },
    fieldwork: { label: '진행중', color: 'text-green-700', bg: 'bg-green-50' },
    analysis: { label: '분석중', color: 'text-amber-700', bg: 'bg-amber-50' },
    done: { label: '완료', color: 'text-brand-700', bg: 'bg-brand-50' },
};

export function StudyStatusSelector({ projectId, studyId, currentStatus, readonly }: Props) {
    const [status, setStatus] = useState<StudyStatus>(currentStatus);
    const [isUpdating, setIsUpdating] = useState(false);

    const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newStatus = e.target.value as StudyStatus;
        setIsUpdating(true);
        setStatus(newStatus);

        try {
            await updateStudyStatusAction(projectId, studyId, newStatus);
        } catch (error) {
            console.error('Failed to update status:', error);
            setStatus(currentStatus); // Revert on failure
        } finally {
            setIsUpdating(false);
        }
    };

    const config = statusMap[status];

    if (readonly) {
        return (
            <span className={`px-3 py-1 text-xs font-bold rounded-full uppercase shadow-sm ${config.bg} ${config.color}`}>
                {config.label}
            </span>
        );
    }

    return (
        <div
            className="relative z-20 group"
            onClick={(e) => e.stopPropagation()}
        >
            <select
                value={status}
                onChange={handleStatusChange}
                disabled={isUpdating}
                className={`appearance-none px-3 py-1 pr-8 text-xs font-bold rounded-full uppercase cursor-pointer border border-transparent hover:border-brand-200 focus:ring-2 focus:ring-brand-500 transition-all shadow-sm ${config.bg} ${config.color} ${isUpdating ? 'opacity-50 font-normal' : ''}`}
            >
                <option value="planning">기획중</option>
                <option value="recruiting">모집중</option>
                <option value="fieldwork">진행중</option>
                <option value="analysis">분석중</option>
                <option value="done">완료</option>
            </select>
            <div className={`absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${config.color}`}>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" />
                </svg>
            </div>
        </div>
    );
}
