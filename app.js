const form = document.querySelector("#timer-form");
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

const phaseCopy = {
  work: "Ejercicio",
  rest: "Descanso corto",
  longRest: "Descanso largo",
  done: "Completado",
};

function getNumber(id) {
  const value = Number(document.querySelector(id).value);
  return Number.isFinite(value) ? value : 0;
}

function readSettings() {
  return {
    workSeconds: Math.max(1, getNumber("#work-seconds")),
    restSeconds: Math.max(0, getNumber("#rest-seconds")),
    repetitions: Math.max(1, getNumber("#repetitions")),
    longRestSeconds: Math.max(0, getNumber("#long-rest-seconds")),
    exerciseCount: Math.max(1, getNumber("#exercise-count")),
    roundCount: Math.max(1, getNumber("#round-count")),
    soundEnabled: document.querySelector("#sound-enabled").checked,
  };
}

function buildTimeline(config) {
  const steps = [];

  for (let round = 1; round <= config.roundCount; round += 1) {
    for (let exercise = 1; exercise <= config.exerciseCount; exercise += 1) {
      for (let rep = 1; rep <= config.repetitions; rep += 1) {
        steps.push({
          type: "work",
          duration: config.workSeconds,
          round,
          exercise,
          rep,
        });

        const isLastRep = rep === config.repetitions;
        const isLastExercise = exercise === config.exerciseCount;
        const isLastRound = round === config.roundCount;

        if (!isLastRep && config.restSeconds > 0) {
          steps.push({
            type: "rest",
            duration: config.restSeconds,
            round,
            exercise,
            rep,
          });
        }

        if (isLastRep && (!isLastExercise || !isLastRound) && config.longRestSeconds > 0) {
          steps.push({
            type: "longRest",
            duration: config.longRestSeconds,
            round,
            exercise,
            rep,
          });
        }
      }
    }
  }

  return steps;
}

function formatTime(seconds) {
  const safeSeconds = Math.max(0, seconds);
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function describeNextStep() {
  const next = timeline[currentIndex + 1];

  if (!next) {
    return "Siguiente: finalizar";
  }

  if (next.type === "work") {
    return `Siguiente: ejercicio ${next.exercise}, rep ${next.rep}`;
  }

  return `Siguiente: ${phaseCopy[next.type].toLowerCase()}`;
}

function updateProgressRing() {
  const elapsed = totalForPhase - remaining;
  const ratio = totalForPhase > 0 ? elapsed / totalForPhase : 1;
  ringProgress.style.strokeDashoffset = String(circumference * Math.min(Math.max(ratio, 0), 1));
}

function render() {
  const step = timeline[currentIndex];

  if (!step) {
    stage.dataset.phase = "done";
    phasePill.textContent = "Completado";
    phaseLabel.textContent = "Buen trabajo";
    timeDisplay.textContent = "00:00";
    nextLabel.textContent = "Entrenamiento terminado";
    ringProgress.style.strokeDashoffset = String(circumference);
    pauseButton.textContent = "Repetir";
    return;
  }

  stage.dataset.phase = step.type;
  phasePill.textContent = phaseCopy[step.type];
  phaseLabel.textContent = phaseCopy[step.type];
  timeDisplay.textContent = formatTime(remaining);
  nextLabel.textContent = describeNextStep();
  repDisplay.textContent = `${step.rep}/${settings.repetitions}`;
  exerciseDisplay.textContent = `${step.exercise}/${settings.exerciseCount}`;
  roundDisplay.textContent = `${step.round}/${settings.roundCount}`;
  pauseButton.textContent = paused ? "Reanudar" : "Pausar";
  updateProgressRing();
}

function beep(frequency = 760, duration = 0.12) {
  if (!settings?.soundEnabled) {
    return;
  }

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

function loadStep(index) {
  currentIndex = index;
  const step = timeline[currentIndex];

  if (!step) {
    finishWorkout();
    return;
  }

  remaining = step.duration;
  totalForPhase = step.duration || 1;
  beep(step.type === "work" ? 880 : 520);
  render();
}

function tick() {
  if (paused) {
    return;
  }

  remaining -= 1;

  if (remaining <= 0) {
    loadStep(currentIndex + 1);
    return;
  }

  if (remaining <= 3) {
    beep(980, 0.07);
  }

  render();
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
  render();
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
  if (!settings) {
    return;
  }

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

form.addEventListener("submit", (event) => {
  event.preventDefault();
  startWorkout(readSettings());
});

pauseButton.addEventListener("click", () => {
  if (currentIndex >= timeline.length) {
    startWorkout(settings);
    return;
  }

  paused = !paused;
  render();
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
