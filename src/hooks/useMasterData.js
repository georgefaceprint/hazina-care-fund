import { useState, useEffect, useMemo } from 'react';
import { 
    collection, query, where, getDocs, doc, setDoc, 
    updateDoc, deleteDoc, orderBy, Timestamp, limit, 
    serverTimestamp, onSnapshot 
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatKenyanPhone, stripPlus, standardizeTo254 } from '../utils/phoneUtils';
import { generateAgentPrefix } from '../utils/referralUtils';

export const useMasterData = () => {
    const { profile, impersonate } = useAuth();
    const toast = useToast();
    
    const [agents, setAgents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingAgent, setEditingAgent] = useState(null);
    const [newAgent, setNewAgent] = useState({
        fullName: '',
        phoneNumber: '',
        nationalId: '',
        region: '',
        agentCode: ''
    });
    const [stats, setStats] = useState({
        totalAgents: 0,
        signupsToday: 0,
        signupsYesterday: 0
    });

    // Standardize master identification logic
    const masterCode = useMemo(() => (profile?.agent_code || '').trim().toUpperCase(), [profile?.agent_code]);
    const masterPhoneRaw = profile?.phoneNumber || '';
    const localPhone = useMemo(() => formatKenyanPhone(masterPhoneRaw), [masterPhoneRaw]);
    const intlPhone = useMemo(() => standardizeTo254(masterPhoneRaw), [masterPhoneRaw]);
    const masterUid = profile?.id || profile?.uid || '';

    const allMasterIds = useMemo(() => {
        return [...new Set([
            masterCode,
            localPhone,
            intlPhone,
            masterPhoneRaw,
            masterUid,
            masterCode ? stripPlus(masterCode) : null
        ].filter(id => id && id.toString().length > 3))].map(id => typeof id === 'string' ? id.trim().toUpperCase() : id);
    }, [masterCode, localPhone, intlPhone, masterPhoneRaw, masterUid]);

    const masterId = masterCode || localPhone || masterUid;

    const fetchData = async () => {
        if (!masterId || allMasterIds.length === 0) return;
        setLoading(true);
        try {
            // Fetch Agents
            const agentsRef = collection(db, 'agents');
            const q = query(agentsRef, where('masterAgentId', '==', masterId));
            const snap = await getDocs(q);
            const agentsList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAgents(agentsList);

            // Fetch Aggregated Signups
            const now = new Date();
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const startOfYesterday = new Date(startOfToday);
            startOfYesterday.setDate(startOfYesterday.getDate() - 1);

            const logsRef = collection(db, 'recruitment_logs');
            const todayQuery = query(
                logsRef,
                where('masterAgentId', 'in', allMasterIds),
                where('timestamp', '>=', Timestamp.fromDate(startOfToday))
            );
            const yesterdayQuery = query(
                logsRef,
                where('masterAgentId', 'in', allMasterIds),
                where('timestamp', '>=', Timestamp.fromDate(startOfYesterday)),
                where('timestamp', '<', Timestamp.fromDate(startOfToday))
            );

            const [todaySnap, yesterdaySnap] = await Promise.all([
                getDocs(todayQuery),
                getDocs(yesterdayQuery)
            ]);

            setStats({
                totalAgents: snap.size,
                signupsToday: todaySnap.size,
                signupsYesterday: yesterdaySnap.size
            });

        } catch (error) {
            console.error("Error fetching master data:", error);
            toast.error("Failed to load dashboard data: " + (error.message || "Unknown error"));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (allMasterIds.length === 0) return;
        
        // Initial fetch
        fetchData();

        // Real-time update on new registrations
        console.log("📡 [useMasterData] Initializing real-time listener for network signups...");
        const logsRef = collection(db, 'recruitment_logs');
        const q = query(
            logsRef, 
            where('masterAgentId', 'in', allMasterIds), 
            orderBy('timestamp', 'desc'), 
            limit(1)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                console.log("✨ [useMasterData] New registration in network detected! Refreshing stats...");
                fetchData();
            }
        });

        return () => unsubscribe();
    }, [masterId, allMasterIds.join(',')]);

    const calculateNextAgentCode = (existingAgents) => {
        if (!existingAgents || existingAgents.length === 0) {
            return `${generateAgentPrefix()}001`;
        }

        const sequentialCodes = existingAgents
            .map(a => a.agentCode || "")
            .filter(code => /^[A-Z]{2}\d{3,}/.test(code))
            .sort();

        if (sequentialCodes.length === 0) {
            return `${generateAgentPrefix()}001`;
        }

        const lastCode = sequentialCodes[sequentialCodes.length - 1];
        const prefix = lastCode.substring(0, 2);
        const number = parseInt(lastCode.substring(2));
        
        const nextNumber = (number + 1).toString().padStart(3, '0');
        return `${prefix}${nextNumber}`;
    };

    const openAddModal = () => {
        const nextCode = calculateNextAgentCode(agents);
        setNewAgent(prev => ({ ...prev, agentCode: nextCode }));
        setShowAddModal(true);
    };

    const handleAddAgent = async (e) => {
        if (e) e.preventDefault();
        if (!newAgent.agentCode) return;

        try {
            const formattedPhone = formatKenyanPhone(newAgent.phoneNumber);
            const agentRef = doc(db, 'agents', newAgent.agentCode.toUpperCase());
            await setDoc(agentRef, {
                ...newAgent,
                phoneNumber: formattedPhone,
                agentCode: newAgent.agentCode.toUpperCase(),
                masterAgentId: masterId,
                tariffRate: 15,
                nationalId: newAgent.nationalId,
                totalSignups: 0,
                status: 'active',
                createdAt: serverTimestamp()
            });

            const userRef = doc(db, 'users', formattedPhone);
            await setDoc(userRef, {
                fullName: newAgent.fullName,
                phoneNumber: formattedPhone,
                role: 'agent',
                agent_code: newAgent.agentCode.toUpperCase(),
                nationalId: newAgent.nationalId,
                status: 'active',
                registration_fee_paid: true,
                profile_completed: true
            }, { merge: true });

            toast.success("Agent registered successfully!");
            setShowAddModal(false);
            setNewAgent({ fullName: '', phoneNumber: '', nationalId: '', region: '', agentCode: '' });
            fetchData();
        } catch (error) {
            console.error("Error adding agent:", error);
            toast.error("Failed to register agent.");
        }
    };

    const handleUpdateAgent = async (e) => {
        if (e) e.preventDefault();
        try {
            const agentRef = doc(db, 'agents', editingAgent.id);
            const updateData = {
                fullName: editingAgent.fullName,
                nationalId: editingAgent.nationalId || '',
                region: editingAgent.region,
                status: editingAgent.status || 'active'
            };

            await updateDoc(agentRef, updateData);

            const userRef = doc(db, 'users', editingAgent.phoneNumber);
            await updateDoc(userRef, {
                fullName: editingAgent.fullName,
                status: editingAgent.status || 'active'
            });

            toast.success("Agent updated!");
            fetchData();
            setEditingAgent(null);
        } catch (error) {
            console.error("Error updating agent:", error);
            toast.error("Failed to update agent.");
        }
    };

    const handleDeleteAgent = async (id, phoneNumber) => {
        if (!window.confirm("Are you sure you want to remove this Agent? They will lose recruitment access.")) return;

        try {
            await deleteDoc(doc(db, 'agents', id));

            await updateDoc(doc(db, 'users', phoneNumber), {
                role: 'user',
                status: 'inactive'
            });

            toast.success("Agent removed.");
            fetchData();
        } catch (error) {
            console.error("Error deleting agent:", error);
            toast.error("Failed to remove agent.");
        }
    };

    return {
        profile,
        agents,
        loading,
        stats,
        showAddModal,
        setShowAddModal,
        editingAgent,
        setEditingAgent,
        newAgent,
        setNewAgent,
        openAddModal,
        handleAddAgent,
        handleUpdateAgent,
        handleDeleteAgent,
        impersonate,
        fetchData
    };
};
