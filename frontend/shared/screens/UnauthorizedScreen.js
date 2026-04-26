import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const UnauthorizedScreen = ({ navigation, onSignOut }) => {
  const handleReturnToLogin = async () => {
    if (onSignOut) {
      await onSignOut();
      return;
    }

    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('userRole');
    navigation.replace('Login');
  };

  return (
    <View style={styles.container}>
      <Text allowFontScaling={false} style={styles.title}>Unauthorized Access</Text>
      <Text allowFontScaling={false} style={styles.message}>
        Your role is not recognized in the system. Please contact an administrator.
      </Text>
      <TouchableOpacity style={styles.button} onPress={handleReturnToLogin}>
        <Text allowFontScaling={false} style={styles.buttonText}>Return to Login</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#e74c3c',
    marginBottom: 15,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    color: '#7f8c8d',
    marginBottom: 30,
  },
  button: {
    backgroundColor: '#1abc9c',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default UnauthorizedScreen;
