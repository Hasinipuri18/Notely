const SECTIONS = ['Section A', 'Section B', 'Section C', 'Section D'];
const SEMESTERS = ['I Semester', 'II Semester'];
const ICONS = ['∑', '◉', '⚗', '⌘', 'Aa', '⌁'];

const COURSES = {
  'I Semester': [
    { code: 'MA401BS', title: 'Mathematical and Statistical Foundations', sidebarTitle: 'MSF', type: 'Theory' },
    { code: 'CS302PC', title: 'Computer Organization and Architecture', sidebarTitle: 'COA', type: 'Theory' },
    { code: 'CS303PC', title: 'Object Oriented Programming through Java', sidebarTitle: "OOP'S through JAVA", type: 'Theory' },
    { code: 'CS304PC', title: 'Software Engineering', sidebarTitle: 'SE', type: 'Theory' },
    { code: 'CS305PC', title: 'Database Management System', sidebarTitle: 'DBMS', type: 'Theory' },
    { code: 'MA306PC', title: 'Computational Mathematics Lab', sidebarTitle: 'CM lab', type: 'Lab' },
    { code: 'CS307PC', title: 'Object Oriented Programming through Java Lab', sidebarTitle: "OOP'S through JAVA lab", type: 'Lab' },
    { code: 'CS308PC', title: 'Software Engineering Lab', sidebarTitle: 'SE lab', type: 'Lab' },
    { code: 'CS309PC', title: 'Database Management Systems Lab', sidebarTitle: 'DBMS lab', type: 'Lab' },
    { code: 'CS310SD', title: 'Node JS/React JS/Django', type: 'Lab' }
  ],
  'II Semester': [
    { code: 'CS401PC', title: 'Discrete Mathematics', sidebarTitle: 'DM', type: 'Theory' },
    { code: 'CS402PC', title: 'Operating Systems', sidebarTitle: 'OS', type: 'Theory' },
    { code: 'CS403PC', title: 'Algorithms Design and Analysis', sidebarTitle: 'ADA', type: 'Theory' },
    { code: 'CS404PC', title: 'Computer Networks', sidebarTitle: 'CN', type: 'Theory' },
    { code: 'CS405PC', title: 'Machine Learning', sidebarTitle: 'ML', type: 'Theory' },
    { code: 'MS406HS', title: 'Innovation and Entrepreneurship', sidebarTitle: 'IE', type: 'Theory' },
    { code: 'CS407PC', title: 'Operating Systems Lab', sidebarTitle: 'OS lab', type: 'Lab' },
    { code: 'CS408PC', title: 'Computer Networks Lab', sidebarTitle: 'CN lab', type: 'Lab' },
    { code: 'CS409PC', title: 'Machine Learning Lab', sidebarTitle: 'ML lab', type: 'Lab' },
    { code: 'CS410SD', title: 'Data Visualization - R Programming/ Power BI', sidebarTitle: 'Power BI', type: 'Lab' },
    { code: 'VA400HS', title: 'Indian Knowledge System', type: 'Theory' }
  ]
};
const UNIT_LABELS = [
  ...Array.from({ length: 5 }, (_, index) => `Unit ${index + 1}`),
  ...Array.from({ length: 10 }, (_, index) => `Experiment ${index + 1}`),
  'General / Revision',
  'Other'
];
const USERS_KEY = 'courseleaf-users-v1';
const NOTES_KEY = 'courseleaf-notes-v1';
const REMINDERS_KEY = 'courseleaf-reminders-v1';
const SAVED_NOTES_KEY = 'courseleaf-saved-notes-v1';
const RECENT_NOTES_KEY = 'courseleaf-recent-notes-v1';
const app = document.querySelector('#app');
const supabaseUrl = window.NOTELY_SUPABASE_URL || '';
const supabaseKey = window.NOTELY_SUPABASE_PUBLISHABLE_KEY || '';
const supabaseClient = window.supabase?.createClient && supabaseUrl && supabaseKey
  && !supabaseKey.includes('PASTE_YOUR_')
  ? window.supabase.createClient(supabaseUrl, supabaseKey)
  : null;

let user = null;
let authMode = 'login';
let authSubmitting = false;
let authNotice = '';
let backendSubjectByCode = new Map();
function createInitialView() {
  return {
    page: 'home',
    section: SECTIONS[0],
    semester: SEMESTERS[0],
    subject: null,
    courseCode: null,
    courseTypeFilter: 'all',
    unitFilter: 'all',
    noteSort: 'newest',
    facultyTab: 'browse',
    studentTab: 'browse',
    filterSection: 'all',
    filterSemester: 'all',
    filterType: 'all',
    myUploadsOnly: false,
    reminderSemester: SEMESTERS[0],
    reminderType: 'Theory',
    searchQuery: '',
    editId: null,
    sidebarOpen: true,
    sidebarMenu: null
  };
}

let view = createInitialView();

function read(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function uploadDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('courseleaf-files-v1', 1);

    request.onupgradeneeded = () => {
      request.result.createObjectStore('files', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function putUpload(id, blob) {
  const db = await uploadDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction('files', 'readwrite');
    transaction.objectStore('files').put({ id, blob });
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
    transaction.onabort = () => {
      db.close();
      reject(transaction.error || new Error('File storage was cancelled'));
    };
  });
}

async function getUpload(id) {
  const db = await uploadDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction('files', 'readonly');
    const request = transaction.objectStore('files').get(id);

    request.onsuccess = () => {
      const result = request.result?.blob || null;
      db.close();
      resolve(result);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

async function removeUpload(id) {
  const db = await uploadDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction('files', 'readwrite');
    transaction.objectStore('files').delete(id);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

function notes() {
  const savedNotes = read(NOTES_KEY, []);
  const facultyUsers = read(USERS_KEY, []).filter(account => account.role === 'faculty');
  let changed = false;

  savedNotes.forEach(note => {
    if (note.uploaderUsername || !note.uploader) return;
    const uploaderName = note.uploader.toLocaleLowerCase();
    const matches = facultyUsers.filter(account => (
      account.username.toLocaleLowerCase() === uploaderName ||
      account.facultyName?.toLocaleLowerCase() === uploaderName
    ));

    if (matches.length === 1) {
      note.uploaderUsername = matches[0].username;
      changed = true;
    }
  });

  if (changed) save(NOTES_KEY, savedNotes);
  return savedNotes;
}

function savedNoteIds() {
  const savedByUser = read(SAVED_NOTES_KEY, {});
  const ids = savedByUser[user.username.toLocaleLowerCase()];
  return Array.isArray(ids) ? ids : [];
}

function recentlyViewedNotes() {
  const history = read(RECENT_NOTES_KEY, {});
  const entries = history[user.username.toLocaleLowerCase()];
  return Array.isArray(entries) ? entries : [];
}

async function recordNoteView(note) {
  if (user?.role !== 'student') return;
  const history = read(RECENT_NOTES_KEY, {});
  const accountKey = user.username.toLocaleLowerCase();
  const entries = Array.isArray(history[accountKey]) ? history[accountKey] : [];
  const viewedAt = new Date().toISOString();
  const { error } = await supabaseClient.from('recently_viewed_notes').upsert({
    student_id: user.id,
    note_id: note.id,
    viewed_at: viewedAt
  }, { onConflict: 'student_id,note_id' });
  if (error) {
    console.error('Could not record recent note:', error);
    return;
  }
  history[accountKey] = [
    { id: note.id, viewedAt },
    ...entries.filter(entry => entry.id !== note.id)
  ].slice(0, 50);
  save(RECENT_NOTES_KEY, history);
}

const isNoteSaved = id => savedNoteIds().includes(id);
async function toggleSavedNote(id) {
  const note = notes().find(item => item.id === id);
  if (!note) return;

  const savedByUser = read(SAVED_NOTES_KEY, {});
  const accountKey = user.username.toLocaleLowerCase();
  const ids = Array.isArray(savedByUser[accountKey]) ? savedByUser[accountKey] : [];
  const wasSaved = ids.includes(id);

  const { error } = wasSaved
    ? await supabaseClient.from('saved_notes').delete().eq('note_id', id).eq('student_id', user.id)
    : await supabaseClient.from('saved_notes').insert({ student_id: user.id, note_id: id });
  if (error) return toast(error.message || 'Could not update saved notes.');
  savedByUser[accountKey] = wasSaved ? ids.filter(savedId => savedId !== id) : [...ids, id];
  save(SAVED_NOTES_KEY, savedByUser);
  renderMain();
  toast(wasSaved ? 'Removed from saved notes.' : 'Note saved for later.');
}
const canManageNote = note => Boolean(
  user?.role === 'faculty' &&
  ((note?.uploaderId && note.uploaderId === user.id) ||
    (note?.uploaderUsername && note.uploaderUsername.toLocaleLowerCase() === user.username.toLocaleLowerCase()))
);
const coursesFor = (semester, type = 'all') => (COURSES[semester] || [])
  .filter(course => type === 'all' || course.type === type);
const courseByCode = code => Object.values(COURSES)
  .flat()
  .find(course => course.code === code);
const courseOptions = (semester, type, selected = '') => `
  <option value="">Choose a course</option>
  ${coursesFor(semester, type).map(course => `
    <option value="${course.code}" ${course.code === selected ? 'selected' : ''}>
      ${esc(course.title)}
    </option>
  `).join('')}
`;

function unitLabelOptions() {
  return `
    <datalist id="unit-label-options">
    ${UNIT_LABELS.map(label => `
      <option value="${esc(label)}"></option>
    `).join('')}
    </datalist>
  `;
}

const initials = name => (name || '?').slice(0, 1).toUpperCase();

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function toast(message) {
  const element = document.querySelector('#toast');
  element.textContent = message;
  element.classList.add('show');
  setTimeout(() => element.classList.remove('show'), 2600);
}

function brand() {
  return `
    <div class="brand">
      <span class="brand-mark">✦</span>
      Notely
    </div>
  `;
}

function bookmarkIcon() {
  return `
    <svg class="bookmark-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M6.5 3.75h11a1.5 1.5 0 0 1 1.5 1.5v15l-7-5-7 5v-15a1.5 1.5 0 0 1 1.5-1.5Z" />
    </svg>
  `;
}

async function render() {
  if (!supabaseClient) {
    user = null;
    renderAuth();
    return;
  }

  const { data, error } = await supabaseClient.auth.getSession();
  if (error || !data.session) {
    user = null;
    renderAuth();
    return;
  }

  try {
    user = await loadProfile(data.session.user);
  } catch (profileError) {
    console.error('Could not load Notely profile:', profileError);
    user = null;
    await supabaseClient.auth.signOut();
    authNotice = 'Your account profile could not be loaded. Please try signing in again.';
    renderAuth();
    return;
  }

  try {
    await loadBackendData();
  } catch (dataError) {
    console.error('Could not sync Notely data:', dataError);
    renderMain();
    toast('You are signed in, but Notely could not refresh the library. Check the Supabase setup and reload.');
    return;
  }
  renderMain();
}

async function loadBackendData() {
  const [subjectResult, noteResult, savedResult, recentResult, reminderResult] = await Promise.all([
    supabaseClient.from('subjects').select('id, semester, title, short_title, type, sort_order').order('sort_order'),
    supabaseClient.from('notes').select('id, uploaded_by, subject_id, unit_label, title, file_name, storage_path, mime_type, file_size_bytes, uploader_name, created_at, updated_at, subjects(semester, title, type), note_sections(section_id)').order('created_at', { ascending: false }),
    supabaseClient.from('saved_notes').select('note_id'),
    supabaseClient.from('recently_viewed_notes').select('note_id, viewed_at').order('viewed_at', { ascending: false }).limit(50),
    supabaseClient.from('upload_reminders').select('id, faculty_id, subject_id, unit_label, remind_at, completed_at, notified_at, created_at, subjects(semester, title, type), reminder_sections(section_id)').order('remind_at')
  ]);
  const results = [subjectResult, noteResult, savedResult, recentResult, reminderResult];
  const failed = results.find(result => result.error);
  if (failed) throw failed.error;

  backendSubjectByCode = new Map();
  subjectResult.data.forEach(subject => {
    const course = Object.values(COURSES).flat().find(item =>
      item.title === subject.title && COURSES[subject.semester]?.some(term => term.code === item.code)
    );
    if (course) backendSubjectByCode.set(course.code, subject.id);
  });

  const backendNotes = noteResult.data.map(note => {
    const course = Object.values(COURSES).flat().find(item => item.title === note.subjects?.title);
    return {
      id: note.id,
      uploaderId: note.uploaded_by,
      uploader: note.uploader_name || 'Faculty',
      semester: note.subjects?.semester || '',
      type: note.subjects?.type || '',
      courseCode: course?.code || '',
      subject: note.subjects?.title || '',
      unit: note.unit_label,
      title: note.title,
      fileName: note.file_name,
      storagePath: note.storage_path,
      mimeType: note.mime_type || '',
      fileSizeBytes: note.file_size_bytes,
      sections: (note.note_sections || []).map(section => `Section ${section.section_id}`),
      created: note.created_at,
      updated: note.updated_at
    };
  });
  save(NOTES_KEY, backendNotes);
  save(SAVED_NOTES_KEY, {
    [user.username.toLocaleLowerCase()]: savedResult.data.map(entry => entry.note_id)
  });
  save(RECENT_NOTES_KEY, {
    [user.username.toLocaleLowerCase()]: recentResult.data.map(entry => ({ id: entry.note_id, viewedAt: entry.viewed_at }))
  });
  save(REMINDERS_KEY, reminderResult.data.map(reminder => {
    const course = Object.values(COURSES).flat().find(item => item.title === reminder.subjects?.title);
    return {
      id: reminder.id,
      facultyId: reminder.faculty_id,
      facultyUsername: user.username,
      courseCode: course?.code || '',
      subject: reminder.subjects?.title || '',
      semester: reminder.subjects?.semester || '',
      type: reminder.subjects?.type || '',
      unit: reminder.unit_label,
      sections: (reminder.reminder_sections || []).map(section => `Section ${section.section_id}`),
      remindAt: reminder.remind_at,
      createdAt: reminder.created_at,
      notifiedAt: reminder.notified_at,
      completedAt: reminder.completed_at
    };
  }));
}

async function loadProfile(authUser) {
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('id, username, display_name, role')
    .eq('id', authUser.id)
    .single();
  if (error) throw error;
  return {
    id: data.id,
    username: data.username,
    email: authUser.email || '',
    role: data.role,
    facultyName: data.display_name || data.username
  };
}

function setAuthButtonState(state) {
  const button = app.querySelector('[data-auth-submit]');
  const status = app.querySelector('.auth-live-status');
  if (!button) return;
  const label = authMode === 'login' ? 'Sign in to Notely' : 'Create account';
  button.classList.remove('auth-loading', 'auth-success');
  button.disabled = state !== 'idle';
  button.setAttribute('aria-busy', String(state === 'loading'));
  if (state === 'loading') {
    button.classList.add('auth-loading');
    button.innerHTML = `<span class="auth-spinner" aria-hidden="true"></span><span>${authMode === 'login' ? 'Signing in…' : 'Creating account…'}</span>`;
    if (status) status.textContent = authMode === 'login' ? 'Checking your account' : 'Creating your account';
  } else if (state === 'success') {
    button.classList.add('auth-success');
    button.innerHTML = '<span class="auth-success-mark" aria-hidden="true">✓</span><span>Access granted.</span>';
    if (status) status.textContent = 'Signed in successfully';
  } else {
    button.innerHTML = `<span>${label}</span><span class="auth-submit-arrow" aria-hidden="true">↗</span>`;
    if (status) status.textContent = '';
  }
}

function renderAuth() {
  authSubmitting = false;
  app.innerHTML = `
    <div class="auth-wrap">
      <section class="auth-side">
        <form class="auth-box" id="auth-form">
          <div class="auth-brand-block">
            <div class="auth-brand-glow"></div>
            ${brand()}
            <p class="auth-welcome">Your department notes, all in one place.</p>
            <p class="auth-hint">A simpler way to find what you need.</p>
            <div class="auth-sparks" aria-hidden="true"><span>✦</span><span>◈</span><span>⌘</span></div>
          </div>
          <div class="auth-form-intro">
            <div class="eyebrow">DEPARTMENT NOTES</div>
          <h2>${authMode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
          <p>${authMode === 'login' ? 'Sign in to find your course materials.' : 'Join your department’s shared notes library.'}</p>
          </div>

          ${authMode === 'signup' ? `
            <div class="field">
              <label for="username">Notely username</label>
              <div class="auth-input-wrap">
                <svg class="auth-field-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.7-3.5 3.2-5.5 7-5.5s6.3 2 7 5.5"/></svg>
                <input id="username" name="username" required autocomplete="username" placeholder="Choose a username" minlength="3" maxlength="32" pattern="[A-Za-z0-9._-]+">
              </div>
            </div>
          ` : ''}
          <div class="field">
            <label for="email">Email address</label>
            <div class="auth-input-wrap">
              <svg class="auth-field-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="m4 7 8 6 8-6"/></svg>
              <input id="email" name="email" type="email" required autocomplete="email" placeholder="${authMode === 'login' ? 'Enter your email' : 'you@example.com'}">
            </div>
          </div>
          <div class="field">
            <label for="password">Password</label>
            <div class="password-wrap auth-input-wrap">
              <svg class="auth-field-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="4.5" y="10" width="15" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
              <input id="password" name="password" type="password" required
                autocomplete="${authMode === 'login' ? 'current-password' : 'new-password'}"
                placeholder="${authMode === 'login' ? 'Enter your password' : 'At least 6 characters'}" minlength="6">
              <button class="password-toggle" type="button" aria-label="Show password" aria-pressed="false">${eyeIcon()}</button>
            </div>
          </div>

          ${authMode === 'signup' ? '<div class="notice">Student accounts can sign up here. Faculty access is enabled separately by the project owner.</div>' : ''}

          <button class="button button-primary auth-submit" type="submit" data-auth-submit>
            <span>${authMode === 'login' ? 'Sign in to Notely' : 'Create account'}</span><span class="auth-submit-arrow" aria-hidden="true">↗</span>
          </button>
          <div class="auth-live-status" role="status" aria-live="polite"></div>
          <div class="auth-switch">
            ${authMode === 'login'
              ? `New here? <button type="button" data-mode="signup">Create an account</button>`
              : `Already have an account? <button type="button" data-mode="login">Sign in</button>`}
          </div>
          ${authNotice ? `<div class="notice auth-notice" role="status">${esc(authNotice)}</div>` : ''}
          ${!supabaseClient ? '<div class="notice auth-notice" role="status">Connect Supabase by adding the project publishable key to supabase-config.js.</div>' : ''}
        </form>
      </section>
    </div>
  `;

  app.querySelector('[data-mode]')?.addEventListener('click', event => {
    authMode = event.target.dataset.mode;
    authNotice = '';
    renderAuth();
  });
  app.querySelector('.password-toggle').onclick = togglePassword;
  app.querySelector('#auth-form').onsubmit = authSubmit;
}

function togglePassword(event) {
  const input = app.querySelector('#password');
  const button = event.currentTarget;
  const show = input.type === 'password';

  input.type = show ? 'text' : 'password';
  button.innerHTML = eyeIcon(show);
  button.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  button.setAttribute('aria-pressed', String(show));
}

function eyeIcon(isVisible = false) {
  return isVisible
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A10.9 10.9 0 0 1 12 5c5 0 8.5 4.1 9.5 6.5a10.8 10.8 0 0 1-3.1 4.3M6.2 6.2C3.8 7.7 2.7 10 2.5 11.5 3.5 13.9 7 18 12 18c1 0 1.9-.2 2.7-.5"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.5"/></svg>';
}

async function authSubmit(event) {
  event.preventDefault();
  if (authSubmitting) return;
  if (!supabaseClient) return toast('Add the Supabase publishable key to supabase-config.js first.');

  authSubmitting = true;
  setAuthButtonState('loading');

  const form = new FormData(event.currentTarget);
  const email = String(form.get('email') || '').trim().toLowerCase();
  const password = String(form.get('password'));

  try {
    if (authMode === 'signup') {
      const username = String(form.get('username') || '').trim();
      if (!/^[A-Za-z0-9._-]{3,32}$/.test(username)) {
        authSubmitting = false;
        setAuthButtonState('idle');
        return toast('Use 3–32 letters, numbers, dots, underscores, or hyphens for your username.');
      }

      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: { data: { username, display_name: username } }
      });
      if (error) throw error;

      if (!data.session) {
        authSubmitting = false;
        authMode = 'login';
        authNotice = `Check ${email} for the confirmation link, then sign in with your email and password.`;
        renderAuth();
        return;
      }

      user = await loadProfile(data.user);
    } else {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      user = await loadProfile(data.user);
    }

    try {
      await loadBackendData();
    } catch (dataError) {
      console.error('Could not sync Notely data after sign-in:', dataError);
    }

    setAuthButtonState('success');
    await new Promise(resolve => setTimeout(resolve, 350));
    authNotice = '';
    view = createInitialView();
    renderMain();
    toast(authMode === 'signup' ? 'Account created. Welcome to Notely!' : 'You’re signed in.');
  } catch (error) {
    authSubmitting = false;
    setAuthButtonState('idle');
    console.error('Authentication failed:', error);
    toast(error.message || 'Could not sign in. Check your details and try again.');
  }
}

function header() {
  const displayName = user.facultyName || user.username;

  return `
    <header class="topbar">
      ${brand()}
      <div class="top-right">
        <span class="user-chip">
          <span class="avatar">${esc(initials(displayName))}</span>
          ${esc(displayName)} · ${user.role === 'faculty' ? 'Faculty' : 'Student'}
        </span>
        <button class="text-button" data-action="logout">Sign out</button>
      </div>
    </header>
  `;
}

function subjectCardGrid(section) {
  const courses = coursesFor(view.semester, view.courseTypeFilter);

  return `
    ${courses.length ? `
      <div class="category-switch">
        <button class="tab ${view.courseTypeFilter === 'all' ? 'active' : ''}" data-course-filter="all">All courses</button>
        <button class="tab ${view.courseTypeFilter === 'Theory' ? 'active' : ''}" data-course-filter="Theory">Theory</button>
        <button class="tab ${view.courseTypeFilter === 'Lab' ? 'active' : ''}" data-course-filter="Lab">Lab</button>
      </div>
    ` : ''}
    <div class="subject-grid">
      ${courses.map((course, index) => {
        const count = notes().filter(note => (
          note.sections?.includes(section) &&
          note.semester === view.semester &&
          (note.courseCode === course.code || note.subject === course.title)
        )).length;

        return `
          <button class="subject-card" data-subject="${course.code}">
            <span class="subject-top">
              <span class="subject-icon">${ICONS[index % ICONS.length]}</span>
              <span class="count-pill">${course.type} · ${count} ${count === 1 ? 'note' : 'notes'}</span>
            </span>
            <strong>${esc(course.title)}</strong>
            <span class="open-hint">Open course →</span>
          </button>
        `;
      }).join('')}
    </div>
  `;
}

function studentSelectors() {
  return `
    <div class="student-selectors">
      <div class="section-select">
        <label for="semester-select">Semester</label>
        <select id="semester-select">
          ${SEMESTERS.map(semester => `
            <option ${semester === view.semester ? 'selected' : ''}>${semester}</option>
          `).join('')}
        </select>
      </div>
      <div class="section-select">
        <label for="section-select">Section</label>
        <select id="section-select">
          ${SECTIONS.map(section => `
            <option ${section === view.section ? 'selected' : ''}>${section}</option>
          `).join('')}
        </select>
      </div>
    </div>
  `;
}

function homeView() {
  if (view.studentTab === 'saved') {
    return savedNotesView();
  }
  if (view.studentTab === 'recent') {
    return recentlyViewedNotesView();
  }

  const selectedCourse = courseByCode(view.courseCode);

  if (view.subject) {
   const courseNotes = notes()
  .filter(note => (
    note.sections?.includes(view.section) &&
    note.semester === view.semester &&
    (note.courseCode === view.courseCode || note.subject === view.subject)
  ))
  .sort((first, second) => (second.created || '').localeCompare(first.created || ''));

const units = [...new Set(
  courseNotes.map(note => note.unit || 'General / Revision')
)];

const list = view.unitFilter === 'all'
  ? courseNotes
  : courseNotes.filter(note =>
      (note.unit || 'General / Revision') === view.unitFilter
    );
     return `
      <div class="hero-row">
        <div>
          <button class="back-button" data-action="back">← All courses</button>
          <div class="eyebrow selected-course-label">
            ${esc(view.semester)} · ${esc(view.section)} · ${esc(selectedCourse?.type || 'Course')}
          </div>
          <h1 class="selected-course-title">${esc(view.subject)}</h1>
          <p>${list.length} shared ${list.length === 1 ? 'note' : 'notes'}</p>
        </div>
        ${studentSelectors()}
      </div>
      <div class="unit-filters">
  <button
    class="tab ${view.unitFilter === 'all' ? 'active' : ''}"
    data-unit-filter="all">
    All labels
  </button>

  ${units.map(unit => `
    <button
      class="tab ${view.unitFilter === unit ? 'active' : ''}"
      data-unit-filter="${esc(unit)}">
      ${esc(unit)}
    </button>
  `).join('')}
</div>
      ${notePanel(list, false)}
      
    `;
  }

  const sectionNotes = notes()
    .filter(note => (
      note.sections?.includes(view.section) &&
      note.semester === view.semester
    ))
    .sort((first, second) => (second.created || '').localeCompare(first.created || ''));
  const isSearching = Boolean((view.searchQuery || '').trim());

  return `
    <div class="hero-row">
      <div>
        <div class="eyebrow">SECOND YEAR DEPARTMENT LIBRARY</div>
        <h1>Find what you need.</h1>
        <p>Choose your semester, then browse its theory and lab courses.</p>
      </div>
      ${studentSelectors()}
    </div>
    <div class="student-search-panel panel">${notesSearchForm()}</div>
    ${isSearching ? `
      <div class="search-results-heading">
        Results in ${esc(view.semester)} · ${esc(view.section)}
      </div>
      ${notePanel(sectionNotes, false, false)}
    ` : subjectCardGrid(view.section)}
  `;
}

function savedNotesView() {
  const ids = savedNoteIds();
  const saved = notes()
    .filter(note => ids.includes(note.id))
    .sort((first, second) => (second.created || '').localeCompare(first.created || ''));

  return `
    <div class="hero-row">
      <div>
        <div class="eyebrow">STUDENT LIBRARY</div>
        <h1>Saved notes.</h1>
        <p>Your saved materials, gathered in one place across sections and semesters.</p>
      </div>
    </div>
    ${saved.length || (view.searchQuery || '').trim() ? notePanel(saved, false) : `
      <div class="panel saved-empty-panel">
        ${notesSearchForm()}
        <div class="empty">
          <div class="empty-icon">${bookmarkIcon()}</div>
          <strong>No saved notes yet</strong>
          <div class="empty-hint">Use the Save button on a note to keep it here for later.</div>
        </div>
      </div>
    `}
  `;
}

function recentlyViewedNotesView() {
  const allNotes = notes();
  const recent = recentlyViewedNotes()
    .map(entry => allNotes.find(note => note.id === entry.id))
    .filter(Boolean);

  return `
    <div class="hero-row">
      <div>
        <div class="eyebrow">STUDENT LIBRARY</div>
        <h1>Recently viewed.</h1>
        <p>Notes you’ve opened or downloaded recently, with the latest activity at the top.</p>
      </div>
      ${recent.length ? '<button class="button button-light" data-clear-recent>Clear history</button>' : ''}
    </div>
    ${recent.length ? notePanel(recent, false) : `
      <div class="panel">
        <div class="empty">
          <div class="empty-icon">↶</div>
          <strong>No recently viewed notes</strong>
          <div class="empty-hint">Preview or download a note and it will appear here for quick access.</div>
        </div>
      </div>
    `}
  `;
}

function notesSearchForm() {
  const query = (view.searchQuery || '').trim();
  return `
    <form id="notes-search-form" class="notes-search">
      <input id="notes-search" type="search" value="${esc(view.searchQuery || '')}"
        placeholder="Search by subject name, note title, unit, or faculty" aria-label="Search notes by subject, title, unit, or faculty">
      <button class="button button-primary" type="submit">Search</button>
      ${query ? '<button class="button button-light" type="button" data-clear-search>Clear</button>' : ''}
    </form>
  `;
}

function sortNotes(list) {
  const sorted = [...list];
  if (view.noteSort === 'recent') {
    const viewedAt = new Map(recentlyViewedNotes().map(entry => [entry.id, entry.viewedAt]));
    return sorted.sort((a, b) => (viewedAt.get(b.id) || '').localeCompare(viewedAt.get(a.id) || ''));
  }
  if (view.noteSort === 'title') {
    return sorted.sort((a, b) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' }));
  }
  if (view.noteSort === 'subject') {
    return sorted.sort((a, b) => {
      const subjectA = courseByCode(a.courseCode)?.title || a.subject || '';
      const subjectB = courseByCode(b.courseCode)?.title || b.subject || '';
      return subjectA.localeCompare(subjectB, undefined, { sensitivity: 'base' })
        || (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' });
    });
  }
  return sorted.sort((a, b) => (b.created || '').localeCompare(a.created || ''));
}

function noteSortControl() {
  return `
    <label class="note-sort-control">
      <span>Sort by</span>
      <select data-note-sort aria-label="Sort notes">
        <option value="newest" ${view.noteSort === 'newest' ? 'selected' : ''}>Newest</option>
        <option value="recent" ${view.noteSort === 'recent' ? 'selected' : ''}>Recently viewed</option>
        <option value="subject" ${view.noteSort === 'subject' ? 'selected' : ''}>Subject</option>
        <option value="title" ${view.noteSort === 'title' ? 'selected' : ''}>Title</option>
      </select>
    </label>
  `;
}

function notePanel(list, manage, showSearch = true) {
  const normalizeSearchText = value => String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const query = normalizeSearchText(view.searchQuery);
  const queryTerms = query.split(/\s+/).filter(Boolean);
  const rankedNotes = query
    ? list.map(note => {
        const course = courseByCode(note.courseCode) || Object.values(COURSES).flat().find(item =>
          normalizeSearchText(item.title) === normalizeSearchText(note.subject)
          || normalizeSearchText(item.sidebarTitle) === normalizeSearchText(note.subject)
        );
        const primaryFields = [note.title, note.subject, course?.title, course?.sidebarTitle]
          .map(normalizeSearchText).filter(Boolean);
        const otherFields = [note.unit, note.uploader, note.fileName, note.semester, note.type, ...(note.sections || [])]
          .map(normalizeSearchText).filter(Boolean);
        const primaryText = primaryFields.join(' ');
        const allText = [...primaryFields, ...otherFields].join(' ');
        const matchedTerms = queryTerms.filter(term => allText.includes(term));

        // Include a note when any part of the query matches. Give title and
        // subject matches higher priority, while still searching other details.
        const titleSubjectMatches = queryTerms.filter(term => primaryText.includes(term)).length;
        const score = (normalizeSearchText(primaryText).includes(query) ? 100 : 0)
          + titleSubjectMatches * 10
          + matchedTerms.length;
        return { note, score };
      }).filter(result => result.score > 0)
        .sort((a, b) => b.score - a.score)
    : list.map(note => ({ note, score: 0 }));
  const visibleNotes = rankedNotes.map(result => result.note);
  const sortedNotes = query
    ? visibleNotes
    : sortNotes(visibleNotes);

  if (!visibleNotes.length) {
    return `
      <div class="panel">
        ${showSearch ? notesSearchForm() : ''}
        <div class="empty">
          <div class="empty-icon">↗</div>
          <strong>${query ? 'No matching notes' : 'No notes here yet'}</strong>
          <div class="empty-hint">${query ? 'No notes matched that search in this view. Try a subject, title, unit, or faculty name, or clear the search.' : 'There are no notes in this view yet. Check back later or choose another subject, section, or semester.'}</div>
          ${query ? '<button class="button button-light button-small empty-clear-button" type="button" data-clear-search>Clear search</button>' : ''}
        </div>
      </div>
    `;
  }

  return `
    <div class="panel">
      ${showSearch ? notesSearchForm() : ''}
      <div class="note-list-toolbar">${noteSortControl()}<span class="note-result-count">${sortedNotes.length} ${sortedNotes.length === 1 ? 'note' : 'notes'}</span></div>
      <div class="note-list">
        ${sortedNotes.map(note => `
          <article class="note-row">
            <div class="note-main">
              <div class="file-icon">${esc((String(note.fileName || '').split('.').pop() || 'FILE').slice(0, 4).toUpperCase())}</div>
              <div class="note-copy">
                <div class="note-title">${esc(note.title)}</div>
                <div class="unit-label">${esc(note.unit || 'General / Revision')}</div>
                <div class="note-uploader">Uploaded by ${esc(note.uploader || 'Faculty')}</div>
                <div class="note-meta">
                  ${esc(note.semester || '')}
                  ${note.type ? `· ${esc(note.type)}` : ''}
                  · ${esc(note.fileName)}
                  · Shared ${new Date(note.created).toLocaleDateString()}
                  · ${esc((note.sections || []).join(', '))}
                </div>
              </div>
            </div>
            <div class="note-actions">
              <button class="button button-light button-small" data-preview="${note.id}">Preview</button>
              <button class="button button-light button-small" data-open="${note.id}">Download</button>
              ${user.role === 'student' ? `
                <button class="button ${isNoteSaved(note.id) ? 'button-primary' : 'button-light'} button-small"
                  data-save-note="${note.id}" aria-pressed="${isNoteSaved(note.id)}">
                  ${bookmarkIcon()} ${isNoteSaved(note.id) ? 'Saved' : 'Save'}
                </button>
              ` : ''}
              ${manage && canManageNote(note) ? `
                <button class="button button-light button-small" data-edit="${note.id}">Edit</button>
                <button class="button button-danger button-small" data-delete="${note.id}">Delete</button>
              ` : ''}
            </div>
          </article>
        `).join('')}
      </div>
    </div>
  `;
}

function facultyView() {
  if (view.facultyTab === 'upload') {
    return uploadView();
  }
  if (view.facultyTab === 'reminders') {
    return remindersView();
  }

  const filtered = notes()
    .filter(note => (
      (view.filterSection === 'all' || note.sections?.includes(view.filterSection)) &&
      (view.filterSemester === 'all' || note.semester === view.filterSemester) &&
      (view.filterType === 'all' || note.type === view.filterType) &&
      (!view.myUploadsOnly || canManageNote(note))
    ))
    .sort((first, second) => (second.created || '').localeCompare(first.created || ''));

  return `
    <div class="hero-row">
      <div>
        <div class="eyebrow">FACULTY WORKSPACE</div>
        <h1>Shared notes.</h1>
        <p>Find materials by semester, course type, section, and subject.</p>
      </div>
      <div class="toolbar">
        <button class="button button-primary" data-tab="upload">＋ Upload notes</button>
      </div>
    </div>
    <div class="faculty-tabs">
      <button class="tab active" data-tab="browse">Browse library</button>
      <button class="tab" data-tab="upload">Upload notes</button>
    </div>
    <div class="panel">
      <div class="filterbar">
        <div>
          <strong class="library-heading">Department library</strong>
          <div class="library-count">${filtered.length} ${filtered.length === 1 ? 'note' : 'notes'} available</div>
        </div>
        <div class="toolbar">
          <select id="filter-semester">
            <option value="all">All semesters</option>
            ${SEMESTERS.map(semester => `
              <option ${view.filterSemester === semester ? 'selected' : ''}>${semester}</option>
            `).join('')}
          </select>
          <select id="filter-type">
            <option value="all">Theory and Lab</option>
            <option ${view.filterType === 'Theory' ? 'selected' : ''}>Theory</option>
            <option ${view.filterType === 'Lab' ? 'selected' : ''}>Lab</option>
          </select>
          <select id="filter-section">
            <option value="all">All sections</option>
            ${SECTIONS.map(section => `
              <option ${view.filterSection === section ? 'selected' : ''}>${section}</option>
            `).join('')}
          </select>
        </div>
      </div>
      ${notePanel(filtered, true)}
    </div>
  `;
}

function uploadView() {
  const existing = view.editId ? notes().find(note => note.id === view.editId) : null;
  const semester = existing?.semester || view.uploadSemester || view.semester;
  const type = existing?.type || view.uploadType || 'Theory';
  const courseCode = existing?.courseCode || '';

  return `
    <div class="hero-row">
      <div>
        <div class="eyebrow">FACULTY WORKSPACE</div>
        <h1>${existing ? 'Edit note' : 'Share a note.'}</h1>
        <p>${existing ? 'Update the course, sections, title, or file.' : 'Choose the semester and course type before adding the note.'}</p>
      </div>
      <button class="button button-light" data-tab="browse">← Browse library</button>
    </div>
    <div class="faculty-tabs">
      <button class="tab" data-tab="browse">Browse library</button>
      <button class="tab active" data-tab="upload">Upload notes</button>
    </div>
    <form id="upload-form" class="panel upload-card">
      <div class="form-grid">
        <div class="field">
          <label for="upload-semester">Semester</label>
          <select id="upload-semester" name="semester" required>
            ${SEMESTERS.map(option => `
              <option ${option === semester ? 'selected' : ''}>${option}</option>
            `).join('')}
          </select>
        </div>
        <div class="field">
          <label for="upload-type">Course type</label>
          <select id="upload-type" name="type" required>
            <option ${type === 'Theory' ? 'selected' : ''}>Theory</option>
            <option ${type === 'Lab' ? 'selected' : ''}>Lab</option>
          </select>
        </div>
      </div>
      <div class="field">
        <label for="upload-course">Subject / course</label>
        <select id="upload-course" name="courseCode" required>
          ${courseOptions(semester, type, courseCode)}
        </select>
      </div>
      <div class="field">
  <label for="upload-unit">Unit / experiment</label>
  <input id="upload-unit" name="unit" list="unit-label-options" required
    placeholder="Choose or type a unit / experiment" value="${esc(existing?.unit || '')}" autocomplete="off">
    ${unitLabelOptions()}
  
</div>
      <div class="field">
        <span class="field-label">Sections this note is for</span>
        <div class="section-choices">
          ${SECTIONS.map(section => `
            <label class="choice">
              <input type="checkbox" name="sections" value="${section}" ${existing?.sections?.includes(section) ? 'checked' : ''}>
              ${section}
            </label>
          `).join('')}
        </div>
      </div>
      <div class="field">
        <label for="title">Note title</label>
        <input id="title" name="title" required maxlength="100"
          placeholder="e.g. Unit 3 — Revision questions" value="${esc(existing?.title || '')}">
      </div>
      <div class="field">
        <label>${existing ? 'Replace file (optional)' : 'File'}</label>
        <div class="file-drop">
          Choose a file from your device
          <input type="file" name="file" ${existing ? '' : 'required'}>
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="button button-light" data-tab="browse">Cancel</button>
        <button class="button button-primary">${existing ? 'Save changes' : 'Publish note'}</button>
      </div>
    </form>
  `;
}

function remindersView() {
  const myReminders = read(REMINDERS_KEY, [])
    .filter(reminder => reminder.facultyUsername?.toLocaleLowerCase() === user.username.toLocaleLowerCase())
    .sort((first, second) => (first.remindAt || '').localeCompare(second.remindAt || ''));
  const pending = myReminders.filter(reminder => !reminder.completedAt);
  const completed = myReminders.filter(reminder => reminder.completedAt);
  const notificationAvailable = typeof Notification !== 'undefined';
  const permission = notificationAvailable ? Notification.permission : 'unsupported';

  return `
    <div class="hero-row">
      <div>
        <div class="eyebrow">FACULTY WORKSPACE</div>
        <h1>Upload reminders.</h1>
        <p>Schedule a reminder for notes you still need to share.</p>
      </div>
      <div class="toolbar">
        ${permission === 'default' ? '<button class="button button-light" data-enable-reminder-notifications>Enable browser alerts</button>' : ''}
        ${permission === 'granted' ? '<span class="reminder-permission">Browser alerts enabled</span>' : ''}
        ${permission === 'denied' ? '<span class="reminder-permission">Browser alerts are blocked</span>' : ''}
      </div>
    </div>
    <p class="reminder-help">Reminders trigger while Notely is open. If supported and enabled, browser alerts can also appear over other windows. They will not trigger while the app is closed.</p>
    <form id="reminder-form" class="panel upload-card reminder-form">
      <h2>New reminder</h2>
      <div class="form-grid">
        <div class="field">
          <label for="reminder-semester">Semester</label>
          <select id="reminder-semester" name="semester" required>
            ${SEMESTERS.map(semester => `<option ${view.reminderSemester === semester ? 'selected' : ''}>${semester}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label for="reminder-type">Course type</label>
          <select id="reminder-type" name="type" required>
            <option ${view.reminderType === 'Theory' ? 'selected' : ''}>Theory</option>
            <option ${view.reminderType === 'Lab' ? 'selected' : ''}>Lab</option>
          </select>
        </div>
      </div>
      <div class="form-grid">
        <div class="field">
          <label for="reminder-course">Subject</label>
          <select id="reminder-course" name="courseCode" required>
            ${courseOptions(view.reminderSemester, view.reminderType)}
          </select>
        </div>
        <div class="field">
          <label for="reminder-unit">Unit / experiment</label>
          <input id="reminder-unit" name="unit" list="unit-label-options" required
            placeholder="Choose or type a unit / experiment" autocomplete="off">
          ${unitLabelOptions()}
        </div>
      </div>
      <div class="field">
        <span class="field-label">Sections</span>
        <div class="section-choices">
          ${SECTIONS.map(section => `<label class="choice"><input type="checkbox" name="sections" value="${section}"> ${section}</label>`).join('')}
        </div>
      </div>
      <div class="reminder-date-time">
        <div class="field">
          <label for="reminder-date">Date</label>
          <input id="reminder-date" name="remindDate" type="date" min="${minReminderDate()}" required>
        </div>
        <div class="field">
          <span class="field-label">Time</span>
          <div class="reminder-time-inputs">
            <div class="reminder-time-part">
              <label for="reminder-hour">Hour</label>
              <input id="reminder-hour" name="remindHour" type="number" min="1" max="12" step="1" inputmode="numeric" placeholder="09" required>
            </div>
            <span class="reminder-time-separator" aria-hidden="true">:</span>
            <div class="reminder-time-part">
              <label for="reminder-minute">Minute</label>
              <input id="reminder-minute" name="remindMinute" type="number" min="0" max="59" step="1" inputmode="numeric" placeholder="30" required>
            </div>
            <div class="reminder-time-part">
              <label for="reminder-period">AM/PM</label>
              <select id="reminder-period" name="remindPeriod" required>
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
          </div>
        </div>
      </div>
      <div class="form-actions">
        <button class="button button-primary" type="submit">Set reminder</button>
      </div>
    </form>
    <section class="reminders-section">
      <h2>Upcoming and due <span>${pending.length}</span></h2>
      ${pending.length ? `<div class="reminder-list">${pending.map(reminderCard).join('')}</div>` : '<div class="panel empty-reminders">No pending reminders. Add one above when you have notes to upload.</div>'}
    </section>
    ${completed.length ? `
      <section class="reminders-section completed-reminders">
        <h2>Completed <span>${completed.length}</span></h2>
        <div class="reminder-list">${completed.map(reminderCard).join('')}</div>
      </section>
    ` : ''}
  `;
}

function reminderCard(reminder) {
  const course = courseByCode(reminder.courseCode);
  const completed = Boolean(reminder.completedAt);
  const due = !completed && new Date(reminder.remindAt).getTime() <= Date.now();

  return `
    <article class="panel reminder-card ${completed ? 'completed' : ''}">
      <div>
        <strong>${esc(course?.title || reminder.subject)}</strong>
        <div class="reminder-details">${esc(reminder.unit || '')} · ${esc((reminder.sections || []).join(', '))}</div>
        <div class="reminder-details">${esc(reminder.semester)} · ${esc(reminder.type)} · ${new Date(reminder.remindAt).toLocaleString()}</div>
        ${due ? '<span class="reminder-due">Due now</span>' : ''}
      </div>
      <div class="reminder-actions">
        ${completed ? '<span>Done</span>' : `<button class="button button-light button-small" data-reminder-done="${reminder.id}">Mark done</button>`}
        <button class="button button-light button-small" data-reminder-delete="${reminder.id}">Remove</button>
      </div>
    </article>
  `;
}

function minReminderDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function sidebar() {
  const isFaculty = user.role === 'faculty';
  const expanded = view.sidebarOpen;
  const link = (icon, label, action, active = false) => `
    <button class="side-link ${active ? 'active' : ''}" data-side-action="${action}" title="${label}">
      <span class="side-icon">${icon}</span>
      <span class="side-label">${label}</span>
    </button>
  `;
  let children = '';

  if (!isFaculty && expanded && view.sidebarMenu === 'semesters') {
    children = `
      <div class="side-submenu">
        ${SEMESTERS.map(semester => `
          <button class="side-sub-link ${view.semester === semester ? 'selected' : ''}" data-side-semester="${semester}">
            ${semester}
          </button>
        `).join('')}
      </div>
    `;
  }

  if (!isFaculty && expanded && view.sidebarMenu === 'sections') {
    children = `
      <div class="side-submenu">
        ${SECTIONS.map(section => `
          <button class="side-sub-link ${view.section === section ? 'selected' : ''}" data-side-section="${section}">
            ${section}
          </button>
        `).join('')}
      </div>
    `;
  }

  if (!isFaculty && expanded && view.sidebarMenu === 'subjects') {
    children = `
      <div class="side-submenu">
        ${coursesFor(view.semester).map((course, index) => `
          <button class="side-sub-link ${view.courseCode === course.code ? 'selected' : ''}" data-side-subject="${course.code}">
            <span class="mini-subject-icon">${ICONS[index % ICONS.length]}</span>
            <span class="side-subject-name">${esc(course.sidebarTitle || course.title)}</span>
          </button>
        `).join('')}
      </div>
    `;
  }

  return `
    <aside class="sidebar ${expanded ? 'expanded' : ''}" aria-label="Main navigation">
      <button class="side-link sidebar-toggle" data-side-action="toggle"
        aria-label="${expanded ? 'Collapse' : 'Expand'} navigation"
        aria-expanded="${expanded}"
        title="${expanded ? 'Collapse' : 'Expand'} navigation">
        <span class="side-icon">${expanded ? '‹' : '☰'}</span>
      </button>
      ${link('⌂', 'Home', 'home', !view.subject && (!isFaculty ? view.studentTab === 'browse' && view.sidebarMenu === null : view.facultyTab === 'browse'))}
      ${isFaculty
        ? `${link('▤', view.myUploadsOnly ? 'All uploads' : 'My uploads', 'my-uploads', view.myUploadsOnly)}
           ${link('◷', 'Reminders', 'reminders', view.facultyTab === 'reminders')}
           ${link('＋', 'Upload notes', 'upload', view.facultyTab === 'upload')}`
        : `${link('◷', 'Semester', 'semesters', view.sidebarMenu === 'semesters')}
           ${view.sidebarMenu === 'semesters' ? children : ''}
           ${link('◉', 'Sections', 'sections', view.sidebarMenu === 'sections')}
           ${view.sidebarMenu === 'sections' ? children : ''}
           ${link('▥', 'Subjects', 'subjects', view.sidebarMenu === 'subjects')}
           ${view.sidebarMenu === 'subjects' ? children : ''}
           ${link(bookmarkIcon(), 'Saved notes', 'saved-notes', view.studentTab === 'saved')}
           ${link('↶', 'Recently viewed', 'recent-notes', view.studentTab === 'recent')}`}
    </aside>
  `;
}

function renderMain() {
  const isFaculty = user.role === 'faculty';
  app.innerHTML = `
    ${header()}
    <div class="app-layout">
      ${sidebar()}
      <main class="page">${isFaculty ? facultyView() : homeView()}</main>
    </div>
  `;
  bindMain();
}

function bindMain() {
  app.querySelector('[data-action="logout"]')?.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    user = null;
    authMode = 'login';
    authNotice = '';
    view = createInitialView();
    renderAuth();
  });

  app.querySelector('[data-side-action="toggle"]')?.addEventListener('click', () => {
    view.sidebarOpen = !view.sidebarOpen;
    if (!view.sidebarOpen) view.sidebarMenu = null;
    const sidebarElement = app.querySelector('.sidebar');
    const toggleButton = app.querySelector('[data-side-action="toggle"]');
    const icon = toggleButton?.querySelector('.side-icon');
    sidebarElement?.classList.toggle('expanded', view.sidebarOpen);
    if (toggleButton) {
      const label = `${view.sidebarOpen ? 'Collapse' : 'Expand'} navigation`;
      toggleButton.setAttribute('aria-label', label);
      toggleButton.setAttribute('aria-expanded', String(view.sidebarOpen));
      toggleButton.title = label;
    }
    if (icon) icon.textContent = view.sidebarOpen ? '‹' : '☰';
    if (!view.sidebarOpen) sidebarElement?.querySelector('.side-submenu')?.remove();
  });

  app.querySelector('[data-side-action="home"]')?.addEventListener('click', () => {
    view.subject = null;
    view.courseCode = null;
    view.editId = null;
    view.facultyTab = 'browse';
    view.studentTab = 'browse';
    view.sidebarMenu = null;
    renderMain();
  });

  app.querySelector('[data-side-action="saved-notes"]')?.addEventListener('click', () => {
    view.studentTab = 'saved';
    view.subject = null;
    view.courseCode = null;
    view.searchQuery = '';
    view.sidebarMenu = null;
    renderMain();
  });

  app.querySelector('[data-side-action="recent-notes"]')?.addEventListener('click', () => {
    view.studentTab = 'recent';
    view.subject = null;
    view.courseCode = null;
    view.searchQuery = '';
    view.noteSort = 'recent';
    view.sidebarMenu = null;
    renderMain();
  });

  app.querySelector('[data-clear-recent]')?.addEventListener('click', async () => {
    const { error } = await supabaseClient.from('recently_viewed_notes').delete().eq('student_id', user.id);
    if (error) return toast(error.message || 'Could not clear recent history.');
    const history = read(RECENT_NOTES_KEY, {});
    delete history[user.username.toLocaleLowerCase()];
    save(RECENT_NOTES_KEY, history);
    renderMain();
    toast('Recently viewed history cleared.');
  });

  app.querySelectorAll('[data-side-action="semesters"], [data-side-action="sections"], [data-side-action="subjects"]')
    .forEach(element => {
      element.onclick = () => {
        const menu = element.dataset.sideAction;
        view.sidebarOpen = true;
        view.sidebarMenu = view.sidebarMenu === menu ? null : menu;
        renderMain();
      };
    });

  app.querySelector('[data-side-action="upload"]')?.addEventListener('click', () => {
    view.facultyTab = 'upload';
    view.editId = null;
    renderMain();
  });

  app.querySelector('[data-side-action="my-uploads"]')?.addEventListener('click', () => {
    view.myUploadsOnly = !view.myUploadsOnly;
    view.facultyTab = 'browse';
    view.editId = null;
    renderMain();
  });

  app.querySelector('[data-side-action="reminders"]')?.addEventListener('click', () => {
    view.facultyTab = 'reminders';
    view.editId = null;
    renderMain();
  });

  app.querySelectorAll('[data-side-semester]').forEach(element => {
    element.onclick = () => {
      view.semester = element.dataset.sideSemester;
      view.studentTab = 'browse';
      view.subject = null;
      view.courseCode = null;
      view.courseTypeFilter = 'all';
      view.sidebarMenu = null;
      renderMain();
    };
  });

  app.querySelectorAll('[data-side-section]').forEach(element => {
    element.onclick = () => {
      view.section = element.dataset.sideSection;
      view.studentTab = 'browse';
      view.subject = null;
      view.courseCode = null;
      view.sidebarMenu = null;
      renderMain();
    };
  });

  app.querySelectorAll('[data-side-subject]').forEach(element => {
    element.onclick = () => selectCourse(element.dataset.sideSubject);
  });

  app.querySelector('#semester-select')?.addEventListener('change', event => {
    view.semester = event.target.value;
    view.studentTab = 'browse';
    view.subject = null;
    view.courseCode = null;
    view.courseTypeFilter = 'all';
    renderMain();
  });

  app.querySelector('#section-select')?.addEventListener('change', event => {
    view.section = event.target.value;
    view.studentTab = 'browse';
    view.subject = null;
    view.courseCode = null;
    renderMain();
  });

  app.querySelectorAll('[data-course-filter]').forEach(element => {
    element.onclick = () => {
      view.courseTypeFilter = element.dataset.courseFilter;
      renderMain();
    };
  });

  app.querySelectorAll('[data-unit-filter]').forEach(button => {
    button.onclick = () => {
      view.unitFilter = button.dataset.unitFilter;
      renderMain();
    };
  });

  app.querySelectorAll('[data-subject]').forEach(element => {
    element.onclick = () => selectCourse(element.dataset.subject);
  });

  app.querySelectorAll('[data-save-note]').forEach(button => {
    button.onclick = () => toggleSavedNote(button.dataset.saveNote);
  });

  app.querySelector('[data-action="back"]')?.addEventListener('click', () => {
    view.subject = null;
    view.courseCode = null;
    renderMain();
  });

  app.querySelectorAll('[data-tab]').forEach(element => {
    element.onclick = () => {
      view.facultyTab = element.dataset.tab;
      view.editId = null;
      renderMain();
    };
  });

  app.querySelector('#filter-section')?.addEventListener('change', event => {
    view.filterSection = event.target.value;
    renderMain();
  });
  app.querySelector('#filter-semester')?.addEventListener('change', event => {
    view.filterSemester = event.target.value;
    renderMain();
  });
  app.querySelector('#filter-type')?.addEventListener('change', event => {
    view.filterType = event.target.value;
    renderMain();
  });
  app.querySelector('#notes-search-form')?.addEventListener('submit', event => {
    event.preventDefault();
    view.searchQuery = app.querySelector('#notes-search').value.trim();
    renderMain();
  });
  app.querySelector('#notes-search')?.addEventListener('input', event => {
    const input = event.currentTarget;
    const cursorPosition = input.selectionStart;
    view.searchQuery = input.value;
    renderMain();

    const refreshedInput = app.querySelector('#notes-search');
    refreshedInput?.focus();
    if (cursorPosition !== null) {
      refreshedInput?.setSelectionRange(cursorPosition, cursorPosition);
    }
  });
  app.querySelector('[data-clear-search]')?.addEventListener('click', () => {
    view.searchQuery = '';
    renderMain();
  });
  app.querySelector('[data-note-sort]')?.addEventListener('change', event => {
    view.noteSort = event.target.value;
    renderMain();
  });

  app.querySelectorAll('[data-open]').forEach(element => {
    element.onclick = () => openNote(element.dataset.open);
  });
  app.querySelectorAll('[data-preview]').forEach(element => {
    element.onclick = () => previewNote(element.dataset.preview);
  });
  app.querySelectorAll('[data-edit]').forEach(element => {
    element.onclick = () => {
      const note = notes().find(item => item.id === element.dataset.edit);
      if (!canManageNote(note)) return toast('Only the faculty member who uploaded this note can edit it.');
      view.editId = element.dataset.edit;
      view.facultyTab = 'upload';
      renderMain();
    };
  });
  app.querySelectorAll('[data-delete]').forEach(element => {
    element.onclick = () => confirmDelete(element.dataset.delete);
  });

  app.querySelector('#upload-form')?.addEventListener('submit', submitNote);
  app.querySelector('#upload-semester')?.addEventListener('change', refreshCourseOptions);
  app.querySelector('#upload-type')?.addEventListener('change', refreshCourseOptions);
  app.querySelector('#reminder-form')?.addEventListener('submit', submitReminder);
  app.querySelector('#reminder-semester')?.addEventListener('change', refreshReminderCourseOptions);
  app.querySelector('#reminder-type')?.addEventListener('change', refreshReminderCourseOptions);
  app.querySelector('[data-enable-reminder-notifications]')?.addEventListener('click', enableReminderNotifications);
  app.querySelectorAll('[data-reminder-done]').forEach(button => {
    button.addEventListener('click', () => completeReminder(button.dataset.reminderDone));
  });
  app.querySelectorAll('[data-reminder-delete]').forEach(button => {
    button.addEventListener('click', () => deleteReminder(button.dataset.reminderDelete));
  });
}

function selectCourse(code) {
  const course = courseByCode(code);
  view.studentTab = 'browse';
  view.courseCode = course?.code || null;
  view.subject = course?.title || null;
  view.sidebarMenu = null;
  view.unitFilter = 'all';
  renderMain();
}

function refreshCourseOptions() {
  const semester = app.querySelector('#upload-semester').value;
  const type = app.querySelector('#upload-type').value;
  const select = app.querySelector('#upload-course');
  select.innerHTML = courseOptions(semester, type);
}

function refreshReminderCourseOptions() {
  const semester = app.querySelector('#reminder-semester').value;
  const type = app.querySelector('#reminder-type').value;
  view.reminderSemester = semester;
  view.reminderType = type;
  app.querySelector('#reminder-course').innerHTML = courseOptions(semester, type);
}

async function enableReminderNotifications() {
  if (typeof Notification === 'undefined') {
    return toast('Browser alerts are not supported here. Reminders will appear in Notely while it is open.');
  }
  try {
    const permission = await Notification.requestPermission();
    renderMain();
    toast(permission === 'granted'
      ? 'Browser alerts enabled.'
      : 'Browser alerts were not enabled. Reminders will still appear in Notely while it is open.');
  } catch (error) {
    console.error('Could not request notification permission:', error);
    toast('Browser alerts are unavailable here. Reminders will still appear in Notely while it is open.');
  }
}

const sectionIds = sections => sections.map(section => String(section).slice(-1));
const noteSectionRows = (noteId, sections) => sectionIds(sections)
  .map(sectionId => ({ note_id: noteId, section_id: sectionId }));

async function removeStoredNoteFile(storagePath) {
  if (!storagePath) return;
  const { error } = await supabaseClient.storage.from('notely-notes').remove([storagePath]);
  if (error) throw error;
}

async function submitReminder(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const course = courseByCode(data.get('courseCode'));
  const sections = [...form.querySelectorAll('[name="sections"]:checked')]
    .map(input => input.value);
  const dateValue = String(data.get('remindDate') || '');
  const [year, month, day] = dateValue.split('-').map(Number);
  const hour12 = Number(data.get('remindHour'));
  const minute = Number(data.get('remindMinute'));
  const period = data.get('remindPeriod');
  const hour24 = (hour12 % 12) + (period === 'PM' ? 12 : 0);
  const remindAt = new Date(year, month - 1, day, hour24, minute, 0, 0);
  const validDate = year && month >= 1 && month <= 12 && day >= 1 &&
    new Date(year, month - 1, day).getDate() === day;

  if (!course) return toast('Choose a subject for this reminder.');
  if (!sections.length) return toast('Choose at least one section.');
  const subjectId = backendSubjectByCode.get(course.code);
  if (!subjectId) return toast('Could not find this subject in the database. Refresh and try again.');
  if (!validDate || !Number.isInteger(hour12) || hour12 < 1 || hour12 > 12 ||
      !Number.isInteger(minute) || minute < 0 || minute > 59 || !['AM', 'PM'].includes(period) ||
      Number.isNaN(remindAt.getTime()) || remindAt.getTime() <= Date.now()) {
    return toast('Choose a reminder time in the future.');
  }

  const { data: reminder, error } = await supabaseClient.from('upload_reminders').insert({
    faculty_id: user.id,
    subject_id: subjectId,
    unit_label: String(data.get('unit') || '').trim(),
    remind_at: remindAt.toISOString()
  }).select('id').single();
  if (error) return toast(error.message || 'Could not create the reminder.');

  const { error: sectionError } = await supabaseClient.from('reminder_sections').insert(
    sections.map(section => ({ reminder_id: reminder.id, section_id: section.slice(-1) }))
  );
  if (sectionError) {
    await supabaseClient.from('upload_reminders').delete().eq('id', reminder.id);
    return toast(sectionError.message || 'Could not save reminder sections.');
  }

  try {
    await loadBackendData();
    renderMain();
    toast('Upload reminder set.');
  } catch (error) {
    console.error('Could not refresh reminders:', error);
    toast('Reminder was saved, but the list could not refresh.');
  }
}

async function completeReminder(id) {
  const { error } = await supabaseClient.from('upload_reminders')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', id).eq('faculty_id', user.id);
  if (error) return toast(error.message || 'Could not update the reminder.');
  try {
    await loadBackendData();
    renderMain();
    toast('Reminder marked complete.');
  } catch (refreshError) {
    console.error('Could not refresh reminders:', refreshError);
    toast('Reminder updated, but the list could not refresh.');
  }
}

async function deleteReminder(id) {
  if (!window.confirm('Remove this upload reminder?')) return;
  const { error } = await supabaseClient.from('upload_reminders').delete()
    .eq('id', id).eq('faculty_id', user.id);
  if (error) return toast(error.message || 'Could not remove the reminder.');
  try {
    await loadBackendData();
    renderMain();
    toast('Reminder removed.');
  } catch (refreshError) {
    console.error('Could not refresh reminders:', refreshError);
    toast('Reminder removed, but the list could not refresh.');
  }
}

async function checkDueReminders() {
  if (user?.role !== 'faculty') return;
  const allReminders = read(REMINDERS_KEY, []);
  const now = Date.now();
  const due = allReminders.filter(reminder => (
    reminder.facultyId === user.id &&
    !reminder.completedAt &&
    !reminder.notifiedAt &&
    new Date(reminder.remindAt).getTime() <= now
  ));
  if (!due.length) return;

  const notifiedAt = new Date().toISOString();
  const { error } = await supabaseClient.from('upload_reminders')
    .update({ notified_at: notifiedAt }).in('id', due.map(reminder => reminder.id));
  if (error) {
    console.error('Could not mark reminders notified:', error);
    return;
  }
  due.forEach(reminder => { reminder.notifiedAt = notifiedAt; });
  save(REMINDERS_KEY, allReminders);
  if (due.length > 1 && !(typeof Notification !== 'undefined' && Notification.permission === 'granted')) {
    toast(`${due.length} upload reminders are due. Open Reminders to see them.`);
    return;
  }
  due.forEach(reminder => {
    const message = `Upload ${reminder.unit} notes for ${reminder.subject} (${(reminder.sections || []).join(', ')}).`;
    if (!(typeof Notification !== 'undefined' && Notification.permission === 'granted')) {
      toast(`Reminder: ${message}`);
    }
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification('Notely upload reminder', { body: message });
    }
  });
}

async function submitNote(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const data = new FormData(form);
  const selectedSections = [...form.querySelectorAll('[name="sections"]:checked')]
    .map(element => element.value);
  const course = courseByCode(data.get('courseCode'));
  const subjectId = backendSubjectByCode.get(course?.code);

  if (!selectedSections.length) {
    return toast('Choose at least one section.');
  }
  if (!course) {
    return toast('Choose a course from the selected semester and type.');
  }
  if (!subjectId) return toast('Could not find this subject in the database. Refresh and try again.');

  const file = form.querySelector('[name="file"]').files[0];
  const existing = view.editId ? notes().find(note => note.id === view.editId) : null;
  if (view.editId && !canManageNote(existing)) {
    return toast('Only the faculty member who uploaded this note can edit it.');
  }
  if (!existing && !file) return toast('Choose a file to publish.');
  const id = existing?.id || crypto.randomUUID();
  const oldStoragePath = existing?.storagePath || '';
  let newStoragePath = oldStoragePath;
  let noteRowSaved = false;

  try {
    if (file) {
      const safeFileName = file.name.replace(/[^A-Za-z0-9._-]+/g, '_').slice(-120) || 'note-file';
      newStoragePath = `${user.id}/${id}/${crypto.randomUUID()}_${safeFileName}`;
      const { error: uploadError } = await supabaseClient.storage.from('notely-notes').upload(newStoragePath, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: false
      });
      if (uploadError) throw uploadError;
    }

    const record = {
      uploaded_by: user.id,
      subject_id: subjectId,
      unit_label: String(data.get('unit') || '').trim(),
      title: String(data.get('title') || '').trim(),
      file_name: file?.name || existing?.fileName,
      storage_path: newStoragePath,
      mime_type: file?.type || existing?.mimeType || null,
      file_size_bytes: file?.size ?? existing?.fileSizeBytes ?? null,
      uploader_name: user.facultyName || user.username,
      updated_at: new Date().toISOString()
    };

    let noteError;
    if (existing) {
      ({ error: noteError } = await supabaseClient.from('notes').update(record)
        .eq('id', id).eq('uploaded_by', user.id));
    } else {
      ({ error: noteError } = await supabaseClient.from('notes').insert({ id, ...record }));
    }
    if (noteError) throw noteError;
    noteRowSaved = true;

    const { error: clearSectionsError } = await supabaseClient.from('note_sections').delete().eq('note_id', id);
    if (clearSectionsError) throw clearSectionsError;
    const { error: sectionError } = await supabaseClient.from('note_sections').insert(noteSectionRows(id, selectedSections));
    if (sectionError) throw sectionError;

    if (oldStoragePath && oldStoragePath !== newStoragePath) {
      try {
        await removeStoredNoteFile(oldStoragePath);
      } catch (cleanupError) {
        console.warn('Updated note but could not remove its previous file:', cleanupError);
      }
    }

    await loadBackendData();
    view.editId = null;
    view.facultyTab = 'browse';
    view.filterSection = 'all';
    view.filterSemester = 'all';
    view.filterType = 'all';
    renderMain();
    toast(existing ? 'Note updated.' : 'Note published.');
  } catch (error) {
    console.error('Could not publish note:', error);
    if (!existing && noteRowSaved) {
      await supabaseClient.from('notes').delete().eq('id', id).eq('uploaded_by', user.id);
    }
    if (existing && noteRowSaved) {
      const oldSubjectId = backendSubjectByCode.get(existing.courseCode);
      if (oldSubjectId) {
        await supabaseClient.from('notes').update({
          uploaded_by: user.id,
          subject_id: oldSubjectId,
          unit_label: existing.unit,
          title: existing.title,
          file_name: existing.fileName,
          storage_path: oldStoragePath,
          mime_type: existing.mimeType || null,
          file_size_bytes: existing.fileSizeBytes ?? null,
          uploader_name: existing.uploader,
          updated_at: existing.updated || existing.created
        }).eq('id', id).eq('uploaded_by', user.id);
        await supabaseClient.from('note_sections').delete().eq('note_id', id);
        if (existing.sections?.length) {
          await supabaseClient.from('note_sections').insert(noteSectionRows(id, existing.sections));
        }
      }
    }
    if (file && newStoragePath && newStoragePath !== oldStoragePath) {
      try { await removeStoredNoteFile(newStoragePath); } catch (cleanupError) {
        console.warn('Could not remove an incomplete uploaded file:', cleanupError);
      }
    }
    toast(error.message || 'Could not save the note. Please check your connection and try again.');
  }
}

function previewKind(fileName) {
  const extension = String(fileName || '').split('.').pop().toLocaleLowerCase();
  if (extension === 'pdf') return 'pdf';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'avif'].includes(extension)) return 'image';
  if (extension === 'java') return 'text';
  return null;
}

async function getNoteBlob(item) {
  if (item.storagePath) {
    const { data, error } = await supabaseClient.storage.from('notely-notes').download(item.storagePath);
    if (error) throw error;
    return data;
  }
  let blob = await getUpload(item.id);
  if (!blob && item.fileData) {
    const response = await fetch(item.fileData);
    blob = await response.blob();
  }
  return blob;
}

function downloadNoteFile(item, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = item.fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function openNote(id) {
  const item = notes().find(note => note.id === id);
  if (!item) return;

  try {
    const blob = await getNoteBlob(item);
    if (!blob) return toast('The stored file for this note is missing. It may need to be uploaded again.');
    await recordNoteView(item);
    downloadNoteFile(item, blob);
  } catch (error) {
    console.error('Could not download note:', error);
    toast('Could not download this file from browser storage.');
  }
}

async function previewNote(id) {
  const item = notes().find(note => note.id === id);
  if (!item) return;
  const kind = previewKind(item.fileName);
  if (!kind) return toast('Preview isn’t available for this file type. Use Download to open it.');

  try {
    let blob = await getNoteBlob(item);
    if (!blob) return toast('The stored file for this note is missing. It may need to be uploaded again.');
    await recordNoteView(item);

    const previewMime = kind === 'pdf' ? 'application/pdf' : blob.type;
    if (kind === 'pdf' && blob.type !== 'application/pdf') {
      blob = new Blob([blob], { type: previewMime });
    }

    const url = URL.createObjectURL(blob);
    const content = kind === 'pdf'
      ? `<iframe class="preview-frame" src="${url}" title="Preview of ${esc(item.title)}"></iframe>`
      : kind === 'image'
        ? `<img class="preview-image" src="${url}" alt="Preview of ${esc(item.title)}">`
        : `<pre class="preview-text">${esc(await blob.text())}</pre>`;
    const modal = document.createElement('div');
    modal.className = 'preview-modal';
    modal.innerHTML = `
      <section class="preview-dialog" role="dialog" aria-modal="true" aria-label="Note preview">
        <header class="preview-header">
          <div class="preview-heading">
            <strong>${esc(item.title)}</strong>
            <span>${esc(item.fileName)}</span>
          </div>
          <div class="preview-actions">
            <button class="button button-light button-small" data-preview-download>Download</button>
            <button class="button button-light button-small" data-preview-close aria-label="Close preview">Close</button>
          </div>
        </header>
        <div class="preview-content">${content}</div>
      </section>
    `;
    document.body.appendChild(modal);

    const close = () => {
      modal.remove();
      URL.revokeObjectURL(url);
      document.removeEventListener('keydown', onKeyDown);
    };
    const onKeyDown = event => {
      if (event.key === 'Escape') close();
    };
    modal.querySelector('[data-preview-close]').addEventListener('click', close);
    modal.querySelector('[data-preview-download]').addEventListener('click', () => downloadNoteFile(item, blob));
    modal.querySelector('.preview-image')?.addEventListener('error', () => {
      modal.querySelector('.preview-content').innerHTML = `
        <div class="empty preview-error">
          <div class="empty-icon">!</div>
          <strong>Image preview couldn’t be opened</strong>
          <div class="empty-hint">The file may be damaged. Try downloading it to check.</div>
          <button class="button button-primary button-small" data-preview-download-error>Download file</button>
        </div>
      `;
      modal.querySelector('[data-preview-download-error]')?.addEventListener('click', () => downloadNoteFile(item, blob));
    }, { once: true });
    modal.addEventListener('click', event => {
      if (event.target === modal) close();
    });
    document.addEventListener('keydown', onKeyDown);
    modal.querySelector('[data-preview-close]').focus();
  } catch (error) {
    console.error('Could not preview note:', error);
    toast('Could not preview this file from browser storage.');
  }
}

function confirmDelete(id) {
  const item = notes().find(note => note.id === id);
  if (!item) return;
  if (!canManageNote(item)) return toast('Only the faculty member who uploaded this note can delete it.');

  const modal = document.createElement('div');
  modal.className = 'confirm-modal';
  modal.innerHTML = `
    <div class="confirm-box">
      <h3>Delete this note?</h3>
      <p><strong>${esc(item.title)}</strong> will be removed from the library. This action cannot be undone.</p>
      <div class="confirm-actions">
        <button class="button button-light" data-cancel>Keep note</button>
        <button class="button button-danger" data-confirm>Delete note</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector('[data-cancel]').onclick = () => modal.remove();
  modal.onclick = event => {
    if (event.target === modal) modal.remove();
  };
  modal.querySelector('[data-confirm]').onclick = async () => {
    try {
      const { error } = await supabaseClient.from('notes').delete()
        .eq('id', id).eq('uploaded_by', user.id);
      if (error) throw error;
      let fileCleanupFailed = false;
      try {
        await removeStoredNoteFile(item.storagePath);
      } catch (cleanupError) {
        fileCleanupFailed = true;
        console.warn('Note deleted but its stored file could not be removed:', cleanupError);
      }
      await loadBackendData();
      modal.remove();
      renderMain();
      toast(fileCleanupFailed ? 'Note deleted. Its file may need cleanup in Storage.' : 'Note deleted.');
    } catch (error) {
      console.error('Could not delete note:', error);
      modal.remove();
      toast(error.message || 'Could not delete the note. Try again.');
    }
  };
}

function startNotely() {
  const intro = document.createElement('div');
  intro.className = 'notely-intro';
  intro.setAttribute('role', 'status');
  intro.setAttribute('aria-label', 'Notely is loading');
  intro.innerHTML = `
    <div class="notely-intro-brand">
      <span class="notely-intro-mark" aria-hidden="true">✦</span>
      <span>Notely</span>
    </div>
  `;
  document.body.appendChild(intro);

  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  window.setTimeout(async () => {
    intro.remove();
    await render();
    checkDueReminders();
    setInterval(checkDueReminders, 30_000);
  }, reducedMotion ? 100 : 1750);
}

startNotely();
