'use client';

import { useTransition } from 'react';
import { deleteStudyAction } from '@/app/actions';

export default function DeleteStudyButton({ projectId, studyId }: { projectId: string, studyId: string }) {
    const [isPending, startTransition] = useTransition();

    const handleDelete = (e: React.MouseEvent) => {
        e.preventDefault(); // Prevent link navigation
        if (confirm('정말로 이 인터뷰 기획을 삭제하시겠습니까? 복구할 수 없습니다.')) {
            startTransition(async () => {
                await deleteStudyAction(projectId, studyId);
            });
        }
    };

    return (
        <button
            onClick={handleDelete}
            disabled={isPending}
            className="text-slate-400 hover:text-red-500 text-xs font-bold px-3 py-1 bg-white border border-slate-200 rounded-lg hover:border-red-200 hover:bg-red-50 transition shadow-sm z-10 relative"
            title="삭제하기"
        >
            {isPending ? '...' : '🗑️'}
        </button>
    );
}
