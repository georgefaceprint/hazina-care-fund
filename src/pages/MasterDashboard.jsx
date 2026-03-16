import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, UserPlus } from 'lucide-react';

// Hooks
import { useMasterData } from '../hooks/useMasterData';

// Components
import MasterStats from '../components/master/MasterStats';
import AgentGrid from '../components/master/AgentGrid';
import AgentModals from '../components/master/AgentModals';

const MasterDashboard = () => {
    const navigate = useNavigate();
    const {
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
        impersonate
    } = useMasterData();

    return (
        <div className="space-y-8 max-w-6xl mx-auto">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <Briefcase className="w-8 h-8 text-brand-primary" />
                        Master Agent Console
                    </h1>
                    <p className="text-slate-500 font-medium">Recruitment management for {profile?.fullName}</p>
                </div>
                <button
                    onClick={openAddModal}
                    className="bg-brand-primary text-white px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center gap-2 hover:bg-brand-secondary transition-all shadow-xl shadow-brand-primary/20 active:scale-95"
                >
                    <UserPlus className="w-5 h-5" />
                    Expand Team
                </button>
            </header>

            {/* Stats Overview */}
            <MasterStats stats={stats} />

            {/* Agents List */}
            <AgentGrid 
                agents={agents}
                loading={loading}
                onAddFirst={openAddModal}
                impersonate={impersonate}
                navigate={navigate}
                setEditingAgent={setEditingAgent}
                handleDeleteAgent={handleDeleteAgent}
            />

            {/* Modals */}
            <AgentModals 
                showAddModal={showAddModal}
                setShowAddModal={setShowAddModal}
                editingAgent={editingAgent}
                setEditingAgent={setEditingAgent}
                newAgent={newAgent}
                setNewAgent={setNewAgent}
                handleAddAgent={handleAddAgent}
                handleUpdateAgent={handleUpdateAgent}
            />
        </div>
    );
};

export default MasterDashboard;
