import { Stack } from 'expo-router';
import { BackgroundWork } from '../features/offline/BackgroundWork';
export default function RootLayout() {
  return <><BackgroundWork /><Stack screenOptions={{ headerStyle: { backgroundColor: '#10232a' }, headerTintColor: '#ffffff' }} /></>;
}
