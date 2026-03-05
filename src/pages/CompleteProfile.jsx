import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Shield, User, ArrowRight, Upload, Image as ImageIcon } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { uploadProfilePhoto } from '../services/storage';

const CompleteProfile = () => {
    const { user, profile } = useAuth();
    const { t } = useLanguage();
    const navigate = useNavigate();
    const toast = useToast();

    const [fullName, setFullName] = useState('');
    const [nationalId, setNationalId] = useState('');
    const [idPhoto, setIdPhoto] = useState(null);
    const [uploadingState, setUploadingState] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!idPhoto) {
            toast.error("Please upload your ID photo for verification.");
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
            const photoUrl = await uploadProfilePhoto(user.uid, idPhoto);

            setUploadingState(t('processing_finalize'));
            // Use the profile ID which is now phone-based for persistence
            const userRef = doc(db, 'users', profile?.id || user.uid);
            await updateDoc(userRef, {
                fullName,
                national_id: nationalId,
                id_photo_url: photoUrl,
                profile_completed: true,
                updatedAt: serverTimestamp()
            });

            toast.success("Profile completed successfully!");
            navigate('/dashboard');
        } catch (error) {
            console.error("Error updating profile:", error);
            toast.error("Failed to update profile.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-xl border border-slate-100 p-8 space-y-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>

                <div className="text-center relative">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-primary/10 rounded-2xl mb-4">
                        <User className="w-8 h-8 text-brand-primary" />
                    </div>
                    <h1 className="text-2xl font-bold font-heading text-slate-900">{t('complete_profile')}</h1>
                    <p className="text-slate-500 mt-2 text-sm italic">{t('verification_required')}</p>
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

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2 ml-1">{t('identity_verification')}</label>
                        <div className="relative border-2 border-dashed border-slate-200 rounded-[2rem] p-8 text-center hover:border-brand-primary transition-colors cursor-pointer bg-slate-50/50 group overflow-hidden">
                            <input
                                type="file"
                                accept="image/jpeg, image/png"
                                onChange={(e) => setIdPhoto(e.target.files[0])}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                required
                            />
                            {idPhoto ? (
                                <div className="flex flex-col items-center justify-center">
                                    <ImageIcon className="w-10 h-10 text-brand-primary mb-3" />
                                    <p className="text-sm font-bold text-slate-700 truncate w-full px-4">{idPhoto.name}</p>
                                    <p className="text-[10px] text-brand-primary uppercase tracking-tighter mt-1 font-bold">{t('image_selected')}</p>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center">
                                    <Upload className="w-10 h-10 text-slate-300 mx-auto mb-3 group-hover:text-brand-primary transition-colors" />
                                    <p className="text-sm font-bold text-slate-700">{t('upload_id_front')}</p>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-tighter mt-1">{t('jpg_png_max')}</p>
                                </div>
                            )}
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
