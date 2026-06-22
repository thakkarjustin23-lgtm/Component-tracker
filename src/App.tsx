import React, { useState, useEffect } from "react";
import { Component, Checkout, LogEntry } from "./types";
import InventoryTab from "./components/InventoryTab";
import CheckoutTab from "./components/CheckoutTab";
import StudentDashboard from "./components/StudentDashboard";
import ActivityLogTab from "./components/ActivityLogTab";
import EmailDraftModal from "./components/EmailDraftModal";
import ProcurementTab from "./components/ProcurementTab";
import { motion, AnimatePresence } from "motion/react";
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
  Settings,
  HelpCircle,
  LogOut,
  ChevronLeft,
  Grid,
  ShieldCheck,
  Building
} from "lucide-react";

const GUIDE_STEPS = [
  {
    title: "Welcome, Lead Instructor! 🚀",
    description: "Your digital Robotics Lab workspace is active! Easily catalog high-value microcontrollers, sensors, actuators, frame hardware, and workshop tools in secure cabinet bins.",
    image: "🤖"
  },
  {
    title: "Eco-Lending & Auto Student PINs",
    description: "No more paper sign-out sheets. Recording a checkout automatically generates a unique Student Access Code (e.g., STU-ALEX-18) and PIN Passkey, allowing them to track active deadlines independently.",
    image: "🔑"
  },
  {
    title: "Dynamic Notification Warnings",
    description: "When items are late, toggle friendly, firm, or parent-coping alert tones. The integrated AI assistant drafts context-aware emails referencing sensor calibrations and code libraries.",
    image: "📧"
  },
  {
    title: "AI Invoices & Vendor Comparison",
    description: "Speed up bookkeeping! Paste random receipt text or shipping manifests, and Gemini will automatically catalog categories, quantities, and cabinets. Plus, verify online stock rates instantly.",
    image: "⚡"
  }
];

export default function App() {
  const [role, setRole] = useState<"teacher" | "student">("teacher");
  const [activeTab, setActiveTab] = useState<"overview" | "inventory" | "checkouts" | "logs" | "procurement">("overview");

  // Multi-school Auth Profile
  const [activeSchool, setActiveSchool] = useState<{ id: string; name: string; firstLogin: boolean } | null>(() => {
    const saved = localStorage.getItem("active_school");
    return saved ? JSON.parse(saved) : null;
  });

  // Auth form states
  const [authTab, setAuthTab] = useState<"login" | "register">("login");
  const [schoolIdInput, setSchoolIdInput] = useState("");
  const [schoolNameInput, setSchoolNameInput] = useState("");
  const [schoolPasskeyInput, setSchoolPasskeyInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Walkthrough Guide states
  const [showGuide, setShowGuide] = useState(false);
  const [guideStep, setGuideStep] = useState(0);

  // Data State
  const [components, setComponents] = useState<Component[]>([]);
  const [checkouts, setCheckouts] = useState<Checkout[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [activeCheckoutForDraft, setActiveCheckoutForDraft] = useState<Checkout | null>(null);

  // Fetch registers scoped to authenticated school
  const fetchData = async () => {
    if (!activeSchool && role === "teacher") {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const scopeId = activeSchool?.id || "LINCOLN";
      const res = await fetch("/api/data", {
        headers: {
          "X-School-Id": scopeId
        }
      });
      if (res.ok) {
        const db = await res.json();
        setComponents(db.components || []);
        setCheckouts(db.checkouts || []);
        setLogs(db.logs || []);

        // Sync firstLogin state if changed
        if (db.school && activeSchool) {
          if (db.school.firstLogin !== activeSchool.firstLogin) {
            const updated = { ...activeSchool, firstLogin: db.school.firstLogin };
            setActiveSchool(updated);
            localStorage.setItem("active_school", JSON.stringify(updated));
            if (db.school.firstLogin) {
              setShowGuide(true);
              setGuideStep(0);
            }
          }
        }
      }
    } catch (err) {
      console.error("Database fetch failed", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeSchool, role]);

  // Handle Onboarding Walkthrough dismissal
  useEffect(() => {
    if (activeSchool?.firstLogin) {
      setShowGuide(true);
      setGuideStep(0);
    }
  }, [activeSchool]);

  const handleDismissGuide = async () => {
    if (!activeSchool) return;
    try {
      const res = await fetch("/api/auth/school/dismiss-guide", {
        method: "POST",
        headers: {
          "X-School-Id": activeSchool.id
        }
      });
      if (res.ok) {
        const updated = { ...activeSchool, firstLogin: false };
        setActiveSchool(updated);
        localStorage.setItem("active_school", JSON.stringify(updated));
      }
    } catch (err) {
      console.error("Failed to dismiss guide", err);
    } finally {
      setShowGuide(false);
    }
  };

  // School Login
  const handleSchoolLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolIdInput.trim() || !schoolPasskeyInput.trim()) {
      setAuthError("All credentials are required.");
      return;
    }

    setAuthLoading(true);
    setAuthError("");

    try {
      const res = await fetch("/api/auth/school/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: schoolIdInput.toUpperCase(), passkey: schoolPasskeyInput })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Login credentials rejected.");
      }

      const schoolProfile = {
        id: data.school.id,
        name: data.school.name,
        firstLogin: data.school.firstLogin
      };

      setActiveSchool(schoolProfile);
      localStorage.setItem("active_school", JSON.stringify(schoolProfile));
      
      // Reset form variables
      setSchoolIdInput("");
      setSchoolPasskeyInput("");
    } catch (err: any) {
      setAuthError(err.message || "Failed to log in.");
    } finally {
      setAuthLoading(false);
    }
  };

  // School Registration
  const handleSchoolRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolIdInput.trim() || !schoolNameInput.trim() || !schoolPasskeyInput.trim()) {
      setAuthError("All registration fields are required.");
      return;
    }

    setAuthLoading(true);
    setAuthError("");

    try {
      const res = await fetch("/api/auth/school/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: schoolIdInput.toUpperCase(),
          name: schoolNameInput,
          passkey: schoolPasskeyInput
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Register rejected.");
      }

      const schoolProfile = {
        id: data.school.id,
        name: data.school.name,
        firstLogin: true // Registration always triggers startup guide
      };

      setActiveSchool(schoolProfile);
      localStorage.setItem("active_school", JSON.stringify(schoolProfile));
      
      // Reset form fields
      setSchoolIdInput("");
      setSchoolNameInput("");
      setSchoolPasskeyInput("");
    } catch (err: any) {
      setAuthError(err.message || "Failed to register new school profile.");
    } finally {
      setAuthLoading(false);
    }
  };

  // Demo Login bypass helper
  const handleFastTrackDemo = async () => {
    setAuthLoading(true);
    setAuthError("");
    try {
      const res = await fetch("/api/auth/school/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "LINCOLN", passkey: "robotics" })
      });
      const data = await res.json();
      if (res.ok) {
        const schoolProfile = {
          id: data.school.id,
          name: data.school.name,
          firstLogin: false // Demo high school starts with custom seeds prefilled
        };
        setActiveSchool(schoolProfile);
        localStorage.setItem("active_school", JSON.stringify(schoolProfile));
      } else {
        throw new Error();
      }
    } catch {
      // Offline fallback bypass so preview never hangs
      const schoolProfile = { id: "LINCOLN", name: "Lincoln High School", firstLogin: false };
      setActiveSchool(schoolProfile);
      localStorage.setItem("active_school", JSON.stringify(schoolProfile));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogoutSchool = () => {
    if (window.confirm("Log out from current School lab administration session?")) {
      setActiveSchool(null);
      localStorage.removeItem("active_school");
      setComponents([]);
      setCheckouts([]);
      setLogs([]);
    }
  };

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
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-30 px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-yellow-500 text-zinc-950 p-2 rounded-lg font-black shadow-lg shadow-yellow-500/10">
            <Wrench className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-tight text-white font-mono uppercase">
                {activeSchool ? activeSchool.name : "Robotics Engineering Lab"}
              </h1>
              <span className="bg-zinc-900 text-zinc-500 text-[9px] px-1.5 py-0.5 rounded font-mono border border-zinc-805/40">v2.5-Auth</span>
            </div>
            <p className="text-[10px] text-zinc-500">
              {activeSchool ? `School Code ID: ${activeSchool.id} • Registered Ledger Space` : "Autonomous Hardware Inventory & Lending Ledger"}
            </p>
          </div>
        </div>

        {/* Portal Role Toggler & Logout */}
        <div className="flex items-center gap-2">
          {activeSchool && role === "teacher" && (
            <button
              onClick={handleLogoutSchool}
              className="text-zinc-500 hover:text-red-400 p-1.5 rounded-lg border border-zinc-900 hover:border-red-500/20 bg-zinc-950 transition cursor-pointer"
              title="Logout from school"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}

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
        </div>
      </header>

      {/* Main body canvas */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        
        {loading ? (
          <div className="h-96 flex flex-col items-center justify-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
            <span className="text-xs text-zinc-500 font-mono">Syncing school database registers...</span>
          </div>
        ) : role === "student" ? (
          // Student Dashboard View (authenticated with studentCode)
          <StudentDashboard checkouts={checkouts} components={components} />
        ) : !activeSchool ? (
          // Teacher Authentication Page
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 items-center py-6">
            
            {/* Explanatory Panel */}
            <div className="md:col-span-6 space-y-6">
              <div className="inline-flex bg-zinc-900 border border-zinc-850 rounded-full px-3 py-1 items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-yellow-500" />
                <span className="text-[10px] text-zinc-400 font-semibold font-mono tracking-wide uppercase">Multi-School Support Sandbox</span>
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-black text-white tracking-tight leading-none uppercase font-mono">
                  Robotics Cabinet Ledger Space
                </h2>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Avoid inventory loss and coordinate hardware returns. Register a unique space for your school laboratory, or launch our simulated sandbox with pre-filled items.
                </p>
              </div>

              <div className="space-y-4 border-t border-zinc-900 pt-6">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-zinc-900 border border-zinc-850 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-4 h-4 text-yellow-500" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Isolated Data Workspace</h4>
                    <p className="text-[11px] text-zinc-500 leading-normal">
                      Every high school has a dedicated identifier. Your components, loans, codes, and log transactions remain completely private.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-zinc-900 border border-zinc-850 flex items-center justify-center shrink-0">
                    <Cpu className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Automated Student Passkeys</h4>
                    <p className="text-[11px] text-zinc-500 leading-normal">
                      Register first checkouts; the backend automatically spawns credential packets for students to log into their customized portfolios.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Form login card */}
            <div className="md:col-span-6 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-5">
              <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-850">
                <button
                  onClick={() => { setAuthTab("login"); setAuthError(""); }}
                  className={`flex-1 text-center py-2 rounded-md text-xs font-bold cursor-pointer transition-all ${
                    authTab === "login" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  School Login
                </button>
                <button
                  onClick={() => { setAuthTab("register"); setAuthError(""); }}
                  className={`flex-1 text-center py-2 rounded-md text-xs font-bold cursor-pointer transition-all ${
                    authTab === "register" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  Register School
                </button>
              </div>

              {authError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-center gap-1.5 font-mono">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <form onSubmit={authTab === "login" ? handleSchoolLogin : handleSchoolRegister} className="space-y-4 text-left">
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">School ID / Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. LINCOLN, EASTSIDE, MIT"
                    value={schoolIdInput}
                    onChange={(e) => setSchoolIdInput(e.target.value.toUpperCase())}
                    className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-4 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-yellow-500/30 transition placeholder:text-zinc-750"
                  />
                </div>

                {authTab === "register" && (
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Formal School Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Lincoln High School"
                      value={schoolNameInput}
                      onChange={(e) => setSchoolNameInput(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-yellow-500/30 transition placeholder:text-zinc-750"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Access Passkey PIN</label>
                  <input
                    type="password"
                    required
                    placeholder="Enter school passkey code"
                    value={schoolPasskeyInput}
                    onChange={(e) => setSchoolPasskeyInput(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-yellow-500/30 transition placeholder:text-zinc-750"
                  />
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full bg-yellow-500 hover:bg-yellow-400 text-zinc-950 font-bold py-2.5 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1"
                >
                  {authLoading ? "Initializing security handshake..." : authTab === "login" ? "Authorize School Login" : "Initialize New School Workspace"}
                </button>
              </form>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-zinc-850"></div>
                <span className="flex-shrink mx-3 text-[10px] text-zinc-600 font-bold font-mono uppercase tracking-wider">Or Fast Track Demo</span>
                <div className="flex-grow border-t border-zinc-850"></div>
              </div>

              <button
                onClick={handleFastTrackDemo}
                className="w-full bg-zinc-950 hover:bg-zinc-850 text-zinc-300 font-bold py-2.5 rounded-xl text-xs transition border border-zinc-850 cursor-pointer flex items-center justify-center gap-1.5"
              >
                ⚡ Test Drive as Lincoln High School
              </button>
            </div>

          </div>
        ) : (
          // Teacher Active Workspace
          <div className="space-y-6">
            
            {/* Tab layout selector */}
            <div className="flex border-b border-zinc-900 overflow-x-auto gap-6 text-[13px]">
              <button
                onClick={() => setActiveTab("overview")}
                className={`py-3 px-1 border-b-2 transition-all font-semibold cursor-pointer ${
                  activeTab === "overview" 
                    ? "border-yellow-500 text-white font-bold" 
                    : "border-transparent text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Overview Dashboard
              </button>
              <button
                onClick={() => setActiveTab("inventory")}
                className={`py-3 px-1 border-b-2 transition-all font-semibold cursor-pointer ${
                  activeTab === "inventory" 
                    ? "border-yellow-500 text-white font-bold" 
                    : "border-transparent text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Inventory Catalog ({components.length})
              </button>
              <button
                onClick={() => setActiveTab("checkouts")}
                className={`py-3 px-1 border-b-2 transition-all font-semibold cursor-pointer ${
                  activeTab === "checkouts" 
                    ? "border-yellow-500 text-white font-bold" 
                    : "border-transparent text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Lending & Returns ({activeLoans.length} active)
              </button>
              <button
                onClick={() => setActiveTab("procurement")}
                className={`py-3 px-1 border-b-2 transition-all font-semibold cursor-pointer flex items-center gap-1 ${
                  activeTab === "procurement" 
                    ? "border-yellow-500 text-white font-bold" 
                    : "border-transparent text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-yellow-500 animate-pulse" /> Procurement & Bills
              </button>
              <button
                onClick={() => setActiveTab("logs")}
                className={`py-3 px-1 border-b-2 transition-all font-semibold cursor-pointer ${
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
                        <p className="text-[10px] text-zinc-500">Requires educator alert follow-ups</p>
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

                    {/* Wear & Maintenance */}
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
                        <span className="text-[10px] text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded font-mono border border-zinc-880/40">AI Warning Drafter enabled</span>
                      </div>

                      {overdueLoans.length === 0 ? (
                        <div className="p-8 border border-zinc-850 bg-zinc-900/10 rounded-xl text-center space-y-2 text-xs">
                          <Award className="w-7 h-7 text-emerald-400 mx-auto" />
                          <p className="text-zinc-300 font-medium">All student projects running on schedule!</p>
                          <p className="text-zinc-500 text-[11px]">No overdue deadlines detected across any current checked out materials.</p>
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
                                    Alert pings: <span className="font-semibold text-zinc-300">{loan.alertsSent}</span>
                                  </div>
                                  <button
                                    onClick={() => setActiveCheckoutForDraft(loan)}
                                    className="bg-yellow-500 text-zinc-950 hover:bg-yellow-400 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer shrink-0"
                                  >
                                    <Sparkles className="w-3.5 h-3.5 stroke-[2.2]" /> Draft alert email
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
                              <p className="text-xs text-zinc-500">All catalog parts have healthy availability.</p>
                            ) : (
                              components.filter(c => c.availableStock === 0).map(c => (
                                <div key={c.id} className="flex justify-between items-center text-xs text-zinc-300 bg-zinc-950 p-2 rounded-lg border border-zinc-850">
                                  <span className="font-medium text-white truncate max-w-[120px]">{c.name}</span>
                                  <span className="text-[10px] bg-red-400/10 text-red-400 px-1.5 py-0.5 rounded font-mono">ALL CHECKED OUT</span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        <div className="pt-3 border-t border-zinc-800/60">
                          <span className="text-[10px] text-zinc-500 font-semibold block uppercase tracking-wider">Maintenance Reports</span>
                          <div className="mt-2 space-y-2">
                            {components.filter(c => c.condition === "Needs Attention").length === 0 ? (
                              <p className="text-xs text-zinc-500">Every catalog resource maintains fully calibrated status.</p>
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
                <InventoryTab components={components} onRefresh={fetchData} schoolId={activeSchool.id} />
              )}

              {activeTab === "checkouts" && (
                <CheckoutTab 
                  checkouts={checkouts} 
                  components={components} 
                  onRefresh={fetchData} 
                  onOpenDraftPanel={(loan) => setActiveCheckoutForDraft(loan)}
                  schoolId={activeSchool.id}
                />
              )}

              {activeTab === "procurement" && (
                <ProcurementTab onRefresh={fetchData} schoolId={activeSchool.id} />
              )}

              {activeTab === "logs" && (
                <ActivityLogTab logs={logs} />
              )}
            </div>

          </div>
        )}

      </main>

      {/* Onboarding startup guide walk-through carousel */}
      <AnimatePresence>
        {showGuide && activeSchool && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl relative space-y-6 text-center"
            >
              {/* Skip button top right */}
              <button 
                onClick={handleDismissGuide}
                className="absolute top-4 right-4 text-zinc-500 hover:text-white text-xs font-mono transition cursor-pointer"
              >
                Skip Walkthrough
              </button>

              {/* Progress dots bar */}
              <div className="flex gap-1.5 justify-center pt-2">
                {GUIDE_STEPS.map((_, idx) => (
                  <div 
                    key={idx} 
                    className={`h-1.5 rounded-full transition-all ${guideStep === idx ? "w-6 bg-yellow-500" : "w-1.5 bg-zinc-800"}`}
                  />
                ))}
              </div>

              {/* Step Graphic illustration */}
              <div className="py-6 flex items-center justify-center">
                <div className="text-6xl select-none animate-bounce h-16 w-16 bg-zinc-950 rounded-2xl flex items-center justify-center border border-zinc-800 shadow-md">
                  {GUIDE_STEPS[guideStep].image}
                </div>
              </div>

              {/* Step info typography */}
              <div className="space-y-2">
                <h3 className="text-base font-bold text-white tracking-tight uppercase font-mono">
                  {GUIDE_STEPS[guideStep].title}
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed px-2">
                  {GUIDE_STEPS[guideStep].description}
                </p>
              </div>

              {/* Interaction buttons */}
              <div className="flex gap-3 justify-between items-center border-t border-zinc-850 pt-5">
                <button
                  disabled={guideStep === 0}
                  onClick={() => setGuideStep(prev => prev - 1)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800 transition disabled:opacity-30 cursor-pointer flex items-center"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> Prev
                </button>

                {guideStep < GUIDE_STEPS.length - 1 ? (
                  <button
                    onClick={() => setGuideStep(prev => prev + 1)}
                    className="bg-yellow-500 hover:bg-yellow-400 text-zinc-950 font-bold px-4 py-1.5 rounded-lg text-xs transition cursor-pointer flex items-center"
                  >
                    Next Step <ChevronRight className="w-4 h-4 ml-1" />
                  </button>
                ) : (
                  <button
                    onClick={handleDismissGuide}
                    className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold px-4 py-1.5 rounded-lg text-xs transition cursor-pointer flex items-center shadow-lg shadow-emerald-500/10"
                  >
                    Assemble Sandbox & Begin ✓
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* AI Draft email notification modal renderer */}
      <AnimatePresence>
        {activeCheckoutForDraft && activeSchool && (
          <EmailDraftModal 
            checkout={activeCheckoutForDraft}
            onClose={() => setActiveCheckoutForDraft(null)}
            onSent={fetchData}
            schoolId={activeSchool.id}
          />
        )}
      </AnimatePresence>

      {/* Footer copyright */}
      <footer className="border-t border-zinc-900 mt-auto py-6 text-center text-xs text-zinc-650 bg-zinc-950">
        <p>Copyright © 2026 {activeSchool ? activeSchool.name : "Lincoln High Engineering"}. All rights reserved. Autonomous persistence channels active.</p>
      </footer>
    </div>
  );
}
