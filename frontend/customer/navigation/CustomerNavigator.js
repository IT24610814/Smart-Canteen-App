import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import BrowseMenu from '../screens/BrowseMenu';
import ManualOrder from '../screens/ManualOrder';
import BillingSystem from '../screens/BillingSystem';
import MyFeedback from '../screens/MyFeedback';
import ProfileScreen from '../../shared/screens/ProfileScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const CustomerTabs = () => {
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
      <Tab.Screen name="Menu" component={BrowseMenu} />
      <Tab.Screen name="ManualOrder" component={ManualOrder} options={{ title: 'Order' }} />
      <Tab.Screen name="Billing" component={BillingSystem} />
      <Tab.Screen name="MyFeedback" component={MyFeedback} options={{ title: 'Feedback' }} />
      <Tab.Screen name="Profile">
        {(props) => <ProfileScreen {...props} userRole="customer" />}
      </Tab.Screen>
    </Tab.Navigator>
  );
};

const CustomerNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CustomerTabs" component={CustomerTabs} />
    </Stack.Navigator>
  );
};

export default CustomerNavigator;
