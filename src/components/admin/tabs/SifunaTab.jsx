import React from 'react';
import { Bot, Sparkles, XCircle } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../services/firebase';

const SifunaTab = ({ kbItems, newKb, setNewKb, handleAddKb, handleDeleteKb, handleAutoGenerateKb, isGenerating, toast }) => {
    return (
        <div className="space-y-6">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-black flex items-center gap-2 mb-1">
                        <Bot className="w-5 h-5 text-orange-500" />
                        Global Chatbot Status
                    </h3>
                    <p className="text-xs text-slate-500">Enable or disable Sifuna across the entire platform.</p>
                </div>
                <button
                    onClick={async () => {
                        try {
                            const docRef = doc(db, 'config', 'sifuna');
                            const docSnap = await getDoc(docRef);
                            const currentStatus = docSnap.exists() ? docSnap.data().isActive : true; 
                            await setDoc(docRef, { isActive: !currentStatus }, { merge: true });
                            toast.success(!currentStatus ? "Sifuna Activated!" : "Sifuna Deactivated!");
                        } catch (e) {
                            toast.error("Failed to update status");
                        }
                    }}
                    className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest border border-slate-200 hover:bg-slate-50 transition-all active:scale-95"
                >
                    Toggle Status
                </button>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-black flex items-center gap-2">
                        <Bot className="w-6 h-6 text-orange-500" />
                        Teach Sifuna
                    </h3>
                    <button
                        onClick={handleAutoGenerateKb}
                        disabled={isGenerating}
                        className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-2xl text-xs font-black shadow-lg shadow-orange-200 hover:shadow-orange-300 transition-all active:scale-95 disabled:opacity-60"
                    >
                        <Sparkles className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
                        {isGenerating ? 'Generating...' : 'AI Auto-Generate'}
                    </button>
                </div>
                <form onSubmit={handleAddKb} className="space-y-4">
                    <div>
                        <label className="text-[10px] font-bold uppercase text-slate-400 ml-1 tracking-widest">Example Question (English)</label>
                        <input
                            type="text"
                            className="w-full bg-slate-50 p-4 rounded-2xl border-none focus:ring-2 focus:ring-orange-500 font-bold"
                            placeholder="How do I withdraw?"
                            value={newKb.question}
                            onChange={e => setNewKb({ ...newKb, question: e.target.value })}
                            required
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold uppercase text-slate-400 ml-1 tracking-widest">Auto-Response (English)</label>
                        <textarea
                            className="w-full bg-slate-50 p-4 rounded-2xl border-none focus:ring-2 focus:ring-orange-500 h-32 font-medium"
                            placeholder="Hazina is a social shield, not a bank. Funds are strictly for crisis coverage..."
                            value={newKb.answer}
                            onChange={e => setNewKb({ ...newKb, answer: e.target.value })}
                            required
                        />
                    </div>
                    <button type="submit" className="w-full py-4 bg-orange-500 text-white font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-orange-200 transition-all active:scale-[0.98]">
                        Add Training Item
                    </button>
                </form>
            </div>

            <div className="space-y-3">
                <h4 className="text-[10px] font-black uppercase text-slate-400 ml-4 tracking-widest">Knowledge Base ({kbItems.length})</h4>
                {kbItems.map(item => (
                    <div key={item.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 group">
                        <div className="flex justify-between items-start">
                            <div className="flex-1 pr-4">
                                <p className="font-bold text-slate-900 mb-1 leading-tight">Q: {item.question}</p>
                                <p className="text-sm text-slate-600 line-clamp-2 italic">A: {item.answer}</p>
                            </div>
                            <button
                                onClick={() => handleDeleteKb(item.id)}
                                className="p-2 text-slate-200 hover:text-red-500 transition-colors"
                            >
                                <XCircle className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SifunaTab;
