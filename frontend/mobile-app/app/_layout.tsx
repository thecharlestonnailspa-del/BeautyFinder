import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#ffbed4' },
        headerTintColor: '#7c1f48',
        headerShadowVisible: false,
        headerTitleStyle: {
          fontWeight: '800',
        },
        contentStyle: { backgroundColor: '#ffeef5' },
      }}
    />
  );
}
