import React from 'react';

interface Props {
    message: string;
}

export function AnalysisLoadingState({ message }: Props) {
    return (
        <div className="animate-pulse space-y-4 p-6 bg-white rounded-xl border border-slate-100 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-indigo-50">
                <div className="h-full bg-indigo-500 animate-[loading_2s_ease-in-out_infinite] w-1/3"></div>
            </div>
            <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
                <div className="h-4 bg-slate-100 rounded w-1/3"></div>
            </div>
            <div className="space-y-3">
                <div className="h-2 bg-slate-50 rounded w-full"></div>
                <div className="h-2 bg-slate-50 rounded w-5/6"></div>
                <div className="h-2 bg-slate-50 rounded w-4/6"></div>
            </div>
            <div className="pt-4 flex justify-center">
                <p className="text-xs font-medium text-indigo-600 animate-pulse">{message}</p>
            </div>
        </div>
    );
}
