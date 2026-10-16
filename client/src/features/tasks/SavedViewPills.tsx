// Tasks T2b-2: saved views as pills under the tabs (owner decision Q8, prototype "Saved-view pills"). "All"
// clears every filter; each owner view shows a live count (the same row rules as the List/Board, via
// savedTaskViewCount). When the current filters differ from the applied view, a dashed "Save view" pill
// appears and is named inline. Clicking the active owner pill opens Rename · Move left · Move right · Delete.
// Views are `savedViews` rows; their order is a key in the jsonb `configuration` (no migration).
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { ArrowLeft, ArrowRight, Bookmark, BookmarkPlus, Pencil, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { RollingCount } from "@/components/premium/FilterChips";
import { cn } from "@/lib/utils";

export type SavedViewPill = { id: string; name: string; count: number };

export type SavedViewPillsProps = {
  pills: readonly SavedViewPill[];
  allCount: number;
  activeId: string | null;
  /** Show the dashed Save view pill. */
  canSave: boolean;
  busy?: boolean;
  onApply: (id: string | null) => void;
  onCreate: (name: string) => void | Promise<unknown>;
  onRename: (id: string, name: string) => void | Promise<unknown>;
  onMove: (id: string, direction: -1 | 1) => void | Promise<unknown>;
  onDelete: (id: string) => void | Promise<unknown>;
  className?: string;
};

function NameInput({ initial, label, onDone, onCancel }: { initial: string; label: string; onDone: (name: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement | null>(null);
  // Enter unmounts the input, which can also fire blur: settle exactly once.
  const settled = useRef(false);
  const finish = (name: string | null) => {
    if (settled.current) return;
    settled.current = true;
    if (name) onDone(name);
    else onCancel();
  };
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (value.trim()) finish(value.trim());
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      finish(null);
    }
  };
  return (
    <span className="tk-vpill is-save is-naming">
      <BookmarkPlus size={14} strokeWidth={2} aria-hidden="true" />
      <input ref={ref} className="tk-vpill-input" value={value} maxLength={120} placeholder="Name this view" aria-label={label} onChange={event => setValue(event.target.value)} onKeyDown={onKeyDown} onBlur={() => finish(value.trim() || null)} />
    </span>
  );
}

export function SavedViewPills({ pills, allCount, activeId, canSave, busy = false, onApply, onCreate, onRename, onMove, onDelete, className }: SavedViewPillsProps) {
  const [naming, setNaming] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => {
    if (!menuFor) setConfirmDelete(false);
  }, [menuFor]);

  return (
    <div className={cn("tk-vpills", className)} role="toolbar" aria-label="Saved views" aria-busy={busy || undefined}>
      <button type="button" className={cn("tk-vpill is-all pc-focusable", !activeId && "is-on")} aria-pressed={!activeId} onClick={() => onApply(null)}>
        All <RollingCount value={allCount} className="tk-vpill-count" />
      </button>
      {pills.length ? <span className="tk-vpill-sep" aria-hidden="true" /> : null}
      {pills.map((pill, index) => {
        if (renaming === pill.id) {
          return <NameInput key={pill.id} initial={pill.name} label={`Rename ${pill.name}`} onCancel={() => setRenaming(null)} onDone={name => { setRenaming(null); if (name !== pill.name) void onRename(pill.id, name); }} />;
        }
        const active = activeId === pill.id;
        const button = (
          <button
            type="button"
            className={cn("tk-vpill pc-focusable", active && "is-on")}
            aria-pressed={active}
            aria-haspopup={active ? "menu" : undefined}
            data-view-id={pill.id}
            onClick={active ? undefined : () => onApply(pill.id)}
          >
            <Bookmark size={14} strokeWidth={2} aria-hidden="true" />
            <span className="tk-vpill-name">{pill.name}</span>
            <RollingCount value={pill.count} className="tk-vpill-count" />
          </button>
        );
        if (!active) return <span key={pill.id} className="tk-vpill-slot">{button}</span>;
        return (
          <PopoverPrimitive.Root key={pill.id} open={menuFor === pill.id} onOpenChange={open => setMenuFor(open ? pill.id : null)}>
            <PopoverPrimitive.Trigger asChild>{button}</PopoverPrimitive.Trigger>
            <PopoverPrimitive.Portal>
              <PopoverPrimitive.Content className="tk-menu tk-vpill-menu" align="start" sideOffset={6} collisionPadding={12} aria-label={`${pill.name} view`}>
                {confirmDelete ? (
                  <div className="tk-vpill-confirm" role="alert">
                    <p>Delete "{pill.name}"? Your tasks stay as they are.</p>
                    <div className="tk-vpill-confirm-actions">
                      <button type="button" className="tk-btn is-quiet pc-focusable" onClick={() => setConfirmDelete(false)}><X size={14} strokeWidth={2} aria-hidden="true" />Keep</button>
                      <button type="button" className="tk-btn is-danger pc-focusable" onClick={() => { setMenuFor(null); void onDelete(pill.id); }}><Trash2 size={14} strokeWidth={2} aria-hidden="true" />Delete view</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button type="button" className="tk-menu-item" onClick={() => { setMenuFor(null); setRenaming(pill.id); }}><Pencil size={15} strokeWidth={2} aria-hidden="true" /><span className="tk-menu-text"><span>Rename</span></span></button>
                    <button type="button" className="tk-menu-item" disabled={index === 0} onClick={() => { setMenuFor(null); void onMove(pill.id, -1); }}><ArrowLeft size={15} strokeWidth={2} aria-hidden="true" /><span className="tk-menu-text"><span>Move left</span></span></button>
                    <button type="button" className="tk-menu-item" disabled={index === pills.length - 1} onClick={() => { setMenuFor(null); void onMove(pill.id, 1); }}><ArrowRight size={15} strokeWidth={2} aria-hidden="true" /><span className="tk-menu-text"><span>Move right</span></span></button>
                    <button type="button" className="tk-menu-item is-danger" onClick={() => setConfirmDelete(true)}><Trash2 size={15} strokeWidth={2} aria-hidden="true" /><span className="tk-menu-text"><span>Delete</span></span></button>
                  </>
                )}
              </PopoverPrimitive.Content>
            </PopoverPrimitive.Portal>
          </PopoverPrimitive.Root>
        );
      })}
      {naming ? (
        <NameInput initial="" label="View name" onCancel={() => setNaming(false)} onDone={name => { setNaming(false); void onCreate(name); }} />
      ) : canSave ? (
        <button type="button" className="tk-vpill is-save pc-focusable pc-pop" onClick={() => setNaming(true)} disabled={busy}>
          <BookmarkPlus size={14} strokeWidth={2} aria-hidden="true" />Save view
        </button>
      ) : null}
    </div>
  );
}
