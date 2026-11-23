import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastBanner } from '../src/components/ToastBanner';
import { ParcelsProvider } from '../src/context/ParcelsContext';
import { COLORS } from '../src/theme/tokens';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ParcelsProvider>
        <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: COLORS.bg },
              headerTintColor: COLORS.text,
              headerShadowVisible: false,
              contentStyle: { backgroundColor: COLORS.bg },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="add"
              options={{
                presentation: 'modal',
                title: 'Drop AWB or Paste SMS',
                headerTitleStyle: { fontWeight: '700' },
              }}
            />
            <Stack.Screen
              name="parcel/[id]"
              options={{
                title: 'Parcel Journey',
                headerTitleStyle: { fontWeight: '700' },
              }}
            />
          </Stack>
          <ToastBanner />
        </View>
      </ParcelsProvider>
    </SafeAreaProvider>
  );
}
