import { NextResponse } from 'next/server';
import { createStudyAction } from '@/app/actions';

export async function GET(request: Request) {
    try {
        const projectId = '-8179';
        const plan: any = {
            background: 'Test background',
            purpose: 'Test purpose',
            target: 'Test target',
            utilization: 'Test utilization',
            researchQuestions: ['Test Q1'],
            methodology: { type: 'survey', reason: 'Test reason' }
        };
        const id = await createStudyAction(projectId, 'Test Study ' + Date.now(), plan, []);
        return NextResponse.json({ success: true, id });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message, stack: error.stack }, { status: 500 });
    }
}
