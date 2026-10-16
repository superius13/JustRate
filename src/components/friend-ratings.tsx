import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import type { FriendRating } from '@/lib/friends';
import { formatScore } from '@/lib/library';

const COLLAPSED_REVIEW_LINES = 1;

/** «Оценки друзей»: each groupmate who rated the title, with their overall score and note. */
export function FriendRatings({ ratings }: { ratings: FriendRating[] }) {
  return (
    <VStack className="gap-3">
      <Heading size="lg" className="font-heading-semibold">Оценки друзей</Heading>
      <VStack className="rounded-[14px] border border-outline-200 bg-background-0">
        {ratings.map((rating, index) => (
          <FriendRatingRow key={rating.user_id} rating={rating} first={index === 0} />
        ))}
      </VStack>
    </VStack>
  );
}

function FriendRatingRow({ rating, first }: { rating: FriendRating; first: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [truncated, setTruncated] = useState(false);

  return (
    <Pressable
      onPress={() => setExpanded(!expanded)}
      disabled={!truncated}
      accessibilityRole={truncated ? 'button' : undefined}
      accessibilityLabel={truncated ? (expanded ? 'Свернуть заметку' : 'Показать заметку целиком') : undefined}
      className={`flex-row items-start gap-3 px-4 py-2.5 active:opacity-70 ${first ? '' : 'border-t border-outline-100'}`}>
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="font-body-semibold text-typography-900">{rating.display_name}</Text>
        {rating.review ? (
          <View>
            {/* Invisible full copy to count lines: a clipped Text reports only its visible lines on Android. */}
            <Text
              aria-hidden
              className="absolute left-0 right-0 top-0 text-[15px] leading-[21px] opacity-0"
              onTextLayout={(e) => setTruncated(e.nativeEvent.lines.length > COLLAPSED_REVIEW_LINES)}>
              {rating.review}
            </Text>
            <Text
              className="text-[15px] leading-[21px] text-typography-700"
              numberOfLines={expanded ? undefined : COLLAPSED_REVIEW_LINES}>
              {rating.review}
            </Text>
          </View>
        ) : (
          <Text className="text-[13px] text-typography-600">Без заметки</Text>
        )}
      </View>
      <View className="h-12 w-12 items-center justify-center rounded-[10px] bg-primary-50">
        <Text className="font-body-bold text-xl text-primary-500">{formatScore(rating.overall)}</Text>
      </View>
    </Pressable>
  );
}
