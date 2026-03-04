import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, RefreshCw, Check, CameraOff } from 'lucide-react';

const CameraCapture = ({ onCapture, onClose }) => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [stream, setStream] = useState(null);
    const [capturedImage, setCapturedImage] = useState(null);
    const [isCameraReady, setIsCameraReady] = useState(false);
    const [error, setError] = useState(null);
    const [facingMode, setFacingMode] = useState('environment'); // 'user' or 'environment'

    useEffect(() => {
        startCamera();
        return () => {
            stopCamera();
        };
    }, [facingMode]);

    const startCamera = async () => {
        setError(null);
        setIsCameraReady(false);
        try {
            if (stream) {
                stopCamera();
            }
            const newStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: facingMode },
                audio: false
            });
            setStream(newStream);
            if (videoRef.current) {
                videoRef.current.srcObject = newStream;
                setIsCameraReady(true);
            }
        } catch (err) {
            console.error("Error accessing camera:", err);
            setError("Could not access camera. Please ensure you have granted permission.");
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
    };

    const capturePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');

            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0, canvas.width, canvas.height);

            const imageData = canvas.toDataURL('image/jpeg');
            setCapturedImage(imageData);
            stopCamera();
        }
    };

    const retakePhoto = () => {
        setCapturedImage(null);
        startCamera();
    };

    const handleConfirm = () => {
        onCapture(capturedImage);
        onClose();
    };

    const toggleCamera = () => {
        setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-4">
            <button
                onClick={onClose}
                className="absolute top-6 right-6 p-3 bg-white/10 backdrop-blur-md rounded-2xl text-white hover:bg-white/20 transition-all z-10"
            >
                <X className="w-6 h-6" />
            </button>

            <div className="w-full max-w-md aspect-[3/4] rounded-3xl overflow-hidden relative bg-slate-900 shadow-2xl border border-white/10">
                {!capturedImage ? (
                    <>
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            className="w-full h-full object-cover"
                        />
                        {!isCameraReady && !error && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-4">
                                <div className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
                                <p className="text-sm font-bold animate-pulse">Initializing Camera...</p>
                            </div>
                        )}
                        {error && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-8 text-center gap-4">
                                <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center">
                                    <CameraOff className="w-8 h-8" />
                                </div>
                                <h3 className="font-bold text-lg">Camera Error</h3>
                                <p className="text-sm text-slate-400">{error}</p>
                                <button
                                    onClick={startCamera}
                                    className="px-6 py-2 bg-brand-primary text-white rounded-xl font-bold text-sm"
                                >
                                    Retry
                                </button>
                            </div>
                        )}

                        {/* Camera UI Overlay */}
                        {isCameraReady && (
                            <div className="absolute inset-0 border-2 border-white/20 pointer-events-none m-8 rounded-2xl">
                                <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-brand-primary -mt-px -ml-px"></div>
                                <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-brand-primary -mt-px -mr-px"></div>
                                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-brand-primary -mb-px -ml-px"></div>
                                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-brand-primary -mb-px -mr-px"></div>
                            </div>
                        )}
                    </>
                ) : (
                    <img
                        src={capturedImage}
                        alt="Captured"
                        className="w-full h-full object-cover"
                    />
                )}
            </div>

            <div className="mt-8 flex items-center gap-8">
                {!capturedImage ? (
                    <>
                        <button
                            onClick={toggleCamera}
                            className="p-4 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-all"
                        >
                            <RefreshCw className="w-6 h-6" />
                        </button>
                        <button
                            onClick={capturePhoto}
                            disabled={!isCameraReady}
                            className={`w-20 h-20 rounded-full border-4 flex items-center justify-center transition-all ${isCameraReady ? 'border-white bg-brand-primary scale-110 active:scale-95' : 'border-white/20 bg-white/10 cursor-not-allowed'}`}
                        >
                            <Camera className={`w-8 h-8 ${isCameraReady ? 'text-white' : 'text-white/20'}`} />
                        </button>
                        <div className="w-14"></div> {/* Spacer for symmetry */}
                    </>
                ) : (
                    <>
                        <button
                            onClick={retakePhoto}
                            className="flex flex-col items-center gap-2 text-white group"
                        >
                            <div className="p-4 bg-white/10 backdrop-blur-md rounded-full group-hover:bg-white/20 transition-all">
                                <RefreshCw className="w-6 h-6" />
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Retake</span>
                        </button>
                        <button
                            onClick={handleConfirm}
                            className="flex flex-col items-center gap-2 text-white group"
                        >
                            <div className="p-6 bg-brand-primary rounded-full shadow-lg shadow-brand-primary/20 group-hover:scale-110 transition-all active:scale-95">
                                <Check className="w-8 h-8" />
                            </div>
                            <span className="text-xs font-black uppercase tracking-widest text-brand-primary">Use Photo</span>
                        </button>
                    </>
                )}
            </div>

            <canvas ref={canvasRef} className="hidden" />
        </div>
    );
};

export default CameraCapture;
