import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

import { useAuth } from '../context/AuthContext';
import { Colors } from '../constants/theme';

// Screens
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import SOSScreen from '../screens/SOSScreen';
import MapScreen from '../screens/MapScreen';
import ContactsScreen from '../screens/ContactsScreen';
import ChatScreen from '../screens/ChatScreen';
import ProfileScreen from '../screens/ProfileScreen';
import AlertHistoryScreen from '../screens/AlertHistoryScreen';
import FakeCallScreen from '../screens/FakeCallScreen';
import SafeTimerScreen from '../screens/SafeTimerScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TabNavigator = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarHideOnKeyboard: true,
      tabBarStyle: {
        backgroundColor: Colors.backgroundSecondary,
        borderTopColor: Colors.cardBorder,
        borderTopWidth: 1,
        height: 65,
        paddingBottom: 8,
        paddingTop: 4,
      },
      tabBarActiveTintColor: Colors.primary,
      tabBarInactiveTintColor: Colors.textMuted,
      tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      tabBarIcon: ({ color, size, focused }) => {
        const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
          Home: focused ? 'home' : 'home-outline',
          SOS: focused ? 'alert-circle' : 'alert-circle-outline',
          Map: focused ? 'map' : 'map-outline',
          Contacts: focused ? 'people' : 'people-outline',
          Chat: focused ? 'chatbubbles' : 'chatbubbles-outline',
        };
        return <Ionicons name={icons[route.name]} size={size} color={color} />;
      },
    })}
  >
    <Tab.Screen name="Home" component={HomeScreen} />
    <Tab.Screen name="Map" component={MapScreen} />
    <Tab.Screen
      name="SOS"
      component={SOSScreen}
      options={{
        tabBarIcon: ({ focused }) => (
          <View style={{
            width: 58, height: 58, borderRadius: 29,
            backgroundColor: Colors.danger,
            justifyContent: 'center', alignItems: 'center',
            marginBottom: 25,
            shadowColor: Colors.danger,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.8,
            shadowRadius: 10,
            elevation: 10,
          }}>
            <Ionicons name="warning" size={32} color="#fff" />
          </View>
        ),
        tabBarLabel: '',
        tabBarActiveTintColor: Colors.danger,
      }}
    />
    <Tab.Screen name="Contacts" component={ContactsScreen} />
    <Tab.Screen name="Chat" component={ChatScreen} />
  </Tab.Navigator>
);

export default function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <>
            <Stack.Screen name="Main" component={TabNavigator} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="AlertHistory" component={AlertHistoryScreen} />
            <Stack.Screen name="FakeCall" component={FakeCallScreen} options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
            <Stack.Screen name="SafeTimer" component={SafeTimerScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
});
