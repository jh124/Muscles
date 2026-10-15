// Muscles · manual training log · no third-party dependencies
const KEY = 'muscles-v1';
const DRAFT_KEY = 'muscles-v1-draft';
const CATEGORY = ['Strength', 'Boxing', 'Cardio', 'Mixed', 'Other'];
const KINDS = ['strength', 'rounds', 'cardio', 'timed'];
const SUGGESTIONS = ['Chin-ups', 'Pull-ups', 'Push-ups', 'Decline push-ups', 'Squats', 'Dumbbell squats', 'Dumbbell rows', 'Dumbbell curls', 'Dumbbell Romanian deadlifts', 'Lateral raises', 'Bench press', 'Overhead press', 'Deadlift', 'Barbell squat', 'Plank', 'Rice bucket', 'Jump rope', 'Shadowboxing', 'Heavy bag', 'Mitt work', 'Sparring', 'Reflex ball', 'Speed ladder', 'Roadwork', 'Jogging', 'Sprints', 'HIIT intervals', 'Cycling'];
const $ = id => document.getElementById(id);
const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const makeId = () => (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
const escapeHTML = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = n => Number.isFinite(+n) ? +n : 0;
const round = (n, digits = 1) => Number(num(n).toFixed(digits));
const format = (n, digits = 1) => Number(num(n).toFixed(digits)).toLocaleString(undefined, {maximumFractionDigits:digits});
const dateLabel = d => { const t = new Date(d + 'T12:00:00'); return Number.isNaN(t.valueOf()) ? d : t.toLocaleDateString(undefined, {month:'short',day:'numeric',year:'numeric'}); };
const validDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s + 'T12:00:00').valueOf()) && new Date(s + 'T12:00:00').getFullYear() === Number(s.slice(0, 4)) && new Date(s + 'T12:00:00').getMonth() + 1 === Number(s.slice(5, 7)) && new Date(s + 'T12:00:00').getDate() === Number(s.slice(8, 10));
const weightFactor = 2.2046226218;
const kmFactor = 1.609344;
const toDisplay = (field, n) => field === 'weight' && state.preferences.unit === 'kg' ? num(n) / weightFactor : field === 'distance' && state.preferences.unit === 'kg' ? num(n) * kmFactor : n;
const toStore = (field, n) => field === 'weight' && state.preferences.unit === 'kg' ? n * weightFactor : field === 'distance' && state.preferences.unit === 'kg' ? n / kmFactor : n;
const unit = field => field === 'weight' ? state.preferences.unit : field === 'distance' ? (state.preferences.unit === 'kg' ? 'km' : 'mi') : '';
const rowFields = kind => kind === 'strength' ? [{key:'reps',label:'Reps'}, {key:'weight',label:'Weight (' + unit('weight') + ')'}] : kind === 'rounds' ? [{key:'rounds',label:'Rounds'}, {key:'minutes',label:'Min / round'}] : kind === 'cardio' ? [{key:'minutes',label:'Minutes'}, {key:'distance',label:'Distance (' + unit('distance') + ')'}] : [{key:'minutes',label:'Minutes'}, {key:'effort',label:'Effort / 10'}];
const emptySet = kind => kind === 'strength' ? {reps:null,weight:null} : kind === 'rounds' ? {rounds:null,minutes:null} : kind === 'cardio' ? {minutes:null,distance:null} : {minutes:null,effort:null};
const emptyExercise = kind => ({id:makeId(),name:'',kind,sets:[emptySet(kind)]});
const blank = () => ({date:today(),category:'Strength',title:'',duration:null,notes:'',exercises:[]});

function validateSession(s) {
  if (!s || typeof s !== 'object' || !validDate(s.date) || !CATEGORY.includes(s.category) || !Array.isArray(s.exercises) || !s.exercises.length || s.exercises.length > 200) throw Error('Invalid workout format.');
  if (typeof s.title !== 'string' || s.title.length > 100 || typeof s.notes !== 'string' || s.notes.length > 3000) throw Error('Invalid workout name or notes.');
  if (s.duration != null && (!Number.isFinite(s.duration) || s.duration < 0 || s.duration > 1440)) throw Error('Invalid workout duration.');
  for (const ex of s.exercises) {
    if (!ex || typeof ex.name !== 'string' || !ex.name.trim() || ex.name.length > 100 || !KINDS.includes(ex.kind) || !Array.isArray(ex.sets) || !ex.sets.length || ex.sets.length > 200) throw Error('Each exercise needs a name and at least one set.');
    for (const set of ex.sets) {
      if (!set || typeof set !== 'object') throw Error('Invalid exercise set.');
      for (const key of (ex.kind === 'strength' ? ['reps','weight'] : ex.kind === 'rounds' ? ['rounds','minutes'] : ex.kind === 'cardio' ? ['minutes','distance'] : ['minutes','effort'])) {
        const v = set[key];
        if (v != null && (!Number.isFinite(v) || v < 0 || v > 100000)) throw Error('Invalid exercise numbers.');
      }
      if (ex.kind === 'strength' && (!Number.isFinite(set.reps) || set.reps <= 0 || set.reps > 1000 || num(set.weight) > 2000)) throw Error('Enter reps greater than zero for every strength set.');
      if (ex.kind === 'rounds' && (num(set.rounds) <= 0 || num(set.minutes) <= 0 || set.rounds > 1000)) throw Error('Enter rounds and minutes per round.');
      if (ex.kind === 'cardio' && (num(set.minutes) <= 0 && num(set.distance) <= 0)) throw Error('Enter cardio time or distance.');
      if (ex.kind === 'timed' && num(set.minutes) <= 0) throw Error('Enter a positive duration.');
      if (set.effort != null && set.effort > 10) throw Error('Effort must be between 0 and 10.');
    }
  }
  return s;
}
function sanitizeSession(raw) {
  const s = {id:typeof raw.id === 'string' && raw.id.length < 150 && raw.id ? raw.id : makeId(), date:raw.date, category:raw.category, title:raw.title, notes:raw.notes, duration:raw.duration == null ? null : raw.duration, createdAt:typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(), updatedAt:typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(), exercises:[]};
  if (!Array.isArray(raw.exercises)) throw Error('Backup contains a workout without exercises.');
  for (const x of raw.exercises) {
    if (!x || !Array.isArray(x.sets)) throw Error('Backup contains an invalid exercise.');
    const ex = {id:typeof x.id === 'string' ? x.id : makeId(),name:x.name,kind:x.kind,sets:[]};
    for (const original of x.sets) {
      if (!original || typeof original !== 'object') throw Error('Backup contains invalid sets.');
      const set = {};
      for (const field of ['reps','weight','rounds','minutes','distance','effort']) if (Object.prototype.hasOwnProperty.call(original,field)) set[field] = original[field];
      ex.sets.push(set);
    }
    s.exercises.push(ex);
  }
  return validateSession(s);
}
function load() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.sessions)) {
      const seen = new Set(), sessions = [];
      for (const raw of parsed.sessions) {
        try { const s = sanitizeSession(raw); if (!seen.has(s.id)) { sessions.push(s); seen.add(s.id); } } catch (err) { console.warn('Skipped invalid saved workout', err); }
      }
      return {version:1,sessions,preferences:{theme:parsed.preferences?.theme === 'dark' ? 'dark' : 'light',unit:parsed.preferences?.unit === 'kg' ? 'kg' : 'lb'}};
    }
  } catch (err) { console.warn('Could not read saved data', err); }
  return {version:1,sessions:[],preferences:{theme:'light',unit:'lb'}};
}
let state = load();
let editingId = '';
let menuId = '';
let currentPage = 'log';
let toastTimer;
let pendingConfirm = null;

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch { toast('Storage is full or unavailable. Export a backup.'); }
}
function toast(message) {
  const node = $('toast');
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('show'), 3500);
}
function setPage(page) {
  currentPage = page;
  document.querySelectorAll('.page').forEach(el => el.hidden = el.id !== page + '-page');
  document.querySelectorAll('.bottom-nav button').forEach((btn, i) => {
    const active = btn.dataset.page === page;
    btn.classList.toggle('active', active);
    if (active) btn.setAttribute('aria-current', 'page'); else btn.removeAttribute('aria-current');
    if (active) $('nav-pill').style.transform = 'translateX(' + (i * 100) + '%)';
  });
  if (page === 'history') renderHistory();
  if (page === 'progress') renderProgress();
  if (page === 'log') renderLast();
  window.scrollTo({top:0,behavior:'instant'});
}
function readNum(value) { return value === '' ? null : Number(value); }
function createSetRow(kind, set, index) {
  const fields = rowFields(kind);
  const row = document.createElement('div');
  row.className = 'set-row';
  row.innerHTML = '<span class="set-index">' + (index + 1) + '</span>' + fields.map(f => '<input aria-label="' + escapeHTML(f.label) + ' set ' + (index + 1) + '" type="number" inputmode="decimal" min="0" step="any" data-number="' + f.key + '" placeholder="0">').join('') + '<button type="button" class="icon-button set-delete" aria-label="Remove set" title="Remove set" data-action="remove-set">×</button>';
  row.querySelectorAll('[data-number]').forEach(input => {
    const field = input.dataset.number;
    const value = set[field];
    input.value = value == null ? '' : format(toDisplay(field, value), field === 'weight' || field === 'distance' ? 2 : 2).replace(/,/g,'');
  });
  return row;
}
function renderSets(block, sets) {
  const kind = block.querySelector('[data-ex-kind]').value;
  const list = block.querySelector('.set-list');
  const fields = rowFields(kind);
  list.innerHTML = '<div class="set-head"><span>Set</span><span>' + escapeHTML(fields[0].label) + '</span><span>' + escapeHTML(fields[1].label) + '</span><span></span></div>';
  (sets.length ? sets : [emptySet(kind)]).forEach((set,i) => list.append(createSetRow(kind, set, i)));
}
function createExerciseBlock(ex, index) {
  const block = document.createElement('div');
  block.className = 'exercise-block';
  block.dataset.exerciseId = ex.id || makeId();
  block.innerHTML = '<div class="exercise-block-head"><span class="exercise-number">Exercise ' + (index + 1) + '</span><button type="button" class="icon-button" aria-label="Remove exercise" title="Remove exercise" data-action="remove-exercise">×</button></div><label>Exercise name<input data-ex-name class="name-input" list="exercise-suggestions" maxlength="100" placeholder="e.g. Chin-ups" required></label><div class="form-grid"><label>Tracking type<select data-ex-kind><option value="strength">Sets & reps</option><option value="rounds">Rounds</option><option value="cardio">Time & distance</option><option value="timed">Time</option></select></label><div><span class="muted">Measurement</span><p class="exercise-caption" data-kind-hint>Manual sets</p></div></div><div class="set-list"></div><button type="button" class="add-set" data-action="add-set">＋ Add set</button>';
  block.querySelector('[data-ex-name]').value = ex.name || '';
  block.querySelector('[data-ex-kind]').value = KINDS.includes(ex.kind) ? ex.kind : 'strength';
  renderSets(block, ex.sets || []);
  updateKindHint(block);
  return block;
}
function updateKindHint(block) {
  const kind = block.querySelector('[data-ex-kind]').value;
  block.querySelector('[data-kind-hint]').textContent = kind === 'strength' ? '0 weight = bodyweight' : kind === 'rounds' ? 'Number × min per round' : kind === 'cardio' ? 'Time and/or distance' : 'Minutes and optional effort';
}
function renderExercises(exercises) {
  const list = $('exercise-list');
  list.replaceChildren();
  exercises.forEach((ex,i) => list.append(createExerciseBlock(ex,i)));
  $('exercise-help').hidden = exercises.length > 0;
}
function collectForm() {
  const exercises = Array.from(document.querySelectorAll('.exercise-block')).map(block => {
    const kind = block.querySelector('[data-ex-kind]').value;
    const sets = Array.from(block.querySelectorAll('.set-row')).map(row => {
      const set = {};
      row.querySelectorAll('[data-number]').forEach(input => {
        const v = readNum(input.value);
        set[input.dataset.number] = v == null ? null : round(toStore(input.dataset.number,v), 6);
      });
      return set;
    });
    return {id:block.dataset.exerciseId,name:block.querySelector('[data-ex-name]').value.trim(),kind,sets};
  });
  return {date:$('workout-date').value,category:$('workout-category').value,title:$('workout-title').value.trim(),duration:readNum($('workout-duration').value),notes:$('workout-notes').value,exercises};
}
function setForm(form) {
  $('workout-date').value = form.date || today();
  $('workout-category').value = form.category || 'Strength';
  $('workout-title').value = form.title || '';
  $('workout-duration').value = form.duration == null ? '' : form.duration;
  $('workout-notes').value = form.notes || '';
  renderExercises(form.exercises || []);
  $('form-heading').textContent = editingId ? 'Edit workout' : 'Log workout';
  $('save-workout').textContent = editingId ? 'Save changes' : 'Save workout';
  $('cancel-edit').hidden = !editingId;
}
function persistDraft() {
  if (editingId) return;
  try { localStorage.setItem(DRAFT_KEY,JSON.stringify(collectForm())); } catch {}
}
function recoverDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
    if (draft && validDate(draft.date) && CATEGORY.includes(draft.category) && Array.isArray(draft.exercises)) return draft;
  } catch {}
  return blank();
}
function refreshSuggestions() {
  const names = new Map();
  SUGGESTIONS.forEach(name => names.set(name.toLowerCase(),name));
  state.sessions.forEach(s => s.exercises.forEach(ex => names.set(ex.name.toLowerCase(),ex.name)));
  $('exercise-suggestions').replaceChildren(...Array.from(names.values()).sort((a,b) => a.localeCompare(b)).map(name => {
    const option = document.createElement('option'); option.value = name; return option;
  }));
}
function sortedSessions() { return [...state.sessions].sort((a,b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)); }
function sinceDays(days) { const d = new Date(); d.setDate(d.getDate() - (days - 1)); return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-'); }
function summary(s) {
  const count = s.exercises.length;
  return (s.duration ? format(s.duration) + ' min · ' : '') + count + (count === 1 ? ' exercise' : ' exercises');
}
function details(s) {
  return s.exercises.map(ex => {
    const count = ex.sets.length;
    let txt = '';
    if (ex.kind === 'strength') txt = count + (count === 1 ? ' set' : ' sets');
    if (ex.kind === 'rounds') txt = format(ex.sets.reduce((a,x) => a + num(x.rounds),0),0) + ' rounds';
    if (ex.kind === 'cardio') txt = format(ex.sets.reduce((a,x) => a + num(x.minutes),0)) + ' min';
    if (ex.kind === 'timed') txt = format(ex.sets.reduce((a,x) => a + num(x.minutes),0)) + ' min';
    return escapeHTML(ex.name) + ' · ' + escapeHTML(txt);
  }).join('<br>');
}
function renderLast() {
  const s = sortedSessions()[0];
  $('last-workout').className = s ? 'workout-snapshot' : 'empty';
  $('last-workout').innerHTML = !s ? 'No workouts yet. Your first one starts here.' : '<strong>' + escapeHTML(s.title || s.category + ' workout') + '</strong><p>' + escapeHTML(dateLabel(s.date)) + ' · ' + escapeHTML(summary(s)) + '</p><p>' + details(s) + '</p>';
}
function renderHistory() {
  const last30 = sinceDays(30);
  const sessions = sortedSessions();
  const recent = sessions.filter(s => s.date >= last30 && s.date <= today());
  $('month-count').textContent = recent.length;
  $('month-time').textContent = format(recent.reduce((a,s) => a + num(s.duration),0),0);
  const filter = $('history-filter').value;
  const selected = sessions.filter(s => filter === 'All' || s.category === filter);
  $('history-list').innerHTML = selected.length ? selected.map(s => '<article class="workout-row"><div class="workout-row-top"><div><h3>' + escapeHTML(s.title || s.category + ' workout') + '</h3><div class="workout-sub">' + escapeHTML(dateLabel(s.date)) + ' · ' + escapeHTML(summary(s)) + '</div><div class="workout-meta"><span class="tag">' + escapeHTML(s.category) + '</span></div></div><div class="row-menu"><button type="button" class="icon-button menu-trigger" aria-label="Actions for workout" aria-expanded="' + (menuId === s.id) + '" data-action="menu" data-id="' + escapeHTML(s.id) + '">⋮</button>' + (menuId === s.id ? '<div class="popup-menu"><button type="button" data-action="edit" data-id="' + escapeHTML(s.id) + '">Edit</button><button type="button" class="destructive" data-action="delete" data-id="' + escapeHTML(s.id) + '">Delete</button></div>' : '') + '</div></div><div class="workout-detail">' + details(s) + '</div>' + (s.notes ? '<p class="workout-note">' + escapeHTML(s.notes) + '</p>' : '') + '</article>').join('') : '<div class="empty">No workouts here yet.</div>';
}
function startEdit(id) {
  const session = state.sessions.find(s => s.id === id);
  if (!session) return;
  editingId = session.id; menuId = '';
  setForm(session);
  setPage('log');
}
function stopEdit() {
  editingId = '';
  setForm(recoverDraft());
}
function confirmAction(heading,message,action,buttonText) {
  $('confirm-heading').textContent = heading;
  $('confirm-message').textContent = message;
  $('confirm-yes').textContent = buttonText;
  pendingConfirm = action;
  $('confirm-dialog').showModal();
}
function deleteWorkout(id) {
  const s = state.sessions.find(x => x.id === id);
  if (!s) return;
  menuId = '';
  confirmAction('Delete workout?','Delete ' + (s.title || s.category + ' workout') + ' from ' + dateLabel(s.date) + '? This cannot be undone.', () => {
    state.sessions = state.sessions.filter(x => x.id !== id);
    if (editingId === id) stopEdit();
    persist(); refreshSuggestions(); renderHistory(); renderLast(); toast('Workout deleted');
  },'Delete');
}
function metricOptions(kind) {
  if (kind === 'strength') return [{key:'reps',label:'Best set · reps',unit:'reps'}, {key:'weight',label:'Heaviest set',unit:unit('weight')}, {key:'volume',label:'Total weighted volume',unit:unit('weight')}];
  if (kind === 'rounds') return [{key:'rounds',label:'Total rounds',unit:'rounds'},{key:'minutes',label:'Total training minutes',unit:'min'}];
  if (kind === 'cardio') return [{key:'minutes',label:'Total minutes',unit:'min'}, {key:'distance',label:'Total distance',unit:unit('distance')}];
  return [{key:'minutes',label:'Total minutes',unit:'min'}, {key:'effort',label:'Max effort',unit:'/ 10'}];
}
function exerciseKey(ex) { return ex.kind + '|' + ex.name.trim().toLocaleLowerCase(); }
function exerciseChoices() {
  const map = new Map();
  sortedSessions().forEach(s => s.exercises.forEach(ex => { const key = exerciseKey(ex); if (!map.has(key)) map.set(key,{key,name:ex.name,kind:ex.kind}); }));
  return [...map.values()].sort((a,b) => a.name.localeCompare(b.name) || a.kind.localeCompare(b.kind));
}
function setProgressOptions() {
  const select = $('progress-exercise');
  const previous = select.value;
  const choices = exerciseChoices();
  select.replaceChildren();
  if (!choices.length) {
    const opt = new Option('No exercises logged yet',''); select.add(opt);
  } else {
    choices.forEach(c => select.add(new Option(c.name + (choices.filter(x => x.name.toLowerCase() === c.name.toLowerCase()).length > 1 ? ' · ' + c.kind : ''),c.key)));
    select.value = choices.some(c => c.key === previous) ? previous : choices[0].key;
  }
  setMetricOptions();
}
function setMetricOptions() {
  const kind = $('progress-exercise').value.split('|')[0];
  const metrics = metricOptions(kind);
  const old = $('progress-metric').value;
  $('progress-metric').replaceChildren(...metrics.map(m => new Option(m.label,m.key)));
  if (metrics.some(m => m.key === old)) $('progress-metric').value = old;
}
function exerciseValues(ex) {
  if (ex.kind === 'strength') return {reps:Math.max(0,...ex.sets.map(s => num(s.reps))),weight:Math.max(0,...ex.sets.filter(s => num(s.reps)>0).map(s => num(s.weight))),volume:ex.sets.reduce((a,s) => a + num(s.reps)*num(s.weight),0)};
  if (ex.kind === 'rounds') return {rounds:ex.sets.reduce((a,s) => a+num(s.rounds),0),minutes:ex.sets.reduce((a,s) => a+num(s.rounds)*num(s.minutes),0)};
  if (ex.kind === 'cardio') return {minutes:ex.sets.reduce((a,s)=>a+num(s.minutes),0),distance:ex.sets.reduce((a,s)=>a+num(s.distance),0)};
  return {minutes:ex.sets.reduce((a,s)=>a+num(s.minutes),0),effort:Math.max(0,...ex.sets.map(s=>num(s.effort)))};
}
function pointsFor(key, metric) {
  const kind = key.split('|')[0];
  const best = kind === 'strength' && (metric === 'reps' || metric === 'weight') || metric === 'effort';
  const dates = new Map();
  sortedSessions().forEach(s => s.exercises.filter(ex => exerciseKey(ex) === key).forEach(ex => {
    const values = exerciseValues(ex);
    const v = num(values[metric]);
    const previous = dates.get(s.date);
    dates.set(s.date, previous == null ? v : best ? Math.max(previous,v) : previous + v);
  }));
  const range = $('progress-range').value;
  let cutoff = '0000-01-01';
  if (range !== 'all') {
    const d = new Date(today() + 'T12:00:00');
    d.setMonth(d.getMonth() - Number(range));
    cutoff = [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  }
  return Array.from(dates, ([date,value]) => ({date,value:metric === 'weight' || metric === 'volume' ? toDisplay('weight',value) : metric === 'distance' ? toDisplay('distance',value) : value})).filter(p => p.date >= cutoff && p.date <= today()).sort((a,b)=>a.date.localeCompare(b.date));
}
function chart(points, suffix) {
  if (!points.length) return '<div class="chart-empty">No records for this period.</div>';
  const W=350,H=204,L=42,R=14,T=14,B=36;
  const max = Math.max(1,...points.map(p=>p.value))*1.15;
  const days = points.map(p=>Date.parse(p.date + 'T12:00:00'));
  const lo=Math.min(...days),hi=Math.max(...days);
  const x = (d,i) => lo === hi ? (L+W-R)/2 : L+(d-lo)/(hi-lo)*(W-L-R);
  const y = v => H-B-(v/max)*(H-B-T);
  const coords=points.map((p,i)=>[x(days[i],i),y(p.value)]);
  const path=coords.map((p,i)=>(i?'L':'M')+p[0].toFixed(2)+' '+p[1].toFixed(2)).join(' ');
  const shortDate=d=>new Date(d+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric'});
  let svg='<svg role="img" aria-label="Exercise progress from '+escapeHTML(shortDate(points[0].date))+' to '+escapeHTML(shortDate(points.at(-1).date))+'" viewBox="0 0 '+W+' '+H+'">';
  for(let i=0;i<=3;i++){ const v=max*i/3, yy=y(v);svg+='<line x1="'+L+'" y1="'+yy+'" x2="'+(W-R)+'" y2="'+yy+'"/><text x="'+(L-7)+'" y="'+(yy+3)+'" text-anchor="end">'+escapeHTML(format(v, v<10?1:0))+'</text>'; }
  svg+='<path class="series" d="'+path+'"/>';
  coords.forEach((pt,i)=>svg+='<circle class="dot" cx="'+pt[0]+'" cy="'+pt[1]+'" r="4"><title>'+escapeHTML(dateLabel(points[i].date)+' · '+format(points[i].value,2)+' '+suffix)+'</title></circle>');
  const first=coords[0][0],last=coords.at(-1)[0];
  svg+='<text x="'+first+'" y="'+(H-12)+'" text-anchor="'+(points.length===1?'middle':'start')+'">'+escapeHTML(shortDate(points[0].date))+'</text>';
  if(points.length>1)svg+='<text x="'+last+'" y="'+(H-12)+'" text-anchor="end">'+escapeHTML(shortDate(points.at(-1).date))+'</text>';
  return svg+'</svg>';
}
function renderProgress() {
  $('all-count').textContent=state.sessions.length;
  $('week-count').textContent=state.sessions.filter(s=>s.date>=sinceDays(7)&&s.date<=today()).length;
  const choices=exerciseChoices();
  const selected=$('progress-exercise').value;
  if (!choices.some(c=>c.key===selected)) setProgressOptions();
  const key=$('progress-exercise').value;
  if (!key) {
    $('progress-summary').innerHTML='Log a workout to see your exercise records.';
    $('progress-chart').innerHTML='<div class="chart-empty">No data yet.</div>';
    $('progress-records').innerHTML='';
  } else {
    const kind=key.split('|')[0];
    const metric=metricOptions(kind).find(x=>x.key===$('progress-metric').value) || metricOptions(kind)[0];
    const points=pointsFor(key,metric.key);
    const best=points.length?Math.max(...points.map(p=>p.value)):0;
    const label=metric.unit;
    $('progress-summary').innerHTML=points.length?'<strong>'+escapeHTML(format(best,2))+' <span style="font-size:14px;font-weight:400">'+escapeHTML(label)+'</span></strong>Best '+escapeHTML(metric.label.toLowerCase())+' · '+points.length+' training day'+(points.length!==1?'s':''):'No records in this period.';
    $('progress-chart').innerHTML=chart(points,label);
    $('progress-records').innerHTML=points.slice().reverse().slice(0,12).map(p=>'<div class="record-row"><span>'+escapeHTML(dateLabel(p.date))+'</span><strong>'+escapeHTML(format(p.value,2))+' '+escapeHTML(label)+'</strong></div>').join('');
  }
  const recent=state.sessions.filter(s=>s.date>=sinceDays(30)&&s.date<=today());
  const counts=CATEGORY.map(cat=>({cat,count:recent.filter(s=>s.category===cat).length})).filter(x=>x.count>0);
  $('training-mix').innerHTML=counts.length?counts.map(x=>'<div class="mix-row"><span>'+escapeHTML(x.cat)+'</span><strong>'+x.count+' workout'+(x.count===1?'':'s')+'</strong></div><div class="mix-bar"><div style="width:'+100*x.count/recent.length+'%"></div></div>').join(''):'<div class="empty">Log a workout to start building your training history.</div>';
}
function downloadBackup() {
  const json=JSON.stringify({app:'Muscles',version:1,exportedAt:new Date().toISOString(),sessions:state.sessions,preferences:state.preferences},null,2);
  const url=URL.createObjectURL(new Blob([json],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='muscles-backup-'+today()+'.json';document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),3000);
  $('data-menu').hidden=true; $('data-toggle').setAttribute('aria-expanded','false');
}
async function importBackup(file) {
  if (!file || file.size>8*1024*1024) {toast('Choose a JSON backup smaller than 8 MB.');return;}
  try {
    const parsed=JSON.parse(await file.text());
    if (!parsed || parsed.app!=='Muscles' || parsed.version!==1 || !Array.isArray(parsed.sessions) || parsed.sessions.length>50000) throw Error('Choose a Muscles JSON backup.');
    const incoming=parsed.sessions.map(sanitizeSession);
    if (!confirm('Import '+incoming.length+' workouts? Existing workouts will be kept. Matching workout IDs will be skipped.'))return;
    const known=new Set(state.sessions.map(s=>s.id));
    let added=0;
    for(const s of incoming)if(!known.has(s.id)){state.sessions.push(s);known.add(s.id);added++;}
    persist(); refreshSuggestions();renderLast();renderHistory();setProgressOptions();renderProgress();
    toast('Imported '+added+' workout'+(added===1?'':'s'));
  }catch(e){toast(e.message||'Could not import that file.');}
}
function init() {
  document.documentElement.dataset.theme=state.preferences.theme;
  $('unit-toggle').textContent=state.preferences.unit;
  $('theme-toggle').firstElementChild.textContent=state.preferences.theme==='dark'?'☀':'☾';
  $('workout-date').max='9999-12-31';
  setForm(recoverDraft());refreshSuggestions();renderLast();renderHistory();setProgressOptions();renderProgress();
  document.querySelectorAll('.bottom-nav button').forEach(btn=>btn.addEventListener('click',()=>setPage(btn.dataset.page)));
  $('view-history').addEventListener('click',()=>setPage('history'));
  $('add-exercise').addEventListener('click',()=>{
    const kind=$('workout-category').value==='Boxing'?'rounds':$('workout-category').value==='Cardio'?'cardio':'strength';
    const list=$('exercise-list');list.append(createExerciseBlock(emptyExercise(kind),list.children.length));
    $('exercise-help').hidden=true;persistDraft();list.lastElementChild.querySelector('[data-ex-name]').focus();
  });
  $('exercise-list').addEventListener('click',e=>{
    const button=e.target.closest('[data-action]');if(!button)return;
    const block=button.closest('.exercise-block');if(!block)return;
    const action=button.dataset.action;
    if(action==='remove-exercise'){block.remove();document.querySelectorAll('.exercise-number').forEach((span,i)=>span.textContent='Exercise '+(i+1));$('exercise-help').hidden=!!$('exercise-list').children.length;}
    if(action==='add-set'){const list=block.querySelector('.set-list');list.append(createSetRow(block.querySelector('[data-ex-kind]').value,emptySet(block.querySelector('[data-ex-kind]').value),list.querySelectorAll('.set-row').length));}
    if(action==='remove-set'){
      button.closest('.set-row').remove();
      if(!block.querySelector('.set-row'))block.querySelector('.set-list').append(createSetRow(block.querySelector('[data-ex-kind]').value,emptySet(block.querySelector('[data-ex-kind]').value),0));
      block.querySelectorAll('.set-index').forEach((span,i)=>span.textContent=i+1);
    }
    persistDraft();
  });
  $('exercise-list').addEventListener('change',e=>{
    if(e.target.matches('[data-ex-kind]')) {
      const block=e.target.closest('.exercise-block');
      renderSets(block,[emptySet(e.target.value)]);updateKindHint(block);
    }
    persistDraft();
  });
  $('workout-form').addEventListener('input',persistDraft);
  $('workout-form').addEventListener('change',persistDraft);
  $('workout-form').addEventListener('submit',e=>{
    e.preventDefault();
    const draft=collectForm();
    if(!draft.exercises.length){toast('Add at least one exercise.');return;}
    try {
      const old=state.sessions.find(s=>s.id===editingId);
      const now=new Date().toISOString();
      const workout=validateSession({...draft,id:old?.id||makeId(),createdAt:old?.createdAt||now,updatedAt:now});
      if(old)state.sessions=state.sessions.map(s=>s.id===old.id?workout:s);
      else state.sessions.push(workout);
      persist();editingId='';localStorage.removeItem(DRAFT_KEY);setForm(blank());
      refreshSuggestions();renderLast();renderHistory();setProgressOptions();renderProgress();
      toast(old?'Workout updated':'Workout saved');setPage('history');
    }catch(error){toast(error.message||'Check your workout entries.');}
  });
  $('cancel-edit').addEventListener('click',()=>{stopEdit();toast('Editing canceled');});
  $('history-filter').addEventListener('change',()=>{menuId='';renderHistory();});
  $('history-list').addEventListener('click',e=>{
    const action=e.target.closest('[data-action]');if(!action)return;
    const id=action.dataset.id;
    if(action.dataset.action==='menu'){menuId=menuId===id?'':id;renderHistory();}
    if(action.dataset.action==='edit')startEdit(id);
    if(action.dataset.action==='delete')deleteWorkout(id);
  });
  $('confirm-cancel').addEventListener('click',()=>{$('confirm-dialog').close();pendingConfirm=null;});
  $('confirm-yes').addEventListener('click',()=>{const fn=pendingConfirm;pendingConfirm=null;$('confirm-dialog').close();fn?.();});
  $('confirm-dialog').addEventListener('close',()=>{pendingConfirm=null;});
  $('progress-exercise').addEventListener('change',()=>{setMetricOptions();renderProgress();});
  $('progress-metric').addEventListener('change',renderProgress);
  $('progress-range').addEventListener('change',renderProgress);
  $('theme-toggle').addEventListener('click',()=>{
    state.preferences.theme=state.preferences.theme==='dark'?'light':'dark';
    document.documentElement.dataset.theme=state.preferences.theme;
    $('theme-toggle').firstElementChild.textContent=state.preferences.theme==='dark'?'☀':'☾';
    persist();
  });
  $('unit-toggle').addEventListener('click',()=>{
    const draft=collectForm();
    state.preferences.unit=state.preferences.unit==='lb'?'kg':'lb';
    $('unit-toggle').textContent=state.preferences.unit;
    setForm(draft);persist();persistDraft();renderHistory();renderProgress();renderLast();
    toast('Using '+(state.preferences.unit==='kg'?'kilograms and kilometers':'pounds and miles'));
  });
  $('data-toggle').addEventListener('click',()=>{const menu=$('data-menu');menu.hidden=!menu.hidden;$('data-toggle').setAttribute('aria-expanded',String(!menu.hidden));});
  $('export-data').addEventListener('click',downloadBackup);
  $('import-data').addEventListener('click',()=>$('file-input').click());
  $('file-input').addEventListener('change',async e=>{const file=e.target.files[0];e.target.value='';await importBackup(file);$('data-menu').hidden=true;$('data-toggle').setAttribute('aria-expanded','false');});
  document.addEventListener('click',e=>{
    if(menuId && !e.target.closest('.row-menu')){menuId='';renderHistory();}
    if(!$('data-menu').hidden && !e.target.closest('.data-tools')){$('data-menu').hidden=true;$('data-toggle').setAttribute('aria-expanded','false');}
  });
  if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
}
init();
