import { Modal, Pressable, View } from 'react-native';

import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';

/** "Are you sure?" window in the app's own look, instead of the phone's system dialog. */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  message: string;
  /** Text of the red button that does the action, e.g. "Выйти". */
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onCancel}>
      <View className="flex-1 items-center justify-center px-6">
        <Pressable
          onPress={onCancel}
          accessibilityLabel="Закрыть"
          className="absolute inset-0 bg-black/40"
        />
        <View
          accessibilityRole="alert"
          className="w-full max-w-[360px] gap-5 rounded-[18px] bg-background-0 p-6"
          style={{ boxShadow: '0 12px 32px rgba(28, 27, 24, 0.25)' }}>
          <View className="gap-2">
            <Heading size="xl">{title}</Heading>
            <Text className="text-[15px] leading-[21px] text-typography-700">{message}</Text>
          </View>
          <View className="gap-2">
            <Button size="lg" action="negative" className="h-12 rounded-xl" onPress={onConfirm}>
              <ButtonText className="font-body-semibold">{confirmLabel}</ButtonText>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 rounded-xl border-outline-300"
              onPress={onCancel}>
              <ButtonText className="font-body-semibold text-typography-900">Отмена</ButtonText>
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}
