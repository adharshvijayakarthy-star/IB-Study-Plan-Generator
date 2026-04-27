import React, { useState, useEffect } from 'react';

export default function FocusMode({ onExit, schedule, studyConfig }) {
  const [currentMins, setCurrentMins] = useState(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentMins(now.getHours() * 60 + now.getMinutes());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const todayDate = new Date().toISOString().split('T')[0];
  const todayData = schedule?.find(d => d.date === todayDate);

  const formatTime = (totalMinutes) => {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const { startTime, sessionLength, breakLength } = studyConfig?.dailyStructure || { startTime: '09:00', sessionLength: 45, breakLength: 15 };
  const [startH, startM] = startTime.split(':').map(Number);
  const dayStartMins = startH * 60 + startM;

  let activeSession = null;
  let totalStudySessions = 0;

  if (todayData?.sessions) {
    let tempMins = dayStartMins;
    totalStudySessions = todayData.sessions.filter(s => s.type !== 'break').length;

    let studyIndex = 1;
    for (const session of todayData.sessions) {
      const isBreak = session.type === 'break';
      const duration = session.duration || (isBreak ? Number(breakLength) : Number(sessionLength));
      const sessionEnd = tempMins + duration;

      if (currentMins >= tempMins && currentMins < sessionEnd) {
        activeSession = {
          ...session,
          startStr: formatTime(tempMins),
          endStr: formatTime(sessionEnd),
          isBreak,
          currentIndex: isBreak ? null : studyIndex
        };
      }

      if (!isBreak) studyIndex++;
      tempMins = sessionEnd;
    }
    
    // Default to first if none active
    if (!activeSession && todayData.sessions.length > 0) {
      const firstSession = todayData.sessions[0];
      const isBreak = firstSession.type === 'break';
      activeSession = {
        ...firstSession,
        startStr: formatTime(dayStartMins),
        endStr: formatTime(dayStartMins + (firstSession.duration || (isBreak ? Number(breakLength) : Number(sessionLength)))),
        isBreak,
        currentIndex: isBreak ? null : 1
      };
    }
  }

  return (
    <div className="fixed top-0 left-0 w-screen h-screen z-50 bg-[#0a0a0a] text-white flex flex-col items-center justify-center m-0 p-0 overflow-hidden">
      <div className="flex flex-col items-center justify-center space-y-6 w-full max-w-lg px-6">
        <h1 className="text-4xl font-bold tracking-tight text-white/90">Focus Mode</h1>

        {activeSession ? (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 shadow-lg shadow-black/20 text-center w-full space-y-4">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">
                {activeSession.isBreak ? 'Break Time' : activeSession.subject}
              </h2>
              <p className="text-sm text-white/50">
                {activeSession.startStr} - {activeSession.endStr}
              </p>
            </div>
            
            {!activeSession.isBreak && activeSession.currentIndex && (
              <div className="text-xs uppercase tracking-widest font-bold text-purple-400/80">
                Session {activeSession.currentIndex} of {totalStudySessions}
              </div>
            )}
            
            {activeSession.isBreak && (
              <div className="text-xs uppercase tracking-widest font-bold text-green-400/80">
                Rest Period
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 shadow-lg shadow-black/20 text-center w-full">
            <h2 className="text-lg font-medium text-white/60">No active sessions</h2>
          </div>
        )}

        <button 
          onClick={onExit}
          className="px-8 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full transition-all text-white/80 text-sm font-medium"
        >
          Exit Focus Mode
        </button>
      </div>
    </div>
  );
}
