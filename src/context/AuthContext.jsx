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

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
            if (authUser) {
                setUser(authUser);
                // Real-time profile updates
                const profileRef = doc(db, 'users', authUser.uid);
                const unsubProfile = onSnapshot(profileRef, (doc) => {
                    if (doc.exists()) {
                        setProfile({ id: doc.id, ...doc.data() });
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
    }, []);

    const value = {
        user,
        profile,
        loading,
        isAuthenticated: !!user
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
