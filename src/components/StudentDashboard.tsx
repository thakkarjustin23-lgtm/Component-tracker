import React, { useState, useEffect } from "react";
import { Checkout, Component, Student } from "../types";
import { 
  Search, 
  MapPin, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  BookOpen, 
  Calendar, 
  HelpCircle,
  KeyRound,
  UserCheck,
  LogOut,
  FolderLock
} from "lucide-react";
import { motion } from "motion/react";

interface StudentDashboardProps {
  checkouts: Checkout[];
  components: Component[];
}

export default function StudentDashboard({ checkouts, components }: StudentDashboardProps) {
  const [studentCode, setStudentCode] = useState("");
  const [passkey, setPasskey] = useState("");
  const [loggedInStudent, setLoggedInStudent] = useState<Student | null>(() => {
    const saved = localStorage.getItem("active_student");
    return saved ? JSON.parse(saved) : null;
  });
  const [error, setError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentCode.trim() || !passkey.trim()) return;

    setAuthLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/student/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: studentCode, passkey })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Login unauthorized. Check credentials.");
      }

      setLoggedInStudent(data.student);
      localStorage.setItem("active_student", JSON.stringify(data.student));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setLoggedInStudent(null);
    localStorage.removeItem("active_student");
    setStudentCode("");
    setPasskey("");
  };

  const getComponentLocation = (compId: string) => {
    const comp = components.find((c) => c.id === compId);
    return comp ? comp.location : "Cabinet Room Desk";
  };

  const getDaysDiff = (dateStr: string) => {
    const today = new Date().toISOString().split("T")[0];
    const msDiff = new Date(dateStr).getTime() - new Date(today).getTime();
    return Math.floor(msDiff / (1000 * 60 * 60 * 24));
  };

  // Filter checkouts specifically assigned to this logged-in student
  const studentLoans = loggedInStudent
    ? checkouts.filter(c => c.studentEmail.toLowerCase() === loggedInStudent.email.toLowerCase())
    : [];

  const activeLoans = studentLoans.filter((l) => l.returnedDate === null);
  const historicLoans = studentLoans.filter((l) => l.returnedDate !== null);

  // If not logged in, render the login card with test drive info
  if (!loggedInStudent) {
    return (
      <div className="max-w-md mx-auto space-y-6 py-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="text-center space-y-2">
            <div className="h-12 w-12 bg-yellow-500/10 text-yellow-500 rounded-xl flex items-center justify-center mx-auto border border-yellow-500/10">
              <KeyRound className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white tracking-tight">Student Terminal Access</h3>
            <p className="text-xs text-zinc-550">Enter your assigned secure student code and PIN received from class coordinator</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-[11px] text-red-400 font-medium">
                {error}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Student Code</label>
              <input
                type="text"
                required
                value={studentCode}
                onChange={(e) => setStudentCode(e.target.value)}
                placeholder="e.g. STU-LIN-8822"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2.5 px-3.5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-yellow-500/30 transition placeholder:text-zinc-700"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Passkey PIN</label>
              <input
                type="password"
                required
                value={passkey}
                onChange={(e) => setPasskey(e.target.value)}
                placeholder="4-digit PIN (e.g. 1234)"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2.5 px-3.5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-yellow-500/30 transition placeholder:text-zinc-700"
              />
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full bg-yellow-500 text-zinc-950 hover:bg-yellow-400 font-bold py-2.5 rounded-lg text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              {authLoading ? "Verifying passkeys..." : "Connect Terminal"}
            </button>
          </form>

          {/* Quick-setup credentials for test drive */}
          <div className="pt-4 border-t border-zinc-800/60 space-y-2">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Demo Student Accounts</span>
            <div className="p-3 bg-zinc-950/80 rounded-lg border border-zinc-850 space-y-1 text-[11px] font-mono">
              <div className="flex justify-between">
                <span className="text-zinc-500">Student Code:</span>
                <span className="text-yellow-500 font-semibold selection:bg-yellow-500">STU-8822</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Passkey PIN:</span>
                <span className="text-yellow-500 font-semibold selection:bg-yellow-500">1234</span>
              </div>
              <p className="text-[9px] text-zinc-650 mt-1.5 normal-case font-sans">
                💡 Teachers generate custom student accounts automatically when renting any structural component inside the "Lending" tab.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Student visual card */}
      <div className="bg-gradient-to-r from-yellow-500/10 via-zinc-900/40 to-zinc-900/20 p-6 border border-zinc-800 rounded-2xl relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="absolute right-6 top-6 opacity-5 select-none">
          <BookOpen className="w-24 h-24" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 bg-emerald-500/10 text-emerald-400 rounded-md flex items-center justify-center border border-emerald-500/10">
              <UserCheck className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-lg font-bold text-white tracking-tight">Welcome, {loggedInStudent.name}</h3>
          </div>
          <div className="text-[11px] font-mono text-zinc-400">
            Account: <span className="text-yellow-500">{loggedInStudent.code}</span> • {loggedInStudent.email}
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-700 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" /> Disconnect Terminal
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Active borrowing list */}
        <div className="space-y-4">
          <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest px-1">
            Active Borrowings ({activeLoans.length})
          </h4>
          
          {activeLoans.length === 0 ? (
            <div className="p-8 border border-dashed border-zinc-850 text-zinc-500 rounded-xl text-xs text-center bg-zinc-950/20 space-y-2">
              <CheckCircle className="w-6 h-6 text-emerald-500 mx-auto" />
              <p className="font-semibold text-zinc-300">No active assets checked out!</p>
              <p className="text-zinc-650 max-w-xs mx-auto text-[10px]">
                You have returned all class components. Visit the Coordinator desk if you need new modules.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeLoans.map((loan) => {
                const daysRemaining = getDaysDiff(loan.dueDate);
                const isLate = daysRemaining < 0;
                
                return (
                  <motion.div
                    key={loan.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-5 rounded-xl border flex flex-col justify-between ${
                      isLate 
                        ? "bg-red-500/5 border-red-500/20" 
                        : "bg-zinc-900 border-zinc-800/80 hover:border-zinc-700"
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[10px] text-zinc-500 font-mono block">PART LOANED</span>
                          <h4 className="text-sm font-bold text-white tracking-tight mt-0.5">{loan.componentName}</h4>
                          <p className="text-xs text-zinc-400 mt-1">Quantity: <strong className="text-zinc-200">{loan.quantity}</strong></p>
                        </div>

                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                          isLate 
                            ? "bg-red-500/10 text-red-500 animate-pulse" 
                            : "bg-blue-500/10 text-blue-400"
                        }`}>
                          {isLate ? "Overdue" : "In Deadline"}
                        </span>
                      </div>

                      {/* Return instructions */}
                      <div className="mt-4 bg-zinc-950/60 p-3 rounded-lg border border-zinc-850 flex items-start gap-2">
                        <MapPin className="w-3.5 h-3.5 text-yellow-500 shrink-0 mt-0.5" />
                        <div className="text-[11px] leading-relaxed text-zinc-400">
                          Return drawer: <b className="text-zinc-200">{getComponentLocation(loan.componentId)}</b>. Please clean-up your soldering shield and hand over to instruction desk.
                        </div>
                      </div>
                    </div>

                    {/* Returning status calculations */}
                    <div className="mt-5 pt-3.5 border-t border-zinc-800/60 flex items-center justify-between text-xs">
                      <span className="text-zinc-500 font-medium">Return Deadline</span>
                      <span className={`font-mono flex items-center gap-1.5 font-semibold ${isLate ? "text-red-400" : "text-yellow-500"}`}>
                        <Calendar className="w-3.5 h-3.5 inline" /> {loan.dueDate}{" "}
                        {isLate 
                          ? `(${Math.abs(daysRemaining)} days late)` 
                          : `(${daysRemaining} days left)`}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Historic borrowing logs */}
        <div className="space-y-4">
          <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest px-1">
            Historic Returns ({historicLoans.length})
          </h4>

          {historicLoans.length === 0 ? (
            <div className="p-8 border border-dashed border-zinc-850 text-zinc-500 rounded-xl text-xs text-center bg-zinc-950/20">
              <FolderLock className="w-6 h-6 text-zinc-700 mx-auto mb-2" />
              No historic return entries are logged.
            </div>
          ) : (
            <div className="space-y-3">
              {historicLoans.map((loan) => (
                <div
                  key={loan.id}
                  className="p-4 bg-zinc-900/40 border border-zinc-850 rounded-xl opacity-75 hover:opacity-100 transition-opacity flex justify-between items-center"
                >
                  <div className="space-y-0.5">
                    <h5 className="text-xs font-semibold text-zinc-200">{loan.componentName}</h5>
                    <p className="text-[10px] text-zinc-550">Quantity borrowing: {loan.quantity}</p>
                    <p className="text-[10px] text-zinc-500 font-mono">Returned: {loan.returnedDate}</p>
                  </div>
                  <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 border border-emerald-500/10 shrink-0">
                    <CheckCircle className="w-3 h-3" /> Returned
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Guidelines footer */}
      <div className="bg-zinc-900/30 p-6 border border-zinc-800 rounded-xl space-y-4">
        <h4 className="text-xs font-bold text-zinc-300 flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-yellow-500" /> Laboratory Return Conduct Rules
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-zinc-400">
          <div className="bg-zinc-950/50 p-3.5 rounded-lg border border-zinc-850/80">
            <span className="font-bold text-zinc-200 block mb-1">1. Restore Microcontroller State</span>
            Always flash a basic blink testing sketch onto developmental boards before return, clearing custom firmware.
          </div>
          <div className="bg-zinc-950/50 p-3.5 rounded-lg border border-zinc-850/80">
            <span className="font-bold text-zinc-200 block mb-1">2. Cabinet Sorting</span>
            Unscrew shields and slide the modules into the precise Cabinet Drawer listed on your dashboard checklist.
          </div>
          <div className="bg-zinc-950/50 p-3.5 rounded-lg border border-zinc-850/80">
            <span className="font-bold text-zinc-200 block mb-1">3. Avoid Late Penalties</span>
            Always ensure the instructor clicks return checkbox inside their terminal desk to clear automatic notification schedules.
          </div>
        </div>
      </div>
    </div>
  );
}

