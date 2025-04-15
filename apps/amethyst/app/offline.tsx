import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { Icon } from '@/lib/icons/iconWithClassName';
import { CloudOff } from 'lucide-react-native';

export default function Offline() {
  return (
    <View className="flex-1 justify-center items-center gap-2">
      <Icon icon={CloudOff} size={64} />
      <Text className="text-center">Oops! Can’t connect to teal.fm.</Text>
    </View>
  );
}
