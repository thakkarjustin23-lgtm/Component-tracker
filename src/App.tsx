import { useState, useEffect } from "react";
import { Component, Checkout, LogEntry } from "./types";
import InventoryTab from "./components/InventoryTab";
import CheckoutTab from "./components/CheckoutTab";
import StudentDashboard from "./components/StudentDashboard";
import ActivityLogTab from "./components/ActivityLogTab";
import EmailDraftModal from "./components/EmailDraftModal";
import { 
  motion, 
  AnimatePresence 
} from "motion/react";
import { 
  Wrench, 
  Cpu, 
  Clock, 
  AlertTriangle, 
  Terminal, 
  ListOrdered, 
  SlidersHorizontal,
  ChevronRight,
  Sparkles,
  Award,
  Users2,
  Lock,
  ArrowRightLeft,
  Settings
} from "lucide-react";

export default function App() {
  const [role, setRole] = useState<"teacher" | "student">("teacher");
  const [activeTab, setActiveTab] = useState<"overview" | "inventory" | "checkouts" | "logs">("overview");

  // Data State
  const [components, setComponents] = useState<Component[]>([]);
  const [checkouts, setCheckouts] = useState<Checkout[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [activeCheckoutForDraft, setActiveCheckoutForDraft] = useState<Checkout | null>(null);

  // Fetch initial database states
  const fetchData = async () => {
    try {
      const res = await fetch("/api/data");
      if (res.ok) {
        const db = await res.json();
        setComponents(db.components || []);
        setCheckouts(db.checkouts || []);
        setLogs(db.logs || []);
      }
    } catch (err) {
      console.error("Database fetch failed", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Compute stats metrics
  const activeLoans = checkouts.filter(c => c.returnedDate === null);
  const overdueLoans = activeLoans.filter(c => c.status === "overdue");
  const itemsCheckedOutCount = activeLoans.reduce((sum, c) => sum + c.quantity, 0);
  
  // Total inventory units summary
  const totalLabMaterials = components.reduce((sum, c) => sum + c.totalStock, 0);
  const partsAlertCount = components.filter(c => c.condition === "Needs Attention").length;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-yellow-500 selection:text-zinc-950">
      
      {/* Top Navigation Terminal Bar */}
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-30 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-yellow-500 text-zinc-950 p-2 rounded-lg font-black shadow-lg shadow-yellow-500/10">
            <Wrench className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-tight text-white font-mono uppercase">Lincoln High Robotics</h1>
              <span className="bg-zinc-900 text-zinc-500 text-[9px] px-1.5 py-0.5 rounded font-mono border border-zinc-805/40">v2.1-Lab</span>
            </div>
            <p className="text-[10px] text-zinc-500">Autonomous Hardware Inventory & Lending Ledger</p>
          </div>
        </div>

        {/* Portal Role Toggler */}
        <div className="flex items-center gap-1.5 bg-zinc-900 p-1 border border-zinc-850 rounded-lg">
          <button
            onClick={() => {
              setRole("teacher");
              setActiveTab("overview");
            }}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all ${
              role === "teacher" 
                ? "bg-yellow-500 text-zinc-950 shadow-md shadow-yellow-500/5 font-bold" 
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Lock className="w-3.5 h-3.5" /> Instructor Desk
          </button>
          <button
            onClick={() => setRole("student")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all ${
              role === "student" 
                ? "bg-yellow-500 text-zinc-950 shadow-md shadow-yellow-500/5 font-bold" 
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Users2 className="w-3.5 h-3.5" /> Student Terminal
          </button>
        </div>
      </header>

      {/* Main body canvas */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        
        {loading ? (
          <div className="h-96 flex flex-col items-center justify-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
            <span className="text-xs text-zinc-500 font-mono">Syncing database registers...</span>
          </div>
        ) : role === "student" ? (
          // Student Dashboard View
          <StudentDashboard checkouts={checkouts} components={components} />
        ) : (
          // Teacher Workspace Navigation Workspace
          <div className="space-y-6">
            
            {/* Tab layout selector */}
            <div className="flex border-b border-zinc-900 overflow-x-auto gap-6 text-[13px]">
              <button
                onClick={() => setActiveTab("overview")}
                className={`py-3 px-1 border-b-2 transition-all font-semibold ${
                  activeTab === "overview" 
                    ? "border-yellow-500 text-white font-bold" 
                    : "border-transparent text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Overview Dashboard
              </button>
              <button
                onClick={() => setActiveTab("inventory")}
                className={`py-3 px-1 border-b-2 transition-all font-semibold ${
                  activeTab === "inventory" 
                    ? "border-yellow-500 text-white font-bold" 
                    : "border-transparent text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Inventory Catalog ({components.length})
              </button>
              <button
                onClick={() => setActiveTab("checkouts")}
                className={`py-3 px-1 border-b-2 transition-all font-semibold ${
                  activeTab === "checkouts" 
                    ? "border-yellow-500 text-white font-bold" 
                    : "border-transparent text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Lending & Returns ({activeLoans.length} active)
              </button>
              <button
                onClick={() => setActiveTab("logs")}
                className={`py-3 px-1 border-b-2 transition-all font-semibold ${
                  activeTab === "logs" 
                    ? "border-yellow-500 text-white font-bold" 
                    : "border-transparent text-zinc-400 hover:text-zinc-200"
                }`}
              >
                System Audit Logs
              </button>
            </div>

            {/* Tab Views routers */}
            <div>
              {activeTab === "overview" && (
                <div className="space-y-6">
                  {/* Stats Bento Grid Row */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    
                    {/* Active borrowing */}
                    <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Active Loans</span>
                        <ArrowRightLeft className="w-4 h-4 text-blue-400" />
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-2xl font-extrabold text-white font-mono">{activeLoans.length}</div>
                        <p className="text-[10px] text-zinc-500">{itemsCheckedOutCount} individual parts loaned</p>
                      </div>
                    </div>

                    {/* Highly Outstanding / Overdue */}
                    <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Overdue Items</span>
                        <AlertTriangle className={`w-4 h-4 ${overdueLoans.length > 0 ? "text-red-500 animate-pulse" : "text-zinc-650"}`} />
                      </div>
                      <div className="space-y-0.5">
                        <div className={`text-2xl font-extrabold font-mono ${overdueLoans.length > 0 ? "text-red-500" : "text-white"}`}>
                          {overdueLoans.length}
                        </div>
                        <p className="text-[10px] text-zinc-500">Requires teacher alert followups</p>
                      </div>
                    </div>

                    {/* Total unique components */}
                    <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Total Cataloged</span>
                        <Cpu className="w-4 h-4 text-yellow-500" />
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-2xl font-extrabold text-white font-mono">{components.length}</div>
                        <p className="text-[10px] text-zinc-500">{totalLabMaterials} aggregate unit copies</p>
                      </div>
                    </div>

                    {/* Damaged / Needs Attention */}
                    <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Wear & Maintenance</span>
                        <Clock className="w-4 h-4 text-purple-400" />
                      </div>
                      <div className="space-y-0.5">
                        <div className={`text-2xl font-extrabold font-mono ${partsAlertCount > 0 ? "text-purple-400" : "text-white"}`}>
                          {partsAlertCount}
                        </div>
                        <p className="text-[10px] text-zinc-500">Parts marked 'Needs Attention'</p>
                      </div>
                    </div>

                  </div>

                  {/* Dual Grid Main Layout Overview */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* Left 2 cols: Overdue Alerts Needed */}
                    <div className="lg:col-span-2 space-y-4">
                      <div className="flex justify-between items-center px-1">
                        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Terminal className="w-3.5 h-3.5 text-red-500" /> Action Required: Overdue Returns Management
                        </h4>
                        <span className="text-[10px] text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded font-mono border border-zinc-800/40">AI Warning Drafter enabled</span>
                      </div>

                      {overdueLoans.length === 0 ? (
                        <div className="p-8 border border-zinc-850 bg-zinc-900/10 rounded-xl text-center space-y-2 text-xs">
                          <Award className="w-7 h-7 text-emerald-400 mx-auto" />
                          <p className="text-zinc-300 font-medium">All student projects running on schedule!</p>
                          <p className="text-zinc-500">No overdue deadlines detected across any current checked out materials.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {overdueLoans.map(loan => {
                            const today = new Date().toISOString().split("T")[0];
                            const msDiff = new Date(today).getTime() - new Date(loan.dueDate).getTime();
                            const daysLate = Math.max(0, Math.floor(msDiff / (1000 * 60 * 60 * 24)));

                            return (
                              <div 
                                key={loan.id}
                                className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-zinc-700 transition"
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-white">{loan.studentName}</span>
                                    <span className="bg-red-500/10 text-red-400 font-mono text-[9px] px-1.5 py-0.5 rounded uppercase font-semibold">
                                      {daysLate} Days Late
                                    </span>
                                  </div>
                                  <div className="text-xs text-zinc-400">
                                    Borrowed: <strong className="text-zinc-200">{loan.quantity}x {loan.componentName}</strong> (Due: {loan.dueDate})
                                  </div>
                                  <div className="text-[10px] text-zinc-500 font-mono">
                                    Student Contact: <b className="text-zinc-400">{loan.studentEmail}</b>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2.5 shrink-0 w-full md:w-auto justify-end">
                                  <div className="text-[10px] text-zinc-500 mr-2 text-right">
                                    Alerts pings: <span className="font-semibold text-zinc-300">{loan.alertsSent}</span>
                                  </div>
                                  <button
                                    onClick={() => setActiveCheckoutForDraft(loan)}
                                    className="bg-yellow-500 text-zinc-950 hover:bg-yellow-400 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer shrink-0"
                                  >
                                    <Sparkles className="w-3.5 h-3.5 stroke-[2.2]" /> Draft warningalert
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Right 1 col: Cabinet Out of Stock lists */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider px-1">
                        Critical Lab Status Indicators
                      </h4>

                      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4">
                        <div>
                          <span className="text-[10px] text-zinc-500 font-semibold block uppercase tracking-wider">Out of Stock Parts</span>
                          <div className="mt-2 space-y-2">
                            {components.filter(c => c.availableStock === 0).length === 0 ? (
                              <p className="text-xs text-zinc-500">All catalog parts have healthy checkout volumes.</p>
                            ) : (
                              components.filter(c => c.availableStock === 0).map(c => (
                                <div key={c.id} className="flex justify-between items-center text-xs text-zinc-300 bg-zinc-950 p-2 rounded-lg border border-zinc-850">
                                  <span className="font-medium text-white truncate max-w-[120px]">{c.name}</span>
                                  <span className="text-[10px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded font-mono">ALL CHECKED OUT</span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        <div className="pt-3 border-t border-zinc-800/60">
                          <span className="text-[10px] text-zinc-500 font-semibold block uppercase tracking-wider">Maintenance Reports</span>
                          <div className="mt-2 space-y-2">
                            {components.filter(c => c.condition === "Needs Attention").length === 0 ? (
                              <p className="text-xs text-zinc-500">Every catalog resource maintains fully calibrated limits.</p>
                            ) : (
                              components.filter(c => c.condition === "Needs Attention").map(c => (
                                <div key={c.id} className="flex justify-between items-center text-xs text-zinc-300 bg-zinc-950 p-2 rounded-lg border border-zinc-850">
                                  <span className="font-medium text-white truncate max-w-[120px]">{c.name}</span>
                                  <span className="text-[10px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded font-mono">WEAR DETECTED</span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {activeTab === "inventory" && (
                <InventoryTab components={components} onRefresh={fetchData} />
              )}

              {activeTab === "checkouts" && (
                <CheckoutTab 
                  checkouts={checkouts} 
                  components={components} 
                  onRefresh={fetchData} 
                  onOpenDraftPanel={(loan) => setActiveCheckoutForDraft(loan)}
                />
              )}

              {activeTab === "logs" && (
                <ActivityLogTab logs={logs} />
              )}
            </div>

          </div>
        )}

      </main>

      {/* AI Draft modal renderer */}
      <AnimatePresence>
        {activeCheckoutForDraft && (
          <EmailDraftModal 
            checkout={activeCheckoutForDraft}
            onClose={() => setActiveCheckoutForDraft(null)}
            onSent={fetchData}
          />
        )}
      </AnimatePresence>

      {/* Footer copyright */}
      <footer className="border-t border-zinc-900 mt-auto py-6 text-center text-xs text-zinc-650 bg-zinc-950">
        <p>Copyright © 2026 Lincoln High Engineering. All rights reserved. Persistent tracking active.</p>
      </footer>
    </div>
  );
}
