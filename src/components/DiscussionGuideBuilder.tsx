'use client';

import { useState } from 'react';
import { updateDiscussionGuideAction } from '@/app/actions';
import { GuideBlock } from '@/lib/types';
import { useRouter } from 'next/navigation';

interface Props {
    projectId: string;
    studyId: string;
    initialBlocks?: GuideBlock[];
    researchQuestions: string[]; // From StudyPlan, for context
    isFullPage?: boolean;
}

export default function DiscussionGuideBuilder({ projectId, studyId, initialBlocks = [], researchQuestions, isFullPage = false }: Props) {
    const router = useRouter();
    const [blocks, setBlocks] = useState<GuideBlock[]>(
        initialBlocks.length > 0
            ? initialBlocks
            : [
                { id: 'intro', type: 'script', content: '안녕하세요, 바쁘신 와중에 인터뷰에 응해주셔서 감사합니다. 오늘 인터뷰는 약 30분간 진행될 예정입니다.' },
                { id: 'q1', type: 'question', content: '' }
            ]
    );
    const [isSaving, setIsSaving] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [logSummary, setLogSummary] = useState('');

    const handleChange = (index: number, value: string) => {
        const newBlocks = [...blocks];
        newBlocks[index].content = value;
        setBlocks(newBlocks);
        setIsSaved(false);
    };

    const addBlock = (type: 'question' | 'script') => {
        setBlocks([...blocks, { id: Date.now().toString(), type, content: '' }]);
    };

    const removeBlock = (index: number) => {
        setBlocks(blocks.filter((_, i) => i !== index));
        setIsSaved(false);
    };

    const moveBlock = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === blocks.length - 1) return;

        const newBlocks = [...blocks];
        const temp = newBlocks[index];
        newBlocks[index] = newBlocks[index + (direction === 'up' ? -1 : 1)];
        newBlocks[index + (direction === 'up' ? -1 : 1)] = temp;
        setBlocks(newBlocks);
        setIsSaved(false);
    };

    const handleSave = async (redirect: boolean = false) => {
        setIsSaving(true);
        // Prompt for log summary if it's an edit to an existing guide
        let summary = logSummary;
        if (initialBlocks.length > 0 && !summary) {
            const input = prompt("수정 사항을 간략히 기록해주세요 (예: 질문 2개 추가):", "가이드 업데이트");
            if (input) summary = input;
        }

        await updateDiscussionGuideAction(projectId, studyId, blocks, summary);
        setIsSaving(false);
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 3000);

        if (redirect) {
            router.push(`/projects/${projectId}/studies/${studyId}`);
        }
    };

    const generateAIQuestions = () => {
        if (confirm('기획된 핵심 질문을 바탕으로 AI가 질문 초안을 추가하시겠습니까?')) {
            const aiSuggestions: GuideBlock[] = researchQuestions.map((rq, i) => ({
                id: `ai-${Date.now()}-${i}`,
                type: 'question',
                content: `[AI 제안] "${rq}" 와 관련하여, 구체적인 사례를 말씀해주실 수 있나요?`
            }));

            setBlocks([...blocks, ...aiSuggestions]);
            setIsSaved(false);
        }
    };

    return (
        <div className={`flex flex-col h-full bg-slate-50 rounded-xl overflow-hidden border border-slate-200 ${isFullPage ? 'shadow-lg min-h-[80vh]' : ''}`}>
            {/* Toolbar */}
            <div className="bg-white border-b border-slate-200 p-4 flex justify-between items-center sticky top-0 z-10">
                <div>
                    {!isFullPage && (
                        <h3 className="font-bold text-slate-900 flex items-center gap-2">
                            <span className="text-xl">📝</span> 인터뷰 가이드
                        </h3>
                    )}
                    <p className="text-xs text-slate-500 mt-1">인사말, 설명, 질문을 자유롭게 구성하세요.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={generateAIQuestions}
                        className="px-3 py-2 bg-purple-50 text-purple-700 text-xs font-bold rounded-lg hover:bg-purple-100 transition"
                    >
                        ✨ AI 추천
                    </button>
                    {!isFullPage ? (
                        <button
                            onClick={() => handleSave(false)}
                            disabled={isSaving}
                            className={`px-4 py-2 text-white text-xs font-bold rounded-lg transition shadow-sm ${isSaved ? 'bg-green-600' : 'bg-slate-900 hover:bg-slate-800'
                                }`}
                        >
                            {isSaving ? '저장 중...' : isSaved ? '저장됨!' : '저장하기'}
                        </button>
                    ) : (
                        <div className="flex gap-2">
                            <button
                                onClick={() => handleSave(false)}
                                className="px-4 py-2 text-slate-500 hover:text-slate-900 text-xs font-bold"
                            >
                                임시 저장
                            </button>
                            <button
                                onClick={() => handleSave(true)}
                                disabled={isSaving}
                                className="px-6 py-2 bg-brand-600 text-white text-sm font-bold rounded-lg hover:bg-brand-700 shadow-md"
                            >
                                저장 및 완료 &rarr;
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Document Editor Area */}
            <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-slate-50">
                {blocks.map((block, i) => (
                    <div key={block.id} className="relative group flex gap-4 max-w-4xl mx-auto items-start">
                        {/* Gutter / Controls */}
                        <div className="w-8 pt-4 flex flex-col items-center gap-2 opacity-0 group-hover:opacity-100 transition">
                            <button onClick={() => moveBlock(i, 'up')} className="text-slate-400 hover:text-brand-600">▲</button>
                            <span className="text-xs font-mono text-slate-300">{i + 1}</span>
                            <button onClick={() => moveBlock(i, 'down')} className="text-slate-400 hover:text-brand-600">▼</button>
                        </div>

                        {/* Content Block */}
                        <div className={`flex-1 p-6 rounded-xl border shadow-sm transition-all relative ${block.type === 'script'
                                ? 'bg-slate-100 border-slate-200'
                                : 'bg-white border-brand-100 ring-1 ring-brand-50'
                            }`}>
                            <div className="flex justify-between items-center mb-3">
                                <span className={`text-xs font-bold uppercase tracking-wider ${block.type === 'script' ? 'text-slate-500' : 'text-brand-600'
                                    }`}>
                                    {block.type === 'script' ? '📢 스크립트 / 안내 멘트' : '🙋‍♀️ 핵심 질문'}
                                </span>
                                <button onClick={() => removeBlock(i)} className="text-slate-300 hover:text-red-500">&times;</button>
                            </div>
                            <textarea
                                className={`w-full bg-transparent outline-none resize-none text-base leading-relaxed ${block.type === 'script' ? 'text-slate-600' : 'text-slate-900 font-medium'
                                    }`}
                                rows={block.content.split('\n').length + 1}
                                placeholder={block.type === 'script' ? "진행자 멘트를 입력하세요 (예: 녹음 동의 구하기...)" : "질문 내용을 입력하세요..."}
                                value={block.content}
                                onChange={(e) => handleChange(i, e.target.value)}
                            />
                        </div>
                    </div>
                ))}

                {/* Add Buttons */}
                <div className="flex justify-center gap-4 py-12 border-t border-slate-200 border-dashed mt-12">
                    <button
                        onClick={() => addBlock('question')}
                        className="flex items-center gap-2 px-6 py-4 bg-white border-2 border-brand-100 text-brand-600 rounded-2xl hover:border-brand-500 hover:text-brand-700 font-bold transition shadow-sm"
                    >
                        <span className="text-xl">+</span> 질문 추가
                    </button>
                    <button
                        onClick={() => addBlock('script')}
                        className="flex items-center gap-2 px-6 py-4 bg-white border-2 border-slate-200 text-slate-500 rounded-2xl hover:border-slate-400 hover:text-slate-700 font-medium transition shadow-sm"
                    >
                        <span className="text-xl">+</span> 멘트/안내 추가
                    </button>
                </div>
            </div>

            {/* Footer Only in Widget Mode */}
            {!isFullPage && (
                <div className="bg-white border-t border-slate-200 p-4 flex justify-end gap-3 z-10">
                    <div className="flex gap-2 w-full">
                        <button
                            onClick={() => alert("사전 시뮬레이션 화면으로 스크롤 이동합니다 (구현 예정)")}
                            className="flex-1 px-4 py-2 text-slate-600 bg-slate-100 rounded-lg text-sm font-bold hover:bg-slate-200"
                        >
                            🤖 시뮬레이션 테스트
                        </button>
                        <a
                            href={`/projects/${projectId}/studies/${studyId}?view=execution`}
                            className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-bold hover:bg-brand-700 shadow-md text-center"
                        >
                            🚀 실전 인터뷰
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
}
