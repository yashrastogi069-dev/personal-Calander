export const phase4PrototypeVariants = [
  { id: "a", name: "Verdigris Workbench" },
  { id: "b", name: "Quiet Agenda" },
  { id: "c", name: "Night Instrument" },
] as const;

type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T;

function deepFreeze<const T>(value: T): DeepReadonly<T> {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value as DeepReadonly<T>;
}

export const phase4PrototypeFixture = deepFreeze({
  localDate: "2026-09-14",
  ordinaryDay: {
    habitIds: ["habit-walk", "habit-medicine"],
    appointmentIds: ["appointment-dentist", "appointment-project-review"],
    taskIds: ["reply-samira", "read-lease", "buy-groceries", "prepare-dinner", "goal-next-action"],
  },
  tasks: [
    {
      id: "reply-samira",
      title: "Reply to Samira about the contractor estimate",
      kind: "reply",
      state: "waiting",
      scheduledLocalDate: "2026-09-14",
      effortMinutes: 15,
    },
    {
      id: "read-lease",
      title: "Read the revised lease document and mark questions",
      kind: "document-reading",
      state: "open",
      scheduledLocalDate: "2026-09-14",
      effortMinutes: null,
    },
    {
      id: "buy-groceries",
      title: "Buy groceries for the week",
      kind: "errand",
      state: "open",
      scheduledLocalDate: "2026-09-14",
      effortMinutes: 35,
    },
    {
      id: "prepare-dinner",
      title: "Prepare dinner before the evening call",
      kind: "home",
      state: "open",
      scheduledLocalDate: "2026-09-14",
      effortMinutes: 45,
    },
    {
      id: "goal-next-action",
      title: "Book the first preventative health screening",
      kind: "goal-linked",
      state: "open",
      scheduledLocalDate: "2026-09-14",
      effortMinutes: 20,
      goalId: "goal-health-screening",
    },
  ],
  appointments: [
    {
      id: "appointment-dentist",
      title: "Dentist appointment",
      startsAt: "2026-09-14T13:00:00+05:30",
      endsAt: "2026-09-14T14:00:00+05:30",
      actualEndsAt: "2026-09-14T14:45:00+05:30",
      status: "overrun",
    },
    {
      id: "appointment-project-review",
      title: "Quarterly project review",
      startsAt: "2026-09-14T17:30:00+05:30",
      endsAt: "2026-09-14T18:15:00+05:30",
      actualEndsAt: null,
      status: "scheduled",
    },
  ],
  habits: [
    { id: "habit-walk", title: "Morning walk", recurrence: "daily", occurrenceState: "done" },
    { id: "habit-medicine", title: "Take medicine", recurrence: "daily", occurrenceState: "due" },
  ],
  commitments: [
    { id: "commitment-reply", taskId: "reply-samira", title: "Send Samira a clear answer", pinned: true },
    { id: "commitment-reading", taskId: "read-lease", title: "Finish lease review", pinned: false },
  ],
  interruptedAfternoon: {
    overrunAppointmentId: "appointment-dentist",
    pinnedCommitmentId: "commitment-reply",
    displacedTaskIds: ["read-lease"],
    message: "The appointment ran long. The reply stays fixed; flexible reading no longer fits.",
  },
  capacity: {
    level: "low",
    availableMinutes: 90,
    appliesToLocalDate: "2026-09-14",
    preservesFutureDefault: true,
    unknownEffortTaskId: "read-lease",
    decisions: ["reduce", "pause"],
  },
  tenDayReturn: {
    daysAway: 10,
    unresolvedOneOffTaskIds: ["read-lease", "buy-groceries"],
    missedHabitOccurrenceCount: 10,
    generatedHabitChoreCount: 0,
  },
  waitingFor: {
    taskId: "reply-samira",
    status: "waiting",
    person: "Samira",
    followUpLocalDate: "2026-09-16",
    reservesWorkTime: false,
  },
  goals: [
    {
      id: "goal-home",
      title: "Settle into the new home",
      intention: "outcome",
      dueLocalDate: "2026-12-31",
      milestoneCount: 3,
      nextActionTaskId: null,
    },
    {
      id: "goal-health-screening",
      title: "Complete preventative health screening",
      intention: "outcome",
      dueLocalDate: "2026-11-15",
      milestoneCount: 2,
      nextActionTaskId: "goal-next-action",
    },
  ],
  directions: [
    {
      id: "direction-health",
      title: "Keep health steady",
      intention: "direction",
      status: "continuing",
      habitIds: ["habit-walk", "habit-medicine"],
      reviewLocalDate: "2026-09-21",
    },
  ],
  projects: [
    {
      id: "project-quarterly",
      title: "Quarterly planning refresh",
      startLocalDate: "2026-09-20",
      dueLocalDate: "2026-11-30",
      goalId: "goal-health-screening",
    },
    {
      id: "project-home",
      title: "Home move follow-through",
      startLocalDate: "2026-10-15",
      dueLocalDate: "2026-12-20",
      goalId: "goal-home",
    },
  ],
  roadmap: {
    dependencies: [{ fromProjectId: "project-quarterly", toProjectId: "project-home" }],
    movePreview: {
      projectId: "project-quarterly",
      startLocalDate: "2026-10-01",
      dueLocalDate: "2026-12-15",
      unchangedFields: ["goal.dueLocalDate"],
    },
  },
  recurrence: {
    scheduled: {
      seriesId: "series-weekly-planning",
      occurrenceId: "occurrence-weekly-planning-2026-09-14",
      anchor: "schedule",
      skipScope: "occurrence",
    },
    completionAnchored: {
      seriesId: "series-water-plants",
      occurrenceId: "occurrence-water-plants-2026-09-14",
      anchor: "completion",
      pauseScope: "series",
    },
  },
  offline: {
    taskWrite: "supported",
    taskState: "saved-locally",
    goalWrite: "unsupported",
    habitWrite: "unsupported",
    unsupportedState: "reconnect-required",
  },
  stress: {
    longTitle:
      "Review the complete household transition agreement, note every unresolved responsibility, confirm ownership, and prepare the questions that must be answered before anyone signs",
    crowdedWeekItemCount: 64,
    projectCount: 28,
    unscheduledTaskCount: 37,
    hiddenCategoryCount: 6,
  },
  archived: {
    recordId: "task-archived-insurance",
    recordType: "task",
    linkedGoalId: "goal-home",
    status: "archived",
    linkStatus: "unresolved",
    restoreAvailable: true,
    historyRetained: true,
  },
  conflict: {
    recordId: "reply-samira",
    status: "review-required",
    localValue: "Follow up Wednesday",
    remoteValue: "Follow up Friday",
    preservesBothValues: true,
  },
});

export type PrototypeState = {
  view: "today" | "tasks" | "roadmap" | "settings";
  completedTaskIds: readonly string[];
  recoveryCommitmentId: string | null;
  sheet: "task" | "capture" | "settings" | null;
  roadmapPreview: null | {
    projectId: string;
    startLocalDate: string;
    dueLocalDate: string;
    unchangedFields: readonly string[];
  };
};

export type PrototypeAction =
  | { type: "set-view"; view: PrototypeState["view"] }
  | { type: "complete-task"; taskId: string }
  | { type: "reopen-task"; taskId: string }
  | { type: "open-recovery"; commitmentId: string }
  | { type: "close-recovery" }
  | { type: "open-sheet"; sheet: Exclude<PrototypeState["sheet"], null> }
  | { type: "close-sheet" }
  | { type: "preview-roadmap-move"; projectId: string; startLocalDate: string; dueLocalDate: string }
  | { type: "cancel-roadmap-preview" };

function freezeState(state: PrototypeState): PrototypeState {
  return deepFreeze({
    ...state,
    completedTaskIds: [...state.completedTaskIds],
    roadmapPreview:
      state.roadmapPreview === null
        ? null
        : {
            ...state.roadmapPreview,
            unchangedFields: [...state.roadmapPreview.unchangedFields],
          },
  }) as PrototypeState;
}

export function createPrototypeState(): PrototypeState {
  return freezeState({
    view: "today",
    completedTaskIds: [],
    recoveryCommitmentId: null,
    sheet: null,
    roadmapPreview: null,
  });
}

export function reducePrototypeState(state: PrototypeState, action: PrototypeAction): PrototypeState {
  switch (action.type) {
    case "set-view":
      return action.view === state.view ? state : freezeState({ ...state, view: action.view });
    case "complete-task": {
      if (!phase4PrototypeFixture.tasks.some(task => task.id === action.taskId) || state.completedTaskIds.includes(action.taskId)) {
        return state;
      }
      return freezeState({ ...state, completedTaskIds: [...state.completedTaskIds, action.taskId] });
    }
    case "reopen-task": {
      if (!phase4PrototypeFixture.tasks.some(task => task.id === action.taskId) || !state.completedTaskIds.includes(action.taskId)) {
        return state;
      }
      return freezeState({ ...state, completedTaskIds: state.completedTaskIds.filter(taskId => taskId !== action.taskId) });
    }
    case "open-recovery":
      if (!phase4PrototypeFixture.commitments.some(commitment => commitment.id === action.commitmentId)) return state;
      return action.commitmentId === state.recoveryCommitmentId
        ? state
        : freezeState({ ...state, recoveryCommitmentId: action.commitmentId });
    case "close-recovery":
      return state.recoveryCommitmentId === null ? state : freezeState({ ...state, recoveryCommitmentId: null });
    case "open-sheet":
      return action.sheet === state.sheet ? state : freezeState({ ...state, sheet: action.sheet });
    case "close-sheet":
      return state.sheet === null ? state : freezeState({ ...state, sheet: null });
    case "preview-roadmap-move": {
      if (!phase4PrototypeFixture.projects.some(project => project.id === action.projectId)) return state;
      const unchangedFields = phase4PrototypeFixture.roadmap.movePreview.unchangedFields;
      return freezeState({
        ...state,
        roadmapPreview: {
          projectId: action.projectId,
          startLocalDate: action.startLocalDate,
          dueLocalDate: action.dueLocalDate,
          unchangedFields: [...unchangedFields],
        },
      });
    }
    case "cancel-roadmap-preview":
      return state.roadmapPreview === null ? state : freezeState({ ...state, roadmapPreview: null });
  }
}
