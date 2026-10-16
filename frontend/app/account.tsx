import { useState } from 'react';
import { Alert, Pressable, ScrollView, Share, Text } from 'react-native';
import { Stack } from 'expo-router';
import { apiRequest } from '../services/api';
import { clearCredentials } from '../features/auth/credentials';
import { offline, useOffline } from '../features/offline/store';
import { disableOwnedNotifications } from '../features/notifications/local';
import { workoutStyles as s } from '../features/workouts/styles';
export default function AccountScreen() {
  const state = useOffline();
  const pending = Object.values(state.workouts).reduce((sum,w) => sum+w.queue.length,0)+Object.keys(state.starts).length;
  const [busy,setBusy] = useState(false),[message,setMessage] = useState('');
  const enabled = process.env.EXPO_PUBLIC_AUTH_MODE === 'owner';
  async function run(work: () => Promise<void>) {
    if (busy) return;setBusy(true);setMessage('');
    try { await work(); } catch (e) { setMessage((e as Error).message); } finally { setBusy(false); }
  }
  async function cleanup() { offline.clearSynced();await disableOwnedNotifications();await clearCredentials(); }
  const button = (label: string,action: () => void,disabled = false) => <Pressable accessibilityRole="button" disabled={disabled || busy} accessibilityState={{ disabled: disabled || busy }} style={[s.secondary,(disabled || busy) && s.disabled]} onPress={action}><Text style={s.accent}>{label}</Text></Pressable>;
  return <ScrollView style={s.screen} contentContainerStyle={s.content}>
    <Stack.Screen options={{ title: 'Account and data' }} /><Text accessibilityRole="header" style={s.title}>Your private account</Text>
    <Text style={s.body}>{enabled ? 'Only the provisioned owner can access this deployment. Sign-ins expire after 30 days.' : 'Local development mode: owner sign-in is not enabled for this build.'}</Text>
    <Text style={s.body}>{pending} changes or unconfirmed starts need synchronization before sign-out or deletion.</Text>
    {!!message && <Text accessibilityRole="alert" style={s.error}>{message}</Text>}
    {button('Export server data',() => { void run(async () => {
      const data = await apiRequest('/account/export');await Share.share({ title: 'Life Strong data export',message: JSON.stringify(data,null,2) });
    }); },!enabled)}
    <Text style={s.body}>The export includes synchronized training data and your owner email, not passwords or session tokens. Pending device changes are not included. Sharing sends data only to the destination you choose.</Text>
    {button('Sign out and clear this device',() => Alert.alert('Sign out?', 'Synced device cache, saved credentials and scheduled alerts will be removed. Server training history remains.',[
      { text: 'Cancel',style: 'cancel' },{ text: 'Sign out',onPress: () => { void run(async () => { await apiRequest('/account/logout','POST',{});await cleanup(); }); } },
    ]),!enabled || pending>0)}
    {button('Delete account and live training data',() => Alert.alert('Delete your account?', 'This deletes synchronized training records and disables the owner account. Backups retain data until their configured retention period expires.',[
      { text: 'Cancel',style: 'cancel' },{ text: 'Continue',style: 'destructive',onPress: () => Alert.alert('This cannot be undone', 'Reactivation requires owner setup by the deployment administrator. Export your data first if needed.',[
        { text: 'Keep account',style: 'cancel' },{ text: 'Delete my account',style: 'destructive',onPress: () => { void run(async () => { await apiRequest('/account','DELETE',{ confirmation: 'DELETE MY ACCOUNT' });await cleanup(); }); } },
      ]) },
    ]),!enabled || pending>0)}
    <Text style={s.body}>Local drafts stay on this device until synchronized or deliberately cleared. No analytics or advertising services are included. Password recovery requires the private owner setup procedure; there is no public email reset service.</Text>
  </ScrollView>;
}
