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
                console.log("🔍 [Auth] Resolving professional profile for:", authUser.uid, authUser.phoneNumber);
                try {
                    const rawPhone = authUser.phoneNumber || sessionStorage.getItem('hazina_temp_phone');
                    if (!rawPhone && !authUser.email) return null;

                    const localPhone = formatKenyanPhone(rawPhone);
                    const intlPhone = `+${standardizeTo254(rawPhone)}`;
                    const rawIntlPhone = intlPhone.replace('+', '');

                    // Collect ALL candidate document IDs
                    const candidates = [...new Set([
                        intlPhone, 
                        localPhone, 
                        rawIntlPhone, 
                        authUser.uid,
                        authUser.email
                    ].filter(Boolean))];

                    console.log("🔍 [Auth] Candidate IDs:", candidates);

                    // Fetch all candidates and find the one with the "best" role
                    const snaps = await Promise.all(candidates.map(id => getDoc(doc(db, 'users', id))));
                    const proSnap = snaps.find(s => s.exists() && ['super_master', 'master_agent', 'agent', 'admin'].includes(s.data()?.role));

                    if (proSnap) {
                        console.log("💎 [Auth] Found professional profile:", proSnap.id, proSnap.data().role);
                        return doc(db, 'users', proSnap.id);
                    }

                    // Fallback to the first existing doc or the preferred intl format
                    const existingSnap = snaps.find(s => s.exists());
                    if (existingSnap) {
                        console.log("👤 [Auth] Found standard profile:", existingSnap.id);
                        return doc(db, 'users', existingSnap.id);
                    }

                    // Strict new user residency
                    console.log("🎯 [Auth] No doc found, defaulting to intl ID:", intlPhone);
                    return doc(db, 'users', intlPhone);
                } catch (err) {
                    console.error("❌ [Auth] critical error in resolveProfile:", err);
                    return authUser.uid ? doc(db, 'users', authUser.uid) : null; 
                }
            };

            try {
                const profileRef = await resolveProfile();
                console.log("📍 [Auth] Resolved Profile Path:", profileRef?.path);

                if (!profileRef) {
                    console.warn("⚠️ [Auth] No profile reference could be resolved.");
                    setRealProfile(false);
                    setLoading(false);
                    return;
                }

                // Listen to profile
                const unsubProfile = onSnapshot(profileRef, async (snap) => {
                    if (snap.exists()) {
                        const data = snap.data();
                        console.log("👤 [Auth] Profile active:", snap.id, data.role);
                        setRealProfile({ id: snap.id, ...data });
                        setLoading(false);
                    } else {
                        // Profile missing - logic for auto-provisioning or graceful fallback
                        if (authUser.email === 'faceprint@icloud.com') {
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
                            // NEW USER or DELETED USER
                            // Wait longer (up to 12s) to allow LoginPage to finish setDoc/upload tasks
                            // This prevents the "kicked back to login" loop during signup
                            const registrationInProgress = !!sessionStorage.getItem('hazina_temp_phone');
                            
                            setTimeout(async () => {
                                const check = await getDoc(profileRef);
                                if (!check.exists()) {
                                    if (registrationInProgress) {
                                        console.log("⏳ [Auth] Registration likely in progress. Final grace period extension...");
                                        // One last check after 5 more seconds
                                        await new Promise(r => setTimeout(r, 5000));
                                        const finalCheck = await getDoc(profileRef);
                                        if (finalCheck.exists()) return;
                                    }
                                    
                                    console.warn("⚠️ [Auth] Profile strictly missing after grace period. Doc:", profileRef.path);
                                    setRealProfile(false);
                                    setLoading(false);
                                    // Only sign out if strictly necessary (phone users without profiles)
                                    if (!authUser.email && !registrationInProgress) {
                                        console.error("🚫 [Auth] Session invalid (no profile). Logging out.");
                                        await auth.signOut();
                                    }
                                }
                            }, 12000);
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
