import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
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
                // Real-time profile updates
                const profileRef = doc(db, 'users', authUser.uid);
                const unsubProfile = onSnapshot(profileRef, (docSnap) => {
                    if (docSnap.exists()) {
                        setProfile({ id: docSnap.id, ...docSnap.data() });
                    } else {
                        setProfile(null);
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
