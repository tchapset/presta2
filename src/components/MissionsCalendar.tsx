import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

interface Mission {
  id: string;
  title: string;
  status: string | null;
  created_at: string | null;
  completed_at: string | null;
}

interface MissionsCalendarProps {
  missions: Mission[];
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-secondary/60",
  accepted: "bg-primary/40",
  in_progress: "bg-primary/70",
  completed: "bg-primary",
  disputed: "bg-destructive/60",
  cancelled: "bg-muted-foreground/30",
};

const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const MissionsCalendar = ({ missions }: MissionsCalendarProps) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const { days, firstDayOffset } = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    // Adjust so Monday=0
    const offset = firstDay === 0 ? 6 : firstDay - 1;

    const days = Array.from({ length: daysInMonth }, (_, i) => {
      const date = new Date(year, month, i + 1);
      const dayMissions = missions.filter((m) => {
        const d = new Date(m.created_at || "");
        return d.getDate() === i + 1 && d.getMonth() === month && d.getFullYear() === year;
      });
      return { day: i + 1, date, missions: dayMissions };
    });

    return { days, firstDayOffset: offset };
  }, [currentMonth, missions]);

  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const selectedMissions = selectedDay !== null ? days.find((d) => d.day === selectedDay)?.missions || [] : [];

  const monthLabel = currentMonth.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));

  const today = new Date();
  const isToday = (day: number) =>
    today.getDate() === day && today.getMonth() === currentMonth.getMonth() && today.getFullYear() === currentMonth.getFullYear();

  return (
    <div className="bg-card rounded-2xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-display font-bold text-foreground">Calendrier des missions</h3>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={prevMonth}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium text-foreground capitalize min-w-[120px] text-center">
            {monthLabel}
          </span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={nextMonth}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDayOffset }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {days.map((d) => (
          <button
            key={d.day}
            onClick={() => setSelectedDay(d.day === selectedDay ? null : d.day)}
            className={`relative aspect-square rounded-lg flex flex-col items-center justify-center text-xs transition-colors
              ${isToday(d.day) ? "ring-2 ring-primary" : ""}
              ${selectedDay === d.day ? "bg-primary/10" : "hover:bg-muted/50"}
            `}
          >
            <span className={`font-medium ${isToday(d.day) ? "text-primary" : "text-foreground"}`}>
              {d.day}
            </span>
            {d.missions.length > 0 && (
              <div className="flex gap-0.5 mt-0.5">
                {d.missions.slice(0, 3).map((m, i) => (
                  <div
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full ${STATUS_COLORS[m.status || "pending"]}`}
                  />
                ))}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Selected day missions */}
      {selectedDay !== null && selectedMissions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-4 border-t border-border pt-3 space-y-2"
        >
          <p className="text-xs font-medium text-muted-foreground">
            {selectedDay} {monthLabel} — {selectedMissions.length} mission(s)
          </p>
          {selectedMissions.map((m) => (
            <a
              key={m.id}
              href={`/mission/${m.id}`}
              className="block p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
            >
              <p className="text-sm font-medium text-foreground truncate">{m.title}</p>
              <div className="flex items-center gap-2 mt-1">
                <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[m.status || "pending"]}`} />
                <span className="text-[10px] text-muted-foreground capitalize">
                  {m.status === "in_progress" ? "En cours" : m.status === "completed" ? "Terminée" : m.status || "En attente"}
                </span>
              </div>
            </a>
          ))}
        </motion.div>
      )}
    </div>
  );
};

export default MissionsCalendar;
