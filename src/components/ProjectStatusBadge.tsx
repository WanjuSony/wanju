'use client';

import { useState } from 'react';
import { ProjectStatus } from '@/lib/types';
import { updateProjectAction } from '@/app/actions';

interface Props {
    projectId: string;
    currentStatus: ProjectStatus;
    className?: string;
}

export function ProjectStatusBadge({ projectId, currentStatus, className = '' }: Props) {
    const [isOpen, setIsOpen] = useState(false);
    // Initialize state mapping simulation to execution if needed, or keeping it but displaying as execution
    const [status, setStatus] = useState<ProjectStatus>(
        (currentStatus === 'simulation' ? 'execution' : currentStatus) || 'planning'
    );
    const [isUpdating, setIsUpdating] = useState(false);

    // Config DOES NOT include 'simulation' as selectable option
    const statusConfig = {
        planning: { label: '계획 중', color: 'bg-amber-50 text-amber-600 border-amber-100' },
        execution: { label: '진행 중', color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
        completed: { label: '완료', color: 'bg-slate-100 text-slate-600 border-slate-200' }
    } as const;

    const handleSelect = async (newStatus: ProjectStatus) => {
        if (newStatus === status) {
            setIsOpen(false);
            return;
        }

        setIsUpdating(true);
        setStatus(newStatus); // Optimistic update
        setIsOpen(false);

        try {
            const formData = new FormData();
            formData.append('status', newStatus);
            await updateProjectAction(projectId, formData);
        } catch (error) {
            console.error('Failed to update status:', error);
            setStatus(status); // Revert on error
        } finally {
            setIsUpdating(false);
        }
    };

    // Safely determine current config. If status is 'simulation' (from DB or legacy), fallback to 'execution' style
    const validKey = ((status === 'simulation' || !Object.keys(statusConfig).includes(status)) ? 'execution' : status) as keyof typeof statusConfig;
    const currentConfig = statusConfig[validKey];

    return (
        <div className={`relative inline-block ${className}`}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                disabled={isUpdating}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest border transition-all hover:scale-105 active:scale-95 ${currentConfig.color} ${isUpdating ? 'opacity-70 cursor-wait' : 'cursor-pointer hover:shadow-sm'}`}
                title="Click to change status"
            >
                {currentConfig.label}
                <svg className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40 cursor-default"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute top-full left-0 mt-2 w-40 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100 flex flex-col p-1">
                        {(Object.keys(statusConfig) as (keyof typeof statusConfig)[]).map((key) => (
                            <button
                                key={key}
                                onClick={() => handleSelect(key)}
                                className={`text-left px-3 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 ${status === key
                                        ? 'bg-brand-50 text-brand-600'
                                        : 'text-slate-600 hover:bg-slate-50'
                                    }`}
                            >
                                <div className={`w-2 h-2 rounded-full ${key === 'planning' ? 'bg-amber-400' :
                                        key === 'execution' ? 'bg-emerald-400' : 'bg-slate-400'
                                    }`}></div>
                                {statusConfig[key].label}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
