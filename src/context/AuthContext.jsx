import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, onSnapshot, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { formatKenyanPhone, standardizeTo254 } from '../utils/phoneUtils';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [realProfile, setRealProfile] = useState(null); // null = loading, false = missing, object = exists
    const [impersonatedProfile, setImpersonatedProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isDemoMode, setIsDemoMode] = useState(false);

    // Computed profile
    const profile = impersonatedProfile || realProfile;

    const impersonate = (targetProfile) => {
        if (realProfile?.role !== 'super_master' && realProfile?.role !== 'master_agent') return;
        setImpersonatedProfile(targetProfile);
    };

    const stopImpersonating = () => setImpersonatedProfile(null);

    const enableDemoMode = (phone = '+254712345678') => {
        setIsDemoMode(true);
        setUser({ uid: 'demo-user', phoneNumber: phone });
        setRealProfile({
            id: 'demo-profile',
            fullName: 'George Demo',
            role: 'admin',
            active_tier: 'gold',
            status: 'active',
            phoneNumber: phone
        });
        setLoading(false);
    };

    const loginWithEmail = async (email, password) => {
        setLoading(true);
        try {
            const result = await signInWithEmailAndPassword(auth, email, password);
            return result.user;
        } finally {
            setLoading(false);
        }
    };

    const logout = async () => {
        if (isDemoMode) {
            setIsDemoMode(false);
            setUser(null);
            setRealProfile(null);
            return;
        }
        await auth?.signOut();
    };

    // 1. Core Auth Listener
    useEffect(() => {
        if (isDemoMode) return;

        const unsubscribeAuth = onAuthStateChanged(auth, async (authUser) => {
            if (!authUser) {
                setUser(null);
                setRealProfile(false);
                setLoading(false);
                return;
            }

            setUser(authUser);
            
            // --- Resilient Profile Resolution Strategy ---
            const resolveProfile = async () => {
                try {
                    if (authUser.email) return doc(db, 'users', authUser.uid);

                    const rawPhone = authUser.phoneNumber || sessionStorage.getItem('hazina_temp_phone');
                    if (!rawPhone) {
                        console.warn("⚠️ [Auth] No phone or email found for authUser");
                        return null;
                    }

                    const localPhone = formatKenyanPhone(rawPhone);
                    const intlPhone = `+${standardizeTo254(rawPhone)}`;

                    // 1. Try Local Doc ID
                    try {
                        const localSnap = await getDoc(doc(db, 'users', localPhone));
                        if (localSnap.exists()) return doc(db, 'users', localPhone);
                    } catch (e) { console.warn("🔍 [Auth] Local doc check failed:", e.message); }

                    // 2. Try International Doc ID
                    try {
                        const intlSnap = await getDoc(doc(db, 'users', intlPhone));
                        if (intlSnap.exists()) return doc(db, 'users', intlPhone);
                    } catch (e) { console.warn("🔍 [Auth] Intl doc check failed:", e.message); }

                    // 3. Try UID Fallback Query
                    try {
                        const q = query(collection(db, 'users'), where('uid', '==', authUser.uid));
                        const qs = await getDocs(q);
                        if (!qs.empty) return doc(db, 'users', qs.docs[0].id);
                    } catch (e) {
                        console.error("🔍 [Auth] Profile Fallback Query Error:", e);
                    }

                    // 4. Ultimate Fallback (Default to UID-based doc for new users)
                    return doc(db, 'users', authUser.uid);
                } catch (err) {
                    console.error("❌ [Auth] critical error in resolveProfile:", err);
                    return doc(db, 'users', authUser.uid); 
                }
            };

            try {
                const profileRef = await resolveProfile();
                console.log("🔍 [Auth] Resolved profileRef:", profileRef?.path || "NULL");

                if (!profileRef) {
                    console.warn("⚠️ [Auth] Could not resolve profile reference. Marking profile as false.");
                    setRealProfile(false);
                    setLoading(false);
                    return;
                }

                // Listen to profile
                const unsubProfile = onSnapshot(profileRef, async (snap) => {
                    console.log("👤 [Auth] Profile snapshot update. Exists:", snap.exists(), "DocID:", snap.id);
                    if (snap.exists()) {
                        const data = snap.data();
                        setRealProfile({ id: snap.id, ...data });
                        setLoading(false);
                    } else {
                        // Profile missing logic
                        if (authUser.email === 'faceprint@icloud.com') {
                            // Auto-provision admin
                            const adminData = {
                                uid: authUser.uid,
                                email: authUser.email,
                                role: 'admin',
                                fullName: 'System Admin',
                                status: 'active',
                                createdAt: new Date().toISOString()
                            };
                            setRealProfile(adminData);
                            try { await setDoc(profileRef, adminData); } catch(e) { console.error("Provision failed", e); }
                            setLoading(false);
                        } else {
                            // Regular user might be creating profile right now, wait a bit
                            setTimeout(async () => {
                                const check = await getDoc(profileRef);
                                if (!check.exists()) {
                                    setRealProfile(false);
                                    setLoading(false);
                                    if (!authUser.email) await auth.signOut();
                                }
                            }, 3000);
                        }
                    }
                }, (err) => {
                    console.error("❌ [Auth] Profile listen error:", err);
                    setRealProfile(false);
                    setLoading(false);
                });

                return () => unsubProfile();
            } catch (err) {
                console.error("❌ [Auth] Final catch in auth listener:", err);
                setRealProfile(false);
                setLoading(false);
            }
        });

        return () => unsubscribeAuth();
    }, [isDemoMode]);

    // 2. Global System Listener
    useEffect(() => {
        if (!user || isDemoMode) return;

        const unsubSystem = onSnapshot(doc(db, 'config', 'system'), (snap) => {
            if (!snap.exists()) return;
            const { cache_version } = snap.data();
            const local = localStorage.getItem('hazina_cache_version');

            if (cache_version && local && cache_version.toString() !== local) {
                localStorage.setItem('hazina_cache_version', cache_version.toString());
                
                // --- Loop Breaker Guard ---
                const sessionReloaded = sessionStorage.getItem('hazina_session_reloaded');
                if (sessionReloaded) {
                    console.warn("⚠️ [AuthContext] Prevented refresh loop. Cache version mismatch detected again.");
                    return;
                }
                sessionStorage.setItem('hazina_session_reloaded', 'true');
                // --------------------------

                if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.getRegistrations().then(regs => {
                        regs.forEach(r => r.unregister());
                    });
                    caches.keys().then(keys => {
                        keys.forEach(k => caches.delete(k));
                    });
                }
                setTimeout(() => window.location.reload(true), 500);
            } else if (cache_version) {
                localStorage.setItem('hazina_cache_version', cache_version.toString());
            }
        }, (err) => {
            console.warn("System config read-only for admins? Skipping global sync check.");
        });

        return () => unsubSystem();
    }, [user, isDemoMode]);

    const value = {
        user,
        profile,
        realProfile,
        impersonatedProfile,
        loading,
        isAuthenticated: !!user,
        enableDemoMode,
        loginWithEmail,
        logout,
        impersonate,
        stopImpersonating,
        isDemoMode,
        isAgent: profile?.role === 'agent',
        isMasterAgent: profile?.role === 'master_agent',
        isSuperMaster: profile?.role === 'super_master',
        isActualSuperMaster: realProfile?.role === 'super_master'
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
