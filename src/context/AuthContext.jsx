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
                console.log("🔍 [Auth] Resolving profile for:", authUser.uid, authUser.phoneNumber, authUser.email);
                try {
                    if (authUser.email) {
                        console.log("🔍 [Auth] Email user detected, checking UID doc:", authUser.uid);
                        return doc(db, 'users', authUser.uid);
                    }

                    const rawPhone = authUser.phoneNumber || sessionStorage.getItem('hazina_temp_phone');
                    console.log("🔍 [Auth] rawPhone for lookup:", rawPhone);
                    if (!rawPhone) {
                        console.warn("⚠️ [Auth] No phone or email found for authUser");
                        return null;
                    }

                    const localPhone = formatKenyanPhone(rawPhone);
                    const intlPhone = `+${standardizeTo254(rawPhone)}`;

                    console.log("🔍 [Auth] Checking formats:", { localPhone, intlPhone });

                    // 1. Try Local Doc ID (07...)
                    try {
                        const localSnap = await getDoc(doc(db, 'users', localPhone));
                        if (localSnap.exists()) {
                            console.log("✅ [Auth] Found profile via local phone:", localPhone);
                            return doc(db, 'users', localPhone);
                        }
                    } catch (e) { console.warn("🔍 [Auth] Local doc check failed:", e.message); }

                    // 2. Try International Doc ID (+254...)
                    try {
                        const intlSnap = await getDoc(doc(db, 'users', intlPhone));
                        if (intlSnap.exists()) {
                            console.log("✅ [Auth] Found profile via intl phone:", intlPhone);
                            return doc(db, 'users', intlPhone);
                        }
                    } catch (e) { console.warn("🔍 [Auth] Intl doc check failed:", e.message); }

                    // 2b. Try Raw International Doc ID (254...) - Common for Agent-registered users
                    const rawIntlPhone = intlPhone.replace('+', '');
                    try {
                        const rawSnap = await getDoc(doc(db, 'users', rawIntlPhone));
                        if (rawSnap.exists()) {
                            console.log("✅ [Auth] Found profile via raw intl phone:", rawIntlPhone);
                            return doc(db, 'users', rawIntlPhone);
                        }
                    } catch (e) { console.warn("🔍 [Auth] Raw intl doc check failed:", e.message); }

                    // 2c. Try Raw International with Leading Zero (2540...) - Rare edge case
                    const intlWithZero = intlPhone.replace('+254', '2540');
                    try {
                        const zeroSnap = await getDoc(doc(db, 'users', intlWithZero));
                        if (zeroSnap.exists()) {
                            console.log("✅ [Auth] Found profile via intl with zero:", intlWithZero);
                            return doc(db, 'users', intlWithZero);
                        }
                    } catch (e) { console.warn("🔍 [Auth] Intl with zero check failed:", e.message); }

                    // 2d. Try UID direct document (Common for Email/Password or manual admins)
                    try {
                        const uidSnap = await getDoc(doc(db, 'users', authUser.uid));
                        if (uidSnap.exists()) {
                            console.log("✅ [Auth] Found profile via direct UID doc ID:", authUser.uid);
                            return doc(db, 'users', authUser.uid);
                        }
                    } catch (e) { console.warn("🔍 [Auth] UID doc check failed:", e.message); }

                    // 3. Try UID Fallback Query (Search by field, not ID)
                    try {
                        const q = query(collection(db, 'users'), where('uid', '==', authUser.uid));
                        const qs = await getDocs(q);
                        if (!qs.empty) {
                            console.log("✅ [Auth] Found profile via UID field query:", qs.docs[0].id);
                            return doc(db, 'users', qs.docs[0].id);
                        }
                    } catch (e) {
                        console.error("🔍 [Auth] Profile Fallback Query Error:", e);
                    }

                    // 4. Ultimate Fallback (Default to preferred residency for new users)
                    // If we have a phone number but no doc exists yet, it's likely a new signup.
                    // Hazina prefers local format (07...) for user documents.
                    if (localPhone) {
                        console.log("🎯 [Auth] New user residency fallback: local phone", localPhone);
                        return doc(db, 'users', localPhone);
                    }

                    console.log("🎯 [Auth] Absolute fallback: authUser.uid", authUser.uid);
                    return doc(db, 'users', authUser.uid);
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
