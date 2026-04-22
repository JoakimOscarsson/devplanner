import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent
} from "react";
import type { GraphNode } from "@pdp-helper/contracts-graph";
import { gatewayUrl } from "../../lib/gateway";
import {
  createSkillsGatewayPort,
  loadSkillsSnapshot,
  type SkillsSnapshot
} from "./skills-gateway";
import {
  buildSkillsPanelModel,
  EMPTY_SKILLS_SNAPSHOT,
  formatTagList,
  flattenVisibleSkillTree,
  interpretSkillTreeHotkey,
  moveSkillTreeSelection,
  parseTagList,
  resolveVisibleDropIndicator,
  type SkillTreeFilterState,
  type SkillTreeNodeModel
} from "./skills-model";

export interface SkillsSpotlightProps {
  readonly gatewayBaseUrl?: string;
  readonly snapshot?: SkillsSnapshot;
  readonly feedback?: string | null;
}

interface SkillEditorDraft {
  readonly label: string;
  readonly description: string;
  readonly tag: string;
  readonly color: string;
  readonly tagTouched: boolean;
  readonly colorTouched: boolean;
}

interface SkillEditorState {
  readonly mode:
    | "create-root"
    | "create-child"
    | "create-sibling"
    | "edit"
    | "bulk-edit";
  readonly nodeId?: string;
  readonly parentNodeId?: string;
  readonly selectedNodeIds?: readonly string[];
}

interface ChildCreateDefaults {
  readonly inheritParentTag: boolean;
  readonly inheritParentColor: boolean;
}

interface DropIndicatorState {
  readonly targetNodeId: string;
  readonly position: "before" | "after";
}

type ActiveInteractionMode = "keyboard" | "pointer" | null;

type SkillTreeSelectionInput = {
  readonly nodeId: string;
  readonly multiSelectEnabled: boolean;
  readonly draggedNodeId: string | null;
};

type SkillTreeBulkDeleteSummary = {
  readonly topLevelCount: number;
  readonly totalCount: number;
};

const COLOR_OPTIONS = [
  "",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899"
] as const;

function formatColorFilterLabel(color: string) {
  return color.toUpperCase();
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to load skill tree data.";
}

function createEmptyDraft(): SkillEditorDraft {
  return {
    label: "",
    description: "",
    tag: "",
    color: "",
    tagTouched: false,
    colorTouched: false
  };
}

function createDraftFromNode(node: SkillTreeNodeModel): SkillEditorDraft {
  return {
    label: node.label,
    description: node.description ?? "",
    tag: formatTagList(node.tags),
    color: node.color ?? "",
    tagTouched: false,
    colorTouched: false
  };
}

export function shouldCloseSkillEditorFromPointerInteraction(input: {
  readonly startedOnBackdrop: boolean;
  readonly endedOnBackdrop: boolean;
}) {
  return input.startedOnBackdrop && input.endedOnBackdrop;
}

export function resolveSkillTreeSelectionFromPointer(input: SkillTreeSelectionInput) {
  if (input.multiSelectEnabled || input.draggedNodeId) {
    return null;
  }

  return input.nodeId;
}

export function resolveSkillTreeDropIndicatorFromPointer(input: {
  readonly rowId: string;
  readonly isLastVisibleRow: boolean;
  readonly pointerY: number;
  readonly rowBottom: number;
  readonly endThreshold?: number;
}): DropIndicatorState {
  const threshold = input.endThreshold ?? 8;

  if (input.isLastVisibleRow && input.pointerY >= input.rowBottom - threshold) {
    return {
      targetNodeId: input.rowId,
      position: "after"
    };
  }

  return {
    targetNodeId: input.rowId,
    position: "before"
  };
}

export function resolveSkillTreeBulkDeleteSummary(
  treeRoots: readonly SkillTreeNodeModel[],
  selectedNodeIds: ReadonlySet<string>
): SkillTreeBulkDeleteSummary {
  const topLevelIds = collectTopLevelSelectedIds(treeRoots, selectedNodeIds);
  const totalNodeIds = collectBulkTargetIds(treeRoots, new Set(topLevelIds), true);

  return {
    topLevelCount: topLevelIds.length,
    totalCount: totalNodeIds.length
  };
}

function readStoredBoolean(key: string, fallback: boolean) {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const value = window.localStorage.getItem(key);

    if (value === "true") {
      return true;
    }

    if (value === "false") {
      return false;
    }
  } catch {
    return fallback;
  }

  return fallback;
}

function findTreeNodeById(
  nodes: readonly SkillTreeNodeModel[],
  nodeId: string
): SkillTreeNodeModel | null {
  for (const node of nodes) {
    if (node.id === nodeId) {
      return node;
    }

    const nestedMatch = findTreeNodeById(node.children, nodeId);

    if (nestedMatch) {
      return nestedMatch;
    }
  }

  return null;
}

function findSiblingIds(
  nodes: readonly SkillTreeNodeModel[],
  parentId?: string
): string[] {
  if (parentId === undefined) {
    return nodes.map((node) => node.id);
  }

  const parentNode = findTreeNodeById(nodes, parentId);
  return parentNode ? parentNode.children.map((child) => child.id) : [];
}

function collectDescendantSkillIds(node: SkillTreeNodeModel, result = new Set<string>()) {
  for (const child of node.children) {
    if (child.kind !== "skill") {
      continue;
    }

    result.add(child.id);
    collectDescendantSkillIds(child, result);
  }

  return result;
}

function collectBulkTargetIds(
  treeRoots: readonly SkillTreeNodeModel[],
  selectedNodeIds: ReadonlySet<string>,
  includeChildren: boolean
) {
  const ids = new Set<string>();

  for (const selectedNodeId of selectedNodeIds) {
    const node = findTreeNodeById(treeRoots, selectedNodeId);

    if (!node || node.kind !== "skill") {
      continue;
    }

    ids.add(node.id);

    if (includeChildren) {
      collectDescendantSkillIds(node, ids);
    }
  }

  return [...ids];
}

function collectTopLevelSelectedIds(
  treeRoots: readonly SkillTreeNodeModel[],
  selectedNodeIds: ReadonlySet<string>
) {
  const selected = new Set(selectedNodeIds);
  const topLevelIds: string[] = [];

  function visit(nodes: readonly SkillTreeNodeModel[], ancestorSelected: boolean) {
    for (const node of nodes) {
      const isSelected = selected.has(node.id);

      if (isSelected && !ancestorSelected && node.kind === "skill") {
        topLevelIds.push(node.id);
      }

      visit(node.children, ancestorSelected || isSelected);
    }
  }

  visit(treeRoots, false);
  return topLevelIds;
}

function createIconPath(kind: "add" | "edit" | "delete") {
  switch (kind) {
    case "add":
      return (
        <path
          d="M6 2.5v7M2.5 6h7"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.4"
        />
      );
    case "edit":
      return (
        <path
          d="M2.5 9.5 3 7.4 7.9 2.5a1.1 1.1 0 0 1 1.6 0l.9.9a1.1 1.1 0 0 1 0 1.6L5.5 10l-2.1.5Zm0 0H10"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.2"
        />
      );
    case "delete":
      return (
        <path
          d="M3.2 4.2h5.6M4.2 4.2V3.4c0-.5.4-.9.9-.9h1.8c.5 0 .9.4.9.9v.8m-4.3 0 .3 5.1c0 .6.5 1 1.1 1H7c.6 0 1-.4 1.1-1l.3-5.1M5.2 5.5v3.1M6.8 5.5v3.1"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.1"
        />
      );
  }
}

function SkillActionIcon({ kind }: { readonly kind: "add" | "edit" | "delete" }) {
  return (
    <svg
      aria-hidden="true"
      className="skill-tree__action-icon"
      viewBox="0 0 12 12"
      fill="none"
    >
      {createIconPath(kind)}
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg aria-hidden="true" className="skill-tree__action-icon" viewBox="0 0 12 12" fill="none">
      <path
        d="M2 3h8M3.5 6h5M5 9h2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.25"
      />
    </svg>
  );
}

function SkillEditorModal({
  state,
  draft,
  pending,
  bulkSelectionCount,
  applyToChildren,
  inheritParentTag,
  inheritParentColor,
  parentTag,
  parentColor,
  onDraftChange,
  onApplyToChildrenChange,
  onInheritParentTagChange,
  onInheritParentColorChange,
  onCancel,
  onSubmit
}: {
  readonly state: SkillEditorState;
  readonly draft: SkillEditorDraft;
  readonly pending: boolean;
  readonly bulkSelectionCount?: number;
  readonly applyToChildren?: boolean;
  readonly inheritParentTag?: boolean;
  readonly inheritParentColor?: boolean;
  readonly parentTag?: string;
  readonly parentColor?: string;
  readonly onDraftChange: (draft: SkillEditorDraft) => void;
  readonly onApplyToChildrenChange?: (checked: boolean) => void;
  readonly onInheritParentTagChange?: (checked: boolean) => void;
  readonly onInheritParentColorChange?: (checked: boolean) => void;
  readonly onCancel: () => void;
  readonly onSubmit: () => void;
}) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const pointerStartedOnBackdrop = useRef(false);
  const isBulkEdit = state.mode === "bulk-edit";
  const isCreateChild = state.mode === "create-child";
  const submitDisabled =
    pending ||
    (isBulkEdit
      ? !draft.tagTouched && !draft.colorTouched
      : draft.label.trim().length === 0);

  useEffect(() => {
    const firstFocusable = formRef.current?.querySelector<HTMLElement>(
      "input:not([disabled]), textarea:not([disabled]), button:not([disabled])"
    );
    firstFocusable?.focus();
  }, []);

  return (
    <div
      className="skill-modal-backdrop"
      role="presentation"
      onPointerDown={(event) => {
        pointerStartedOnBackdrop.current = event.target === event.currentTarget;
      }}
      onPointerUp={(event) => {
        const endedOnBackdrop = event.target === event.currentTarget;

        if (
          shouldCloseSkillEditorFromPointerInteraction({
            startedOnBackdrop: pointerStartedOnBackdrop.current,
            endedOnBackdrop
          })
        ) {
          onCancel();
        }

        pointerStartedOnBackdrop.current = false;
      }}
      onPointerCancel={() => {
        pointerStartedOnBackdrop.current = false;
      }}
    >
      <form
        ref={formRef}
        className="skill-modal"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div className="skill-modal__header">
          <h2>
            {isBulkEdit ? "Bulk Edit Skills" : state.mode === "edit" ? "Edit Skill" : "Add Skill"}
          </h2>
          {isBulkEdit ? (
            <p className="skill-modal__subcopy">
              {bulkSelectionCount} skills selected
            </p>
          ) : null}
        </div>

        <label className="skill-modal__field">
          <span>Label *</span>
          <input
            value={draft.label}
            placeholder={
              isBulkEdit ? "Multiple skills selected" : "e.g. Architecture & System Design"
            }
            disabled={isBulkEdit}
            onChange={(event) =>
              onDraftChange({
                ...draft,
                label: event.target.value
              })
            }
          />
        </label>

        <label className="skill-modal__field">
          <span>Description</span>
          <textarea
            value={draft.description}
            placeholder={
              isBulkEdit ? "Multiple skills selected" : "Optional notes or context..."
            }
            disabled={isBulkEdit}
            onChange={(event) =>
              onDraftChange({
                ...draft,
                description: event.target.value
              })
            }
          />
        </label>

        <label className="skill-modal__field">
          <span>Tag</span>
          <input
            value={isCreateChild && inheritParentTag ? parentTag ?? "" : draft.tag}
            placeholder={
              isBulkEdit
                ? "Leave untouched unless you want to update tags"
                : "e.g. technical, leadership; mentoring"
            }
            disabled={isCreateChild && inheritParentTag}
            onChange={(event) =>
              onDraftChange({
                ...draft,
                tag: event.target.value,
                tagTouched: true
              })
            }
          />
        </label>

        {isCreateChild ? (
          <label className="skill-modal__checkbox">
            <input
              type="checkbox"
              checked={Boolean(inheritParentTag)}
              onChange={(event) => onInheritParentTagChange?.(event.target.checked)}
            />
            <span>Inherit parent tag</span>
          </label>
        ) : null}

        <div className="skill-modal__field">
          <span>Color</span>
          <div className="skill-modal__colors">
            {COLOR_OPTIONS.map((color) => (
              <button
                key={color || "none"}
                type="button"
                className={
                  (isCreateChild && inheritParentColor ? parentColor ?? "" : draft.color) === color
                    ? "skill-modal__color skill-modal__color--active"
                    : "skill-modal__color"
                }
                aria-label={color ? `Select ${color}` : "Clear color"}
                disabled={isCreateChild && inheritParentColor}
                onClick={() =>
                  onDraftChange({
                    ...draft,
                    color,
                    colorTouched: true
                  })
                }
              >
                <span
                  className={color ? "skill-modal__swatch" : "skill-modal__swatch skill-modal__swatch--empty"}
                  style={color ? { background: color } : undefined}
                >
                  {color ? null : "×"}
                </span>
              </button>
            ))}
          </div>
        </div>

        {isCreateChild ? (
          <label className="skill-modal__checkbox">
            <input
              type="checkbox"
              checked={Boolean(inheritParentColor)}
              onChange={(event) => onInheritParentColorChange?.(event.target.checked)}
            />
            <span>Inherit parent color</span>
          </label>
        ) : null}

        {isBulkEdit ? (
          <label className="skill-modal__checkbox">
            <input
              type="checkbox"
              checked={Boolean(applyToChildren)}
              onChange={(event) => onApplyToChildrenChange?.(event.target.checked)}
            />
            <span>Also apply tags and color to children of the selected skills</span>
          </label>
        ) : null}

        <div className="skill-modal__actions">
          <button
            type="button"
            className="skill-modal__secondary"
            onClick={onCancel}
            disabled={pending}
          >
            Cancel
          </button>
          <button type="submit" disabled={submitDisabled}>
            {isBulkEdit ? "Apply" : state.mode === "edit" ? "Save" : "Add"}
          </button>
        </div>
      </form>
    </div>
  );
}

function focusTreeSurface(target: HTMLElement | null) {
  if (!target) {
    return;
  }

  requestAnimationFrame(() => {
    target.focus();
  });
}

export function SkillsSpotlight({
  gatewayBaseUrl = gatewayUrl,
  snapshot,
  feedback
}: SkillsSpotlightProps) {
  const gateway = useMemo(
    () => createSkillsGatewayPort(gatewayBaseUrl),
    [gatewayBaseUrl]
  );
  const [localSnapshot, setLocalSnapshot] = useState<SkillsSnapshot | null>(
    snapshot ?? null
  );
  const [loading, setLoading] = useState(snapshot ? false : true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(feedback ?? null);
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(new Set());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<ReadonlySet<string>>(new Set());
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [activeInteractionMode, setActiveInteractionMode] =
    useState<ActiveInteractionMode>(null);
  const [multiSelectEnabled, setMultiSelectEnabled] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<SkillTreeFilterState>({
    tags: [],
    colors: []
  });
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [editorState, setEditorState] = useState<SkillEditorState | null>(null);
  const [editorDraft, setEditorDraft] = useState<SkillEditorDraft>(createEmptyDraft);
  const [pendingMutation, setPendingMutation] = useState(false);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicatorState | null>(null);
  const [bulkApplyToChildren, setBulkApplyToChildren] = useState(false);
  const [childCreateDefaults, setChildCreateDefaults] = useState<ChildCreateDefaults>(() => ({
    inheritParentTag: readStoredBoolean("pdp-helper.skills.inherit-parent-tag", false),
    inheritParentColor: readStoredBoolean("pdp-helper.skills.inherit-parent-color", false)
  }));
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const treeSurfaceRef = useRef<HTMLElement | null>(null);
  const filterButtonRef = useRef<HTMLButtonElement | null>(null);
  const filterPanelRef = useRef<HTMLDivElement | null>(null);
  const didInitializeExpansion = useRef(false);
  const didAutoFocusTreeSurface = useRef(false);

  async function refreshSnapshot(note?: string, preferredSelectedNodeId?: string | null) {
    if (snapshot) {
      return;
    }

    setLoading(true);

    try {
      const nextSnapshot = await loadSkillsSnapshot(gateway);

      startTransition(() => {
        setLocalSnapshot(nextSnapshot);
        setToastMessage(note ?? null);
        if (preferredSelectedNodeId) {
          setSelectedNodeId(preferredSelectedNodeId);
        }
      });
      setError(null);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!snapshot) {
      return;
    }

    setLocalSnapshot(snapshot);
    setLoading(false);
    setError(null);
  }, [snapshot]);

  useEffect(() => {
    setToastMessage(feedback ?? null);
  }, [feedback]);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setToastMessage(null);
    }, 2400);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [toastMessage]);

  useEffect(() => {
    if (snapshot) {
      return;
    }

    void refreshSnapshot();
  }, [gateway, snapshot]);

  const activeSnapshot = localSnapshot ?? EMPTY_SKILLS_SNAPSHOT;
  const model = buildSkillsPanelModel(activeSnapshot);
  const visibleRows = useMemo(
    () =>
      flattenVisibleSkillTree(model.treeRoots, expandedIds, {
        query: deferredSearchQuery,
        tags: activeFilters.tags,
        colors: activeFilters.colors
      }),
    [activeFilters.colors, activeFilters.tags, deferredSearchQuery, expandedIds, model.treeRoots]
  );
  const visibleDropIndicator = useMemo(
    () => resolveVisibleDropIndicator(visibleRows, dropIndicator),
    [dropIndicator, visibleRows]
  );
  const lastVisibleRowId = visibleRows[visibleRows.length - 1]?.id ?? null;
  const activeRowId = selectedNodeId ?? hoveredNodeId;
  const selectedRow = visibleRows.find((row) => row.id === activeRowId) ?? null;
  const bulkSelectionCount = selectedNodeIds.size;
  const bulkSelectionActive = multiSelectEnabled && bulkSelectionCount > 1;
  const hasActiveFilters =
    (activeFilters.tags?.length ?? 0) > 0 || (activeFilters.colors?.length ?? 0) > 0;
  const reorderEnabled =
    searchQuery.trim().length === 0 && !hasActiveFilters && !multiSelectEnabled;
  const activeParentNode =
    editorState?.parentNodeId
      ? findTreeNodeById(model.treeRoots, editorState.parentNodeId)
      : null;

  useEffect(() => {
    if (model.treeRoots.length === 0) {
      return;
    }

    if (didInitializeExpansion.current) {
      return;
    }

    didInitializeExpansion.current = true;
    setExpandedIds(
      new Set(
        model.treeRoots
          .filter((node) => node.children.length > 0)
          .slice(0, 4)
          .map((node) => node.id)
      )
    );
  }, [model.treeRoots]);

  useEffect(() => {
    if (visibleRows.length === 0) {
      if (selectedNodeId !== null) {
        setSelectedNodeId(null);
      }
      if (hoveredNodeId !== null) {
        setHoveredNodeId(null);
      }
      if (activeInteractionMode !== null) {
        setActiveInteractionMode(null);
      }
      setSelectedNodeIds((current) => (current.size === 0 ? current : new Set()));
      return;
    }

    if (selectedNodeId && !visibleRows.some((row) => row.id === selectedNodeId)) {
      setSelectedNodeId(null);
    }

    if (hoveredNodeId && !visibleRows.some((row) => row.id === hoveredNodeId)) {
      setHoveredNodeId(null);
    }
  }, [activeInteractionMode, hoveredNodeId, selectedNodeId, visibleRows]);

  useEffect(() => {
    if (didAutoFocusTreeSurface.current || loading || editorState || visibleRows.length === 0) {
      return;
    }

    didAutoFocusTreeSurface.current = true;
    focusTreeSurface(treeSurfaceRef.current);
  }, [editorState, loading, visibleRows.length]);

  useEffect(() => {
    setSelectedNodeIds((current) => {
      const visibleIdSet = new Set(visibleRows.map((row) => row.id));
      const next = new Set([...current].filter((nodeId) => visibleIdSet.has(nodeId)));

      return next.size === current.size ? current : next;
    });
  }, [visibleRows]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(
        "pdp-helper.skills.inherit-parent-tag",
        String(childCreateDefaults.inheritParentTag)
      );
      window.localStorage.setItem(
        "pdp-helper.skills.inherit-parent-color",
        String(childCreateDefaults.inheritParentColor)
      );
    } catch {
      return;
    }
  }, [childCreateDefaults]);

  useEffect(() => {
    if (!filterMenuOpen) {
      return;
    }

    function onPointerDown(event: PointerEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (filterPanelRef.current?.contains(target) || filterButtonRef.current?.contains(target)) {
        return;
      }

      setFilterMenuOpen(false);
    }

    window.addEventListener("pointerdown", onPointerDown);

    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [filterMenuOpen]);

  useEffect(() => {
    if (!filterMenuOpen) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      setFilterMenuOpen(false);
      filterButtonRef.current?.focus();
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [filterMenuOpen]);

  function toggleNode(nodeId: string) {
    setExpandedIds((current) => {
      const next = new Set(current);

      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }

      return next;
    });
  }

  function openCreateRoot() {
    setEditorState({
      mode: "create-root"
    });
    setEditorDraft(createEmptyDraft());
    setBulkApplyToChildren(false);
  }

  function openCreateChild(node: SkillTreeNodeModel) {
    if (node.kind !== "skill") {
      return;
    }

    setExpandedIds((current) => new Set(current).add(node.id));
    setEditorState({
      mode: "create-child",
      parentNodeId: node.id
    });
    setEditorDraft({
      ...createEmptyDraft(),
      tag: childCreateDefaults.inheritParentTag ? formatTagList(node.tags) : "",
      color: childCreateDefaults.inheritParentColor ? node.color ?? "" : ""
    });
    setBulkApplyToChildren(false);
  }

  function openCreateSibling(node: SkillTreeNodeModel) {
    setEditorState({
      mode: "create-sibling",
      parentNodeId: node.parentId
    });
    setEditorDraft(createEmptyDraft());
    setBulkApplyToChildren(false);
  }

  function openEdit(node: SkillTreeNodeModel) {
    setEditorState({
      mode: "edit",
      nodeId: node.id
    });
    setEditorDraft(createDraftFromNode(node));
    setBulkApplyToChildren(false);
  }

  function openBulkEdit() {
    if (selectedNodeIds.size < 2) {
      return;
    }

    setEditorState({
      mode: "bulk-edit",
      selectedNodeIds: [...selectedNodeIds]
    });
    setEditorDraft({
      ...createEmptyDraft(),
      label: "Multiple skills selected",
      description: "Multiple skills selected"
    });
    setBulkApplyToChildren(false);
  }

  function toggleMultiSelect() {
    setMultiSelectEnabled((current) => {
      if (current) {
        setSelectedNodeIds(new Set());
      } else {
        setSelectedNodeIds(new Set());
      }

      return !current;
    });
    setSelectedNodeId(null);
    setHoveredNodeId(null);
    setActiveInteractionMode(null);
  }

  function toggleFilterValue(kind: "tags" | "colors", value: string) {
    setActiveFilters((current) => {
      const nextValues = new Set(current[kind] ?? []);

      if (nextValues.has(value)) {
        nextValues.delete(value);
      } else {
        nextValues.add(value);
      }

      return {
        ...current,
        [kind]: [...nextValues]
      };
    });
  }

  function clearFilters() {
    setActiveFilters({
      tags: [],
      colors: []
    });
  }

  function handleRowSelection(nodeId: string) {
    setSelectedNodeId(nodeId);
    setHoveredNodeId(nodeId);
    setActiveInteractionMode("pointer");

    if (!multiSelectEnabled) {
      return;
    }

    setSelectedNodeIds((current) => {
      const next = new Set(current);

      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }

      return next;
    });
  }

  async function submitEditor() {
    if (!editorState) {
      return;
    }

    setPendingMutation(true);

    try {
      if (editorState.mode === "bulk-edit" && editorState.selectedNodeIds) {
        const targetNodeIds = collectBulkTargetIds(
          model.treeRoots,
          new Set(editorState.selectedNodeIds),
          bulkApplyToChildren
        );

        await Promise.all(
          targetNodeIds.map((nodeId) =>
            gateway.updateSkillTreeNode({
              nodeId: nodeId as GraphNode["id"],
              ...(editorDraft.tagTouched ? { tag: editorDraft.tag || null } : {}),
              ...(editorDraft.colorTouched ? { color: editorDraft.color || null } : {})
            })
          )
        );

        setMultiSelectEnabled(false);
        setSelectedNodeIds(new Set());
        setSelectedNodeId(null);
        setHoveredNodeId(null);
        setActiveInteractionMode(null);
        await refreshSnapshot("Skills updated.", selectedNodeId);
      } else if (editorState.mode === "edit" && editorState.nodeId) {
        await gateway.updateSkillTreeNode({
          nodeId: editorState.nodeId as GraphNode["id"],
          label: editorDraft.label,
          description: editorDraft.description || null,
          tag: editorDraft.tag || null,
          color: editorDraft.color || null
        });

        await refreshSnapshot("Skill updated.", editorState.nodeId);
      } else {
        const nextTag =
          editorState.mode === "create-child" && childCreateDefaults.inheritParentTag
            ? activeParentNode
              ? formatTagList(activeParentNode.tags)
              : ""
            : editorDraft.tag;
        const nextColor =
          editorState.mode === "create-child" && childCreateDefaults.inheritParentColor
            ? activeParentNode?.color ?? ""
            : editorDraft.color;

        const result = (await gateway.createSkillTreeNode({
          label: editorDraft.label,
          ...(editorDraft.description.trim().length > 0
            ? { description: editorDraft.description }
            : {}),
          ...(parseTagList(nextTag).length > 0 ? { tag: nextTag } : {}),
          ...(nextColor ? { color: nextColor } : {}),
          ...(editorState.parentNodeId
            ? { parentNodeId: editorState.parentNodeId as GraphNode["id"] }
            : {})
        })) as {
          skillNode?: {
            id: string;
          };
        };

        if (editorState.parentNodeId) {
          setExpandedIds((current) => new Set(current).add(editorState.parentNodeId!));
        }

        await refreshSnapshot("Skill added.", result.skillNode?.id ?? null);
      }

      setEditorState(null);
      setEditorDraft(createEmptyDraft());
      setBulkApplyToChildren(false);
      setError(null);
      focusTreeSurface(treeSurfaceRef.current);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setPendingMutation(false);
    }
  }

  async function removeNode(node: SkillTreeNodeModel) {
    const allowDelete =
      typeof window === "undefined" ||
      window.confirm(`Remove "${node.label}" from the skill tree?`);

    if (!allowDelete) {
      return;
    }

    setPendingMutation(true);

    try {
      await gateway.deleteSkillTreeNode(node.id as GraphNode["id"]);
      await refreshSnapshot("Skill removed.");
      setError(null);
      focusTreeSurface(treeSurfaceRef.current);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setPendingMutation(false);
    }
  }

  async function removeSelectedNodes() {
    const deleteSummary = resolveSkillTreeBulkDeleteSummary(model.treeRoots, selectedNodeIds);
    const targetNodeIds = collectTopLevelSelectedIds(model.treeRoots, selectedNodeIds);

    if (deleteSummary.topLevelCount === 0) {
      return;
    }

    const allowDelete =
      typeof window === "undefined" ||
      window.confirm(`Remove ${deleteSummary.totalCount} skills from the skill tree?`);

    if (!allowDelete) {
      return;
    }

    setPendingMutation(true);

    try {
      for (const nodeId of targetNodeIds) {
        await gateway.deleteSkillTreeNode(nodeId as GraphNode["id"]);
      }

      setMultiSelectEnabled(false);
      setSelectedNodeIds(new Set());
      setSelectedNodeId(null);
      setHoveredNodeId(null);
      setActiveInteractionMode(null);
      await refreshSnapshot("Selected skills removed.");
      setError(null);
      focusTreeSurface(treeSurfaceRef.current);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setPendingMutation(false);
    }
  }

  async function handleDrop(targetNodeId: string, targetParentId?: string, position: "before" | "after" = "before") {
    if (!draggedNodeId || draggedNodeId === targetNodeId) {
      setDraggedNodeId(null);
      setDropIndicator(null);
      return;
    }

    const siblingIds = findSiblingIds(model.treeRoots, targetParentId);
    const targetIndex = siblingIds.indexOf(targetNodeId);

    if (targetIndex === -1) {
      setDraggedNodeId(null);
      setDropIndicator(null);
      return;
    }

    setPendingMutation(true);

    try {
      await gateway.reorderSkillTreeNode({
        nodeId: draggedNodeId as GraphNode["id"],
        ...(targetParentId ? { parentNodeId: targetParentId as GraphNode["id"] } : {}),
        targetIndex: position === "after" ? targetIndex + 1 : targetIndex
      });
      await refreshSnapshot("Skill order updated.", draggedNodeId);
      setError(null);
      focusTreeSurface(treeSurfaceRef.current);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setPendingMutation(false);
      setDraggedNodeId(null);
      setDropIndicator(null);
    }
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (editorState) {
      return;
    }

    const action = interpretSkillTreeHotkey({
      key: event.key,
      targetTagName: (event.target as HTMLElement | null)?.tagName,
      metaKey: event.metaKey,
      ctrlKey: event.ctrlKey,
      altKey: event.altKey
    });

    if (!action) {
      return;
    }

    event.preventDefault();

    switch (action) {
      case "select-previous":
        setHoveredNodeId(null);
        setActiveInteractionMode("keyboard");
        setSelectedNodeIds((current) => (current.size === 0 ? current : new Set()));
        setSelectedNodeId(moveSkillTreeSelection(visibleRows, activeRowId, -1));
        break;
      case "select-next":
        setHoveredNodeId(null);
        setActiveInteractionMode("keyboard");
        setSelectedNodeIds((current) => (current.size === 0 ? current : new Set()));
        setSelectedNodeId(moveSkillTreeSelection(visibleRows, activeRowId, 1));
        break;
      case "expand":
        setHoveredNodeId(null);
        setActiveInteractionMode("keyboard");
        if (selectedRow?.hasChildren) {
          setExpandedIds((current) => new Set(current).add(selectedRow.id));
        }
        break;
      case "collapse":
        setHoveredNodeId(null);
        setActiveInteractionMode("keyboard");
        if (selectedRow?.hasChildren && expandedIds.has(selectedRow.id)) {
          setExpandedIds((current) => {
            const next = new Set(current);
            next.delete(selectedRow.id);
            return next;
          });
        } else if (selectedRow?.parentId) {
          setSelectedNodeId(selectedRow.parentId);
        }
        break;
      case "edit":
        if (bulkSelectionActive) {
          openBulkEdit();
        } else if (selectedRow) {
          openEdit(selectedRow.node);
        }
        break;
      case "delete":
        if (bulkSelectionActive) {
          void removeSelectedNodes();
        } else if (selectedRow) {
          void removeNode(selectedRow.node);
        }
        break;
      case "create-child":
        if (selectedRow?.node.kind === "skill") {
          openCreateChild(selectedRow.node);
        }
        break;
      case "create-sibling":
        if (selectedRow) {
          openCreateSibling(selectedRow.node);
        }
        break;
      case "cancel":
        setHoveredNodeId(null);
        setEditorState(null);
        setBulkApplyToChildren(false);
        focusTreeSurface(treeSurfaceRef.current);
        break;
    }
  }

  return (
    <article className="panel panel--clean">
      {loading ? <p className="callout">Loading skill tree…</p> : null}
      {error ? <p className="callout callout--error">{error}</p> : null}

      <section
        ref={treeSurfaceRef}
        className="skill-tree-page"
        tabIndex={0}
        onKeyDown={onKeyDown}
      >
        <div className="skill-tree-toolbar">
          <label className="skill-tree-toolbar__search">
            <span className="skill-tree-toolbar__search-icon">⌕</span>
            <input
              value={searchQuery}
              placeholder="Search skills..."
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </label>

          <div className="skill-tree-toolbar__actions">
            <div className="skill-tree-toolbar__filter-anchor">
              <button
                ref={filterButtonRef}
                type="button"
                aria-label="Open filters"
                aria-expanded={filterMenuOpen}
                className={[
                  "skill-tree-toolbar__button",
                  "skill-tree-toolbar__button--secondary",
                  "skill-tree-toolbar__button--icon",
                  hasActiveFilters ? "skill-tree-toolbar__button--active-filter" : ""
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => setFilterMenuOpen((current) => !current)}
              >
                <FilterIcon />
              </button>

              {filterMenuOpen ? (
                <div ref={filterPanelRef} className="skill-tree-filter-popover">
                  <div className="skill-tree-filter-popover__header">
                    <strong>Filters</strong>
                    <button
                      type="button"
                      className="skill-tree-filter-popover__clear"
                      onClick={clearFilters}
                    >
                      Clear
                    </button>
                  </div>

                  <div className="skill-tree-filter-popover__section">
                    <span>Tags</span>
                    <div className="skill-tree-filter-popover__options">
                      {model.availableTagFilters.map((tag) => (
                        <label key={tag} className="skill-tree-filter-popover__option">
                          <input
                            type="checkbox"
                            checked={(activeFilters.tags ?? []).includes(tag)}
                            onChange={() => toggleFilterValue("tags", tag)}
                          />
                          <span>{tag}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="skill-tree-filter-popover__section">
                    <span>Colors</span>
                    <div className="skill-tree-filter-popover__options">
                      {model.availableColorFilters.map((color) => (
                        <label key={color} className="skill-tree-filter-popover__option">
                          <input
                            type="checkbox"
                            checked={(activeFilters.colors ?? []).includes(color)}
                            onChange={() => toggleFilterValue("colors", color)}
                          />
                          <span className="skill-tree-filter-popover__color-label">
                            <span
                              className="skill-tree-filter-popover__color-dot"
                              style={{ background: color }}
                            />
                            {formatColorFilterLabel(color)}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              className={[
                "skill-tree-toolbar__button",
                multiSelectEnabled ? "skill-tree-toolbar__button--active" : ""
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={toggleMultiSelect}
            >
              {multiSelectEnabled ? "Done Selecting" : "Multi-select"}
            </button>
            {bulkSelectionActive ? (
              <>
                <button
                  type="button"
                  className="skill-tree-toolbar__button skill-tree-toolbar__button--secondary"
                  onClick={openBulkEdit}
                >
                  Bulk Edit
                </button>
                <button
                  type="button"
                  className="skill-tree-toolbar__button skill-tree-toolbar__button--secondary"
                  onClick={() => {
                    void removeSelectedNodes();
                  }}
                >
                  Bulk Delete
                </button>
              </>
            ) : null}
            <button
              type="button"
              className="skill-tree-toolbar__button"
              onClick={openCreateRoot}
            >
            + Add Root Skill
            </button>
          </div>
        </div>

        <div className="skill-tree-toolbar__meta">
          <span>
            {model.treeRoots.length} root {model.treeRoots.length === 1 ? "skill" : "skills"}
          </span>
          {multiSelectEnabled ? (
            <span>{bulkSelectionCount} selected</span>
          ) : null}
        </div>

        {visibleRows.length > 0 ? (
          <ul
            className={
              draggedNodeId
                ? "skill-tree skill-tree--interactive skill-tree--dragging"
                : "skill-tree skill-tree--interactive"
            }
            onPointerLeave={() => {
              setHoveredNodeId(null);

              if (!multiSelectEnabled && activeInteractionMode === "pointer") {
                setSelectedNodeId(null);
                setActiveInteractionMode(null);
              }
            }}
          >
            {visibleRows.map((row) => {
              const isHovered = row.id === hoveredNodeId;
              const isSelected =
                multiSelectEnabled
                  ? selectedNodeIds.has(row.id)
                  : row.id === activeRowId;
              const isExpanded = expandedIds.has(row.id);
              const isDropTarget =
                visibleDropIndicator?.position === "before" &&
                row.id === visibleDropIndicator.targetNodeId;

              return (
                <li
                  key={row.id}
                  className={[
                    "skill-tree__item",
                    row.hasChildren ? "skill-tree__item--branch" : ""
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <div
                    className={[
                      "skill-tree__row",
                      "skill-tree__row--interactive",
                      isHovered ? "skill-tree__row--hovered" : "",
                      isSelected ? "skill-tree__row--selected" : "",
                      isDropTarget ? "skill-tree__row--drop-target" : "",
                      visibleDropIndicator?.targetNodeId === row.id &&
                      visibleDropIndicator.position === "before"
                        ? "skill-tree__row--drop-before"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    style={{ paddingLeft: `${18 + row.depth * 28}px` }}
                    draggable={reorderEnabled}
                    onClick={() => handleRowSelection(row.id)}
                    onPointerEnter={() => {
                      if (draggedNodeId) {
                        setHoveredNodeId(null);
                        return;
                      }

                      setHoveredNodeId(row.id);

                      const pointerSelectedNodeId = resolveSkillTreeSelectionFromPointer({
                        nodeId: row.id,
                        multiSelectEnabled,
                        draggedNodeId
                      });

                      if (pointerSelectedNodeId) {
                        setActiveInteractionMode("pointer");
                        setSelectedNodeIds((current) => (current.size === 0 ? current : new Set()));
                        setSelectedNodeId(pointerSelectedNodeId);
                      }
                    }}
                    onDragStart={() => {
                      if (!reorderEnabled) {
                        return;
                      }

                      setDraggedNodeId(row.id);
                    }}
                    onDragEnd={() => {
                      setDraggedNodeId(null);
                      setDropIndicator(null);
                    }}
                    onDragOver={(event) => {
                      if (!reorderEnabled) {
                        return;
                      }

                      event.preventDefault();
                      const rowBounds = event.currentTarget.getBoundingClientRect();
                      setDropIndicator(
                        resolveSkillTreeDropIndicatorFromPointer({
                          rowId: row.id,
                          isLastVisibleRow: row.id === lastVisibleRowId,
                          pointerY: event.clientY,
                          rowBottom: rowBounds.bottom
                        })
                      );
                    }}
                    onDragLeave={() =>
                      setDropIndicator((current) =>
                        current?.targetNodeId === row.id ? null : current
                      )
                    }
                    onDrop={(event) => {
                      if (!reorderEnabled) {
                        return;
                      }

                      event.preventDefault();
                      void handleDrop(
                        row.id,
                        row.parentId,
                        dropIndicator?.targetNodeId === row.id ? dropIndicator.position : "before"
                      );
                    }}
                  >
                    <span className="skill-tree__drag">⋮⋮</span>

                    <button
                      type="button"
                      className="skill-tree__caret-button"
                      aria-label={row.hasChildren ? (isExpanded ? "Collapse skill" : "Expand skill") : "No children"}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (row.hasChildren) {
                          toggleNode(row.id);
                        }
                      }}
                    >
                      {row.hasChildren ? (isExpanded ? "▾" : "▸") : " "}
                    </button>

                    <div className="skill-tree__content">
                      <div className="skill-tree__titleline">
                        {row.node.color ? (
                          <span
                            className="skill-tree__color-dot"
                            style={{ background: row.node.color }}
                          />
                        ) : null}
                        <span className="skill-tree__label">{row.node.label}</span>
                        {row.node.tags.map((tag) => (
                          <span key={`${row.node.id}-${tag}`} className="skill-tree__tag">
                            {tag}
                          </span>
                        ))}
                        {row.node.kind === "reference" ? (
                          <span className="skill-tree__reference-badge">Reference</span>
                        ) : null}
                      </div>
                      {row.node.description ? (
                        <p className="skill-tree__description">{row.node.description}</p>
                      ) : null}
                    </div>

                    <div className="skill-tree__actions">
                      {row.node.kind === "skill" ? (
                        <button
                          type="button"
                          className="skill-tree__icon-button"
                          aria-label={`Add subskill to ${row.node.label}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            openCreateChild(row.node);
                          }}
                        >
                          <SkillActionIcon kind="add" />
                        </button>
                      ) : null}

                      <button
                        type="button"
                        className="skill-tree__icon-button"
                        aria-label={`Edit ${row.node.label}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          openEdit(row.node);
                        }}
                      >
                        <SkillActionIcon kind="edit" />
                      </button>

                      <button
                        type="button"
                        className="skill-tree__icon-button"
                        aria-label={`Remove ${row.node.label}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          void removeNode(row.node);
                        }}
                      >
                        <SkillActionIcon kind="delete" />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
            {visibleDropIndicator?.position === "after" &&
            visibleDropIndicator.targetNodeId === lastVisibleRowId ? (
              <li className="skill-tree__drop-end" aria-hidden="true" />
            ) : null}
          </ul>
        ) : (
          <div className="skill-tree__empty">
            <p>No skills match the current view yet.</p>
            <button type="button" onClick={openCreateRoot}>
              Add Root Skill
            </button>
          </div>
        )}

        <p className="skill-tree__keyboard-hint">
          Arrows navigate, Right expands, Left collapses, Enter edits, Delete removes,
          <code> c </code>
          adds a child, and
          <code> a </code>
          adds a sibling.
        </p>

        <section className="skill-tree-page__footer">
          <p className="skill-tree-page__summary">
            {model.inventorySummary.totalCanonicalSkills} skills,{" "}
            {model.inventorySummary.totalReferenceNodes} references,{" "}
            {model.inventorySummary.totalSkillGraphNodes} graph nodes
          </p>
          <p className="skill-tree-page__footnote">
            Temporarily hidden skill-tree actions
          </p>
          <ul className="skill-tree-page__hidden-list">
            {model.hiddenFeatureNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>
      </section>

      {editorState ? (
        <SkillEditorModal
          state={editorState}
          draft={editorDraft}
          pending={pendingMutation}
          bulkSelectionCount={editorState.selectedNodeIds?.length}
          applyToChildren={bulkApplyToChildren}
          inheritParentTag={childCreateDefaults.inheritParentTag}
          inheritParentColor={childCreateDefaults.inheritParentColor}
          parentTag={activeParentNode ? formatTagList(activeParentNode.tags) : undefined}
          parentColor={activeParentNode?.color}
          onDraftChange={setEditorDraft}
          onApplyToChildrenChange={setBulkApplyToChildren}
          onInheritParentTagChange={(checked) => {
            setChildCreateDefaults((current) => ({
              ...current,
              inheritParentTag: checked
            }));
            setEditorDraft((current) => ({
              ...current,
              tag: checked && activeParentNode ? formatTagList(activeParentNode.tags) : "",
              tagTouched: false
            }));
          }}
          onInheritParentColorChange={(checked) => {
            setChildCreateDefaults((current) => ({
              ...current,
              inheritParentColor: checked
            }));
            setEditorDraft((current) => ({
              ...current,
              color: checked ? activeParentNode?.color ?? "" : "",
              colorTouched: false
            }));
          }}
          onCancel={() => {
            setEditorState(null);
            setBulkApplyToChildren(false);
            focusTreeSurface(treeSurfaceRef.current);
          }}
          onSubmit={() => {
            void submitEditor();
          }}
        />
      ) : null}

      {toastMessage ? <aside className="skill-tree-toast">{toastMessage}</aside> : null}
    </article>
  );
}
