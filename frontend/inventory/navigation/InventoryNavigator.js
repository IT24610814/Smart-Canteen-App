import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import StockDashboard from '../screens/StockDashboard';
import ProfileScreen from '../../shared/screens/ProfileScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const InventoryTabs = ({ onSignOut }) => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#38bdf8',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarIcon: ({ focused, color, size }) => {
          let iconName = 'ellipse';
          const routeName = route.name.toLowerCase();
          if (routeName.includes('dashboard') || routeName.includes('home')) iconName = focused ? 'home' : 'home-outline';
          else if (routeName.includes('staff') || routeName.includes('customer') || routeName.includes('user') || routeName.includes('profile') || routeName.includes('security')) iconName = focused ? 'person' : 'person-outline';
          else if (routeName.includes('menu') || routeName.includes('food') || routeName.includes('catalog')) iconName = focused ? 'restaurant' : 'restaurant-outline';
          else if (routeName.includes('order')) iconName = focused ? 'cart' : 'cart-outline';
          else if (routeName.includes('bill') || routeName.includes('finance') || routeName.includes('transaction')) iconName = focused ? 'cash' : 'cash-outline';
          else if (routeName.includes('feedback')) iconName = focused ? 'star' : 'star-outline';
          else if (routeName.includes('inventory') || routeName.includes('stock')) iconName = focused ? 'cube' : 'cube-outline';
          else if (routeName.includes('promo')) iconName = focused ? 'pricetag' : 'pricetag-outline';
          else if (routeName.includes('report')) iconName = focused ? 'bar-chart' : 'bar-chart-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarAllowFontScaling: false,
        tabBarLabelStyle: { paddingBottom: 0, fontSize: 11, marginBottom: 2 },
        tabBarStyle: { height: 65, paddingBottom: 5, paddingTop: 5, backgroundColor: '#0f172a', borderTopColor: '#334155', borderTopWidth: 1 }
      })}
    >
      <Tab.Screen name="Dashboard" component={StockDashboard} options={{ title: 'Stock' }} />
      <Tab.Screen name="Profile" options={{ title: 'Profile' }}>
        {(props) => <ProfileScreen {...props} userRole="inventory" />}
      </Tab.Screen>
    </Tab.Navigator>
  );
};

const InventoryNavigator = ({ onSignOut }) => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="InventoryTabs">
        {(props) => <InventoryTabs {...props} onSignOut={onSignOut} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
};

export default InventoryNavigator;
