import { getTranscriptFiles } from '@/lib/transcript';
import Link from 'next/link';

export default async function ArchivePage() {
    const files = await getTranscriptFiles();

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-6xl mx-auto">
                <Link href="/" className="text-slate-500 hover:text-slate-800 text-sm mb-8 inline-block">
                    &larr; Back to Dashboard
                </Link>

                <h1 className="text-3xl font-bold text-slate-900 mb-8">Data Archive: Transcripts</h1>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {files.map((file) => (
                        <div key={file} className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition border border-slate-100">
                            <h3 className="text-lg font-medium text-slate-800 mb-4 line-clamp-1">{file.replace('.txt', '')}</h3>
                            <Link
                                href={`/transcript/${encodeURIComponent(file)}`}
                                className="text-sm text-brand-600 font-medium hover:underline"
                            >
                                View Transcript
                            </Link>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
