import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

import LoginScreen from './shared/screens/LoginScreen';
import SplashScreen from './shared/screens/SplashScreen';
import RegisterScreen from './shared/screens/RegisterScreen';

import AdminNavigator from './admin/navigation/AdminNavigator';
import FoodMasterNavigator from './foodmaster/navigation/FoodMasterNavigator';
import InventoryNavigator from './inventory/navigation/InventoryNavigator';
import PromotionNavigator from './promotion/navigation/PromotionNavigator';
import OrderNavigator from './order/navigation/OrderNavigator';
import FinanceNavigator from './finance/navigation/FinanceNavigator';
import FeedbackNavigator from './feedback/navigation/FeedbackNavigator';
import CustomerNavigator from './customer/navigation/CustomerNavigator';
import UnauthorizedScreen from './shared/screens/UnauthorizedScreen';
import { AuthContext } from './shared/context/AuthContext';

const Stack = createNativeStackNavigator();

export default function App() {
  const [state, dispatch] = React.useReducer(
    (prevState, action) => {
      switch (action.type) {
        case 'RESTORE_TOKEN':
          return {
            ...prevState,
            userToken: action.payload.token,
            userRole: action.payload.role,
            isLoading: false,
          };
        case 'SIGN_IN':
          return {
            ...prevState,
            isSignout: false,
            userToken: action.payload.token,
            userRole: action.payload.role,
          };
        case 'SIGN_OUT':
          return {
            ...prevState,
            isSignout: true,
            userToken: null,
            userRole: null,
          };
        default:
          return prevState;
      }
    },
    {
      isLoading: true,
      isSignout: false,
      userToken: null,
      userRole: null,
    }
  );

  useEffect(() => {
    const bootstrapAsync = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        const role = await AsyncStorage.getItem('userRole');
        if (token && role) {
          dispatch({ type: 'RESTORE_TOKEN', payload: { token, role } });
        } else {
          dispatch({ type: 'RESTORE_TOKEN', payload: { token: null, role: null } });
        }
      } catch (e) {
        console.error('Failed to restore token:', e);
        dispatch({ type: 'RESTORE_TOKEN', payload: { token: null, role: null } });
      }
    };

    bootstrapAsync();
  }, []);

  const handleSignIn = async (token, role) => {
    await AsyncStorage.setItem('token', token);
    await AsyncStorage.setItem('userRole', role);
    dispatch({ type: 'SIGN_IN', payload: { token, role } });
  };

  const handleSignOut = async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('userRole');
    dispatch({ type: 'SIGN_OUT' });
  };

  const knownRoles = ['admin', 'foodmaster', 'inventory', 'promotion', 'order', 'finance', 'feedback', 'customer'];
  const isUnknownRole = state.userToken && !knownRoles.includes(state.userRole);

  if (state.isLoading) {
    return <SplashScreen />;
  }

  return (
    <AuthContext.Provider value={{ signIn: handleSignIn, signOut: handleSignOut, userRole: state.userRole }}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {state.userToken == null ? (
            <>
              <Stack.Screen name="Login" options={{ animationEnabled: false }}>
                {(props) => <LoginScreen {...props} onSignIn={handleSignIn} />}
              </Stack.Screen>
              <Stack.Screen name="Register" options={{ animationEnabled: true }}>
                {(props) => <RegisterScreen {...props} onSignIn={handleSignIn} />}
              </Stack.Screen>
              <Stack.Screen name="Unauthorized" component={UnauthorizedScreen} />
            </>
          ) : isUnknownRole ? (
            <Stack.Screen name="Unauthorized" options={{ animationEnabled: false }}>
              {(props) => <UnauthorizedScreen {...props} onSignOut={handleSignOut} />}
            </Stack.Screen>
          ) : (
            <>
              {state.userRole === 'admin' && (
                <Stack.Screen name="Admin" options={{ animationEnabled: false }}>
                  {(props) => <AdminNavigator {...props} onSignOut={handleSignOut} />}
                </Stack.Screen>
              )}
              {state.userRole === 'foodmaster' && (
                <Stack.Screen name="FoodMaster" options={{ animationEnabled: false }}>
                  {(props) => <FoodMasterNavigator {...props} onSignOut={handleSignOut} />}
                </Stack.Screen>
              )}
              {state.userRole === 'inventory' && (
                <Stack.Screen name="Inventory" options={{ animationEnabled: false }}>
                  {(props) => <InventoryNavigator {...props} onSignOut={handleSignOut} />}
                </Stack.Screen>
              )}
              {state.userRole === 'promotion' && <Stack.Screen name="Promotion" component={PromotionNavigator} options={{ animationEnabled: false }} />}
              {state.userRole === 'order' && <Stack.Screen name="Order" component={OrderNavigator} options={{ animationEnabled: false }} />}
              {state.userRole === 'finance' && <Stack.Screen name="Finance" component={FinanceNavigator} options={{ animationEnabled: false }} />}
              {state.userRole === 'feedback' && <Stack.Screen name="Feedback" component={FeedbackNavigator} options={{ animationEnabled: false }} />}
              {state.userRole === 'customer' && <Stack.Screen name="Customer" component={CustomerNavigator} options={{ animationEnabled: false }} />}
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </AuthContext.Provider>
  );
}
