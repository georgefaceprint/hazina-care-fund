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

                // Fetch Profile - Use Phone number as primary ID for persistence if available
                // If the user signed in anonymously with a phone number, we use that.
                // Note: In our current LoginPage, we store profiles by phone number.
                let profileRef;
                if (authUser.phoneNumber) {
                    profileRef = doc(db, 'users', authUser.phoneNumber);
                } else {
                    // Fallback to searching for a profile by UID if phone isn't in authUser
                    // Or for now, just use the UID if no phone is found (e.g. social login)
                    profileRef = doc(db, 'users', authUser.uid);
                }

                let docSnap = await getDoc(profileRef);

                if (!docSnap.exists()) {
                    // Try to find if a profile exists with this UID mapping (legacy or fallback)
                    // If not, we stay with the initial ref
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
