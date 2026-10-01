const DEFAULT_DAILY_CAPACITY = 360;
const MIN_DAILY_CAPACITY = 180;
const MAX_DAILY_CAPACITY = 600;

const NUMBER_WORDS = new Set([
  'zero','one','two','three','four','five','six','seven','eight','nine','ten',
  'eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen','twenty',
  'first','second','third','fourth','fifth','sixth','seventh','eighth','ninth','tenth',
]);

const FILLER_WORDS = new Set([
  'a','an','the','my','for','of','to','and','or','in','on','at','with','from',
  'do','finish','complete','start','continue','work','study','watch','make','prepare','prep',
  'part','session','task','new','next','today','tomorrow',
]);

const TOKEN_ALIASES = {
  pharma: 'pharmacology',
  pharm: 'pharmacology',
  pharmacological: 'pharmacology',
  lec: 'lecture',
  lectures: 'lecture',
  lect: 'lecture',
  assignments: 'assignment',
  assgn: 'assignment',
  revision: 'review',
  revise: 'review',
  reviewing: 'review',
  reviews: 'review',
  readings: 'reading',
  read: 'reading',
  editing: 'edit',
  edited: 'edit',
  edits: 'edit',
  videos: 'video',
  reels: 'reel',
  chapters: 'chapter',
  quizzes: 'quiz',
  exams: 'exam',
  labs: 'lab',
  classes: 'class',
  meetings: 'meeting',
  calls: 'call',
  shoots: 'shoot',
  filming: 'film',
  filmed: 'film',
  workouts: 'workout',
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round5 = value => Math.max(5, Math.round(Number(value || 0) / 5) * 5);

export function normalizeTaskWords(value = '') {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ')
    .split(/\s+/)
    .map(token => token.trim())
    .filter(Boolean)
    .filter(token => !/^\d+(?:st|nd|rd|th)?$/.test(token))
    .filter(token => !NUMBER_WORDS.has(token))
    .map(token => TOKEN_ALIASES[token] || token)
    .filter(token => !FILLER_WORDS.has(token));
}

export function getTaskPatternKey(name = '') {
  const tokens = normalizeTaskWords(name);
  if (!tokens.length) return '';
  return [...new Set(tokens)].sort().join('|');
}

export function getTaskPatternLabel(name = '') {
  const tokens = normalizeTaskWords(name);
  return [...new Set(tokens)].join(' ');
}

function validSamples(samples = []) {
  return (Array.isArray(samples) ? samples : [])
    .filter(sample => Number(sample?.actualMinutes) > 0)
    .sort((a, b) => String(a?.loggedAt || '').localeCompare(String(b?.loggedAt || '')));
}

function estimateFromSamples(samples = []) {
  const recent = validSamples(samples).slice(-12);
  if (!recent.length) return null;

  const values = recent.map(sample => Number(sample.actualMinutes)).sort((a, b) => a - b);
  const median = values[Math.floor(values.length / 2)];
  const low = Math.max(1, median * 0.45);
  const high = Math.max(low, median * 2.2);
  const weighted = recent.reduce((sum, sample, index) => {
    const bounded = clamp(Number(sample.actualMinutes), low, high);
    return sum + bounded * (index + 1);
  }, 0);
  const weight = recent.reduce((sum, _, index) => sum + index + 1, 0);
  return round5(weight ? weighted / weight : median);
}

function confidenceFor(sampleCount) {
  if (sampleCount >= 5) return 'high';
  if (sampleCount >= 2) return 'medium';
  return sampleCount ? 'early' : 'none';
}

function patternSamples(domain, patternKey) {
  return validSamples(domain?.taskIntelligence?.patterns?.[patternKey]?.samples || []);
}

function legacyPatternSamples(domain, patternKey) {
  if (!patternKey) return [];
  const deduped = new Map();
  for (const [legacyKey, profile] of Object.entries(domain?.timingProfiles || {})) {
    if (getTaskPatternKey(legacyKey) !== patternKey) continue;
    for (const sample of validSamples(profile?.samples || [])) {
      const id = sample.taskId || `${legacyKey}:${sample.loggedAt || ''}:${sample.actualMinutes}`;
      deduped.set(id, sample);
    }
  }
  return [...deduped.values()].sort((a, b) => String(a?.loggedAt || '').localeCompare(String(b?.loggedAt || '')));
}

export function getTaskPrediction(domain, name) {
  const patternKey = getTaskPatternKey(name);
  if (!patternKey) return null;

  let samples = patternSamples(domain, patternKey);
  let source = 'pattern';
  if (!samples.length) {
    samples = legacyPatternSamples(domain, patternKey);
    source = 'legacy-pattern';
  }
  if (!samples.length) return null;

  const minutes = estimateFromSamples(samples);
  if (!minutes) return null;
  return {
    minutes,
    samples: samples.length,
    confidence: confidenceFor(samples.length),
    patternKey,
    patternLabel: domain?.taskIntelligence?.patterns?.[patternKey]?.label || getTaskPatternLabel(name),
    source,
  };
}

function ensureIntelligence(domain) {
  domain.taskIntelligence ||= { version: 1, patterns: {} };
  domain.taskIntelligence.version = 1;
  domain.taskIntelligence.patterns ||= {};
  return domain.taskIntelligence;
}

export function recordTaskLearning(domain, task, actualMinutes, loggedAt) {
  if (!domain || !task || !(Number(actualMinutes) > 0)) return null;
  const patternKey = getTaskPatternKey(task.name);
  if (!patternKey) return null;
  const intelligence = ensureIntelligence(domain);
  const pattern = intelligence.patterns[patternKey] || {
    label: getTaskPatternLabel(task.name),
    samples: [],
  };
  const samples = validSamples(pattern.samples).filter(sample => sample.taskId !== task.id);
  samples.push({
    taskId: task.id,
    taskName: task.name,
    actualMinutes: Math.max(1, Math.round(Number(actualMinutes))),
    estimatedMinutes: Number(task.estimatedMinutes) || null,
    loggedAt: loggedAt || task.doneAt || new Date().toISOString(),
  });
  pattern.label = getTaskPatternLabel(task.name) || pattern.label;
  pattern.samples = samples.slice(-30);
  intelligence.patterns[patternKey] = pattern;
  task.intelligencePatternKey = patternKey;
  return getTaskPrediction(domain, task.name);
}

export function removeTaskLearning(domain, task) {
  if (!domain || !task) return;
  const key = task.intelligencePatternKey || getTaskPatternKey(task.name);
  const pattern = domain?.taskIntelligence?.patterns?.[key];
  if (!pattern?.samples) return;
  pattern.samples = pattern.samples.filter(sample => sample.taskId !== task.id);
  if (!pattern.samples.length) delete domain.taskIntelligence.patterns[key];
}

export function moveTaskLearning(domain, task, oldName, newName) {
  if (!domain || !task || !(Number(task.actualMinutes) > 0)) return;
  const oldKey = task.intelligencePatternKey || getTaskPatternKey(oldName);
  const oldPattern = domain?.taskIntelligence?.patterns?.[oldKey];
  if (oldPattern?.samples) {
    oldPattern.samples = oldPattern.samples.filter(sample => sample.taskId !== task.id);
    if (!oldPattern.samples.length) delete domain.taskIntelligence.patterns[oldKey];
  }
  const copy = { ...task, name: newName, intelligencePatternKey: null };
  recordTaskLearning(domain, copy, task.actualMinutes, task.doneAt);
  task.intelligencePatternKey = copy.intelligencePatternKey;
}

function toDateKey(value, resetHour = 0) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (date.getHours() < Number(resetHour || 0)) date.setDate(date.getDate() - 1);
  const pad = number => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function percentile(values, ratio) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * ratio;
  const low = Math.floor(index), high = Math.ceil(index);
  if (low === high) return sorted[low];
  return sorted[low] + (sorted[high] - sorted[low]) * (index - low);
}

export function getLearnedDailyCapacity(domains = [], resetHour = 0) {
  const totals = new Map();
  for (const domain of domains || []) {
    for (const task of domain?.tasks || []) {
      if (!task?.doneAt || !(Number(task?.actualMinutes) > 0)) continue;
      const day = toDateKey(task.doneAt, resetHour);
      if (!day) continue;
      const minutes = clamp(Number(task.actualMinutes), 1, 720);
      totals.set(day, (totals.get(day) || 0) + minutes);
    }
  }
  const dailyTotals = [...totals.values()].filter(value => value > 0).slice(-60);
  if (dailyTotals.length < 3) {
    return {
      minutes: DEFAULT_DAILY_CAPACITY,
      sampleDays: dailyTotals.length,
      learned: false,
      typicalMinutes: dailyTotals.length ? round5(percentile(dailyTotals, 0.75)) : null,
    };
  }
  const typical = clamp((percentile(dailyTotals, 0.75) || DEFAULT_DAILY_CAPACITY) * 1.12, MIN_DAILY_CAPACITY, MAX_DAILY_CAPACITY);
  const learningWeight = Math.min(0.78, dailyTotals.length / 14 * 0.78);
  const blended = DEFAULT_DAILY_CAPACITY * (1 - learningWeight) + typical * learningWeight;
  return {
    minutes: round5(clamp(blended, MIN_DAILY_CAPACITY, MAX_DAILY_CAPACITY)),
    sampleDays: dailyTotals.length,
    learned: true,
    typicalMinutes: round5(typical),
  };
}

export function getTaskPlanningMinutes(domain, task) {
  const explicit = Number(task?.estimatedMinutes);
  if (explicit > 0) return Math.round(explicit);
  return getTaskPrediction(domain, task?.name)?.minutes || 30;
}

export function getDayLoad(domains = [], dateKey, resetHour = 0, options = {}) {
  const excludeDomainId = options.excludeDomainId || null;
  const excludeTaskId = options.excludeTaskId || null;
  const candidateMinutes = Math.max(0, Number(options.candidateMinutes) || 0);
  let minutes = 0;
  let taskCount = 0;
  for (const domain of domains || []) {
    for (const task of domain?.tasks || []) {
      if (task?.done || task?.day !== dateKey) continue;
      if (excludeDomainId === domain.id && excludeTaskId === task.id) continue;
      minutes += getTaskPlanningMinutes(domain, task);
      taskCount += 1;
    }
  }
  minutes += candidateMinutes;
  if (candidateMinutes > 0) taskCount += 1;
  const capacity = getLearnedDailyCapacity(domains, resetHour);
  const ratio = capacity.minutes ? minutes / capacity.minutes : 0;
  const level = ratio > 1.25 ? 'impossible' : ratio > 1 ? 'overloaded' : ratio > 0.82 ? 'full' : 'comfortable';
  return {
    dateKey,
    minutes: Math.round(minutes),
    taskCount,
    capacityMinutes: capacity.minutes,
    capacity,
    ratio,
    level,
    overByMinutes: Math.max(0, Math.round(minutes - capacity.minutes)),
  };
}

export function buildScheduleIntelligence(domains = [], weekDates = [], todayStr, resetHour = 0) {
  const capacity = getLearnedDailyCapacity(domains, resetHour);
  const days = (weekDates || []).map(date => getDayLoad(domains, date, resetHour));
  const today = days.find(day => day.dateKey === todayStr) || getDayLoad(domains, todayStr, resetHour);
  const remainingDays = days.filter(day => !todayStr || day.dateKey >= todayStr);
  const totalMinutes = remainingDays.reduce((sum, day) => sum + day.minutes, 0);
  const totalCapacity = capacity.minutes * remainingDays.length;
  const overloadedDays = remainingDays.filter(day => day.level === 'overloaded' || day.level === 'impossible');
  const learnedPatterns = (domains || []).reduce((sum, domain) => sum + Object.keys(domain?.taskIntelligence?.patterns || {}).length, 0);
  const timedSamples = (domains || []).reduce((sum, domain) => sum + Object.values(domain?.taskIntelligence?.patterns || {}).reduce((inner, pattern) => inner + validSamples(pattern?.samples).length, 0), 0);
  return {
    capacity,
    today,
    days,
    remainingDays,
    totalMinutes,
    totalCapacity,
    overloadedDays,
    learnedPatterns,
    timedSamples,
  };
}
