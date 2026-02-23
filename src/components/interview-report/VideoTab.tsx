import { useRef, useState } from 'react';

interface VideoTabProps {
    videoUrl: string | undefined;
    handleSaveVideoUrl: (url: string) => void;
    handleUploadVideo: (e: React.ChangeEvent<HTMLInputElement>) => void;
    isUploading: boolean;
    uploadProgress: number | null;
    videoRef: React.RefObject<HTMLVideoElement | null>;
}

// Helper for Embed URLs
const getEmbedUrl = (url: string) => {
    if (!url) return null;
    let embedUrl = url;

    // YouTube
    if (url.includes('youtube.com/watch?v=')) {
        embedUrl = url.replace('watch?v=', 'embed/');
    } else if (url.includes('youtu.be/')) {
        embedUrl = url.replace('youtu.be/', 'youtube.com/embed/');
    }

    // Loom
    else if (url.includes('loom.com/share/')) {
        embedUrl = url.replace('/share/', '/embed/');
    }

    return embedUrl;
};

export function VideoTab({
    videoUrl,
    handleSaveVideoUrl,
    handleUploadVideo,
    isUploading,
    uploadProgress,
    videoRef
}: VideoTabProps) {
    const [videoTabMode, setVideoTabMode] = useState<'upload' | 'embed'>('upload');
    const [embedInput, setEmbedInput] = useState('');

    const activeEmbedUrl = videoUrl ? getEmbedUrl(videoUrl) : null;
    const isLocalVideo = videoUrl && (
        videoUrl.startsWith('/uploads') ||
        videoUrl.includes('supabase.co/storage') ||
        videoUrl.match(/\.(mp4|webm|mov|ogg)$/i) !== null
    );

    return (
        <div className="flex-1 bg-slate-50 relative flex flex-col">
            {videoUrl ? (
                <div className="flex-1 relative flex items-center justify-center">
                    {isLocalVideo ? (
                        <video
                            ref={videoRef}
                            src={videoUrl}
                            controls
                            className="max-h-full max-w-full"
                        />
                    ) : (
                        <iframe
                            src={activeEmbedUrl || videoUrl}
                            className="w-full h-full"
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                        ></iframe>
                    )}
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-4 p-8">
                    <div className="text-4xl mb-2">🎥</div>
                    <p>등록된 비디오가 없습니다.</p>

                    <div className="bg-slate-200/50 p-1 rounded-lg flex gap-1 mb-4">
                        <button
                            onClick={() => setVideoTabMode('upload')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${videoTabMode === 'upload' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            파일 업로드
                        </button>
                        <button
                            onClick={() => setVideoTabMode('embed')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${videoTabMode === 'embed' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            외부 링크 (YouTube/Loom)
                        </button>
                    </div>

                    {videoTabMode === 'upload' ? (
                        <label className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold cursor-pointer transition flex items-center gap-2 relative overflow-hidden min-w-[180px] justify-center">
                            {uploadProgress !== null && (
                                <div
                                    className="absolute top-0 left-0 h-full bg-indigo-500/50 transition-all duration-300"
                                    style={{ width: `${uploadProgress}%` }}
                                />
                            )}
                            <span className="relative z-10">
                                {isUploading ? (uploadProgress !== null ? `업로드 중... ${uploadProgress}%` : '업로드 중...') : '비디오 파일 업로드'}
                            </span>
                            <input
                                type="file"
                                accept="video/*"
                                className="hidden"
                                disabled={isUploading}
                                onChange={handleUploadVideo}
                            />
                        </label>
                    ) : (
                        <div className="flex gap-2 w-full max-w-md">
                            <input
                                type="text"
                                placeholder="https://youtube.com/..."
                                value={embedInput}
                                onChange={(e) => setEmbedInput(e.target.value)}
                                className="flex-1 bg-white border border-slate-200 text-slate-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500 shadow-sm"
                            />
                            <button
                                onClick={() => handleSaveVideoUrl(embedInput)}
                                disabled={!embedInput || isUploading}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-50"
                            >
                                저장
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
