import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Clock, XCircle, Search, DollarSign, Filter } from 'lucide-react';

const AdminPanel = () => {
    const { profile, isDemoMode } = useAuth();
    const navigate = useNavigate();
    const [claims, setClaims] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('pending_review');
    const [actionLoading, setActionLoading] = useState(null);

    // Hardcode admin role check for MVP purposes (In production this should be a role in Firestore/Custom Claims)
    // Here we'll just check if the user is an admin by an arbitrary flag we can set in db.
    const isAdmin = profile?.role === 'admin';

    useEffect(() => {
        if (!isAdmin) {
            navigate('/dashboard');
            return;
        }

        if (isDemoMode) {
            setClaims([{ id: 'demo-claim', type: 'medical', amount: 5000, description: 'Medical Emergency', status: 'pending_review', guardian_id: 'demo-123', createdAt: { toDate: () => new Date() } }]);
            setLoading(false);
            return;
        }

        const q = query(
            collection(db, 'claims'),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const claimsData = snapshot.docs.map(docSnap => ({
                id: docSnap.id,
                ...docSnap.data()
            }));
            setClaims(claimsData);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching real-time claims:", error);
            setLoading(false); // Ensure loading state is cleared even on error
            // Optionally, set an error state to display to the user
            // setError('Failed to load claims. Please try again later.');
        });

        return () => unsubscribe();
    }, [isAdmin, navigate]);

    const handleAction = async (claimId, guardianId, claimAmount, newStatus) => {
        setActionLoading(claimId);
        try {
            const claimRef = doc(db, 'claims', claimId);
            const userRef = doc(db, 'users', guardianId);

            await updateDoc(claimRef, { status: newStatus });

            // If approved, trigger B2C logic (mocked here by deducting from global pool)
            if (newStatus === 'approved') {
                // In production, call a Cloud Function to securely execute M-PESA B2C API
                console.log(`B2C payout of ${claimAmount} initiated to ${guardianId}.`);
            }

        } catch (error) {
            console.error("Error updating claim status: ", error);
            alert("Action failed. Check console.");
        } finally {
            setActionLoading(null);
        }
    };

    if (loading) return null;

    const filteredClaims = claims.filter(c => filter === 'all' || c.status === filter);

    return (
        <div className="min-h-screen bg-slate-50 pt-8 px-6 pb-32 font-sans">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100 hover:bg-slate-50 transition-colors"
                    >
                        <ArrowLeft className="w-6 h-6 text-slate-700" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold font-heading text-slate-900">Admin Control</h1>
                        <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Claims Queue</p>
                    </div>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-3 mb-8">
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 text-center cursor-pointer hover:border-brand-primary" onClick={() => setFilter('pending_review')}>
                    <Clock className={`w-6 h-6 mx-auto mb-2 ${filter === 'pending_review' ? 'text-amber-500' : 'text-slate-300'}`} />
                    <p className="text-2xl font-black text-slate-800">{claims.filter(c => c.status === 'pending_review').length}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Pending</p>
                </div>
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 text-center cursor-pointer hover:border-brand-primary" onClick={() => setFilter('approved')}>
                    <ShieldCheck className={`w-6 h-6 mx-auto mb-2 ${filter === 'approved' ? 'text-emerald-500' : 'text-slate-300'}`} />
                    <p className="text-2xl font-black text-slate-800">{claims.filter(c => c.status === 'approved').length}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Approved</p>
                </div>
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 text-center cursor-pointer hover:border-brand-primary" onClick={() => setFilter('all')}>
                    <Filter className={`w-6 h-6 mx-auto mb-2 ${filter === 'all' ? 'text-brand-primary' : 'text-slate-300'}`} />
                    <p className="text-2xl font-black text-slate-800">{claims.length}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Total</p>
                </div>
            </div>

            {/* Claims List */}
            <div className="space-y-4">
                {filteredClaims.length === 0 ? (
                    <div className="text-center py-12 glass rounded-3xl">
                        <ShieldCheck className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500 font-bold">No claims in this queue.</p>
                    </div>
                ) : (
                    filteredClaims.map((claim) => (
                        <div key={claim.id} className="card p-5 bg-white shadow-sm border border-slate-100">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded ${claim.type === 'medical' ? 'bg-red-100 text-red-700' :
                                            claim.type === 'bereavement' ? 'bg-slate-200 text-slate-800' :
                                                'bg-blue-100 text-blue-700'
                                            }`}>
                                            {claim.type.replace('_', ' ')}
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-mono">
                                            {new Date(claim.createdAt?.toDate()).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <h3 className="font-bold text-slate-900 text-lg">KSh {claim.amount.toLocaleString()}</h3>
                                    <p className="text-xs text-slate-500 font-mono tracking-tight mt-1">ID: {claim.guardian_id}</p>
                                </div>
                                <div className={`px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-tight flex items-center gap-1 ${claim.status === 'pending_review' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                    claim.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                        'bg-red-50 text-red-700 border-red-200'
                                    }`}>
                                    {claim.status === 'pending_review' ? <Clock className="w-3 h-3" /> :
                                        claim.status === 'approved' ? <ShieldCheck className="w-3 h-3" /> :
                                            <XCircle className="w-3 h-3" />}
                                    {claim.status.replace('_', ' ')}
                                </div>
                            </div>

                            <div className="bg-slate-50 p-3 rounded-xl mb-4 text-sm text-slate-700">
                                "{claim.description}"
                            </div>

                            {claim.status === 'pending_review' && (
                                <div className="flex gap-3 mt-4 pt-4 border-t border-slate-100">
                                    <button
                                        onClick={() => handleAction(claim.id, claim.guardian_id, claim.amount, 'rejected')}
                                        disabled={actionLoading === claim.id}
                                        className="flex-1 py-2.5 rounded-xl border border-red-200 text-red-600 font-bold hover:bg-red-50 transition-colors"
                                    >
                                        Reject
                                    </button>
                                    <button
                                        onClick={() => handleAction(claim.id, claim.guardian_id, claim.amount, 'approved')}
                                        disabled={actionLoading === claim.id}
                                        className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 shadow-sm flex items-center justify-center gap-2"
                                    >
                                        {actionLoading === claim.id ? 'Processing...' : (
                                            <>Approve & Pay <DollarSign className="w-4 h-4" /></>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default AdminPanel;
