import { NextResponse } from 'next/server';
import { getProject } from '@/lib/store/projects';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: "Missing ID" }, { status: 400 });
    }

    try {
        const project = await getProject(id);
        if (project) {
            return NextResponse.json({ success: true, project: project.project.id });
        } else {
            return NextResponse.json({ success: false, error: "getProject returned null. Check stdout." });
        }
    } catch (e: any) {
        return NextResponse.json({ success: false, exception: e.message, stack: e.stack });
    }
}
