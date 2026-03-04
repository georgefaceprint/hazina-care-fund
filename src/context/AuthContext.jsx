import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isDemoMode, setIsDemoMode] = useState(false);

    const enableDemoMode = () => {
        setIsDemoMode(true);
        setUser({ uid: 'demo-user', phoneNumber: '+254700000000' });
        setProfile({
            id: 'demo-profile-12345',
            role: 'admin',
            active_tier: 'gold',
            national_id: '12345678',
            balance: 5000,
            status: 'active'
        });
        setLoading(false);
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
            if (authUser) {
                setUser(authUser);

                // Fetch or Initialize Profile in Firestore
                const profileRef = doc(db, 'users', authUser.uid);
                const docSnap = await getDoc(profileRef);

                if (!docSnap.exists()) {
                    // Initialize default profile for new user
                    const newProfile = {
                        phoneNumber: authUser.phoneNumber || '',
                        role: 'user',
                        active_tier: 'bronze',
                        balance: 0,
                        status: 'pending_payment',
                        tier_joined_date: new Date(),
                        grace_period_expiry: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000) // 180 days
                    };
                    await setDoc(profileRef, newProfile);
                    setProfile({ id: authUser.uid, ...newProfile });
                }

                // Real-time profile updates
                const unsubProfile = onSnapshot(profileRef, (snap) => {
                    if (snap.exists()) {
                        setProfile({ id: snap.id, ...snap.data() });
                    }
                });

                setLoading(false);
                return () => unsubProfile();
            } else {
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
        logout,
        isDemoMode
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
