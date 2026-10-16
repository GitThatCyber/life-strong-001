import { Stack } from 'expo-router';
import { BackgroundWork } from '../features/offline/BackgroundWork';
import { AuthGate } from '../features/auth/AuthGate';
export default function RootLayout() {
  return <AuthGate><BackgroundWork /><Stack screenOptions={{ headerStyle: { backgroundColor: '#10232a' }, headerTintColor: '#ffffff' }} /></AuthGate>;
}
