import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, onSnapshot, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [realProfile, setRealProfile] = useState(null);
    const [impersonatedProfile, setImpersonatedProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isDemoMode, setIsDemoMode] = useState(false);

    // Computed profile: returns impersonated one if active, otherwise real one
    const profile = impersonatedProfile || realProfile;

    const impersonate = (targetProfile) => {
        if (realProfile?.role !== 'super_master' && realProfile?.role !== 'master_agent') {
            console.error("Insufficient permissions to impersonate.");
            return;
        }
        setImpersonatedProfile(targetProfile);
    };

    const stopImpersonating = () => {
        setImpersonatedProfile(null);
    };

    const enableDemoMode = (phone = '+254712345678') => {
        setIsDemoMode(true);
        setUser({ uid: 'demo-user', phoneNumber: phone });
        setRealProfile({
            id: 'demo-profile-12345',
            fullName: 'George Demo',
            role: 'admin',
            active_tier: 'gold',
            national_id: '12345678',
            balance: 5000,
            status: 'active',
            phoneNumber: phone
        });
        setLoading(false);
    };

    const loginWithEmail = async (email, password) => {
        try {
            setLoading(true);
            const result = await signInWithEmailAndPassword(auth, email, password);
            return result.user;
        } catch (error) {
            console.error("Login with email failed:", error);
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const logout = async () => {
        if (isDemoMode) {
            setIsDemoMode(false);
            setUser(null);
            setRealProfile(null);
            setImpersonatedProfile(null);
            return;
        }
        if (auth) {
            await auth.signOut();
        }
    };

    // 1. Auth & Profile Listener
    useEffect(() => {
        if (isDemoMode) return;

        if (!auth) {
            console.error("Auth is not initialized. Rendering without auth.");
            setLoading(false);
            return;
        }

        let unsubProfile = null;

        const unsubscribeAuth = onAuthStateChanged(auth, async (authUser) => {
            // Clean up previous profile listener if any
            if (unsubProfile) {
                unsubProfile();
                unsubProfile = null;
            }

            try {
                if (authUser) {
                    setUser(authUser);

                    const sessionPhone = sessionStorage.getItem('hazina_temp_phone');
                    let profileRef = null;

                    if (authUser.email) {
                        profileRef = doc(db, 'users', authUser.uid);
                    } else {
                        if (authUser.phoneNumber) {
                            profileRef = doc(db, 'users', authUser.phoneNumber);
                        } else if (sessionPhone) {
                            profileRef = doc(db, 'users', sessionPhone);
                        }

                        if (profileRef) {
                            const snap = await getDoc(profileRef);
                            if (!snap.exists()) profileRef = null;
                        }
                    }

                    if (!profileRef && !authUser.email) {
                        const q = query(collection(db, 'users'), where('uid', '==', authUser.uid));
                        const querySnap = await getDocs(q);
                        if (!querySnap.empty) {
                            profileRef = doc(db, 'users', querySnap.docs[0].id);
                        }
                    }

                    if (!profileRef) profileRef = doc(db, 'users', authUser.uid);

                    unsubProfile = onSnapshot(profileRef, async (snap) => {
                        if (snap.exists()) {
                            const userData = snap.data();
                            let combinedProfile = { id: snap.id, ...userData };

                            if (['agent', 'master_agent', 'super_master'].includes(userData.role)) {
                                const agentCode = userData.agent_code || snap.id;
                                const agentRef = doc(db, 'agents', agentCode);
                                setRealProfile(combinedProfile);
                                
                                // Nested listener for agent stats (optional: could be a separate effect)
                                onSnapshot(agentRef, (aSnap) => {
                                    if (aSnap.exists()) {
                                        setRealProfile(prev => ({
                                            ...prev,
                                            ...aSnap.data(),
                                            agentDocId: aSnap.id
                                        }));
                                    }
                                });
                            } else {
                                setRealProfile(combinedProfile);
                            }
                            setLoading(false);
                        } else {
                            // Profile missing - handle auto-provision for admin or stale session for others
                            if (authUser.email) {
                                const adminProfile = {
                                    id: authUser.uid,
                                    uid: authUser.uid,
                                    email: authUser.email,
                                    role: 'admin',
                                    fullName: 'System Admin',
                                    status: 'active'
                                };
                                setRealProfile(adminProfile);
                                try {
                                    await setDoc(profileRef, { ...adminProfile, createdAt: new Date().toISOString() });
                                } catch (e) { console.error("Auto-provision failed", e); }
                                setLoading(false);
                            } else {
                                // Stale session timeout
                                setTimeout(async () => {
                                    const finalSnap = await getDoc(profileRef);
                                    if (!finalSnap.exists()) {
                                        setRealProfile(false);
                                        setLoading(false);
                                        if (auth.currentUser && !auth.currentUser.email) {
                                            await auth.signOut();
                                        }
                                    }
                                }, 2000);
                            }
                        }
                    }, (err) => {
                        console.error("Profile error", err);
                        setLoading(false);
                    });
                } else {
                    setUser(null);
                    setRealProfile(null);
                    setImpersonatedProfile(null);
                    setLoading(false);
                }
            } catch (error) {
                console.error("Auth state error", error);
                setLoading(false);
            }
        });

        return () => {
            unsubscribeAuth();
            if (unsubProfile) unsubProfile();
        };
    }, [isDemoMode]);

    // 2. Global System Listener (Cache Busting)
    useEffect(() => {
        const unsubscribeSystem = onSnapshot(doc(db, 'config', 'system'), async (snap) => {
            if (snap.exists()) {
                const { cache_version } = snap.data();
                const localVersion = localStorage.getItem('hazina_cache_version');

                if (cache_version && localVersion && cache_version.toString() !== localVersion) {
                    localStorage.setItem('hazina_cache_version', cache_version.toString());
                    
                    if ('serviceWorker' in navigator) {
                        const regs = await navigator.serviceWorker.getRegistrations();
                        for (let r of regs) await r.unregister();
                        const ckb = await caches.keys();
                        for (let c of ckb) await caches.delete(c);
                    }
                    
                    localStorage.removeItem('hazina_install_dismissed');
                    window.location.reload(true);
                } else if (cache_version) {
                    localStorage.setItem('hazina_cache_version', cache_version.toString());
                }
            }
        });

        return () => unsubscribeSystem();
    }, []);

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
