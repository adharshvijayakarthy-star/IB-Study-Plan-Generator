"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Header from "@/components/Header";
import WarningScreen from "@/components/WarningScreen";
import SetupFlow from "@/components/SetupFlow";
import { generateSchedule } from "@/lib/generateSchedule";
import FocusMode from "@/components/FocusMode";
import ExamPortions from "@/components/ExamPortions";

function withSessionInteractionFields(rawSchedule) {
  if (!Array.isArray(rawSchedule)) return [];
  return rawSchedule.map((day) => ({
    ...day,
    dayNote: typeof day.dayNote === "string" ? day.dayNote : "",
    sessions: (day.sessions || []).map((session) => ({
      ...session,
      type: session.type === "break" ? "break" : "study",
      subject: typeof session.subject === "string" ? session.subject : "",
      completed: Boolean(session.completed),
      note: typeof session.note === "string" ? session.note : "",
    })),
  }));
}

export default function Home() {
  const [currentStep, setCurrentStep] = useState("warning");
  const [view, setView] = useState("home");
  const [studyConfig, setStudyConfig] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [isFocusMode, setIsFocusMode] = useState(false);

  useEffect(() => {
    const savedConfig = localStorage.getItem("studyConfig");
    const savedSchedule = localStorage.getItem("studySchedule");
    if (savedConfig) {
      try {
        setStudyConfig(JSON.parse(savedConfig));
      } catch (error) {
        console.error("Failed to parse studyConfig:", error);
      }
    }
    if (!savedSchedule) return;
    try {
      const parsed = JSON.parse(savedSchedule);
      setSchedule(withSessionInteractionFields(parsed));
      setCurrentStep("app");
    } catch (error) {
      console.error("Failed to parse studySchedule:", error);
    }
  }, []);

  useEffect(() => {
    if (!Array.isArray(schedule)) return;
    localStorage.setItem("studySchedule", JSON.stringify(schedule));
  }, [schedule]);

  useEffect(() => {
    if (!studyConfig) return;
    localStorage.setItem("studyConfig", JSON.stringify(studyConfig));
  }, [studyConfig]);

  if (isFocusMode) {
    return (
      <FocusMode
        onExit={() => setIsFocusMode(false)}
        schedule={schedule}
        setSchedule={setSchedule}
        studyConfig={studyConfig}
      />
    );
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
          const generatedSchedule = generateSchedule(config);
          setSchedule(withSessionInteractionFields(generatedSchedule));
          setCurrentStep("app");
        }} 
      />
    );
  }

  return (
    <div className="app-shell">
      <Header view={view} onViewChange={setView} />

      <main className="main">
        {view === "home" && <HomeView onNavigate={setView} onEdit={() => setCurrentStep("setup")} onEnterFocus={() => setIsFocusMode(true)} studyConfig={studyConfig} />}
        {view === "planner" && <PlannerView schedule={schedule} setSchedule={setSchedule} studyConfig={studyConfig} />}
        {view === "exam-portions" && <ExamPortions selectedSubjects={studyConfig?.subjects || []} />}
        {view === "focus" && <FocusView onEnterFocus={() => setIsFocusMode(true)} />}
        {view === "settings" && <SettingsView studyConfig={studyConfig} onEdit={() => setCurrentStep("setup")} />}
      </main>
    </div>
  );
}

function HomeView({ onNavigate, onEdit, onEnterFocus, studyConfig }) {
  const [examPortions, setExamPortions] = useState([]);
  const [countdownText, setCountdownText] = useState("");
  const [planCountdownText, setPlanCountdownText] = useState("");

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("examPortions") || "[]");
      setExamPortions(saved);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    const updateCountdown = () => {
      // Exam Countdown
      if (!examPortions || examPortions.length === 0) {
        setCountdownText("No exams scheduled");
      } else {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalize today for date comparison

        const upcoming = examPortions.filter(s => {
          if (!s.examDate) return false;
          // Also normalize exam date to midnight local time for fair comparison
          const eDate = new Date(`${s.examDate}T00:00:00`);
          return eDate >= today;
        });

        if (upcoming.length === 0) {
          setCountdownText("All exams completed");
        } else {
          const nextExam = upcoming.sort((a, b) => new Date(`${a.examDate}T00:00:00`) - new Date(`${b.examDate}T00:00:00`))[0];
          const examDateObj = new Date(`${nextExam.examDate}T00:00:00`);
          
          const exactToday = new Date(); // To calculate precise time difference
          const diffTime = examDateObj - exactToday;
          const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (daysLeft <= 0) {
            setCountdownText("Exam Today");
          } else {
            setCountdownText(`Next Exam: ${nextExam.subject} — ${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`);
          }
        }
      }

      // Plan Countdown
      if (!studyConfig?.endDate) {
        setPlanCountdownText("Set a plan to start");
      } else {
        const [year, month, day] = studyConfig.endDate.split("-").map(Number);
        const endDate = new Date(year, month - 1, day, 23, 59, 59);
        const now = new Date();
        const diff = endDate - now;

        if (diff <= 0) {
          setPlanCountdownText("Plan Completed");
        } else {
          const totalMinutes = Math.floor(diff / (1000 * 60));
          const days = Math.floor(totalMinutes / (60 * 24));
          const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
          const minutes = totalMinutes % 60;
          
          setPlanCountdownText(`Plan Ends In: ${days}d ${hours}h ${minutes}m`);
        }
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000);
    return () => clearInterval(interval);
  }, [examPortions, studyConfig]);

  return (
    <section>
      <div className="card hero-card">
        <div className="hero-left">
          <h1>IB Master Study Plan</h1>
          <p>Unified study planner for IB students</p>
        </div>
        <div className="hero-right text-right">
          {planCountdownText && (
            <h2 className="countdown-large text-3xl md:text-4xl mb-2">{planCountdownText}</h2>
          )}
          {countdownText && (
            <p className="text-white/60 text-lg font-medium">{countdownText}</p>
          )}
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
        <div className="card cursor-pointer hover:border-[#7c6fff] transition-colors" onClick={() => onNavigate("exam-portions")}>
          <h3>Exam Portions</h3>
          <p>Track subjects, topics, and exam dates</p>
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

function DayCard({
  day,
  dayIndex,
  studyConfig,
  isCollapsible = false,
  isOpen = false,
  onToggle,
  isHighlighted,
  dayRef,
  onToggleSessionComplete,
  onOpenSessionModal,
  onOpenReflection,
}) {
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

                const isCompleted = session.completed === true;
                const completionClasses = isCompleted
                  ? "opacity-60 bg-green-500/10 border border-green-400/30"
                  : "";

                return (
                  <div
                    key={sIdx}
                    className={`flex items-center justify-between p-3 rounded-xl transition ${isBreak ? "" : "cursor-pointer hover:bg-white/10"} ${bgClass} ${completionClasses}`}
                    onClick={() => {
                      if (isBreak) return;
                      onOpenSessionModal?.(dayIndex, sIdx);
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-xs text-white/50 shrink-0 min-w-[65px]">{startStr} – {endStr}</span>
                      <div className="min-w-0">
                        <span className={`font-medium ${textClass} truncate block ${isCompleted ? "line-through" : ""}`}>{subjectText}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!isBreak && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onToggleSessionComplete?.(dayIndex, sIdx);
                          }}
                          className={`w-7 h-7 rounded-md border text-xs font-bold transition-all ${
                            isCompleted
                              ? "bg-green-500/30 border-green-300/60 text-green-100"
                              : "bg-white/5 border-white/20 text-white/70 hover:bg-white/15 hover:border-white/40"
                          }`}
                          aria-label={isCompleted ? "Mark session incomplete" : "Mark session complete"}
                          title={isCompleted ? "Mark incomplete" : "Mark complete"}
                        >
                          {isCompleted ? "✓" : "✔"}
                        </button>
                      )}
                      <span className="text-[10px] font-bold tracking-wider opacity-70 px-2 py-0.5 rounded bg-black/20">{rightLabel}</span>
                    </div>
                  </div>
                );
              })}
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenReflection?.(dayIndex);
                  }}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-500/10 border border-purple-400/20 text-purple-300 hover:bg-purple-500/20 hover:border-purple-400/30 transition-all active:scale-95"
                >
                  Reflection
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function WeekSection({
  weekLabel,
  dateRange,
  days,
  weekStartIndex,
  studyConfig,
  highlightedDay,
  dayRefs,
  onToggleSessionComplete,
  onOpenSessionModal,
  onOpenReflection,
}) {
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
                  dayIndex={weekStartIndex + idx}
                  studyConfig={studyConfig} 
                  isCollapsible={true} 
                  isOpen={openDays[day.date] || false}
                  onToggle={() => toggleDay(day.date)}
                  isHighlighted={highlightedDay === day.date}
                  dayRef={el => { if (dayRefs) dayRefs.current[day.date] = el; }}
                  onToggleSessionComplete={onToggleSessionComplete}
                  onOpenSessionModal={onOpenSessionModal}
                  onOpenReflection={onOpenReflection}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PlannerView({ schedule, setSchedule, studyConfig }) {
  const [viewMode, setViewMode] = useState("grid");
  const [selectedDate, setSelectedDate] = useState("");
  const [highlightedDay, setHighlightedDay] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [draftSessionNote, setDraftSessionNote] = useState("");
  const [reflectionModalOpen, setReflectionModalOpen] = useState(false);
  const [reflectionView, setReflectionView] = useState("menu");
  const [selectedReflectionDay, setSelectedReflectionDay] = useState(null);
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

  useEffect(() => {
    if (!activeSession) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [activeSession]);

  useEffect(() => {
    if (!reflectionModalOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [reflectionModalOpen]);

  const openReflection = (dayIndex) => {
    setSelectedReflectionDay(dayIndex);
    setReflectionView("menu");
    setReflectionModalOpen(true);
  };

  const closeReflection = () => {
    setReflectionModalOpen(false);
  };

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
        days: weekDays,
        weekStartIndex: i,
      });
    }
  }

  const updateSession = (dayIndex, sessionIndex, updates) => {
    setSchedule((prevSchedule) => {
      if (!Array.isArray(prevSchedule)) return prevSchedule;
      const nextSchedule = [...prevSchedule];
      const targetDay = nextSchedule[dayIndex];
      if (!targetDay) return prevSchedule;

      const nextSessions = [...(targetDay.sessions || [])];
      const targetSession = nextSessions[sessionIndex];
      if (!targetSession) return prevSchedule;

      nextSessions[sessionIndex] = {
        ...targetSession,
        ...updates,
      };

      nextSchedule[dayIndex] = {
        ...targetDay,
        sessions: nextSessions,
      };

      return nextSchedule;
    });
  };

  const toggleSessionCompleted = (dayIndex, sessionIndex) => {
    const session = schedule?.[dayIndex]?.sessions?.[sessionIndex];
    if (!session || session.type === "break") return;

    updateSession(dayIndex, sessionIndex, { 
      completed: !session.completed,
    });
  };

  const openSessionModal = (dayIndex, sessionIndex) => {
    const session = schedule?.[dayIndex]?.sessions?.[sessionIndex];
    if (!session || session.type === "break") return;
    setActiveSession({ dayIndex, sessionIndex });
    setDraftSessionNote(session.note || "");
  };

  const closeSessionModal = () => {
    setActiveSession(null);
    setDraftSessionNote("");
  };

  const getSessionTimeRange = (dayIndex, sessionIndex) => {
    const day = schedule?.[dayIndex];
    if (!day) return "";
    const { startTime, sessionLength, breakLength } = studyConfig.dailyStructure;
    const [startH, startM] = startTime.split(":").map(Number);
    let currentMins = startH * 60 + startM;

    for (let i = 0; i < day.sessions.length; i++) {
      const currentSession = day.sessions[i];
      const isBreak = currentSession.type === "break";
      const duration = currentSession.duration || (isBreak ? Number(breakLength) : Number(sessionLength));
      const startMins = currentMins;
      const endMins = currentMins + duration;
      if (i === sessionIndex) {
        const formatTime = (totalMinutes) => {
          const h = Math.floor(totalMinutes / 60);
          const m = totalMinutes % 60;
          return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
        };
        return `${formatTime(startMins)} - ${formatTime(endMins)}`;
      }
      currentMins = endMins;
    }

    return "";
  };

  const modalSession =
    activeSession &&
    schedule?.[activeSession.dayIndex]?.sessions?.[activeSession.sessionIndex];

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
              dayIndex={idx}
              studyConfig={studyConfig} 
              isHighlighted={highlightedDay === day.date}
              dayRef={el => dayRefs.current[day.date] = el}
              onToggleSessionComplete={toggleSessionCompleted}
              onOpenSessionModal={openSessionModal}
              onOpenReflection={openReflection}
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
              weekStartIndex={week.weekStartIndex}
              studyConfig={studyConfig} 
              highlightedDay={highlightedDay}
              dayRefs={dayRefs}
              onToggleSessionComplete={toggleSessionCompleted}
              onOpenSessionModal={openSessionModal}
              onOpenReflection={openReflection}
            />
          ))}
        </div>
      )}

      <AnimatePresence>
        {modalSession && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeSessionModal}
          >
            <motion.div
              className="w-full max-w-lg bg-[#151520] border border-white/10 rounded-2xl p-6 shadow-2xl"
              initial={{ opacity: 0, scale: 0.98, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 8 }}
              transition={{ duration: 0.2 }}
              onClick={(event) => event.stopPropagation()}
            >
              <h3 className="text-2xl font-semibold text-white mb-1">{modalSession.subject}</h3>
              <div className="flex items-center justify-between mb-6">
                <p className="text-sm text-white/60">
                  {getSessionTimeRange(activeSession.dayIndex, activeSession.sessionIndex)}
                </p>
                {modalSession.completed && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-green-500/20 text-green-300 border border-green-400/20">
                    Completed
                  </span>
                )}
              </div>

              {modalSession.tasks && modalSession.tasks.length > 0 ? (
                <div className="space-y-2 mb-6 max-h-[30vh] overflow-y-auto pr-2 custom-scrollbar">
                  {modalSession.tasks.map((task, idx) => (
                    <div key={idx} className={`flex items-start gap-3 p-3 rounded-xl border ${task.done ? 'bg-white/[0.02] border-white/[0.05] opacity-60' : 'bg-white/[0.05] border-white/10'}`}>
                      <div className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-md border flex items-center justify-center ${task.done ? 'bg-green-500/20 border-green-500/50 text-green-400' : 'border-white/20'}`}>
                        {task.done && <span className="text-[10px] font-bold">✓</span>}
                      </div>
                      <span className={`text-sm ${task.done ? 'line-through text-white/50' : 'text-white/90'}`}>{task.text}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mb-6 p-4 rounded-xl bg-white/[0.02] border border-dashed border-white/10 text-center">
                  <p className="text-white/40 text-sm">No tasks added to this session.</p>
                </div>
              )}

              <div className="mt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    toggleSessionCompleted(activeSession.dayIndex, activeSession.sessionIndex);
                  }}
                  className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                    modalSession.completed
                      ? "bg-red-500/20 hover:bg-red-500/30 border-red-400/30 text-red-300"
                      : "bg-green-500/20 hover:bg-green-500/30 border-green-400/30 text-green-300"
                  }`}
                >
                  {modalSession.completed ? "Mark Incomplete" : "Mark Complete"}
                </button>
                <button
                  type="button"
                  onClick={closeSessionModal}
                  className="px-4 py-2 text-sm rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {reflectionModalOpen && selectedReflectionDay !== null && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeReflection}
          >
            <motion.div
              className="w-full max-w-3xl bg-gradient-to-br from-[#1a1a2e] to-[#12121f] border border-white/10 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden"
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
            >
              {(() => {
                const reflectionDay = schedule[selectedReflectionDay];
                if (!reflectionDay) return null;

                const dayLabel = new Date(reflectionDay.date).toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                });

                const studySessions = reflectionDay.sessions.filter(
                  (s) => s.type !== "break"
                );

                return (
                  <>
                    <div className="px-8 pt-7 pb-5 border-b border-white/5">
                      <p className="text-xs uppercase tracking-widest text-purple-300/70 font-semibold mb-1">
                        {dayLabel}
                      </p>
                      <h3 className="text-2xl font-bold text-white">Reflection</h3>
                    </div>

                    <div className="px-8 py-6 min-h-[300px] max-h-[60vh] overflow-y-auto">
                      <AnimatePresence mode="wait">
                        {reflectionView === "menu" && (
                          <motion.div
                            key="menu"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.15 }}
                            className="space-y-3"
                          >
                            <button
                              onClick={() => setReflectionView("day")}
                              className="w-full flex items-center gap-4 p-5 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.07] hover:border-white/20 transition-all active:scale-[0.99] group text-left"
                            >
                              <div className="w-11 h-11 rounded-xl bg-purple-500/15 border border-purple-400/20 flex items-center justify-center text-lg shrink-0">
                                📝
                              </div>
                              <div>
                                <p className="text-base font-semibold text-white group-hover:text-purple-200 transition-colors">
                                  Day Summary
                                </p>
                                <p className="text-sm text-white/50 mt-0.5">
                                  View your overall reflection for this day
                                </p>
                              </div>
                            </button>
                            <button
                              onClick={() => setReflectionView("sessions")}
                              className="w-full flex items-center gap-4 p-5 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.07] hover:border-white/20 transition-all active:scale-[0.99] group text-left"
                            >
                              <div className="w-11 h-11 rounded-xl bg-blue-500/15 border border-blue-400/20 flex items-center justify-center text-lg shrink-0">
                                📋
                              </div>
                              <div>
                                <p className="text-base font-semibold text-white group-hover:text-blue-200 transition-colors">
                                  Session Reflections
                                </p>
                                <p className="text-sm text-white/50 mt-0.5">
                                  Review notes from each study session ({studySessions.length} session{studySessions.length !== 1 ? "s" : ""})
                                </p>
                              </div>
                            </button>
                          </motion.div>
                        )}

                        {reflectionView === "day" && (
                          <motion.div
                            key="day"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.15 }}
                          >
                            <h4 className="text-lg font-semibold text-white mb-4">Day Reflection</h4>
                            {(reflectionDay.dayNote || "").trim() ? (
                              <div className="rounded-xl bg-white/[0.03] border border-white/10 p-5">
                                <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">
                                  {reflectionDay.dayNote.trim()}
                                </p>
                              </div>
                            ) : (
                              <div className="rounded-xl bg-white/[0.02] border border-dashed border-white/10 p-8 text-center">
                                <p className="text-white/40 text-sm">No day reflection recorded yet.</p>
                                <p className="text-white/25 text-xs mt-1">
                                  Use Focus Mode to add a reflection after your study sessions.
                                </p>
                              </div>
                            )}
                          </motion.div>
                        )}

                        {reflectionView === "sessions" && (
                          <motion.div
                            key="sessions"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.15 }}
                          >
                            <h4 className="text-lg font-semibold text-white mb-4">Session Reflections</h4>
                            {studySessions.length === 0 ? (
                              <div className="rounded-xl bg-white/[0.02] border border-dashed border-white/10 p-8 text-center">
                                <p className="text-white/40 text-sm">No study sessions found for this day.</p>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {studySessions.map((session, idx) => {
                                  const hasNote = (session.note || "").trim();
                                  return (
                                    <div
                                      key={idx}
                                      className={`rounded-xl border p-4 transition-colors ${
                                        session.completed
                                          ? "bg-green-500/[0.04] border-green-400/15"
                                          : "bg-white/[0.03] border-white/10"
                                      }`}
                                    >
                                      <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                          <span className="text-sm font-semibold text-white">
                                            {session.subject}
                                          </span>
                                          {session.completed && (
                                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-green-500/20 text-green-300 border border-green-400/20">
                                              Completed
                                            </span>
                                          )}
                                        </div>
                                        <span className="text-xs text-white/40">Session {idx + 1}</span>
                                      </div>
                                      {hasNote ? (
                                        <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">
                                          {session.note.trim()}
                                        </p>
                                      ) : (
                                        <p className="text-sm text-white/30 italic">No note recorded</p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <div className="px-8 py-4 border-t border-white/5 flex items-center justify-between">
                      <div>
                        {reflectionView !== "menu" && (
                          <button
                            type="button"
                            onClick={() => setReflectionView("menu")}
                            className="px-4 py-2 text-sm rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-all active:scale-95"
                          >
                            ← Back
                          </button>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={closeReflection}
                        className="px-4 py-2 text-sm rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-all active:scale-95"
                      >
                        Close
                      </button>
                    </div>
                  </>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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
