"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Header from "@/components/Header";
import WarningScreen from "@/components/WarningScreen";
import SetupFlow from "@/components/SetupFlow";
import { generateSchedule } from "@/lib/generateSchedule";
import FocusMode from "@/components/FocusMode";

export default function Home() {
  const [currentStep, setCurrentStep] = useState("warning");
  const [view, setView] = useState("home");
  const [studyConfig, setStudyConfig] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [isFocusMode, setIsFocusMode] = useState(false);

  if (isFocusMode) {
    return <FocusMode onExit={() => setIsFocusMode(false)} schedule={schedule} studyConfig={studyConfig} />;
  }

  if (currentStep === "warning") {
    return <WarningScreen onContinue={() => setCurrentStep("setup")} />;
  }

  if (currentStep === "setup") {
    return (
      <SetupFlow 
        initialData={studyConfig}
        onComplete={(config) => {
          setStudyConfig(config);
          setSchedule(generateSchedule(config));
          setCurrentStep("app");
        }} 
      />
    );
  }

  return (
    <div className="app-shell">
      <Header view={view} onViewChange={setView} />

      <main className="main">
        {view === "home" && <HomeView onNavigate={setView} onEdit={() => setCurrentStep("setup")} onEnterFocus={() => setIsFocusMode(true)} />}
        {view === "planner" && <PlannerView schedule={schedule} studyConfig={studyConfig} />}
        {view === "focus" && <FocusView onEnterFocus={() => setIsFocusMode(true)} />}
        {view === "settings" && <SettingsView studyConfig={studyConfig} onEdit={() => setCurrentStep("setup")} />}
      </main>
    </div>
  );
}

function HomeView({ onNavigate, onEdit, onEnterFocus }) {
  return (
    <section>
      <div className="card hero-card">
        <div className="hero-left">
          <h1>IB Master Study Plan</h1>
          <p>Unified study planner for IB students</p>
        </div>
        <div className="hero-right">
          <h2 className="countdown-large">44d 12h 19m</h2>
        </div>
      </div>

      <div className="cards-grid">
        <div className="card cursor-pointer hover:border-[#7c6fff] transition-colors" onClick={onEdit}>
          <h3>Edit Plan</h3>
          <p>Organize your study schedule</p>
        </div>
        <div className="card cursor-pointer hover:border-[#7c6fff] transition-colors" onClick={() => onNavigate("planner")}>
          <h3>View Plan</h3>
          <p>Check your timeline progress</p>
        </div>
        <div className="card cursor-pointer hover:border-[#7c6fff] transition-colors" onClick={onEnterFocus}>
          <h3>Focus Mode</h3>
          <p>Start an uninterrupted session</p>
        </div>
        <div className="card cursor-pointer hover:border-[#7c6fff] transition-colors" onClick={() => onNavigate("settings")}>
          <h3>Settings</h3>
          <p>Configure your plan preferences</p>
        </div>
      </div>
    </section>
  );
}

function FocusView({ onEnterFocus }) {
  return (
    <section className="flex flex-col items-center justify-center min-h-[60vh]">
      <h2 className="text-4xl font-bold text-white mb-4">Focus Mode</h2>
      <p className="text-gray-400 mb-8 text-center max-w-md">Eliminate distractions and start your uninterrupted study session block.</p>
      <button 
        className="btn px-8 py-3 bg-gradient-to-r from-[#7c6fff] to-[#a399ff] text-white hover:opacity-90 border-none rounded-full shadow-lg shadow-[#7c6fff]/20 transition-all font-medium text-lg"
        onClick={onEnterFocus}
      >
        Enter Focus Mode
      </button>
    </section>
  );
}

function DayCard({ day, studyConfig, isCollapsible = false, isOpen = false, onToggle, isHighlighted, dayRef }) {
  const isActuallyOpen = isCollapsible ? isOpen : true;

  const formatTime = (totalMinutes) => {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const { startTime, sessionLength, breakLength } = studyConfig.dailyStructure;
  const [startH, startM] = startTime.split(':').map(Number);
  const dayStartMins = startH * 60 + startM;

  let currentMins = dayStartMins;

  return (
    <div 
      ref={dayRef}
      className={`bg-white/5 border border-white/10 rounded-2xl shadow-lg shadow-black/20 overflow-hidden transition-all duration-500 ${isHighlighted ? 'ring-2 ring-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.4)]' : ''}`}
    >
      <div 
        className={`p-5 flex justify-between items-center ${isCollapsible ? 'cursor-pointer hover:bg-white/5 transition-colors' : ''}`}
        onClick={() => { if (isCollapsible && onToggle) onToggle(); }}
      >
        <h3 className="text-lg font-semibold text-white">
          {new Date(day.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
        </h3>
        {isCollapsible && (
          <button className={`text-white/50 transition-transform duration-300 ${isActuallyOpen ? 'rotate-90' : ''}`}>
            ▶
          </button>
        )}
      </div>
      
      <AnimatePresence initial={false}>
        {isActuallyOpen && (
          <motion.div
            initial={isCollapsible ? { height: 0, opacity: 0 } : false}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
          >
            <div className="px-5 pb-5 space-y-2">
              {day.sessions.map((session, sIdx) => {
                const isBreak = session.type === 'break';
                const isExtra = session.isExtra;
                
                const duration = session.duration || (isBreak ? Number(breakLength) : Number(sessionLength));
                const startStr = formatTime(currentMins);
                const endStr = formatTime(currentMins + duration);
                currentMins += duration;

                let bgClass = "bg-white/5 border border-white/10";
                let textClass = "text-white";
                let rightLabel = "STUDY";
                let subjectText = session.subject;

                if (isBreak) {
                  bgClass = "bg-white/[0.03] text-white/50 italic border-transparent";
                  textClass = "text-white/50";
                  rightLabel = "REST";
                  subjectText = "Break";
                } else if (isExtra) {
                  bgClass = "bg-orange-500/10 border border-orange-400/30 text-orange-300";
                  textClass = "text-orange-300";
                  rightLabel = "EXTRA";
                }

                return (
                  <div key={sIdx} className={`flex items-center justify-between p-3 rounded-xl transition hover:bg-white/10 ${bgClass}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-white/50 shrink-0 min-w-[65px]">{startStr} – {endStr}</span>
                      <span className={`font-medium ${textClass} truncate`}>{subjectText}</span>
                    </div>
                    <span className="text-[10px] font-bold tracking-wider opacity-70 px-2 py-0.5 rounded bg-black/20 shrink-0">{rightLabel}</span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function WeekSection({ weekLabel, dateRange, days, studyConfig, highlightedDay, dayRefs }) {
  const [open, setOpen] = useState(false);
  const [openDays, setOpenDays] = useState({});

  useEffect(() => {
    if (highlightedDay && days.some(d => d.date === highlightedDay)) {
      setOpen(true);
      setOpenDays(prev => ({ ...prev, [highlightedDay]: true }));
      setTimeout(() => {
        const el = dayRefs?.current?.[highlightedDay];
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    }
  }, [highlightedDay, days, dayRefs]);

  function toggleDay(date) {
    setOpenDays(prev => ({
      ...prev,
      [date]: !prev[date]
    }));
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
      <div 
        className="flex justify-between items-center cursor-pointer p-4 hover:bg-white/5 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <div>
          <h3 className="text-lg font-semibold text-white">{weekLabel}</h3>
          <p className="text-sm text-gray-400">{dateRange}</p>
        </div>
        <button className={`text-white/50 transition-transform duration-300 ${open ? 'rotate-90' : ''}`}>
          ▶
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <div className="p-4 pt-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
              {days.map((day, idx) => (
                <DayCard 
                  key={idx} 
                  day={day} 
                  studyConfig={studyConfig} 
                  isCollapsible={true} 
                  isOpen={openDays[day.date] || false}
                  onToggle={() => toggleDay(day.date)}
                  isHighlighted={highlightedDay === day.date}
                  dayRef={el => { if (dayRefs) dayRefs.current[day.date] = el; }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PlannerView({ schedule, studyConfig }) {
  const [viewMode, setViewMode] = useState("grid");
  const [selectedDate, setSelectedDate] = useState("");
  const [highlightedDay, setHighlightedDay] = useState(null);
  const dayRefs = useRef({});

  useEffect(() => {
    if (!selectedDate && schedule && schedule.length > 0) {
      const todayDate = new Date().toISOString().split('T')[0];
      const hasToday = schedule.find(d => d.date === todayDate);
      setSelectedDate(hasToday ? todayDate : schedule[0].date);
    }
  }, [schedule, selectedDate]);

  useEffect(() => {
    if (highlightedDay) {
      const timer = setTimeout(() => setHighlightedDay(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [highlightedDay]);

  const scrollToDay = (date) => {
    if (!date) return;

    // Check if it's a break day
    if (studyConfig.breakDays.includes(date)) {
      setHighlightedDay(date);
      return; // Do NOT scroll
    }

    setHighlightedDay(date);
    
    if (viewMode === "grid") {
      setTimeout(() => {
        const el = dayRefs.current[date];
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
    }
  };

  if (!schedule || schedule.length === 0) {
    return (
      <section>
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-lg shadow-black/20 text-center">
          <h2 className="text-2xl font-semibold mb-4 text-white">Planner</h2>
          <p className="text-sm font-medium text-white/50">No plan generated yet. Please run the setup flow.</p>
        </div>
      </section>
    );
  }

  const weeks = [];
  if (viewMode === "week") {
    for (let i = 0; i < schedule.length; i += 7) {
      const weekDays = schedule.slice(i, i + 7);
      const start = new Date(weekDays[0].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const end = new Date(weekDays[weekDays.length - 1].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      
      weeks.push({
        weekLabel: `Week ${Math.floor(i / 7) + 1}`,
        dateRange: `${start} – ${end}`,
        days: weekDays
      });
    }
  }

  return (
    <section className="max-w-[1400px] mx-auto pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 border-b border-white/10 pb-6 gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white mb-1">Your Schedule</h2>
          <p className="text-gray-400 text-sm">Follow your personalized study plan</p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 p-1.5 rounded-full">
            <input 
              type="date" 
              className="bg-transparent border-none text-sm text-white focus:outline-none px-2 cursor-pointer"
              value={selectedDate}
              min={schedule[0]?.date}
              max={schedule[schedule.length - 1]?.date}
              onChange={e => setSelectedDate(e.target.value)}
            />
            <button 
              className="bg-[#7c6fff] hover:bg-[#6859ff] transition-colors text-white text-xs font-medium px-4 py-1.5 rounded-full"
              onClick={() => scrollToDay(selectedDate)}
            >
              Go
            </button>
          </div>

          <div className="flex bg-white/5 p-1 rounded-full border border-white/10">
            <button 
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${viewMode === 'grid' ? 'bg-[#7c6fff] text-white' : 'text-gray-400 hover:text-white'}`}
              onClick={() => setViewMode("grid")}
            >
              Grid View
            </button>
            <button 
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${viewMode === 'week' ? 'bg-[#7c6fff] text-white' : 'text-gray-400 hover:text-white'}`}
              onClick={() => setViewMode("week")}
            >
              Week View
            </button>
          </div>
        </div>
      </div>

      {studyConfig.breakDays.includes(selectedDate) ? (
        <div className="flex justify-center py-12">
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center max-w-md shadow-xl backdrop-blur-md">
            <h3 className="text-2xl font-bold text-white mb-2">🌿 Break Day</h3>
            <p className="text-gray-400">Take rest. No study scheduled.</p>
          </div>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {schedule.map((day, idx) => (
            <DayCard 
              key={idx} 
              day={day} 
              studyConfig={studyConfig} 
              isHighlighted={highlightedDay === day.date}
              dayRef={el => dayRefs.current[day.date] = el}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {weeks.map((week, idx) => (
            <WeekSection 
              key={idx} 
              weekLabel={week.weekLabel} 
              dateRange={week.dateRange} 
              days={week.days} 
              studyConfig={studyConfig} 
              highlightedDay={highlightedDay}
              dayRefs={dayRefs}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function SettingsView({ studyConfig, onEdit }) {
  if (!studyConfig) {
    return (
      <section>
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-lg shadow-black/20">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold">Settings</h2>
          </div>
          <p className="text-sm font-medium text-white/50">No configuration found. Please run the setup flow.</p>
          <button className="btn mt-4" onClick={onEdit}>Start Setup</button>
        </div>
      </section>
    );
  }

  // Calculate total days
  const start = new Date(studyConfig.startDate);
  const end = new Date(studyConfig.endDate);
  const diffTime = Math.abs(end - start);
  const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 0;

  return (
    <section className="max-w-6xl mx-auto pb-12">
      <div className="flex justify-between items-end mb-8 border-b border-white/10 pb-6">
        <div>
          <h2 className="text-3xl font-bold text-white mb-1">Study Configuration</h2>
          <p className="text-gray-400 text-sm">Review your plan settings before generating the schedule</p>
        </div>
        <button className="btn px-6 py-2 bg-gradient-to-r from-[#7c6fff] to-[#a399ff] text-white hover:opacity-90 border-none rounded-full shadow-lg shadow-[#7c6fff]/20 transition-all font-medium" onClick={onEdit}>
          Edit Configuration
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column - Subjects & Extras (Takes up 2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Subjects */}
          <div className="bg-[#151520] rounded-2xl border border-white/5 p-6 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#7c6fff] to-transparent opacity-50 group-hover:opacity-100 transition-opacity"></div>
            <h3 className="text-xl font-semibold text-white mb-5 flex items-center gap-2">
              <span className="text-xl">📚</span> Subjects
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {studyConfig.subjects.map(s => (
                <div key={s.name} className="flex flex-col bg-white/[0.03] rounded-xl p-4 border border-white/5 hover:bg-white/[0.06] transition-colors">
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-base font-semibold text-white">{s.name}</span>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded bg-[#7c6fff]/20 text-[#a399ff]">{s.level}</span>
                  </div>
                  <div className="mt-auto">
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-gray-400 font-medium">Priority</span>
                      <span className="text-white font-semibold">{studyConfig.priorities[s.name] || 5}/10</span>
                    </div>
                    <div className="w-full bg-black/50 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-gradient-to-r from-[#7c6fff] to-[#a399ff] h-full rounded-full" style={{ width: `${((studyConfig.priorities[s.name] || 5) / 10) * 100}%` }}></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Extras */}
          <div className="bg-[#151520] rounded-2xl border border-white/5 p-6 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#7c6fff] to-transparent opacity-30 group-hover:opacity-100 transition-opacity"></div>
            <h3 className="text-xl font-semibold text-white mb-5 flex items-center gap-2">
              <span className="text-xl">✨</span> Extras
            </h3>
            {studyConfig.extras.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {studyConfig.extras.map(e => (
                  <div key={e} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-[#7c6fff]"></div>
                      <span className="text-sm font-medium text-gray-200">{e}</span>
                    </div>
                    <div className="px-2.5 py-1 rounded-md bg-black/40 text-xs text-gray-300 font-medium border border-white/5">
                      Priority: <span className="text-white">{studyConfig.priorities[e] || 5}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-gray-500 text-sm italic p-4 bg-white/5 rounded-xl text-center border border-dashed border-white/10">No extras added.</div>
            )}
          </div>
        </div>

        {/* Right Column - Timeline & Break Days */}
        <div className="space-y-6">
          {/* Timeline */}
          <div className="bg-[#151520] rounded-2xl border border-white/5 p-6 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-1/2 h-1 bg-gradient-to-l from-[#a399ff] to-transparent opacity-50 group-hover:opacity-100 transition-opacity"></div>
            <h3 className="text-xl font-semibold text-white mb-5 flex items-center gap-2">
              <span className="text-xl">🗓️</span> Timeline
            </h3>
            
            <div className="bg-gradient-to-br from-black/40 to-black/10 rounded-xl p-5 border border-white/5 mb-5 text-center">
              <div className="text-gray-400 text-xs uppercase tracking-wider mb-1 font-medium">Total Duration</div>
              <div className="text-4xl font-bold bg-gradient-to-r from-[#7c6fff] to-[#a399ff] bg-clip-text text-transparent">
                {totalDays} <span className="text-xl font-medium text-gray-500">days</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center bg-white/[0.02] p-3 rounded-lg border border-white/5">
                <span className="text-gray-400 text-sm font-medium">Start Date</span>
                <span className="text-white font-medium">{studyConfig.startDate || '—'}</span>
              </div>
              <div className="flex justify-between items-center bg-white/[0.02] p-3 rounded-lg border border-white/5">
                <span className="text-gray-400 text-sm font-medium">End Date</span>
                <span className="text-white font-medium">{studyConfig.endDate || '—'}</span>
              </div>
            </div>
          </div>

          {/* Break Days */}
          <div className="bg-[#151520] rounded-2xl border border-white/5 p-6 shadow-xl relative overflow-hidden group">
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <span className="text-xl">☕</span> Break Days
            </h3>
            {studyConfig.breakDays.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {studyConfig.breakDays.map(d => (
                  <span key={d} className="text-xs font-medium px-3 py-1.5 rounded-lg bg-[#ff4a4a]/10 text-[#ff7b7b] border border-[#ff4a4a]/20 shadow-sm">
                    {new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-gray-500 text-sm italic bg-black/20 p-3 rounded-lg text-center border border-white/5">No break days scheduled.</div>
            )}
          </div>
        </div>

        {/* Bottom Full Width - Daily Structure */}
        <div className="lg:col-span-3 bg-[#151520] rounded-2xl border border-white/5 p-6 shadow-xl relative overflow-hidden group">
           <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#7c6fff] to-transparent opacity-20 group-hover:opacity-80 transition-opacity"></div>
           <h3 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
              <span className="text-xl">⚙️</span> Daily Structure
           </h3>
           <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-white/[0.03] rounded-xl p-4 border border-white/5 flex flex-col items-center justify-center text-center">
                <span className="text-gray-400 text-[11px] uppercase tracking-wider mb-2 font-medium">Start Time</span>
                <span className="text-2xl font-semibold text-white">{studyConfig.dailyStructure.startTime}</span>
              </div>
              <div className="bg-white/[0.03] rounded-xl p-4 border border-white/5 flex flex-col items-center justify-center text-center">
                <span className="text-gray-400 text-[11px] uppercase tracking-wider mb-2 font-medium">End Time</span>
                <span className="text-2xl font-semibold text-white">{studyConfig.dailyStructure.endTime}</span>
              </div>
              <div className="bg-white/[0.03] rounded-xl p-4 border border-white/5 flex flex-col items-center justify-center text-center">
                <span className="text-gray-400 text-[11px] uppercase tracking-wider mb-2 font-medium">Session</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-semibold text-[#a399ff]">{studyConfig.dailyStructure.sessionLength}</span>
                  <span className="text-sm text-gray-500 font-medium">min</span>
                </div>
              </div>
              <div className="bg-white/[0.03] rounded-xl p-4 border border-white/5 flex flex-col items-center justify-center text-center">
                <span className="text-gray-400 text-[11px] uppercase tracking-wider mb-2 font-medium">Short Break</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-semibold text-[#a399ff]">{studyConfig.dailyStructure.breakLength}</span>
                  <span className="text-sm text-gray-500 font-medium">min</span>
                </div>
              </div>
              <div className="bg-white/[0.03] rounded-xl p-4 border border-white/5 flex flex-col items-center justify-center text-center">
                <span className="text-gray-400 text-[11px] uppercase tracking-wider mb-2 font-medium">Total Breaks</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-semibold text-white">{studyConfig.dailyStructure.breakCount}</span>
                </div>
              </div>
           </div>
        </div>
      </div>
    </section>
  );
}
