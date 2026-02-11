'use client';

import { useEffect, useRef } from 'react';

interface Props {
    status: 'idle' | 'recording' | 'paused' | 'stopped';
    elapsedTime: number; // Controlled by parent for sync
    togglePause: () => void;
    // Visualizer Data
    audioStream: MediaStream | null;
}

export function LiveAudioRecorder({ status, elapsedTime, togglePause, audioStream }: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number>(undefined);
    const analyserRef = useRef<AnalyserNode | null>(null);

    // Visualizer Logic
    useEffect(() => {
        if (!canvasRef.current || !audioStream || status !== 'recording') {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
            return;
        }

        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(audioStream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 64; // Small size for simple bars
        source.connect(analyser);
        analyserRef.current = analyser;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const draw = () => {
            animationRef.current = requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Draw bars
            const barWidth = (canvas.width / bufferLength) * 2.5;
            let barHeight;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                barHeight = dataArray[i] / 2;

                // Color based on activity
                if (barHeight > 10) {
                    ctx.fillStyle = `rgb(${barHeight + 100}, 50, 50)`; // Red-ish
                } else {
                    ctx.fillStyle = 'rgb(200, 200, 200)'; // Gray
                }

                ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
                x += barWidth + 1;
            }
        };

        draw();

        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
            audioContext.close();
        };
    }, [audioStream, status]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex items-center gap-6 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-xl border border-slate-700 relative overflow-hidden">

            {/* Visualizer Background Overlay */}
            <canvas
                ref={canvasRef}
                className="absolute bottom-0 left-0 w-full h-full opacity-30 pointer-events-none"
                width={200}
                height={50}
            />

            {/* Status Indicator & Timer */}
            <div className="flex items-center gap-3 w-32 relative z-10">
                <div className={`w-3 h-3 rounded-full ${status === 'recording' ? 'bg-red-500 animate-pulse' :
                    status === 'paused' ? 'bg-amber-400' : 'bg-slate-500'
                    }`}></div>
                <span className="font-mono text-xl font-bold tracking-wider">
                    {formatTime(elapsedTime)}
                </span>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2 relative z-10">
                {status !== 'idle' && status !== 'stopped' && (
                    <button
                        onClick={togglePause}
                        className={`w-10 h-10 flex items-center justify-center rounded-full transition-all hover:scale-105 ${status === 'paused' ? 'bg-white text-slate-900 hover:bg-slate-200' : 'bg-slate-700 hover:bg-slate-600'}`}
                        title={status === 'paused' ? "Resume" : "Pause"}
                    >
                        {status === 'paused' ? (
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg> // Play icon
                        ) : (
                            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" /></svg> // Pause icon
                        )}
                    </button>
                )}
            </div>
        </div>
    );
}
