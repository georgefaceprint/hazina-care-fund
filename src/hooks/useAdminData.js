import { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { collection, query, orderBy, onSnapshot, doc, limit } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';

export const useAdminData = () => {
    const { isAdmin, isDemoMode } = useAuth();
    
    const [claims, setClaims] = useState([]);
    const [users, setUsers] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [globalStats, setGlobalStats] = useState({ total_fund: 0, total_burn: 0, total_topups: 0, total_claims_paid: 0 });
    const [kbItems, setKbItems] = useState([]);
    const [tiers, setTiers] = useState({});
    const [agents, setAgents] = useState([]);
    const [masterAgents, setMasterAgents] = useState([]);
    const [recruitmentLogs, setRecruitmentLogs] = useState([]);
    const [withdrawals, setWithdrawals] = useState([]);
    const [forcedTotpList, setForcedTotpList] = useState([]);
    const [referralSystemActive, setReferralSystemActive] = useState(true);
    const [recruitmentConfig, setRecruitmentConfig] = useState({ agentCommission: 15, masterCommission: 5 });
    const [loading, setLoading] = useState(true);

    const getSafeDate = (dateVal) => {
        if (!dateVal) return new Date();
        return typeof dateVal.toDate === 'function' ? dateVal.toDate() : new Date(dateVal);
    };

    useEffect(() => {
        if (!isAdmin) return;

        if (isDemoMode) {
            setClaims([{ id: 'demo-claim', type: 'medical', amount: 5000, description: 'Medical Emergency', status: 'pending_review', guardian_id: 'demo-123', createdAt: { toDate: () => new Date() } }]);
            setLoading(false);
            return;
        }

        const unsubscribes = [];

        // 1. Claims
        unsubscribes.push(onSnapshot(query(collection(db, 'claims'), orderBy('createdAt', 'desc')), (snapshot) => {
            setClaims(snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })));
            setLoading(false);
        }));

        // 2. Users
        unsubscribes.push(onSnapshot(collection(db, 'users'), (snapshot) => {
            setUsers(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        }));

        // 3. Transactions
        unsubscribes.push(onSnapshot(query(collection(db, 'transactions'), orderBy('createdAt', 'desc'), limit(50)), (snapshot) => {
            setTransactions(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        }));

        // 4. Global Stats
        unsubscribes.push(onSnapshot(doc(db, 'totals', 'liquidity'), (docSnap) => {
            if (docSnap.exists()) setGlobalStats(docSnap.data());
        }));

        // 5. Training KB
        unsubscribes.push(onSnapshot(collection(db, 'sifuna_kb'), (snapshot) => {
            setKbItems(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        }));

        // 6. Tier Config
        unsubscribes.push(onSnapshot(doc(db, 'config', 'tiers'), (docSnap) => {
            if (docSnap.exists()) setTiers(docSnap.data());
        }));

        // 7. Agents & Master Agents
        unsubscribes.push(onSnapshot(collection(db, 'agents'), (snapshot) => {
            setAgents(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        }));
        unsubscribes.push(onSnapshot(collection(db, 'master_agents'), (snapshot) => {
            setMasterAgents(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        }));

        // 8. Recruitment Logs
        unsubscribes.push(onSnapshot(query(collection(db, 'recruitment_logs'), orderBy('timestamp', 'desc'), limit(100)), (snapshot) => {
            setRecruitmentLogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        }));

        // 9. Recruitment Config
        unsubscribes.push(onSnapshot(doc(db, 'config', 'recruitment'), (docSnap) => {
            if (docSnap.exists()) setRecruitmentConfig(docSnap.data());
        }));

        // 10. Withdrawals
        unsubscribes.push(onSnapshot(query(collection(db, 'withdrawals'), orderBy('timestamp', 'desc'), limit(50)), (snapshot) => {
            setWithdrawals(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        }));

        // 11. Security Config
        unsubscribes.push(onSnapshot(doc(db, 'config', 'security'), (snap) => {
            if (snap.exists()) setForcedTotpList(snap.data().forced_totp_list || []);
        }));

        // 12. Referral Config
        unsubscribes.push(onSnapshot(doc(db, 'config', 'referrals'), (snap) => {
            if (snap.exists()) setReferralSystemActive(snap.data().referralSystemActive !== false);
        }));

        return () => unsubscribes.forEach(unsub => unsub());
    }, [isAdmin, isDemoMode]);

    return {
        claims,
        users,
        transactions,
        globalStats,
        kbItems,
        tiers,
        agents,
        masterAgents,
        recruitmentLogs,
        recruitmentConfig,
        withdrawals,
        forcedTotpList,
        referralSystemActive,
        loading,
        getSafeDate
    };
};
