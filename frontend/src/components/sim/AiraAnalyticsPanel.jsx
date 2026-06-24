import React, { useMemo } from "react";
import { useSimStore } from "@/store/simStore";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { X, TrendingUp, Target, Activity } from "lucide-react";

export default function AiraAnalyticsPanel() {
  const open = useSimStore((s) => s.analyticsPanelOpen);
  const togglePanel = useSimStore((s) => s.toggleAnalyticsPanel);
  const historicalEpisodes = useSimStore((s) => s.analytics.historicalEpisodes);
  const breakthroughs = useSimStore((s) => s.analytics.breakthroughs);

  const rewardData = useMemo(() => {
    // Show last 50 episodes, chronological order
    return [...historicalEpisodes].slice(0, 50).reverse().map((ep, i) => ({
      index: i + 1,
      reward: Number(ep.reward?.toFixed(2) || 0),
      success: ep.success,
    }));
  }, [historicalEpisodes]);

  const outcomeData = useMemo(() => {
    let success = 0;
    let falls = 0;
    historicalEpisodes.forEach((ep) => {
      if (ep.success) success++;
      else falls++;
    });
    return [
      { name: "Success", value: success },
      { name: "Falls", value: falls },
    ];
  }, [historicalEpisodes]);

  const COLORS = ["#00ff88", "#ff3366"];

  if (!open) return null;

  return (
    <div className="absolute top-24 left-1/2 -translate-x-1/2 w-[800px] max-h-[80vh] glass rounded-xl border border-white/20 shadow-2xl flex flex-col z-50 pointer-events-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/40 rounded-t-xl">
        <div className="flex items-center gap-2 text-[#A78BFA]">
          <TrendingUp className="w-4 h-4" />
          <span className="text-xs font-mono uppercase tracking-widest font-bold">Historical Analytics & Breakthroughs</span>
        </div>
        <button
          onClick={togglePanel}
          className="text-zinc-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
        
        {/* Top Charts Row */}
        <div className="grid grid-cols-3 gap-4 h-64">
          
          {/* Reward Trend Line Chart */}
          <div className="col-span-2 bg-black/40 border border-white/10 rounded-lg p-3 flex flex-col">
            <div className="text-[10px] uppercase tracking-wider text-zinc-400 mb-2 flex items-center gap-1.5">
              <Activity className="w-3 h-3 text-[#FFEA00]" />
              Recent Reward Trend (Last 50 Episodes)
            </div>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rewardData}>
                  <XAxis dataKey="index" stroke="#666" fontSize={10} />
                  <YAxis stroke="#666" fontSize={10} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#000", borderColor: "#333", fontSize: "11px" }}
                    itemStyle={{ color: "#fff" }}
                  />
                  <Line type="monotone" dataKey="reward" stroke="#00d4ff" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Success vs Falls Pie Chart */}
          <div className="col-span-1 bg-black/40 border border-white/10 rounded-lg p-3 flex flex-col">
            <div className="text-[10px] uppercase tracking-wider text-zinc-400 mb-2 flex items-center gap-1.5">
              <Target className="w-3 h-3 text-[#00ff88]" />
              Overall Outcome Ratio
            </div>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={outcomeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={60}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {outcomeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "#000", borderColor: "#333", fontSize: "11px" }}
                    itemStyle={{ color: "#fff" }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-4 mt-2">
                <div className="text-[10px] flex items-center gap-1 text-zinc-300">
                  <div className="w-2 h-2 rounded-full bg-[#00ff88]" /> {outcomeData[0].value} Success
                </div>
                <div className="text-[10px] flex items-center gap-1 text-zinc-300">
                  <div className="w-2 h-2 rounded-full bg-[#ff3366]" /> {outcomeData[1].value} Falls
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Breakthroughs Section */}
        <div className="bg-black/40 border border-white/10 rounded-lg p-3 flex flex-col">
          <div className="text-[10px] uppercase tracking-wider text-zinc-400 mb-3 flex items-center gap-1.5">
            <TrendingUp className="w-3 h-3 text-[#A78BFA]" />
            Breakthrough Moments
          </div>
          
          <div className="flex flex-col gap-2 max-h-48 overflow-y-auto scroll-thin pr-2">
            {breakthroughs.length === 0 ? (
              <div className="text-xs text-zinc-500 font-mono text-center py-4">No breakthroughs recorded yet.</div>
            ) : (
              breakthroughs.map((bt) => (
                <div key={bt.id} className="flex gap-3 items-start border-l-2 border-[#A78BFA] pl-3 py-1">
                  <div className="text-[10px] font-mono text-zinc-500 pt-0.5 min-w-[60px]">
                    {new Date(bt.t).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                  <div className="text-[11px] font-mono text-[#E0E0E0]">{bt.text}</div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
