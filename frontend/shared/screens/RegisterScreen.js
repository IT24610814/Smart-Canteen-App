import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Platform
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import api from '../api/axiosConfig';
import { formatDate, parseDate, isNicValid, isGmailEmail, isPhoneValid, isAgeAtLeast, isPasswordStrong } from '../utils/formValidators';

const WebDateInput = ({ value, onChange, disabled, style }) => {
  if (Platform.OS !== 'web') {
    return null;
  }

  return (
    <input
      type="date"
      value={value}
      max={formatDate(new Date())}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      style={style}
    />
  );
};


const RegisterScreen = ({ navigation, onSignIn }) => {
  const [form, setForm] = useState({
    fullName: '',
    username: '',
    nic: '',
    email: '',
    phone: '',
    address: '',
    dateOfBirth: '',
    password: '',
    confirmPassword: ''
  });
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleRegister = async () => {
    const { fullName, username, nic, email, phone, address, dateOfBirth, password, confirmPassword } = form;

    if (!fullName || !username || !nic || !email || !phone || !address || !dateOfBirth || !password || !confirmPassword) {
      setError('All fields are required');
      return;
    }

    // NIC validation: 12 digits or 9 digits with V/v
    const nicRegex = /^(\d{12}|\d{9}[Vv])$/;
    if (!nicRegex.test(nic.trim())) {
      setError('NIC must be 12 digits or 9 digits followed by V or v');
      return;
    }

    // Email validation: must end with @gmail.com
    if (!email.trim().toLowerCase().endsWith('@gmail.com')) {
      setError('Email must end with @gmail.com');
      return;
    }

    // Phone validation: 10 digits
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(phone.trim())) {
      setError('Phone number must be exactly 10 digits');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!isPasswordStrong(password)) {
      setError('Password must be at least 8 characters and include both letters and numbers');
      return;
    }

    if (!isAgeAtLeast(dateOfBirth, 16)) {
      setError('Age must be greater than or equal to 16');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const response = await api.post('/auth/register', {
        fullName: fullName.trim(),
        username: username.trim(),
        nic: nic.trim(),
        email: email.trim(),
        phone: phone.trim(),
        address: address.trim(),
        dateOfBirth,
        password
      });

      await onSignIn(response.data.token, response.data.role);
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text allowFontScaling={false} style={styles.title}>Customer Registration</Text>
      <Text allowFontScaling={false} style={styles.subtitle}>Create your account</Text>

      <View style={styles.formContainer}>
        <TextInput
          style={styles.input}
          placeholder="Full Name"
          value={form.fullName}
          onChangeText={(value) => updateField('fullName', value)}
          editable={!loading}
          placeholderTextColor="#999"
        />

        <TextInput
          style={styles.input}
          placeholder="Username"
          value={form.username}
          onChangeText={(value) => updateField('username', value)}
          editable={!loading}
          placeholderTextColor="#999"
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          placeholder="NIC"
          value={form.nic}
          onChangeText={(value) => updateField('nic', value)}
          editable={!loading}
          placeholderTextColor="#999"
          autoCapitalize="characters"
        />

        <TextInput
          style={styles.input}
          placeholder="Email"
          value={form.email}
          onChangeText={(value) => updateField('email', value)}
          editable={!loading}
          placeholderTextColor="#999"
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          placeholder="Phone (10 digits)"
          value={form.phone}
          onChangeText={(value) => updateField('phone', value)}
          editable={!loading}
          placeholderTextColor="#999"
          keyboardType="phone-pad"
        />

        <TextInput
          style={styles.input}
          placeholder="Address"
          value={form.address}
          onChangeText={(value) => updateField('address', value)}
          editable={!loading}
          placeholderTextColor="#999"
        />

        {Platform.OS === 'web' ? (
          <WebDateInput
            value={form.dateOfBirth}
            onChange={(value) => updateField('dateOfBirth', value)}
            disabled={loading}
            style={styles.webDateInput}
          />
        ) : (
          <>
            <TouchableOpacity
              style={styles.dateInput}
              onPress={() => setShowDobPicker(true)}
              disabled={loading}
            >
              <Text allowFontScaling={false} style={form.dateOfBirth ? styles.dateValue : styles.datePlaceholder}>
                {form.dateOfBirth || 'Select Date of Birth'}
              </Text>
            </TouchableOpacity>

            {showDobPicker && (
              <DateTimePicker
                value={parseDate(form.dateOfBirth)}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                maximumDate={new Date()}
                onChange={(_event, selectedDate) => {
                  setShowDobPicker(false);
                  if (selectedDate) {
                    updateField('dateOfBirth', formatDate(selectedDate));
                  }
                }}
              />
            )}
          </>
        )}

        <TextInput
          style={styles.input}
          placeholder="Password"
          value={form.password}
          onChangeText={(value) => updateField('password', value)}
          editable={!loading}
          placeholderTextColor="#999"
          secureTextEntry
        />

        <TextInput
          style={styles.input}
          placeholder="Confirm Password"
          value={form.confirmPassword}
          onChangeText={(value) => updateField('confirmPassword', value)}
          editable={!loading}
          placeholderTextColor="#999"
          secureTextEntry
        />

        {!!error && <Text allowFontScaling={false} style={styles.errorText}>{error}</Text>}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text allowFontScaling={false} style={styles.buttonText}>Register</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Login')} disabled={loading}>
          <Text allowFontScaling={false} style={styles.linkText}>Already have an account? Sign In</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 30,
    backgroundColor: '#f5f5f5'
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#1abc9c'
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#7f8c8d',
    marginTop: 6,
    marginBottom: 24
  },
  formContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    elevation: 4
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    marginBottom: 12,
    borderRadius: 8,
    fontSize: 16
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    marginBottom: 12,
    borderRadius: 8,
    backgroundColor: '#fff'
  },
  datePlaceholder: {
    color: '#999',
    fontSize: 16
  },
  dateValue: {
    color: '#111827',
    fontSize: 16
  },
  webDateInput: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    marginBottom: 12,
    borderRadius: 8,
    fontSize: 16,
    backgroundColor: '#fff',
    boxSizing: 'border-box'
  },
  button: {
    backgroundColor: '#1abc9c',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8
  },
  buttonDisabled: {
    opacity: 0.6
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold'
  },
  errorText: {
    color: '#e74c3c',
    textAlign: 'center',
    marginBottom: 8
  },
  linkText: {
    color: '#1abc9c',
    textAlign: 'center',
    marginTop: 14,
    textDecorationLine: 'underline'
  }
});

export default RegisterScreen;
