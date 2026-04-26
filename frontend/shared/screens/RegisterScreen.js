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
          placeholderTextColor="#94a3b8"
        />

        <TextInput
          style={styles.input}
          placeholder="Username"
          value={form.username}
          onChangeText={(value) => updateField('username', value)}
          editable={!loading}
          placeholderTextColor="#94a3b8"
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          placeholder="NIC"
          value={form.nic}
          onChangeText={(value) => updateField('nic', value)}
          editable={!loading}
          placeholderTextColor="#94a3b8"
          autoCapitalize="characters"
        />

        <TextInput
          style={styles.input}
          placeholder="Email"
          value={form.email}
          onChangeText={(value) => updateField('email', value)}
          editable={!loading}
          placeholderTextColor="#94a3b8"
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          placeholder="Phone (10 digits)"
          value={form.phone}
          onChangeText={(value) => updateField('phone', value)}
          editable={!loading}
          placeholderTextColor="#94a3b8"
          keyboardType="phone-pad"
        />

        <TextInput
          style={styles.input}
          placeholder="Address"
          value={form.address}
          onChangeText={(value) => updateField('address', value)}
          editable={!loading}
          placeholderTextColor="#94a3b8"
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
          placeholderTextColor="#94a3b8"
          secureTextEntry
        />

        <TextInput
          style={styles.input}
          placeholder="Confirm Password"
          value={form.confirmPassword}
          onChangeText={(value) => updateField('confirmPassword', value)}
          editable={!loading}
          placeholderTextColor="#94a3b8"
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
    backgroundColor: '#0f172a'
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    color: '#38bdf8',
    letterSpacing: 1,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#94a3b8',
    marginBottom: 30,
    letterSpacing: 0.5,
  },
  formContainer: {
    backgroundColor: '#1e293b',
    padding: 25,
    borderRadius: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  input: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    color: '#f8fafc',
    padding: 15,
    marginBottom: 15,
    borderRadius: 10,
    fontSize: 16
  },
  dateInput: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    padding: 15,
    marginBottom: 15,
    borderRadius: 10,
  },
  datePlaceholder: {
    color: '#94a3b8',
    fontSize: 16
  },
  dateValue: {
    color: '#f8fafc',
    fontSize: 16
  },
  webDateInput: {
    width: '100%',
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    color: '#f8fafc',
    padding: 15,
    marginBottom: 15,
    borderRadius: 10,
    fontSize: 16,
    boxSizing: 'border-box'
  },
  button: {
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 15,
    elevation: 3,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
  },
  buttonDisabled: {
    opacity: 0.6
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  errorText: {
    color: '#ef4444',
    textAlign: 'center',
    marginBottom: 10,
    fontWeight: '600',
  },
  linkText: {
    color: '#38bdf8',
    textAlign: 'center',
    marginTop: 20,
    fontWeight: '600',
    textDecorationLine: 'none',
  }
});

export default RegisterScreen;
