const STORAGE_KEY = "simple-alarm-clock-alarms";

const currentTimeEl = document.getElementById("current-time");
const currentDateEl = document.getElementById("current-date");
const alarmTimeInput = document.getElementById("alarm-time-input");
const alarmLabelInput = document.getElementById("alarm-label-input");
const addAlarmBtn = document.getElementById("add-alarm-btn");
const alarmListEl = document.getElementById("alarm-list");
const ringingOverlay = document.getElementById("ringing-overlay");
const ringingLabel = document.getElementById("ringing-label");
const ringingTime = document.getElementById("ringing-time");
const stopAlarmBtn = document.getElementById("stop-alarm-btn");

let alarms = loadAlarms();
let ringingAlarmId = null;
let audioCtx = null;
let ringingOscillators = [];
let lastCheckedMinute = null;

function loadAlarms() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAlarms() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(alarms));
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function updateClock() {
  const now = new Date();
  currentTimeEl.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  currentDateEl.textContent = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;

  const hhmm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  if (hhmm !== lastCheckedMinute) {
    lastCheckedMinute = hhmm;
    checkAlarms(hhmm);
  }
}

function checkAlarms(hhmm) {
  if (ringingAlarmId !== null) return;
  const match = alarms.find((a) => a.enabled && a.time === hhmm);
  if (match) {
    ringAlarm(match);
  }
}

function ringAlarm(alarm) {
  ringingAlarmId = alarm.id;
  ringingLabel.textContent = alarm.label || "アラーム";
  ringingTime.textContent = alarm.time;
  ringingOverlay.classList.remove("hidden");
  startBeeping();
}

function startBeeping() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }

  const beepOnce = (startTime) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(0.3, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.35);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(startTime);
    osc.stop(startTime + 0.4);
    ringingOscillators.push(osc);
  };

  const now = audioCtx.currentTime;
  for (let i = 0; i < 60; i++) {
    beepOnce(now + i * 0.6);
  }
}

function stopBeeping() {
  ringingOscillators.forEach((osc) => {
    try {
      osc.stop();
    } catch {
      // already stopped
    }
  });
  ringingOscillators = [];
}

function stopAlarm() {
  stopBeeping();
  ringingOverlay.classList.add("hidden");
  ringingAlarmId = null;
}

function addAlarm() {
  const time = alarmTimeInput.value;
  if (!time) return;
  const label = alarmLabelInput.value.trim();

  alarms.push({
    id: Date.now(),
    time,
    label,
    enabled: true,
  });
  alarms.sort((a, b) => a.time.localeCompare(b.time));

  saveAlarms();
  renderAlarms();

  alarmTimeInput.value = "";
  alarmLabelInput.value = "";
}

function toggleAlarm(id) {
  const alarm = alarms.find((a) => a.id === id);
  if (alarm) {
    alarm.enabled = !alarm.enabled;
    saveAlarms();
    renderAlarms();
  }
}

function deleteAlarm(id) {
  alarms = alarms.filter((a) => a.id !== id);
  saveAlarms();
  renderAlarms();
}

function renderAlarms() {
  alarmListEl.innerHTML = "";

  alarms.forEach((alarm) => {
    const li = document.createElement("li");
    li.className = "alarm-item" + (alarm.enabled ? "" : " disabled");

    const info = document.createElement("div");
    info.className = "alarm-info";

    const timeEl = document.createElement("div");
    timeEl.className = "alarm-time";
    timeEl.textContent = alarm.time;

    const labelEl = document.createElement("div");
    labelEl.className = "alarm-label";
    labelEl.textContent = alarm.label || "";

    info.appendChild(timeEl);
    if (alarm.label) info.appendChild(labelEl);

    const controls = document.createElement("div");
    controls.className = "alarm-controls";

    const toggleWrap = document.createElement("label");
    toggleWrap.className = "toggle-switch";
    const toggleInput = document.createElement("input");
    toggleInput.type = "checkbox";
    toggleInput.checked = alarm.enabled;
    toggleInput.addEventListener("change", () => toggleAlarm(alarm.id));
    const toggleSlider = document.createElement("span");
    toggleSlider.className = "toggle-slider";
    toggleWrap.appendChild(toggleInput);
    toggleWrap.appendChild(toggleSlider);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.textContent = "✕";
    deleteBtn.setAttribute("aria-label", "削除");
    deleteBtn.addEventListener("click", () => deleteAlarm(alarm.id));

    controls.appendChild(toggleWrap);
    controls.appendChild(deleteBtn);

    li.appendChild(info);
    li.appendChild(controls);
    alarmListEl.appendChild(li);
  });
}

addAlarmBtn.addEventListener("click", addAlarm);
alarmLabelInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addAlarm();
});
stopAlarmBtn.addEventListener("click", stopAlarm);

renderAlarms();
updateClock();
setInterval(updateClock, 1000);
