// ══════════════════════════════════════════════════════════════
// JEIPYFIT IA — Enterprise Edition  |  app.js
// ══════════════════════════════════════════════════════════════

// ── STATE ──
const A = {
  screen: 0,
  obj: [], tipo: [], dieta: '', days: [],
  plan: null, user: null,
  histFilter: 'all', notaTipo: 'not',
  history: [], weights: [], measures: {},
  weekLog: {}, sessions: 0,
  editing: { type: '', day: '', idx: 0, cur: '' },
  chatHistory: [],
  photos: [],
  chartRange: 7,
  // Onboarding wizard state
  wizard: { active: false, step: 0, answers: {}, msgs: [], loading: false },
  // Settings
  settings: { unit: 'kg', reminders: false, remTime: '08:00' }
};

// ── PERSISTENCIA ──
function saveState() {
  const s = {
    user: A.user, plan: A.plan, weights: A.weights,
    weekLog: A.weekLog, sessions: A.sessions, history: A.history,
    days: A.days, obj: A.obj, tipo: A.tipo, dieta: A.dieta,
    measures: A.measures, photos: A.photos, settings: A.settings
  };
  try { localStorage.setItem('jeipyfit_v2', JSON.stringify(s)); } catch(e) { showToast('Error guardando datos', 'error'); }
}

function loadState() {
  const saved = localStorage.getItem('jeipyfit_v2') || localStorage.getItem('jeipyfit_state');
  if (!saved) return;
  try {
    const p = JSON.parse(saved);
    Object.assign(A, p);
    if (A.settings) applySettings();
    if (A.plan) {
      document.getElementById('nav').style.display = 'flex';
      document.getElementById('settingsBtn').style.display = 'flex';
      go(5); renderPlan(); MT('plan');
    }
    renderMeasureCards();
    renderPhotos();
  } catch(e) { console.error('Rehidratación fallida', e); }
}

function applySettings() {
  if (!A.settings) A.settings = { unit: 'kg', reminders: false, remTime: '08:00' };
  const remToggle = document.getElementById('remToggle');
  const remTimeRow = document.getElementById('remTimeRow');
  const remTime = document.getElementById('remTime');
  if (remToggle) remToggle.checked = A.settings.reminders;
  if (remTimeRow) remTimeRow.style.display = A.settings.reminders ? 'flex' : 'none';
  if (remTime) remTime.value = A.settings.remTime;
  document.querySelectorAll('.seg').forEach(s => {
    s.classList.toggle('on', s.textContent === A.settings.unit);
  });
}

// ── NAV ──
function go(n) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('on'));
  document.getElementById('s' + n).classList.add('on');
  A.screen = n;
  const showNav = n >= 5;
  document.getElementById('nav').style.display = showNav ? 'flex' : 'none';
  document.getElementById('settingsBtn').style.display = showNav ? 'flex' : 'none';
  window.scrollTo(0, 0);
}

function MT(t) {
  ['plan','prog','hist','ai'].forEach((p, i) => {
    document.getElementById('mp-' + p)?.classList.toggle('on', p === t);
    document.getElementById('np' + i)?.classList.toggle('on', p === t);
  });
  if (t === 'prog') renderProg();
  if (t === 'hist') renderHist();
  if (t === 'ai' && A.chatHistory.length === 0) initChat();
}

// ── FORM CHIPS ──
function SC(el, g) {
  document.querySelectorAll('#' + g + 'C .chip').forEach(c => c.classList.remove('on'));
  el.classList.add('on'); A[g] = el.dataset.v;
  const hid = document.getElementById(g);
  if (hid) hid.value = el.dataset.v;
}
function TC(el, g) {
  el.classList.toggle('on');
  const val = el.dataset.v;
  if (el.classList.contains('on')) A[g].push(val);
  else A[g] = A[g].filter(x => x !== val);
}
function TD(el) {
  el.classList.toggle('on');
  const d = el.dataset.d;
  if (el.classList.contains('on')) A.days.push(d);
  else A.days = A.days.filter(x => x !== d);
}
function V(f, t) {
  const e = document.getElementById('e' + f); e.style.display = 'none';
  if (f === 1 && (!v('edad') || !v('peso') || !v('altura') || !v('sexo') || !v('actividad'))) { e.style.display='block'; return; }
  if (f === 2 && (!A.obj.length || !A.tipo.length || !A.days.length || !v('dur') || !v('exp'))) { e.style.display='block'; return; }
  if (f === 3 && (!A.dieta || !v('comidas'))) { e.style.display='block'; return; }
  go(t);
}
const v = id => (document.getElementById(id)||{}).value || '';

// ══════════════════════════════════════════════════════════════
// ── WIZARD CONVERSACIONAL IA (Onboarding Mixto) ──
// ══════════════════════════════════════════════════════════════

const WIZARD_QUESTIONS = [
  {
    id: 'rutina_previa',
    ask: (u) => `Perfecto ${u.sexo === 'Hombre' ? '💪' : '✨'}, ya tengo tus datos básicos. Para afinar el plan al máximo, necesito conocerte mejor.\n\n¿Seguías alguna rutina de entrenamiento antes? Si es así, ¿cuál era (PPL, torso/pierna, fullbody, etc.)?`,
    key: 'rutina_previa'
  },
  {
    id: 'horario',
    ask: () => `Entendido. ¿A qué hora del día sueles entrenar normalmente? (mañana, tarde, noche) — y ¿tienes alguna limitación de tiempo entre semana?`,
    key: 'horario_entreno'
  },
  {
    id: 'historial_dieta',
    ask: () => `Genial. ¿Has seguido alguna dieta o protocolo nutricional antes? ¿Hubo algo que te funcionó especialmente bien o mal?`,
    key: 'historial_dieta'
  },
  {
    id: 'motivacion',
    ask: () => `Casi lo tenemos. Por último: ¿qué te ha impedido conseguir tus objetivos en el pasado? ¿Falta de constancia, viajes frecuentes, trabajo exigente, lesiones...?`,
    key: 'barreras'
  }
];

function startWizard() {
  // Recopilar datos del formulario primero
  A.user = buildUserObj();
  if (!A.user) return;

  A.wizard = {
    active: true,
    step: 0,
    answers: {},
    msgs: [],
    loading: false
  };

  go(6);
  renderWizard();
  // Lanzar primera pregunta IA
  setTimeout(() => wizardAsk(0), 400);
}

function buildUserObj() {
  return {
    edad: v('edad'), peso: v('peso'), altura: v('altura'), sexo: v('sexo'),
    actividad: v('actividad'), grasa: document.getElementById('gr')?.value || '20',
    lesiones: v('lesiones') || 'ninguna',
    obj: A.obj.join(', '), tipo: A.tipo.join(', '),
    dias: A.days.join(', '), dur: v('dur'), exp: v('exp'),
    dieta: A.dieta, gusta: v('gusta') || 'variado',
    nogusta: v('nogusta') || 'ninguno', comidas: v('comidas'),
    presu: v('presu') || 'moderado',
    split: v('split') || 'A criterio del entrenador',
    equipo: v('equipo') || 'Gimnasio comercial completo',
    estres: v('estres') || 'Normal',
    pesoMeta: v('pesoMeta') || null,
    plazoMeta: v('plazoMeta') || null
  };
}

function renderWizard() {
  const cw = document.getElementById('wizardWindow');
  if (!cw) return;
  cw.innerHTML = A.wizard.msgs.map(m => `
    <div class="chat-msg ${m.role === 'user' ? 'user' : 'ai'}">
      <div class="chat-avatar">${m.role === 'user' ? '👤' : '🤖'}</div>
      <div class="chat-bubble">${renderMarkdown(m.content)}</div>
    </div>`).join('');
  cw.scrollTop = cw.scrollHeight;

  // Actualizar progress del wizard
  const pct = Math.round((A.wizard.step / WIZARD_QUESTIONS.length) * 100);
  const progressEl = document.getElementById('wizardProgress');
  if (progressEl) progressEl.style.width = pct + '%';

  const stepEl = document.getElementById('wizardStep');
  if (stepEl) stepEl.textContent = `Pregunta ${A.wizard.step + 1} / ${WIZARD_QUESTIONS.length}`;
}

function wizardAsk(stepIdx) {
  if (stepIdx >= WIZARD_QUESTIONS.length) {
    wizardFinish();
    return;
  }
  const q = WIZARD_QUESTIONS[stepIdx];
  const msg = q.ask(A.user);
  A.wizard.msgs.push({ role: 'ai', content: msg });
  renderWizard();

  // Mostrar opciones rápidas si las hay
  renderWizardOptions(stepIdx);
}

function renderWizardOptions(stepIdx) {
  const opts = {
    0: ['Sí, hacía PPL', 'Fullbody 3 días', 'Torso / Pierna', 'No tenía rutina fija'],
    1: ['Mañana (6-9h)', 'Mediodía (12-14h)', 'Tarde (17-20h)', 'Noche (+20h)'],
    2: ['Dieta flexible / IIFYM', 'Keto o low-carb', 'Déficit calórico simple', 'Ninguna antes'],
    3: ['Falta de tiempo', 'Poco apoyo / motivación', 'Lesiones recurrentes', 'Viajes / trabajo']
  };
  const container = document.getElementById('wizardQuickOpts');
  if (!container) return;
  const options = opts[stepIdx] || [];
  container.innerHTML = options.map(o =>
    `<button class="wizard-opt" onclick="wizardQuickAnswer('${o}')">${o}</button>`
  ).join('');
}

async function wizardSend() {
  const input = document.getElementById('wizardInput');
  const text = input?.value.trim();
  if (!text || A.wizard.loading) return;
  input.value = '';
  await wizardProcessAnswer(text);
}

function wizardInputKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); wizardSend(); }
}

async function wizardQuickAnswer(text) {
  await wizardProcessAnswer(text);
}

async function wizardProcessAnswer(text) {
  const step = A.wizard.step;
  if (step >= WIZARD_QUESTIONS.length) return;

  // Guardar respuesta
  A.wizard.answers[WIZARD_QUESTIONS[step].key] = text;
  A.wizard.msgs.push({ role: 'user', content: text });
  A.wizard.step++;
  A.wizard.loading = true;

  // Limpiar opciones
  const optsEl = document.getElementById('wizardQuickOpts');
  if (optsEl) optsEl.innerHTML = '';

  renderWizard();

  // Pequeña pausa natural
  await new Promise(r => setTimeout(r, 600));
  A.wizard.loading = false;

  if (A.wizard.step < WIZARD_QUESTIONS.length) {
    wizardAsk(A.wizard.step);
  } else {
    wizardFinish();
  }
}

async function wizardFinish() {
  A.wizard.msgs.push({
    role: 'ai',
    content: `¡Perfecto! Tengo todo lo que necesito. 🚀\n\nAhora voy a generar tu plan **100% personalizado** con toda esta información. ¡Esto va a ser diferente a todo lo que hayas probado antes!`
  });
  renderWizard();

  // Deshabilitar input
  const inp = document.getElementById('wizardInput');
  if (inp) inp.disabled = true;
  const btn = document.getElementById('wizardSendBtn');
  if (btn) btn.disabled = true;
  const optsEl = document.getElementById('wizardQuickOpts');
  if (optsEl) optsEl.innerHTML = '';

  // Enriquecer datos del usuario con respuestas del wizard
  A.user = { ...A.user, ...A.wizard.answers };

  await new Promise(r => setTimeout(r, 1200));
  await GEN(true); // true = ya tenemos A.user listo
}

// ══════════════════════════════════════════════════════════════
// ── GROQ API ──
// ══════════════════════════════════════════════════════════════

async function callGroq(apiKey, prompt, maxTokens = 3800, maxRetries = 2) {
  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: 'Preparador físico élite. SIEMPRE responde con JSON minificado estricto, sin texto extra.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: maxTokens,
          response_format: { type: 'json_object' }
        })
      });
      if (!r.ok) {
        const err = await r.json();
        if (r.status === 429) throw new Error('RATE_LIMIT');
        if (r.status === 401) { localStorage.removeItem('jeipyfit_groq_key'); throw new Error('invalid_api_key'); }
        throw new Error(err.error?.message || `HTTP ${r.status}`);
      }
      return (await r.json()).choices[0].message.content.trim();
    } catch (error) {
      if (attempt === maxRetries) throw new Error(
        error.message === 'RATE_LIMIT' ? 'Servidores saturados. Espera unos minutos.' :
        error.message === 'invalid_api_key' ? 'API Key inválida. Reconfigura en Ajustes.' :
        error.message
      );
      attempt++;
      await new Promise(r => setTimeout(r, 800 * Math.pow(2, attempt)));
    }
  }
}

// ── GENERATE ──
async function GEN(fromWizard = false) {
  const e = document.getElementById('e3');
  if (e) e.style.display = 'none';

  if (!fromWizard) {
    if (!A.dieta || !v('comidas')) { if(e) { e.style.display='block'; } return; }
    // En flujo mixto, lanzar wizard en lugar de generar directo
    startWizard();
    return;
  }

  let apiKey = localStorage.getItem('jeipyfit_groq_key');
  if (!apiKey) {
    apiKey = prompt('🔑 Introduce tu API Key de Groq:');
    if (!apiKey) { showToast('API Key requerida', 'error'); return; }
    localStorage.setItem('jeipyfit_groq_key', apiKey);
  }

  go(4); animLS();

  try {
    const raw = await callGroq(apiKey, buildP(A.user), 3800);
    A.plan = JSON.parse(raw);
    A.weights = [{ date: today(), ts: Date.now(), val: parseFloat(A.user.peso) }];
    A.weekLog = {}; A.sessions = 0;

    addHist({ type: 'pla', title: 'Plan generado',
      body: `Objetivo: <strong>${A.user.obj}</strong> · ${A.days.length} días/sem`,
      detail: { cal: A.plan.res.cal+'kcal', pro: A.plan.res.pro+'g', car: A.plan.res.car+'g', gra: A.plan.res.gra+'g' }
    });
    addHist({ type: 'pes', title: 'Peso inicial registrado',
      body: `Inicio: <strong>${A.user.peso} kg</strong>`,
      detail: { peso: A.user.peso+'kg', imc: ((parseFloat(A.user.peso)/Math.pow(parseFloat(A.user.altura)/100,2)).toFixed(1)), altura: A.user.altura+'cm' }
    });

    saveState();
    document.getElementById('nav').style.display = 'flex';
    document.getElementById('settingsBtn').style.display = 'flex';
    renderPlan();
    document.getElementById('planSub').textContent = `${A.obj.length} objetivo${A.obj.length>1?'s':''} · ${A.days.length} días/sem · ${A.user.dur}`;
    go(5); MT('plan');
    showToast('¡Plan generado con éxito! 🎉', 'success');
  } catch (err) {
    go(fromWizard ? 6 : 3);
    console.error(err);
    showToast('Error: ' + err.message, 'error');
    if (err.message.includes('inválida')) localStorage.removeItem('jeipyfit_groq_key');
  }
}

// ── PROMPT BUILDER (token-efficient) ──
function buildP(u) {
  const n = u.dias.split(',').filter(d=>d.trim()).length;
  const adv = u.exp?.includes('+3') || u.exp?.toLowerCase().includes('avanzado') || u.dur?.includes('+90');
  // Contexto extra del wizard
  const wizardCtx = [
    u.rutina_previa ? `Rutina previa: ${u.rutina_previa}` : '',
    u.horario_entreno ? `Horario: ${u.horario_entreno}` : '',
    u.historial_dieta ? `Historial dieta: ${u.historial_dieta}` : '',
    u.barreras ? `Barreras pasadas: ${u.barreras}` : ''
  ].filter(Boolean).join('; ');

  return `Preparador élite y nutricionista. Genera plan semanal 7 días. JSON MINIFICADO.
PERFIL: ${u.sexo},${u.edad}a,${u.peso}kg,${u.altura}cm,${u.grasa}%grasa,${u.actividad},exp:${u.exp},lesiones:${u.lesiones}
OBJETIVOS: ${u.obj}|TIPO: ${u.tipo}|DÍAS: ${u.dias}(${n} días)|DUR: ${u.dur}
DIETA: ${u.dieta},${u.comidas}comidas,gusta:${u.gusta},evitar:${u.nogusta},presu:${u.presu}
AVANZADO: equipo:[${u.equipo}],split:[${u.split}],estrés:[${u.estres}]${wizardCtx ? '\nCONTEXTO PERSONAL: '+wizardCtx : ''}${u.pesoMeta ? '\nMETA: '+u.pesoMeta+'kg en '+u.plazoMeta : ''}
${adv ? `VOLUMEN AVANZADO: 6-8 ejercicios/sesión, split ${u.split}, RIR+Tempo obligatorio` : 'VOLUMEN ESTÁNDAR: 4-5 ejercicios/sesión'}
JSON ESTRUCTURA:
{"res":{"cal":0,"pro":0,"car":0,"gra":0,"imc":0,"obj":"Análisis clínico.","tdee":0,"deficit":0},"nut":[{"dia":"Lunes","ent":true,"com":[{"t":"Desayuno","n":"...","cal":0,"pro":0,"car":0,"gra":0,"desc":"..."}]}],"ej":[{"dia":"Lunes","ent":true,"ts":"Empuje","dur":"${u.dur}","cal":"Movilidad...","ex":[{"n":"Press Banca","ser":4,"rep":"6-8","des":"180s","rir":"1","tem":"3-1-1-0","emo":"🏋️","tip":"..."}],"vc":"Estiramientos."}],"con":[{"tit":"Control Fatiga","txt":"..."}]}`;
}

function animLS() {
  [0,1,2,3,4].forEach((i,x) => {
    setTimeout(() => document.getElementById('ls'+i)?.classList.add('act'), x*1000);
    setTimeout(() => {
      const l = document.getElementById('ls'+i);
      if (l) { l.classList.remove('act'); l.classList.add('done'); }
    }, x*1000+750);
  });
}

// ══════════════════════════════════════════════════════════════
// ── RENDER PLAN ──
// ══════════════════════════════════════════════════════════════

function renderPlan() {
  const p = A.plan, u = A.user;
  if (!p || !u) return;
  const bmi = (parseFloat(u.peso)/Math.pow(parseFloat(u.altura)/100,2)).toFixed(1);

  document.getElementById('psum').innerHTML = `
    <div class="ps"><div class="v">${p.res.cal}</div><div class="l">kcal/día</div></div>
    <div class="ps"><div class="v">${p.res.pro}g</div><div class="l">Proteína</div></div>
    <div class="ps"><div class="v">${bmi}</div><div class="l">IMC</div></div>
    <div class="ps"><div class="v">${A.days.length}</div><div class="l">días/sem</div></div>`;

  const FI = { 'Desayuno':'🌅','Almuerzo':'☀️','Merienda':'🍎','Cena':'🌙','Pre-entreno':'⚡','Post-entreno':'💪' };

  // NUTRICIÓN
  let nh = `<div class="mbar">
    <div class="mv"><div class="v">${p.res.cal}</div><div class="l">Calorías</div></div>
    <div class="mdiv"></div>
    <div class="mv"><div class="v">${p.res.pro}g</div><div class="l">Proteína</div></div>
    <div class="mdiv"></div>
    <div class="mv"><div class="v">${p.res.car}g</div><div class="l">Carbos</div></div>
    <div class="mdiv"></div>
    <div class="mv"><div class="v">${p.res.gra}g</div><div class="l">Grasa</div></div>
  </div>`;

  p.nut.forEach(day => {
    nh += `<div class="pcard"><div class="pcard-hdr">
      <span class="dlabel">${day.dia}</span>
      <span class="badge ${day.ent?'train':'rest'}">${day.ent?'💪 Entreno':'😴 Descanso'}</span>
    </div>`;
    (day.com||[]).forEach((m,mi) => {
      nh += `<div class="mrow"><div style="flex:1">
        <div class="mtype">${FI[m.t]||'🍽️'} ${m.t}</div>
        <div class="mname">${m.n}</div>
        <div class="mmac">${m.cal} kcal · ${m.pro}g prot · ${m.car}g carbos · ${m.gra}g grasa</div>
        ${m.desc ? `<div class="mtip">${m.desc}</div>` : ''}
      </div><button class="btn-swap" onclick="OS('meal','${day.dia}',${mi},'${esc(m.n)}')" title="Cambiar">🔄</button></div>`;
    });
    nh += '</div>';
  });
  document.getElementById('tp-nut').innerHTML = nh;

  // EJERCICIO
  let eh = '';
  p.ej.forEach(day => {
    eh += `<div class="pcard"><div class="pcard-hdr">
      <span class="dlabel">${day.dia}</span>
      <span class="badge ${day.ent?'train':'rest'}">${day.ent?'💪 '+day.ts:'😴 Descanso'}</span>
    </div>`;
    if (day.ent && day.ex?.length) {
      eh += `<div class="mrow"><div><div class="mtype">🔥 Calentamiento</div><div class="mname">${day.cal}</div></div></div>`;
      day.ex.forEach((ex,ei) => {
        eh += `<div class="exrow">
          <div class="exnum">${ei+1}</div>
          <div style="flex:1">
            <div class="exname">${ex.emo||'💪'} ${ex.n}</div>
            <div class="exdet">${ex.ser} series × ${ex.rep} · Desc: ${ex.des}${ex.rir?` · <strong style="color:var(--lime)">RIR:</strong> ${ex.rir}`:''}${ex.tem?` · <strong style="color:var(--lime)">Tempo:</strong> ${ex.tem}`:''}</div>
            ${ex.tip ? `<div class="extip">💡 ${ex.tip}</div>` : ''}
          </div>
          <button class="btn-swap" onclick="OS('exercise','${day.dia}',${ei},'${esc(ex.n)}')" title="Cambiar">🔄</button>
        </div>`;
      });
      eh += `<div class="mrow"><div><div class="mtype">🧘 Vuelta calma</div><div class="mname">${day.vc}</div></div></div>`;
    } else {
      eh += '<div style="padding:12px 0;color:var(--t3);font-size:13px">😴 Descanso activo · camina, estira, recupera 🌿</div>';
    }
    eh += '</div>';
  });
  document.getElementById('tp-ej').innerHTML = eh;

  // ANÁLISIS
  let ah = `<div class="scard"><h3>📊 Análisis completo</h3><p>${p.res.obj}</p>`;
  if (p.res.tdee) ah += `<div class="analysis-stats">
    <div class="as-item"><span class="as-k">TDEE</span><span class="as-v">${p.res.tdee} kcal</span></div>
    <div class="as-item"><span class="as-k">${parseInt(p.res.deficit||0) < 0 ? 'Déficit' : 'Superávit'}</span><span class="as-v">${Math.abs(p.res.deficit||0)} kcal</span></div>
    <div class="as-item"><span class="as-k">IMC</span><span class="as-v">${(parseFloat(A.user.peso)/Math.pow(parseFloat(A.user.altura)/100,2)).toFixed(1)}</span></div>
  </div>`;
  ah += '</div>';
  if (p.con) p.con.forEach(c => { ah += `<div class="scard"><h3>${c.tit}</h3><p>${c.txt}</p></div>`; });
  document.getElementById('tp-ana').innerHTML = ah;
}

function PT(n, i) {
  document.querySelectorAll('.tab').forEach((t,j) => t.classList.toggle('on', j===i));
  document.querySelectorAll('.tpane').forEach(t => t.classList.remove('on'));
  document.getElementById('tp-'+n)?.classList.add('on');
}

// ══════════════════════════════════════════════════════════════
// ── DASHBOARD DE PROGRESO (Enterprise) ──
// ══════════════════════════════════════════════════════════════

function renderProg() {
  const ws = A.weights, wl = A.weekLog, td = A.days;
  const done = Object.values(wl).filter(v=>v==='done').length;
  const pct = td.length ? Math.round((done/td.length)*100) : 0;
  const lastW = ws.length ? ws[ws.length-1].val : null;
  const firstW = ws.length ? ws[0].val : null;
  const diff = lastW && firstW ? (lastW-firstW).toFixed(1) : null;
  const streak = calcStreak();
  const totalSessions = A.sessions;
  const unit = A.settings?.unit || 'kg';

  // ── KPI CARDS ──
  document.getElementById('progCards').innerHTML = `
    <div class="prc">
      <div class="prc-label">⚖️ Peso ${unit==='lbs'?'(lbs)':'(kg)'}</div>
      <div class="prc-val">${lastW ? (unit==='lbs'?(lastW*2.205).toFixed(1):lastW) : '–'}</div>
      <div class="prc-sub">${lastW?'registrado hoy':'Sin registros'}</div>
      ${diff ? `<div class="prc-delta ${parseFloat(diff)<=0?'pos':'neg'}">${parseFloat(diff)>0?'+':''}${diff} ${unit} desde inicio</div>` : '<div class="prc-delta neu">—</div>'}
    </div>
    <div class="prc">
      <div class="prc-label">💪 Sesiones</div>
      <div class="prc-val">${totalSessions}</div>
      <div class="prc-sub">totales completadas</div>
      <div class="prc-delta ${streak>1?'pos':'neu'}">${streak>1?`🔥 Racha ${streak} días`:streak===1?'¡Buen trabajo!':'Empieza hoy'}</div>
    </div>
    <div class="prc">
      <div class="prc-label">📅 Esta semana</div>
      <div class="prc-val">${done}/${td.length}</div>
      <div class="prc-sub">días completados</div>
      <div class="prc-delta ${pct>=80?'pos':pct>=40?'neu':'neg'}">${pct}% completado</div>
    </div>`;

  // ── GOAL BAR ──
  const gb = document.getElementById('goalBar');
  if (gb) {
    gb.style.display = 'block';
    gb.innerHTML = `
      <div class="goal-bar-hdr">
        <span class="goal-bar-title">Objetivo semanal</span>
        <span class="goal-bar-pct">${done}/${td.length} días · ${pct}%</span>
      </div>
      <div class="goal-bar-track"><div class="goal-bar-fill" style="width:${pct}%"></div></div>
      ${A.user?.pesoMeta ? `<div class="goal-meta-row">
        <span>🎯 Meta: <strong>${A.user.pesoMeta} kg</strong></span>
        ${lastW ? `<span>${Math.abs(lastW - parseFloat(A.user.pesoMeta)).toFixed(1)} kg hasta la meta</span>` : ''}
      </div>` : ''}`;
  }

  // ── WEEK CHECK ──
  const DAYS = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  document.getElementById('wcheck').innerHTML = DAYS.map(d => {
    const isTr = A.days.includes(d), st = wl[d] || '';
    const cls = st==='done'?'done':st==='skip'?'skip':isTr?'':'notr';
    const ico = st==='done'?'✅':st==='skip'?'❌':isTr?'🏋️':'😴';
    const lbl = st==='done'?'Hecho':st==='skip'?'Saltado':isTr?'Pendiente':'Descanso';
    return `<div class="wcd ${cls}" onclick="${isTr?`CK('${d}')`:''}" style="${!isTr?'cursor:default':''}">
      <div class="wcd-name">${d}</div>
      <div class="wcd-ico">${ico}</div>
      <div class="wcd-st">${lbl}</div>
    </div>`;
  }).join('');

  // ── GRÁFICA PESO (SVG REAL) ──
  renderWeightChart();

  // ── MACROS PIE CHART ──
  renderMacroChart();

  // ── MEDIDAS ──
  renderMeasureCards();
}

function setChartRange(days, el) {
  A.chartRange = days;
  document.querySelectorAll('.ctab').forEach(t => t.classList.remove('on'));
  if (el) el.classList.add('on');
  renderWeightChart();
}

function renderWeightChart() {
  const ws = A.weights;
  const now = Date.now();
  const cutoff = A.chartRange === 999 ? 0 : now - A.chartRange * 86400000;
  const filtered = ws.filter(w => w.ts >= cutoff);
  const wrap = document.getElementById('wchartWrap');
  if (!wrap) return;

  if (!filtered.length) {
    wrap.innerHTML = `<p style="font-size:12px;color:var(--t4);padding:8px 0">Registra tu primer peso para ver la evolución.</p>`;
    return;
  }

  const vals = filtered.map(w => w.val);
  const mn = Math.min(...vals), mx = Math.max(...vals);
  const range = mx - mn || 1;
  const W = 520, H = 120, pad = { t:20, r:10, b:30, l:35 };
  const iW = W - pad.l - pad.r, iH = H - pad.t - pad.b;
  const unit = A.settings?.unit || 'kg';

  const pts = filtered.map((w,i) => {
    const x = pad.l + (filtered.length > 1 ? (i/(filtered.length-1))*iW : iW/2);
    const y = pad.t + iH - ((w.val - mn)/range)*iH;
    return { x, y, w };
  });

  // Area path
  let area = `M ${pts[0].x} ${H - pad.b} `;
  area += pts.map(p => `L ${p.x} ${p.y}`).join(' ');
  area += ` L ${pts[pts.length-1].x} ${H - pad.b} Z`;

  // Line path
  let line = `M ${pts[0].x} ${pts[0].y} `;
  line += pts.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');

  // Y-axis labels
  const yLabels = [mn, mn + range/2, mx].map((val, i) => {
    const y = pad.t + iH - (i/2)*iH;
    const disp = unit === 'lbs' ? (val*2.205).toFixed(1) : val.toFixed(1);
    return `<text x="${pad.l - 4}" y="${y + 4}" text-anchor="end" fill="var(--t4)" font-size="9" font-family="var(--font-mono)">${disp}</text>`;
  }).join('');

  // X-axis labels (every nth)
  const step = Math.ceil(filtered.length / 5);
  const xLabels = pts.filter((_,i) => i % step === 0 || i === pts.length-1).map(p => {
    return `<text x="${p.x}" y="${H - 4}" text-anchor="middle" fill="var(--t4)" font-size="9" font-family="var(--font-mono)">${p.w.date}</text>`;
  }).join('');

  // Trend line
  let trendLine = '';
  if (pts.length >= 3) {
    const n = pts.length;
    const sumX = pts.reduce((s,_,i)=>s+i, 0);
    const sumY = pts.reduce((s,p)=>s+p.y, 0);
    const sumXY = pts.reduce((s,p,i)=>s+i*p.y, 0);
    const sumX2 = pts.reduce((s,_,i)=>s+i*i, 0);
    const slope = (n*sumXY - sumX*sumY) / (n*sumX2 - sumX*sumX);
    const intercept = (sumY - slope*sumX) / n;
    const y0 = intercept, y1 = slope*(n-1) + intercept;
    trendLine = `<line x1="${pts[0].x}" y1="${y0}" x2="${pts[n-1].x}" y2="${y1}" stroke="var(--org)" stroke-width="1" stroke-dasharray="4,3" opacity="0.6"/>`;
  }

  wrap.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="weight-svg" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="wGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--lime)" stop-opacity="0.18"/>
        <stop offset="100%" stop-color="var(--lime)" stop-opacity="0.01"/>
      </linearGradient>
    </defs>
    <line x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${H-pad.b}" stroke="var(--brd)" stroke-width="1"/>
    <line x1="${pad.l}" y1="${H-pad.b}" x2="${W-pad.r}" y2="${H-pad.b}" stroke="var(--brd)" stroke-width="1"/>
    ${yLabels}${xLabels}
    <path d="${area}" fill="url(#wGrad)"/>
    <path d="${line}" fill="none" stroke="var(--lime)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    ${trendLine}
    ${pts.map((p,i) => `
      <circle cx="${p.x}" cy="${p.y}" r="${i===pts.length-1?5:3}" fill="${i===pts.length-1?'var(--lime)':'var(--s3)'}" stroke="var(--lime)" stroke-width="${i===pts.length-1?0:1.5}"/>
      ${i===pts.length-1 ? `<text x="${p.x}" y="${p.y-8}" text-anchor="middle" fill="var(--lime)" font-size="10" font-weight="700" font-family="var(--font-mono)">${unit==='lbs'?(p.w.val*2.205).toFixed(1):p.w.val}</text>` : ''}
    `).join('')}
  </svg>`;
}

function renderMacroChart() {
  if (!A.plan) return;
  const wrap = document.getElementById('macroChartWrap');
  if (!wrap) return;

  const { pro, car, gra, cal } = A.plan.res;
  const proK = pro * 4, carK = car * 4, graK = gra * 9;
  const total = proK + carK + graK || 1;
  const proP = Math.round((proK/total)*100);
  const carP = Math.round((carK/total)*100);
  const graP = 100 - proP - carP;

  // SVG donut chart
  const cx = 60, cy = 60, r = 45, stroke = 12;
  const circ = 2 * Math.PI * r;
  const segs = [
    { val: proP, color: 'var(--lime)', label: 'Proteína', g: pro+'g' },
    { val: carP, color: 'var(--blu)', label: 'Carbos', g: car+'g' },
    { val: graP, color: 'var(--org)', label: 'Grasa', g: gra+'g' }
  ];

  let offset = 0;
  const arcs = segs.map(s => {
    const dash = (s.val/100) * circ;
    const gap = circ - dash;
    const arc = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${stroke}" stroke-dasharray="${dash} ${gap}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})" opacity="0.85"/>`;
    offset += dash;
    return arc;
  }).join('');

  const legend = segs.map(s => `
    <div class="macro-legend-item">
      <div class="mli-dot" style="background:${s.color}"></div>
      <div>
        <div class="mli-label">${s.label}</div>
        <div class="mli-val">${s.g} · ${s.val}%</div>
      </div>
    </div>`).join('');

  wrap.innerHTML = `<div class="macro-chart-inner">
    <svg width="120" height="120" viewBox="0 0 120 120">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--s4)" stroke-width="${stroke}"/>
      ${arcs}
      <text x="${cx}" y="${cy-6}" text-anchor="middle" fill="var(--t1)" font-size="14" font-weight="900" font-family="var(--font-head)">${cal}</text>
      <text x="${cx}" y="${cy+10}" text-anchor="middle" fill="var(--t4)" font-size="8" font-family="var(--font-mono)">kcal</text>
    </svg>
    <div class="macro-legend">${legend}</div>
  </div>`;
}

// ── MEDIDAS CORPORALES ──
function renderMeasureCards() {
  const keys = ['cintura','pecho','cadera','brazo'];
  keys.forEach(k => {
    const el = document.getElementById('mc-'+k);
    if (el) el.textContent = A.measures[k] ? A.measures[k].slice(-1)[0].val : '—';
  });
}

let _currentMeasure = null;
function addMeasure(key) {
  _currentMeasure = key;
  document.getElementById('measureModalTitle').textContent = key.toUpperCase();
  document.getElementById('measureModalLabel').textContent = `${key.charAt(0).toUpperCase()+key.slice(1)} (cm)`;
  document.getElementById('measureInput').value = '';
  document.getElementById('measureModal').classList.add('on');
}
function saveMeasure() {
  const val = parseFloat(document.getElementById('measureInput').value);
  if (!val || val < 10 || val > 300) return;
  if (!A.measures[_currentMeasure]) A.measures[_currentMeasure] = [];
  A.measures[_currentMeasure].push({ date: today(), ts: Date.now(), val });
  addHist({ type: 'pes', title: `Medida registrada — ${_currentMeasure}`,
    body: `<strong>${_currentMeasure}:</strong> ${val} cm`, detail: { medida: _currentMeasure, valor: val+'cm' }
  });
  renderMeasureCards();
  closeMeasureModal();
  saveState();
  showToast(`${_currentMeasure}: ${val} cm guardado ✓`, 'success');
}
function closeMeasureModal() { document.getElementById('measureModal').classList.remove('on'); }

// ── WEEK CHECK ──
function CK(day) {
  const cur = A.weekLog[day] || '';
  if (cur === '') {
    A.weekLog[day] = 'done'; A.sessions++;
    const dp = A.plan?.ej?.find(d=>d.dia===day);
    const exList = dp?.ex?.map(e=>e.n) || [];
    addHist({ type:'ent', title:`Entrenamiento completado — ${day}`,
      body:`Sesión de <strong>${dp?.ts||'entreno'}</strong> completada`,
      detail:{ sesion:dp?.ts||'—', ejercicios:exList.length+' ejercicios' }, exList
    });
    showToast(`💪 ¡${day} completado!`, 'success');
  } else if (cur === 'done') {
    A.weekLog[day] = 'skip'; A.sessions = Math.max(0, A.sessions-1);
    addHist({ type:'sal', title:`Sesión saltada — ${day}`, body:`Marcado como saltado`, detail:{} });
  } else {
    delete A.weekLog[day];
  }
  saveState(); renderProg();
}

// ── PESO ──
function LW() {
  const inp = document.getElementById('wInput');
  const val = parseFloat(inp.value);
  if (!val || val<30 || val>300) { showToast('Peso inválido (30–300 kg)', 'error'); return; }
  const stored = A.settings?.unit==='lbs' ? val/2.205 : val;
  A.weights.push({ date: today(), ts: Date.now(), val: parseFloat(stored.toFixed(2)) });
  addHist({ type:'pes', title:'Peso registrado',
    body:`Nuevo peso: <strong>${val} ${A.settings?.unit||'kg'}</strong>`,
    detail:{ peso: val+(A.settings?.unit||'kg'), fecha: today() }
  });
  inp.value = '';
  saveState(); renderProg();
  showToast(`Peso ${val} ${A.settings?.unit||'kg'} guardado ✓`, 'success');
}

// ── NOTAS ──
function selNota(el) {
  document.querySelectorAll('.tipo-opt').forEach(o => o.classList.remove('on'));
  el.classList.add('on'); A.notaTipo = el.dataset.t;
}
function addNota() {
  const txt = document.getElementById('notaText')?.value.trim();
  if (!txt) return;
  const t = A.notaTipo;
  const titles = { not:'Nota añadida', ent:'Apunte de entrenamiento', sal:'Cambio en el plan' };
  const types = { not:'sal', ent:'ent', sal:'cam' };
  addHist({ type:types[t], title:titles[t], body:txt, detail:{} });
  document.getElementById('notaText').value = '';
  saveState(); renderHist();
  showToast('Nota guardada ✓', 'success');
}

// ── FOTOS ──
function triggerPhoto() { document.getElementById('photoInput')?.click(); }
function handlePhoto(e) {
  const file = e.target.files?.[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const entry = { id: Date.now(), date: today(), ts: Date.now(), src: ev.target.result };
    A.photos.push(entry);
    saveState(); renderPhotos();
    showToast('Foto guardada ✓', 'success');
  };
  reader.readAsDataURL(file);
  e.target.value = '';
}
let _viewingPhoto = null;
function renderPhotos() {
  const grid = document.getElementById('photosGrid');
  if (!grid) return;
  grid.innerHTML = A.photos.map(p => `
    <div class="photo-thumb" onclick="openPhotoViewer(${p.id})">
      <img src="${p.src}" alt="Foto progreso" loading="lazy">
      <div class="photo-thumb-date">${p.date}</div>
    </div>`).join('');
}
function openPhotoViewer(id) {
  _viewingPhoto = id;
  const p = A.photos.find(x=>x.id===id); if (!p) return;
  document.getElementById('photoViewerImg').src = p.src;
  document.getElementById('photoViewerInfo').textContent = `Foto del ${p.date}`;
  document.getElementById('photoViewer').classList.add('on');
}
function closePhotoViewer() { document.getElementById('photoViewer').classList.remove('on'); }
function deletePhoto() {
  if (!_viewingPhoto) return;
  A.photos = A.photos.filter(p=>p.id!==_viewingPhoto);
  closePhotoViewer(); saveState(); renderPhotos();
  showToast('Foto eliminada', 'success');
}

// ══════════════════════════════════════════════════════════════
// ── HISTORIAL ──
// ══════════════════════════════════════════════════════════════

function addHist(item) {
  const now = new Date();
  A.history.unshift({
    id: Date.now() + Math.random(), ts: now.getTime(), date: today(),
    time: now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0'),
    ...item
  });
}

const TYPE_LABELS = { ent:'💪 Entreno', pes:'⚖️ Peso', cam:'🔄 Cambio', sal:'📝 Nota', pla:'✦ Plan' };

function HF(f, el) {
  A.histFilter = f;
  document.querySelectorAll('.hf').forEach(h => h.classList.remove('on'));
  el.classList.add('on');
  renderHist();
}

function renderHist() {
  // Stats resumen
  const stats = document.getElementById('histStats');
  if (stats) {
    const ent = A.history.filter(h=>h.type==='ent').length;
    const pes = A.history.filter(h=>h.type==='pes').length;
    const cam = A.history.filter(h=>h.type==='cam').length;
    stats.innerHTML = `
      <div class="hs-card"><div class="hs-val">${ent}</div><div class="hs-lbl">Entrenos</div></div>
      <div class="hs-card"><div class="hs-val">${pes}</div><div class="hs-lbl">Pesajes</div></div>
      <div class="hs-card"><div class="hs-val">${cam}</div><div class="hs-lbl">Cambios</div></div>
      <div class="hs-card"><div class="hs-val">${A.history.length}</div><div class="hs-lbl">Total</div></div>`;
  }

  const filtered = A.histFilter==='all' ? A.history : A.history.filter(h=>h.type===A.histFilter);
  const tl = document.getElementById('histTimeline');
  if (!tl) return;

  if (!filtered.length) {
    tl.innerHTML = `<div class="empty-hist"><div class="eico">📋</div><p>No hay registros.</p></div>`;
    return;
  }

  const groups = {};
  filtered.forEach(h => { if (!groups[h.date]) groups[h.date]=[]; groups[h.date].push(h); });

  let html = '<div class="timeline">';
  Object.entries(groups).forEach(([date, items]) => {
    html += `<div class="tl-group"><div class="tl-date-hdr">${fmtDate(date)}</div>`;
    items.forEach(h => {
      const tl2 = TYPE_LABELS[h.type] || 'Evento';
      html += `<div class="tl-item">
        <div class="tl-dot ${h.type}"></div>
        <div class="tl-card">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
            <div style="flex:1">
              <div class="tl-type-badge ${h.type}">${tl2}</div>
              <div class="tl-title">${h.title}</div>
              <div class="tl-body">${h.body}</div>
              ${h.detail && Object.keys(h.detail).length ? `<div class="tl-detail">${Object.entries(h.detail).map(([k,v])=>`<div class="tl-det-row"><span class="k">${k.charAt(0).toUpperCase()+k.slice(1)}</span><span class="v">${v}</span></div>`).join('')}</div>` : ''}
              ${h.exList?.length ? `<div class="tl-exlist">${h.exList.map(e=>`<div class="tl-exitem">${e}</div>`).join('')}</div>` : ''}
            </div>
            <div class="tl-time">${h.time}</div>
          </div>
        </div>
      </div>`;
    });
    html += '</div>';
  });
  html += '</div>';
  tl.innerHTML = html;
}

function fmtDate(d) {
  if (!d) return '—';
  const [day, mon] = d.split('/');
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${parseInt(day)} ${months[parseInt(mon)-1]||''}`;
}

// ══════════════════════════════════════════════════════════════
// ── SWAP MODAL ──
// ══════════════════════════════════════════════════════════════

function OS(type, day, idx, cur) {
  A.editing = { type, day, idx, cur };
  document.getElementById('swapTit').textContent = type==='meal'?'COMIDA':'EJERCICIO';
  document.getElementById('swapSub').textContent = `Alternativas para: "${cur}"`;
  document.getElementById('swapBody').innerHTML = '<div class="ai-loading"><div class="ai-ring"></div>Generando alternativas...</div>';
  document.getElementById('swapModal').classList.add('on');
  fetchAlts(type, day, cur);
}

async function fetchAlts(type, day, cur) {
  const u = A.user, isM = type==='meal';
  const apiKey = localStorage.getItem('jeipyfit_groq_key');
  if (!apiKey) { document.getElementById('swapBody').innerHTML = `<div style="color:var(--red);padding:10px">API Key no configurada.</div>`; return; }

  // Prompts compactos
  const prompt = isM
    ? `Dieta ${u.dieta}. Cambiar "${cur}" día ${day}. 4 alternativas. {"alts":[{"n":"...","cal":400,"pro":35,"car":40,"gra":12,"desc":"..."}]}`
    : `Nivel ${u.exp}, equipo ${u.equipo}. Cambiar "${cur}" día ${day}. 4 alternativas equivalentes. {"alts":[{"n":"...","ser":4,"rep":"10-12","des":"90s","rir":"1","tem":"3-0-1-0","emo":"💪","tip":"..."}]}`;

  try {
    const raw = await callGroq(apiKey, prompt, 600);
    const alts = JSON.parse(raw).alts;
    document.getElementById('swapBody')._alts = alts;
    let h = '';
    alts.forEach((a,i) => {
      const det = isM ? `${a.cal} kcal · ${a.pro}g prot · ${a.car}g carbos` : `${a.ser}×${a.rep} · Desc: ${a.des}`;
      h += `<div class="sugg" onclick="applySwap(${i})">
        <div class="sugg-name">${isM?'🍽️':a.emo||'💪'} ${a.n}</div>
        <div class="sugg-det">${det}</div>
        ${(isM?a.desc:a.tip)?`<div class="sugg-det" style="font-style:italic;margin-top:2px">${isM?a.desc:a.tip}</div>`:''}
      </div>`;
    });
    h += `<div style="text-align:center;margin-top:8px"><button class="btn-ghost btn-xs" onclick="CM()">Cancelar</button></div>`;
    document.getElementById('swapBody').innerHTML = h;
  } catch (err) {
    document.getElementById('swapBody').innerHTML = `<div style="color:var(--red);font-size:12px;padding:10px">Error: ${err.message}</div>`;
  }
}

function applySwap(i) {
  const alts = document.getElementById('swapBody')._alts;
  const a = alts[i], { type, day, idx } = A.editing;
  const isM = type==='meal';
  let oldName = A.editing.cur, newName = a.n;
  if (isM) {
    const dO = A.plan.nut.find(d=>d.dia===day);
    if (dO?.com[idx]) { oldName=dO.com[idx].n; dO.com[idx]={...dO.com[idx],...a}; }
  } else {
    const dO = A.plan.ej.find(d=>d.dia===day);
    if (dO?.ex[idx]) { oldName=dO.ex[idx].n; dO.ex[idx]={...dO.ex[idx],...a}; }
  }
  addHist({ type:'cam', title:`${isM?'Comida':'Ejercicio'} cambiado — ${day}`,
    body:`<strong>${oldName}</strong> → <strong>${newName}</strong>`,
    detail:{ tipo: isM?'Cambio nutricional':'Cambio de ejercicio' }
  });
  CM(); saveState(); renderPlan();
  const tab=isM?'nut':'ej', idx2=isM?0:1;
  document.querySelectorAll('.tab').forEach((t,j)=>t.classList.toggle('on',j===idx2));
  document.querySelectorAll('.tpane').forEach(t=>t.classList.remove('on'));
  document.getElementById('tp-'+tab)?.classList.add('on');
  showToast(`${isM?'Comida':'Ejercicio'} actualizado ✓`, 'success');
}

function CM() { document.getElementById('swapModal').classList.remove('on'); }
document.getElementById('swapModal')?.addEventListener('click', function(e) { if(e.target===this) CM(); });
document.getElementById('measureModal')?.addEventListener('click', function(e) { if(e.target===this) closeMeasureModal(); });
document.getElementById('photoViewer')?.addEventListener('click', function(e) { if(e.target===this) closePhotoViewer(); });

// ══════════════════════════════════════════════════════════════
// ── CHAT IA (Token-Efficient) ──
// ══════════════════════════════════════════════════════════════

function initChat() {
  const ctx = A.plan ? `Cal:${A.plan.res.cal}|Pro:${A.plan.res.pro}g|Car:${A.plan.res.car}g|Gra:${A.plan.res.gra}g|Obj:${A.user?.obj}|Días:${A.user?.dias}|Exp:${A.user?.exp}` : 'Sin plan';
  A.chatHistory = [{ role:'system', content:`Asistente JEIPYFIT. Técnico y directo. Responde en Markdown ligero. PERFIL:${ctx}` }];
}

function autoResizeChat(el) { el.style.height='auto'; el.style.height=el.scrollHeight+'px'; }
function chatKeydown(e) { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendChat();} }
function sendSugg(el) { document.getElementById('chatInput').value=el.innerText; sendChat(); }

function clearChat() {
  initChat();
  document.getElementById('chatWindow').innerHTML = `<div class="chat-msg ai intro-msg"><div class="chat-avatar">🤖</div><div class="chat-bubble"><p>¡Hola! Soy tu asistente fitness. Tengo acceso a tu plan y progreso. ¿En qué te ayudo?</p></div></div>`;
}

async function sendChat() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim(); if (!text) return;
  if (A.chatHistory.length===0) initChat();
  input.value=''; input.style.height='auto';

  appendMsg('user', text);
  A.chatHistory.push({ role:'user', content:text });

  // Token management: mantener máx 8 turnos + sistema
  if (A.chatHistory.length > 17) {
    A.chatHistory = [A.chatHistory[0], ...A.chatHistory.slice(-16)];
  }

  const loadingId = appendMsg('ai', '<div class="chat-thinking"><div class="dot-pulse"><span></span><span></span><span></span></div></div>');
  const apiKey = localStorage.getItem('jeipyfit_groq_key');
  if (!apiKey) { updateMsg(loadingId,'<span style="color:var(--red)">⚠️ API Key no configurada. Ve a Ajustes.</span>'); return; }

  const btn = document.getElementById('chatSendBtn');
  if (btn) btn.disabled = true;

  try {
    // Enriquecer sistema con stats recientes
    const msgs = [...A.chatHistory];
    const sessions = A.sessions, streak = calcStreak();
    const lastW = A.weights.length ? A.weights[A.weights.length-1].val : null;
    msgs[0] = { role:'system', content:A.chatHistory[0].content + `|Sesiones:${sessions}|Racha:${streak}|UltimoPeso:${lastW||'?'}kg` };

    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method:'POST',
      headers:{ 'Content-Type':'application/json','Authorization':`Bearer ${apiKey}` },
      body: JSON.stringify({ model:'llama-3.3-70b-versatile', messages:msgs, temperature:0.7, max_tokens:800 })
    });
    if (!r.ok) throw new Error(`Error ${r.status}`);
    const reply = (await r.json()).choices[0].message.content.trim();
    A.chatHistory.push({ role:'assistant', content:reply });
    updateMsg(loadingId, renderMarkdown(reply));
  } catch(err) {
    updateMsg(loadingId, `<span style="color:var(--red)">⚠️ ${err.message}</span>`);
  } finally {
    if (btn) btn.disabled = false;
  }
}

function appendMsg(role, content) {
  const cw = document.getElementById('chatWindow');
  const id = 'msg_'+Date.now();
  cw.insertAdjacentHTML('beforeend', `<div class="chat-msg ${role==='user'?'user':'ai'}" id="${id}"><div class="chat-avatar">${role==='user'?'👤':'🤖'}</div><div class="chat-bubble">${content}</div></div>`);
  cw.scrollTop = cw.scrollHeight; return id;
}
function updateMsg(id, content) {
  const el = document.getElementById(id);
  if (el) { el.querySelector('.chat-bubble').innerHTML=content; document.getElementById('chatWindow').scrollTop=9999; }
}
function renderMarkdown(txt) {
  return txt
    .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.*?)\*/g,'<em>$1</em>')
    .replace(/`([^`]+)`/g,'<code style="background:var(--s3);padding:1px 5px;border-radius:4px;font-family:var(--font-mono);font-size:11px">$1</code>')
    .replace(/^### (.*)/gm,'<strong style="color:var(--lime);font-size:12px;letter-spacing:1px;text-transform:uppercase">$1</strong>')
    .replace(/^## (.*)/gm,'<strong style="color:var(--t1);font-size:14px">$1</strong>')
    .replace(/^- (.*)/gm,'<div style="display:flex;gap:6px;margin:2px 0"><span style="color:var(--lime)">·</span><span>$1</span></div>')
    .replace(/\n/g,'<br>');
}

// ── SETTINGS ──
function toggleSettings() {
  document.getElementById('settingsPanel').classList.toggle('open');
}
document.addEventListener('click', e => {
  const panel = document.getElementById('settingsPanel');
  const btn = document.getElementById('settingsBtn');
  if (panel?.classList.contains('open') && !panel.contains(e.target) && !btn?.contains(e.target)) {
    panel.classList.remove('open');
  }
});

function resetKey() { localStorage.removeItem('jeipyfit_groq_key'); showToast('API Key eliminada', 'success'); }
function setUnit(u, el) {
  A.settings.unit = u;
  document.querySelectorAll('.seg').forEach(s => s.classList.toggle('on', s.textContent===u));
  saveState();
}
function toggleReminders(el) {
  A.settings.reminders = el.checked;
  document.getElementById('remTimeRow').style.display = el.checked?'flex':'none';
  if (el.checked && 'Notification' in window) Notification.requestPermission();
  saveState();
}
function saveRemTime() { A.settings.remTime = document.getElementById('remTime').value; saveState(); }

function exportarCSV() {
  if (!A.history?.length) { showToast('No hay datos para exportar', 'error'); return; }
  let csv = 'Fecha,Hora,Tipo,Titulo,Detalles\n';
  A.history.forEach(h => {
    const d = h.detail ? Object.entries(h.detail).map(([k,v])=>`${k}:${v}`).join('|').replace(/,/g,';') : '';
    csv += `${h.date},${h.time},${h.type},"${(h.title||'').replace(/"/g,'""')}","${d}"\n`;
  });
  dlFile(csv, 'jeipyfit_historial.csv', 'text/csv;charset=utf-8;');
}

function exportarPDF() {
  if (!A.plan) { showToast('Genera un plan primero', 'error'); return; }
  const content = `JEIPYFIT IA — Plan Personal\n${'='.repeat(40)}\nGenerado: ${today()}\n\nPERFIL: ${A.user.sexo}, ${A.user.edad} años, ${A.user.peso}kg, ${A.user.altura}cm\nObjetivo: ${A.user.obj}\n\nMACROS DIARIOS:\nCalorías: ${A.plan.res.cal} kcal | Proteína: ${A.plan.res.pro}g | Carbos: ${A.plan.res.car}g | Grasa: ${A.plan.res.gra}g\n\n${A.plan.res.obj}\n\n${'='.repeat(40)}\nPESOS REGISTRADOS (últimos 10):\n${A.weights.slice(-10).map(w=>`${w.date}: ${w.val} kg`).join('\n')}\n\nSESIONES COMPLETADAS: ${A.sessions}`;
  dlFile(content, 'jeipyfit_plan.txt', 'text/plain');
}

function dlFile(content, filename, type) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([content], { type }));
  link.download = filename;
  document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

function clearAll() {
  if (!confirm('¿Borrar TODOS los datos? Esta acción es irreversible.')) return;
  localStorage.removeItem('jeipyfit_v2');
  localStorage.removeItem('jeipyfit_state');
  location.reload();
}

// ── UTILS ──
function today() { const d=new Date(); return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}`; }
function calcStreak() {
  const DAYS=['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  let s=0;
  for (let i=DAYS.length-1;i>=0;i--) {
    if (A.weekLog[DAYS[i]]==='done') s++;
    else break;
  }
  return s;
}
function esc(s) { return (s||'').replace(/'/g,"\\'").replace(/"/g,'&quot;'); }

function showToast(msg, type='') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (type?' '+type:'');
  clearTimeout(t._to);
  t._to = setTimeout(() => t.className='toast', 2800);
}

// ── INIT ──
document.addEventListener('DOMContentLoaded', loadState);