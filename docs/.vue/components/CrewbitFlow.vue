<template>
  <div class="crewbit-wrapper" ref="wrapperRef">
    <div class="crewbit-grid">
      <div class="grid-cell">
        <div class="panel">
          <div class="panel-header">Jira / Issue Tracker</div>
          <div class="panel-body queue-container">
            <div ref="queueDockRef" class="dock-placeholder queue-dock"></div>

            <TransitionGroup name="list" tag="div">
              <div v-for="issue in queue" :key="issue.id" class="queue-item">
                {{ issue.text }}
              </div>
            </TransitionGroup>
          </div>
        </div>
      </div>

      <div class="grid-cell">
        <div class="agent-node" :class="{ processing: phase !== 'idle' }">
          <div ref="agentDockRef" class="dock-placeholder agent-dock"></div>

          <div class="ring ring-1"></div>
          <div class="ring ring-2"></div>
          <div class="core">crewbit</div>
          <div class="agent-status">{{ agentStatus }}</div>
        </div>
      </div>

      <div class="grid-cell">
        <div class="panel terminal-panel">
          <div class="panel-header mac-header">
            <span class="dot red"></span>
            <span class="dot yellow"></span>
            <span class="dot green"></span>
            <span class="title">workspace</span>
          </div>
          <div class="terminal-body">
            <div ref="terminalDockRef" class="dock-placeholder terminal-dock"></div>
            <div
              v-for="(line, i) in terminalLines"
              :key="i"
              class="term-line"
              :class="{ success: line.startsWith('✓') }"
            >
              {{ line }}
            </div>
            <div
              v-if="['working', 'done'].includes(phase)"
              class="term-cursor"
            ></div>
          </div>
        </div>
      </div>
    </div>

    <div
      class="card-active"
      :class="[{ done: phase === 'done', 'no-transition': !transitionEnabled }]"
      :style="dynamicCardStyle"
    >
      <span>{{ activeIssue?.text || "..." }}</span>
      <svg
        v-if="['done', 'fading'].includes(phase)"
        class="check-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="3"
          d="M5 13l4 4L19 7"
        />
      </svg>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from "vue";

// --- DOM Refs for Coordinate Math ---
const wrapperRef = ref(null);
const queueDockRef = ref(null);
const agentDockRef = ref(null);
const terminalDockRef = ref(null);

// --- Card Position State ---
const cardX = ref(0);
const cardY = ref(0);
const cardWidth = ref(0);
const cardOpacity = ref(0);

// --- App State ---
const allIssues = [
  { id: 1, text: "US-21: Add Auth UI" },
  { id: 2, text: "US-22: Fix API timeout" },
  { id: 3, text: "US-23: i18n Spanish" },
  { id: 4, text: "US-24: Update README" },
  { id: 5, text: "US-25: Write tests" },
];

const queue = ref([]);
const activeIssue = ref(null);
const phase = ref("idle");
const terminalLines = ref([]);
const transitionEnabled = ref(true);

// --- Computed ---
const agentStatus = computed(() => {
  if (phase.value === "idle" || phase.value === "fading") return "polling...";
  if (phase.value === "picking") return "fetching issue";
  if (phase.value === "fetching") return "spawning claude";
  if (phase.value === "working") return "claude running";
  if (phase.value === "done") return "merged PR!";
  return "";
});

const dynamicCardStyle = computed(() => ({
  transform: `translate(${cardX.value}px, ${cardY.value}px) translate(-50%, -50%)`,
  width: `${cardWidth.value}px`,
  opacity: cardOpacity.value,
}));

// --- Utils ---
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const refillQueue = () => {
  queue.value = allIssues.map((i) => ({ ...i }));
};

// --- The Core Math: Find Dock and Move Card ---
const moveToDock = (dockEl, show = true) => {
  if (!dockEl || !wrapperRef.value) return;

  const wrapperRect = wrapperRef.value.getBoundingClientRect();
  const targetRect = dockEl.getBoundingClientRect();

  cardX.value = targetRect.left - wrapperRect.left + targetRect.width / 2;
  cardY.value = targetRect.top - wrapperRect.top + targetRect.height / 2;
  cardWidth.value = targetRect.width;

  cardOpacity.value = show ? 1 : 0;
};

// Refreshes position on window resize so the animation doesn't break
const handleResize = () => {
  if (phase.value === "picking" || phase.value === "idle")
    moveToDock(queueDockRef.value, phase.value === "picking");
  if (phase.value === "fetching") moveToDock(agentDockRef.value);
  if (["working", "done", "fading"].includes(phase.value))
    moveToDock(terminalDockRef.value, phase.value !== "fading");
};

// --- Terminal Animation ---
const animateTerminal = async () => {
  terminalLines.value = [];
  await sleep(400);

  const steps = [
    `> crewbit ${activeIssue.value.text.split(":")[0]}`,
    "> spawn claude /develop",
    "Analyzing ticket...",
    "Writing code...",
    "Running tests...",
    "✓ PR Created & Merged",
  ];

  for (const step of steps) {
    terminalLines.value.push(step);
    await sleep(step.startsWith("✓") ? 200 : 500);
  }
};

// --- Main Loop ---
onMounted(() => {
  refillQueue();
  window.addEventListener("resize", handleResize);

  const loop = async () => {
    // Wait for Vue to render the DOM so bounding boxes exist
    await nextTick();

    while (true) {
      if (queue.value.length === 0) {
        refillQueue();
        await sleep(500);
      }

      // 1. IDLE (Snap invisibly to the queue dock)
      transitionEnabled.value = false;
      phase.value = "idle";
      terminalLines.value = [];
      moveToDock(queueDockRef.value, false);
      await sleep(1000);

      // 2. PICK FROM TRACKER
      transitionEnabled.value = true;
      activeIssue.value = queue.value[0];
      phase.value = "picking";
      moveToDock(queueDockRef.value, true);
      await sleep(600); // Let the card appear

      // 3. FETCH TO AGENT — remove item as card leaves so the list slides up simultaneously
      phase.value = "fetching";
      moveToDock(agentDockRef.value, true);
      queue.value.shift();
      await sleep(800);

      // 4. MOVE TO WORKTREE & RUN
      phase.value = "working";
      moveToDock(terminalDockRef.value, true);
      await sleep(600);
      await animateTerminal();

      // 5. DONE / MERGED
      phase.value = "done";
      await sleep(1200);

      // 6. FADE OUT
      phase.value = "fading";
      cardOpacity.value = 0;
      await sleep(350);

      // 7. SILENT RESET — wait two animation frames so the transition: none takes hold before moving
      transitionEnabled.value = false;
      await nextTick();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      phase.value = "idle";
    }
  };

  loop();
});

onUnmounted(() => {
  window.removeEventListener("resize", handleResize);
});
</script>

<style scoped>
/* WRAPPER & GRID SYSTEM */
.crewbit-wrapper {
  position: relative; /* CRITICAL: Acts as 0,0 for bounding box math */
  background: #020617; /* Slate 950 */
  border-radius: 16px;
  width: 100%;
  max-width: 1000px;
  margin: 0 auto;
  font-family: ui-sans-serif, system-ui, sans-serif;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  overflow: hidden;
}

.crewbit-grid {
  display: grid;
  /* Mobile: Stack vertically */
  grid-template-columns: 1fr;
  grid-template-rows: 280px 200px 280px;
}

@media (min-width: 768px) {
  .crewbit-grid {
    /* Desktop: Side by side */
    grid-template-columns: 1fr 1fr 1fr;
    grid-template-rows: 400px;
  }
}

.grid-cell {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 1.5rem;
}

/* PANELS */
.panel {
  background: #0f172a;
  border: 2px solid #1e293b;
  border-radius: 12px;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
}

.panel-header {
  background: #1e293b;
  padding: 0.75rem 1rem;
  font-size: 13px;
  font-weight: 600;
  color: #94a3b8;
  text-align: center;
  border-bottom: 1px solid #334155;
}

/* TRACKER QUEUE LIST */
.queue-container {
  position: relative;
  flex: 1;
  padding: 1rem;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.queue-item {
  width: calc(100% - 2rem);
  background: #1e293b;
  border: 1px solid #334155;
  padding: 0.5rem 0.75rem;
  margin-bottom: 0.5rem;
  border-radius: 6px;
  font-size: 12px;
  color: #cbd5e1;
}

/* Vue TransitionGroup Classes */
.list-move,
.list-enter-active,
.list-leave-active {
  transition: all 0.5s ease;
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateY(15px);
}
.list-leave-active {
  position: absolute; /* Lets remaining items slide up */
}

/* AGENT NODE */
.agent-node {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
}
.core {
  width: 70px;
  height: 70px;
  background: var(--vp-c-brand-1);
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  color: white;
  font-size: 13px;
  font-weight: 700;
  z-index: 10;
  box-shadow: 0 0 25px var(--vp-c-brand-soft);
}
.ring {
  position: absolute;
  border: 2px dashed var(--vp-c-brand-1);
  border-radius: 50%;
  opacity: 0;
}
.ring-1 {
  width: 110px;
  height: 110px;
}
.ring-2 {
  width: 90px;
  height: 90px;
}

.agent-status {
  color: var(--vp-c-brand-2);
  font-size: 12px;
  font-weight: 500;
  margin-top: 1rem;
}

/* Agent Processing Animations */
.agent-node.processing .ring-1 {
  animation:
    spin 5s linear infinite,
    pulse 2s ease-in-out infinite;
}
.agent-node.processing .ring-2 {
  animation:
    spin-rev 3s linear infinite,
    pulse 1.5s ease-in-out infinite;
}

@keyframes spin {
  100% {
    transform: rotate(360deg);
  }
}
@keyframes spin-rev {
  100% {
    transform: rotate(-360deg);
  }
}
@keyframes pulse {
  0%,
  100% {
    opacity: 0.2;
  }
  50% {
    opacity: 0.8;
  }
}

/* TERMINAL WORKTREE */
.mac-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0.5rem 1rem;
}
.mac-header .dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.red {
  background: #ef4444;
}
.yellow {
  background: #eab308;
}
.green {
  background: #22c55e;
}
.mac-header .title {
  margin: 0 auto;
}

.terminal-body {
  position: relative;
  background: #020617;
  flex: 1;
  padding: 1rem;
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 11px;
  color: #94a3b8;
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow: hidden;
}
.term-line.success {
  color: #10b981;
  font-weight: bold;
}
.term-cursor {
  width: 6px;
  height: 12px;
  background: #cbd5e1;
  animation: blink 1s step-end infinite;
}
@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
}

/* --- THE NEW DOCK SYSTEM --- */

/* Base setup for the invisible layout anchors */
.dock-placeholder {
  width: calc(100% - 2rem);
  height: 35px;
  pointer-events: none;
  visibility: hidden;
}

/* Dock 1: Absolute, positioned to match queue items exactly.
   Absolute 100% = padding-box (W), flow items 100% = content-box (W-2rem),
   so we need calc(100% - 4rem) to match queue-item's calc(100% - 2rem). */
.queue-dock {
  position: absolute;
  top: 1rem;
  left: 1rem;
  width: calc(100% - 4rem);
}

/* Dock 2: Hovers neatly below the agent core */
.agent-dock {
  position: absolute;
  top: 75%;
}

/* Dock 3: Top of terminal body — card appears as a subtitle below the title bar */
.terminal-dock {
  margin-bottom: 0.5rem;
  align-self: flex-start;
}

/* --- THE GLIDING CARD --- */
.card-active {
  position: absolute;
  top: 0;
  left: 0;
  padding: 0.5rem 0.75rem;
  background: var(--vp-c-brand-1);
  border: 1px solid var(--vp-c-brand-2);
  border-radius: 6px;
  color: #fff;
  font-weight: 600;
  font-size: 12px;
  box-shadow: 0 4px 20px var(--vp-c-brand-soft);
  z-index: 50;
  display: flex;
  justify-content: space-between;
  align-items: center;
  white-space: nowrap;
  overflow: hidden;

  transition:
    transform 0.6s cubic-bezier(0.4, 0, 0.2, 1),
    background 0.3s ease,
    border-color 0.3s ease,
    opacity 0.3s ease;
}

.card-active.done {
  background: #10b981;
  border-color: #34d399;
  box-shadow: 0 4px 20px rgba(16, 185, 129, 0.3);
}
.card-active.no-transition {
  transition: none !important;
}

.card-active span {
  overflow: hidden;
  text-overflow: ellipsis;
}

.check-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  margin-left: 4px;
}
</style>
