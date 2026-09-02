const form = document.getElementById('agenda-form');
const agendaPage = document.getElementById('agenda-page');
const pageIndicator = document.getElementById('page-indicator');
const formTitle = document.getElementById('form-title');
const cancelEditBtn = document.getElementById('cancel-edit');
const prevPageBtn = document.getElementById('prev-page');
const nextPageBtn = document.getElementById('next-page');
const editCurrentTaskBtn = document.getElementById('edit-current-task');
const deleteCurrentTaskBtn = document.getElementById('delete-current-task');
const alertColorInput = document.getElementById('alert-color');
const alarmSoundSelect = document.getElementById('alarm-sound');
const manualAlertBtn = document.getElementById('manual-alert-btn');
const dismissAlarmBtn = document.getElementById('dismiss-alarm-btn');

const weekdayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

let tasks = [
  {
    id: 1,
    title: 'Acordar e arrumar o quarto',
    day: 'Segunda',
    time: '07:30',
    notes: 'Tomar café, escovar os dentes e organizar a mochila.'
  },
  {
    id: 2,
    title: 'Escola',
    day: 'Segunda',
    time: '08:15',
    notes: 'Chegada na escola e organização da rotina da manhã.'
  },
  {
    id: 3,
    title: 'Leitura',
    day: 'Quarta',
    time: '15:00',
    notes: 'Ler 2 histórias com calma e conversar sobre elas.'
  }
];

let editTaskId = null;
let currentPage = 0;
let activeTaskId = null;
let manualAlertTaskId = null;
let manualAlertTimer = null;
let silencedAlarmUntil = 0;
let silencedAlarmTaskId = null;
let alarmAudioContext = null;
let alarmOscillator = null;
let alarmGainNode = null;

const alarmNoteFrequencies = {
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  G4: 392.0,
  A4: 440.0,
  B4: 493.88,
  C5: 523.25
};

function normalizeHexColor(value) {
  const safeValue = (value || '#ff7a7a').trim();
  return /^#[0-9a-fA-F]{6}$/.test(safeValue) ? safeValue : '#ff7a7a';
}

function hexToRgb(value) {
  const safeValue = normalizeHexColor(value).replace('#', '');
  const number = Number.parseInt(safeValue, 16);
  const r = (number >> 16) & 255;
  const g = (number >> 8) & 255;
  const b = number & 255;
  return `${r}, ${g}, ${b}`;
}

function updateAlertColor(themeColor) {
  const normalizedColor = normalizeHexColor(themeColor);
  document.documentElement.style.setProperty('--alert-color', normalizedColor);
  document.documentElement.style.setProperty('--alert-color-rgb', hexToRgb(normalizedColor));

  if (alertColorInput) {
    alertColorInput.value = normalizedColor;
  }

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('incluir-alert-color', normalizedColor);
  }
}

function getCurrentDayName() {
  return weekdayNames[new Date().getDay()];
}

function getCurrentMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function checkActiveTask() {
  const currentDay = getCurrentDayName();
  const currentMinutes = getCurrentMinutes();

  const taskDueNow = tasks.find((task) => {
    if (task.day !== currentDay) return false;
    return Math.abs(parseTime(task.time) - currentMinutes) <= 1;
  });

  const silenced = silencedAlarmTaskId && Date.now() < silencedAlarmUntil;
  const dueTaskId = taskDueNow ? taskDueNow.id : null;

  activeTaskId = manualAlertTaskId ?? (silenced ? null : dueTaskId);

  if (activeTaskId !== null) {
    const activeIndex = sortedTasks().findIndex((task) => task.id === activeTaskId);
    if (activeIndex >= 0) {
      currentPage = activeIndex;
    }
  }
}

function parseTime(value) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function getPeriodLabel(time) {
  const [hours] = time.split(':').map(Number);

  if (hours < 12) return 'Manhã';
  if (hours < 18) return 'Tarde';
  return 'Noite';
}

function sortedTasks() {
  return [...tasks].sort((a, b) => parseTime(a.time) - parseTime(b.time));
}

function syncAlarmAudio() {
  const shouldPlay = Boolean(activeTaskId);

  if (!shouldPlay) {
    if (alarmGainNode && alarmAudioContext) {
      alarmGainNode.gain.cancelScheduledValues(alarmAudioContext.currentTime);
      alarmGainNode.gain.setTargetAtTime(0.0001, alarmAudioContext.currentTime, 0.05);
    }

    if (alarmOscillator && alarmAudioContext && alarmGainNode) {
      const oscillatorToStop = alarmOscillator;
      const gainToStop = alarmGainNode;

      setTimeout(() => {
        try {
          oscillatorToStop.stop();
        } catch (error) {
          // ignorar se já foi parado
        }

        if (oscillatorToStop) {
          try {
            oscillatorToStop.disconnect();
          } catch (error) {
            // ignorar desconexão em objetos já limpos
          }
        }

        if (gainToStop) {
          try {
            gainToStop.disconnect();
          } catch (error) {
            // ignorar desconexão em objetos já limpos
          }
        }

        if (alarmOscillator === oscillatorToStop) {
          alarmOscillator = null;
        }

        if (alarmGainNode === gainToStop) {
          alarmGainNode = null;
        }
      }, 120);
    }

    return;
  }

  const selectedNote = alarmSoundSelect?.value || 'C4';
  const selectedFrequency = alarmNoteFrequencies[selectedNote] || alarmNoteFrequencies.C4;

  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return;

  if (!alarmAudioContext) {
    alarmAudioContext = new AudioCtor();
  }

  if (alarmAudioContext.state === 'suspended') {
    alarmAudioContext.resume();
  }

  if (!alarmOscillator) {
    alarmOscillator = alarmAudioContext.createOscillator();
    alarmGainNode = alarmAudioContext.createGain();
    alarmOscillator.type = 'sine';
    alarmGainNode.gain.value = 0.0001;
    alarmOscillator.connect(alarmGainNode);
    alarmGainNode.connect(alarmAudioContext.destination);
    alarmOscillator.start();
  }

  alarmOscillator.frequency.setValueAtTime(selectedFrequency, alarmAudioContext.currentTime);
  alarmGainNode.gain.cancelScheduledValues(alarmAudioContext.currentTime);
  alarmGainNode.gain.setTargetAtTime(0.18, alarmAudioContext.currentTime, 0.08);
}

function renderAgendaPage() {
  checkActiveTask();
  const orderedTasks = sortedTasks();

  if (!orderedTasks.length) {
    agendaPage.classList.remove('task-alert');
    if (dismissAlarmBtn) dismissAlarmBtn.classList.add('hidden');
    syncAlarmAudio();
    agendaPage.innerHTML = `
      <div class="page-content">
        <p class="page-label">Agenda vazia</p>
        <h2>Sem compromissos</h2>
        <p class="page-time">Adicione uma atividade para começar.</p>
      </div>
    `;
    pageIndicator.textContent = 'Página 0 de 0';
    editCurrentTaskBtn.disabled = true;
    deleteCurrentTaskBtn.disabled = true;
    return;
  }

  if (currentPage >= orderedTasks.length) {
    currentPage = 0;
  }

  const task = orderedTasks[currentPage];
  const periodLabel = getPeriodLabel(task.time);
  const isActive = task.id === activeTaskId;

  agendaPage.classList.toggle('task-alert', isActive);

  if (dismissAlarmBtn) {
    dismissAlarmBtn.classList.toggle('hidden', !isActive);
  }

  agendaPage.innerHTML = `
    <div class="page-content ${isActive ? 'task-alert' : ''}">
      <p class="page-label">${periodLabel}</p>
      <h2>${task.time}</h2>
      <p class="page-time">${task.day}</p>

      <div class="page-box">
        <span class="page-tag">Atividade</span>
        <h3>${task.title}</h3>
        <p><strong>Dia:</strong> ${task.day}</p>
        <p><strong>Horário:</strong> ${task.time}</p>
        <p>${task.notes || 'Sem observações adicionais.'}</p>
      </div>
    </div>
  `;

  syncAlarmAudio();
  pageIndicator.textContent = `Página ${currentPage + 1} de ${orderedTasks.length}`;
  editCurrentTaskBtn.disabled = false;
  deleteCurrentTaskBtn.disabled = false;
}

function saveTask(event) {
  event.preventDefault();

  const formData = new FormData(form);
  const title = formData.get('title').trim();
  const day = formData.get('day');
  const time = formData.get('time');
  const notes = formData.get('notes').trim();

  if (!title || !day || !time) return;

  if (editTaskId !== null) {
    tasks = tasks.map((task) =>
      task.id === editTaskId ? { ...task, title, day, time, notes } : task
    );
  } else {
    tasks.push({
      id: Date.now(),
      title,
      day,
      time,
      notes
    });
  }

  const orderedTasks = sortedTasks();
  currentPage = orderedTasks.findIndex((task) => task.id === (editTaskId ?? tasks[tasks.length - 1].id));

  if (currentPage < 0) {
    currentPage = 0;
  }

  form.reset();
  editTaskId = null;
  formTitle.textContent = 'Adicionar compromisso';
  cancelEditBtn.classList.add('hidden');
  renderAgendaPage();
}

function handleEditTask(taskId) {
  const task = tasks.find((item) => item.id === taskId);
  if (!task) return;

  editTaskId = taskId;
  formTitle.textContent = 'Editar compromisso';
  cancelEditBtn.classList.remove('hidden');

  document.getElementById('task-title').value = task.title;
  document.getElementById('task-day').value = task.day;
  document.getElementById('task-time').value = task.time;
  document.getElementById('task-notes').value = task.notes;

  window.scrollTo({
    top: document.body.scrollHeight * 0.35,
    behavior: 'smooth'
  });
}

function handleDeleteTask(taskId) {
  tasks = tasks.filter((item) => item.id !== taskId);

  if (editTaskId === taskId) {
    editTaskId = null;
    form.reset();
    formTitle.textContent = 'Adicionar compromisso';
    cancelEditBtn.classList.add('hidden');
  }

  if (currentPage >= tasks.length) {
    currentPage = 0;
  }

  renderAgendaPage();
}

function cancelEdit() {
  editTaskId = null;
  form.reset();
  formTitle.textContent = 'Adicionar compromisso';
  cancelEditBtn.classList.add('hidden');
}

function getCurrentTask() {
  const orderedTasks = sortedTasks();
  return orderedTasks[currentPage] || null;
}

function editCurrentTask() {
  const task = getCurrentTask();
  if (!task) return;
  handleEditTask(task.id);
}

function deleteCurrentTask() {
  const task = getCurrentTask();
  if (!task) return;
  handleDeleteTask(task.id);
}

function goToPreviousPage() {
  if (!tasks.length) return;
  currentPage = (currentPage - 1 + tasks.length) % tasks.length;
  renderAgendaPage();
}

function goToNextPage() {
  if (!tasks.length) return;
  currentPage = (currentPage + 1) % tasks.length;
  renderAgendaPage();
}

function triggerManualAlert() {
  const task = getCurrentTask();
  if (!task) return;

  manualAlertTaskId = task.id;
  activeTaskId = task.id;
  silencedAlarmTaskId = null;
  silencedAlarmUntil = 0;

  if (manualAlertTimer) {
    clearTimeout(manualAlertTimer);
  }

  manualAlertTimer = setTimeout(() => {
    manualAlertTaskId = null;
    renderAgendaPage();
  }, 10000);

  syncAlarmAudio();
  renderAgendaPage();
}

function dismissAlarm() {
  const currentTask = getCurrentTask();
  if (!currentTask) return;

  manualAlertTaskId = null;
  silencedAlarmTaskId = currentTask.id;
  silencedAlarmUntil = Date.now() + 60000;
  activeTaskId = null;

  if (manualAlertTimer) {
    clearTimeout(manualAlertTimer);
    manualAlertTimer = null;
  }

  syncAlarmAudio();
  renderAgendaPage();
}

prevPageBtn.addEventListener('click', goToPreviousPage);
nextPageBtn.addEventListener('click', goToNextPage);
editCurrentTaskBtn.addEventListener('click', editCurrentTask);
deleteCurrentTaskBtn.addEventListener('click', deleteCurrentTask);
manualAlertBtn.addEventListener('click', triggerManualAlert);
dismissAlarmBtn.addEventListener('click', dismissAlarm);
alarmSoundSelect?.addEventListener('change', () => {
  if (activeTaskId) {
    syncAlarmAudio();
  }
});
form.addEventListener('submit', saveTask);
cancelEditBtn.addEventListener('click', cancelEdit);

if (alertColorInput) {
  const savedColor = typeof localStorage !== 'undefined' ? localStorage.getItem('incluir-alert-color') : null;
  updateAlertColor(savedColor || '#ff7a7a');
  alertColorInput.addEventListener('input', (event) => {
    updateAlertColor(event.target.value);
    renderAgendaPage();
  });
}

setInterval(() => {
  renderAgendaPage();
}, 15000);

renderAgendaPage();
