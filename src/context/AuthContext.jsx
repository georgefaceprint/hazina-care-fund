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

    useEffect(() => {
        if (isDemoMode) return;

        if (!auth) {
            console.error("Auth is not initialized. Rendering without auth.");
            setLoading(false);
            return;
        }

        const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
            try {
                if (authUser) {
                    setUser(authUser);

                    // Fetch Profile - Use Phone number as primary ID for persistence if available
                    const sessionPhone = sessionStorage.getItem('hazina_temp_phone');
                    let profileRef = null;

                    // 1. Check if Admin / Email user
                    if (authUser.email) {
                        // Admins use UID as document ID
                        profileRef = doc(db, 'users', authUser.uid);
                        const snap = await getDoc(profileRef);
                        if (!snap.exists()) {
                            // Try querying by email as fallback
                            const q = query(collection(db, 'users'), where('email', '==', authUser.email));
                            const querySnap = await getDocs(q);
                            if (!querySnap.empty) {
                                profileRef = doc(db, 'users', querySnap.docs[0].id);
                            } else {
                                profileRef = null;
                            }
                        }
                    } else {
                        // 2. Try Phone-based ID for regular users
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

                    // 3. Query Fallback by UID for phone users
                    if (!profileRef && !authUser.email) {
                        const q = query(collection(db, 'users'), where('uid', '==', authUser.uid));
                        const querySnap = await getDocs(q);
                        if (!querySnap.empty) {
                            profileRef = doc(db, 'users', querySnap.docs[0].id);
                        }
                    }

                    // 5. Fallback to UID ID
                    if (!profileRef) profileRef = doc(db, 'users', authUser.uid);

                    const unsubProfile = onSnapshot(profileRef, async (snap) => {
                        if (snap.exists()) {
                            const userData = snap.data();
                            let combinedProfile = { id: snap.id, ...userData };

                            // If user is an agent/recruiter, fetch their stats from the 'agents' collection
                            if (['agent', 'master_agent', 'super_master'].includes(userData.role)) {
                                const agentCode = userData.agent_code || snap.id;
                                const agentRef = doc(db, 'agents', agentCode);

                                // Set initial profile
                                setRealProfile(combinedProfile);

                                // Real-time listener for agent stats
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
                            console.warn("User profile document does not exist for ID:", profileRef.id);

                            // Check if this is a fresh login (email based)
                            if (authUser.email) {
                                // Auto-provision an admin profile.
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
                                    await setDoc(profileRef, {
                                        ...adminProfile,
                                        createdAt: new Date().toISOString()
                                    });
                                } catch (e) {
                                    console.error("Could not auto-create admin doc:", e);
                                }
                                setLoading(false);
                            } else {
                                // For phone users, wait a second to allow LoginPage to create the doc
                                // If it still doesn't exist, this is likely a stale session after a wipe
                                setTimeout(async () => {
                                    if (!snap.exists()) {
                                        console.warn("📍 Auth: Profile missing for authenticated user. Clearing stale session.");
                                        setRealProfile(false);
                                        setLoading(false);
                                        // Auto-logout for stale sessions
                                        if (auth.currentUser && !auth.currentUser.email) {
                                            await auth.signOut();
                                        }
                                    }
                                }, 2500);
                            }
                        }
                    }, (err) => {
                        console.error("Profile snapshot error:", err);
                        setLoading(false);
                    });

                    return () => {
                        if (typeof unsubProfile === 'function') unsubProfile();
                    };
                } else {
                    setUser(null);
                    setRealProfile(null);
                    setImpersonatedProfile(null);
                    setLoading(false);
                }
            } catch (error) {
                console.error("Auth state processing failed:", error);
                setUser(null);
                setRealProfile(null);
                setImpersonatedProfile(null);
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, [isDemoMode]);

    const value = {
        user,
        profile, // This will be the impersonated profile if it exists
        realProfile, // Access to the underlying original user
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
            {!loading && children}
        </AuthContext.Provider>
    );
};
