import { useState } from 'react';
import { Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Stack } from 'expo-router';
import { preferences, savePreferences, testNotification, type Preferences } from '../features/notifications/local';
import { workoutStyles as s } from '../features/workouts/styles';
const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
export default function RemindersScreen() {
  const [p,setP] = useState(preferences);
  const [hour,setHour] = useState(String(p.hour));
  const [minute,setMinute] = useState(String(p.minute).padStart(2,'0'));
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState('');
  async function run(work: () => Promise<void>) {
    setBusy(true); setMessage(''); try { await work(); } catch (e) { setP(preferences()); setMessage((e as Error).message); } finally { setBusy(false); }
  }
  async function save(next: Preferences) {
    await savePreferences(next); setP(next); setMessage('Notification preferences saved.');
  }
  const button = (label: string,press: () => void) => <Pressable accessibilityRole="button" disabled={busy} style={[s.secondary,busy && s.disabled]} onPress={press}><Text style={s.accent}>{label}</Text></Pressable>;
  return <ScrollView style={s.screen} contentContainerStyle={s.content} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
    <Stack.Screen options={{ title: 'Reminders' }} /><Text accessibilityRole="header" style={s.title}>Make time to train</Text>
    <Text style={s.body}>Local reminders work without the API. Notification permission is requested when you enable alerts or send a test.</Text>
    {!!message && <Text accessibilityLiveRegion="polite" style={s.accent}>{message}</Text>}
    <View style={s.card}>
      <Text style={s.heading}>Workout reminders: {p.reminders ? 'on' : 'off'}</Text>
      <Text style={s.body}>Choose days and a local time (24-hour clock).</Text>
      <View style={s.row}>{days.map((day,i) => <Pressable key={day} accessibilityRole="button" accessibilityState={{ selected: p.days.includes(i+1) }} disabled={busy} style={[s.secondary,p.days.includes(i+1) && { backgroundColor: '#284850' }]} onPress={() => setP(current => ({ ...current,days: current.days.includes(i+1) ? current.days.filter(d => d !== i+1) : [...current.days,i+1] }))}><Text style={s.accent}>{day}</Text></Pressable>)}</View>
      <Text style={s.body}>Hour</Text><TextInput accessibilityLabel="Reminder hour" keyboardType="number-pad" maxLength={2} style={s.input} value={hour} onChangeText={setHour} />
      <Text style={s.body}>Minute</Text><TextInput accessibilityLabel="Reminder minute" keyboardType="number-pad" maxLength={2} style={s.input} value={minute} onChangeText={setMinute} />
      {button('Save / enable workout reminders',() => { void run(async () => {
        if (!/^\d{1,2}$/.test(hour) || !/^\d{1,2}$/.test(minute)) throw new Error('Enter an hour and minute.');
        await save({ ...p,reminders: true,hour: Number(hour),minute: Number(minute) });
      }); })}
      {button('Disable workout reminders',() => { void run(() => save({ ...preferences(),reminders: false })); })}
    </View>
    <View style={s.card}><Text style={s.heading}>Rest alerts: {p.rest ? 'on' : 'off'}</Text>
      <Text style={s.body}>Get a local alert when a running rest timer finishes, including while your phone is locked. Pause, skip, or complete the workout to cancel its rest alert.</Text>
      {button(p.rest ? 'Disable rest alerts' : 'Enable rest alerts',() => { void run(() => save({ ...preferences(),rest: !p.rest })); })}
    </View>
    {button('Send a test alert in 10 seconds',() => { void run(async () => { await testNotification(); setMessage('Test scheduled. Lock your phone or switch apps for 10 seconds.'); }); })}
    {button('Open iPhone notification settings',() => { void Linking.openSettings(); })}
    <Text style={s.body}>Focus modes, notification summaries, and sound settings can affect presentation. In Expo Go, permissions and app identity belong to Expo Go. A standalone build needs its own permission and device validation.</Text>
  </ScrollView>;
}
