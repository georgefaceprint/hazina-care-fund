import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, onSnapshot, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isDemoMode, setIsDemoMode] = useState(false);

    const enableDemoMode = (phone = '+254712345678') => {
        setIsDemoMode(true);
        setUser({ uid: 'demo-user', phoneNumber: phone });
        setProfile({
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
            setProfile(null);
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
                            setProfile({ id: snap.id, ...snap.data() });
                        } else {
                            console.warn("User profile document does not exist for ID:", profileRef.id);
                            if (authUser.email) {
                                // Auto-provision an admin profile.
                                // We first set it in memory so the UI immediately proceeds.
                                const adminProfile = {
                                    id: authUser.uid,
                                    uid: authUser.uid,
                                    email: authUser.email,
                                    role: 'admin',
                                    fullName: 'System Admin',
                                    status: 'active'
                                };
                                setProfile(adminProfile);

                                // Attempt to save to Firestore so it persists
                                try {
                                    await setDoc(profileRef, {
                                        ...adminProfile,
                                        createdAt: new Date().toISOString()
                                    });
                                } catch (e) {
                                    console.error("Could not auto-create admin doc:", e);
                                }
                            } else {
                                // For regular user without profile, set to false so App.jsx doesn't spin forever
                                setProfile(false);
                            }
                        }
                        setLoading(false);
                    }, (err) => {
                        console.error("Profile snapshot error:", err);
                        setLoading(false);
                    });

                    return () => {
                        if (typeof unsubProfile === 'function') unsubProfile();
                    };
                } else {
                    setUser(null);
                    setProfile(null);
                    setLoading(false);
                }
            } catch (error) {
                console.error("Auth state processing failed:", error);
                setUser(null);
                setProfile(null);
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, [isDemoMode]);

    const value = {
        user,
        profile,
        loading,
        isAuthenticated: !!user,
        enableDemoMode,
        loginWithEmail,
        logout,
        isDemoMode,
        isAgent: profile?.role === 'agent',
        isMasterAgent: profile?.role === 'master_agent',
        isSuperMaster: profile?.role === 'super_master'
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
