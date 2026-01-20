import { parseTranscript } from '@/lib/transcript';
import { notFound } from 'next/navigation';
import Link from 'next/link';

interface Props {
    params: Promise<{
        filename: string;
    }>
}

export default async function TranscriptPage({ params }: Props) {
    const { filename } = await params;
    const decodedFilename = decodeURIComponent(filename);
    const transcript = await parseTranscript(decodedFilename);

    if (!transcript) {
        notFound();
    }

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-4xl mx-auto">
                <Link href="/" className="text-slate-500 hover:text-slate-800 text-sm mb-6 inline-block">
                    &larr; Back to Dashboard
                </Link>

                <header className="bg-white p-8 rounded-xl shadow-sm border border-slate-100 mb-8">
                    <h1 className="text-3xl font-bold text-slate-900">{transcript.title}</h1>
                    <div className="flex gap-4 mt-4 text-sm text-slate-500">
                        <span>{transcript.segments.length} segments</span>
                        <span>{(transcript.rawContent.length / 1024).toFixed(1)} KB</span>
                    </div>
                </header>

                <div className="space-y-6">
                    {transcript.segments.map((segment, index) => (
                        <div key={index} className="flex gap-4">
                            <div className="w-32 flex-shrink-0 text-slate-400 text-xs text-right pt-1">
                                {segment.timestamp}
                            </div>
                            <div className="flex-1">
                                <div className="text-xs font-bold text-slate-700 mb-1">{segment.speaker}</div>
                                <div className="text-slate-600 leading-relaxed whitespace-pre-wrap">{segment.text}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
