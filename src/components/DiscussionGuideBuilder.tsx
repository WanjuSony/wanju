'use client';

import { useState, useEffect } from 'react';
import { updateDiscussionGuideAction, generateAIInterviewQuestionAction } from '@/app/actions';
import { GuideBlock, ResearchStudy } from '@/lib/types';
import { useRouter } from 'next/navigation';
import TextareaAutosize from 'react-textarea-autosize';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Props {
    projectId: string;
    studyId: string;
    initialBlocks?: GuideBlock[];
    researchQuestions: string[]; // From StudyPlan, for context
    isFullPage?: boolean;
    otherStudies?: ResearchStudy[];
}

interface SortableBlockProps {
    block: GuideBlock;
    index: number;
    onChange: (index: number, val: string) => void;
    onRemove: (index: number) => void;
    onAddAfter: (index: number, type: 'question' | 'script' | 'section', content?: string) => void;
    projectId: string;
    studyId: string;
}

function SortableBlockItem({ block, index, onChange, onRemove, onAddAfter, projectId, studyId }: SortableBlockProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: block.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
        position: 'relative' as const,
        opacity: isDragging ? 0.3 : 1,
    };

    // AI Prompt State
    const [isAiMode, setIsAiMode] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    const handleAiSubmit = async () => {
        if (!aiPrompt.trim()) return;
        setIsGenerating(true);
        try {
            const question = await generateAIInterviewQuestionAction(projectId, studyId, aiPrompt);
            onAddAfter(index, 'question', question);
            setIsAiMode(false);
            setAiPrompt('');
        } catch (e) {
            alert('AI 생성 실패');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div ref={setNodeRef} style={style} className="group/item relative">
            <div className="flex gap-4 items-start relative">
                {/* Drag Handle & Controls */}
                <div className="absolute -left-10 top-2 flex flex-col items-center gap-1 opacity-0 group-hover/item:opacity-100 transition cursor-grab active:cursor-grabbing p-2"
                    {...attributes} {...listeners}>
                    <div className="text-slate-300 hover:text-slate-600">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="9" cy="5" r="1" />
                            <circle cx="9" cy="12" r="1" />
                            <circle cx="9" cy="19" r="1" />
                            <circle cx="15" cy="5" r="1" />
                            <circle cx="15" cy="12" r="1" />
                            <circle cx="15" cy="19" r="1" />
                        </svg>
                    </div>
                    <button
                        onPointerDown={(e) => {
                            e.stopPropagation(); // Prevent drag start
                            onRemove(index);
                        }}
                        className="text-slate-300 hover:text-red-500 mt-1"
                    >
                        &times;
                    </button>
                </div>

                {/* Content Render */}
                <div className="flex-1 w-full">
                    {/* Section Header Block */}
                    {block.type === 'section' && (
                        <div className="mt-8 mb-4 border-b-2 border-slate-100 pb-2 flex items-center">
                            <div className="bg-slate-800 text-white text-xs font-bold px-2 py-1 rounded mr-3 uppercase tracking-wide select-none">
                                Section
                            </div>
                            <input
                                className="w-full text-lg font-bold text-slate-900 outline-none placeholder:text-slate-300 bg-transparent"
                                placeholder="섹션 제목을 입력하세요"
                                value={block.content}
                                onChange={(e) => onChange(index, e.target.value)}
                                onPointerDown={(e) => e.stopPropagation()} // Allow text selection
                            />
                        </div>
                    )}

                    {/* Question Block (Horizontal Layout) */}
                    {block.type === 'question' && (
                        <div className="flex items-start gap-3 py-1">
                            <span className="text-indigo-600 font-bold text-base mt-2 whitespace-nowrap select-none">Q.</span>
                            <TextareaAutosize
                                cacheMeasurements
                                minRows={1}
                                className="w-full text-base font-medium text-slate-800 outline-none bg-transparent resize-none leading-relaxed placeholder:text-slate-300 py-1.5"
                                placeholder="질문을 입력하세요..."
                                value={block.content}
                                onChange={(e) => onChange(index, e.target.value)}
                                onPointerDown={(e) => e.stopPropagation()}
                            />
                        </div>
                    )}

                    {/* Script Block */}
                    {block.type === 'script' && (
                        <div className="my-3 p-4 bg-amber-50/50 rounded-lg border border-amber-200 flex gap-3 items-start shadow-sm">
                            <div className="bg-amber-200 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider select-none mt-1">
                                Script
                            </div>
                            <TextareaAutosize
                                cacheMeasurements
                                minRows={1}
                                className="w-full text-base text-slate-900 outline-none bg-transparent resize-none leading-relaxed placeholder:text-slate-500 font-medium"
                                placeholder="진행자 안내 멘트 또는 스크립트..."
                                value={block.content}
                                onChange={(e) => onChange(index, e.target.value)}
                                onPointerDown={(e) => e.stopPropagation()}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Inline Insert Trigger (Bottom) */}
            <div className={`relative transition-all duration-300 w-full mt-2 z-20 ${isAiMode ? 'h-auto py-2' : 'h-6 -mb-3 hover:h-12 group/insert'}`}>
                {!isAiMode && (
                    <>
                        {/* Hover Area / Visual Line */}
                        <div className="w-full h-px bg-brand-200 opacity-0 group-hover/insert:opacity-100 transition-opacity absolute top-1/2 left-0"></div>

                        {/* Add Button / Menu */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none group-hover/insert:pointer-events-auto">
                            <div className="relative flex flex-col items-center">
                                {/* Expanded Menu */}
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1 bg-white p-1 rounded-full shadow-lg border border-slate-200 opacity-0 scale-90 group-hover/insert:opacity-100 group-hover/insert:scale-100 transition-all duration-200 z-20">
                                    <button
                                        onClick={() => onAddAfter(index, 'section')}
                                        className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-white hover:bg-slate-800 rounded-full transition flex items-center gap-1 min-w-[80px] justify-center whitespace-nowrap"
                                    >
                                        + 섹션
                                    </button>
                                    <div className="w-px h-3 bg-slate-200 mx-1"></div>
                                    <button
                                        onClick={() => onAddAfter(index, 'question')}
                                        className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-white hover:bg-slate-800 rounded-full transition flex items-center gap-1 min-w-[80px] justify-center whitespace-nowrap"
                                    >
                                        + 질문
                                    </button>
                                    <div className="w-px h-3 bg-slate-200 mx-1"></div>
                                    <button
                                        onClick={() => setIsAiMode(true)}
                                        className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-white hover:bg-indigo-600 rounded-full transition flex items-center gap-1 min-w-[100px] justify-center bg-indigo-50 hover:shadow-indigo whitespace-nowrap"
                                    >
                                        ✨ AI 추천
                                    </button>
                                    <div className="w-px h-3 bg-slate-200 mx-1"></div>
                                    <button
                                        onClick={() => onAddAfter(index, 'script')}
                                        className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-white hover:bg-amber-500 rounded-full transition flex items-center gap-1 min-w-[100px] justify-center hover:shadow-brand whitespace-nowrap"
                                    >
                                        + 스크립트
                                    </button>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* AI Input Mode */}
                {isAiMode && (
                    <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-200 shadow-sm flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
                        <span className="text-lg">✨</span>
                        <div className="flex-1">
                            <input
                                autoFocus
                                className="w-full bg-transparent outline-none text-sm text-indigo-900 placeholder:text-indigo-400 font-medium"
                                placeholder="어떤 내용을 물어보고 싶으신가요? (예: 제품 사용 시 가장 불편했던 점)"
                                value={aiPrompt}
                                onChange={(e) => setAiPrompt(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleAiSubmit();
                                    if (e.key === 'Escape') setIsAiMode(false);
                                }}
                            />
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setIsAiMode(false)} className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-800">취소</button>
                            <button
                                onClick={handleAiSubmit}
                                disabled={isGenerating || !aiPrompt.trim()}
                                className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 transition-colors shadow-sm"
                            >
                                {isGenerating ? '생성 중...' : '추가하기'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function DiscussionGuideBuilder({ projectId, studyId, initialBlocks = [], researchQuestions, isFullPage = false, otherStudies }: Props) {
    // ... (existing code omitted for brevity in prompt, but kept in file) ...
    const router = useRouter();
    const [blocks, setBlocks] = useState<GuideBlock[]>(
        initialBlocks.length > 0
            ? initialBlocks
            : [
                { id: 'intro', type: 'section', content: '1. 도입 및 라포 형성' },
                { id: 'intro-script', type: 'script', content: '안녕하세요, 바쁘신 와중에 인터뷰에 응해주셔서 감사합니다. 오늘 인터뷰는 약 30분간 진행될 예정입니다.' },
                { id: 'q1', type: 'question', content: '' }
            ]
    );
    // Auto-Save State
    const [lastSavedBlocks, setLastSavedBlocks] = useState<string>(JSON.stringify(initialBlocks));
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');

    // Auto-Save Effect
    useEffect(() => {
        const currentBlocksStr = JSON.stringify(blocks);
        if (currentBlocksStr === lastSavedBlocks) {
            setSaveStatus('saved');
            return;
        }

        setSaveStatus('saving');
        const timer = setTimeout(async () => {
            await updateDiscussionGuideAction(projectId, studyId, blocks);
            setLastSavedBlocks(currentBlocksStr);
            setSaveStatus('saved');
        }, 1200); // 1.2s debounce

        return () => clearTimeout(timer);
    }, [blocks, projectId, studyId, lastSavedBlocks]);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setBlocks((items) => {
                const oldIndex = items.findIndex((i) => i.id === active.id);
                const newIndex = items.findIndex((i) => i.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const handleChange = (index: number, value: string) => {
        const newBlocks = [...blocks];
        newBlocks[index].content = value;
        setBlocks(newBlocks);
    };

    const handleRemove = (index: number) => {
        setBlocks(blocks.filter((_, i) => i !== index));
    };

    const handleAddAfter = (index: number, type: 'question' | 'script' | 'section', initialContent: string = '') => {
        const newBlock: GuideBlock = { id: Date.now().toString(), type, content: initialContent };
        const newBlocks = [...blocks];
        newBlocks.splice(index + 1, 0, newBlock);
        setBlocks(newBlocks);
    };

    const handleComplete = async () => {
        setSaveStatus('saving');
        await updateDiscussionGuideAction(projectId, studyId, blocks);
        setSaveStatus('saved');
        router.push(`/projects/${projectId}/studies/${studyId}`);
    };

    // Import State
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    const handleImport = (targetStudy: ResearchStudy) => {
        if (!targetStudy.discussionGuide || targetStudy.discussionGuide.length === 0) {
            alert('선택한 스터디에 인터뷰 가이드가 없습니다.');
            return;
        }

        if (confirm('현재 작성 중인 내용이 선택한 스터디의 가이드로 대체됩니다. 진행하시겠습니까?')) {
            // Assign new IDs to avoid conflicts
            const importedBlocks = targetStudy.discussionGuide.map(block => ({
                ...block,
                id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
            }));
            setBlocks(importedBlocks);
            setIsImportModalOpen(false);
        }
    };

    return (
        <div className={`flex flex-col bg-slate-50 rounded-xl border border-slate-200 ${isFullPage ? 'min-h-screen shadow-lg' : ''}`}>
            {/* Toolbar */}
            <div className="bg-white border-b border-slate-200 p-4 flex justify-between items-center sticky top-0 z-20 shadow-sm">
                <div>
                    {!isFullPage && (
                        <div className="flex items-center gap-3">
                            <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                <span className="text-xl">📝</span> 인터뷰 가이드
                                {saveStatus === 'saving' && <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full animate-pulse">저장 중...</span>}
                                {saveStatus === 'saved' && <span className="text-xs font-normal text-green-600 bg-green-50 px-2 py-0.5 rounded-full">저장됨</span>}
                            </h3>
                            {otherStudies && otherStudies.length > 0 && (
                                <button
                                    onClick={() => setIsImportModalOpen(true)}
                                    className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded hover:bg-slate-200 transition-colors flex items-center gap-1"
                                >
                                    📥 다른 스터디에서 가져오기
                                </button>
                            )}
                        </div>
                    )}
                    <p className="text-xs text-slate-500 mt-1">드래그하여 순서를 변경하고, 사이 공간을 클릭하여 내용을 추가하세요.</p>
                </div>
                <div className="flex gap-2">
                    {isFullPage && (
                        <div className="flex gap-2">
                            <span className="text-xs text-slate-400 my-auto mr-2">{saveStatus === 'saving' ? '저장 중...' : '자동 저장됨'}</span>
                            <button onClick={handleComplete} className="px-6 py-2 bg-brand-600 text-white text-sm font-bold rounded-lg hover:bg-brand-700 shadow-md">저장 및 완료 &rarr;</button>
                        </div>
                    )}
                </div>
            </div>

            {/* Document Editor Area - No Overflow hidden, full height */}
            <div className="flex-1 p-8 bg-slate-50 min-h-[500px]">
                <div className="max-w-3xl mx-auto pb-32">
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={blocks.map(b => b.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            <div className="space-y-4">
                                {blocks.map((block, i) => (
                                    <SortableBlockItem
                                        key={block.id}
                                        block={block}
                                        index={i}
                                        onChange={handleChange}
                                        onRemove={() => handleRemove(i)}
                                        onAddAfter={handleAddAfter}
                                        projectId={projectId}
                                        studyId={studyId}
                                    />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>

                    {/* Empty State / Initial Add */}
                    {blocks.length === 0 && (
                        <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-xl">
                            <p className="text-slate-400 mb-4">작성된 내용이 없습니다.</p>
                            <button onClick={() => handleAddAfter(-1, 'section')} className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold shadow-sm">첫 섹션 추가하기</button>
                        </div>
                    )}

                </div>
            </div>

            {/* Import Modal */}
            {isImportModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-slate-800">다른 스터디에서 가져오기</h3>
                            <button onClick={() => setIsImportModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                        </div>
                        <div className="p-4 max-h-[60vh] overflow-y-auto space-y-2">
                            {otherStudies?.map(study => (
                                <button
                                    key={study.id}
                                    onClick={() => handleImport(study)}
                                    className="w-full text-left p-3 rounded-lg border border-slate-200 hover:border-brand-300 hover:bg-brand-50 transition-all group"
                                >
                                    <div className="font-bold text-slate-800 text-sm mb-1 group-hover:text-brand-700">{study.title}</div>
                                    <div className="text-xs text-slate-500">{new Date(study.createdAt).toLocaleDateString()} • {study.discussionGuide?.length || 0}개 항목</div>
                                </button>
                            ))}
                            {(!otherStudies || otherStudies.length === 0) && (
                                <p className="text-center text-slate-400 py-8 text-sm">가져올 수 있는 다른 스터디가 없습니다.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

