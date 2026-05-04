"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "examPortions";
const PDF_SOURCE_KEY = "examPortionsPdfSource";

const INTERNAL_HEADING_PATTERN = /\b(topics?|concepts?|grammar|units?|lessons?)\b/i;
const SUBJECT_MARKER_PATTERN = /\b(HL|SL)\b|A\s*&\s*A|A\s*&\s*I|A&A|A&I/i;
const NOISE_LINE_PATTERN = /\b(contd|ibdp|midterm|portions|june|year)\b/i;

const SUBJECT_BOUNDARY_HINTS = [
  "Physics",
  "Mathematics",
  "Math",
  "Math AA",
  "Math AI",
  "Mathematics A&A",
  "Mathematics A&I",
  "Chemistry",
  "Biology",
  "Computer Science",
  "Digital Society",
  "Economics",
  "Business Management",
  "Business",
  "BM",
  "Psychology",
  "English",
  "English A",
  "French",
  "Hindi",
  "Tamil",
  "Spanish",
  "History",
  "Geography",
];

function createDraftId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `draft-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createDraftSubtopic(text = "", done = false) {
  return {
    id: createDraftId(),
    text,
    done,
  };
}

function createDraftTopic(title = "", subtopics = []) {
  return {
    id: createDraftId(),
    title,
    subtopics,
  };
}

function createCurrentTopic(title = "", subtopics = []) {
  return {
    title,
    subtopics,
  };
}

function createEmptyDraft() {
  return {
    id: createDraftId(),
    subject: "",
    pool: [],
    topics: [],
    currentTopic: createCurrentTopic(),
    rawInput: "",
    mode: "builder",
    examDate: "",
  };
}

function parseSubtopicLines(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function normalizePoolItems(items) {
  if (!Array.isArray(items)) return [];

  const seen = new Set();
  return items
    .map((item) => String(item).trim())
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function dedupeSubtopics(subtopics) {
  const seen = new Set();

  return subtopics.filter((subtopic) => {
    const key = subtopic.text.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeSubtopics(subtopics) {
  if (!Array.isArray(subtopics)) return [];

  return dedupeSubtopics(
    subtopics
      .map((subtopic) => {
        if (typeof subtopic === "string") {
          return {
            text: subtopic.trim(),
            done: false,
          };
        }

        return {
          text: typeof subtopic?.text === "string" ? subtopic.text.trim() : "",
          done: Boolean(subtopic?.done),
        };
      })
      .filter((subtopic) => subtopic.text)
  );
}

function normalizeTopics(record) {
  if (Array.isArray(record?.topics)) {
    return record.topics
      .map((topic) => ({
        title: typeof topic?.title === "string" ? topic.title.trim() : "",
        subtopics: normalizeSubtopics(topic?.subtopics),
      }))
      .filter((topic) => topic.title || topic.subtopics.length > 0);
  }

  if (Array.isArray(record?.portions)) {
    const subtopics = normalizeSubtopics(record.portions);
    return subtopics.length > 0
      ? [
          {
            title: "Imported Portions",
            subtopics,
          },
        ]
      : [];
  }

  return [];
}

function normalizeCurrentTopic(record) {
  const currentTopic = record?.currentTopic;

  if (!currentTopic) {
    return createCurrentTopic();
  }

  return createCurrentTopic(
    typeof currentTopic.title === "string" ? currentTopic.title.trim() : "",
    normalizePoolItems(currentTopic.subtopics)
  );
}

function getRecordMode(record, pool, currentTopic) {
  if (record?.mode === "builder") return "builder";
  if (pool.length > 0 || currentTopic.subtopics.length > 0 || currentTopic.title) return "builder";
  return "final";
}

function normalizeRecords(records) {
  if (!Array.isArray(records)) return [];

  return records
    .map((record) => {
      const pool = normalizePoolItems(record?.pool);
      const topics = normalizeTopics(record);
      const currentTopic = normalizeCurrentTopic(record);

      return {
        subject: typeof record?.subject === "string" ? record.subject.trim() : "",
        pool,
        topics,
        currentTopic,
        mode: getRecordMode(record, pool, currentTopic),
        examDate: typeof record?.examDate === "string" ? record.examDate : "",
      };
    })
    .filter((record) => record.subject);
}

function recordsToDrafts(records) {
  const drafts = normalizeRecords(records).map((record) => ({
    id: createDraftId(),
    subject: record.subject,
    pool: normalizePoolItems(record.pool),
    topics: record.topics.map((topic) =>
      createDraftTopic(
        topic.title,
        topic.subtopics.map((subtopic) => createDraftSubtopic(subtopic.text, subtopic.done))
      )
    ),
    currentTopic: createCurrentTopic(record.currentTopic.title, record.currentTopic.subtopics),
    rawInput: "",
    mode: record.mode,
    examDate: record.examDate,
  }));

  return drafts.length > 0 ? drafts : [createEmptyDraft()];
}

function draftsToRecords(drafts) {
  return drafts
    .map((draft) => {
      const pool = normalizePoolItems(draft.pool);
      const currentTopic = createCurrentTopic(
        draft.currentTopic?.title || "",
        normalizePoolItems(draft.currentTopic?.subtopics)
      );
      const topics = draft.topics
        .map((topic) => ({
          title: topic.title.trim(),
          subtopics: normalizeSubtopics(topic.subtopics),
        }))
        .filter((topic) => topic.title || topic.subtopics.length > 0);

      return {
        subject: draft.subject.trim(),
        pool,
        topics,
        currentTopic,
        mode: draft.mode === "final" && pool.length === 0 && currentTopic.subtopics.length === 0
          ? "final"
          : "builder",
        examDate: draft.examDate,
      };
    })
    .filter((record) => record.subject);
}

function cleanLine(line) {
  return line.replace(/\s+/g, " ").trim();
}

function getMathVariant(subjectName) {
  const lowerName = subjectName.toLowerCase();
  if (/\ba\s*&\s*a\b/.test(lowerName) || /\baa\b/.test(lowerName)) return "A&A";
  if (/\ba\s*&\s*i\b/.test(lowerName) || /\bai\b/.test(lowerName)) return "A&I";
  return "";
}

function getSubjectLevel(subject) {
  if (typeof subject?.level !== "string") return "";
  const level = subject.level.trim().toUpperCase();
  return level === "HL" || level === "SL" ? level : "";
}

function isMathSubject(subjectName) {
  return /\bmath(?:ematics)?\b/i.test(subjectName);
}

function getSubjectName(subject) {
  if (typeof subject === "string") return subject.trim();
  if (typeof subject?.name === "string") {
    const subjectName = subject.name.trim();
    const mathVariant = getMathVariant(subjectName);
    const level = getSubjectLevel(subject);

    if (isMathSubject(subjectName) && mathVariant && level) {
      return `Mathematics ${mathVariant} ${level}`;
    }

    return subjectName;
  }
  return "";
}

function normalizeSelectedSubjects(subjects) {
  if (!Array.isArray(subjects)) return [];

  return subjects
    .map(getSubjectName)
    .filter(Boolean)
    .filter((subject, index, allSubjects) => {
      const lowerSubject = subject.toLowerCase();
      return allSubjects.findIndex((item) => item.toLowerCase() === lowerSubject) === index;
    });
}

function containsInternalHeading(line) {
  return INTERNAL_HEADING_PATTERN.test(line);
}

function containsSubjectMarker(line) {
  return SUBJECT_MARKER_PATTERN.test(line);
}

function isNoiseLine(line) {
  return NOISE_LINE_PATTERN.test(line);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getUniqueStrings(values) {
  return values.filter((value, index, allValues) => {
    const lowerValue = value.toLowerCase();
    return allValues.findIndex((item) => item.toLowerCase() === lowerValue) === index;
  });
}

function lineHasMatchTerm(line, term) {
  const escapedTerm = escapeRegExp(term).replace(/\s+/g, "\\s+");
  return new RegExp(`(^|[^a-z0-9])${escapedTerm}([^a-z0-9]|$)`, "i").test(line);
}

function isSelectedMathSubject(subject) {
  return /^mathematics\s+a\s*&\s*[ai]\s+(hl|sl)$/i.test(subject);
}

function getSelectedMathPattern(subject) {
  const variant = getMathVariant(subject);
  const level = subject.match(/\b(HL|SL)\b/i)?.[1]?.toUpperCase();
  if (!variant || !level) return null;

  const variantPattern = variant === "A&A" ? "A\\s*&\\s*A" : "A\\s*&\\s*I";
  return new RegExp(`(^|[^a-z0-9])Mathematics\\s+${variantPattern}\\s+${level}(?=[^a-z0-9]|$)`, "i");
}

function lineContainsSelectedMathSubject(line, subject) {
  if (!isSelectedMathSubject(subject)) return false;
  const pattern = getSelectedMathPattern(subject);
  return pattern ? pattern.test(line) : false;
}

function isMathBoundary(line) {
  if (!containsSubjectMarker(line)) return false;
  return /\b(?:mathematics|math)\b.*(?:a\s*&\s*a|a\s*&\s*i|a&a|a&i|\baa\b|\bai\b)/i.test(line);
}

function getSubjectMatchTerms(subject, selectedSubjects) {
  const lowerSubject = subject.toLowerCase();
  const lowerSubjects = selectedSubjects.map((selectedSubject) => selectedSubject.toLowerCase());
  const terms = [subject];

  if (isSelectedMathSubject(subject)) {
    return terms;
  }

  if (lowerSubject.startsWith("english ")) {
    const englishSubjectCount = lowerSubjects.filter((item) => item.startsWith("english ")).length;
    if (englishSubjectCount === 1) {
      terms.push("English");
    }
  }

  if (lowerSubject === "bm" || lowerSubject === "business") {
    terms.push("BM", "Business", "Business Management");
  }

  if (lowerSubject === "2nd language") {
    terms.push("French", "Hindi", "Tamil", "Spanish", "Second Language");
  }

  return getUniqueStrings(terms);
}

function lineContainsSubject(line, subject, selectedSubjects) {
  if (isSelectedMathSubject(subject)) {
    return lineContainsSelectedMathSubject(line, subject);
  }

  return getSubjectMatchTerms(subject, selectedSubjects).some((term) =>
    lineHasMatchTerm(line, term)
  );
}

function findSelectedSubject(line, selectedSubjects) {
  if (containsInternalHeading(line)) return null;
  if (!containsSubjectMarker(line)) return null;

  const matchedSubject =
    selectedSubjects.find((subject) => lineContainsSubject(line, subject, selectedSubjects)) || null;
  if (!matchedSubject) return null;

  if (matchedSubject.toLowerCase() === "2nd language") {
    const matchedLanguage = ["French", "Hindi", "Tamil", "Spanish"].find((language) =>
      lineHasMatchTerm(line, language)
    );
    return matchedLanguage || matchedSubject;
  }

  return matchedSubject;
}

function isSubjectBoundary(line, selectedSubjects) {
  if (containsInternalHeading(line)) return false;
  if (!containsSubjectMarker(line)) return false;

  if (isMathBoundary(line)) {
    return true;
  }

  return SUBJECT_BOUNDARY_HINTS.some((subject) => {
    const isSelected = selectedSubjects.some(
      (selectedSubject) =>
        getSubjectMatchTerms(selectedSubject, selectedSubjects).some(
          (term) => term.toLowerCase() === subject.toLowerCase()
        )
    );

    return !isSelected && lineContainsSubject(line, subject, [subject]);
  });
}

function cleanPortionLine(line) {
  return cleanLine(line).replace(/^[\s*)-]+/, "").trim();
}

function shouldSkipPortionLine(line) {
  if (isNoiseLine(line)) return true;
  return /^(topics?|concepts?|grammar|units?|lessons?)\s*:?$/i.test(line);
}

function normalizeSubjectLabel(subject) {
  const lowerSubject = subject.toLowerCase();

  if (
    lowerSubject === "bm" ||
    lowerSubject === "business" ||
    lowerSubject === "business management"
  ) {
    return "BM";
  }

  return subject;
}

function getInlinePortion(line, subject, selectedSubjects) {
  if (isSelectedMathSubject(subject)) {
    const pattern = getSelectedMathPattern(subject);
    if (!pattern || !pattern.test(line)) return "";
    const match = line.match(new RegExp(`${pattern.source}\\s*[:-]\\s*(.+)$`, "i"));
    return match ? cleanPortionLine(match[2]) : "";
  }

  const subjectTerm =
    getSubjectMatchTerms(subject, selectedSubjects)
      .sort((firstTerm, secondTerm) => secondTerm.length - firstTerm.length)
      .find((term) => lineHasMatchTerm(line, term)) || subject;
  const match = line.match(new RegExp(`${escapeRegExp(subjectTerm)}\\s*[:-]\\s*(.+)$`, "i"));
  return match ? cleanPortionLine(match[1]) : "";
}

function parseExtractedText(text, selectedSubjects = []) {
  const subjectsToExtract = normalizeSelectedSubjects(selectedSubjects);
  const lines = text
    .split(/\r?\n/)
    .map(cleanLine)
    .filter((line) => line.length > 0);

  if (lines.length === 0 || subjectsToExtract.length === 0) {
    return [createEmptyDraft()];
  }

  const groups = [];
  let current = null;

  const getGroup = (subject) => {
    const normalizedSubject = normalizeSubjectLabel(subject);
    const existing = groups.find(
      (group) => group.subject.toLowerCase() === normalizedSubject.toLowerCase()
    );
    if (existing) return existing;

    const group = { subject: normalizedSubject, topics: [], topicKeys: new Set() };
    groups.push(group);
    return group;
  };

  const addTopic = (group, topicLine) => {
    const topic = cleanPortionLine(topicLine);
    if (shouldSkipPortionLine(topic)) return;
    if (!topic) return;

    const topicKey = topic.toLowerCase();
    if (group.topicKeys.has(topicKey)) return;

    group.topicKeys.add(topicKey);
    group.topics.push(topic);
  };

  lines.forEach((line) => {
    const matchedSubject = findSelectedSubject(line, subjectsToExtract);

    if (matchedSubject) {
      current = getGroup(matchedSubject);

      const inlinePortion = getInlinePortion(line, matchedSubject, subjectsToExtract);
      if (inlinePortion) {
        addTopic(current, inlinePortion);
      }

      return;
    }

    if (isSubjectBoundary(line, subjectsToExtract)) {
      current = null;
      return;
    }

    if (isNoiseLine(line)) {
      return;
    }

    if (current) {
      addTopic(current, line);
    }
  });

  const drafts = groups
    .filter((group) => group.topics.length > 0)
    .map((group) => ({
      id: createDraftId(),
      subject: group.subject,
      pool: normalizePoolItems(group.topics.slice(0, 80)),
      topics: [],
      currentTopic: createCurrentTopic(),
      rawInput: "",
      mode: "builder",
      examDate: "",
    }))
    .filter((draft) => draft.subject && draft.pool.length > 0);

  return drafts.length > 0 ? drafts : [createEmptyDraft()];
}

function getExtractedDraftCount(drafts) {
  return drafts.filter((draft) => {
    const poolCount = Array.isArray(draft.pool) ? draft.pool.length : 0;
    return draft.subject.trim() && (poolCount > 0 || getTotalSubtopics(draft) > 0);
  }).length;
}

function getAllSubtopics(record) {
  return (record.topics || []).flatMap((topic) => topic.subtopics || []);
}

function getAssignedItemKeys(record) {
  const keys = new Set();

  getAllSubtopics(record).forEach((subtopic) => {
    if (subtopic?.text) keys.add(subtopic.text.toLowerCase());
  });

  (record.currentTopic?.subtopics || []).forEach((item) => {
    if (item) keys.add(String(item).toLowerCase());
  });

  return keys;
}

function getTotalSubtopics(record) {
  return getAllSubtopics(record).length;
}

function getCompletedSubtopics(record) {
  return getAllSubtopics(record).filter((subtopic) => subtopic.done).length;
}

function getProgressStats(record) {
  if (record.mode !== "final") {
    return {
      total: 0,
      completed: 0,
      percent: 0,
    };
  }

  const total = getTotalSubtopics(record);
  const completed = getCompletedSubtopics(record);

  return {
    total,
    completed,
    percent: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}

function formatDate(dateString) {
  if (!dateString) return "No date";
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateString;

  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function getDaysUntil(dateString) {
  if (!dateString) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;

  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
}

function getExamStatus(dateString) {
  const days = getDaysUntil(dateString);
  if (days === null) return "Unscheduled";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days > 1) return `${days} days`;
  if (days === -1) return "Yesterday";
  return `${Math.abs(days)} days ago`;
}

export default function ExamPortions({ selectedSubjects = [] }) {
  const [isReady, setIsReady] = useState(false);
  const [records, setRecords] = useState([]);
  const [drafts, setDrafts] = useState([createEmptyDraft()]);
  const [setupMode, setSetupMode] = useState("setup");
  const [expandedSubject, setExpandedSubject] = useState(null);
  const [pdfSource, setPdfSource] = useState(null);
  const [pdfText, setPdfText] = useState("");
  const [pdfStatus, setPdfStatus] = useState("");
  const [formError, setFormError] = useState("");
  const [isParsingPdf, setIsParsingPdf] = useState(false);
  const [recentlyDeleted, setRecentlyDeleted] = useState(null);
  const fileInputRef = useRef(null);
  const subjectsForParsing = useMemo(
    () => normalizeSelectedSubjects(selectedSubjects),
    [selectedSubjects]
  );

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      setRecords(normalizeRecords(saved));
    } catch (error) {
      console.error("Failed to parse exam portions:", error);
      setRecords([]);
    }

    try {
      const savedSource = JSON.parse(localStorage.getItem(PDF_SOURCE_KEY) || "null");
      setPdfSource(savedSource);
    } catch (error) {
      console.error("Failed to parse exam PDF source:", error);
    }

    setIsReady(true);
  }, []);

  useEffect(() => {
    if (!isReady) return;
    if (records.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [isReady, records]);

  useEffect(() => {
    if (!isReady) return;
    if (pdfSource) {
      localStorage.setItem(PDF_SOURCE_KEY, JSON.stringify(pdfSource));
    } else {
      localStorage.removeItem(PDF_SOURCE_KEY);
    }
  }, [isReady, pdfSource]);

  const sortedTimeline = useMemo(() => {
    return [...records].sort((a, b) => {
      if (!a.examDate && !b.examDate) return a.subject.localeCompare(b.subject);
      if (!a.examDate) return 1;
      if (!b.examDate) return -1;
      return a.examDate.localeCompare(b.examDate);
    });
  }, [records]);

  const nearestUpcomingSubject = useMemo(() => {
    return sortedTimeline.find((record) => {
      const days = getDaysUntil(record.examDate);
      return days !== null && days >= 0;
    })?.subject;
  }, [sortedTimeline]);

  const totalSubtopics = useMemo(() => {
    return records.reduce(
      (total, record) => total + (record.mode === "final" ? getTotalSubtopics(record) : 0),
      0
    );
  }, [records]);

  const beginManualEntry = () => {
    setDrafts(records.length > 0 ? recordsToDrafts(records) : [createEmptyDraft()]);
    setSetupMode("form");
    setFormError("");
  };

  const updateDraft = (id, updates) => {
    setDrafts((currentDrafts) =>
      currentDrafts.map((draft) => (draft.id === id ? { ...draft, ...updates } : draft))
    );
  };

  const addDraft = () => {
    setDrafts((currentDrafts) => [...currentDrafts, createEmptyDraft()]);
  };

  const addPoolItemsToDraft = (draftId, text) => {
    const newItems = parseSubtopicLines(text);
    if (newItems.length === 0) return;

    setDrafts((currentDrafts) =>
      currentDrafts.map((draft) => {
        if (draft.id !== draftId) return draft;
        const assignedKeys = getAssignedItemKeys(draft);
        const filteredItems = newItems.filter((item) => !assignedKeys.has(item.toLowerCase()));

        return {
          ...draft,
          pool: normalizePoolItems([...draft.pool, ...filteredItems]),
          rawInput: "",
          mode: "builder",
        };
      })
    );
  };

  const movePoolItemToCurrentTopic = (draftId, itemIndex) => {
    setDrafts((currentDrafts) =>
      currentDrafts.map((draft) => {
        if (draft.id !== draftId) return draft;

        const item = draft.pool[itemIndex];
        if (!item) return draft;

        const nextCurrentItems = normalizePoolItems([...draft.currentTopic.subtopics, item]);
        return {
          ...draft,
          pool: draft.pool.filter((_, index) => index !== itemIndex),
          currentTopic: {
            ...draft.currentTopic,
            subtopics: nextCurrentItems,
          },
        };
      })
    );
  };

  const removePoolItem = (draftId, itemIndex) => {
    const draft = drafts.find((d) => d.id === draftId);
    if (!draft) return;
    const item = draft.pool[itemIndex];

    if (recentlyDeleted?.timeoutId) {
      clearTimeout(recentlyDeleted.timeoutId);
    }

    const timeoutId = setTimeout(() => {
      setRecentlyDeleted(null);
    }, 5000);

    setRecentlyDeleted({ draftId, item, timeoutId });

    setDrafts((currentDrafts) =>
      currentDrafts.map((d) =>
        d.id === draftId ? { ...d, pool: d.pool.filter((_, idx) => idx !== itemIndex) } : d
      )
    );
  };

  const undoDeletePoolItem = () => {
    if (!recentlyDeleted) return;

    if (recentlyDeleted.timeoutId) {
      clearTimeout(recentlyDeleted.timeoutId);
    }

    setDrafts((currentDrafts) =>
      currentDrafts.map((d) =>
        d.id === recentlyDeleted.draftId
          ? { ...d, pool: normalizePoolItems([...d.pool, recentlyDeleted.item]) }
          : d
      )
    );

    setRecentlyDeleted(null);
  };

  const updateCurrentTopicTitle = (draftId, title) => {
    setDrafts((currentDrafts) =>
      currentDrafts.map((draft) =>
        draft.id === draftId
          ? {
              ...draft,
              currentTopic: {
                ...draft.currentTopic,
                title,
              },
            }
          : draft
      )
    );
  };

  const undoCurrentTopicItem = (draftId, itemIndex) => {
    setDrafts((currentDrafts) =>
      currentDrafts.map((draft) => {
        if (draft.id !== draftId) return draft;

        const item = draft.currentTopic.subtopics[itemIndex];
        if (!item) return draft;

        return {
          ...draft,
          pool: normalizePoolItems([...draft.pool, item]),
          currentTopic: {
            ...draft.currentTopic,
            subtopics: draft.currentTopic.subtopics.filter((_, index) => index !== itemIndex),
          },
        };
      })
    );
  };

  const commitCurrentTopic = (draftId) => {
    setDrafts((currentDrafts) =>
      currentDrafts.map((draft) => {
        if (draft.id !== draftId) return draft;

        const currentItems = normalizePoolItems(draft.currentTopic.subtopics);
        const hasCurrentTopic = draft.currentTopic.title.trim() || currentItems.length > 0;
        const nextTopics = hasCurrentTopic
          ? [
              ...draft.topics,
              createDraftTopic(
                draft.currentTopic.title.trim() || `Topic ${draft.topics.length + 1}`,
                currentItems.map((item) => createDraftSubtopic(item))
              ),
            ]
          : draft.topics;

        return {
          ...draft,
          topics: nextTopics,
          currentTopic: createCurrentTopic(),
          mode: draft.pool.length === 0 ? "final" : "builder",
        };
      })
    );
  };

  const finishBuilder = (draftId) => {
    setDrafts((currentDrafts) =>
      currentDrafts.map((draft) => {
        if (draft.id !== draftId) return draft;

        const currentItems = normalizePoolItems(draft.currentTopic.subtopics);
        const hasCurrentTopic = draft.currentTopic.title.trim() || currentItems.length > 0;
        const nextTopics = hasCurrentTopic
          ? [
              ...draft.topics,
              createDraftTopic(
                draft.currentTopic.title.trim() || `Topic ${draft.topics.length + 1}`,
                currentItems.map((item) => createDraftSubtopic(item))
              ),
            ]
          : draft.topics;

        return {
          ...draft,
          topics: nextTopics,
          currentTopic: createCurrentTopic(),
          mode: "final",
        };
      })
    );
  };

  const reopenBuilder = (draftId) => {
    setDrafts((currentDrafts) =>
      currentDrafts.map((draft) =>
        draft.id === draftId
          ? {
              ...draft,
              mode: "builder",
            }
          : draft
      )
    );
  };

  const removeDraft = (id) => {
    setDrafts((currentDrafts) => {
      if (currentDrafts.length === 1) return [createEmptyDraft()];
      return currentDrafts.filter((draft) => draft.id !== id);
    });
  };

  const saveDrafts = () => {
    const nextRecords = draftsToRecords(drafts);
    if (nextRecords.length === 0) {
      setFormError("Add at least one subject before saving.");
      return;
    }

    setRecords(nextRecords);
    setExpandedSubject(nextRecords[0]?.subject || null);
    setSetupMode("main");
    setFormError("");
  };

  const toggleRecordSubtopic = (recordIndex, topicIndex, subtopicIndex) => {
    setRecords((currentRecords) =>
      currentRecords.map((record, currentRecordIndex) => {
        if (currentRecordIndex !== recordIndex) return record;
        if (record.mode !== "final") return record;

        return {
          ...record,
          topics: record.topics.map((topic, currentTopicIndex) => {
            if (currentTopicIndex !== topicIndex) return topic;

            return {
              ...topic,
              subtopics: topic.subtopics.map((subtopic, currentSubtopicIndex) =>
                currentSubtopicIndex === subtopicIndex
                  ? { ...subtopic, done: !subtopic.done }
                  : subtopic
              ),
            };
          }),
        };
      })
    );
  };

  const clearAll = () => {
    setRecords([]);
    setDrafts([createEmptyDraft()]);
    setPdfText("");
    setPdfSource(null);
    setPdfStatus("");
    setExpandedSubject(null);
    setSetupMode("setup");
    setFormError("");
  };

  const rebuildDraftsFromPdfText = () => {
    const nextDrafts = parseExtractedText(pdfText, subjectsForParsing);
    setDrafts(nextDrafts);
    const matchedDrafts = getExtractedDraftCount(nextDrafts);
    setPdfStatus(
      matchedDrafts > 0
        ? `Rebuilt ${matchedDrafts} selected subject${matchedDrafts !== 1 ? "s" : ""}.`
        : "No selected subjects found in the extracted text."
    );
    setFormError("");
  };

  const handlePdfFile = async (file) => {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setPdfStatus("Choose a PDF file.");
      return;
    }

    setIsParsingPdf(true);
    setPdfStatus("Reading PDF...");
    setFormError("");

    try {
      const pdfjs = await import("pdfjs-dist/build/pdf.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();

      const data = new Uint8Array(await file.arrayBuffer());
      const loadingTask = pdfjs.getDocument({ data });
      const pdf = await loadingTask.promise;
      const pageTexts = [];

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const textContent = await page.getTextContent();
        const lines = [];
        let currentLine = "";

        textContent.items.forEach((item) => {
          const itemText = typeof item.str === "string" ? item.str : "";
          if (itemText) currentLine += `${itemText} `;
          if (item.hasEOL) {
            const cleanCurrentLine = cleanLine(currentLine);
            if (cleanCurrentLine) lines.push(cleanCurrentLine);
            currentLine = "";
          }
        });

        const cleanCurrentLine = cleanLine(currentLine);
        if (cleanCurrentLine) lines.push(cleanCurrentLine);
        pageTexts.push(lines.join("\n"));
      }

      const extracted = pageTexts.join("\n").trim();
      const source = {
        name: file.name,
        size: file.size,
        importedAt: new Date().toISOString(),
      };

      const nextDrafts = parseExtractedText(extracted, subjectsForParsing);
      const matchedDrafts = getExtractedDraftCount(nextDrafts);

      setPdfSource(source);
      setPdfText(extracted);
      setDrafts(nextDrafts);
      setSetupMode("form");
      setPdfStatus(
        matchedDrafts > 0
          ? `PDF extracted for ${matchedDrafts} selected subject${matchedDrafts !== 1 ? "s" : ""}.`
          : "PDF extracted, but none of the selected subjects were found."
      );
    } catch (error) {
      console.error("Failed to read PDF:", error);
      setPdfStatus("Could not read this PDF.");
      setSetupMode("form");
      setDrafts([createEmptyDraft()]);
    } finally {
      setIsParsingPdf(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (!isReady) {
    return (
      <section className="max-w-6xl mx-auto pb-12">
        <div className="card text-center">
          <h2 className="text-2xl font-semibold text-white">Exam Portions</h2>
        </div>
      </section>
    );
  }

  const hasRecords = records.length > 0;
  const showSetup = !hasRecords && setupMode === "setup";
  const showForm = setupMode === "form";

  if (showSetup) {
    return (
      <section className="max-w-4xl mx-auto pb-12">
        <input
          ref={fileInputRef}
          className="hidden"
          type="file"
          accept="application/pdf"
          onChange={(event) => handlePdfFile(event.target.files?.[0])}
        />

        <div className="card p-8 md:p-10">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white">Exam Setup</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isParsingPdf}
              className="min-h-[150px] rounded-2xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.07] hover:border-[#7c6fff]/60 transition-all p-6 text-left disabled:opacity-60 disabled:cursor-wait"
            >
              <span className="block text-xl font-semibold text-white">Upload PDF</span>
              <span className="mt-3 block text-sm text-white/50">
                {isParsingPdf ? "Reading PDF..." : pdfStatus || "PDF portions"}
              </span>
            </button>

            <button
              type="button"
              onClick={beginManualEntry}
              className="min-h-[150px] rounded-2xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.07] hover:border-[#7c6fff]/60 transition-all p-6 text-left"
            >
              <span className="block text-xl font-semibold text-white">Enter Manually</span>
              <span className="mt-3 block text-sm text-white/50">Subjects and dates</span>
            </button>
          </div>

          {pdfStatus && (
            <p className="mt-5 text-center text-sm text-white/50">{pdfStatus}</p>
          )}
        </div>
      </section>
    );
  }

  if (showForm) {
    return (
      <section className="max-w-6xl mx-auto pb-12">
        <input
          ref={fileInputRef}
          className="hidden"
          type="file"
          accept="application/pdf"
          onChange={(event) => handlePdfFile(event.target.files?.[0])}
        />

        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8 border-b border-white/10 pb-6">
          <div>
            <h2 className="text-3xl font-bold text-white">Exam Setup</h2>
            {pdfSource && (
              <p className="text-sm text-white/45 mt-2">Source: {pdfSource.name}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {hasRecords && (
              <button type="button" className="btn" onClick={() => setSetupMode("main")}>
                Cancel
              </button>
            )}
            {!hasRecords && (
              <button type="button" className="btn" onClick={() => setSetupMode("setup")}>
                Back
              </button>
            )}
            <button
              type="button"
              className="btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={isParsingPdf}
            >
              Upload PDF
            </button>
            <button type="button" className="btn" onClick={addDraft}>
              Add Subject
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={saveDrafts}
            >
              Save Portions
            </button>
          </div>
        </div>

        {pdfText && (
          <div className="card mb-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Extracted PDF Text</h3>
                <p className="text-xs text-white/40 mt-1">{pdfStatus}</p>
              </div>
              <button type="button" className="btn" onClick={rebuildDraftsFromPdfText}>
                Rebuild Draft
              </button>
            </div>
            <textarea
              className="input-field min-h-[140px] resize-y leading-6"
              value={pdfText}
              onChange={(event) => setPdfText(event.target.value)}
            />
          </div>
        )}

        {formError && (
          <div className="mb-4 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {formError}
          </div>
        )}

        <div className="space-y-4 max-h-[68vh] overflow-y-auto pr-1 focus-scroll">
          {drafts.map((draft, index) => {
            const isBuilder = draft.mode !== "final";
            const draftProgress = getProgressStats(draft);
            const currentItems = draft.currentTopic?.subtopics || [];
            const canCommitCurrentTopic =
              currentItems.length > 0 || Boolean(draft.currentTopic?.title?.trim());
            const canFinishBuilder = draft.pool.length === 0 && (draft.topics.length > 0 || canCommitCurrentTopic);

            return (
              <div key={draft.id} className="card">
                <div className="flex flex-col lg:flex-row gap-5 mb-5">
                  <div className="lg:w-[32%] space-y-4">
                    <div>
                      <label className="form-label">Subject {index + 1}</label>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="Physics"
                        value={draft.subject}
                        onChange={(event) => updateDraft(draft.id, { subject: event.target.value })}
                      />
                    </div>
                    <div>
                      <label className="form-label">Exam Date</label>
                      <input
                        type="date"
                        className="input-field"
                        value={draft.examDate}
                        onChange={(event) => updateDraft(draft.id, { examDate: event.target.value })}
                      />
                    </div>
                  </div>

                  <div className="flex-1 rounded-xl border border-white/10 bg-black/15 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {isBuilder ? "Topic Builder" : "Final Structure"}
                        </p>
                        <p className="text-xs text-white/40 mt-1">
                          {isBuilder
                            ? `${draft.pool.length} raw item${draft.pool.length !== 1 ? "s" : ""} left`
                            : `${draftProgress.completed}/${draftProgress.total} subtopics complete`}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {isBuilder && canFinishBuilder && (
                          <button type="button" className="btn" onClick={() => finishBuilder(draft.id)}>
                            Finish Builder
                          </button>
                        )}
                        {!isBuilder && (
                          <button type="button" className="btn" onClick={() => reopenBuilder(draft.id)}>
                            Reopen Builder
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn"
                          onClick={() => removeDraft(draft.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    {!isBuilder && (
                      <div className="mt-4">
                        <div className="flex items-center justify-between text-xs text-white/45 mb-2">
                          <span>Progress</span>
                          <span>{draftProgress.percent}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-black/40 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#7c6fff] to-[#a399ff] transition-all duration-300"
                            style={{ width: `${draftProgress.percent}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {isBuilder ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-white/10 bg-black/15 p-4">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div>
                          <h3 className="text-lg font-semibold text-white">Raw Pool</h3>
                          <p className="text-xs text-white/40 mt-1">Select an item to move it into the current topic.</p>
                        </div>
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/55">
                          {draft.pool.length}
                        </span>
                      </div>

                      <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1 focus-scroll">
                        {draft.pool.length > 0 ? (
                          draft.pool.map((item, itemIndex) => (
                            <div
                              key={`${item}-${itemIndex}`}
                              className="group relative flex items-start gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-1 pr-2 transition-all duration-200 hover:bg-white/[0.08] hover:border-[#7c6fff]/40 hover:brightness-110"
                            >
                              <button
                                type="button"
                                className="flex-1 text-left px-2 py-1 text-sm text-white/75 cursor-pointer active:opacity-0 active:scale-[0.98] transition-all"
                                onClick={() => movePoolItemToCurrentTopic(draft.id, itemIndex)}
                              >
                                <span className="leading-6">{item}</span>
                              </button>
                              <button
                                type="button"
                                className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity rounded-md hover:bg-red-500/20 hover:text-red-300 text-white/40 px-2 py-0.5 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removePoolItem(draft.id, itemIndex);
                                }}
                                title="Remove item"
                              >
                                🗑
                              </button>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-lg border border-dashed border-white/10 bg-black/10 px-3 py-4 text-sm text-white/35 text-center">
                            All items assigned or removed
                          </div>
                        )}
                      </div>

                      <div className="mt-4 space-y-2">
                        <label className="form-label">Add Raw Items</label>
                        <textarea
                          className="input-field min-h-[100px] resize-y text-sm leading-6"
                          placeholder={"Paste unassigned items, one per line"}
                          value={draft.rawInput}
                          onChange={(event) => updateDraft(draft.id, { rawInput: event.target.value })}
                          onPaste={(event) => {
                            const pastedText = event.clipboardData.getData("text");
                            if (!pastedText.trim()) return;
                            event.preventDefault();
                            addPoolItemsToDraft(draft.id, pastedText);
                          }}
                        />
                        <button
                          type="button"
                          className="btn"
                          onClick={() => addPoolItemsToDraft(draft.id, draft.rawInput)}
                        >
                          Add to Pool
                        </button>
                      </div>
                    </div>

                    <div className="rounded-xl border border-[#7c6fff]/25 bg-[#7c6fff]/10 p-4">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div>
                          <h3 className="text-lg font-semibold text-white">Current Topic</h3>
                          <p className="text-xs text-white/40 mt-1">Undo sends an item back to the raw pool.</p>
                        </div>
                        <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/55">
                          {currentItems.length}
                        </span>
                      </div>

                      <input
                        type="text"
                        className="input-field mb-3"
                        placeholder={`Topic ${draft.topics.length + 1}`}
                        value={draft.currentTopic.title}
                        onChange={(event) => updateCurrentTopicTitle(draft.id, event.target.value)}
                      />

                      <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1 focus-scroll">
                        {currentItems.length > 0 ? (
                          currentItems.map((item, itemIndex) => (
                            <div
                              key={`${item}-${itemIndex}`}
                              className="flex items-start gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/75 transition-all duration-200"
                            >
                              <span className="flex-1 leading-6">{item}</span>
                              <button
                                type="button"
                                className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-white/45 transition-colors hover:bg-white/[0.1] hover:text-white"
                                onClick={() => undoCurrentTopicItem(draft.id, itemIndex)}
                                title="Undo item"
                              >
                                ↺
                              </button>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-lg border border-dashed border-white/10 bg-black/10 px-3 py-4 text-sm text-white/35">
                            Select raw items to build this topic.
                          </div>
                        )}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn"
                          disabled={draft.pool.length === 0 ? !canFinishBuilder : !canCommitCurrentTopic}
                          onClick={() => {
                            if (draft.pool.length === 0) {
                              finishBuilder(draft.id);
                              return;
                            }
                            commitCurrentTopic(draft.id);
                          }}
                        >
                          {draft.pool.length === 0 ? "Finish Builder" : "Next Topic"}
                        </button>
                      </div>

                      {draft.topics.length > 0 && (
                        <div className="mt-5 border-t border-white/10 pt-4">
                          <h4 className="text-sm font-semibold text-white mb-2">Built Topics</h4>
                          <div className="space-y-2">
                            {draft.topics.map((topic, topicIndex) => (
                              <div
                                key={topic.id}
                                className="rounded-lg border border-white/10 bg-black/15 px-3 py-2"
                              >
                                <p className="text-sm font-medium text-white">
                                  {topic.title || `Topic ${topicIndex + 1}`}
                                </p>
                                <p className="text-xs text-white/40 mt-1">
                                  {topic.subtopics.length} item{topic.subtopics.length !== 1 ? "s" : ""}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {draft.topics.length > 0 ? (
                      draft.topics.map((topic, topicIndex) => (
                        <div
                          key={topic.id}
                          className="ml-0 md:ml-3 rounded-xl border border-white/10 bg-black/15 p-4"
                        >
                          <h3 className="text-base font-semibold text-white">
                            {topic.title || `Topic ${topicIndex + 1}`}
                          </h3>
                          <div className="mt-3 space-y-2">
                            {topic.subtopics.map((subtopic, subtopicIndex) => (
                              <div
                                key={`${subtopic.text}-${subtopicIndex}`}
                                className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/70"
                              >
                                {subtopic.text}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-xl border border-dashed border-white/10 bg-black/10 p-5 text-sm text-white/35">
                        No final topics yet.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {recentlyDeleted && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl bg-[#111] border border-white/10 px-5 py-3 shadow-2xl animate-fade-in">
            <span className="text-sm text-white">Item removed</span>
            <div className="h-4 w-[1px] bg-white/20" />
            <button
              type="button"
              onClick={undoDeletePoolItem}
              className="text-sm font-semibold text-[#7c6fff] hover:text-[#a399ff] transition-colors"
            >
              Undo
            </button>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="max-w-[1400px] mx-auto pb-12">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8 border-b border-white/10 pb-6">
        <div>
          <h2 className="text-3xl font-bold text-white">Exam Portions</h2>
          <p className="text-sm text-white/45 mt-2">
            {records.length} subject{records.length !== 1 ? "s" : ""} - {totalSubtopics} subtopic{totalSubtopics !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn" onClick={beginManualEntry}>
            Edit
          </button>
          <button type="button" className="btn" onClick={clearAll}>
            Clear
          </button>
        </div>
      </div>

      {pdfSource && (
        <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm text-white/55">
          Source PDF: <span className="text-white/80">{pdfSource.name}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6">
        <div className="space-y-4 max-h-[72vh] overflow-y-auto pr-1 focus-scroll">
          {records.map((record, index) => {
            const isExpanded = expandedSubject === record.subject;
            const visibleTopics = isExpanded ? record.topics : record.topics.slice(0, 2);
            const isFinal = record.mode === "final";
            const progress = getProgressStats(record);

            return (
              <div
                key={`${record.subject}-${index}`}
                className={`w-full text-left rounded-2xl border p-5 transition-all ${
                  isExpanded
                    ? "bg-white/[0.07] border-[#7c6fff]/45 shadow-lg shadow-[#7c6fff]/10"
                    : "bg-white/[0.04] border-white/10 hover:border-white/20"
                }`}
              >
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => setExpandedSubject(isExpanded ? null : record.subject)}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-xl font-semibold text-white break-words">{record.subject}</h3>
                      <p className="text-sm text-white/45 mt-1">{formatDate(record.examDate)} - {getExamStatus(record.examDate)}</p>
                    </div>
                    <div className="shrink-0 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-semibold text-white/60">
                      {isFinal ? `${progress.completed}/${progress.total} complete` : "Builder"}
                    </div>
                  </div>
                </button>

                {isFinal ? (
                  <div className="mt-5">
                    <div className="flex items-center justify-between text-xs text-white/45 mb-2">
                      <span>Progress</span>
                      <span>{progress.percent}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-black/40 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#7c6fff] to-[#a399ff] transition-all duration-300"
                        style={{ width: `${progress.percent}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 rounded-xl border border-[#7c6fff]/25 bg-[#7c6fff]/10 px-4 py-3 text-sm text-white/65">
                    Topic builder in progress. {record.pool.length} raw item{record.pool.length !== 1 ? "s" : ""} remain.
                  </div>
                )}

                <div
                  className={`mt-5 space-y-3 transition-all duration-300 ${
                    isExpanded ? "max-h-[520px] overflow-y-auto pr-2 focus-scroll" : "max-h-[190px] overflow-hidden"
                  }`}
                >
                  {visibleTopics.length > 0 ? (
                    visibleTopics.map((topic, topicIndex) => (
                      <div
                        key={`${topic.title}-${topicIndex}`}
                        className="ml-0 md:ml-3 rounded-xl border border-white/10 bg-black/15 px-4 py-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h4 className="text-base font-semibold text-white break-words">
                              {topic.title || `Topic ${topicIndex + 1}`}
                            </h4>
                            <p className="text-xs text-white/40 mt-1">
                              {topic.subtopics.length} subtopic{topic.subtopics.length !== 1 ? "s" : ""}
                            </p>
                          </div>
                        </div>

                        <div
                          className={`grid transition-all duration-300 ${
                            isExpanded ? "grid-rows-[1fr] opacity-100 mt-3" : "grid-rows-[0fr] opacity-0"
                          }`}
                        >
                          <div className="overflow-hidden space-y-2">
                            {isFinal && topic.subtopics.length > 0 ? (
                              topic.subtopics.map((subtopic, subtopicIndex) => (
                                <label
                                  key={`${subtopic.text}-${subtopicIndex}`}
                                  className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/75"
                                >
                                  <input
                                    type="checkbox"
                                    className="mt-1 h-4 w-4 accent-[#7c6fff]"
                                    checked={subtopic.done}
                                    onChange={() => toggleRecordSubtopic(index, topicIndex, subtopicIndex)}
                                  />
                                  <span className={`leading-6 ${subtopic.done ? "line-through text-white/35" : ""}`}>
                                    {subtopic.text}
                                  </span>
                                </label>
                              ))
                            ) : (
                              <div className="rounded-lg border border-dashed border-white/10 bg-black/10 px-3 py-3 text-sm text-white/35">
                                {isFinal ? "No subtopics added." : "Finish the builder to track progress."}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-white/10 bg-black/10 px-4 py-3 text-sm text-white/35">
                      No topics added.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <aside className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 h-fit lg:sticky lg:top-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-xl font-semibold text-white">Exam Timeline</h3>
            <span className="text-xs text-white/40">{sortedTimeline.length} exams</span>
          </div>

          <div className="space-y-3 max-h-[64vh] overflow-y-auto pr-1 focus-scroll">
            {sortedTimeline.map((record, index) => {
              const isNearest = record.subject === nearestUpcomingSubject;

              return (
                <button
                  key={`${record.subject}-${record.examDate}-${index}`}
                  type="button"
                  onClick={() => setExpandedSubject(record.subject)}
                  className={`w-full text-left rounded-xl border px-4 py-3 transition-all ${
                    isNearest
                      ? "bg-[#7c6fff]/20 border-[#a399ff]/50 shadow-lg shadow-[#7c6fff]/10"
                      : "bg-black/15 border-white/10 hover:bg-white/[0.06]"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-1 h-2.5 w-2.5 rounded-full ${isNearest ? "bg-[#a399ff]" : "bg-white/25"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white break-words">{record.subject}</p>
                      <p className="text-xs text-white/50 mt-1">{formatDate(record.examDate)}</p>
                    </div>
                    <span className="shrink-0 text-[11px] font-semibold text-white/55">
                      {getExamStatus(record.examDate)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>
      </div>
    </section>
  );
}
