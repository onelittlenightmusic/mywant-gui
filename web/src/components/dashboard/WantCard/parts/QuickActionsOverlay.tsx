import React from 'react';
import { Play, PlayCircle, Square, Trash2, Pause, RotateCcw, Settings, X, Archive, ArchiveRestore, Tag, ExternalLink } from 'lucide-react';
import { Want } from '@/types/want';
import { OverlayActionGrid, OverlayItem } from '@/components/overlay';
import { openWantApp } from '@/utils/wantUtils';

const COLS = 3;
const ARCHIVE_LABEL = 'mywant.io/archived';

interface QuickActionsOverlayProps {
  want: Want;
  onClose: () => void;
  onView: () => void;
  onStart: () => void;
  onStop: () => void;
  onSuspend: () => void;
  onResume: () => void;
  onRestart: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onArchive?: () => void;
  onUnarchive?: () => void;
  /** Name this want's result into its catalog — what X does, for a mouse. */
  onAddAura?: () => void;
}

export const QuickActionsOverlay: React.FC<QuickActionsOverlayProps> = ({
  want,
  onClose,
  onStart,
  onStop,
  onSuspend,
  onResume,
  onRestart,
  onEdit,
  onDelete,
  onArchive,
  onUnarchive,
  onAddAura,
}) => {
  const status = want.status;
  const isRunning   = status === 'reaching' || status === 'reaching_with_warning' || status === 'waiting_user_action';
  const isStopped   = status === 'stopped'  || status === 'created' || status === 'failed' || status === 'achieved' || status === 'achieved_with_warning' || status === 'terminated';
  const isSuspended = status === 'suspended';
  const isAchieved  = status === 'achieved' || status === 'achieved_with_warning';
  const isArchived  = want.metadata?.labels?.[ARCHIVE_LABEL] === 'true';
  /**
   * A want the system owns and keeps: the robot, a character's chat, the
   * gui_state blob. Deleting, editing, stopping or suspending one is not a
   * thing a person can mean — the system puts it straight back, or the board
   * loses a part of itself that nothing offers to restore. The tiles stay
   * visible and greyed rather than vanishing, so the card looks the same
   * everywhere and the absence is an answer rather than a mystery.
   */
  const isSystem = !!want.metadata?.isSystemWant;

  // Row-major layout: [Start/Stop, Restart, Edit, Archive/Unarchive/Suspend/Resume, Close, Delete]
  const items: OverlayItem[] = [
    // Row 0
    isStopped
      ? { icon: <Play   className="w-5 h-5 text-white" fill="currentColor" />, label: 'Start',   onClick: () => { onStart();   onClose(); }, tone: 'confirm' as const, delay: 0, disabled: isSystem, title: isSystem ? 'The system keeps this want running' : undefined }
      : { icon: <Square className="w-5 h-5 text-white" fill="currentColor" />, label: 'Stop',    onClick: () => { onStop();    onClose(); }, tone: 'danger' as const,   delay: 0, disabled: isSystem, title: isSystem ? 'The system keeps this want running' : undefined },
    {   icon: <RotateCcw className="w-5 h-5 text-white" />,                    label: 'Restart', onClick: () => { onRestart(); onClose(); }, tone: 'primary' as const,  delay: 30 },
    {   icon: <Settings  className="w-5 h-5 text-white" />,                    label: 'Edit',    onClick: () => { onEdit();    onClose(); }, tone: 'primary' as const, delay: 60, disabled: isSystem, title: isSystem ? 'The system owns this want' : undefined },
    // Row 1
    isArchived
      ? { icon: <ArchiveRestore className="w-5 h-5 text-white" />, label: 'Unarchive', onClick: () => { onUnarchive?.(); onClose(); }, tone: 'confirm' as const,  delay: 60 }
      : isAchieved && onArchive
      ? { icon: <Archive        className="w-5 h-5 text-white" />, label: 'Archive',   onClick: () => { onArchive();   onClose(); }, tone: 'caution' as const,  delay: 60 }
      : isRunning
      ? { icon: <Pause     className="w-5 h-5 text-white" fill="currentColor" />, label: 'Suspend', onClick: () => { onSuspend(); onClose(); }, tone: 'caution' as const, delay: 60, disabled: isSystem, title: isSystem ? 'The system keeps this want running' : undefined }
      : isSuspended
      ? { icon: <PlayCircle className="w-5 h-5 text-white" />,                    label: 'Resume',  onClick: () => { onResume();  onClose(); }, tone: 'confirm' as const, delay: 60 }
      : { icon: <Pause     className="w-5 h-5 text-white" />,                    label: 'Suspend', onClick: () => {},                         tone: 'caution' as const,  delay: 60, disabled: true },
    {   icon: <X     className="w-4 h-4 sm:w-5 sm:h-5 text-white" />,            label: 'Close',   onClick: onClose,                          tone: 'cancel' as const,  delay: 90 },
    {   icon: <Trash2 className="w-5 h-5 text-white" />,                          label: 'Delete',  onClick: () => { onDelete();  onClose(); }, tone: 'danger' as const,  delay: 120, disabled: isSystem, title: isSystem ? 'The system owns this want — it would be put straight back' : undefined },
    // Archive for a want that is not finished. The slot above offers it only
    // to an achieved want, from when archiving merely filed a want away and
    // left it running; the engine now stops an archived want's cycle, so a
    // want still at work can be put away too. Appended rather than taking
    // that slot, where Suspend/Resume are reached for by position.
    ...(!isArchived && !isAchieved && onArchive
      ? [{ icon: <Archive className="w-5 h-5 text-white" />, label: 'Archive',
           onClick: () => { onArchive(); onClose(); }, tone: 'caution' as const, delay: 140,
           disabled: isSystem, title: isSystem ? 'The system keeps this want running' : 'Put away — its cycle stops; its data and history are kept' }]
      : []),
    // Row 2. Appended rather than slotted in among the others, which would
    // shift five actions people already reach for by position.
    //
    // The same act as pressing X — it names the want's result into its catalog
    // and signs the mark — so it goes through the very same handler rather than
    // a second implementation that could come to disagree with it. A want with
    // no final result has nothing to name; the handler says so, so the button
    // stays live rather than being a dead square with no explanation.
    ...(onAddAura
      ? [{ icon: <Tag className="w-5 h-5 text-white" />, label: 'Add Aura',
           onClick: () => { onAddAura(); onClose(); }, tone: 'special' as const, delay: 150 }]
      : []),
    // This want on its own, in a new tab — the /w/:id page a home-screen icon
    // points at. Appended, so it never shifts the actions above it.
    {
      icon: <ExternalLink className="w-5 h-5 text-white" />,
      label: 'Open w',
      onClick: () => { openWantApp(want); onClose(); },
      tone: 'info' as const,
      delay: 180,
    },
  ];

  return (
    <OverlayActionGrid
      items={items}
      cols={COLS}
      onClose={onClose}
    />
  );
};
