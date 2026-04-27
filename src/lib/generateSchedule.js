export function generateSchedule(config) {
  const {
    subjects,
    extras,
    priorities,
    startDate,
    endDate,
    breakDays,
    dailyStructure
  } = config;

  // STEP 3: Valid Days
  const start = new Date(startDate);
  const end = new Date(endDate);
  const validDays = [];
  const breakSet = new Set(breakDays);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    if (!breakSet.has(dateStr)) {
      validDays.push(dateStr);
    }
  }

  if (validDays.length === 0) return [];

  // STEP 4: Sessions per day
  const parseTime = (timeStr) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  const startMins = parseTime(dailyStructure.startTime);
  const endMins = parseTime(dailyStructure.endTime);
  const totalMins = endMins - startMins;

  const sessionLen = Number(dailyStructure.sessionLength);
  const breakLen = Number(dailyStructure.breakLength);

  const sessionsPerDay = Math.floor(totalMins / (sessionLen + breakLen));

  if (sessionsPerDay <= 0) return [];

  // STEP 5: Total Sessions
  const totalSessions = validDays.length * sessionsPerDay;

  // STEP 6: Split items
  const mainSubjects = subjects || [];
  const extraItems = extras || [];

  // STEP 7 & 8: Main Subject Distribution
  let totalWeight = 0;
  const subjectWeights = mainSubjects.map(s => {
    const priority = Number(priorities[s.name] || 5);
    const multiplier = s.level === 'HL' ? 1.15 : 1.0;
    const weight = priority * multiplier;
    totalWeight += weight;
    return { name: s.name, weight };
  });

  const subjectAllocations = {};
  let allocatedSessions = 0;

  for (const s of subjectWeights) {
    let target = Math.round((s.weight / totalWeight) * totalSessions);
    if (target < 2) target = 2; // minimum 2
    subjectAllocations[s.name] = target;
    allocatedSessions += target;
  }

  // Normalize
  let diff = totalSessions - allocatedSessions;
  while (diff !== 0) {
    const sorted = [...subjectWeights].sort((a, b) => 
      diff > 0 ? b.weight - a.weight : a.weight - b.weight
    );

    for (const s of sorted) {
      if (diff === 0) break;
      if (diff > 0) {
        subjectAllocations[s.name]++;
        diff--;
      } else {
        if (subjectAllocations[s.name] > 2) {
          subjectAllocations[s.name]--;
          diff++;
        }
      }
    }
  }

  // STEP 9: Extra Distribution
  const maxExtraSessions = validDays.length;
  const extraAllocations = {};
  
  if (extraItems.length > 0) {
    let totalExtraWeight = 0;
    const extraWeights = extraItems.map(e => {
      const priority = Number(priorities[e] || 5);
      const weight = priority * 0.85; // Using the 0.85 extra multiplier
      totalExtraWeight += weight;
      return { name: e, weight };
    });

    let extraAllocated = 0;
    for (const e of extraWeights) {
      let target = Math.round((e.weight / totalExtraWeight) * maxExtraSessions);
      if (target < 1) target = 1;
      extraAllocations[e.name] = target;
      extraAllocated += target;
    }

    // Normalize extras (ensure total <= maxExtraSessions)
    let eDiff = maxExtraSessions - extraAllocated;
    while (eDiff < 0) {
      const sorted = [...extraWeights].sort((a, b) => a.weight - b.weight);
      for (const e of sorted) {
        if (eDiff === 0) break;
        if (extraAllocations[e.name] > 1) {
          extraAllocations[e.name]--;
          eDiff++;
        }
      }
    }
  }

  // STEP 10: Assign Extras to days
  const shuffle = (array) => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const dayExtraMap = {};
  const shuffledDays = shuffle(validDays);
  
  let dayIdx = 0;
  for (const e of extraItems) {
    let count = extraAllocations[e];
    while (count > 0 && dayIdx < shuffledDays.length) {
      dayExtraMap[shuffledDays[dayIdx]] = e;
      dayIdx++;
      count--;
    }
  }

  // STEP 11: Build Subject Pool
  let subjectPool = [];
  for (const [subj, count] of Object.entries(subjectAllocations)) {
    for (let i = 0; i < count; i++) {
      subjectPool.push(subj);
    }
  }
  subjectPool = shuffle(subjectPool);

  // STEP 12: Build Daily Schedule
  const schedule = [];
  
  // Sort back to chronological order
  const sortedDays = [...validDays].sort();

  for (const date of sortedDays) {
    const daySessions = [];
    const dayUsage = {};
    const slots = sessionsPerDay;
    const extraForDay = dayExtraMap[date];

    let extraSlotIdx = -1;
    if (extraForDay) {
      extraSlotIdx = Math.floor(Math.random() * slots);
    }

    let lastSubject = null;

    for (let i = 0; i < slots; i++) {
      if (i === extraSlotIdx) {
        daySessions.push({ type: 'study', subject: extraForDay, isExtra: true });
        lastSubject = null;
        continue;
      }

      let pickedIdx = -1;
      for (let j = 0; j < subjectPool.length; j++) {
        const candidate = subjectPool[j];
        const usageCount = dayUsage[candidate] || 0;
        
        if (candidate !== lastSubject && usageCount < 2) {
          pickedIdx = j;
          break;
        }
      }

      // If conflict, relax consecutive constraint
      if (pickedIdx === -1 && subjectPool.length > 0) {
        for (let j = 0; j < subjectPool.length; j++) {
          const candidate = subjectPool[j];
          if ((dayUsage[candidate] || 0) < 2) {
            pickedIdx = j;
            break;
          }
        }
        // If still no match, just take the first one
        if (pickedIdx === -1) {
          pickedIdx = 0; 
        }
      }

      let pickedSubj = 'Free Study';
      if (pickedIdx !== -1) {
        pickedSubj = subjectPool.splice(pickedIdx, 1)[0];
        dayUsage[pickedSubj] = (dayUsage[pickedSubj] || 0) + 1;
        lastSubject = pickedSubj;
      }

      daySessions.push({ type: 'study', subject: pickedSubj });
    }

    // Format with breaks
    const fullDaySessions = [];
    for (let i = 0; i < daySessions.length; i++) {
      fullDaySessions.push(daySessions[i]);
      if (i < daySessions.length - 1) {
        fullDaySessions.push({ type: 'break', duration: breakLen });
      }
    }

    schedule.push({
      date,
      sessions: fullDaySessions
    });
  }

  return schedule;
}
