import { View } from 'react-native';

import { posterColor } from '@/lib/library';

const SIZES = {
  sm: { width: 56, height: 80, borderRadius: 6 },
  lg: { width: 132, height: 190, borderRadius: 8 },
};

/** Coloured placeholder cover until titles get real posters from the catalog. */
export function Poster({ id, size = 'sm' }: { id: string; size?: keyof typeof SIZES }) {
  return (
    <View
      style={[
        SIZES[size],
        { backgroundColor: posterColor(id) },
        size === 'lg' && {
          boxShadow: '0 8px 24px rgba(60, 45, 25, 0.25)',
        },
      ]}
    />
  );
}
