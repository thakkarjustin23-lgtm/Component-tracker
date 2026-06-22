import React, { useState } from "react";
import { Checkout, Component } from "../types";
import { Calendar, UserPlus, FileCheck, AlertTriangle, Check, MailWarning, Clock, ArrowRightLeft, Sparkles, Filter } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface CheckoutTabProps {
  checkouts: Checkout[];
  components: Component[];
  onRefresh: () => void;
  onOpenDraftPanel: (checkout: Checkout) => void;
}

export default function CheckoutTab({ checkouts, components, onRefresh, onOpenDraftPanel }: CheckoutTabProps) {
  const [filter, setFilter] = useState<"all" | "active" | "overdue" | "returned">("all");
  const [isCheckoutFormOpen, setIsCheckoutFormOpen] = useState(false);

  // Form State
  const [componentId, setComponentId] = useState("");
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [dueDate, setDueDate] = useState(() => {
    // Default to +7 days in future YYYY-MM-DD
    const fut = new Date();
    fut.setDate(fut.getDate() + 7);
    return fut.toISOString().split("T")[0];
  });
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmitCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!componentId) {
      setFormError("Please select an hardware component.");
      return;
    }
    if (!studentName.trim() || !studentEmail.trim()) {
      setFormError("Student contact info is required.");
      return;
    }
    if (quantity <= 0) {
      setFormError("Checkout quantity must be at least 1.");
      return;
    }

    // Verify stock ratio
    const comp = components.find(c => c.id === componentId);
    if (comp && comp.availableStock < quantity) {
      setFormError(`Insufficient stock. Only ${comp.availableStock} available.`);
      return;
    }

    setLoading(true);
    setFormError("");

    try {
      const response = await fetch("/api/checkouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ componentId, studentName, studentEmail, quantity, dueDate })
      });

      if (response.ok) {
        setIsCheckoutFormOpen(false);
        // Reset form
        setComponentId("");
        setStudentName("");
        setStudentEmail("");
        setQuantity(1);
        onRefresh();
      } else {
        const err = await response.json();
        setFormError(err.error || "Failed to complete checkout.");
      }
    } catch (err) {
      setFormError("Failed to communicate with Express server.");
    } finally {
      setLoading(false);
    }
  };

  const handleReturnItem = async (checkoutId: string, compName: string, studName: string) => {
    if (!window.confirm(`Log safely return of "${compName}" from ${studName}?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/checkouts/${checkoutId}/return`, { method: "POST" });
      if (res.ok) {
        onRefresh();
      } else {
        alert("Failed to submit return transaction.");
      }
    } catch {
      alert("Error returning hardware piece.");
    }
  };

  // Quick preset duedates (+7 days or +14 days)
  const setDaysPreset = (days: number) => {
    const fut = new Date();
    fut.setDate(fut.getDate() + days);
    setDueDate(fut.toISOString().split("T")[0]);
  };

  const filteredCheckouts = checkouts.filter(c => {
    if (filter === "active") return c.status === "active";
    if (filter === "overdue") return c.status === "overdue";
    if (filter === "returned") return c.status === "returned";
    return true; // all
  });

  return (
    <div className="space-y-6">
      {/* Overview stats & trigger button */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900/40 p-4 border border-zinc-800 rounded-xl">
        {/* Filters */}
        <div className="flex flex-wrap gap-1.5 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              filter === "all" ? "bg-zinc-800 text-white font-semibold" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            All Loans ({checkouts.length})
          </button>
          <button
            onClick={() => setFilter("active")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              filter === "active" ? "bg-zinc-800 text-white font-semibold" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Active ({checkouts.filter(c => c.status === "active").length})
          </button>
          <button
            onClick={() => setFilter("overdue")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              filter === "overdue" ? "bg-red-500/10 text-red-400 font-semibold" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Overdue ({checkouts.filter(c => c.status === "overdue").length})
          </button>
          <button
            onClick={() => setFilter("returned")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              filter === "returned" ? "bg-zinc-800 text-white font-semibold" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Returned ({checkouts.filter(c => c.status === "returned").length})
          </button>
        </div>

        <button
          onClick={() => setIsCheckoutFormOpen(true)}
          className="bg-yellow-500 text-zinc-950 hover:bg-yellow-400 p-2.5 px-4 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-lg shadow-yellow-500/10 cursor-pointer"
        >
          <UserPlus className="w-4 h-4" /> Register New Checkout
        </button>
      </div>

      {/* Checkouts Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        {filteredCheckouts.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-zinc-500 p-6 text-center">
            <ArrowRightLeft className="w-8 h-8 text-zinc-700 mb-2" />
            <span className="text-zinc-400 text-sm font-medium">No component checkouts match guidelines</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-zinc-950/70 text-zinc-500 font-medium uppercase tracking-wider border-b border-zinc-800">
                  <th className="p-4 py-3 font-semibold">Student & Contact Info</th>
                  <th className="p-4 py-3 font-semibold">Borrowed Equipment</th>
                  <th className="p-4 py-3 font-semibold">Due Date</th>
                  <th className="p-4 py-3 font-semibold">Status State</th>
                  <th className="p-4 py-3 font-semibold">Notifications Logs</th>
                  <th className="p-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/65">
                {filteredCheckouts.map(chk => {
                  const isReturned = chk.status === "returned";
                  const isOverdue = chk.status === "overdue";
                  
                  return (
                    <tr key={chk.id} className="hover:bg-zinc-950/20 transition-colors">
                      {/* Student row */}
                      <td className="p-4">
                        <div className="font-semibold text-white text-sm">{chk.studentName}</div>
                        <div className="text-[11px] text-zinc-500 font-mono mt-0.5">{chk.studentEmail}</div>
                      </td>

                      {/* Borrowed Component */}
                      <td className="p-4">
                        <div className="font-medium text-yellow-500/90 text-sm">{chk.componentName}</div>
                        <div className="text-zinc-500 text-[11px] mt-0.5">Quantity: <strong className="text-zinc-300">{chk.quantity} unit{chk.quantity > 1 ? "s" : ""}</strong></div>
                      </td>

                      {/* Deadlines */}
                      <td className="p-4">
                        <div className="font-mono text-zinc-300">{chk.dueDate}</div>
                        <div className="text-[10px] text-zinc-500">Checkout: {chk.checkoutDate}</div>
                      </td>

                      {/* Status */}
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold text-[10px] uppercase tracking-wider ${
                          isReturned 
                            ? "bg-emerald-500/10 text-emerald-400" 
                            : isOverdue 
                            ? "bg-red-500/10 text-red-500 animate-pulse" 
                            : "bg-blue-500/10 text-blue-400"
                        }`}>
                          {isReturned ? (
                            <Check className="w-3 h-3" />
                          ) : isOverdue ? (
                            <AlertTriangle className="w-3 h-3" />
                          ) : (
                            <Clock className="w-3 h-3" />
                          )}
                          {chk.status}
                        </span>
                        {isReturned && chk.returnedDate && (
                          <div className="text-[10px] text-zinc-500 mt-1">Returned: {chk.returnedDate}</div>
                        )}
                      </td>

                      {/* Warning dispatches */}
                      <td className="p-4">
                        {isReturned ? (
                          <span className="text-zinc-600 text-[11px]">Returned cleanly</span>
                        ) : (
                          <div className="space-y-0.5">
                            <div className="text-zinc-300 text-[11px]">
                              Alerts Sent: <strong className={chk.alertsSent > 0 ? "text-amber-500 font-bold" : "text-zinc-500 font-normal"}>{chk.alertsSent} time(s)</strong>
                            </div>
                            {chk.lastAlertDate && (
                              <div className="text-[10px] text-zinc-500">Last: {chk.lastAlertDate}</div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Operations */}
                      <td className="p-4 text-right">
                        <div className="flex gap-2 justify-end">
                          {!isReturned ? (
                            <>
                              {/* Open Gemini Alert */}
                              <button
                                onClick={() => onOpenDraftPanel(chk)}
                                className="bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 border border-yellow-500/30 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 cursor-pointer transition-all"
                                title="Use Gemini instruction"
                              >
                                <Sparkles className="w-3 h-3" /> Draft Alert
                              </button>

                              {/* Register Return */}
                              <button
                                onClick={() => handleReturnItem(chk.id, chk.componentName, chk.studentName)}
                                className="bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 border border-zinc-700/60 px-3 py-1.5 rounded-lg text-xs font-semibold"
                              >
                                Check In
                              </button>
                            </>
                          ) : (
                            <span className="text-[11px] text-zinc-600 flex items-center gap-1 bg-zinc-950/40 px-2.5 py-1 rounded border border-zinc-850">
                              <FileCheck className="w-3.5 h-3.5 text-zinc-500" /> Cataloged
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Checkout Form Modal */}
      <AnimatePresence>
        {isCheckoutFormOpen && (
          <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl"
            >
              <form onSubmit={handleSubmitCheckout}>
                <div className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Record Student Loan Check-out
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsCheckoutFormOpen(false)}
                    className="text-zinc-500 hover:text-white transition-colors"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  {formError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 text-rose-400 text-xs rounded-lg flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  {/* Component Select */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest block">
                      Robotics Part / Material
                    </label>
                    <select
                      value={componentId}
                      onChange={(e) => setComponentId(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2.5 px-3 text-sm text-white focus:outline-none focus:border-yellow-500/30 transition-all font-sans"
                    >
                      <option value="">-- Choose component from shelves --</option>
                      {components.map(comp => (
                        <option 
                          key={comp.id} 
                          value={comp.id}
                          disabled={comp.availableStock <= 0}
                        >
                          {comp.name} ({comp.availableStock} of {comp.totalStock} left)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Student Name */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest block">
                      Student Name Description
                    </label>
                    <input
                      type="text"
                      required
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      placeholder="e.g. Alex Rivera"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2.5 px-3 text-sm text-white focus:outline-none focus:border-yellow-500/30 transition-all"
                    />
                  </div>

                  {/* Student Email */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest block">
                      Student Email Address (for alert pings)
                    </label>
                    <input
                      type="email"
                      required
                      value={studentEmail}
                      onChange={(e) => setStudentEmail(e.target.value)}
                      placeholder="e.g. arivera.student@school.edu"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2.5 px-3 text-sm text-white focus:outline-none focus:border-yellow-500/30 transition-all font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Quantity */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest block">
                        Checkout Quantity
                      </label>
                      <input
                        type="number"
                        min={1}
                        required
                        value={quantity}
                        onChange={(e) => setQuantity(Number(e.target.value))}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2.5 px-3 text-sm text-white focus:outline-none focus:border-yellow-500/30 transition-all"
                      />
                    </div>

                    {/* Due Date */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest block">
                        Return Due Date
                      </label>
                      <input
                        type="date"
                        required
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2.5 px-3 text-sm text-white focus:outline-none focus:border-yellow-500/30 transition-all font-mono"
                      />
                    </div>
                  </div>

                  {/* Date Presets */}
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setDaysPreset(7)}
                      className="text-[10px] text-zinc-400 hover:text-white bg-zinc-950 px-2 py-1 rounded hover:bg-zinc-800 transition-all"
                    >
                      +7 Days (Standard)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDaysPreset(14)}
                      className="text-[10px] text-zinc-400 hover:text-white bg-zinc-950 px-2 py-1 rounded hover:bg-zinc-800 transition-all"
                    >
                      +14 Days (Extended)
                    </button>
                  </div>
                </div>

                <div className="px-6 py-4 bg-zinc-950/40 border-t border-zinc-800 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsCheckoutFormOpen(false)}
                    className="px-4 py-2 border border-zinc-800 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-yellow-500 text-zinc-950 hover:bg-yellow-400 disabled:opacity-50 transition-colors font-semibold px-4 py-2 rounded-lg text-xs"
                  >
                    {loading ? "Approving Loan..." : "Record Checkout"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
