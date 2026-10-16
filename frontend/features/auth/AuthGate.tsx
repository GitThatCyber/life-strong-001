import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { getAccessToken, setAccessToken, subscribeToken } from '../../services/accessToken';
import { apiRequest } from '../../services/api';
import { clearCredentials, readCredentials, saveCredentials } from './credentials';
import { workoutStyles as s } from '../workouts/styles';
export function AuthGate({ children }: { children: ReactNode }) {
  const enabled = process.env.EXPO_PUBLIC_AUTH_MODE === 'owner';
  const token = useSyncExternalStore(subscribeToken,getAccessToken,getAccessToken);
  const [ready,setReady] = useState(!enabled);
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  useEffect(() => {
    if (!enabled) return;
    void readCredentials().then(setAccessToken).catch(e => setError(`Unable to read secure sign-in: ${e.message}`)).finally(() => setReady(true));
  },[enabled]);
  useEffect(() => { if (enabled && ready && token === null) void clearCredentials().catch(e => setError(`Unable to clear expired sign-in: ${e.message}`)); },[token,ready,enabled]);
  async function login() {
    if (busy) return;
    setBusy(true);setError('');
    try {
      const result = await apiRequest<{ token: string }>('/auth/login','POST',{ email: email.trim().toLowerCase(),password });
      await saveCredentials(result.token);setPassword('');
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  if (!enabled) return <>{children}</>;
  if (!ready) return <View style={[s.screen,{ justifyContent: 'center' }]}><ActivityIndicator color="#65dcc0" /></View>;
  if (token) return <>{children}</>;
  return <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={[s.content,{ flexGrow: 1,justifyContent: 'center' }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <Text accessibilityRole="header" style={s.title}>Your private training space</Text>
      <Text style={s.body}>Sign in with the owner account configured for this app. No public registration is enabled.</Text>
      {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
      <Text style={s.body}>Email</Text><TextInput accessibilityLabel="Owner email" style={s.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} textContentType="username" editable={!busy} />
      <Text style={s.body}>Password</Text><TextInput accessibilityLabel="Owner password" style={s.input} value={password} onChangeText={setPassword} secureTextEntry textContentType="password" editable={!busy} />
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} style={[s.button,busy && s.disabled]} onPress={() => { void login(); }}><Text style={s.buttonText}>{busy ? 'Signing in…' : 'Sign in'}</Text></Pressable>
      <Text style={s.body}>An existing sign-in allows cached workouts offline. A new sign-in needs a connection.</Text>
    </ScrollView>
  </KeyboardAvoidingView>;
}
