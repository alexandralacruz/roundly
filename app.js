// ============ i18n ============
const i18n = {
  es: {
    eyebrow: "Temporizador de intervalos",
    tagline: "entrena . supérate . evoluciona",
    work: "Ejercicio",
    workSmall: "Segundos por serie",
    rest: "Descanso corto",
    restSmall: "Entre repeticiones",
    reps: "Repeticiones",
    repsSmall: "Por ejercicio",
    longRest: "Descanso largo",
    longRestSmall: "Para cambiar de ejercicio",
    series: "Series",
    seriesSmall: "Por ronda",
    rounds: "Rondas",
    roundsSmall: "Bloques completos",
    calisthenics: "Calistenia 30/15",
    custom: "Personalizado",
    cycle1: "Un ciclo se repite varias veces",
    connector: "↓ luego un descanso largo ↓",
    cycle2: "Ese bloque se repite en series y rondas",
    duration: "Duración total estimada",
    sounds: "Sonidos de cambio",
    start: "Iniciar entrenamiento",
    workPhase: "Ejercicio",
    restPhase: "Descanso corto",
    longRestPhase: "Descanso largo",
    donePhase: "Completado",
    doneLabel: "Buen trabajo",
    doneMessage: "Entrenamiento terminado",
    pause: "Pausar",
    resume: "Reanudar",
    repeat: "Repetir",
    reset: "Reiniciar",
    back: "←",
    fullscreen: "⛶",
    repLabel: "Repetición",
    exerciseLabel: "Ejercicio",
    roundLabel: "Ronda",
    nextPrefix: "Siguiente:",
    nextFinish: "finalizar",
  },
  en: {
    eyebrow: "Interval Timer",
    tagline: "train . improve . evolve",
    work: "Work",
    workSmall: "Seconds per set",
    rest: "Short rest",
    restSmall: "Between reps",
    reps: "Repetitions",
    repsSmall: "Per exercise",
    longRest: "Long rest",
    longRestSmall: "To change exercise",
    series: "Series",
    seriesSmall: "Per round",
    rounds: "Rounds",
    roundsSmall: "Full blocks",
    calisthenics: "Calisthenics 30/15",
    custom: "Custom",
    cycle1: "One cycle repeats several times",
    connector: "↓ then a long rest ↓",
    cycle2: "That block repeats in series and rounds",
    duration: "Estimated total duration",
    sounds: "Sound alerts",
    start: "Start workout",
    workPhase: "Work",
    restPhase: "Short rest",
    longRestPhase: "Long rest",
    donePhase: "Completed",
    doneLabel: "Good work",
    doneMessage: "Workout finished",
    pause: "Pause",
    resume: "Resume",
    repeat: "Repeat",
    reset: "Reset",
    back: "←",
    fullscreen: "⛶",
    repLabel: "Rep",
    exerciseLabel: "Exercise",
    roundLabel: "Round",
    nextPrefix: "Next:",
    nextFinish: "finish",
  },
};

let currentLang = localStorage.getItem("roundly-lang") || "es";

function t(key) {
  return i18n[currentLang]?.[key] ?? key;
}

function applyLanguage() {
  // Update all data-i18n elements
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") return;
    el.textContent = t(el.dataset.i18n);
  });

  // Update document lang and title
  document.documentElement.lang = currentLang;
  document.title = currentLang === "es" ? "Roundly — Temporizador de intervalos" : "Roundly — Interval Timer";

  // Update lang tab buttons
  document.querySelectorAll(".lang-option").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.lang === currentLang);
  });

  // Re-render timer if running
  if (settings) renderTimerUI();

  // Update summary
  updateSummary();

  localStorage.setItem("roundly-lang", currentLang);
}

// Language tab click handler
document.getElementById("langTab").addEventListener("click", (e) => {
  const btn = e.target.closest(".lang-option");
  if (!btn) return;
  currentLang = btn.dataset.lang;
  applyLanguage();
});

// ============ DOM refs ============
const stage = document.querySelector(".timer-stage");
const phasePill = document.querySelector("#phase-pill");
const phaseLabel = document.querySelector("#phase-label");
const timeDisplay = document.querySelector("#time-display");
const nextLabel = document.querySelector("#next-label");
const repDisplay = document.querySelector("#rep-display");
const exerciseDisplay = document.querySelector("#exercise-display");
const roundDisplay = document.querySelector("#round-display");
const ringProgress = document.querySelector("#ring-progress");
const pauseButton = document.querySelector("#pause-button");
const resetButton = document.querySelector("#reset-button");
const backButton = document.querySelector("#back-button");
const fullscreenButton = document.querySelector("#fullscreen-button");
const startBtn = document.querySelector("#startBtn");
const totalDurationEl = document.querySelector("#totalDuration");

const circumference = 2 * Math.PI * 101;

let settings = null;
let timeline = [];
let currentIndex = 0;
let remaining = 0;
let totalForPhase = 1;
let intervalId = null;
let paused = false;
let audioContext = null;

ringProgress.style.strokeDasharray = `${circumference}`;

// ============ Setup helpers ============
function getNumber(id) {
  const value = Number(document.querySelector(`#${id}`).value);
  return Number.isFinite(value) ? value : 0;
}

function readSettings() {
  return {
    workSeconds: Math.max(1, getNumber("work-seconds")),
    restSeconds: Math.max(0, getNumber("rest-seconds")),
    repetitions: Math.max(1, getNumber("repetitions")),
    longRestSeconds: Math.max(0, getNumber("long-rest-seconds")),
    exerciseCount: Math.max(1, getNumber("exercise-count")),
    roundCount: Math.max(1, getNumber("round-count")),
    soundEnabled: document.querySelector("#sound-enabled").checked,
  };
}

function updateSummary() {
  const config = readSettings();
  const cycleSeconds = (config.workSeconds + config.restSeconds) * config.repetitions - config.restSeconds;
  const seriesSeconds = (cycleSeconds + config.longRestSeconds) * config.exerciseCount - config.longRestSeconds;
  const totalSeconds = Math.max(0, seriesSeconds * config.roundCount);

  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  totalDurationEl.textContent = `${mins} min ${secs} s`;
}

// Setup input listeners for summary
["work-seconds", "rest-seconds", "repetitions", "long-rest-seconds", "exercise-count", "round-count"].forEach((id) => {
  document.querySelector(`#${id}`)?.addEventListener("input", () => {
    setActivePreset(null);
    updateSummary();
  });
});

// ============ Presets ============
function setActivePreset(chip) {
  document.querySelectorAll(".preset-chip").forEach((c) => c.classList.remove("is-active"));
  if (chip) chip.classList.add("is-active");
}

document.querySelectorAll(".preset-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    setActivePreset(chip);
    if (chip.dataset.preset === "custom") return;

    document.querySelector("#work-seconds").value = chip.dataset.work;
    document.querySelector("#rest-seconds").value = chip.dataset.rest;
    document.querySelector("#long-rest-seconds").value = chip.dataset.longrest;
    document.querySelector("#repetitions").value = chip.dataset.reps;
    document.querySelector("#exercise-count").value = chip.dataset.series;
    document.querySelector("#round-count").value = chip.dataset.rounds;
    updateSummary();
  });
});

// ============ Timeline ============
function buildTimeline(config) {
  const steps = [];

  for (let round = 1; round <= config.roundCount; round += 1) {
    for (let exercise = 1; exercise <= config.exerciseCount; exercise += 1) {
      for (let rep = 1; rep <= config.repetitions; rep += 1) {
        steps.push({ type: "work", duration: config.workSeconds, round, exercise, rep });

        const isLastRep = rep === config.repetitions;
        const isLastExercise = exercise === config.exerciseCount;
        const isLastRound = round === config.roundCount;

        if (!isLastRep && config.restSeconds > 0) {
          steps.push({ type: "rest", duration: config.restSeconds, round, exercise, rep });
        }

        if (isLastRep && (!isLastExercise || !isLastRound) && config.longRestSeconds > 0) {
          steps.push({ type: "longRest", duration: config.longRestSeconds, round, exercise, rep });
        }
      }
    }
  }

  return steps;
}

// ============ UI helpers ============
function formatTime(seconds) {
  const safeSeconds = Math.max(0, seconds);
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function describeNextStep() {
  const next = timeline[currentIndex + 1];
  if (!next) return `${t("nextPrefix")} ${t("nextFinish")}`;
  if (next.type === "work") return `${t("nextPrefix")} ${t("exerciseLabel").toLowerCase()} ${next.exercise}, rep ${next.rep}`;
  const phaseMap = { rest: t("restPhase"), longRest: t("longRestPhase") };
  return `${t("nextPrefix")} ${(phaseMap[next.type] || "").toLowerCase()}`;
}

function updateProgressRing() {
  const elapsed = totalForPhase - remaining;
  const ratio = totalForPhase > 0 ? elapsed / totalForPhase : 1;
  ringProgress.style.strokeDashoffset = String(circumference * Math.min(Math.max(ratio, 0), 1));
}

function renderTimerUI() {
  const step = timeline[currentIndex];
  const phaseMap = { work: t("workPhase"), rest: t("restPhase"), longRest: t("longRestPhase") };

  if (!step) {
    stage.dataset.phase = "done";
    phasePill.textContent = t("donePhase");
    phaseLabel.textContent = t("doneLabel");
    timeDisplay.textContent = "00:00";
    nextLabel.textContent = t("doneMessage");
    ringProgress.style.strokeDashoffset = String(circumference);
    pauseButton.textContent = t("repeat");
    return;
  }

  stage.dataset.phase = step.type;
  phasePill.textContent = phaseMap[step.type];
  phaseLabel.textContent = phaseMap[step.type];
  timeDisplay.textContent = formatTime(remaining);
  nextLabel.textContent = describeNextStep();
  repDisplay.textContent = `${step.rep}/${settings.repetitions}`;
  exerciseDisplay.textContent = `${step.exercise}/${settings.exerciseCount}`;
  roundDisplay.textContent = `${step.round}/${settings.roundCount}`;
  pauseButton.textContent = paused ? t("resume") : t("pause");
  updateProgressRing();
}

// ============ Sound ============
function beep(frequency = 760, duration = 0.12) {
  if (!settings?.soundEnabled) return;

  audioContext ??= new AudioContext();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.frequency.value = frequency;
  oscillator.type = "sine";
  gain.gain.setValueAtTime(0.001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.18, audioContext.currentTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}

// ============ Timer logic ============
function loadStep(index) {
  currentIndex = index;
  const step = timeline[currentIndex];
  if (!step) { finishWorkout(); return; }
  remaining = step.duration;
  totalForPhase = step.duration || 1;
  beep(step.type === "work" ? 880 : 520);
  renderTimerUI();
}

function tick() {
  if (paused) return;
  remaining -= 1;
  if (remaining <= 0) { loadStep(currentIndex + 1); return; }
  if (remaining <= 3) beep(980, 0.07);
  renderTimerUI();
}

function startClock() {
  window.clearInterval(intervalId);
  intervalId = window.setInterval(tick, 1000);
}

function finishWorkout() {
  window.clearInterval(intervalId);
  intervalId = null;
  currentIndex = timeline.length;
  paused = true;
  beep(1040, 0.22);
  renderTimerUI();
}

function startWorkout(config) {
  settings = config;
  timeline = buildTimeline(settings);
  currentIndex = 0;
  paused = false;
  document.body.classList.add("timer-running");
  stage.classList.add("is-active");
  loadStep(0);
  startClock();
}

function resetWorkout() {
  if (!settings) return;
  paused = false;
  loadStep(0);
  startClock();
}

function closeStage() {
  window.clearInterval(intervalId);
  intervalId = null;
  paused = false;
  document.body.classList.remove("timer-running");
  stage.classList.remove("is-active");
  stage.dataset.phase = "work";
}

// ============ Event listeners ============
startBtn.addEventListener("click", () => {
  startWorkout(readSettings());
});

pauseButton.addEventListener("click", () => {
  if (currentIndex >= timeline.length) { startWorkout(settings); return; }
  paused = !paused;
  renderTimerUI();
});

resetButton.addEventListener("click", resetWorkout);
backButton.addEventListener("click", closeStage);

fullscreenButton.addEventListener("click", async () => {
  if (!document.fullscreenElement) {
    await document.documentElement.requestFullscreen();
  } else {
    await document.exitFullscreen();
  }
});

// ============ Init ============
updateSummary();
applyLanguage();
