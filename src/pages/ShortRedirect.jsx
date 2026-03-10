import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const ShortRedirect = () => {
    const { agentCode } = useParams();
    const navigate = useNavigate();

    useEffect(() => {
        if (agentCode) {
            // Save the agent code to session storage so LoginPage can pick it up
            sessionStorage.setItem('hazina_agent_code', agentCode.toUpperCase());

            // Redirect to the actual login page
            navigate('/login', { replace: true });
        } else {
            navigate('/', { replace: true });
        }
    }, [agentCode, navigate]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-500 font-bold animate-pulse uppercase tracking-widest text-xs">Securing Referral...</p>
            </div>
        </div>
    );
};

export default ShortRedirect;
