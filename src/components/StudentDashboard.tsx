import React, { useState } from "react";
import { Checkout, Component } from "../types";
import { Search, MapPin, AlertTriangle, CheckCircle, Clock, BookOpen, Calendar, HelpCircle } from "lucide-react";
import { motion } from "motion/react";

interface StudentDashboardProps {
  checkouts: Checkout[];
  components: Component[];
}

export default function StudentDashboard({ checkouts, components }: StudentDashboardProps) {
  const [emailInput, setEmailInput] = useState("");
  const [searched, setSearched] = useState(false);
  const [studentLoans, setStudentLoans] = useState<Checkout[]>([]);

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;

    const filtered = checkouts.filter(
      (c) => c.studentEmail.toLowerCase().trim() === emailInput.toLowerCase().trim()
    );

    setStudentLoans(filtered);
    setSearched(true);
  };

  const getComponentLocation = (compId: string) => {
    const comp = components.find((c) => c.id === compId);
    return comp ? comp.location : "Uncoded Cabinet Drawer";
  };

  const getDaysDiff = (dateStr: string) => {
    const today = new Date().toISOString().split("T")[0];
    const msDiff = new Date(dateStr).getTime() - new Date(today).getTime();
    return Math.floor(msDiff / (1000 * 60 * 60 * 24));
  };

  const activeLoans = studentLoans.filter((l) => l.returnedDate === null);
  const historicLoans = studentLoans.filter((l) => l.returnedDate !== null);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Visual Header */}
      <div className="bg-gradient-to-r from-yellow-500/10 via-zinc-900/40 to-zinc-900/20 p-6 border border-zinc-800 rounded-xl relative overflow-hidden">
        <div className="absolute right-6 top-6 opacity-5 select-none">
          <BookOpen className="w-24 h-24" />
        </div>
        <div className="space-y-1">
          <h3 className="text-xl font-bold text-white tracking-tight">Student Equipment Terminal</h3>
          <p className="text-xs text-zinc-400">Search your current project checkouts, return rooms, and lab deadline status checks</p>
        </div>

        {/* Form Lookup */}
        <form onSubmit={handleLookup} className="mt-5 flex gap-2 max-w-md">
          <input
            type="email"
            required
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder="Enter school email (e.g. arivera.student@school.edu)"
            className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg py-2.5 px-4 text-xs font-mono text-zinc-200 focus:outline-none focus:border-yellow-500/30 transition-all placeholder:text-zinc-650"
          />
          <button
            type="submit"
            className="bg-yellow-500 text-zinc-900 hover:bg-yellow-400 shrink-0 font-bold px-4 py-2 text-xs rounded-lg transition-colors cursor-pointer"
          >
            Check Status
          </button>
        </form>
      </div>

      {/* Query Responses */}
      {searched ? (
        <div className="space-y-6">
          <div className="flex items-center gap-1.5 px-1 justify-between">
            <h4 className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">
              Loan catalog results: {studentLoans.length} entries for <span className="text-white normal-case font-mono">{emailInput}</span>
            </h4>
            <button
              onClick={() => {
                setSearched(false);
                setEmailInput("");
                setStudentLoans([]);
              }}
              className="text-[10px] text-zinc-500 hover:text-white transition-colors"
            >
              Clear Search
            </button>
          </div>

          {studentLoans.length === 0 ? (
            <div className="p-12 border border-zinc-850 bg-zinc-900/20 rounded-xl text-center space-y-2">
              <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto" />
              <p className="text-sm font-medium text-white">All Clear! No unreturned parts found</p>
              <p className="text-zinc-500 text-xs max-w-xs mx-auto">
                No active or historic checkouts registered under this student email. Ensure correct spelling or check with your teacher.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Active list column */}
              <div className="space-y-4">
                <h5 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest px-1">
                  Active Borrowings ({activeLoans.length})
                </h5>
                {activeLoans.length === 0 ? (
                  <div className="p-5 border border-dashed border-zinc-800 text-zinc-500 rounded-xl text-xs bg-zinc-950/20">
                    No active loans to show. You are free of materials!
                  </div>
                ) : (
                  activeLoans.map((loan) => {
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

                          {/* Instructions */}
                          <div className="mt-4 bg-zinc-950/60 p-3 rounded-lg border border-zinc-850 flex items-start gap-2">
                            <MapPin className="w-3.5 h-3.5 text-yellow-500 shrink-0 mt-0.5" />
                            <div className="text-[11px] leading-relaxed text-zinc-400">
                              Return Drawer: <b className="text-zinc-200">{getComponentLocation(loan.componentId)}</b>. Please package clean and return safely to your course teacher at this drawer drawer.
                            </div>
                          </div>
                        </div>

                        {/* Due metrics */}
                        <div className="mt-5 pt-3.5 border-t border-zinc-800/60 flex items-center justify-between text-xs">
                          <span className="text-zinc-500 font-medium">Return Threshold</span>
                          <span className={`font-mono flex items-center gap-1 font-semibold ${isLate ? "text-red-400" : "text-yellow-500"}`}>
                            <Calendar className="w-3.5 h-3.5 inline" /> {loan.dueDate}{" "}
                            {isLate 
                              ? `(${Math.abs(daysRemaining)} days late)` 
                              : `(${daysRemaining} days left)`}
                          </span>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>

              {/* Historic list column */}
              <div className="space-y-4">
                <h5 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest px-1">
                  Historic Returns ({historicLoans.length})
                </h5>
                {historicLoans.length === 0 ? (
                  <div className="p-5 border border-dashed border-zinc-850 text-zinc-550 rounded-xl text-xs bg-zinc-950/20">
                    No historic returned components on record.
                  </div>
                ) : (
                  historicLoans.map((loan) => (
                    <div
                      key={loan.id}
                      className="p-4 bg-zinc-900/40 border border-zinc-850 rounded-xl opacity-65 hover:opacity-100 transition-opacity"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-xs font-semibold text-zinc-300">{loan.componentName}</h4>
                          <p className="text-[10px] text-zinc-500 mt-1">Returned Safe: {loan.returnedDate}</p>
                        </div>
                        <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 border border-emerald-500/10">
                          <CheckCircle className="w-3 h-3" /> Returned
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-zinc-900/40 p-8 border border-zinc-800 rounded-xl space-y-6">
          <h4 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-yellow-500" /> Lab Return Guidelines
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs text-zinc-400 leading-normal">
            <div className="bg-zinc-950/40 p-4 border border-zinc-800/80 rounded-xl space-y-2">
              <strong className="text-zinc-200 block text-xs">1. Complete Code Audits</strong>
              Ensure microcontrollers (Arduinos, Pis) have been flashed back to factory states and structural shields detached.
            </div>
            <div className="bg-zinc-950/40 p-4 border border-zinc-800/80 rounded-xl space-y-2">
              <strong className="text-zinc-200 block text-xs">2. Organize Cabinet Slots</strong>
              Locate the mapped Cabinet and Drawer matching your item's catalog entry before returning drawers.
            </div>
            <div className="bg-zinc-950/40 p-4 border border-zinc-800/80 rounded-xl space-y-2">
              <strong className="text-zinc-200 block text-xs">3. Register Handins</strong>
              Ensure the instructor notes down your checkin directly inside the dashboard to mark your deadline complete, clearing notifications.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
