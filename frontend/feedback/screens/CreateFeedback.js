import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const CreateFeedback = () => {
  return (
    <View style={styles.container}>
      <Text allowFontScaling={false} style={styles.title}>Create Feedback</Text>
      <Text allowFontScaling={false} style={styles.placeholder}>Implementation pending</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#38bdf8',
  },
  placeholder: {
    marginTop: 10,
    color: '#94a3b8',
  },
});

export default CreateFeedback;
