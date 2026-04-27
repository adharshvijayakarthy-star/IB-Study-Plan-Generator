import { useState } from 'react';

const SUBJECT_LIST = [
  "Physics", "Math AA", "Math AI", "Chemistry", "Biology", 
  "Computer Science", "Economics", "Business", "Psychology", 
  "English A", "2nd Language"
];

export default function SetupFlow({ onComplete, initialData }) {
  const [subjects, setSubjects] = useState(initialData?.subjects || []);
  const [extras, setExtras] = useState(initialData?.extras || []);
  const [extraInput, setExtraInput] = useState("");
  const [priorities, setPriorities] = useState(initialData?.priorities || {});
  const [startDate, setStartDate] = useState(initialData?.startDate || "");
  const [endDate, setEndDate] = useState(initialData?.endDate || "");
  const [breakDays, setBreakDays] = useState(initialData?.breakDays || []);
  const [breakDateInput, setBreakDateInput] = useState("");
  const [dailyStructure, setDailyStructure] = useState(initialData?.dailyStructure || {
    startTime: "09:00",
    endTime: "18:00",
    sessionLength: 45,
    breakLength: 15,
    breakCount: 3
  });

  const toggleSubject = (subject) => {
    setSubjects(prev => {
      const exists = prev.find(s => s.name === subject);
      if (exists) return prev.filter(s => s.name !== subject);
      return [...prev, { name: subject, level: 'HL' }];
    });
  };

  const toggleLevel = (e, subjectName) => {
    e.stopPropagation();
    setSubjects(prev => prev.map(s => {
      if (s.name === subjectName) {
        return { ...s, level: s.level === 'HL' ? 'SL' : 'HL' };
      }
      return s;
    }));
  };

  const addExtra = () => {
    if (extraInput.trim() && !extras.includes(extraInput.trim())) {
      setExtras([...extras, extraInput.trim()]);
      setExtraInput("");
    }
  };

  const removeExtra = (extra) => {
    setExtras(extras.filter(e => e !== extra));
  };

  const handlePriorityChange = (name, value) => {
    setPriorities({ ...priorities, [name]: value });
  };

  const addBreakDay = () => {
    if (!breakDateInput) return;
    
    // Check if within bounds
    if (startDate && breakDateInput < startDate) return;
    if (endDate && breakDateInput > endDate) return;
    
    if (!breakDays.includes(breakDateInput)) {
      setBreakDays([...breakDays, breakDateInput].sort());
    }
    setBreakDateInput("");
  };

  const removeBreakDay = (dateToRemove) => {
    setBreakDays(breakDays.filter(d => d !== dateToRemove));
  };

  const handleStructureChange = (e) => {
    const { name, value } = e.target;
    setDailyStructure(prev => ({ ...prev, [name]: value }));
  };

  const handleComplete = () => {
    const config = {
      subjects,
      extras,
      priorities,
      startDate,
      endDate,
      breakDays,
      dailyStructure
    };
    onComplete(config);
  };

  return (
    <section>
      <div className="card setup-card" style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div className="setup-header">
          <h2>Planner Setup</h2>
        </div>

        {/* Subjects */}
        <div className="form-group">
          <label className="form-label">Subjects & Levels</label>
          <div className="chip-container">
            {SUBJECT_LIST.map(sub => {
              const selectedSub = subjects.find(s => s.name === sub);
              const isSelected = !!selectedSub;
              return (
                <div 
                  key={sub} 
                  className={`chip ${isSelected ? 'selected' : ''}`}
                  onClick={() => toggleSubject(sub)}
                >
                  {sub}
                  {isSelected && (
                    <span 
                      className="chip-level-toggle"
                      onClick={(e) => toggleLevel(e, sub)}
                    >
                      {selectedSub.level}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Extras */}
        <div className="form-group">
          <label className="form-label">Add IA / EE / Extracurricular</label>
          <div className="flex-row">
            <input 
              type="text" 
              className="input-field" 
              placeholder="e.g. Math IA, Extended Essay" 
              value={extraInput}
              onChange={e => setExtraInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addExtra()}
            />
            <button className="btn" onClick={addExtra}>Add</button>
          </div>
          {extras.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              {extras.map(ex => (
                <div key={ex} className="list-item">
                  <span>{ex}</span>
                  <button className="remove-btn" onClick={() => removeExtra(ex)}>❌</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Priorities */}
        {(subjects.length > 0 || extras.length > 0) && (
          <div className="form-group">
            <label className="form-label">Priority (1-10)</label>
            <div style={{ padding: '12px', background: 'rgba(28,28,40,0.6)', borderRadius: '8px' }}>
              {subjects.map(s => (
                <div key={s.name} className="slider-container">
                  <label>{s.name} ({s.level})</label>
                  <input 
                    type="range" 
                    className="range-slider" 
                    min="1" max="10" 
                    value={priorities[s.name] || 5} 
                    onChange={e => handlePriorityChange(s.name, e.target.value)}
                  />
                  <span className="slider-value">{priorities[s.name] || 5}</span>
                </div>
              ))}
              {extras.map(ex => (
                <div key={ex} className="slider-container">
                  <label>{ex}</label>
                  <input 
                    type="range" 
                    className="range-slider" 
                    min="1" max="10" 
                    value={priorities[ex] || 5} 
                    onChange={e => handlePriorityChange(ex, e.target.value)}
                  />
                  <span className="slider-value">{priorities[ex] || 5}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dates */}
        <div className="form-group">
          <label className="form-label">Study Timeline</label>
          <div className="flex-row" style={{ gap: '24px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.85rem', color: '#a0a0b0', display: 'block', marginBottom: '4px' }}>Start Date</label>
              <input type="date" className="input-field" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.85rem', color: '#a0a0b0', display: 'block', marginBottom: '4px' }}>End Date</label>
              <input type="date" className="input-field" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Break Days */}
        <div className="form-group">
          <label className="form-label">Break Days (Optional)</label>
          <div className="flex-row">
            <input 
              type="date" 
              className="input-field" 
              value={breakDateInput}
              min={startDate}
              max={endDate}
              onChange={e => setBreakDateInput(e.target.value)}
            />
            <button className="btn" onClick={addBreakDay}>Add</button>
          </div>
          {breakDays.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              {breakDays.map(d => (
                <div key={d} className="list-item">
                  <span>{new Date(d).toLocaleDateString()}</span>
                  <button className="remove-btn" onClick={() => removeBreakDay(d)}>❌</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Daily Structure */}
        <div className="form-group">
          <label className="form-label">Daily Structure</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', background: 'rgba(28,28,40,0.6)', padding: '16px', borderRadius: '8px' }}>
            <div>
              <label style={{ fontSize: '0.85rem', color: '#a0a0b0', display: 'block', marginBottom: '4px' }}>Start Time</label>
              <input type="time" name="startTime" className="input-field" value={dailyStructure.startTime} onChange={handleStructureChange} />
            </div>
            <div>
              <label style={{ fontSize: '0.85rem', color: '#a0a0b0', display: 'block', marginBottom: '4px' }}>End Time</label>
              <input type="time" name="endTime" className="input-field" value={dailyStructure.endTime} onChange={handleStructureChange} />
            </div>
            <div>
              <label style={{ fontSize: '0.85rem', color: '#a0a0b0', display: 'block', marginBottom: '4px' }}>Session Length (mins)</label>
              <input type="number" name="sessionLength" className="input-field" value={dailyStructure.sessionLength} onChange={handleStructureChange} />
            </div>
            <div>
              <label style={{ fontSize: '0.85rem', color: '#a0a0b0', display: 'block', marginBottom: '4px' }}>Break Length (mins)</label>
              <input type="number" name="breakLength" className="input-field" value={dailyStructure.breakLength} onChange={handleStructureChange} />
            </div>
            <div>
              <label style={{ fontSize: '0.85rem', color: '#fff', display: 'block', marginBottom: '2px', fontWeight: '500' }}>Number of Breaks</label>
              <label style={{ fontSize: '0.75rem', color: '#a0a0b0', display: 'block', marginBottom: '4px' }}>Total breaks per day (not including session count)</label>
              <input type="number" name="breakCount" className="input-field" min="0" value={dailyStructure.breakCount} onChange={handleStructureChange} />
            </div>
          </div>
        </div>

        {/* Generate Button */}
        <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'flex-end' }}>
          <button 
            className="btn" 
            onClick={handleComplete}
            style={{ padding: '12px 32px', fontSize: '1.1rem', background: '#7c6fff', color: '#fff', borderColor: '#7c6fff' }}
          >
            Generate Plan
          </button>
        </div>
      </div>
    </section>
  );
}
