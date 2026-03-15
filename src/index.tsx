import React, { useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import { Activity, AlertTriangle, BarChart3, ClipboardList, HeartPulse, Moon, Timer, Users } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { supabase } from "./src/supabase";
const LOAD_WINDOWS = [
  { label: "7d", days: 7 },
  { label: "15d", days: 15 },
  { label: "30d", days: 30 },
];

const ATTENDANCE_OPTIONS = ["Present", "Absent", "Modified", "Rehab", "Off", "Not Selected"];
const SESSION_TYPES = ["Training", "Game", "Rehab", "Gym"];
const BODY_CHECK_OPTIONS = ["None", "Minor", "Moderate", "High"];

const DEFAULT_PLAYERS = [
  { id: 1, name: "A. Silva", position: "GK" },
  { id: 2, name: "M. Traoré", position: "CB" },
  { id: 3, name: "L. Morel", position: "CB" },
  { id: 4, name: "J. Costa", position: "FB" },
  { id: 5, name: "R. Kane", position: "6" },
  { id: 6, name: "T. Martin", position: "8" },
  { id: 7, name: "D. Perez", position: "10" },
  { id: 8, name: "K. Ibrahim", position: "W" },
  { id: 9, name: "S. Novak", position: "9" },
];

const todayKey = () => {
  const now = new Date();

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Winnipeg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(now)
    .replace(/\//g, "-");
};
const daysAgoKey = (days) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
};
const withinLastDays = (dateStr, days) => dateStr >= daysAgoKey(days - 1);

const scoreReadiness = (w) => {
  if (!w) return null;

  const sleep = Number(w.sleep || 0);
  const mood = Number(w.mood || 0);
  const freshness = Number(w.freshness || 0);

  const fatigue = 6 - Number(w.fatigue || 1);
  const soreness = 6 - Number(w.soreness || 1);
  const stress = 6 - Number(w.stress || 1);

  const weights = {
    sleep: 1.5,
    mood: 1,
    freshness: 1.5,
    fatigue: 2,
    soreness: 2,
    stress: 1,
  };

  const weightedSum =
    sleep * weights.sleep +
    mood * weights.mood +
    freshness * weights.freshness +
    fatigue * weights.fatigue +
    soreness * weights.soreness +
    stress * weights.stress;

  const maxScore =
    5 * weights.sleep +
    5 * weights.mood +
    5 * weights.freshness +
    5 * weights.fatigue +
    5 * weights.soreness +
    5 * weights.stress;

  return Math.round((weightedSum / maxScore) * 100);
};

const sumLoads = (entries, playerId, days) =>
  entries
    .filter((e) => e.playerId === playerId && withinLastDays(e.date, days))
    .reduce((sum, e) => sum + Number(e.load || 0), 0);

const attendanceSummary = (entries, playerId, days = 30) => {
  const relevant = entries.filter((e) => e.playerId === playerId && withinLastDays(e.date, days));
  const counts = { Present: 0, Absent: 0, Modified: 0, Rehab: 0, Off: 0, "Not Selected": 0 };
  relevant.forEach((e) => {
    counts[e.attendance] = (counts[e.attendance] || 0) + 1;
  });
  const attended = (counts.Present || 0) + (counts.Modified || 0) + (counts.Rehab || 0);
  const total = relevant.length;
  return {
    counts,
    total,
    attended,
    percent: total ? Math.round((attended / total) * 100) : 0,
  };
};

const cn = (...classes) => classes.filter(Boolean).join(" ");
const getLast7Days = (endDate) => {
  const dates = [];
  const end = new Date(endDate);

  for (let i = 6; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }

  return dates;
};

const seedSessions = [
  { date: "2026-03-04", playerId: 1, duration: 75, rpe: 5, attendance: "Present", sessionType: "Training", bodyCheck: "None", painArea: "", comment: "" },
  { date: "2026-03-04", playerId: 2, duration: 75, rpe: 7, attendance: "Present", sessionType: "Training", bodyCheck: "None", painArea: "", comment: "" },
  { date: "2026-03-04", playerId: 3, duration: 75, rpe: 6, attendance: "Present", sessionType: "Training", bodyCheck: "Minor", painArea: "Adductors", comment: "" },
  { date: "2026-03-05", playerId: 1, duration: 80, rpe: 6, attendance: "Present", sessionType: "Training", bodyCheck: "None", painArea: "", comment: "" },
  { date: "2026-03-05", playerId: 2, duration: 80, rpe: 8, attendance: "Present", sessionType: "Training", bodyCheck: "None", painArea: "", comment: "" },
  { date: "2026-03-05", playerId: 3, duration: 80, rpe: 7, attendance: "Present", sessionType: "Training", bodyCheck: "None", painArea: "", comment: "" },
  { date: "2026-03-06", playerId: 1, duration: 65, rpe: 4, attendance: "Present", sessionType: "Gym", bodyCheck: "None", painArea: "", comment: "" },
  { date: "2026-03-06", playerId: 2, duration: 65, rpe: 6, attendance: "Present", sessionType: "Gym", bodyCheck: "Minor", painArea: "Hamstring", comment: "" },
  { date: "2026-03-06", playerId: 3, duration: 65, rpe: 6, attendance: "Present", sessionType: "Gym", bodyCheck: "None", painArea: "", comment: "" },
  { date: "2026-03-07", playerId: 1, duration: 90, rpe: 6, attendance: "Present", sessionType: "Game", bodyCheck: "None", painArea: "", comment: "" },
  { date: "2026-03-07", playerId: 2, duration: 90, rpe: 9, attendance: "Present", sessionType: "Game", bodyCheck: "Moderate", painArea: "Calf", comment: "" },
  { date: "2026-03-07", playerId: 3, duration: 90, rpe: 8, attendance: "Present", sessionType: "Game", bodyCheck: "Minor", painArea: "Knee", comment: "" },
  { date: "2026-03-08", playerId: 1, duration: 40, rpe: 3, attendance: "Modified", sessionType: "Rehab", bodyCheck: "Minor", painArea: "Groin", comment: "" },
  { date: "2026-03-08", playerId: 2, duration: 40, rpe: 4, attendance: "Present", sessionType: "Rehab", bodyCheck: "None", painArea: "", comment: "" },
  { date: "2026-03-08", playerId: 3, duration: 40, rpe: 3, attendance: "Present", sessionType: "Rehab", bodyCheck: "None", painArea: "", comment: "" },
].map((s) => ({ ...s, load: s.duration * s.rpe }));

const seedWellness = [
  { date: todayKey(), playerId: 1, sleep: 4, fatigue: 2, soreness: 2, stress: 2, mood: 4, freshness: 4, comment: "Feeling good" },
  { date: todayKey(), playerId: 2, sleep: 3, fatigue: 4, soreness: 4, stress: 3, mood: 3, freshness: 2, comment: "Heavy legs" },
  { date: todayKey(), playerId: 3, sleep: 5, fatigue: 2, soreness: 2, stress: 1, mood: 5, freshness: 5, comment: "Ready" },
];

function useLocalState(key, initialValue) {
  const [state, setState] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initialValue;
    } catch {
      return initialValue;
    }
  });
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(state));
  }, [key, state]);
  return [state, setState];
}

function SectionCard({ title, icon: Icon, subtitle, children, right }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.88),rgba(2,6,23,0.96))] p-5 shadow-2xl shadow-black/30 backdrop-blur">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2 text-white">
  <div className="rounded-xl border border-white/10 bg-white/5 p-1.5">
    <Icon className="h-4 w-4 text-amber-300" />
  </div>
  <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
</div>
          {subtitle && <p className="text-sm text-slate-300">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function StatCard({ label, value, hint, tone = "default", icon: Icon }) {
  const toneMap = {
  default: "from-slate-900 to-slate-950 border-white/10",
  green: "from-emerald-950/80 to-slate-950 border-emerald-400/20",
  amber: "from-amber-950/70 to-slate-950 border-amber-300/25",
  red: "from-red-950/70 to-slate-950 border-red-400/25",
  blue: "from-blue-950/80 to-slate-950 border-amber-300/20",
};
  return (
    <div className={cn("rounded-3xl border bg-gradient-to-br p-4 shadow-xl shadow-black/20", toneMap[tone])}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-300">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-white">{value}</p>
          {hint && <p className="mt-2 text-xs text-slate-400">{hint}</p>}
        </div>
        {Icon && (
  <div className="rounded-xl border border-white/10 bg-white/5 p-2">
    <Icon className="h-4 w-4 text-slate-200" />
  </div>
)}
      </div>
    </div>
  );
}

function RangeField({ label, value, onChange, lowBad = false, leftLabel = "Low", rightLabel = "High", min = 1, max = 5, showOutOf = true }) {
  const numeric = Number(value);
  const midpoint = Math.ceil((min + max) / 2);
  const lowThreshold = min + 1;
  const highThreshold = max - 1;
  const color = lowBad
    ? numeric <= lowThreshold
      ? "bg-red-500"
      : numeric < highThreshold
        ? "bg-amber-400"
        : "bg-emerald-500"
    : numeric >= highThreshold
      ? "bg-red-500"
      : numeric >= midpoint
        ? "bg-amber-400"
        : "bg-emerald-500";

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm text-slate-200">
        <span>{label}</span>
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold text-slate-950", color)}>
          {value}{showOutOf ? `/${max}` : ""}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step="1"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-white h-3"
      />
      <div className="mt-1 flex justify-between text-xs text-slate-400">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}

function PlayerForm({
  selectedPlayer,
  wellnessEntries,
  sessionEntries,
  setWellnessEntries,
  setSessionEntries,
  loadWellnessEntries,
  loadRpeEntries,
}) {
  const [wellness, setWellness] = useState({ sleep: 4, fatigue: 2, soreness: 2, stress: 2, mood: 4, freshness: 4, comment: "" });
  const [rpe, setRpe] = useState({ duration: 0, rpe: 6, comment: "", bodyCheck: "None", painArea: "", attendance: "Present", sessionType: "Training" });

  useEffect(() => {
    const today = todayKey();
    const w = wellnessEntries.find((x) => x.playerId === selectedPlayer.id && x.date === today);
    if (w) setWellness(w);
    else setWellness({ sleep: 4, fatigue: 2, soreness: 2, stress: 2, mood: 4, freshness: 4, comment: "" });

    const s = sessionEntries.find((x) => x.playerId === selectedPlayer.id && x.date === today);
    if (s) {
      setRpe({
        duration: s.duration || 0,
        rpe: s.rpe || 6,
        comment: s.comment || "",
        bodyCheck: s.bodyCheck || "None",
        painArea: s.painArea || "",
        attendance: s.attendance || "Present",
        sessionType: s.sessionType || "Training",
      });
    } else {
      setRpe({ duration: 0, rpe: 6, comment: "", bodyCheck: "None", painArea: "", attendance: "Present", sessionType: "Training" });
    }
  }, [selectedPlayer, wellnessEntries, sessionEntries]);

  const readiness = scoreReadiness(wellness);
  const isBlocked = ["Absent", "Off", "Not Selected"].includes(rpe.attendance);
  const today = todayKey();
const wellnessSubmitted = wellnessEntries.some((x) => x.playerId === selectedPlayer.id && x.date === today);
const rpeSubmitted = sessionEntries.some((x) => x.playerId === selectedPlayer.id && x.date === today);

 const saveWellness = async () => {
   if (wellnessSubmitted) return;
  const today = todayKey();

  const payload = {
    player_id: selectedPlayer.id,
    entry_date: today,
    sleep: wellness.sleep,
    fatigue: wellness.fatigue,
    soreness: wellness.soreness,
    stress: wellness.stress,
    mood: wellness.mood,
    freshness: wellness.freshness,
    comment: wellness.comment || "",
  };

  const { data, error } = await supabase
    .from("wellness_entries")
    .insert([payload])
    .select();

  if (error) {
    console.error("SAVE WELLNESS ERROR:", error);
    return;
  }

  console.log("SAVE WELLNESS OK:", data);

if (data && data.length > 0) {
  const entry = data[0];

  setWellnessEntries((prev) => [
    ...prev,
    {
      playerId: entry.player_id,
      date: entry.entry_date,
      sleep: entry.sleep,
      fatigue: entry.fatigue,
      soreness: entry.soreness,
      stress: entry.stress,
      mood: entry.mood,
      freshness: entry.freshness,
      comment: entry.comment || "",
    },
  ]);
}
await loadWellnessEntries();
};

  const saveRpe = async () => {
     if (rpeSubmitted) return;
  if (isBlocked) return;

  const payload = {
    player_id: selectedPlayer.id,
    session_id: null,
    rpe: rpe.rpe,
    soreness_level: (rpe.bodyCheck || "None").toLowerCase(),
    pain_comment: rpe.bodyCheck === "None" ? "" : (rpe.painArea || ""),
    attendance: (rpe.attendance || "Present").toLowerCase(),
  };

  const { data, error } = await supabase
    .from("rpe_entries")
    .insert([payload])
    .select();

  if (error) {
    console.error("SAVE RPE ERROR:", error);
    return;
  }

  console.log("SAVE RPE OK:", data);

if (data && data.length > 0) {
  const entry = data[0];

  setSessionEntries((prev) => [
    ...prev,
    {
      playerId: entry.player_id,
      date: todayKey(),
      rpe: entry.rpe,
      duration: 0,
      attendance: entry.attendance || "present",
      bodyCheck: entry.soreness_level || "none",
      painArea: entry.pain_comment || "",
      comment: "",
      sessionType: "Training",
      load: 0,
    },
  ]);
}
    await loadRpeEntries();
};

  return (
  <div className="grid gap-6">
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-amber-300">
            Daily Check-In Status
          </p>
          <p className="mt-1 text-sm text-slate-300">
            {selectedPlayer.name} — today’s completion status
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <div
            className={cn(
              "rounded-2xl border px-4 py-3 text-sm font-semibold",
              wellnessSubmitted
                ? "border-emerald-400/30 bg-emerald-500/20 text-emerald-200"
                : "border-red-400/30 bg-red-500/20 text-red-200"
            )}
          >
            Wellness: {wellnessSubmitted ? "Completed" : "Missing"}
          </div>

          <div
            className={cn(
              "rounded-2xl border px-4 py-3 text-sm font-semibold",
              rpeSubmitted
                ? "border-emerald-400/30 bg-emerald-500/20 text-emerald-200"
                : "border-red-400/30 bg-red-500/20 text-red-200"
            )}
          >
            RPE: {rpeSubmitted ? "Completed" : "Missing"}
          </div>
        </div>
      </div>
    </div>

    <div className="grid gap-6 md:grid-cols-1 xl:grid-cols-2">
      <SectionCard
        title="Pre-Training Wellness"
        icon={HeartPulse}
        subtitle={`Quick readiness check for ${selectedPlayer.name}`}
        right={<div className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-900">Readiness {readiness ?? "--"}%</div>}
      >
        <div className="grid gap-4">
          <RangeField label="Sleep quality" value={wellness.sleep} onChange={(v) => setWellness({ ...wellness, sleep: v })} lowBad />
          <RangeField label="Fatigue" value={wellness.fatigue} onChange={(v) => setWellness({ ...wellness, fatigue: v })} />
          <RangeField label="Muscle soreness" value={wellness.soreness} onChange={(v) => setWellness({ ...wellness, soreness: v })} />
          <RangeField label="Stress" value={wellness.stress} onChange={(v) => setWellness({ ...wellness, stress: v })} />
          <RangeField label="Mood" value={wellness.mood} onChange={(v) => setWellness({ ...wellness, mood: v })} lowBad />
          <RangeField label="Freshness" value={wellness.freshness} onChange={(v) => setWellness({ ...wellness, freshness: v })} lowBad />
          <textarea
            value={wellness.comment || ""}
            onChange={(e) => setWellness({ ...wellness, comment: e.target.value })}
            placeholder="Injury / pain comment"
            className="min-h-[96px] rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-sm text-white outline-none placeholder:text-slate-500"
          />
          <button
  onClick={saveWellness}
  disabled={wellnessSubmitted}
  className={cn(
    "rounded-2xl px-4 py-4 font-semibold transition",
    wellnessSubmitted
      ? "cursor-not-allowed bg-slate-700 text-slate-300"
      : "bg-white text-slate-950 hover:scale-[1.01]"
  )}
>
  {wellnessSubmitted ? "Wellness already submitted" : "Save wellness check"}
</button>
        </div>
      </SectionCard>

      <SectionCard
        title="Post-Training RPE"
        icon={ClipboardList}
        subtitle={isBlocked ? `${selectedPlayer.name} is marked as ${rpe.attendance} for today` : `Session type: ${rpe.sessionType} • Duration: ${rpe.duration || 0} min`}
        right={<div className="rounded-full bg-amber-300 px-3 py-1 text-sm font-semibold text-slate-950">Load {Number(rpe.duration || 0) * Number(rpe.rpe || 0)}</div>}
      >
        {isBlocked ? (
          <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-300">
            This player does not need to submit an RPE today because the admin marked the attendance status as <span className="font-semibold text-white">{rpe.attendance}</span>.
          </div>
        ) : (
          <div className="grid gap-4">
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
              <p className="text-sm font-semibold text-white">RPE Scale Guide</p>
              <div className="mt-3 grid gap-2 text-sm text-slate-300 md:grid-cols-2">
                <p>0–1 = Super Light</p>
                <p>2–3 = Light</p>
                <p>4–5 = Moderate / Somewhat Hard</p>
                <p>6–7 = High / Vigorous</p>
                <p>8–9 = Very Hard</p>
                <p>10 = Maximum Effort</p>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-300">
              Admin-controlled session setup: <span className="font-semibold text-white">{rpe.sessionType}</span> • <span className="font-semibold text-white">{rpe.duration || 0} minutes</span>
            </div>
            <RangeField
              label="Session RPE"
              value={rpe.rpe}
              onChange={(v) => setRpe({ ...rpe, rpe: v })}
              min={1}
              max={10}
              lowBad
              leftLabel="Super Light"
              rightLabel="Maximum"
            />
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
              <p className="text-sm font-semibold text-white">Body Check</p>
              <p className="mt-1 text-sm text-slate-300">Body check helps the staff monitor muscle soreness or pain after training or game.</p>
              <div className="mt-4 grid gap-2 md:grid-cols-4">
                {BODY_CHECK_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setRpe({ ...rpe, bodyCheck: option, painArea: option === "None" ? "" : rpe.painArea })}
                    className={cn(
                      "rounded-2xl border px-3 py-3 text-sm font-medium transition",
                      rpe.bodyCheck === option
                        ? "border-sky-300 bg-sky-300 text-slate-950"
                        : "border-white/10 bg-slate-950/60 text-white hover:bg-white/10"
                    )}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            {rpe.bodyCheck !== "None" && (
              <textarea
                value={rpe.painArea || ""}
                onChange={(e) => setRpe({ ...rpe, painArea: e.target.value })}
                placeholder="If you are experiencing pain, please specify the area"
                className="min-h-[96px] rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-sm text-white outline-none placeholder:text-slate-500"
              />
            )}
            <textarea
              value={rpe.comment || ""}
              onChange={(e) => setRpe({ ...rpe, comment: e.target.value })}
              placeholder="Optional comment"
              className="min-h-[96px] rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-sm text-white outline-none placeholder:text-slate-500"
            />
            <button
  onClick={saveRpe}
  disabled={rpeSubmitted}
  className={cn(
    "rounded-2xl px-4 py-4 font-semibold transition",
    rpeSubmitted
      ? "cursor-not-allowed bg-slate-700 text-slate-300"
      : "bg-amber-300 text-slate-950 hover:scale-[1.01]"
  )}
>
  {rpeSubmitted ? "RPE already submitted" : "Save RPE entry"}
</button>
          </div>
        )}
            </SectionCard>
    </div>
  </div>
);
}

function AdminSessionSetup({ players, sessionEntries, setSessionEntries }) {
  const [sessionDate, setSessionDate] = useState(todayKey());
  const [sessionType, setSessionType] = useState("Training");
  const [duration, setDuration] = useState(75);
  const [targetRpe, setTargetRpe] = useState(5);
  const [attendanceMap, setAttendanceMap] = useState({});

  const sessionExists = sessionEntries.some(
  (s) => s.date === sessionDate
);

  useEffect(() => {
    const seeded = {};
    players.forEach((player) => {
      const existing = sessionEntries.find((entry) => entry.playerId === player.id && entry.date === sessionDate);
      seeded[player.id] = existing?.attendance || "Present";
    });
    setAttendanceMap(seeded);
  }, [players, sessionDate, sessionEntries]);

  const saveSessionSetup = async () => {
    const payload = players.map((player) => {
      const existing = sessionEntries.find((entry) => entry.playerId === player.id && entry.date === sessionDate);
      const attendance = attendanceMap[player.id] || "Present";
      const allowed = ["Present", "Modified", "Rehab"].includes(attendance);
      return {
  playerId: player.id,
  date: sessionDate,
  sessionType,
  attendance,
  duration: allowed ? Number(duration) : 0,
  rpe: existing?.rpe || 0,
  targetRpe: Number(targetRpe),
  plannedLoad: allowed ? Number(duration) * Number(targetRpe) : 0,
  comment: existing?.comment || "",
  bodyCheck: existing?.bodyCheck || "None",
  painArea: existing?.painArea || "",
  load: allowed ? Number(duration) * Number(existing?.rpe || 0) : 0,
};
    });
const supabasePayload = payload.map((entry) => ({
  session_date: entry.date,
  player_id: entry.playerId,
  session_type: entry.sessionType,
  attendance: entry.attendance,
  duration: entry.duration,
  planned_load: entry.duration * targetRpe,
  target_rpe: targetRpe,
}));

const { error: deleteError } = await supabase
  .from("session_setup")
  .delete()
  .eq("session_date", sessionDate);

if (deleteError) {
  console.error("DELETE SESSION SETUP ERROR:", deleteError);
  return;
}

const { data: insertedData, error: insertError } = await supabase
  .from("session_setup")
  .insert(supabasePayload)
  .select();

if (insertError) {
  console.error("INSERT SESSION SETUP ERROR:", insertError);
  return;
}

console.log("SESSION SETUP SAVED:", insertedData);

setSessionEntries((prev) => {
  const filtered = prev.filter((entry) => entry.date !== sessionDate);
  return [...filtered, ...payload];
});
};
  return (
    <SectionCard title="Admin Session Setup" icon={ClipboardList} subtitle="Set the session details and attendance before players submit RPE">
      <div className="grid gap-4 xl:grid-cols-[180px_180px_180px_180px_1fr]">
        <div>
          <label className="mb-2 block text-sm text-slate-200">Date</label>
          <input
            type="date"
            value={sessionDate}
            onChange={(e) => setSessionDate(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-white outline-none"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm text-slate-200">Session type</label>
          <select
            value={sessionType}
            onChange={(e) => setSessionType(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-white outline-none"
          >
            {SESSION_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-2 block text-sm text-slate-200">Duration</label>
          <input
            type="number"
            min="0"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-white outline-none"
          />
        </div>
        <div>
  <label className="mb-2 block text-sm text-slate-200">Target RPE</label>
  <input
    type="number"
    min="1"
    max="10"
    value={targetRpe}
    onChange={(e) => setTargetRpe(Number(e.target.value))}
    className="w-full rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-white outline-none"
  />
</div>

  {sessionExists && (
  <div className="rounded-2xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
    Session already exists for this date — updating will overwrite it
  </div>
)}
        
        <div className="flex items-end">
         <button
  onClick={saveSessionSetup}
  className="w-full rounded-2xl bg-white px-4 py-3 font-semibold text-slate-950 transition hover:scale-[1.01]"
>
  {sessionExists ? "Update existing session" : "Save session setup"}
</button>
        </div>
      </div>

      <div className="mt-5 overflow-x-auto rounded-3xl border border-white/10">
        <table className="min-w-full divide-y divide-white/10 text-sm">
          <thead className="bg-white/5 text-left text-slate-300">
            <tr>
              <th className="px-4 py-3">Player</th>
              <th className="px-4 py-3">Position</th>
              <th className="px-4 py-3">Attendance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10 bg-slate-950/30 text-slate-100">
            {players.map((player) => (
              <tr key={player.id}>
                <td className="px-4 py-3 font-medium">{player.name}</td>
                <td className="px-4 py-3 text-slate-300">{player.position}</td>
                <td className="px-4 py-3">
                  <select
                    value={attendanceMap[player.id] || "Present"}
                    onChange={(e) => setAttendanceMap({ ...attendanceMap, [player.id]: e.target.value })}
                    className="rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-white outline-none"
                  >
                    {ATTENDANCE_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

function AdminManualEntry({
  players,
  sessionEntries,
  wellnessEntries,
  setWellnessEntries,
  loadWellnessEntries,
  setSessionEntries,
}) {
  const [entryPlayerId, setEntryPlayerId] = useState(players[0]?.id || 1);
  const [entryDate, setEntryDate] = useState(todayKey());

  const [manualWellness, setManualWellness] = useState({
    sleep: 4,
    fatigue: 2,
    soreness: 2,
    stress: 2,
    mood: 4,
    freshness: 4,
    comment: "",
  });
  
  const [manualRpe, setManualRpe] = useState({
  rpe: 6,
  bodyCheck: "None",
  painArea: "",
  comment: "",
});

  useEffect(() => {
    const existingWellness = wellnessEntries.find(
      (w) => w.playerId === entryPlayerId && w.date === entryDate
    );
    const existingSession = sessionEntries.find(
  (s) => s.playerId === entryPlayerId && s.date === entryDate
);

    if (existingWellness) {
      setManualWellness({
        sleep: existingWellness.sleep ?? 4,
        fatigue: existingWellness.fatigue ?? 2,
        soreness: existingWellness.soreness ?? 2,
        stress: existingWellness.stress ?? 2,
        mood: existingWellness.mood ?? 4,
        freshness: existingWellness.freshness ?? 4,
        comment: existingWellness.comment || "",
      });
    } else {
      setManualWellness({
        sleep: 4,
        fatigue: 2,
        soreness: 2,
        stress: 2,
        mood: 4,
        freshness: 4,
        comment: "",
      });
    }
    if (existingSession) {
  setManualRpe({
    rpe: existingSession.rpe ?? 6,
    bodyCheck: existingSession.bodyCheck || "None",
    painArea: existingSession.painArea || "",
    comment: existingSession.comment || "",
  });
} else {
  setManualRpe({
    rpe: 6,
    bodyCheck: "None",
    painArea: "",
    comment: "",
  });
}
  }, [entryPlayerId, entryDate, wellnessEntries, sessionEntries]);
const saveManualWellness = async () => {
  const payload = {
    player_id: entryPlayerId,
    entry_date: entryDate,
    sleep: manualWellness.sleep,
    fatigue: manualWellness.fatigue,
    soreness: manualWellness.soreness,
    stress: manualWellness.stress,
    mood: manualWellness.mood,
    freshness: manualWellness.freshness,
    comment: manualWellness.comment || "",
  };

  const { error } = await supabase
  .from("wellness_entries")
  .insert([payload]);

if (error) {
  console.error("MANUAL WELLNESS ERROR:", error);
  return;
}

  setWellnessEntries((prev) => {
  const filtered = prev.filter(
    (w) => !(w.playerId === entryPlayerId && w.date === entryDate)
  );

  return [
    ...filtered,
    {
      playerId: entryPlayerId,
      date: entryDate,
      sleep: manualWellness.sleep,
      fatigue: manualWellness.fatigue,
      soreness: manualWellness.soreness,
      stress: manualWellness.stress,
      mood: manualWellness.mood,
      freshness: manualWellness.freshness,
      comment: manualWellness.comment || "",
    },
  ];
});
};
  const saveManualRpe = async () => {
  const existingSession = sessionEntries.find(
    (s) => s.playerId === entryPlayerId && s.date === entryDate
  );

  const payload = {
    player_id: entryPlayerId,
    session_id: null,
    rpe: Number(manualRpe.rpe),
    soreness_level: (manualRpe.bodyCheck || "None").toLowerCase(),
    pain_comment:
      manualRpe.bodyCheck === "None"
        ? ""
        : manualRpe.painArea || "",
    attendance: (
      existingSession?.attendance || "Present"
    ).toLowerCase(),
  };

  const { data: existingRows, error: fetchError } = await supabase
  .from("rpe_entries")
  .select("id, created_at")
  .eq("player_id", entryPlayerId)
  .order("created_at", { ascending: false });

if (fetchError) {
  console.error("FETCH MANUAL RPE ERROR:", fetchError);
  return;
}

const rowToDelete = existingRows?.find(
  (row) => row.created_at?.slice(0, 10) === entryDate
);

if (rowToDelete) {
  const { error: deleteError } = await supabase
    .from("rpe_entries")
    .delete()
    .eq("id", rowToDelete.id);

  if (deleteError) {
    console.error("DELETE MANUAL RPE ERROR:", deleteError);
    return;
  }
}

const { error: insertError } = await supabase
  .from("rpe_entries")
  .insert([payload]);

if (insertError) {
  console.error("MANUAL RPE ERROR:", insertError);
  return;
}

  const duration = Number(existingSession?.duration || 0);
  const plannedLoad = Number(existingSession?.plannedLoad || 0);
  const targetRpe = Number(existingSession?.targetRpe || 0);

  setSessionEntries((prev) => {
    const filtered = prev.filter(
      (s) =>
        !(
          s.playerId === entryPlayerId &&
          s.date === entryDate
        )
    );

    return [
      ...filtered,
      {
        playerId: entryPlayerId,
        date: entryDate,
        rpe: Number(manualRpe.rpe),
        duration,
        attendance:
          existingSession?.attendance ||
          "Present",
        bodyCheck: manualRpe.bodyCheck || "None",
        painArea: manualRpe.painArea || "",
        comment: manualRpe.comment || "",
        sessionType:
          existingSession?.sessionType ||
          "Training",
        targetRpe,
        plannedLoad,
        load: duration * Number(manualRpe.rpe),
      },
    ];
  });
};
  
const wellnessExists = wellnessEntries.some(
  (w) => w.playerId === entryPlayerId && w.date === entryDate
);

const rpeExists = sessionEntries.some(
  (s) =>
    s.playerId === entryPlayerId &&
    s.date === entryDate &&
    Number(s.rpe || 0) > 0
);
  
return (
    <SectionCard
      title="Admin Manual Entry"
      icon={ClipboardList}
      subtitle="Add or correct wellness and RPE entries for past or missed submissions"
    >
      <div className="grid gap-4 md:grid-cols-[1fr_180px]">

        <div className="mt-3 text-sm text-slate-300">
  Wellness:{" "}
  <span className={wellnessExists ? "text-emerald-400" : "text-red-400"}>
    {wellnessExists ? "OK" : "Missing"}
  </span>

  {"  |  "}

  RPE:{" "}
  <span className={rpeExists ? "text-emerald-400" : "text-red-400"}>
    {rpeExists ? "OK" : "Missing"}
  </span>
</div>
        
        <div>
          <label className="mb-2 block text-sm text-slate-200">Player</label>
          <select
            value={entryPlayerId}
            onChange={(e) => setEntryPlayerId(Number(e.target.value))}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-white outline-none"
          >
            {players.map((player) => (
              <option key={player.id} value={player.id}>
                {player.name} — {player.position}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm text-slate-200">Date</label>
          <input
            type="date"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-white outline-none"
          />
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <RangeField
          label="Sleep quality"
          value={manualWellness.sleep}
          onChange={(v) => setManualWellness({ ...manualWellness, sleep: v })}
          lowBad
        />
        <RangeField
          label="Fatigue"
          value={manualWellness.fatigue}
          onChange={(v) => setManualWellness({ ...manualWellness, fatigue: v })}
        />
        <RangeField
          label="Muscle soreness"
          value={manualWellness.soreness}
          onChange={(v) => setManualWellness({ ...manualWellness, soreness: v })}
        />
        <RangeField
          label="Stress"
          value={manualWellness.stress}
          onChange={(v) => setManualWellness({ ...manualWellness, stress: v })}
        />
        <RangeField
          label="Mood"
          value={manualWellness.mood}
          onChange={(v) => setManualWellness({ ...manualWellness, mood: v })}
          lowBad
        />
        <RangeField
          label="Freshness"
          value={manualWellness.freshness}
          onChange={(v) => setManualWellness({ ...manualWellness, freshness: v })}
          lowBad
        />
      </div>

      <div className="mt-4">
        <label className="mb-2 block text-sm text-slate-200">Wellness comment</label>
        <textarea
  value={manualWellness.comment}
  onChange={(e) => setManualWellness({ ...manualWellness, comment: e.target.value })}
  placeholder="Optional note"
  className="min-h-[96px] w-full rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-sm text-white outline-none placeholder:text-slate-500"
/>
</div>

<div className="mt-8 rounded-3xl border border-white/10 bg-slate-950/30 p-4">
  <p className="mb-4 text-sm font-semibold text-white">Manual RPE Entry</p>

  <div className="grid gap-4">
    <RangeField
      label="Session RPE"
      value={manualRpe.rpe}
      onChange={(v) => setManualRpe({ ...manualRpe, rpe: v })}
      min={1}
      max={10}
      lowBad
      leftLabel="Super Light"
      rightLabel="Maximum"
    />

    <div>
      <label className="mb-2 block text-sm text-slate-200">Body Check</label>
      <div className="grid gap-2 md:grid-cols-4">
        {BODY_CHECK_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() =>
              setManualRpe({
                ...manualRpe,
                bodyCheck: option,
                painArea: option === "None" ? "" : manualRpe.painArea,
              })
            }
            className={cn(
              "rounded-2xl border px-3 py-3 text-sm font-medium transition",
              manualRpe.bodyCheck === option
                ? "border-sky-300 bg-sky-300 text-slate-950"
                : "border-white/10 bg-slate-950/60 text-white hover:bg-white/10"
            )}
          >
            {option}
          </button>
        ))}
      </div>
    </div>

    {manualRpe.bodyCheck !== "None" && (
      <textarea
        value={manualRpe.painArea}
        onChange={(e) => setManualRpe({ ...manualRpe, painArea: e.target.value })}
        placeholder="Pain area"
        className="min-h-[80px] rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-sm text-white outline-none placeholder:text-slate-500"
      />
    )}

    <textarea
      value={manualRpe.comment}
      onChange={(e) => setManualRpe({ ...manualRpe, comment: e.target.value })}
      placeholder="Optional RPE comment"
      className="min-h-[80px] rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-sm text-white outline-none placeholder:text-slate-500"
    />
  </div>
</div>

<div className="mt-4">
  <button
    onClick={saveManualWellness}
    className="rounded-2xl bg-emerald-400 px-4 py-3 font-semibold text-slate-950 hover:scale-[1.01]"
  >
    Save wellness entry
  </button>
</div>

<div className="mt-3">
  <button
    onClick={saveManualRpe}
    className="rounded-2xl bg-amber-300 px-4 py-3 font-semibold text-slate-950 hover:scale-[1.01]"
  >
    Save RPE entry
  </button>
</div>
    </SectionCard>
  );
}

function StaffDashboard({
  players,
  wellnessEntries,
  sessionEntries,
  setHistoryPlayerId,
  selectedDate,
  setSelectedDate,
  historyPlayerId,
}) {
  const today = selectedDate;
  const last7Days = getLast7Days(selectedDate);
  const last4Days = last7Days.slice(-4);

  const microcycleData = last7Days.map((date) => {
    const wellnessCount = wellnessEntries.filter((w) => w.date === date).length;
    const daySessions = sessionEntries.filter((s) => s.date === date);

    const submittedSessions = daySessions.filter((s) => Number(s.rpe || 0) > 0);

    const totalLoadSum = submittedSessions.reduce(
      (sum, s) => sum + Number(s.load || 0),
      0
    );

    const totalLoad = submittedSessions.length
      ? Math.round(totalLoadSum / submittedSessions.length)
      : 0;

    const plannedSum = daySessions.reduce(
      (sum, s) => sum + Number(s.plannedLoad || 0),
      0
    );

    const plannedLoad = daySessions.length
      ? Math.round(plannedSum / daySessions.length)
      : 0;

    const diff = totalLoad - plannedLoad;

    return {
      date,
      wellnessCount,
      totalLoad,
      plannedLoad,
      diff,
    };
  });

  const todayWellness = players.map((p) => {
    const entry = wellnessEntries.find((w) => w.playerId === p.id && w.date === today);
    const todaySession = sessionEntries.find((s) => s.playerId === p.id && s.date === today);
    const load7 = sumLoads(sessionEntries, p.id, 7);
    const load15 = sumLoads(sessionEntries, p.id, 15);
    const load30 = sumLoads(sessionEntries, p.id, 30);
    const attendance30 = attendanceSummary(sessionEntries, p.id, 30);

    const flags = [];
    if (!entry) flags.push("Missing form");
    if (entry?.sleep === 1) flags.push("Poor sleep");
    if (entry?.fatigue >= 4) flags.push("High fatigue");
    if (entry?.soreness >= 4) flags.push("High soreness");
    if (entry?.stress >= 4) flags.push("High stress");
    if ((entry?.comment || "").trim()) flags.push("Pain note");
    if (todaySession?.bodyCheck && todaySession.bodyCheck !== "None") {
      flags.push(`Body check: ${todaySession.bodyCheck}`);
    }

    return {
      ...p,
      readiness: scoreReadiness(entry),
      comment: entry?.comment || "",
      sleep: entry?.sleep ?? null,
      fatigue: entry?.fatigue ?? null,
      soreness: entry?.soreness ?? null,
      stress: entry?.stress ?? null,
      mood: entry?.mood ?? null,
      freshness: entry?.freshness ?? null,
      load7,
      load15,
      load30,
      attendance30,
      todaySession,
      flags,
    };
  });

  const atRisk = todayWellness.filter((p) => p.readiness !== null && p.readiness < 60);
  const missingForms = todayWellness.filter((p) => p.readiness === null).length;
  const painAlerts = sessionEntries.filter(
    (s) => s.date === today && s.bodyCheck && s.bodyCheck !== "None"
  ).length;

  const avgReadiness = todayWellness
    .filter((p) => p.readiness !== null)
    .reduce((acc, p, _, arr) => acc + p.readiness / arr.length, 0);

  const todayLoads = sessionEntries.filter((s) => s.date === today);
  const avgTodayLoad = todayLoads.length
    ? Math.round(todayLoads.reduce((a, b) => a + b.load, 0) / todayLoads.length)
    : 0;

  const completedWellness = todayWellness.filter((p) => p.readiness !== null).length;

  const teamLoadCards = LOAD_WINDOWS.map((window) => {
    const values = todayWellness
      .map((p) =>
        window.days === 7 ? p.load7 : window.days === 15 ? p.load15 : p.load30
      )
      .filter((value) => value > 0);

    const averageLoad = values.length
      ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
      : 0;

    return {
      label: window.label,
      value: averageLoad,
    };
  });

  const loadByDay = useMemo(() => {
    return last4Days.map((date) => {
      const daySessions = sessionEntries.filter((s) => s.date === date);
      const submittedSessions = daySessions.filter((s) => Number(s.rpe || 0) > 0);

      const totalLoadSum = submittedSessions.reduce(
        (sum, s) => sum + Number(s.load || 0),
        0
      );

      const plannedLoadSum = submittedSessions.reduce(
        (sum, s) => sum + Number(s.plannedLoad || 0),
        0
      );

      return {
        date,
        avgLoad: submittedSessions.length
          ? Math.round(totalLoadSum / submittedSessions.length)
          : 0,
        avgPlannedLoad: submittedSessions.length
          ? Math.round(plannedLoadSum / submittedSessions.length)
          : 0,
      };
    });
  }, [sessionEntries, last4Days]);

  const playerLoadHistory = last7Days.map((date) => {
    const daySessions = sessionEntries.filter((s) => s.date === date);

    const selectedPlayerEntry = daySessions.find(
      (s) => s.playerId === historyPlayerId
    );

    const otherPlayers = daySessions.filter(
      (s) => s.playerId !== historyPlayerId && Number(s.rpe || 0) > 0
    );

    const otherPlayersAverage = otherPlayers.length
      ? Math.round(
          otherPlayers.reduce((sum, s) => sum + Number(s.load || 0), 0) /
            otherPlayers.length
        )
      : 0;

    const targetLoad =
      selectedPlayerEntry && Number(selectedPlayerEntry.plannedLoad || 0) > 0
        ? Number(selectedPlayerEntry.plannedLoad || 0)
        : 0;

    return {
      date,
      selectedLoad: selectedPlayerEntry
        ? Number(selectedPlayerEntry.load || 0)
        : 0,
      squadAverageLoad: otherPlayersAverage,
      targetLoad,
    };
  });

  const teamReadinessTrend = last7Days.map((date) => {
    const dayWellness = wellnessEntries.filter((w) => w.date === date);

    const readinessValues = dayWellness
      .map((w) => scoreReadiness(w))
      .filter((value) => value !== null);

    const averageReadiness = readinessValues.length
      ? Math.round(
          readinessValues.reduce((sum, value) => sum + value, 0) /
            readinessValues.length
        )
      : null;

    return {
      date,
      averageReadiness,
    };
  });

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-slate-300">Date</span>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="rounded-2xl border border-white/20 bg-white px-3 py-2 text-black cursor-pointer"
        />
        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
          Viewing: {selectedDate}
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard
          label="Wellness completed"
          value={`${completedWellness}/${players.length}`}
          hint="Selected date"
          icon={Users}
          tone="blue"
        />
        <StatCard
          label="Average readiness"
          value={Number.isFinite(avgReadiness) ? `${Math.round(avgReadiness)}%` : "--"}
          hint="Squad average"
          icon={HeartPulse}
          tone="green"
        />
        <StatCard
          label="Players at risk"
          value={atRisk.length}
          hint="Readiness under 60%"
          icon={AlertTriangle}
          tone={atRisk.length ? "red" : "green"}
        />
        <StatCard
          label="Average session load"
          value={avgTodayLoad || "--"}
          hint="Selected date"
          icon={Activity}
          tone="amber"
        />
        <StatCard
          label="Missing wellness forms"
          value={missingForms}
          hint="Players still to complete"
          icon={ClipboardList}
          tone={missingForms ? "amber" : "green"}
        />
        <StatCard
          label="Body check alerts"
          value={painAlerts}
          hint="Minor, moderate, or high"
          icon={AlertTriangle}
          tone={painAlerts ? "red" : "green"}
        />
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        {teamLoadCards.map((card) => (
          <StatCard
            key={card.label}
            label={`Team load ${card.label}`}
            value={card.value}
            hint="Rolling load window"
            icon={BarChart3}
            tone="blue"
          />
        ))}
      </div>

      <SectionCard
        title="Microcycle View"
        icon={BarChart3}
        subtitle="7-day overview up to selected date"
      >
        <div className="overflow-x-auto rounded-3xl border border-white/10">
          <table className="min-w-full divide-y divide-white/10 text-sm">
            <thead className="bg-white/5 text-left text-slate-300">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Wellness Forms</th>
                <th className="px-4 py-3">Planned Load</th>
                <th className="px-4 py-3">Actual Load</th>
                <th className="px-4 py-3">Diff</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 bg-slate-950/30 text-slate-100">
              {microcycleData.map((day) => (
                <tr key={day.date}>
                  <td className="px-4 py-3">{day.date}</td>
                  <td className="px-4 py-3">{day.wellnessCount}</td>
                  <td className="px-4 py-3 text-red-300">{day.plannedLoad}</td>
                  <td className="px-4 py-3">{day.totalLoad}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        day.diff > 0
                          ? "text-red-400"
                          : day.diff < 0
                            ? "text-emerald-400"
                            : ""
                      }
                    >
                      {day.diff}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="grid gap-6 grid-cols-1 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard
          title="Planned vs Actual Load Trend"
          icon={BarChart3}
          subtitle="Average planned load vs actual internal load by day"
        >
          <div className="mb-3 flex gap-4 text-sm text-slate-300">
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full bg-white" />
              <span>Actual Load</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full bg-red-500" />
              <span>Planned Load</span>
            </div>
          </div>

          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={loadByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#cbd5e1" fontSize={12} />
                <YAxis stroke="#cbd5e1" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: "#020617",
                    border: "1px solid #334155",
                    borderRadius: 16,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="avgLoad"
                  stroke="#ffffff"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="avgPlannedLoad"
                  stroke="#ef4444"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard
          title="Team Average Readiness Trend"
          icon={Moon}
          subtitle="7-day window from selected date"
        >
          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={teamReadinessTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#cbd5e1" fontSize={12} />
                <YAxis domain={[0, 100]} stroke="#cbd5e1" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: "#020617",
                    border: "1px solid #334155",
                    borderRadius: 16,
                  }}
                  formatter={(value, name) => {
                    if (name === "averageReadiness") {
                      return [value, "Team Average Readiness"];
                    }
                    return [value, name];
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="averageReadiness"
                  stroke="#34d399"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Selected Player Load History"
        icon={BarChart3}
        subtitle="7-day window from selected date"
      >
        <div className="mb-3 flex gap-4 text-sm text-slate-300">
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full bg-sky-400" />
            <span>Selected Player</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full bg-white" />
            <span>Other Players Average</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full bg-amber-300" />
            <span>Target Load</span>
          </div>
        </div>

        <div className="h-64 sm:h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={playerLoadHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" stroke="#cbd5e1" fontSize={12} />
              <YAxis stroke="#cbd5e1" fontSize={12} />
              <Tooltip
                contentStyle={{
                  background: "#020617",
                  border: "1px solid #334155",
                  borderRadius: 16,
                }}
                formatter={(value, name) => {
                  if (name === "selectedLoad") return [value, "Selected Player"];
                  if (name === "squadAverageLoad") return [value, "Squad Average"];
                  if (name === "targetLoad") return [value, "Target Load"];
                  return [value, name];
                }}
              />
              <Line
                type="monotone"
                dataKey="selectedLoad"
                stroke="#38bdf8"
                strokeWidth={3}
                dot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="squadAverageLoad"
                stroke="#ffffff"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="targetLoad"
                stroke="#fcd34d"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <SectionCard
        title="Daily player status"
        icon={Timer}
        subtitle="Simple traffic-light view for staff discussion before training"
      >
        <div className="overflow-x-auto rounded-3xl border border-white/10">
          <table className="min-w-full divide-y divide-white/10 text-sm">
            <thead className="bg-white/5 text-left text-slate-300">
              <tr>
                <th className="px-4 py-3">Player</th>
                <th className="px-4 py-3">Position</th>
                <th className="px-4 py-3">Readiness</th>
                <th className="px-4 py-3">Sleep</th>
                <th className="px-4 py-3">Flags</th>
                <th className="px-4 py-3">7d</th>
                <th className="px-4 py-3">15d</th>
                <th className="px-4 py-3">30d</th>
                <th className="px-4 py-3">RPE</th>
                <th className="px-4 py-3">Attend %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 bg-slate-950/30 text-slate-100">
              {todayWellness.map((p) => {
                const tone =
                  p.readiness == null
                    ? "bg-slate-500"
                    : p.readiness < 60
                      ? "bg-red-500"
                      : p.readiness < 75
                        ? "bg-amber-400"
                        : "bg-emerald-500";

                return (
                  <tr
                    key={p.id}
                    className="cursor-pointer hover:bg-white/5"
                    onClick={() => setHistoryPlayerId(p.id)}
                  >
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-slate-300">{p.position}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs">
                        <span className={cn("h-2.5 w-2.5 rounded-full", tone)} />
                        {p.readiness ?? "--"}
                        {p.readiness != null ? "%" : ""}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {p.sleep ?? "--"}
                      {p.sleep != null ? "/5" : ""}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {p.flags.length ? p.flags.slice(0, 2).join(", ") : "None"}
                    </td>
                    <td className="px-4 py-3">{p.load7}</td>
                    <td className="px-4 py-3">{p.load15}</td>
                    <td className="px-4 py-3">{p.load30}</td>
                    <td className="px-4 py-3">{p.todaySession?.rpe ? p.todaySession.rpe : "--"}</td>
                    <td className="px-4 py-3">{p.attendance30.percent}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        title="Wellness Details"
        icon={HeartPulse}
        subtitle="Full wellness breakdown for each player"
      >
        <div className="overflow-x-auto rounded-3xl border border-white/10">
          <table className="min-w-full divide-y divide-white/10 text-sm">
            <thead className="bg-white/5 text-left text-slate-300">
              <tr>
                <th className="px-4 py-3">Player</th>
                <th className="px-4 py-3">Sleep</th>
                <th className="px-4 py-3">Fatigue</th>
                <th className="px-4 py-3">Soreness</th>
                <th className="px-4 py-3">Stress</th>
                <th className="px-4 py-3">Mood</th>
                <th className="px-4 py-3">Freshness</th>
                <th className="px-4 py-3">Comment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 bg-slate-950/30 text-slate-100">
              {todayWellness.map((p) => (
                <tr key={`wellness-${p.id}`}>
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3">{p.sleep ?? "--"}</td>
                  <td className="px-4 py-3">{p.fatigue ?? "--"}</td>
                  <td className="px-4 py-3">{p.soreness ?? "--"}</td>
                  <td className="px-4 py-3">{p.stress ?? "--"}</td>
                  <td className="px-4 py-3">{p.mood ?? "--"}</td>
                  <td className="px-4 py-3">{p.freshness ?? "--"}</td>
                  <td className="px-4 py-3 text-slate-300">{p.comment || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

function PlayerHistory({ selectedPlayer, wellnessEntries, sessionEntries }) {
  const playerWellness = [...wellnessEntries]
    .filter((w) => w.playerId === selectedPlayer.id)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7);

  const playerSessions = [...sessionEntries]
    .filter((s) => s.playerId === selectedPlayer.id)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);

  const loads = {
    load7: sumLoads(sessionEntries, selectedPlayer.id, 7),
    load15: sumLoads(sessionEntries, selectedPlayer.id, 15),
    load30: sumLoads(sessionEntries, selectedPlayer.id, 30),
  };

  const attendance = attendanceSummary(sessionEntries, selectedPlayer.id, 30);

  const latestWellness = [...wellnessEntries]
    .filter((w) => w.playerId === selectedPlayer.id)
    .sort((a, b) => b.date.localeCompare(a.date))[0];

  const latestSession = [...sessionEntries]
    .filter((s) => s.playerId === selectedPlayer.id)
    .sort((a, b) => b.date.localeCompare(a.date))[0];

  const latestReadiness = latestWellness ? scoreReadiness(latestWellness) : null;

  let profileStatus = "Green";
  let profileStatusLabel = "Ready";

  if (
    (latestReadiness !== null && latestReadiness < 60) ||
    (latestSession?.bodyCheck &&
      latestSession.bodyCheck !== "None" &&
      latestSession.bodyCheck !== "Minor")
  ) {
    profileStatus = "Red";
    profileStatusLabel = "Alert";
  } else if (
    (latestReadiness !== null && latestReadiness < 75) ||
    (latestSession?.bodyCheck && latestSession.bodyCheck !== "None")
  ) {
    profileStatus = "Amber";
    profileStatusLabel = "Monitor";
  }

  const profileStatusClasses =
    profileStatus === "Red"
      ? "bg-red-500/20 text-red-200 border-red-400/30"
      : profileStatus === "Amber"
        ? "bg-amber-400/20 text-amber-200 border-amber-300/30"
        : "bg-emerald-500/20 text-emerald-200 border-emerald-400/30";

  const playerLoadTrend = getLast7Days(todayKey()).map((date) => {
    const session = sessionEntries.find(
      (s) => s.playerId === selectedPlayer.id && s.date === date
    );

    return {
      date,
      load: session ? Number(session.load || 0) : 0,
      rpe: session ? Number(session.rpe || 0) : 0,
    };
  });

  const playerReadinessTrend = getLast7Days(todayKey()).map((date) => {
    const wellness = wellnessEntries.find(
      (w) => w.playerId === selectedPlayer.id && w.date === date
    );

    return {
      date,
      readiness: wellness ? scoreReadiness(wellness) : null,
    };
  });

  const exportPlayerPdf = () => {
  const doc = new jsPDF();

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // Top color bar
  doc.setFillColor(10, 24, 60); // navy
  doc.rect(0, 0, pageWidth, 12, "F");

  doc.setFillColor(245, 197, 24); // gold
  doc.rect(0, 12, pageWidth * 0.72, 3, "F");

  doc.setFillColor(200, 30, 45); // red accent
  doc.rect(pageWidth * 0.72, 12, pageWidth * 0.28, 3, "F");

  // Header
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("BONIVITAL SC", 14, 9);

  y = 28;
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Performance Monitor", 14, y);

  y += 8;
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text("Individual Player Report", 14, y);

  // Player identity block
  y += 14;
  doc.setDrawColor(220, 226, 235);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, y - 5, 182, 26, 3, 3, "FD");

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text(selectedPlayer.name, 18, y + 4);

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text(`Position: ${selectedPlayer.position}`, 18, y + 12);
  doc.text(`Status: ${profileStatusLabel}`, 90, y + 12);

  y += 32;

  // Section title helper
  const sectionTitle = (title) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(10, 24, 60);
    doc.text(title, 14, y);
    y += 6;

    doc.setDrawColor(230, 235, 240);
    doc.line(14, y, 196, y);
    y += 8;
  };

  sectionTitle("Current Snapshot");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);

  doc.text(
    `Latest Readiness: ${latestReadiness !== null ? `${latestReadiness}%` : "--"}`,
    14,
    y
  );
  y += 7;

  doc.text(`Latest Body Check: ${latestSession?.bodyCheck || "None"}`, 14, y);
  y += 10;

  sectionTitle("Load Summary");

  doc.text(`Load 7d: ${loads.load7}`, 14, y);
  y += 7;
  doc.text(`Load 15d: ${loads.load15}`, 14, y);
  y += 7;
  doc.text(`Load 30d: ${loads.load30}`, 14, y);
  y += 7;
  doc.text(`Attendance 30d: ${attendance.percent}%`, 14, y);
  y += 10;

  sectionTitle("Latest Wellness Note");

  const latestComment = latestWellness?.comment?.trim()
    ? latestWellness.comment
    : "No recent wellness comment.";

  doc.setFont("helvetica", "normal");
  const wrappedComment = doc.splitTextToSize(latestComment, 180);
  doc.text(wrappedComment, 14, y);
  y += wrappedComment.length * 6 + 8;

  sectionTitle("Recent Session History");

  doc.setFontSize(10);

  playerSessions.slice(0, 5).forEach((s) => {
    const line = `${s.date} | ${s.sessionType || "—"} | ${s.attendance || "—"} | Load: ${s.load || 0} | Body check: ${s.bodyCheck || "None"}`;
    const wrapped = doc.splitTextToSize(line, 180);
    doc.text(wrapped, 14, y);
    y += wrapped.length * 5 + 4;
  });

  // Footer
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setDrawColor(230, 235, 240);
  doc.line(14, pageHeight - 18, 196, pageHeight - 18);

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("Bonivital Performance Monitor", 14, pageHeight - 10);
  doc.text(new Date().toLocaleDateString(), 170, pageHeight - 10);

  doc.save(`${selectedPlayer.name.replace(/\s+/g, "_")}_report.pdf`);
};
  
  return (
    <SectionCard
      title="Player Profile"
      icon={Users}
      subtitle={`Performance overview for ${selectedPlayer.name}`}
    >
      <div className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-amber-300">
              Player Overview
            </p>
            <h2 className="mt-1 text-2xl font-bold text-white">
              {selectedPlayer.name}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Position: {selectedPlayer.position}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
  onClick={exportPlayerPdf}
  className="rounded-2xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-200 hover:bg-amber-400/20"
>
  Export PDF Report
</button>
            <div className={cn("rounded-2xl border px-4 py-3", profileStatusClasses)}>
              <p className="text-xs opacity-80">Current status</p>
              <p className="text-sm font-semibold">{profileStatusLabel}</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3">
              <p className="text-xs text-slate-400">Latest readiness</p>
              <p className="text-sm font-semibold text-white">
                {latestReadiness !== null ? `${latestReadiness}%` : "--"}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3">
              <p className="text-xs text-slate-400">Latest body check</p>
              <p className="text-sm font-semibold text-white">
                {latestSession?.bodyCheck || "None"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Load 7d" value={loads.load7} hint="Rolling window" tone="blue" />
        <StatCard label="Load 15d" value={loads.load15} hint="Rolling window" tone="blue" />
        <StatCard label="Load 30d" value={loads.load30} hint="Rolling window" tone="blue" />
        <StatCard
          label="Attendance 30d"
          value={`${attendance.percent}%`}
          hint={`${attendance.attended}/${attendance.total} sessions`}
          tone="green"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="mb-4">
            <p className="text-sm font-semibold text-white">Load Trend</p>
            <p className="text-sm text-slate-400">
              Last 7 days internal load for {selectedPlayer.name}
            </p>
          </div>

          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={playerLoadTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#cbd5e1" fontSize={12} />
                <YAxis stroke="#cbd5e1" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: "#020617",
                    border: "1px solid #334155",
                    borderRadius: 16,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="load"
                  stroke="#fcd34d"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="mb-4">
            <p className="text-sm font-semibold text-white">Readiness Trend</p>
            <p className="text-sm text-slate-400">
              Last 7 days readiness score for {selectedPlayer.name}
            </p>
          </div>

          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={playerReadinessTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#cbd5e1" fontSize={12} />
                <YAxis domain={[0, 100]} stroke="#cbd5e1" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: "#020617",
                    border: "1px solid #334155",
                    borderRadius: 16,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="readiness"
                  stroke="#34d399"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <div className="overflow-x-auto rounded-3xl border border-white/10">
          <table className="min-w-full divide-y divide-white/10 text-sm">
            <thead className="bg-white/5 text-left text-slate-300">
              <tr>
                <th className="px-4 py-3">Wellness date</th>
                <th className="px-4 py-3">Readiness</th>
                <th className="px-4 py-3">Comment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 bg-slate-950/30 text-slate-100">
              {playerWellness.map((w, idx) => (
                <tr key={`${w.date}-${idx}`}>
                  <td className="px-4 py-3">{w.date}</td>
                  <td className="px-4 py-3">{scoreReadiness(w)}%</td>
                  <td className="px-4 py-3 text-slate-300">{w.comment || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="overflow-x-auto rounded-3xl border border-white/10">
          <table className="min-w-full divide-y divide-white/10 text-sm">
            <thead className="bg-white/5 text-left text-slate-300">
              <tr>
                <th className="px-4 py-3">Session date</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Attendance</th>
                <th className="px-4 py-3">Load</th>
                <th className="px-4 py-3">Body check</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 bg-slate-950/30 text-slate-100">
              {playerSessions.map((s, idx) => (
                <tr key={`${s.date}-${idx}`}>
                  <td className="px-4 py-3">{s.date}</td>
                  <td className="px-4 py-3">{s.sessionType || "—"}</td>
                  <td className="px-4 py-3">{s.attendance || "—"}</td>
                  <td className="px-4 py-3">{s.load || 0}</td>
                  <td className="px-4 py-3 text-slate-300">
                    {s.bodyCheck && s.bodyCheck !== "None"
                      ? `${s.bodyCheck}${s.painArea ? ` • ${s.painArea}` : ""}`
                      : "None"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </SectionCard>
  );
}
export default function PlayerLoadMonitorApp() {
  const [mode, setMode] = useState("staff");
  const [players, setPlayers] = useState(DEFAULT_PLAYERS);
  const [selectedPlayerId, setSelectedPlayerId] = useState(1);
  const [historyPlayerId, setHistoryPlayerId] = useState(1);
  const [wellnessEntries, setWellnessEntries] = useState(seedWellness);
  const [sessionEntries, setSessionEntries] = useState([]);
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [newPlayer, setNewPlayer] = useState({ name: "", position: "" });
  const [session, setSession] = useState(null);
const [authLoading, setAuthLoading] = useState(true);
  const [currentProfile, setCurrentProfile] = useState(null);
const [profileLoading, setProfileLoading] = useState(true);
  const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
const [loginError, setLoginError] = useState("");

  const [authMode, setAuthMode] = useState("login");
const [signupName, setSignupName] = useState("");
const [signupPosition, setSignupPosition] = useState("");
const [signupRole, setSignupRole] = useState("player");

  const [authLoadingAction, setAuthLoadingAction] = useState(false);
const [authSuccessMessage, setAuthSuccessMessage] = useState("");
  
  const isAdmin = currentProfile?.role === "admin";

const selectedPlayer = isAdmin
  ? players.find((p) => p.id === selectedPlayerId) || players[0]
  : players.find((p) => p.id === currentProfile?.id) || currentProfile || players[0];

const historyPlayer = isAdmin
  ? players.find((p) => p.id === historyPlayerId) || selectedPlayer
  : selectedPlayer;

  const exportToCsv = (filename, rows) => {
  if (!rows || !rows.length) return;

  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) => {
          const value = row[header] ?? "";
          return `"${String(value).replace(/"/g, '""')}"`;
        })
        .join(",")
    ),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const handleExportWellness = () => {
  const rows = wellnessEntries.map((entry) => ({
    playerId: entry.playerId,
    date: entry.date,
    sleep: entry.sleep,
    fatigue: entry.fatigue,
    soreness: entry.soreness,
    stress: entry.stress,
    mood: entry.mood,
    freshness: entry.freshness,
    comment: entry.comment || "",
  }));

  exportToCsv("wellness_export.csv", rows);
};

const handleExportRpe = () => {
  const rows = sessionEntries.map((entry) => ({
    playerId: entry.playerId,
    date: entry.date,
    rpe: entry.rpe,
    duration: entry.duration,
    attendance: entry.attendance,
    bodyCheck: entry.bodyCheck,
    painArea: entry.painArea || "",
    sessionType: entry.sessionType || "",
    load: entry.load ?? 0,
  }));

  exportToCsv("rpe_export.csv", rows);
};
  useEffect(() => {
  if (currentProfile && currentProfile.role !== "admin") {
    setSelectedPlayerId(currentProfile.id);
    setHistoryPlayerId(currentProfile.id);
    setMode("player");
  }

  if (currentProfile && currentProfile.role === "admin") {
    setMode("staff");
  }
}, [currentProfile]);

  useEffect(() => {
  const testSupabase = async () => {
    const { data, error } = await supabase.from("players").select("*");
    console.log("SUPABASE PLAYERS:", data);
    console.log("SUPABASE ERROR:", error);
  };

  testSupabase();
}, []);
  useEffect(() => {
  const getSession = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    setSession(session);
    setAuthLoading(false);
  };

  getSession();

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    setSession(session);
    setAuthLoading(false);
  });

  return () => subscription.unsubscribe();
}, []);
  useEffect(() => {
  const loadCurrentProfile = async () => {
    if (!session?.user?.id) {
      setCurrentProfile(null);
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);

    const { data, error } = await supabase
      .from("players")
      .select("*")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (error) {
      console.error("LOAD CURRENT PROFILE ERROR:", error);
      setCurrentProfile(null);
      setProfileLoading(false);
      return;
    }

    setCurrentProfile(data || null);
    setProfileLoading(false);
  };

  loadCurrentProfile();
}, [session]);
  useEffect(() => {
  const loadPlayers = async () => {
  const { data, error } = await supabase
    .from("players")
    .select("id, name, position, role")
    .eq("role", "player")
    .order("id", { ascending: true });

    if (error) {
      console.error("LOAD PLAYERS ERROR:", error);
      return;
    }

    if (data && data.length > 0) {
      setPlayers(data);

      if (!currentProfile || currentProfile.role === "admin") {
        setSelectedPlayerId(data[0].id);
        setHistoryPlayerId(data[0].id);
      }
    }
  };

  loadPlayers();
}, [currentProfile]);
  const loadWellnessEntries = async () => {
  const { data, error } = await supabase
    .from("wellness_entries")
    .select("*")
    .order("id", { ascending: true });

  if (error) {
    console.error("LOAD WELLNESS ERROR:", error);
    return;
  }

  if (data) {
    const mapped = data.map((entry) => ({
      playerId: entry.player_id,
      date: entry.entry_date,
      sleep: entry.sleep,
      fatigue: entry.fatigue,
      soreness: entry.soreness,
      stress: entry.stress,
      mood: entry.mood,
      freshness: entry.freshness,
      comment: entry.comment || "",
    }));

    setWellnessEntries(mapped);
  }
};
  useEffect(() => {
  loadWellnessEntries();
}, []);
const loadRpeEntries = async () => {
  const { data, error } = await supabase
    .from("rpe_entries")
    .select("*")
    .order("id", { ascending: true });

  if (error) {
    console.error("LOAD RPE ERROR:", error);
    return;
  }

  if (data) {
    setSessionEntries((prev) => {
      const mapped = data.map((entry) => {
        const date = entry.created_at
  ? new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Winnipeg",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .format(new Date(entry.created_at))
      .replace(/\//g, "-")
  : todayKey();
        const existingSetup = prev.find(
          (item) => item.playerId === entry.player_id && item.date === date
        );

        const duration = Number(existingSetup?.duration || 0);
        const rpe = Number(entry.rpe || 0);

        return {
          playerId: entry.player_id,
          date,
          rpe,
          duration,
          attendance:
            existingSetup?.attendance ||
            (entry.attendance
              ? entry.attendance.charAt(0).toUpperCase() + entry.attendance.slice(1)
              : "Present"),
          bodyCheck: entry.soreness_level
            ? entry.soreness_level.charAt(0).toUpperCase() + entry.soreness_level.slice(1)
            : "None",
          painArea: entry.pain_comment || "",
          comment: "",
          sessionType: existingSetup?.sessionType || "Training",
          targetRpe: Number(existingSetup?.targetRpe || 0),
          plannedLoad: Number(existingSetup?.plannedLoad || 0),
          load: duration * rpe,
        };
      });

      const setupOnly = prev.filter(
        (entry) =>
          !mapped.some(
            (rpeEntry) =>
              rpeEntry.playerId === entry.playerId && rpeEntry.date === entry.date
          )
      );

      return [...setupOnly, ...mapped];
    });
  }
};

const loadSessionSetup = async () => {
  const { data, error } = await supabase
    .from("session_setup")
    .select("*")
    .order("id", { ascending: true });

  if (error) {
    console.error("LOAD SESSION SETUP ERROR:", error);
    return;
  }

  if (data) {
    const mapped = data.map((entry) => ({
  playerId: entry.player_id,
  date: entry.session_date,
  sessionType: entry.session_type || "Training",
  attendance: entry.attendance || "Present",
  duration: Number(entry.duration || 0),
  targetRpe: Number(entry.target_rpe || 0),
  plannedLoad: Number(entry.planned_load || 0),
  rpe: 0,
  comment: "",
  bodyCheck: "None",
  painArea: "",
  load: 0,
}));

    setSessionEntries((prev) => {
      const rpeOnly = prev.filter((entry) => entry.rpe && entry.rpe > 0);
      return [...mapped, ...rpeOnly];
    });
  }
};
useEffect(() => {
  const loadSessionData = async () => {
    await loadSessionSetup();
    await loadRpeEntries();
  };

  loadSessionData();
}, []);
  
const addPlayer = async () => {
  if (!newPlayer.name.trim()) return;

  const payload = {
    name: newPlayer.name.trim(),
    position: newPlayer.position.trim() || "TBD",
    role: "player",
  };

  const { data, error } = await supabase
    .from("players")
    .insert([payload])
    .select();

  if (error) {
    console.error("ADD PLAYER ERROR:", error);
    return;
  }

  if (data && data.length > 0) {
    const createdPlayer = data[0];
    setPlayers((prev) => [...prev, createdPlayer]);
    setNewPlayer({ name: "", position: "" });
    setSelectedPlayerId(createdPlayer.id);
    setHistoryPlayerId(createdPlayer.id);
  }
};
  if (authLoading) {
  return <div className="p-10 text-white">Loading...</div>;
}
  if (session && profileLoading) {
  return <div className="p-10 text-white">Loading profile...</div>;
}
if (!session) {

 const handleLogin = async () => {
  setLoginError("");
  setAuthSuccessMessage("");
  setAuthLoadingAction(true);

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    setLoginError(error.message);
  }

  setAuthLoadingAction(false);
};

 const handleSignUp = async () => {
  setLoginError("");
  setAuthSuccessMessage("");

  // ✅ check confirm password
  if (password !== confirmPassword) {
    setLoginError("Passwords do not match");
    return;
  }

  setAuthLoadingAction(true);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    setLoginError(error.message);
    setAuthLoadingAction(false);
    return;
  }

  const userId = data?.user?.id;

  if (!userId) {
    setLoginError("Signup succeeded but no user ID was returned.");
    setAuthLoadingAction(false);
    return;
  }

  const { error: profileError } = await supabase
    .from("players")
    .insert([
      {
        user_id: userId,
        name: signupName.trim(),
        position: signupPosition.trim() || "N/A",
        role: signupRole,
      },
    ]);

  if (profileError) {
    setLoginError(profileError.message);
    setAuthLoadingAction(false);
    return;
  }

  setAuthSuccessMessage("Account created successfully. You can now log in.");
  setAuthMode("login");
  setSignupName("");
  setSignupPosition("");
  setSignupRole("player");
  setEmail("");
  setPassword("");
  setAuthLoadingAction(false);
};

  return (
  <div className="min-h-screen bg-slate-900 text-white flex flex-col">
    <div className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-6 lg:px-8">
      <div className="mb-8 overflow-hidden rounded-[32px] border border-white/10 bg-white/5 shadow-2xl shadow-black/20 backdrop-blur">
        <div className="h-1.5 w-full bg-gradient-to-r from-blue-950 via-amber-300 to-red-500" />

        <div className="flex items-center gap-4 p-6">
          <img
            src="/bonivital-logo.png"
            alt="Bonivital"
            className="h-16 w-16 object-contain"
          />

          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-amber-300">
              Bonivital SC
            </p>
            <h1 className="text-2xl font-bold text-white">
              Performance Monitor
            </h1>
            <p className="text-sm text-slate-400">
              Internal Load · Wellness · Readiness
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-sm rounded-2xl bg-slate-800 p-6 space-y-4">
        <div className="flex gap-2">
          <button
            onClick={() => setAuthMode("login")}
            className={cn(
              "flex-1 rounded-xl p-2 font-semibold",
              authMode === "login"
                ? "bg-white text-black"
                : "bg-slate-900 text-white border border-white/10"
            )}
          >
            Log in
          </button>

          <button
            onClick={() => setAuthMode("signup")}
            className={cn(
              "flex-1 rounded-xl p-2 font-semibold",
              authMode === "signup"
                ? "bg-white text-black"
                : "bg-slate-900 text-white border border-white/10"
            )}
          >
            Sign up
          </button>
        </div>

        {authMode === "signup" && (
          <>
            <input
              type="text"
              placeholder="Full name"
              value={signupName}
              onChange={(e) => setSignupName(e.target.value)}
              className="w-full rounded-xl bg-slate-900 border border-white/10 p-2 text-white"
            />

            <input
              type="text"
              placeholder="Position / Role title"
              value={signupPosition}
              onChange={(e) => setSignupPosition(e.target.value)}
              className="w-full rounded-xl bg-slate-900 border border-white/10 p-2 text-white"
            />

            <select
              value={signupRole}
              onChange={(e) => setSignupRole(e.target.value)}
              className="w-full rounded-xl bg-slate-900 border border-white/10 p-2 text-white"
            >
              <option value="player">Player</option>
              <option value="staff">Staff</option>
            </select>
          </>
        )}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl bg-slate-900 border border-white/10 p-2 text-white"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl bg-slate-900 border border-white/10 p-2 text-white"
        />

        <input
  type="password"
  placeholder="Confirm password"
  value={confirmPassword}
  onChange={(e) => setConfirmPassword(e.target.value)}
  className="w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-white"
/>

        <button
          onClick={authMode === "login" ? handleLogin : handleSignUp}
          disabled={authLoadingAction}
          className={cn(
            "w-full rounded-xl p-3 font-semibold",
            authLoadingAction
              ? "cursor-not-allowed bg-slate-500 text-white"
              : "bg-white text-black"
          )}
        >
          {authLoadingAction
            ? authMode === "login"
              ? "Logging in..."
              : "Creating account..."
            : authMode === "login"
              ? "Login"
              : "Create account"}
        </button>

        {loginError && (
          <div className="text-sm text-red-400">
            {loginError}
          </div>
        )}

        {authSuccessMessage && (
          <div className="text-sm text-emerald-400">
            {authSuccessMessage}
          </div>
        )}
      </div>
    </div>
  </div>
);
}

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.15),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(255,255,255,0.10),_transparent_20%),linear-gradient(180deg,_#020617,_#0f172a)] text-white">
      <div className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-6 lg:px-8">
        
        <div className="mb-8 overflow-hidden rounded-[32px] border border-white/10 bg-white/5 shadow-2xl shadow-black/20 backdrop-blur">
  <div className="h-1.5 w-full bg-gradient-to-r from-blue-950 via-amber-300 to-red-500" />

  <div className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between">
    <div className="flex items-center gap-4">
      <img
  src="/bonivital-logo.png"
  alt="Bonivital"
  className="h-16 w-16 object-contain"
/>

      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-amber-300">
          Bonivital SC
        </p>
        <h1 className="text-2xl font-bold text-white md:text-3xl">
          Performance Monitor
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Internal Load · Wellness · Readiness · Staff Dashboard
        </p>
      </div>
    </div>

    <div className="flex flex-wrap gap-3 items-center">
      {isAdmin ? (
        <>
          <button
            onClick={() => setMode("staff")}
            className={cn(
              "rounded-2xl px-4 py-3 text-sm font-semibold transition",
              mode === "staff"
                ? "bg-white text-slate-950"
                : "border border-white/15 bg-white/5 text-white hover:bg-white/10"
            )}
          >
            Staff Dashboard
          </button>

          <button
            onClick={() => setMode("player")}
            className={cn(
              "rounded-2xl px-4 py-3 text-sm font-semibold transition",
              mode === "player"
                ? "bg-amber-300 text-slate-950"
                : "border border-white/15 bg-white/5 text-white hover:bg-white/10"
            )}
          >
            Player Check-In
          </button>

          <button
            onClick={handleExportWellness}
            className="rounded-2xl px-4 py-4 text-sm font-semibold border border-emerald-400/30 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/40"
          >
            Export Wellness CSV
          </button>

          <button
            onClick={handleExportRpe}
            className="rounded-2xl px-4 py-4 text-sm font-semibold border border-amber-300/30 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20"
          >
            Export RPE CSV
          </button>
        </>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-200">
          Logged in as player
        </div>
      )}

      <button
        onClick={async () => {
          await supabase.auth.signOut();
          window.location.reload();
        }}
        className="rounded-2xl border border-red-400/30 bg-red-500/20 px-4 py-3 text-sm font-semibold text-red-200 hover:bg-red-500/40"
      >
        Logout
      </button>
    </div>
  </div>
</div>
        <div className="mb-6 grid gap-4 rounded-3xl border border-white/10 bg-white/5 p-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-sm text-slate-400">Demo squad</p>
            <p className="text-lg font-semibold text-white">{players.length} players loaded</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
  {isAdmin ? (
    <>
      <label className="text-sm text-slate-300">Selected player</label>
      <select
        value={selectedPlayerId}
        onChange={(e) => {
          const nextId = Number(e.target.value);
          setSelectedPlayerId(nextId);
          setHistoryPlayerId(nextId);
        }}
        className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none"
      >
        {players.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} — {p.position}
          </option>
        ))}
      </select>
    </>
  ) : (
    <div className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white">
      {currentProfile?.name} — {currentProfile?.position}
    </div>
  )}
</div>
        </div>

        {isAdmin && (
  <div className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-4">
          <div className="mb-3">
            <p className="text-sm text-slate-400">Admin roster control</p>
            <p className="text-lg font-semibold text-white">Add players progressively during preseason</p>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
            <input
              value={newPlayer.name}
              onChange={(e) => setNewPlayer({ ...newPlayer, name: e.target.value })}
              placeholder="Player name"
              className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none placeholder:text-slate-500"
            />
            <input
              value={newPlayer.position}
              onChange={(e) => setNewPlayer({ ...newPlayer, position: e.target.value })}
              placeholder="Position"
              className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none placeholder:text-slate-500"
            />
            <button onClick={addPlayer} className="rounded-2xl bg-white px-4 py-3 font-semibold text-slate-950 transition hover:scale-[1.01]">
              Add player
            </button>
          </div>
        </div>
      )}

        {mode === "staff" ? (
          <div className="grid gap-6">
            <AdminSessionSetup players={players} sessionEntries={sessionEntries} setSessionEntries={setSessionEntries} />
            <AdminManualEntry
  players={players}
  sessionEntries={sessionEntries}
  wellnessEntries={wellnessEntries}
  setWellnessEntries={setWellnessEntries}
  loadWellnessEntries={loadWellnessEntries}
  setSessionEntries={setSessionEntries}
/>
            <StaffDashboard
  players={players}
  wellnessEntries={wellnessEntries}
  sessionEntries={sessionEntries}
  setHistoryPlayerId={setHistoryPlayerId}
  selectedDate={selectedDate}
  setSelectedDate={setSelectedDate}
  historyPlayerId={historyPlayerId}
/>
            <PlayerHistory selectedPlayer={historyPlayer} wellnessEntries={wellnessEntries} sessionEntries={sessionEntries} />
          </div>
        ) : (
          <PlayerForm
  selectedPlayer={selectedPlayer}
  wellnessEntries={wellnessEntries}
  sessionEntries={sessionEntries}
  setWellnessEntries={setWellnessEntries}
  setSessionEntries={setSessionEntries}
  loadWellnessEntries={loadWellnessEntries}
  loadRpeEntries={loadRpeEntries}
/>
        )}
      </div>
    </div>
  );
}
