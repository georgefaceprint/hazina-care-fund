import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../services/firebase';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, BookOpen, Skull, AlertCircle, Upload, FileCheck, X, Camera } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import CameraCapture from '../components/CameraCapture';


const CrisisClaim = () => {
    const { profile, isDemoMode } = useAuth();
    const { t } = useLanguage();
    const navigate = useNavigate();
    const [claimType, setClaimType] = useState('medical');
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('idle');
    const [isCameraOpen, setIsCameraOpen] = useState(false);


    // Maturation Check
    const now = new Date();
    const graceExpiry = profile?.grace_period_expiry?.toDate() || new Date();
    const isMatured = profile?.isDemoMode || graceExpiry <= now;
    const daysRemaining = Math.ceil((graceExpiry - now) / (1000 * 60 * 60 * 24));

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Prevent submission if not matured
        if (!isMatured) {
            setStatus('error');
            return;
        }

        setLoading(true);
        setStatus('pending');

        try {
            if (isDemoMode) {
                setTimeout(() => {
                    setStatus('success');
                    setLoading(false);
                    setTimeout(() => navigate('/dashboard'), 3000);
                }, 1000);
                return;
            }

            if (!db) { throw new Error("Database not initialized"); }

            let proofUrl = null;
            if (file) {
                const storageRef = ref(storage, `claims/${profile.id}/${Date.now()}_${file.name || 'camera_capture.jpg'}`);

                let uploadResult;
                if (typeof file === 'string' && file.startsWith('data:')) {
                    // Handle data URL from camera
                    const response = await fetch(file);
                    const blob = await response.blob();
                    uploadResult = await uploadBytes(storageRef, blob);
                } else {
                    uploadResult = await uploadBytes(storageRef, file);
                }

                proofUrl = await getDownloadURL(uploadResult.ref);
            }


            await addDoc(collection(db, 'claims'), {
                guardian_id: profile.id,
                type: claimType,
                amount: Number(amount),
                description,
                proof_url: proofUrl,
                status: 'pending_review',
                tier_at_claim: profile.active_tier,
                createdAt: serverTimestamp()
            });

            setStatus('success');
            // Navigate back after delay
            setTimeout(() => navigate('/dashboard'), 3000);
        } catch (error) {
            console.error("Error submitting claim: ", error);
            setStatus('error');
        } finally {
            if (!isDemoMode) setLoading(false);
        }
    };

    if (!profile) return null;

    return (
        <div className="min-h-screen bg-slate-50 pt-8 px-6 pb-32">
            <div className="flex items-center gap-4 mb-8">
                <button
                    onClick={() => navigate('/dashboard')}
                    className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100 hover:bg-slate-50"
                >
                    <ArrowLeft className="w-6 h-6 text-slate-700" />
                </button>
                <h1 className="text-2xl font-bold font-heading text-slate-900">{t('crisis_claim')}</h1>
            </div>

            {!isMatured ? (
                <div className="card bg-red-50 border-red-100 flex flex-col items-center text-center p-8">
                    <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                        <AlertCircle className="w-8 h-8" />
                    </div>
                    <h3 className="font-bold text-lg text-red-900 mb-2">{t('shield_not_matured')}</h3>
                    <p className="text-red-700 text-sm leading-relaxed mb-6">
                        {t('cannot_file_claim')}<br />
                        {t('shield_matures_on_date')} <strong className="whitespace-nowrap">{profile.grace_period_expiry?.toDate().toLocaleDateString()}</strong>.
                        <br />
                        <span className="inline-block mt-4 px-4 py-2 bg-red-100 rounded-full font-black text-xl animate-pulse">
                            {daysRemaining} {t('days_left') || "DAYS LEFT"}
                        </span>
                    </p>
                    <button onClick={() => navigate('/dashboard')} className="btn-primary w-full bg-red-600 hover:bg-red-700">
                        {t('return_to_dashboard')}
                    </button>
                </div>
            ) : status === 'success' ? (
                <div className="card bg-emerald-50 border-emerald-100 flex flex-col items-center text-center p-8">
                    <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4 border-4 border-emerald-50">
                        <Heart className="w-8 h-8" />
                    </div>
                    <h3 className="font-bold text-lg text-emerald-900 mb-2">{t('claim_submitted')}</h3>
                    <p className="text-emerald-700 text-sm leading-relaxed mb-6">
                        {t('claim_received_desc')}
                    </p>
                </div>
            ) : (
                <div className="card border-none shadow-md">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-3">{t('type_of_crisis')}</label>
                            <div className="grid grid-cols-1 gap-3">
                                <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${claimType === 'medical' ? 'border-brand-primary bg-brand-primary/5' : 'border-slate-100 hover:border-slate-200'}`}>
                                    <input type="radio" value="medical" checked={claimType === 'medical'} onChange={(e) => setClaimType(e.target.value)} className="hidden" />
                                    <div className={`p-2 rounded-lg ${claimType === 'medical' ? 'bg-brand-primary text-white' : 'bg-slate-100 text-slate-500'}`}>
                                        <Heart className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-900">{t('medical_emergency')}</p>
                                        <p className="text-xs text-slate-500">{t('medical_desc')}</p>
                                    </div>
                                </label>
                                <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${claimType === 'bereavement' ? 'border-brand-primary bg-brand-primary/5' : 'border-slate-100 hover:border-slate-200'}`}>
                                    <input type="radio" value="bereavement" checked={claimType === 'bereavement'} onChange={(e) => setClaimType(e.target.value)} className="hidden" />
                                    <div className={`p-2 rounded-lg ${claimType === 'bereavement' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                        <Skull className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-900">{t('bereavement')}</p>
                                        <p className="text-xs text-slate-500">{t('bereavement_desc')}</p>
                                    </div>
                                </label>
                                <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${claimType === 'school_fees' ? 'border-brand-primary bg-brand-primary/5' : 'border-slate-100 hover:border-slate-200'}`}>
                                    <input type="radio" value="school_fees" checked={claimType === 'school_fees'} onChange={(e) => setClaimType(e.target.value)} className="hidden" />
                                    <div className={`p-2 rounded-lg ${claimType === 'school_fees' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                        <BookOpen className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-900">{t('school_fees')}</p>
                                        <p className="text-xs text-slate-500">{t('school_fees_desc')}</p>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">{t('requested_amount')}</label>
                            <input
                                type="number"
                                required
                                min="1000"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-lg font-bold focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none transition-all"
                                placeholder="e.g. 15000"
                            />
                            <p className="text-[10px] text-slate-400 mt-2 uppercase tracking-tight font-bold">{t('max_allowed')}</p>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">{t('brief_description')}</label>
                            <textarea
                                required
                                value={description}
                                onChange={(e) => setDescription(e.target.value.toUpperCase())}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none transition-all resize-none h-32 uppercase"
                                placeholder={t('brief_description_placeholder')}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">{t('proof_of_crisis') || "Proof of Crisis (Optional)"}</label>
                            <div className="relative">
                                {!file ? (
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setIsCameraOpen(true)}
                                            className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-xl hover:bg-slate-50 hover:border-brand-primary transition-all group"
                                        >
                                            <Camera className="w-8 h-8 text-slate-400 mb-2 group-hover:text-brand-primary transition-colors" />
                                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{t('take_photo') || "Take Photo"}</p>
                                        </button>
                                        <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 hover:border-brand-primary transition-all group">
                                            <Upload className="w-8 h-8 text-slate-400 mb-2 group-hover:text-brand-primary transition-colors" />
                                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{t('upload_gallery') || "Gallery"}</p>
                                            <input
                                                type="file"
                                                className="hidden"
                                                accept="image/*"
                                                onChange={(e) => setFile(e.target.files[0])}
                                            />
                                        </label>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                                                <FileCheck className="w-5 h-5" />
                                            </div>
                                            <div className="overflow-hidden">
                                                <p className="text-sm font-bold text-emerald-900 truncate max-w-[150px]">
                                                    {typeof file === 'string' ? "Camera Capture" : file.name}
                                                </p>
                                                <p className="text-[10px] text-emerald-600 uppercase font-black">
                                                    {typeof file === 'string' ? "JPEG" : `${(file.size / 1024 / 1024).toFixed(2)} MB`}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setFile(null)}
                                            className="p-2 hover:bg-emerald-100 rounded-full text-emerald-600 transition-colors"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                )}
                            </div>
                            <p className="text-[10px] text-slate-400 mt-2 uppercase tracking-tight font-bold">{t('proof_desc') || "PDF, JPG OR PNG (MAX 5MB)"}</p>
                        </div>


                        <button
                            type="submit"
                            disabled={loading || !amount || !description}
                            className="btn-primary w-full py-4 text-lg"
                        >
                            {loading ? t('submitting') : t('submit_claim')}
                        </button>
                    </form>
                </div>
            )}

            {isCameraOpen && (
                <CameraCapture
                    onCapture={(img) => setFile(img)}
                    onClose={() => setIsCameraOpen(false)}
                />
            )}
        </div>

    );
};

export default CrisisClaim;
