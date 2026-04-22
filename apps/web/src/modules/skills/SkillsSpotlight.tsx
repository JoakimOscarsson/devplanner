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
  flattenVisibleSkillTree,
  interpretSkillTreeHotkey,
  moveSkillTreeSelection,
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
    tag: node.tag ?? "",
    color: node.color ?? "",
    tagTouched: false,
    colorTouched: false
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
    <div className="skill-modal-backdrop" role="presentation" onClick={onCancel}>
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
              isBulkEdit ? "Leave untouched unless you want to update tags" : "e.g. technical"
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
  const [multiSelectEnabled, setMultiSelectEnabled] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
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
  const didInitializeExpansion = useRef(false);

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
    () => flattenVisibleSkillTree(model.treeRoots, expandedIds, deferredSearchQuery),
    [deferredSearchQuery, expandedIds, model.treeRoots]
  );
  const selectedRow = visibleRows.find((row) => row.id === selectedNodeId) ?? null;
  const bulkSelectionCount = selectedNodeIds.size;
  const bulkSelectionActive = multiSelectEnabled && bulkSelectionCount > 1;
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
      setSelectedNodeIds((current) => (current.size === 0 ? current : new Set()));
      return;
    }

    if (!selectedNodeId || !visibleRows.some((row) => row.id === selectedNodeId)) {
      setSelectedNodeId(visibleRows[0]!.id);
    }
  }, [selectedNodeId, visibleRows]);

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
      tag: childCreateDefaults.inheritParentTag ? node.tag ?? "" : "",
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
      } else if (selectedNodeId) {
        setSelectedNodeIds(new Set([selectedNodeId]));
      }

      return !current;
    });
  }

  function handleRowSelection(nodeId: string) {
    setSelectedNodeId(nodeId);

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
            ? activeParentNode?.tag ?? ""
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
          ...(nextTag.trim().length > 0 ? { tag: nextTag } : {}),
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
    const targetNodeIds = collectTopLevelSelectedIds(model.treeRoots, selectedNodeIds);

    if (targetNodeIds.length < 2) {
      return;
    }

    const allowDelete =
      typeof window === "undefined" ||
      window.confirm(`Remove ${targetNodeIds.length} selected skills from the skill tree?`);

    if (!allowDelete) {
      return;
    }

    setPendingMutation(true);

    try {
      for (const nodeId of targetNodeIds) {
        await gateway.deleteSkillTreeNode(nodeId as GraphNode["id"]);
      }

      setSelectedNodeIds(new Set());
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
        setSelectedNodeId(moveSkillTreeSelection(visibleRows, selectedNodeId, -1));
        break;
      case "select-next":
        setSelectedNodeId(moveSkillTreeSelection(visibleRows, selectedNodeId, 1));
        break;
      case "expand":
        if (selectedRow?.hasChildren) {
          setExpandedIds((current) => new Set(current).add(selectedRow.id));
        }
        break;
      case "collapse":
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
          <ul className="skill-tree skill-tree--interactive">
            {visibleRows.map((row) => {
              const isSelected =
                row.id === selectedNodeId || (multiSelectEnabled && selectedNodeIds.has(row.id));
              const isExpanded = expandedIds.has(row.id);
              const isDropTarget = row.id === dropIndicator?.targetNodeId;

              return (
                <li key={row.id} className="skill-tree__item">
                  <div
                    className={[
                      "skill-tree__row",
                      "skill-tree__row--interactive",
                      isSelected ? "skill-tree__row--selected" : "",
                      isDropTarget ? "skill-tree__row--drop-target" : "",
                      dropIndicator?.targetNodeId === row.id &&
                      dropIndicator.position === "before"
                        ? "skill-tree__row--drop-before"
                        : "",
                      dropIndicator?.targetNodeId === row.id &&
                      dropIndicator.position === "after"
                        ? "skill-tree__row--drop-after"
                        : ""
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    style={{ paddingLeft: `${18 + row.depth * 28}px` }}
                    draggable={searchQuery.trim().length === 0}
                    onClick={() => handleRowSelection(row.id)}
                    onDragStart={() => setDraggedNodeId(row.id)}
                    onDragEnd={() => {
                      setDraggedNodeId(null);
                      setDropIndicator(null);
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      const rowBounds = event.currentTarget.getBoundingClientRect();
                      const position =
                        event.clientY < rowBounds.top + rowBounds.height / 2 ? "before" : "after";
                      setDropIndicator({
                        targetNodeId: row.id,
                        position
                      });
                    }}
                    onDragLeave={() =>
                      setDropIndicator((current) =>
                        current?.targetNodeId === row.id ? null : current
                      )
                    }
                    onDrop={(event) => {
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
                        {row.node.tag ? (
                          <span className="skill-tree__tag">{row.node.tag}</span>
                        ) : null}
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
          parentTag={activeParentNode?.tag}
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
              tag: checked ? activeParentNode?.tag ?? "" : "",
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
