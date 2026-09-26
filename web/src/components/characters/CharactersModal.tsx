import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { BaseModal } from '@/components/modals/BaseModal';
import { Character } from '@/types/character';
import { apiClient } from '@/api/client';
import { classNames } from '@/utils/helpers';

const AVATAR_PRESETS = ['🧙', '🦊', '🐉', '🧝', '🤖', '🧚', '🦸', '🐺', '🧛', '🎭'];
const COLOR_PRESETS = [
  '#6366f1', '#0ea5e9', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6',
];

interface CharactersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCharactersChanged?: () => void;
}

interface EditState {
  id: string | null; // null = creating new
  name: string;
  avatar: string;
  color: string;
}

const emptyEdit = (): EditState => ({ id: null, name: '', avatar: '🧙', color: '#6366f1' });

export const CharactersModal: React.FC<CharactersModalProps> = ({
  isOpen,
  onClose,
  onCharactersChanged,
}) => {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await apiClient.listCharacters();
      setCharacters(list);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (isOpen) load();
  }, [isOpen, load]);

  const handleSave = async () => {
    if (!edit || !edit.name.trim()) return;
    setSaving(true);
    try {
      if (edit.id) {
        await apiClient.updateCharacter(edit.id, { name: edit.name.trim(), avatar: edit.avatar, color: edit.color });
      } else {
        await apiClient.createCharacter({ name: edit.name.trim(), avatar: edit.avatar, color: edit.color });
      }
      await load();
      setEdit(null);
      onCharactersChanged?.();
    } catch { /* ignore */ } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await apiClient.deleteCharacter(id);
      await load();
      onCharactersChanged?.();
    } catch { /* ignore */ } finally {
      setDeletingId(null);
    }
  };

  const startEdit = (c: Character) => {
    setEdit({ id: c.id, name: c.name, avatar: c.avatar, color: c.color });
  };

  const startCreate = () => setEdit(emptyEdit());

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Characters" size="md">
      <div className="space-y-4">

        {/* Character list */}
        {characters.length === 0 && !edit && (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">
            No characters yet. Create one to assign to your devices.
          </p>
        )}

        <ul className="space-y-2">
          {characters.map(c => (
            <li
              key={c.id}
              className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60"
            >
              {/* Avatar + color dot */}
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0"
                style={{ backgroundColor: c.color + '33', border: `2px solid ${c.color}` }}
              >
                {c.avatar}
              </div>

              <span className="flex-1 font-medium text-sm text-gray-900 dark:text-white truncate">
                {c.name}
              </span>

              {/* Assigned device count badge */}
              {c.assignedDeviceIds.length > 0 && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400">
                  {c.assignedDeviceIds.length} device{c.assignedDeviceIds.length !== 1 ? 's' : ''}
                </span>
              )}

              <button
                onClick={() => startEdit(c)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleDelete(c.id)}
                disabled={deletingId === c.id}
                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-40"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>

        {/* Inline editor */}
        {edit && (
          <div className="border border-indigo-200 dark:border-indigo-700 rounded-xl p-4 bg-indigo-50/40 dark:bg-indigo-900/10 space-y-3">
            <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
              {edit.id ? 'Edit character' : 'New character'}
            </p>

            {/* Name */}
            <input
              type="text"
              value={edit.name}
              onChange={e => setEdit(s => s && ({ ...s, name: e.target.value }))}
              placeholder="Name…"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEdit(null); }}
            />

            {/* Avatar picker */}
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">Avatar</p>
              <div className="flex flex-wrap gap-1.5">
                {AVATAR_PRESETS.map(a => (
                  <button
                    key={a}
                    onClick={() => setEdit(s => s && ({ ...s, avatar: a }))}
                    className={classNames(
                      'w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all',
                      edit.avatar === a
                        ? 'ring-2 ring-indigo-500 bg-indigo-100 dark:bg-indigo-900/40'
                        : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600',
                    )}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            {/* Color picker */}
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">Color</p>
              <div className="flex gap-1.5">
                {COLOR_PRESETS.map(col => (
                  <button
                    key={col}
                    onClick={() => setEdit(s => s && ({ ...s, color: col }))}
                    className={classNames(
                      'w-7 h-7 rounded-full transition-all',
                      edit.color === col ? 'ring-2 ring-offset-2 ring-indigo-500' : 'hover:scale-110',
                    )}
                    style={{ backgroundColor: col }}
                  />
                ))}
              </div>
            </div>

            {/* Preview */}
            <div className="flex items-center gap-2 pt-1">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-base"
                style={{ backgroundColor: edit.color + '33', border: `2px solid ${edit.color}` }}
              >
                {edit.avatar}
              </div>
              <span className="text-sm font-medium" style={{ color: edit.color }}>
                {edit.name || 'Preview'}
              </span>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSave}
                disabled={saving || !edit.name.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => setEdit(null)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Add button */}
        {!edit && (
          <button
            onClick={startCreate}
            className="flex items-center gap-2 w-full justify-center px-4 py-2.5 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 text-sm text-gray-500 dark:text-gray-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add character
          </button>
        )}
      </div>
    </BaseModal>
  );
};
