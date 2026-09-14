import { Check, ChevronRight, Circle, Columns3, List, MoreHorizontal, Repeat2, TimerReset } from "lucide-react";
import { useState, type Dispatch } from "react";
import { phase4PrototypeFixture, type PrototypeAction, type PrototypeState } from "@shared/phase4Prototype";
import type { PrototypeLane } from "./PrototypeShell";

type PrototypeTasksProps = {
  state: PrototypeState;
  dispatch: Dispatch<PrototypeAction>;
  selectedLane: PrototypeLane;
  onSelectedLaneChange: (lane: PrototypeLane) => void;
};

type TaskRecord = (typeof phase4PrototypeFixture.tasks)[number];

function TaskRow({ task, done, dispatch }: { task: TaskRecord; done: boolean; dispatch: Dispatch<PrototypeAction> }) {
  const estimate = task.effortMinutes === null ? "Estimate unknown" : `${task.effortMinutes} min`;
  return (
    <article className={done ? "p4-board-task is-complete" : "p4-board-task"}>
      <button
        className="p4-task-check"
        type="button"
        aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
        aria-pressed={done}
        onClick={() => dispatch({ type: done ? "reopen-task" : "complete-task", taskId: task.id })}
      >
        {done ? <Check aria-hidden="true" /> : <Circle aria-hidden="true" />}
      </button>
      <button className="p4-board-task-main" type="button" onClick={() => dispatch({ type: "open-sheet", sheet: "task" })}>
        <strong>{task.title}</strong><small>{estimate} · {task.kind}</small>
      </button>
      <button className="p4-icon-button" type="button" aria-label={`More options for ${task.title}`}><MoreHorizontal aria-hidden="true" /></button>
    </article>
  );
}

export default function PrototypeTasks({ state, dispatch, selectedLane, onSelectedLaneChange }: PrototypeTasksProps) {
  const [mode, setMode] = useState<"board" | "list">("board");
  const tasks = phase4PrototypeFixture.tasks;
  const doneIds = state.completedTaskIds;
  const todo = tasks.filter(task => !doneIds.includes(task.id) && ["read-lease", "buy-groceries", "goal-next-action"].includes(task.id));
  const doing = tasks.filter(task => !doneIds.includes(task.id) && ["reply-samira", "prepare-dinner"].includes(task.id));
  const done = tasks.filter(task => doneIds.includes(task.id));

  return (
    <div className="p4-tasks">
      <header className="p4-page-intro p4-page-intro-compact">
        <div><p className="p4-kicker">Tasks / Shared records</p><h2>One body of work.<br /><em>Two useful lenses.</em></h2><p>List and Board change the view, never the identity of a task.</p></div>
        <div className="p4-mode-switch" aria-label="Task view">
          <button type="button" aria-pressed={mode === "list"} onClick={() => setMode("list")}><List aria-hidden="true" />List</button>
          <button type="button" aria-pressed={mode === "board"} onClick={() => setMode("board")}><Columns3 aria-hidden="true" />Board</button>
        </div>
      </header>

      <div className="p4-task-filterbar">
        <span>Open work</span><span>Planned: any day</span><span>5 records</span>
        <button type="button" aria-disabled="true">Saved views <ChevronRight aria-hidden="true" /></button>
      </div>

      <div className="p4-phone-lanes" role="tablist" aria-label="Task status lane">
        <button role="tab" type="button" aria-selected={selectedLane === "todo"} onClick={() => onSelectedLaneChange("todo")}>To do <span>{todo.length}</span></button>
        <button role="tab" type="button" aria-selected={selectedLane === "doing"} onClick={() => onSelectedLaneChange("doing")}>Doing <span>{doing.length}</span></button>
        <button role="tab" type="button" aria-selected={selectedLane === "done"} onClick={() => onSelectedLaneChange("done")}>Done <span>{done.length}</span></button>
      </div>

      {mode === "board" ? (
        <section className="p4-board" aria-label="Task board">
          <section className={selectedLane === "todo" ? "p4-lane p4-lane-todo is-selected" : "p4-lane p4-lane-todo"} data-lane="todo" aria-labelledby="p4-lane-todo-title">
            <header><div><i /><h3 id="p4-lane-todo-title">To do</h3></div><span>{todo.length}</span></header>
            <p>Clear candidates for the next commitment.</p>
            <div>{todo.map(task => <TaskRow key={task.id} task={task} done={false} dispatch={dispatch} />)}</div>
          </section>
          <section className={selectedLane === "doing" ? "p4-lane p4-lane-doing is-selected" : "p4-lane p4-lane-doing"} data-lane="doing" aria-labelledby="p4-lane-doing-title">
            <header><div><i /><h3 id="p4-lane-doing-title">Doing</h3></div><span>{doing.length}</span></header>
            <p>Active, waiting, or already in motion.</p>
            <div>{doing.map(task => <TaskRow key={task.id} task={task} done={false} dispatch={dispatch} />)}</div>
          </section>
          <section className={selectedLane === "done" ? "p4-lane p4-lane-done is-selected" : "p4-lane p4-lane-done"} data-lane="done" aria-labelledby="p4-lane-done-title">
            <header><div><i /><h3 id="p4-lane-done-title">Done</h3></div><span>{done.length}</span></header>
            <p>Finished work remains available as evidence.</p>
            <div>{done.length ? done.map(task => <TaskRow key={task.id} task={task} done dispatch={dispatch} />) : <div className="p4-lane-empty"><Check aria-hidden="true" /><strong>No completions yet</strong><span>Completed tasks will settle here.</span></div>}</div>
          </section>
        </section>
      ) : (
        <section className="p4-list-view" aria-label="Task list">
          <header><span>Status</span><span>Task</span><span>Plan</span><span>Effort</span></header>
          {tasks.map(task => {
            const completed = doneIds.includes(task.id);
            return (
              <article key={task.id}>
                <button type="button" className="p4-task-check" aria-label={completed ? `Reopen ${task.title}` : `Complete ${task.title}`} onClick={() => dispatch({ type: completed ? "reopen-task" : "complete-task", taskId: task.id })}>{completed ? <Check aria-hidden="true" /> : <Circle aria-hidden="true" />}</button>
                <button type="button" onClick={() => dispatch({ type: "open-sheet", sheet: "task" })}><strong>{task.title}</strong><small>{task.kind}</small></button>
                <time dateTime={task.scheduledLocalDate}>14 Sep</time>
                <span>{task.effortMinutes === null ? "Unknown" : `${task.effortMinutes} min`}</span>
              </article>
            );
          })}
        </section>
      )}

      <aside className="p4-task-boundary">
        <Repeat2 aria-hidden="true" /><div><strong>Recurring boundary</strong><span>Skipping Monday planning affects this occurrence only. Pausing Water plants affects the series.</span></div>
        <TimerReset aria-hidden="true" />
      </aside>
    </div>
  );
}
