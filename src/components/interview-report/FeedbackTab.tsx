import React from 'react';
import { RealInterview } from '@/lib/types';
import { AnalysisLoadingState } from './AnalysisLoadingState';
import { FeedbackRenderer } from './FeedbackRenderer';

interface Props {
    interview: RealInterview;
    isAnalyzing: boolean;
    onGenerate: () => void;
    onJump: (ref: string) => void;
}

export function FeedbackTab({ interview, isAnalyzing, onGenerate, onJump }: Props) {
    if (isAnalyzing) {
        return <AnalysisLoadingState message="AI 코치가 인터뷰를 면밀히 분석하고 있습니다..." />;
    }

    if (interview.interviewerFeedback) {
        return (
            <div className="prose prose-sm max-w-none">
                <FeedbackRenderer feedback={interview.interviewerFeedback} onJump={onJump} />
            </div>
        );
    }

    return (
        <div className="p-10 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed text-xs space-y-4">
            <p>평가 데이터가 없습니다.</p>
            <button
                onClick={onGenerate}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-indigo-700"
            >
                🎓 AI 코치 평가 시작하기
            </button>
        </div>
    );
}
