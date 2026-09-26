import { Bell } from 'lucide-react';
import { registerWantCardPlugin } from '../registry';
import { makeEffectContentSection } from '../effectCardFrame';

registerWantCardPlugin({
  types: ['chime_effect'],
  ContentSection: makeEffectContentSection({
    stateKey: 'chime_triggers',
    icon: Bell,
    color: '#f59e0b',
    label: '鳴りました',
  }),
});
