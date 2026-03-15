import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from "recharts";
import { TrendingUp, Target, Calendar, Users } from "lucide-react";
import { motion } from "framer-motion";

interface Mission {
  id: string;
  status: string | null;
  created_at: string | null;
  completed_at: string | null;
  total_amount: number | null;
  client_id: string;
  provider_id: string | null;
}

interface DashboardChartsProps {
  missions: Mission[];
  isProvider: boolean;
}

const COLORS = [
  "hsl(145, 60%, 28%)",
  "hsl(40, 70%, 55%)",
  "hsl(0, 72%, 48%)",
  "hsl(160, 10%, 45%)",
  "hsl(200, 60%, 50%)",
  "hsl(280, 50%, 50%)",
];

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  accepted: "Acceptée",
  in_progress: "En cours",
  completed: "Terminée",
  disputed: "Litige",
  cancelled: "Annulée",
};

const DashboardCharts = ({ missions, isProvider }: DashboardChartsProps) => {
  const monthlyData = useMemo(() => {
    const now = new Date();
    const months: { month: string; count: number; completed: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString("fr-FR", { month: "short" });
      const mStart = d.getTime();
      const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).getTime();
      const inMonth = missions.filter((m) => {
        const t = new Date(m.created_at || "").getTime();
        return t >= mStart && t <= mEnd;
      });
      const completed = inMonth.filter((m) => m.status === "completed").length;
      months.push({ month: label, count: inMonth.length, completed });
    }
    return months;
  }, [missions]);

  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    missions.forEach((m) => {
      const s = m.status || "pending";
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({
      name: STATUS_LABELS[name] || name,
      value,
    }));
  }, [missions]);

  const conversionRate = useMemo(() => {
    if (missions.length === 0) return 0;
    const completed = missions.filter((m) => m.status === "completed").length;
    return Math.round((completed / missions.length) * 100);
  }, [missions]);

  const totalMissions = missions.length;
  const activeMissions = missions.filter(m => ["pending", "accepted", "in_progress"].includes(m.status || "")).length;
  const completedMissions = missions.filter(m => m.status === "completed").length;

  return (
    <div className="space-y-6">
      {/* KPI summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: Target, label: "Taux conversion", value: `${conversionRate}%`, color: "text-primary" },
          { icon: Calendar, label: "Total missions", value: totalMissions.toString(), color: "text-secondary" },
          { icon: Users, label: isProvider ? "Missions actives" : "En cours", value: activeMissions.toString(), color: "text-primary" },
          { icon: TrendingUp, label: "Ce mois", value: monthlyData[monthlyData.length - 1]?.count.toString() || "0", color: "text-secondary" },
        ].map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-card rounded-xl border border-border p-4"
          >
            <kpi.icon className={`w-4 h-4 ${kpi.color} mb-2`} />
            <p className="text-[11px] text-muted-foreground">{kpi.label}</p>
            <p className="text-lg font-display font-bold text-foreground">{kpi.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Missions per month - Area chart */}
        <div className="bg-card rounded-2xl border border-border p-5">
          <h3 className="text-sm font-display font-bold text-foreground mb-4">Missions par mois</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={monthlyData}>
              <defs>
                <linearGradient id="colorMissions" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(145, 60%, 28%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(145, 60%, 28%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(160, 10%, 45%)" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(160, 10%, 45%)" allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 12,
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="hsl(145, 60%, 28%)"
                strokeWidth={2}
                fill="url(#colorMissions)"
                name="Missions"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Completed per month - Bar chart */}
        <div className="bg-card rounded-2xl border border-border p-5">
          <h3 className="text-sm font-display font-bold text-foreground mb-4">
            Missions terminées par mois
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyData}>
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(160, 10%, 45%)" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(160, 10%, 45%)" allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 12,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="completed" fill="hsl(40, 70%, 55%)" radius={[6, 6, 0, 0]} name="Terminées" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Status distribution */}
      {statusData.length > 0 && (
        <div className="bg-card rounded-2xl border border-border p-5">
          <h3 className="text-sm font-display font-bold text-foreground mb-4">Répartition des missions</h3>
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <ResponsiveContainer width={180} height={180}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  dataKey="value"
                  stroke="none"
                >
                  {statusData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-3">
              {statusData.map((s, i) => (
                <div key={s.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="text-xs text-muted-foreground">{s.name} ({s.value})</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardCharts;