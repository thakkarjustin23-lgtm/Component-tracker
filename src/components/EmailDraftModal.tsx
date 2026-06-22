import { useState, useEffect } from "react";
import { Checkout } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Send, X, AlertTriangle, CheckCircle, Mail, RotateCcw, ShieldAlert } from "lucide-react";

interface EmailDraftModalProps {
  checkout: Checkout | null;
  onClose: () => void;
  onSent: () => void;
}

export default function EmailDraftModal({ checkout, onClose, onSent }: EmailDraftModalProps) {
  if (!checkout) return null;

  const [tone, setTone] = useState<"friendly" | "firm" | "parent">("friendly");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isFallback, setIsFallback] = useState(false);

  // Generate initial draft when component opens
  useEffect(() => {
    generateDraft();
  }, [checkout, tone]);

  const generateDraft = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/alert/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkoutId: checkout.id, tone })
      });
      if (res.ok) {
        const data = await res.json();
        setSubject(data.subject);
        setBody(data.body);
        setIsFallback(!!data.isFallback);
      } else {
        const errorData = await res.json();
        console.error("AI draft generation failed", errorData);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/checkouts/${checkout.id}/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailSubject: subject, emailBody: body })
      });
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          onSent();
          onClose();
        }, 1500);
      }
    } catch (err) {
      console.error("Failed to submit notice", err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate days past deadline
  const getDaysOverdue = () => {
    const today = new Date().toISOString().split("T")[0];
    const msDiff = new Date(today).getTime() - new Date(checkout.dueDate).getTime();
    return Math.max(0, Math.floor(msDiff / (1000 * 60 * 60 * 24)));
  };

  const daysLate = getDaysOverdue();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900">
          <div className="flex items-center gap-3">
            <div className="bg-yellow-500/10 p-2 rounded-lg text-yellow-500">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">AI Notification Drafter</h3>
              <p className="text-xs text-zinc-400">Personalized smart email for overdue lab robotics item</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors bg-zinc-800 hover:bg-zinc-700 p-1.5 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Overview Box */}
        <div className="px-6 py-4 bg-zinc-950/50 border-b border-zinc-800/80 flex flex-wrap gap-y-2 items-center justify-between text-xs text-zinc-300">
          <div>
            <span className="text-zinc-500">Student:</span>{" "}
            <span className="font-semibold text-white">{checkout.studentName}</span>{" "}
            <span className="text-zinc-500">({checkout.studentEmail})</span>
          </div>
          <div className="flex gap-4">
            <div>
              <span className="text-zinc-500">Item:</span>{" "}
              <span className="font-semibold text-yellow-500">{checkout.componentName}</span>
            </div>
            <div>
              <span className="text-zinc-500">Overdue:</span>{" "}
              <span className="font-bold text-red-500">{daysLate} Days</span>
            </div>
          </div>
        </div>

        {/* Main Content Scroll container */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Tone Selector */}
          <div>
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-2">
              Select Warning Alert Tone
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setTone("friendly")}
                className={`py-3 px-4 rounded-lg flex flex-col items-center gap-1.5 border text-center transition-all ${
                  tone === "friendly"
                    ? "bg-emerald-500/10 border-emerald-500 text-emerald-400"
                    : "bg-zinc-800/40 border-zinc-800 hover:border-zinc-700 text-zinc-300"
                }`}
              >
                <Mail className="w-4 h-4" />
                <span className="text-xs font-semibold">Friendly Reminder</span>
              </button>

              <button
                type="button"
                onClick={() => setTone("firm")}
                className={`py-3 px-4 rounded-lg flex flex-col items-center gap-1.5 border text-center transition-all ${
                  tone === "firm"
                    ? "bg-orange-500/10 border-orange-500 text-orange-400"
                    : "bg-zinc-800/40 border-zinc-800 hover:border-zinc-700 text-zinc-300"
                }`}
              >
                <AlertTriangle className="w-4 h-4" />
                <span className="text-xs font-semibold">Firm Warn / Hold</span>
              </button>

              <button
                type="button"
                onClick={() => setTone("parent")}
                className={`py-3 px-4 rounded-lg flex flex-col items-center gap-1.5 border text-center transition-all  ${
                  tone === "parent"
                    ? "bg-red-500/10 border-red-500 text-red-400"
                    : "bg-zinc-800/40 border-zinc-800 hover:border-zinc-700 text-zinc-300"
                }`}
              >
                <ShieldAlert className="w-4 h-4" />
                <span className="text-xs font-semibold">Parent-CC Copy</span>
              </button>
            </div>
          </div>

          {/* Editor Sandbox */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Notification Contents Editor
              </label>
              <button
                type="button"
                onClick={generateDraft}
                disabled={loading}
                className="text-xs text-yellow-500 hover:text-yellow-400 flex items-center gap-1 disabled:opacity-50 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Re-Gen Smart Draft
              </button>
            </div>

            {loading ? (
              <div className="h-64 rounded-lg bg-zinc-950 border border-zinc-800 flex flex-col items-center justify-center gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
                <span className="text-xs text-zinc-400">Gemini drafting custom email...</span>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Subject Block */}
                <div>
                  <span className="text-[10px] text-zinc-500 block mb-1">EMAIL SUBJECT:</span>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Email Subject Line"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2.5 px-3.5 text-sm text-white focus:outline-none focus:border-yellow-500/50 transition-all font-mono"
                  />
                </div>

                {/* Body Block */}
                <div>
                  <span className="text-[10px] text-zinc-500 block mb-1">EMAIL MESSAGE BODY:</span>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={8}
                    placeholder="Compose notice..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-3 px-3.5 text-xs text-zinc-200 focus:outline-none focus:border-yellow-500/50 transition-all font-mono leading-relaxed resize-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Fallback Notice */}
          {isFallback && !loading && (
            <div className="p-3 bg-zinc-950 border border-zinc-800/80 rounded-lg text-zinc-400 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-normal font-sans">
                <span className="text-white font-medium">Developer Quick Sandbox Mode:</span> Pre-configured templates have loaded. Set your custom Gemini API key in AI Studio Secrets tab to trigger genuine server-side neural compositions.
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-zinc-800 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
          >
            Discard
          </button>

          <AnimatePresence mode="wait">
            {success ? (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium"
              >
                <CheckCircle className="w-4 h-4" />
                Alert email sent successfully!
              </motion.div>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={loading || !subject || !body}
                className="bg-yellow-500 text-zinc-950 hover:bg-yellow-400 disabled:opacity-50 transition-colors font-semibold px-4 py-2.5 rounded-lg text-xs flex items-center gap-2"
              >
                <Send className="w-3.5 h-3.5" />
                Send Simulated Mail Alert
              </button>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
