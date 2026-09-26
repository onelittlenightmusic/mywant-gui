import { PartyPopper } from 'lucide-react';
import { registerWantCardPlugin } from '../registry';
import { makeEffectContentSection } from '../effectCardFrame';

registerWantCardPlugin({
  types: ['fireworks_effect'],
  ContentSection: makeEffectContentSection({
    stateKey: 'fireworks_triggers',
    icon: PartyPopper,
    color: '#ffb400',
    label: '打ち上げました',
  }),
});
