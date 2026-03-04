import React, { createContext, useContext, useState, useEffect } from 'react';
import translations from '../utils/i18n';

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
    const [language, setLanguage] = useState(() => {
        // Default to saved language or 'en'
        return localStorage.getItem('hazina_lang') || 'en';
    });

    useEffect(() => {
        localStorage.setItem('hazina_lang', language);
    }, [language]);

    const toggleLanguage = () => {
        setLanguage(prev => prev === 'en' ? 'sw' : 'en');
    };

    const t = (key) => {
        return translations[language]?.[key] || translations['en']?.[key] || key;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};
