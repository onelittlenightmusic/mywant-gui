import { forwardRef } from 'react';
import { Tag, type LucideIcon, type LucideProps } from 'lucide-react';

/**
 * The tag icon turned to lie as a label's hang tag does (design/labelTags):
 * on its side, the hole at the left. lucide's Tag stands on its corner, the
 * hole up and to the left; a quarter of a right angle back brings it level.
 *
 * Named for a framing app as well, which draws its tabs' icons itself and
 * turns its own tag the same way (LucideSymbol "TagSideways").
 */
export const TagSideways = forwardRef<SVGSVGElement, LucideProps>(({ style, ...props }, ref) => (
  <Tag ref={ref} {...props} style={{ ...style, transform: 'rotate(-45deg)' }} />
)) as unknown as LucideIcon;
TagSideways.displayName = 'TagSideways';
