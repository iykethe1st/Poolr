'use client';

import { useEffect, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Loader2, Trash2, UserCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useUpdatePosition, useRemoveMember, type GroupMember } from '@/hooks/use-group';
import { cn } from '@/lib/utils';

interface RotationOrderProps {
  groupId: string;
  members: GroupMember[];
  isAdmin: boolean;
  locked: boolean;
}

export function RotationOrder({ groupId, members, isAdmin, locked }: RotationOrderProps) {
  const sortedMembers = [...members].sort((a, b) => a.rotationPosition - b.rotationPosition);
  const [items, setItems] = useState(sortedMembers);
  const updatePos = useUpdatePosition(groupId);
  const removeMember = useRemoveMember(groupId);

  useEffect(() => {
    setItems([...members].sort((a, b) => a.rotationPosition - b.rotationPosition));
  }, [members]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((m) => m.id === active.id);
    const newIndex = items.findIndex((m) => m.id === over.id);
    const targetPosition = items[newIndex].rotationPosition;

    setItems((prev) => arrayMove(prev, oldIndex, newIndex));
    updatePos.mutate({ memberId: active.id as string, position: targetPosition });
  }

  if (locked) {
    return (
      <ul className="divide-y rounded-xl border bg-card shadow-sm">
        {items.map((member) => (
          <MemberRow key={member.id} member={member} isAdmin={false} locked />
        ))}
      </ul>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((m) => m.id)} strategy={verticalListSortingStrategy}>
        <ul className="divide-y rounded-xl border bg-card shadow-sm">
          {items.map((member) => (
            <SortableMemberRow
              key={member.id}
              member={member}
              isAdmin={isAdmin}
              onRemove={() => removeMember.mutate(member.id)}
              removing={removeMember.isPending}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

// ─── Locked static row ────────────────────────────────────────────────────────

function MemberRow({
  member,
  isAdmin,
  locked,
}: {
  member: GroupMember;
  isAdmin: boolean;
  locked?: boolean;
}) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
        {member.rotationPosition}
      </span>
      <UserCircle2 className="size-7 shrink-0 text-muted-foreground/50" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{member.user.fullName}</p>
        <p className="truncate text-xs text-muted-foreground">{member.user.phone}</p>
      </div>
      <MemberStatusBadge status={member.memberStatus} />
    </li>
  );
}

// ─── Sortable draggable row ───────────────────────────────────────────────────

function SortableMemberRow({
  member,
  isAdmin,
  onRemove,
  removing,
}: {
  member: GroupMember;
  isAdmin: boolean;
  onRemove: () => void;
  removing: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: member.id, disabled: !isAdmin });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 px-4 py-3 transition-shadow',
        isDragging && 'z-10 rounded-xl bg-card shadow-lg opacity-90',
      )}
    >
      {isAdmin ? (
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none text-muted-foreground/50 hover:text-muted-foreground active:cursor-grabbing"
          aria-label="Drag to reorder"
        >
          <GripVertical className="size-4" />
        </button>
      ) : (
        <span className="size-4" />
      )}

      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
        {member.rotationPosition}
      </span>

      <UserCircle2 className="size-7 shrink-0 text-muted-foreground/50" />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{member.user.fullName}</p>
        <p className="truncate text-xs text-muted-foreground">{member.user.phone}</p>
      </div>

      <MemberStatusBadge status={member.memberStatus} />

      {isAdmin && member.memberStatus !== 'ACTIVE' && (
        <button
          type="button"
          onClick={onRemove}
          disabled={removing}
          className="ml-1 rounded p-1 text-muted-foreground/50 hover:text-destructive disabled:opacity-50"
          aria-label={`Remove ${member.user.fullName}`}
        >
          {removing ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Trash2 className="size-3.5" />
          )}
        </button>
      )}
    </li>
  );
}

function MemberStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; variant: 'success' | 'warning' | 'outline' | 'destructive' }> = {
    ACTIVE: { label: 'Active', variant: 'success' },
    INVITED: { label: 'Invited', variant: 'warning' },
    LEFT: { label: 'Left', variant: 'outline' },
    REMOVED: { label: 'Removed', variant: 'destructive' },
  };
  const { label, variant } = config[status] ?? { label: status, variant: 'outline' };
  return <Badge variant={variant}>{label}</Badge>;
}
