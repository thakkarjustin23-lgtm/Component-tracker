import { LogEntry } from "../types";
import { ListFilter, Radio, MessageSquare, PlusCircle, CheckCircle, RotateCcw, AlertTriangle } from "lucide-react";
import { motion } from "motion/react";

interface ActivityLogTabProps {
  logs: LogEntry[];
  onClearLogs?: () => void;
}

export default function ActivityLogTab({ logs }: ActivityLogTabProps) {
  const getLogStyle = (type: string) => {
    switch (type) {
      case "checkout":
        return {
          bg: "bg-blue-500/10 border-blue-500/20 text-blue-400",
          icon: <PlusCircle className="w-4 h-4 shrink-0" />
        };
      case "return":
        return {
          bg: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
          icon: <CheckCircle className="w-4 h-4 shrink-0" />
        };
      case "alert":
        return {
          bg: "bg-amber-500/10 border-amber-500/20 text-amber-500",
          icon: <MessageSquare className="w-4 h-4 shrink-0" />
        };
      case "inventory":
        return {
          bg: "bg-purple-500/10 border-purple-500/20 text-purple-400",
          icon: <ListFilter className="w-4 h-4 shrink-0" />
        };
      default:
        return {
          bg: "bg-zinc-800/80 border-zinc-700/60 text-zinc-300",
          icon: <Radio className="w-4 h-4 shrink-0" />
        };
    }
  };

  const formatTimestamp = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">System Audit Trail</h3>
          <p className="text-xs text-zinc-500">Chronological logs of hardware borrow activity, alert dispatches, and inventory updates</p>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden divide-y divide-zinc-800/60 max-h-[60vh] overflow-y-auto">
        {logs.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 text-xs">
            No system actions recorded yet.
          </div>
        ) : (
          logs.map((log) => {
            const styles = getLogStyle(log.type);
            return (
              <motion.div
                key={log.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-4 flex items-start justify-between gap-4 hover:bg-zinc-950/20 transition-colors"
              >
                <div className="flex gap-3">
                  <div className={`p-1.5 rounded-lg border h-fit mt-0.5 ${styles.bg}`}>
                    {styles.icon}
                  </div>
                  <div>
                    <p className="text-xs text-zinc-200 leading-relaxed font-sans">{log.message}</p>
                    <span className="inline-flex items-center gap-1.5 mt-1.5 text-[10px] font-semibold tracking-wider font-mono uppercase bg-zinc-950 px-2 py-0.5 rounded text-zinc-500 border border-zinc-800/45">
                      Type: {log.type}
                    </span>
                  </div>
                </div>

                <div className="text-right text-[10px] text-zinc-500 font-mono whitespace-nowrap pt-1">
                  {formatTimestamp(log.timestamp)}
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      <div className="p-3.5 bg-zinc-900/10 border border-zinc-850 rounded-xl flex items-start gap-2 text-[11px] text-zinc-500 leading-normal">
        <AlertTriangle className="w-4 h-4 text-zinc-600 shrink-0 mt-0.5" />
        <span>This logging stream represents live actions written dynamically to `/data/db.json` on Node Express server. It provides absolute visibility into classroom logistics.</span>
      </div>
    </div>
  );
}
