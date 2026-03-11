import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, onSnapshot, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

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
            
            // Determine the profile reference
            let profileRef = null;
            if (authUser.email) {
                profileRef = doc(db, 'users', authUser.uid);
            } else {
                const phone = authUser.phoneNumber || sessionStorage.getItem('hazina_temp_phone');
                if (phone) profileRef = doc(db, 'users', phone);
            }

            // Fallback: Query by UID if the doc ID is unknown
            if (!profileRef) {
                try {
                    const q = query(collection(db, 'users'), where('uid', '==', authUser.uid));
                    const qs = await getDocs(q);
                    if (!qs.empty) profileRef = doc(db, 'users', qs.docs[0].id);
                } catch (e) { console.error("Search error", e); }
            }

            if (!profileRef) profileRef = doc(db, 'users', authUser.uid);

            // Listen to profile
            const unsubProfile = onSnapshot(profileRef, async (snap) => {
                console.log("👤 Auth: Profile snapshot updated. Exists:", snap.exists(), "DocID:", snap.id);
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
                console.error("Profile listen error:", err);
                setRealProfile(false);
                setLoading(false);
            });

            return () => unsubProfile();
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
