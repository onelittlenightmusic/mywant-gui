import { useState, useEffect } from 'react';
import { parseFlowLabel } from '@/utils/correlationLabels';

export interface DataTypeInfo {
  memoKey: string;
  icon: string;
  color: string;
  baseType?: string; // empty = primitive
  /** Catalog kind a value of this subtype is NAMED into (empty = the subtype
   *  itself). E.g. a location_coordinate value is named as a "place". */
  catalog?: string;
  /** Picture name for this kind's cards, served from /resources — see
   *  ThingRecord.background. Absent for a kind with no picture. */
  background?: string;
  /** Per-value icon: the answer field whose value is looked up in `icons`
   *  (e.g. weather_condition → sunny: Sun). `icon` stands when absent. */
  iconField?: string;
  icons?: Record<string, string>;
}

export interface DataTypesResponse {
  types: Record<string, DataTypeInfo>;
  fieldTypeMap: Record<string, string>;
}

const DEFAULT_TYPE: DataTypeInfo = {
  memoKey: 'strings',
  icon: 'Type',
  color: '#64748b',
};

let _cache: DataTypesResponse | null = null;

export function useDataTypes(): {
  types: Record<string, DataTypeInfo>;
  fieldTypeMap: Record<string, string>;
  getTypeInfo: (typeName: string) => DataTypeInfo & { name: string };
  getFieldTypeInfo: (fieldName: string) => DataTypeInfo & { name: string };
} {
  const [data, setData] = useState<DataTypesResponse | null>(_cache);

  useEffect(() => {
    if (_cache) return;
    fetch('/api/v1/datatypes')
      .then(r => r.json())
      .then((d: DataTypesResponse) => {
        _cache = d;
        setData(d);
      })
      .catch(() => {});
  }, []);

  const getTypeInfo = (typeName: string) => {
    const info = data?.types[typeName] ?? DEFAULT_TYPE;
    return { ...info, name: typeName };
  };

  const getFieldTypeInfo = (fieldName: string) => {
    const typeName = data?.fieldTypeMap[fieldName] ?? 'string';
    const info = data?.types[typeName] ?? DEFAULT_TYPE;
    return { ...info, name: typeName };
  };

  return {
    types: data?.types ?? {},
    fieldTypeMap: data?.fieldTypeMap ?? {},
    getTypeInfo,
    getFieldTypeInfo,
  };
}

/** Resolve the primary published field name (the global key) from a correlation
 * label list — the key of the first data flow named there, whether it travels
 * as global state ("expose/X") or as a global parameter ("param/X"). See
 * utils/correlationLabels. */
export function exposeFieldFromLabels(labels: string[]): string | null {
  for (const l of labels) {
    const flow = parseFlowLabel(l);
    if (flow) return flow.key;
    if (l.startsWith('expose/')) return l.slice('expose/'.length);
  }
  return null;
}

/**
 * Reads the self-declared subtype off a JSON object value, per the
 * self-descriptive object-subtype convention (see datatypes.yaml):
 * a JSON value like { lat, lng, type: "location_coordinate" } names its own
 * subtype via a `type` string field, so callers can resolve icon/color from
 * the value alone — no StateDef/ParameterDef subType lookup required.
 * Returns undefined for non-objects or objects without a string `type` field.
 */
export function selfDescribedSubtype(value: unknown): string | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const t = (value as Record<string, unknown>).type;
  return typeof t === 'string' && t ? t : undefined;
}
