import React from 'react';
import type { ThingRecord } from '@/types/thing';
import { apiClient } from '@/api/client';
import { useThingStore } from '@/stores/thingStore';
import { THING_ART_LABEL, kindBackgroundSrc } from '@/utils/thingBackground';
import { ArtMaker } from './ArtMaker';

/**
 * The thing's floor picture — its art (the engine's thing_art.go), laid on
 * the board's floor under its ball: drawn for it, or one it already has (its
 * own photo, its kind's picture) or a file chosen. See ArtMaker.
 */
export const ThingArtSection: React.FC<{ record: ThingRecord }> = ({ record }) => {
  const labels = record.labels ?? {};
  const own = record.background?.startsWith('@') ? labels[record.background.slice(1)]?.trim() : undefined;
  const choices = [own, kindBackgroundSrc(record.background)].filter((u): u is string => !!u);
  const refetch = () => useThingStore.getState().fetchThings();
  return (
    <ArtMaker
      className="mt-4"
      value={record.value}
      kind={record.typeName}
      owner={record.id}
      current={labels[THING_ART_LABEL]}
      choices={choices}
      onSave={async art => {
        if ('url' in art) await apiClient.setThingArtUrl(record.id, art.url);
        else await apiClient.uploadThingArt(record.id, art.png);
        await refetch();
      }}
      onRemove={async () => { await apiClient.deleteThingArt(record.id); await refetch(); }}
    />
  );
};
