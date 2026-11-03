import { useColorScheme } from '@/hooks/useColorScheme';
import { escucharMensajes } from '@/hooks/mqttClient';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    escucharMensajes();
  }, []);

  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded) return null;

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="screens/MenuScreen" />
        <Stack.Screen name="screens/MessageScreen" />
        <Stack.Screen name="screens/ReminderScreen" />
        <Stack.Screen name="screens/ViewRemindersScreen" />
        <Stack.Screen name="screens/ViewConfirmationsScreen" />
        <Stack.Screen name="ProfileScreen" />
      </Stack>

      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
    </>
  );
}