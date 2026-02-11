import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { RealInterview } from '@/lib/types';
import { AnalysisLoadingState } from './AnalysisLoadingState';

interface Props {
    interview: RealInterview;
    isAnalyzing: boolean;
    onGenerate: () => void;
}

export function SummaryTab({ interview, isAnalyzing, onGenerate }: Props) {
    if (isAnalyzing) {
        return <AnalysisLoadingState message="AI가 인터뷰 내용을 요약하고 있습니다..." />;
    }

    if (interview.summary && interview.summary !== 'Live interview recording.') {
        return (
            <div className="prose prose-sm max-w-none text-slate-600">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{interview.summary}</ReactMarkdown>
            </div>
        );
    }

    return (
        <div className="p-10 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed text-xs space-y-4">
            <p>아직 생성된 요약이 없습니다.</p>
            <button
                onClick={onGenerate}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-indigo-700 transition"
            >
                ⚡ 요약 생성하기
            </button>
        </div>
    );
}
