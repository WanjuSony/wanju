'use server';

import { analyzeTranscript, analyzeVideo, generateSummary, generateInterviewerFeedback, analyzeSimulation } from '@/lib/analysis-service';
import { generateWeeklyReport, generateSimulationAnalysis } from '@/lib/llm-service';
import { getProject, saveProjectData } from '@/lib/store/projects';
import { revalidatePath } from 'next/cache';
import { RealInterview, WeeklyReport } from '@/lib/types';

import { supabase } from '@/lib/supabase';

export async function reanalyzeInterviewAction(projectId: string, studyId: string, interviewId: string) {
    console.log(`[Reanalyze] Starting for Project: ${projectId}, Study: ${studyId}, Interview: ${interviewId}`);
    const data = await getProject(projectId);
    if (!data) {
        console.error("[Reanalyze] Project not found");
        return;
    }

    const studyIndex = data.studies.findIndex(s => s.id === studyId);
    if (studyIndex === -1) return;

    /* REORDERED: Deletion happens AFTER analysis */

    const interviewIndex = data.studies[studyIndex].sessions.findIndex(s => s.id === interviewId);
    if (interviewIndex === -1) return;

    const interview = data.studies[studyIndex].sessions[interviewIndex];

    const transcriptObj = {
        id: interview.id,
        title: interview.title,
        headers: [],
        segments: [],
        rawContent: interview.content || ''
    };

    const contextObj = {
        projectTitle: data.project.title,
        projectDescription: data.project.description || '',
        methodologies: [data.studies[studyIndex].plan.methodology.type],
        researchQuestions: data.studies[studyIndex].plan.researchQuestions
    };

    if (!transcriptObj.rawContent || transcriptObj.rawContent.trim().length === 0) {
        console.error("[Reanalyze] Transcript is empty");
        throw new Error("Transcript is empty. Please upload a transcript or audio file first.");
    }

    console.log(`[Reanalyze] Transcript found. Length: ${transcriptObj.rawContent.length}. Calling analyzeTranscript...`);
    const result = await analyzeTranscript(transcriptObj, contextObj);
    console.log(`[Reanalyze] Analysis complete. Result: ${result ? 'Success' : 'Failure'}`);

    if (result) {
        // CLEAR EXISTING INSIGHTS: Fix for persistence issue (MOVED HERE: Only clear if analysis succeeded)
        const { error: deleteError } = await supabase.from('insights').delete().eq('interview_id', interviewId);
        if (deleteError) {
            console.error("Failed to clear old insights:", deleteError);
        } else {
            console.log(`[Reanalyze] Cleared old insights for interview ${interviewId}`);
        }

        data.studies[studyIndex].sessions[interviewIndex].structuredData = result.insights;

        const currentSummary = data.studies[studyIndex].sessions[interviewIndex].summary;
        const isPlaceholder = !currentSummary ||
            currentSummary.trim() === '' ||
            currentSummary.includes('recording') ||
            currentSummary.includes('details...');

        if (isPlaceholder) {
            data.studies[studyIndex].sessions[interviewIndex].summary = result.summary;
            console.log("[Reanalyze] Updated summary.");
        }

        await saveProjectData(data);
        console.log("[Reanalyze] Project data saved successfully.");
        revalidatePath(`/projects/${projectId}/studies/${studyId}/interviews/${interviewId}`);
        console.log("[Reanalyze] Path revalidated.");
    } else {
        console.error(`[Reanalyze] Analysis failed for interview ${interviewId}. Old data preserved.`);
        // Ideally we should throw error to let UI know
        throw new Error("Analysis failed to return results");
    }
}

export async function analyzeSimulationAction(projectId: string, studyId: string, sessionId: string) {
    const data = await getProject(projectId);
    if (!data) return;

    const study = data.studies.find(s => s.id === studyId);
    if (!study || !study.simulationSessions) return;

    const session = study.simulationSessions.find(s => s.id === sessionId);
    if (!session) return;

    const contextObj = {
        projectTitle: data.project.title,
        projectDescription: data.project.description || '',
        methodologies: ['simulation']
    };

    const analysis = await analyzeSimulation(session.messages, contextObj);
    session.structuredData = analysis.insights;
    session.summary = analysis.summary;

    await saveProjectData(data);
    revalidatePath(`/projects/${projectId}/studies/${studyId}`);
}

export async function analyzeMessagesAction(projectId: string, studyId: string, messages: { role: string, text: string }[]) {
    const data = await getProject(projectId);
    if (!data) return null;

    const study = data.studies.find(s => s.id === studyId);
    if (!study) return null;

    const contextObj = {
        projectTitle: data.project.title,
        projectDescription: data.project.description || '',
        methodologies: ['simulation']
    };

    const analysis = await analyzeSimulation(messages, contextObj);
    return analysis;
}

export async function addManualInsightAction(projectId: string, studyId: string, interviewId: string, insight: any) {
    const data = await getProject(projectId);
    if (!data) return;

    const study = data.studies.find(s => s.id === studyId);
    const session = study?.sessions.find(s => s.id === interviewId) || study?.simulationSessions?.find(s => s.id === interviewId);

    if (!session) return;

    if (!session.structuredData) session.structuredData = [];
    session.structuredData.push({
        ...insight,
        id: Date.now().toString()
    });

    await saveProjectData(data);
    revalidatePath(`/projects/${projectId}/studies/${studyId}`);
}

export async function generateSummaryAction(projectId: string, studyId: string, interviewId: string) {
    const data = await getProject(projectId);
    if (!data) return;

    const study = data.studies.find(s => s.id === studyId);
    const interview = study?.sessions.find(i => i.id === interviewId);

    if (!interview || !interview.content) return;

    const transcriptObj = {
        id: interview.id,
        title: interview.title,
        headers: [],
        segments: [],
        rawContent: interview.content
    };

    const summary = await generateSummary(transcriptObj);
    interview.summary = summary;

    await saveProjectData(data);
    revalidatePath(`/projects/${projectId}/studies/${studyId}/interviews/${interviewId}`);
}

export async function generateFeedbackAction(projectId: string, studyId: string, interviewId: string) {
    const data = await getProject(projectId);
    if (!data) throw new Error("Project not found");

    const study = data.studies.find(s => s.id === studyId);
    if (!study) throw new Error("Study not found");

    const interview = study.sessions.find(i => i.id === interviewId);
    if (!interview || !interview.content) throw new Error("Interview content not found");

    const discussionGuideList = study?.discussionGuide
        ? study.discussionGuide.filter(b => b.type === 'question').map(b => b.content)
        : [];

    // Use existing segments if available, otherwise parse
    let segments = interview.segments || [];
    console.log(`[FeedbackAction] Interview ID: ${interviewId}, Content Length: ${interview.content?.length || 0}, Segments Count: ${segments.length}`);

    if (!segments || segments.length === 0) {
        console.log("[FeedbackAction] Segments missing, parsing content...");
        const { parseTranscriptContent } = await import('@/lib/transcript-parser');
        const parsed = parseTranscriptContent(interview.content, interview.title);
        segments = parsed.segments;
        console.log(`[FeedbackAction] Parsed ${segments.length} segments.`);
    }

    const transcriptObj = {
        id: interview.id,
        title: interview.title,
        headers: [],
        segments: segments, // Ensure segments are populated
        rawContent: interview.content
    };

    try {
        if (!transcriptObj.rawContent || transcriptObj.rawContent.trim().length === 0) {
            throw new Error("Transcript is empty. Please upload a transcript or audio file first.");
        }

        console.log("[FeedbackAction] Calling generateInterviewerFeedback...");
        const feedback = await generateInterviewerFeedback(transcriptObj, discussionGuideList, {
            projectTitle: data.project.title,
            projectDescription: data.project.description,
            methodologies: [study.plan.methodology.type]
        });
        console.log("[FeedbackAction] Feedback generated successfully. Length:", feedback.length);

        console.log("[FeedbackAction] Feedback generated successfully. Length:", feedback.length);

        // DIRECT DB UPDATE: Safer than saveProjectData
        const { updateInterviewFeedback } = await import('@/lib/store/projects');
        await updateInterviewFeedback(interview.id, feedback);

        console.log("[FeedbackAction] Feedback saved to DB directly.");

        revalidatePath(`/projects/${projectId}/studies/${studyId}/interviews/${interviewId}`);
    } catch (e: any) {
        console.error("Feedback generation failed:", e);
        throw new Error(`Feedback generation failed: ${e.message}`);
    }
}

export async function createWeeklyReportAction(projectId: string, studyId: string, interviewIds: string[], reportTitle: string, userComments: string) {
    const data = await getProject(projectId);
    if (!data) return;

    const study = data.studies.find(s => s.id === studyId);
    if (!study) return;

    const selectedInterviews = study.sessions.filter(s => interviewIds.includes(s.id));

    // Auto-generate title if missing
    let finalReportTitle = reportTitle;
    if (!finalReportTitle && selectedInterviews.length > 0) {
        // Find latest date
        const dates = selectedInterviews.map(s => new Date(s.date).getTime());
        const latestDate = new Date(Math.max(...dates));

        const year = latestDate.getFullYear().toString().slice(2);
        const month = (latestDate.getMonth() + 1).toString().padStart(2, '0');

        // Calculate Week of Month
        const date = latestDate.getDate();
        const firstDayOfMonth = new Date(latestDate.getFullYear(), latestDate.getMonth(), 1).getDay();
        const week = Math.ceil((date + firstDayOfMonth) / 7);

        finalReportTitle = `${year}.${month}.${week}주차 리포트`;
    }

    const studyContext = {
        projectTitle: data.project.title,
        projectDescription: data.project.description || '',
        purpose: study.plan.purpose,
        researchQuestions: study.plan.researchQuestions || []
    };

    const transcriptData = selectedInterviews.map(i => ({
        title: i.title,
        date: i.date,
        content: i.content || '',
        summary: i.summary,
        insights: i.structuredData
    }));

    const reportContentString = await generateWeeklyReport(transcriptData, studyContext, `${userComments}\n(System Note: Use title "${finalReportTitle}")`);

    const newReport: WeeklyReport = {
        id: Date.now().toString(),
        title: finalReportTitle || `Weekly Report - ${new Date().toLocaleDateString()}`,
        createdAt: new Date().toISOString(),
        content: reportContentString,
        interviewIds
    };

    if (!study.reports) study.reports = [];
    study.reports.push(newReport);

    await saveProjectData(data);
    revalidatePath(`/projects/${projectId}/studies/${studyId}`);
    return newReport;
}

export async function deleteWeeklyReportAction(projectId: string, studyId: string, reportId: string) {
    const data = await getProject(projectId);
    if (!data) return;

    const study = data.studies.find(s => s.id === studyId);
    if (!study || !study.reports) return;

    study.reports = study.reports.filter(r => r.id !== reportId);
    await saveProjectData(data);
    revalidatePath(`/projects/${projectId}/studies/${studyId}`);
}

export async function updateWeeklyReportTitleAction(projectId: string, studyId: string, reportId: string, newTitle: string) {
    const data = await getProject(projectId);
    if (!data) return;

    const study = data.studies.find(s => s.id === studyId);
    if (!study || !study.reports) return;

    const report = study.reports.find(r => r.id === reportId);
    if (!report) return;

    report.title = newTitle;
    await saveProjectData(data);
    revalidatePath(`/projects/${projectId}/studies/${studyId}`);
}
