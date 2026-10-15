import { Image } from 'expo-image';
import { View } from 'react-native';

import { posterColor } from '@/lib/library';

const SIZES = {
  sm: { width: 56, height: 80, borderRadius: 6 },
  lg: { width: 132, height: 190, borderRadius: 8 },
};

/** Cover from the catalog, on top of a coloured block that also stands in when there is no cover. */
export function Poster({
  id,
  url,
  size = 'sm',
}: {
  id: string;
  url?: string | null;
  size?: keyof typeof SIZES;
}) {
  const box = SIZES[size];
  return (
    <View
      style={[
        box,
        { backgroundColor: posterColor(id), overflow: 'hidden' },
        size === 'lg' && { boxShadow: '0 8px 24px rgba(60, 45, 25, 0.25)' },
      ]}>
      {url ? (
        <Image
          source={{ uri: url }}
          style={{ width: box.width, height: box.height }}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
        />
      ) : null}
    </View>
  );
}
