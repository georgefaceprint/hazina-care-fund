import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Shield, User, ArrowRight, Upload, Image as ImageIcon, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '../context/LanguageContext';
import { uploadProfilePhoto } from '../services/storage';
import { KENYA_COUNTIES, COUNTY_TOWNS } from '../data/kenyaData';
import { ChevronDown, MapPin } from 'lucide-react';

const CompleteProfile = () => {
    const { user, profile } = useAuth();
    const { t } = useLanguage();
    const navigate = useNavigate();
    const toast = useToast();
    const [fullName, setFullName] = useState('');
    const [nationalId, setNationalId] = useState('');
    const [idPhoto, setIdPhoto] = useState(null);
    const [idPhotoBack, setIdPhotoBack] = useState(null);
    const [currentCounty, setCurrentCounty] = useState('');
    const [currentTown, setCurrentTown] = useState('');
    const [homeCounty, setHomeCounty] = useState('');
    const [nearestTown, setNearestTown] = useState('');
    const [uploadingState, setUploadingState] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!idPhoto || !idPhotoBack) {
            toast.error("Please upload both Front and Back of your ID.");
            return;
        }

        if (!currentCounty || !currentTown) {
            toast.error("Please select your County and Town.");
            return;
        }

        // Validate two or more names
        const nameParts = fullName.trim().split(/\s+/);
        if (nameParts.length < 2) {
            toast.error(t('name_min_words'));
            return;
        }

        setLoading(true);

        try {
            setUploadingState(t('processing_upload'));
            const photoUrl = await uploadProfilePhoto(user.uid, idPhoto, 'id_front');
            const photoUrlBack = await uploadProfilePhoto(user.uid, idPhotoBack, 'id_back');

            setUploadingState(t('processing_finalize'));

            // Critical fix: Ensure we use the best available ID (prioritizing phone-based profile ID)
            const targetId = profile?.id || sessionStorage.getItem('hazina_temp_phone') || user.uid;
            const userRef = doc(db, 'users', targetId);

            await updateDoc(userRef, {
                fullName,
                national_id: nationalId,
                id_photo_url: photoUrl,
                id_photo_back_url: photoUrlBack,
                currentCounty: currentCounty,
                currentTown: currentTown,
                homeCounty: homeCounty,
                nearestTown: nearestTown,
                profile_completed: true,
                updatedAt: serverTimestamp()
            });

            toast.success("Profile completed successfully!");
            navigate('/pay-registration');
        } catch (error) {
            console.error("Error updating profile:", error);
            // Log the attempted ID for better debugging
            const attemptId = profile?.id || sessionStorage.getItem('hazina_temp_phone') || user.uid;
            toast.error(`Failed to update profile (Ref: ${attemptId})`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[100dvh] bg-slate-50 flex items-center justify-center mobile-px">
            <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-xl border border-slate-100 responsive-p-box space-y-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>

                <div className="text-center relative">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-primary/10 rounded-2xl mb-4">
                        <User className="w-8 h-8 text-brand-primary" />
                    </div>
                    <h1 className="text-2xl font-bold font-heading text-slate-900">{t('complete_profile')}</h1>
                    <p className="text-slate-500 mt-2 text-sm italic">{t('verification_required')}</p>
                </div>

                {/* Progress Bar */}
                <div className="space-y-2">
                    <div className="flex justify-between items-end px-1">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Profile Completion</span>
                        <span className="text-sm font-black text-brand-primary">
                            {Math.round(
                                (fullName.trim().split(/\s+/).length >= 2 ? 15 : 0) +
                                (nationalId ? 15 : 0) +
                                (idPhoto ? 15 : 0) +
                                (idPhotoBack ? 15 : 0) +
                                (currentCounty && currentTown ? 20 : 0) +
                                (homeCounty && nearestTown ? 20 : 0)
                            )}%
                        </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{
                                width: `${(fullName.trim().split(/\s+/).length >= 2 ? 20 : 0) +
                                    (nationalId ? 20 : 0) +
                                    (idPhoto ? 20 : 0) +
                                    (idPhotoBack ? 20 : 0) +
                                    (currentCounty && currentTown ? 20 : 0)}%`
                            }}
                            className="h-full bg-gradient-to-r from-brand-primary to-emerald-500"
                            transition={{ type: "spring", stiffness: 50, damping: 15 }}
                        />
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2 ml-1">{t('full_name')}</label>
                        <input
                            type="text"
                            placeholder="JOHN DOE"
                            className="w-full bg-slate-50 border-slate-100 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-brand-primary transition-all text-slate-900 font-medium uppercase"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value.toUpperCase())}
                            required
                        />
                        <p className="text-[10px] text-brand-primary mt-2 italic px-1 font-bold">
                            {t('official_name_reminder')}
                        </p>
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2 ml-1">{t('national_id_number')}</label>
                        <input
                            type="text"
                            placeholder="12345678"
                            className="w-full bg-slate-50 border-slate-100 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-brand-primary transition-all text-slate-900 font-medium uppercase"
                            value={nationalId}
                            onChange={(e) => setNationalId(e.target.value.toUpperCase())}
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2 ml-1">ID FRONT</label>
                            <div className="relative border-2 border-dashed border-slate-200 rounded-2xl p-4 text-center hover:border-brand-primary transition-colors cursor-pointer bg-slate-50/50 overflow-hidden">
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => setIdPhoto(e.target.files[0])}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    required
                                />
                                {idPhoto ? (
                                    <CheckCircle2 className="w-8 h-8 text-brand-primary mx-auto" />
                                ) : (
                                    <Upload className="w-8 h-8 text-slate-300 mx-auto" />
                                )}
                                <p className="text-[9px] font-bold text-slate-500 mt-1 uppercase">Front Side</p>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2 ml-1">ID BACK</label>
                            <div className="relative border-2 border-dashed border-slate-200 rounded-2xl p-4 text-center hover:border-brand-primary transition-colors cursor-pointer bg-slate-50/50 overflow-hidden">
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => setIdPhotoBack(e.target.files[0])}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    required
                                />
                                {idPhotoBack ? (
                                    <CheckCircle2 className="w-8 h-8 text-brand-primary mx-auto" />
                                ) : (
                                    <Upload className="w-8 h-8 text-slate-300 mx-auto" />
                                )}
                                <p className="text-[9px] font-bold text-slate-500 mt-1 uppercase">Back Side</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1 ml-1">Current Residence</label>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="relative">
                                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <select
                                    value={currentCounty}
                                    onChange={(e) => {
                                        setCurrentCounty(e.target.value);
                                        setCurrentTown('');
                                    }}
                                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-10 pr-8 py-3.5 text-slate-900 font-bold text-sm appearance-none outline-none focus:ring-2 focus:ring-brand-primary"
                                    required
                                >
                                    <option value="">County</option>
                                    {KENYA_COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                            <div className="relative">
                                <select
                                    value={currentTown}
                                    onChange={(e) => setCurrentTown(e.target.value)}
                                    disabled={!currentCounty}
                                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3.5 text-slate-900 font-bold text-sm appearance-none outline-none focus:ring-2 focus:ring-brand-primary disabled:opacity-50"
                                    required
                                >
                                    <option value="">Closest Town</option>
                                    {(COUNTY_TOWNS[currentCounty] || []).map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1 ml-1">Home Connection</label>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="relative">
                                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <select
                                    value={homeCounty}
                                    onChange={(e) => setHomeCounty(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-10 pr-8 py-3.5 text-slate-900 font-bold text-sm appearance-none outline-none focus:ring-2 focus:ring-brand-primary"
                                    required
                                >
                                    <option value="">Home County</option>
                                    {KENYA_COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                            <input
                                type="text"
                                placeholder="Nearest Town"
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3.5 text-slate-900 font-bold text-sm outline-none focus:ring-2 focus:ring-brand-primary"
                                value={nearestTown}
                                onChange={(e) => setNearestTown(e.target.value.toUpperCase())}
                                required
                            />
                        </div>
                    </div>

                    <div className="bg-emerald-50 rounded-2xl p-4 flex gap-4 items-center">
                        <Shield className="w-10 h-10 text-brand-primary" />
                        <p className="text-xs text-emerald-800 leading-relaxed italic">
                            {t('documents_encrypted')}
                        </p>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 bg-brand-primary text-white font-bold rounded-2xl shadow-lg hover:bg-emerald-600 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        {loading ? uploadingState || t('processing') : (
                            <>{t('confirm_activate')} <ArrowRight className="w-5 h-5" /></>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default CompleteProfile;
