import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';

const SplashScreen = () => {
  return (
    <View style={styles.container}>
      <Text allowFontScaling={false} style={styles.title}>Smart Canteen</Text>
      <ActivityIndicator size="large" color="#1abc9c" style={{ marginTop: 20 }} />
      <Text allowFontScaling={false} style={styles.loadingText}>Loading...</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1abc9c',
  },
  loadingText: {
    marginTop: 10,
    color: '#7f8c8d',
  },
});

export default SplashScreen;
