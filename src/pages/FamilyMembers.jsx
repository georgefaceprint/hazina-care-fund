import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { Users, Shield, ArrowLeft, PlusCircle, AlertCircle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const FamilyMembers = () => {
    const { profile, isDemoMode } = useAuth();
    const { t } = useLanguage();
    const navigate = useNavigate();
    const [dependents, setDependents] = useState([]);
    const [loading, setLoading] = useState(true);

    // Form State
    const [isAdding, setIsAdding] = useState(false);
    const [newDepName, setNewDepName] = useState('');
    const [newDepIdType, setNewDepIdType] = useState('national_id');
    const [newDepIdNumber, setNewDepIdNumber] = useState('');
    const [newDepSex, setNewDepSex] = useState('');
    const [newDepRelation, setNewDepRelation] = useState('');
    const [newDepTier, setNewDepTier] = useState('bronze');
    const [formLoading, setFormLoading] = useState(false);

    useEffect(() => {
        const fetchDependents = async () => {
            if (!profile) return;
            if (isDemoMode) {
                setDependents([{ id: 'demo-dep-1', name: 'Demo Dependent', active_tier: 'gold', createdAt: { toDate: () => new Date() }, grace_period_expiry: { toDate: () => new Date(Date.now() + 180 * 24 * 60 * 60 * 1000) } }]);
                setLoading(false);
                return;
            }
            try {
                if (!db) { setLoading(false); return; }
                const q = query(collection(db, 'dependents'), where('guardian_id', '==', profile.id));
                const querySnap = await getDocs(q);
                const docs = querySnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setDependents(docs);
            } catch (error) {
                console.error("Error fetching dependents:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchDependents();
    }, [profile, isDemoMode]);

    const handleAddDependent = async (e) => {
        e.preventDefault();
        setFormLoading(true);

        try {
            const docRef = await addDoc(collection(db, 'dependents'), {
                guardian_id: profile.id,
                name: newDepName,
                id_type: newDepIdType,
                id_number: newDepIdNumber,
                sex: newDepSex,
                relationship: newDepRelation,
                active_tier: newDepTier,
                eligible_tier: 'none',
                tier_joined_date: serverTimestamp(),
                grace_period_expiry: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // 180 days maturation
                createdAt: serverTimestamp()
            });

            // Update local state proactively
            const newDep = {
                id: docRef.id,
                name: newDepName,
                active_tier: newDepTier,
                is_matured: false,
                grace_period_expiry: { toDate: () => new Date(Date.now() + 180 * 24 * 60 * 60 * 1000) }
            };

            setDependents([...dependents, newDep]);
            setIsAdding(false);
            setNewDepName('');
            setNewDepIdType('national_id');
            setNewDepIdNumber('');
            setNewDepSex('');
            setNewDepRelation('');
            setNewDepTier('bronze');
        } catch (error) {
            console.error("Error adding dependent: ", error);
        } finally {
            setFormLoading(false);
        }
    };

    if (loading) return null;

    return (
        <div className="min-h-screen bg-slate-50 pt-8 px-6 pb-32">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100 hover:bg-slate-50 transition-colors"
                    >
                        <ArrowLeft className="w-6 h-6 text-slate-700" />
                    </button>
                    <h1 className="text-2xl font-bold font-heading text-slate-900">{t('family_members')}</h1>
                </div>
                {!isAdding && (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="p-3 bg-brand-primary text-white rounded-2xl shadow-md hover:bg-brand-primary/90 transition-transform active:scale-95 flex items-center gap-2"
                    >
                        <PlusCircle className="w-5 h-5" />
                        <span className="text-sm font-bold">{t('add')}</span>
                    </button>
                )}
            </div>

            {/* Daily Burn Impact Notice */}
            <div className="bg-brand-secondary text-white p-5 rounded-2xl mb-6 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-xl"></div>
                <div className="flex items-center gap-3 mb-2 relative">
                    <Shield className="w-5 h-5 text-brand-primary" />
                    <h3 className="font-bold">{t('guardian_responsibility')}</h3>
                </div>
                <p className="text-sm text-white/80 leading-relaxed font-light relative">
                    {t('adding_dependent_impact')}
                </p>
            </div>

            {isAdding ? (
                <div className="card animate-in slide-in-from-bottom-4 fade-in">
                    <h3 className="text-lg font-bold mb-4 font-heading text-slate-900">{t('add_dependent')}</h3>
                    <form onSubmit={handleAddDependent} className="space-y-5">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">{t('full_name_label')}</label>
                            <input
                                type="text"
                                required
                                value={newDepName}
                                onChange={(e) => setNewDepName(e.target.value.toUpperCase())}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none transition-all uppercase"
                                placeholder={t('example_name').toUpperCase()}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">{t('id_type')}</label>
                                <select
                                    value={newDepIdType}
                                    onChange={(e) => setNewDepIdType(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-primary outline-none"
                                >
                                    <option value="national_id">{t('national_id')}</option>
                                    <option value="birth_certificate">{t('birth_cert')}</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">{t('id_cert_number')}</label>
                                <input
                                    type="text"
                                    required
                                    value={newDepIdNumber}
                                    onChange={(e) => setNewDepIdNumber(e.target.value.toUpperCase())}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-primary outline-none transition-all uppercase"
                                    placeholder="12345678"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">{t('sex')}</label>
                                <select
                                    value={newDepSex}
                                    onChange={(e) => setNewDepSex(e.target.value)}
                                    required
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-primary outline-none"
                                >
                                    <option value="" disabled>Select</option>
                                    <option value="Male">{t('male')}</option>
                                    <option value="Female">{t('female')}</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">{t('relationship')}</label>
                                <select
                                    value={newDepRelation}
                                    onChange={(e) => setNewDepRelation(e.target.value)}
                                    required
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-primary outline-none"
                                >
                                    <option value="" disabled>Select</option>
                                    <option value="Spouse">{t('spouse')}</option>
                                    <option value="Child">{t('child')}</option>
                                    <option value="Parent">{t('parent')}</option>
                                    <option value="Sibling">{t('sibling')}</option>
                                    <option value="Other">{t('other')}</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">{t('coverage_tier')}</label>
                            <div className="grid grid-cols-3 gap-3">
                                {['bronze', 'silver', 'gold'].map((tier) => (
                                    <button
                                        key={tier}
                                        type="button"
                                        onClick={() => setNewDepTier(tier)}
                                        className={`py-3 px-2 rounded-xl text-xs font-bold uppercase tracking-wider border-2 transition-all ${newDepTier === tier
                                            ? 'border-brand-primary bg-brand-primary text-white'
                                            : 'border-slate-100 text-slate-500 hover:border-slate-200 bg-white'
                                            }`}
                                    >
                                        {tier}
                                    </button>
                                ))}
                            </div>
                            <p className="text-[10px] text-slate-400 mt-2 italic flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                {t('daily_impact')} {newDepTier === 'bronze' ? 10 : newDepTier === 'silver' ? 30 : 50}
                            </p>
                        </div>
                        <div className="flex gap-3 pt-4 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setIsAdding(false)}
                                className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-colors"
                            >
                                {t('cancel')}
                            </button>
                            <button
                                type="submit"
                                disabled={formLoading}
                                className="flex-1 btn-primary py-3"
                            >
                                {formLoading ? t('adding') : t('confirm')}
                            </button>
                        </div>
                    </form>
                </div>
            ) : (
                <div className="space-y-4">
                    {dependents.length === 0 ? (
                        <div className="text-center py-12 px-6 glass rounded-3xl">
                            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 border-8 border-white shadow-sm">
                                <Users className="w-8 h-8 text-slate-400" />
                            </div>
                            <h3 className="font-bold text-lg text-slate-800 mb-2 font-heading">{t('no_dependents_yet')}</h3>
                            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                                {t('protect_family')}
                            </p>
                            <button
                                onClick={() => setIsAdding(true)}
                                className="btn-primary w-full max-w-xs mx-auto"
                            >
                                {t('add_family_member')}
                            </button>
                        </div>
                    ) : (
                        dependents.map(dep => {
                            const isMatured = dep.grace_period_expiry && dep.grace_period_expiry.toDate() <= new Date();

                            return (
                                <div key={dep.id} className="card p-5 group hover:shadow-lg transition-all border border-slate-100 relative overflow-hidden">
                                    {!isMatured && (
                                        <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-950 text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-bl-xl shadow-sm z-10 flex items-center gap-1">
                                            <AlertCircle className="w-3 h-3" /> {t('in_waiting')}
                                        </div>
                                    )}
                                    <div className="flex items-center gap-4">
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-xl shadow-inner border-2 ${isMatured ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-500 border-slate-100'
                                            }`}>
                                            {dep.name[0]}
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-bold text-slate-900 text-lg">{dep.name}</h4>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold tracking-wider ${dep.active_tier === 'gold' ? 'bg-amber-100 text-amber-700' :
                                                    dep.active_tier === 'silver' ? 'bg-slate-200 text-slate-700' :
                                                        'bg-orange-100 text-orange-800'
                                                    }`}>
                                                    {dep.active_tier}
                                                </span>
                                                <span className="text-xs text-slate-400 flex items-center gap-1 border-l border-slate-200 pl-2">
                                                    {t('added_on')} {new Date(dep.createdAt?.toDate() || Date.now()).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
};

export default FamilyMembers;
