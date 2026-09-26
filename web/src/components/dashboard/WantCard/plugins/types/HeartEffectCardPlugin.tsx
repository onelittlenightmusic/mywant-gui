import { Heart } from 'lucide-react';
import { registerWantCardPlugin } from '../registry';
import { makeEffectContentSection } from '../effectCardFrame';

registerWantCardPlugin({
  types: ['heart_effect'],
  ContentSection: makeEffectContentSection({
    stateKey: 'heart_triggers',
    icon: Heart,
    color: '#ff4b72',
    label: '飛ばしました',
  }),
});
