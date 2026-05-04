import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';

export default function FocusMode({ onExit, schedule, setSchedule, studyConfig }) {
  const todayStr = new Date().toISOString().split("T")[0];
  const dayIndex = schedule?.findIndex((day) => day.date === todayStr) ?? -1;
  const today = dayIndex >= 0 ? schedule?.[dayIndex] : null;
  const sessions = today?.sessions || [];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionNote, setSessionNote] = useState("");
  const [taskInput, setTaskInput] = useState("");
  const [focusModeState, setFocusModeState] = useState("idle");
  const [setupIndex, setSetupIndex] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [popupState, setPopupState] = useState(null);
  const [visibleTasks, setVisibleTasks] = useState([]);
  const [isPopupVisible, setIsPopupVisible] = useState(false);
  const [dayNote, setDayNote] = useState("");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isBackdropVisible, setIsBackdropVisible] = useState(false);
  const [shouldRenderPopup, setShouldRenderPopup] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [editingTaskIndex, setEditingTaskIndex] = useState(null);
  const [editingText, setEditingText] = useState("");
  const popupUnmountTimer = useRef(null);
  const timerRef = useRef(null);

  const formatTime = (totalMinutes) => {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const formatTimer = (totalSeconds) => {
    if (totalSeconds <= 0) return "00:00";
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const { startTime, sessionLength, breakLength } = studyConfig?.dailyStructure || { startTime: '09:00', sessionLength: 45, breakLength: 15 };
  const [startH, startM] = startTime.split(':').map(Number);
  const dayStartMins = startH * 60 + startM;

  const sessionsWithTimes = sessions.map((session, index) => {
    let startMins = dayStartMins;
    for (let i = 0; i < index; i++) {
      const previous = sessions[i];
      const wasBreak = previous.type === "break";
      const previousDuration = previous.duration || (wasBreak ? Number(breakLength) : Number(sessionLength));
      startMins += previousDuration;
    }

    const isBreak = session.type === "break";
    const duration = session.duration || (isBreak ? Number(breakLength) : Number(sessionLength));
    const endMins = startMins + duration;

    return {
      ...session,
      start: formatTime(startMins),
      end: formatTime(endMins),
    };
  });

  const currentSession = sessionsWithTimes[currentIndex];
  const currentSetupSession = sessionsWithTimes[setupIndex];
  const isBreak = currentSession?.type === "break";
  const isSetupBreak = currentSetupSession?.type === "break";
  const activeSessionIndex = focusModeState === "setup" ? setupIndex : currentIndex;
  const activeSession = focusModeState === "setup" ? currentSetupSession : currentSession;
  const activeTasks = activeSession?.tasks || [];
  const currentTasks = currentSession?.tasks || [];
  const totalTasks = currentTasks.length;
  const doneTasks = currentTasks.filter((task) => task.done).length;
  const progress = totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100);
  const firstIncompleteIndex = currentTasks.findIndex((t) => !t.done);
  const isLastSession = sessionsWithTimes.length > 0 && currentIndex === sessionsWithTimes.length - 1;
  const fullText = useMemo(() => {
    if (focusModeState === "idle") return "Generate focus plan?";
    if (focusModeState === "setup") {
      if (currentSetupSession?.type === "break") {
        return "Take a break. No planning needed.";
      }
      return `What will you do for ${currentSetupSession?.subject || "this session"}?`;
    }
    return "";
  }, [focusModeState, currentSetupSession]);

  useEffect(() => {
    if (!Array.isArray(schedule) || !setSchedule) return;
    let hasMissingTasks = false;

    for (const day of schedule) {
      for (const session of day.sessions || []) {
        if (!Array.isArray(session.tasks)) {
          hasMissingTasks = true;
          break;
        }
      }
      if (hasMissingTasks) break;
    }

    if (!hasMissingTasks) return;

    const normalizedSchedule = schedule.map((day) => ({
      ...day,
      sessions: (day.sessions || []).map((session) => ({
        ...session,
        tasks: Array.isArray(session.tasks) ? session.tasks : [],
      })),
    }));

    setSchedule(normalizedSchedule);
  }, [schedule, setSchedule]);

  useEffect(() => {
    setSessionNote(currentSession?.note || "");
  }, [currentIndex]);

  useEffect(() => {
    setDayNote(today?.dayNote || "");
  }, [today?.dayNote]);

  useEffect(() => {
    setTaskInput("");
  }, [currentIndex, setupIndex, focusModeState]);

  // Initialize timer on session change
  useEffect(() => {
    if (focusModeState !== "running" || !currentSession) {
      setTimeLeft(0);
      setIsTimerRunning(false);
      return;
    }

    const isBreakSession = currentSession.type === "break";
    const durationMins = currentSession.duration || (isBreakSession ? Number(breakLength) : Number(sessionLength));
    setTimeLeft(durationMins * 60);
    setIsTimerRunning(true);
  }, [currentIndex, focusModeState]);

  // Timer countdown
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (!isTimerRunning || timeLeft <= 0) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          setIsTimerRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isTimerRunning, timeLeft > 0]);

  useEffect(() => {
    if (sessionsWithTimes.length === 0) {
      setCurrentIndex(0);
      setSetupIndex(0);
      return;
    }
    if (currentIndex > sessionsWithTimes.length - 1) {
      setCurrentIndex(sessionsWithTimes.length - 1);
    }
    if (setupIndex > sessionsWithTimes.length - 1) {
      setSetupIndex(sessionsWithTimes.length - 1);
    }
  }, [sessionsWithTimes.length, currentIndex, setupIndex]);

  useEffect(() => {
    if (!fullText) {
      setDisplayText((prev) => (prev === "" ? prev : ""));
      return;
    }

    setDisplayText("");
    let i = 0;
    const interval = setInterval(() => {
      i += 1;
      setDisplayText((prev) => {
        const next = fullText.slice(0, i);
        return prev === next ? prev : next;
      });

      if (i >= fullText.length) {
        clearInterval(interval);
      }
    }, 30);

    return () => clearInterval(interval);
  }, [fullText, setupIndex, currentIndex, focusModeState]);

  useEffect(() => {
    if (popupState !== "sessionStart") {
      setVisibleTasks((prev) => (prev.length === 0 ? prev : []));
      return;
    }

    const introTasks = currentSession?.tasks || [];
    setVisibleTasks([]);

    const timeouts = introTasks.map((task, index) =>
      setTimeout(() => {
        setVisibleTasks((prev) => [...prev, task]);
      }, (index * 500) + 200)
    );

    return () => {
      timeouts.forEach((timeoutId) => clearTimeout(timeoutId));
    };
  }, [popupState]);

  useEffect(() => {
    if (popupUnmountTimer.current) {
      clearTimeout(popupUnmountTimer.current);
      popupUnmountTimer.current = null;
    }

    if (!popupState) {
      setIsPopupVisible(false);
      setIsBackdropVisible(false);
      popupUnmountTimer.current = setTimeout(() => {
        setShouldRenderPopup(false);
      }, 200);
      return;
    }

    setShouldRenderPopup(true);
    setIsPopupVisible(false);
    setIsBackdropVisible(false);
    const timeoutId = setTimeout(() => {
      setIsPopupVisible(true);
      setIsBackdropVisible(true);
    }, 20);

    return () => clearTimeout(timeoutId);
  }, [popupState]);

  useEffect(() => {
    closePopup();
  }, [currentIndex]);

  function openPopup(type) {
    setPopupState(type);
  }

  function closePopup() {
    setPopupState(null);
  }

  const transitionToSession = useCallback((newIndex) => {
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex(newIndex);
      setTimeout(() => {
        setIsTransitioning(false);
      }, 50);
    }, 150);
  }, []);

  function openSessionStartPopup(sessionIndex) {
    const session = sessionsWithTimes[sessionIndex];
    setTimeout(() => {
      openPopup(session?.type === "break" ? "breakStart" : "sessionStart");
    }, 200);
  }

  function nextSession() {
    if (isBreak) {
      if (isLastSession) {
        openPopup("dayComplete");
        return;
      }
      const nextIndex = currentIndex + 1;
      closePopup();
      transitionToSession(nextIndex);
      openSessionStartPopup(nextIndex);
      return;
    }

    if (!currentSession?.completed) {
      openPopup("confirmNext");
    } else {
      openPopup("sessionNote");
    }
  }

  function proceedAfterSessionNote() {
    closePopup();
    setTimeout(() => {
      if (isLastSession) {
        openPopup("dayComplete");
      } else {
        openPopup("sessionEnd");
      }
    }, 200);
  }

  function saveSessionNote(shouldContinue = true) {
    if (!Array.isArray(schedule) || dayIndex < 0 || !currentSession || currentSession.type === "break") {
      if (shouldContinue) proceedAfterSessionNote();
      return;
    }

    const newSchedule = [...schedule];
    const day = newSchedule[dayIndex];
    if (!day?.sessions?.[currentIndex]) {
      if (shouldContinue) proceedAfterSessionNote();
      return;
    }

    const newSessions = [...day.sessions];
    const sessionToUpdate = newSessions[currentIndex];
    newSessions[currentIndex] = {
      ...sessionToUpdate,
      note: sessionNote,
    };

    newSchedule[dayIndex] = {
      ...day,
      sessions: newSessions,
    };

    setSchedule(newSchedule);
    if (shouldContinue) proceedAfterSessionNote();
  }

  function hasIncompleteTasks() {
    return sessions.some((session) =>
      session.type === "study" &&
      session.tasks?.some((task) => !task.done)
    );
  }

  function requestExit() {
    if (focusModeState === "setup" || focusModeState === "idle") {
      onExit();
      return;
    }

    if (hasIncompleteTasks()) {
      openPopup("exitConfirm");
      return;
    }
    openPopup("reflection");
  }

  function saveReflectionAndExit() {
    if (Array.isArray(schedule) && dayIndex >= 0) {
      const newSchedule = [...schedule];
      const day = newSchedule[dayIndex];
      if (day) {
        newSchedule[dayIndex] = {
          ...day,
          dayNote: dayNote || "",
        };
        setSchedule(newSchedule);
      }
    }
    closePopup();
    onExit();
  }

  function prevSession() {
    if (currentIndex > 0) {
      transitionToSession(currentIndex - 1);
    }
  }

  function markSessionComplete() {
    if (!Array.isArray(schedule) || dayIndex < 0 || !currentSession || currentSession.type === "break") return;

    const newSchedule = [...schedule];
    const day = newSchedule[dayIndex];
    if (!day?.sessions?.[currentIndex]) return;

    const newSessions = [...day.sessions];
    const current = newSessions[currentIndex];

    const newCompleted = !current.completed;

    newSessions[currentIndex] = {
      ...current,
      completed: newCompleted,
    };

    newSchedule[dayIndex] = {
      ...day,
      sessions: newSessions,
    };

    setSchedule(newSchedule);
  }

  function addTask() {
    if (!taskInput.trim() || !Array.isArray(schedule) || dayIndex < 0 || !activeSession || activeSession.type === "break") return;

    const newSchedule = [...schedule];
    const day = newSchedule[dayIndex];
    if (!day?.sessions?.[activeSessionIndex]) return;

    const newSessions = [...day.sessions];
    const sessionToUpdate = newSessions[activeSessionIndex];
    const sessionTasks = Array.isArray(sessionToUpdate.tasks) ? [...sessionToUpdate.tasks] : [];

    sessionTasks.push({
      text: taskInput.trim(),
      done: false,
    });

    newSessions[activeSessionIndex] = {
      ...sessionToUpdate,
      tasks: sessionTasks,
    };

    newSchedule[dayIndex] = {
      ...day,
      sessions: newSessions,
    };

    setSchedule(newSchedule);
    setTaskInput("");
  }

  function toggleTask(taskIndex) {
    if (!Array.isArray(schedule) || dayIndex < 0 || !currentSession || currentSession.type === "break") return;

    const newSchedule = [...schedule];
    const day = newSchedule[dayIndex];
    if (!day?.sessions?.[currentIndex]) return;

    const newSessions = [...day.sessions];
    const sessionToUpdate = newSessions[currentIndex];
    const sessionTasks = Array.isArray(sessionToUpdate.tasks) ? [...sessionToUpdate.tasks] : [];
    if (!sessionTasks[taskIndex]) return;

    sessionTasks[taskIndex] = {
      ...sessionTasks[taskIndex],
      done: !sessionTasks[taskIndex].done,
    };

    const allTasksDone = sessionTasks.length > 0 && sessionTasks.every((task) => task.done);

    newSessions[currentIndex] = {
      ...sessionToUpdate,
      tasks: sessionTasks,
      completed: allTasksDone,
    };

    newSchedule[dayIndex] = {
      ...day,
      sessions: newSessions,
    };

    setSchedule(newSchedule);
  }

  function saveEdit() {
    if (editingTaskIndex === null || dayIndex < 0 || !Array.isArray(schedule)) return;

    const targetSessionIndex = focusModeState === "setup" ? setupIndex : currentIndex;
    const newSchedule = [...schedule];
    const day = newSchedule[dayIndex];
    if (!day?.sessions?.[targetSessionIndex]) return;

    const newSessions = [...day.sessions];
    const sessionToUpdate = { ...newSessions[targetSessionIndex] };
    const sessionTasks = [...(sessionToUpdate.tasks || [])];

    if (sessionTasks[editingTaskIndex]) {
      sessionTasks[editingTaskIndex] = {
        ...sessionTasks[editingTaskIndex],
        text: editingText.trim() || sessionTasks[editingTaskIndex].text
      };

      sessionToUpdate.tasks = sessionTasks;
      newSessions[targetSessionIndex] = sessionToUpdate;
      newSchedule[dayIndex] = { ...day, sessions: newSessions };
      setSchedule(newSchedule);
    }

    setEditingTaskIndex(null);
    setEditingText("");
  }

  function deleteTask(index) {
    if (dayIndex < 0 || !Array.isArray(schedule)) return;

    const targetSessionIndex = focusModeState === "setup" ? setupIndex : currentIndex;
    const newSchedule = [...schedule];
    const day = newSchedule[dayIndex];
    if (!day?.sessions?.[targetSessionIndex]) return;

    const newSessions = [...day.sessions];
    const sessionToUpdate = { ...newSessions[targetSessionIndex] };
    const sessionTasks = [...(sessionToUpdate.tasks || [])];

    sessionTasks.splice(index, 1);

    sessionToUpdate.tasks = sessionTasks;
    newSessions[targetSessionIndex] = sessionToUpdate;
    newSchedule[dayIndex] = { ...day, sessions: newSessions };
    setSchedule(newSchedule);

    if (editingTaskIndex === index) {
      setEditingTaskIndex(null);
      setEditingText("");
    }
  }

  function nextSetupSession() {
    if (setupIndex < sessionsWithTimes.length - 1) {
      setSetupIndex((prev) => prev + 1);
      return;
    }
    setFocusModeState("running");
    setTimeout(() => {
      openPopup(
        currentSession?.type === "break"
          ? "breakStart"
          : "sessionStart"
      );
    }, 150);
  }

  function continueAfterSessionEnd() {
    closePopup();
    if (currentIndex < sessionsWithTimes.length - 1) {
      const nextIndex = currentIndex + 1;
      transitionToSession(nextIndex);
      openSessionStartPopup(nextIndex);
    } else {
      setTimeout(() => {
        openPopup("dayComplete");
      }, 200);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0a0a] text-white h-screen flex justify-center px-6 overflow-hidden">
      <div className="w-full max-w-3xl flex flex-col h-full py-4">
        <div className="shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-semibold text-white/80">Focus Mode</h1>
          </div>

          {focusModeState === "idle" && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 shadow-lg shadow-black/20 text-center w-full space-y-1.5">
              <h2 className="text-xl font-semibold text-white/90 min-h-[30px]">{displayText}</h2>
            </div>
          )}

          {focusModeState === "setup" && (
            <div className="bg-white/[0.06] border border-white/15 rounded-2xl p-4 shadow-xl shadow-black/30 space-y-3">
              {currentSetupSession ? (
                <>
                  <p className="text-xs uppercase tracking-widest font-semibold text-purple-300/80">
                    Setup Session {setupIndex + 1} of {sessionsWithTimes.length}
                  </p>
                  <h2 className="text-xl font-semibold">
                    {currentSetupSession.type === "break" ? "Break Time" : currentSetupSession.subject}
                  </h2>
                  <p className="text-sm text-white/55">
                    {currentSetupSession.start} - {currentSetupSession.end}
                  </p>
                  <p className="text-xs text-white/70 min-h-[16px]">{displayText}</p>
                </>
              ) : (
                <h2 className="text-lg font-medium text-white/60">No sessions for today</h2>
              )}
            </div>
          )}

          {focusModeState === "running" && (currentSession ? (
            <div className={`rounded-2xl p-4 mb-2 text-center w-full space-y-3 border shadow-xl transition-all duration-300 ease-out ${isTransitioning ? "opacity-0 scale-[0.97] translate-y-2" : "opacity-100 scale-100 translate-y-0"
              } ${currentSession.completed
                ? "bg-green-500/10 border-green-300/30 shadow-green-900/20"
                : isBreak
                  ? "bg-sky-500/[0.06] border-sky-300/20 shadow-sky-900/10"
                  : "bg-white/[0.04] border-white/10 shadow-black/30"
              }`}>
              {/* Timer — dominant anchor */}
              <div className="flex items-center justify-center gap-4">
                <span className={`text-3xl font-mono font-bold tracking-wider transition-colors duration-500 ${timeLeft <= 0
                    ? "text-white/30"
                    : timeLeft <= 60
                      ? "text-red-400"
                      : timeLeft <= 300
                        ? "text-amber-400/90"
                        : "text-white/90"
                  }`}>
                  {formatTimer(timeLeft)}
                </span>
                <button
                  onClick={() => { if (timeLeft > 0) setIsTimerRunning((prev) => !prev); }}
                  disabled={timeLeft <= 0}
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-white/[0.06] border border-white/10 text-white/50 hover:bg-white/12 hover:text-white/80 disabled:opacity-25 disabled:cursor-not-allowed transition-all active:scale-90 text-sm"
                  title={isTimerRunning ? "Pause" : "Resume"}
                >
                  {isTimerRunning ? "⏸" : "▶"}
                </button>
              </div>

              {/* Session info — compact */}
              <div className="space-y-1.5">
                <h2 className="text-xl font-semibold text-white/90">
                  {currentSession?.type === "break" ? "Break Time" : currentSession?.subject}
                </h2>
                <p className="text-xs uppercase tracking-widest text-purple-300/70 font-medium">
                  Session {currentIndex + 1} of {sessionsWithTimes.length} · {currentSession?.start} – {currentSession?.end}
                </p>
              </div>

              {/* Progress bar */}
              {currentSession?.type !== "break" && totalTasks > 0 && (
                <div className="w-full space-y-1.5">
                  <div className="w-full h-1 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500 ease-out"
                      style={{
                        width: `${progress}%`,
                        background: progress === 100
                          ? "linear-gradient(90deg, #34d399, #6ee7b7)"
                          : "linear-gradient(90deg, #7c6fff, #a78bfa)"
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-white/40">{doneTasks} of {totalTasks} tasks</p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 shadow-lg shadow-black/20 text-center w-full">
              <h2 className="text-lg font-medium text-white/60">No sessions for today</h2>
            </div>
          ))}
        </div>

        <div className={`flex-1 flex flex-col min-h-0 transition-opacity duration-200 ease-out ${isTransitioning ? "opacity-0" : "opacity-100"}`}>
          {focusModeState === "idle" && (
            <p className="text-xs text-white/60">Choose an option below to begin Focus Mode.</p>
          )}

          {focusModeState === "setup" && currentSetupSession && currentSetupSession.type !== "break" && (
            <div className="flex flex-col h-full">
              <div className="shrink-0 flex items-center mt-6 mb-4">
                <input
                  value={taskInput}
                  onChange={(e) => setTaskInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addTask(); }}
                  placeholder="Type a task and press Enter"
                  className="flex-1 h-8 rounded-xl bg-white/[0.05] border border-white/15 px-3 text-xs text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#7c6fff]/40 focus:border-transparent transition-all"
                />
                <button
                  onClick={addTask}
                  className="ml-2 h-8 px-4 rounded-xl bg-[#7c6fff]/20 hover:bg-[#7c6fff]/30 border border-[#7c6fff]/30 text-xs text-[#c4b5fd] font-medium transition-all active:scale-95"
                >
                  + Add
                </button>
              </div>
              <div className="flex-1 overflow-y-auto pr-2 focus-scroll space-y-3">
                {activeTasks.map((task, i) => (
                  <div key={i} className="group rounded-xl bg-white/[0.03] border border-white/10 px-3 py-1 animate-[fadeSlideIn_0.3s_ease-out_forwards]" style={{ animationDelay: `${i * 50}ms`, opacity: 0 }}>
                    {editingTaskIndex === i ? (
                      <input autoFocus value={editingText} onChange={(e) => setEditingText(e.target.value)} onBlur={saveEdit} onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditingTaskIndex(null); }} className="w-full bg-transparent p-0 text-xs text-white focus:outline-none" />
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-white/85">{task.text}</span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditingTaskIndex(i); setEditingText(task.text); }} className="p-1 hover:bg-white/10 rounded text-white/40 hover:text-white/80 transition-colors" title="Edit">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          </button>
                          <button onClick={() => deleteTask(i)} className="p-1 hover:bg-red-500/20 rounded text-white/40 hover:text-red-400 transition-colors" title="Delete">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {focusModeState === "running" && currentSession && currentSession.type !== "break" && (
            <div className="flex flex-col h-full">
              {/* Add task input */}
              <div className="shrink-0 flex items-center mt-0 mb-3">
                <input
                  value={taskInput}
                  onChange={(e) => setTaskInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addTask(); }}
                  placeholder="Add a task..."
                  className="flex-1 h-8 rounded-xl bg-white/[0.05] border border-white/15 px-3 text-xs text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#7c6fff]/40 focus:border-transparent transition-all"
                />
                <button
                  onClick={addTask}
                  className="ml-2 h-8 px-4 rounded-xl bg-[#7c6fff]/20 hover:bg-[#7c6fff]/30 border border-[#7c6fff]/30 text-xs text-[#c4b5fd] font-medium transition-all active:scale-95"
                >
                  + Add
                </button>
              </div>

              {/* Hierarchical task list */}
              <div className="flex-1 overflow-y-auto pr-2 focus-scroll space-y-2">
                {currentTasks.map((task, i) => {
                  const isActive = i === firstIncompleteIndex;
                  const isDone = task.done;
                  return (
                    <div
                      key={i}
                      className={`group relative flex items-center gap-2 rounded-xl px-3 transition-all duration-300 ${isDone
                          ? "py-1.5 bg-white/[0.02] border border-white/[0.05] opacity-60"
                          : isActive
                            ? "py-2.5 bg-[#7c6fff]/[0.08] border border-[#7c6fff]/25 shadow-lg shadow-[#7c6fff]/5"
                            : "py-2 bg-white/[0.03] border border-white/[0.08]"
                        }`}
                    >
                      <input
                        type="checkbox"
                        checked={task.done}
                        onChange={() => toggleTask(i)}
                        className="w-4 h-4 rounded accent-green-400 cursor-pointer flex-shrink-0"
                      />
                      {editingTaskIndex === i ? (
                        <input autoFocus value={editingText} onChange={(e) => setEditingText(e.target.value)} onBlur={saveEdit} onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditingTaskIndex(null); }} className="flex-1 bg-transparent p-0 text-xs text-white focus:outline-none" />
                      ) : (
                        <div className="flex-1 flex items-center justify-between gap-2 min-w-0">
                          <span className={`transition-all duration-300 ${isDone
                              ? "text-xs text-white/35 line-through"
                              : isActive
                                ? "text-sm font-medium text-white/95"
                                : "text-xs text-white/70"
                            }`}>
                            {task.text}
                          </span>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <button onClick={() => { setEditingTaskIndex(i); setEditingText(task.text); }} className="p-1 hover:bg-white/10 rounded text-white/40 hover:text-white/80 transition-colors" title="Edit">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            </button>
                            <button onClick={() => deleteTask(i)} className="p-1 hover:bg-red-500/20 rounded text-white/40 hover:text-red-400 transition-colors" title="Delete">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </div>
                      )}
                      {isActive && !isDone && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-2/3 rounded-r-full bg-[#7c6fff]" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className={`shrink-0 pb-3 ${focusModeState === "setup" ? "mt-6" : "mt-3"}`}>
          <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/10 to-white/5 backdrop-blur-md p-4 shadow-[0_8px_30px_rgba(0,0,0,0.3)]">
            {focusModeState === "idle" && (
              <div className="flex items-center justify-between gap-2 w-full">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setFocusModeState("setup")}
                    className="h-8 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs text-white/90 transition-all active:scale-95"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setFocusModeState("running")}
                    className="h-8 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-white/75 transition-all active:scale-95"
                  >
                    Skip
                  </button>
                </div>
                <button
                  onClick={requestExit}
                  className="text-white/50 text-xs hover:text-white/85 transition-colors"
                >
                  Exit Focus Mode
                </button>
              </div>
            )}

            {focusModeState === "setup" && (
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <button
                    onClick={nextSetupSession}
                    className="h-8 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs text-white/90 transition-all active:scale-95"
                  >
                    {isSetupBreak ? "Continue" : "Next Session"}
                  </button>
                  {setupIndex > 0 && (
                    <button
                      onClick={() => setSetupIndex(prev => prev - 1)}
                      className="h-8 px-3 rounded-xl bg-transparent border border-white/5 text-white/40 hover:text-white/70 hover:border-white/10 transition-all active:scale-95 text-[10px]"
                    >
                      ← Previous
                    </button>
                  )}
                </div>
                <button
                  onClick={requestExit}
                  className="text-white/50 text-xs hover:text-white/85 transition-colors"
                >
                  Exit Focus Mode
                </button>
              </div>
            )}

            {focusModeState === "running" && (
              <div className="flex flex-col items-center gap-3 w-full">
                {/* Primary action */}
                {currentSession && currentSession.type !== "break" && (
                  <button
                    onClick={markSessionComplete}
                    disabled={currentSession.completed === true}
                    className="w-full h-10 rounded-xl font-semibold transition-all active:scale-[0.98] text-xs tracking-wide disabled:cursor-not-allowed bg-gradient-to-r from-green-500/25 to-emerald-500/20 border border-green-400/30 text-green-300 hover:from-green-500/35 hover:to-emerald-500/30 disabled:from-green-500/10 disabled:to-emerald-500/8 disabled:opacity-60 disabled:text-green-300/60"
                  >
                    {currentSession.completed ? "✓ Session Completed" : "✔ Complete Session"}
                  </button>
                )}
                {/* Secondary navigation */}
                <div className="flex items-center justify-between w-full">
                  <button
                    onClick={prevSession}
                    disabled={sessionsWithTimes.length === 0 || currentIndex === 0}
                    className="h-8 bg-white/[0.04] border border-white/[0.08] text-white/60 rounded-lg px-3 hover:bg-white/[0.08] hover:text-white/80 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 text-[10px]"
                  >
                    ← Previous
                  </button>
                  <button
                    onClick={requestExit}
                    className="text-white/35 text-[10px] hover:text-white/60 transition-colors"
                  >
                    Exit
                  </button>
                  <button
                    onClick={nextSession}
                    disabled={sessionsWithTimes.length === 0}
                    className="h-8 bg-white/[0.04] border border-white/[0.08] text-white/60 rounded-lg px-3 hover:bg-white/[0.08] hover:text-white/80 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 text-[10px]"
                  >
                    {isLastSession ? "Finish →" : "Next →"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {shouldRenderPopup && (
        <div className={`fixed inset-0 backdrop-blur-md flex items-center justify-center z-[60] px-4 transition-all duration-200 ease-out ${isBackdropVisible ? "bg-black/70" : "bg-black/0"
          }`}>
          <div className={`w-full max-w-md p-8 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 shadow-2xl shadow-black/40 text-center space-y-4 transition-all duration-200 ease-out ${isPopupVisible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-2"
            }`}>
            {popupState === "confirmNext" && (
              <>
                <h3 className="text-xl font-semibold text-white/90">Are you sure you want to move on?</h3>
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => closePopup()}
                    className="h-10 px-5 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 transition-all active:scale-95 text-sm"
                  >
                    Stay
                  </button>
                  <button
                    onClick={() => {
                      closePopup();
                      setTimeout(() => {
                        openPopup("sessionNote");
                      }, 200);
                    }}
                    className="h-10 px-5 rounded-xl bg-white/10 border border-white/20 text-white/90 hover:bg-white/15 transition-all active:scale-95 text-sm font-medium"
                  >
                    Continue
                  </button>
                </div>
              </>
            )}

            {popupState === "sessionNote" && (
              <>
                <h3 className="text-xl font-semibold text-white/95">What did you complete in this session?</h3>
                <textarea
                  value={sessionNote}
                  onChange={(e) => setSessionNote(e.target.value)}
                  placeholder="Add a quick summary..."
                  className="w-full min-h-[110px] rounded-xl bg-white/[0.04] border border-white/15 px-4 py-3 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-[#7c6fff]/45 resize-none text-left"
                />
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => proceedAfterSessionNote()}
                    className="h-10 px-5 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 transition-all active:scale-95 text-sm"
                  >
                    Skip
                  </button>
                  <button
                    onClick={() => saveSessionNote(true)}
                    className="h-10 px-5 rounded-xl bg-white/10 border border-white/20 text-white/90 hover:bg-white/15 transition-all active:scale-95 text-sm font-medium"
                  >
                    Save
                  </button>
                </div>
              </>
            )}

            {popupState === "sessionEnd" && (
              <>
                <div className="mx-auto w-14 h-14 rounded-full bg-green-500/20 border border-green-400/30 flex items-center justify-center text-green-300 text-2xl">
                  ✓
                </div>
                <h3 className="text-2xl font-semibold text-white/95">Nice work.</h3>
                <p className="text-white/70">You completed this session</p>
                <button
                  onClick={continueAfterSessionEnd}
                  className="mt-6 bg-white/10 hover:bg-white/20 px-6 py-2 rounded-xl border border-white/15 text-white/90 transition-all active:scale-95 text-sm font-medium"
                >
                  Continue
                </button>
              </>
            )}

            {popupState === "dayComplete" && (
              <>
                <div className="mx-auto w-14 h-14 rounded-full bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300 text-2xl">
                  ✨
                </div>
                <h3 className="text-2xl font-semibold text-white/95">Day Complete</h3>
                <p className="text-white/70">You’ve completed all your sessions for today.</p>
                <button
                  onClick={() => {
                    closePopup();
                    setTimeout(() => {
                      openPopup("reflection");
                    }, 200);
                  }}
                  className="mt-6 bg-white/10 hover:bg-white/20 px-6 py-2 rounded-xl border border-white/15 text-white/90 transition-all active:scale-95 text-sm font-medium"
                >
                  Continue
                </button>
              </>
            )}

            {popupState === "sessionStart" && (
              <>
                <h3 className="text-xl font-semibold text-white/90">Session {currentIndex + 1}</h3>
                <p className="text-white/80">
                  {currentSession?.type === "break" ? "Break Time" : currentSession?.subject}
                </p>
                <p className="text-sm text-white/60">
                  Duration: {currentSession?.duration || (currentSession?.type === "break" ? Number(breakLength) : Number(sessionLength))} mins
                </p>
                {currentSession?.type !== "break" && (
                  <div className="text-left space-y-2">
                    {(visibleTasks.length > 0 ? visibleTasks : []).map((task, index) => (
                      <div
                        key={`${task.text}-${index}`}
                        className="rounded-lg bg-white/[0.03] border border-white/10 px-3 py-2 text-sm text-white/85 transition-all duration-300 ease-out opacity-100 translate-y-0"
                      >
                        {task.text}
                      </div>
                    ))}
                    {visibleTasks.length === 0 && (
                      <p className="text-sm text-white/50 text-center">No tasks added for this session yet.</p>
                    )}
                  </div>
                )}
                <button
                  onClick={() => closePopup()}
                  className="h-10 px-6 rounded-xl bg-white/10 border border-white/20 text-white/90 hover:bg-white/15 transition-all active:scale-95 text-sm font-medium"
                >
                  Start
                </button>
              </>
            )}

            {popupState === "breakStart" && (
              <>
                <h3 className="text-2xl font-semibold text-white/90">Take a break.</h3>
                <p className="text-white/65">Relax. Breathe. Maybe listen to some music.</p>
                <button
                  onClick={() => closePopup()}
                  className="h-10 px-6 rounded-xl bg-white/10 border border-white/15 text-white/90 hover:bg-white/20 transition-all active:scale-95 text-sm font-medium"
                >
                  Start Break
                </button>
              </>
            )}

            {popupState === "exitConfirm" && (
              <>
                <h3 className="text-xl font-semibold text-white/95">You still have unfinished tasks. Exit anyway?</h3>
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => closePopup()}
                    className="h-10 px-5 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 transition-all active:scale-95 text-sm"
                  >
                    Stay
                  </button>
                  <button
                    onClick={() => {
                      closePopup();
                      setTimeout(() => openPopup("reflection"), 200);
                    }}
                    className="h-10 px-5 rounded-xl bg-white/10 border border-white/20 text-white/90 hover:bg-white/15 transition-all active:scale-95 text-sm font-medium"
                  >
                    Exit
                  </button>
                </div>
              </>
            )}

            {popupState === "reflection" && (
              <>
                <h3 className="text-2xl font-semibold text-white/95">Reflect on your day</h3>
                <textarea
                  value={dayNote}
                  onChange={(e) => setDayNote(e.target.value)}
                  placeholder="What did you complete today?"
                  className="w-full min-h-[110px] rounded-xl bg-white/[0.04] border border-white/15 px-4 py-3 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-[#7c6fff]/45 resize-none text-left"
                />
                <button
                  onClick={saveReflectionAndExit}
                  className="h-10 px-6 rounded-xl bg-white/10 border border-white/15 text-white/90 hover:bg-white/20 transition-all active:scale-95 text-sm font-medium"
                >
                  Save & Exit
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
