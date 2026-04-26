import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  Modal,
  Platform,
  Pressable
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import api from '../api/axiosConfig';
import { useAuth } from '../context/AuthContext';
import { isNicValid, isGmailEmail, isPhoneValid, isAgeAtLeast, isPasswordStrong } from '../utils/formValidators';

const WebDateInput = ({ value, onChange, style }) => {
  if (Platform.OS !== 'web') {
    return null;
  }

  return (
    <input
      type="date"
      value={value}
      max={formatDate(new Date())}
      onChange={(event) => onChange(event.target.value)}
      style={style}
    />
  );
};

const emptyPasswordForm = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
};

const formatValue = (value) => {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  return value;
};

const getMinimumAge = (role) => (role === 'customer' ? 17 : 16);

const isOldEnough = (dateOfBirth, minAge) => {
  const birthDate = new Date(dateOfBirth);
  if (Number.isNaN(birthDate.getTime())) {
    return false;
  }

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDifference = today.getMonth() - birthDate.getMonth();

  if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return age >= minAge;
};

const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDate = (dateString) => {
  if (!dateString) {
    return new Date(2000, 0, 1);
  }

  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) {
    return new Date(2000, 0, 1);
  }

  return parsed;
};

const buildProfilePhotoUri = (profilePhoto, versionToken) => {
  if (!profilePhoto) {
    // Local SVG data URI placeholder (no external network call)
    const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect width="160" height="160" fill="#e5e7eb"/><circle cx="80" cy="50" r="25" fill="#9ca3af"/><ellipse cx="80" cy="110" rx="40" ry="35" fill="#9ca3af"/></svg>`;
    return `data:image/svg+xml;base64,${typeof btoa !== 'undefined' ? btoa(placeholderSvg) : 'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNjAgMTYwIj48cmVjdCB3aWR0aD0iMTYwIiBoZWlnaHQ9IjE2MCIgZmlsbD0iI2U1ZTdlYiIvPjxjaXJjbGUgY3g9IjgwIiBjeT0iNTAiIHI9IjI1IiBmaWxsPSIjOWNhM2FmIi8+PGVsbGlwc2UgY3g9IjgwIiBjeT0iMTEwIiByeD0iNDAiIHJ5PSIzNSIgZmlsbD0iIzljYTNhZiIvPjwvc3ZnPg=='}`;
  }

  const serverBaseUrl = api.defaults.baseURL.replace(/\/api\/?$/, '');
  return `${serverBaseUrl}${profilePhoto}?v=${versionToken}`;
};

const ProfileScreen = ({ userRole }) => {
  const { signOut, userRole: authUserRole } = useAuth();
  const effectiveRole = userRole || authUserRole;
  const minimumAge = useMemo(() => getMinimumAge(effectiveRole), [effectiveRole]);

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordMessageType, setPasswordMessageType] = useState('error');
  const [error, setError] = useState('');
  const [editError, setEditError] = useState('');
  const [photoVersion, setPhotoVersion] = useState(Date.now());

  const [editOpen, setEditOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  const [editForm, setEditForm] = useState({
    fullName: '',
    username: '',
    nic: '',
    email: '',
    phone: '',
    address: '',
    dateOfBirth: ''
  });
  const [showEditDobPicker, setShowEditDobPicker] = useState(false);
  const [passwordForm, setPasswordForm] = useState(emptyPasswordForm);

  const syncEditForm = useCallback((data) => {
    setEditForm({
      fullName: data?.fullName || '',
      username: data?.username || '',
      nic: data?.nic || '',
      email: data?.email || '',
      phone: data?.phone || '',
      address: data?.address || '',
      dateOfBirth: data?.dateOfBirth ? String(data.dateOfBirth).slice(0, 10) : ''
    });
  }, []);

  const fetchProfile = useCallback(async () => {
    if (!effectiveRole) {
      setError('User role is unavailable. Please sign in again.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data } = await api.get(`/${effectiveRole}/profile`);
      setProfile(data);
      setPhotoVersion(Date.now());
      syncEditForm(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, [effectiveRole, syncEditForm]);

  React.useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProfile();
    setRefreshing(false);
  };

  const updateEditField = (key, value) => {
    setEditForm((prev) => ({ ...prev, [key]: value }));
  };

  const updatePasswordField = (key, value) => {
    setPasswordForm((prev) => ({ ...prev, [key]: value }));
  };

  const saveProfile = async () => {
    if (
      !editForm.fullName.trim() ||
      !editForm.username.trim() ||
      !editForm.nic.trim() ||
      !editForm.email.trim() ||
      !editForm.phone.trim() ||
      !editForm.address.trim() ||
      !editForm.dateOfBirth.trim()
    ) {
      setEditError('All fields are required.');
      return;
    }

    if (!isNicValid(editForm.nic)) {
      setEditError('NIC must be 12 digits or 9 digits followed by V, v, X, or x.');
      return;
    }

    if (!isGmailEmail(editForm.email)) {
      setEditError('Email must end with @gmail.com.');
      return;
    }

    if (!isPhoneValid(editForm.phone)) {
      setEditError('Phone number must be exactly 10 digits.');
      return;
    }

    if (!isAgeAtLeast(editForm.dateOfBirth, minimumAge)) {
      setEditError(`Age must be at least ${minimumAge}.`);
      return;
    }

    setEditError('');
    setSaving(true);

    try {
      const { data } = await api.put(`/${effectiveRole}/profile`, {
        fullName: editForm.fullName.trim(),
        username: editForm.username.trim(),
        nic: editForm.nic.trim(),
        email: editForm.email.trim(),
        phone: editForm.phone.trim(),
        address: editForm.address.trim(),
        dateOfBirth: editForm.dateOfBirth || null
      });

      const nextProfile = data.profile || data.user || profile;
      setProfile(nextProfile);
      syncEditForm(nextProfile);
      setEditOpen(false);
    } catch (err) {
      setEditError(err.response?.data?.message || 'Unable to update profile');
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordMessageType('error');
      setPasswordMessage('Fill in all password fields.');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMessageType('error');
      setPasswordMessage('New password and confirmation do not match.');
      return;
    }

    if (passwordForm.newPassword === passwordForm.currentPassword) {
      setPasswordMessageType('error');
      setPasswordMessage('New password must be different from current password.');
      return;
    }

    if (!isPasswordStrong(passwordForm.newPassword)) {
      setPasswordMessageType('error');
      setPasswordMessage('Password must be at least 8 characters and include both letters and numbers.');
      return;
    }

    setPasswordMessage('');
    setPasswordSaving(true);

    try {
      const { data } = await api.put(`/${effectiveRole}/change-password`, passwordForm);
      console.log('Password change response:', data);
      setPasswordMessageType('success');
      setPasswordMessage('Password changed successfully.');
      setPasswordOpen(false);
      setPasswordForm(emptyPasswordForm);
      Alert.alert('Success', 'Password changed successfully');
    } catch (err) {
      console.error('Password change error:', err.response?.data || err.message);
      const errorMsg = err.response?.data?.message || err.message || 'Unable to change password';
      setPasswordMessageType('error');
      setPasswordMessage(errorMsg);
    } finally {
      setPasswordSaving(false);
    }
  };

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please allow photo access to upload a profile image.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8
    });

    if (result.canceled || !result.assets?.length) {
      return;
    }

    const asset = result.assets[0];
    const nextPhotoNameBase = profile?.userId || profile?.staffId || 'user';
    const formData = new FormData();
    const extension = (asset.fileName || asset.uri || '').match(/\.[a-zA-Z0-9]+$/)?.[0] || '.jpg';
    const fileName = `${nextPhotoNameBase}-${Date.now()}${extension}`;

    if (Platform.OS === 'web') {
      // On web, expo-image-picker may return asset.file (File object) or a blob/data URI.
      if (asset.file) {
        formData.append('photo', asset.file, fileName);
      } else {
        // Convert blob/data URI to a Blob and append
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        formData.append('photo', blob, fileName);
      }
    } else {
      formData.append('photo', {
        uri: asset.uri,
        name: fileName,
        type: asset.mimeType || 'image/jpeg'
      });
    }

    try {
      // Do NOT manually set Content-Type on web — the browser sets it with the boundary automatically.
      // On native we must set it explicitly.
      const uploadHeaders = Platform.OS === 'web'
        ? {}
        : { 'Content-Type': 'multipart/form-data' };

      const { data } = await api.post(`/${effectiveRole}/profile/photo`, formData, {
        headers: uploadHeaders
      });
      if (data?.profilePhoto) {
        setProfile((prev) => ({ ...(prev || {}), profilePhoto: data.profilePhoto }));
        setPhotoVersion(Date.now());
      }
      await fetchProfile();
      Alert.alert('Success', 'Profile photo uploaded successfully');
    } catch (err) {
      Alert.alert('Upload failed', err.response?.data?.message || 'Unable to upload photo');
    }
  };

  const performDeletePhoto = async () => {
    try {
      await api.delete(`/${effectiveRole}/profile/photo`);
      setProfile((prev) => ({ ...(prev || {}), profilePhoto: null }));
      setPhotoVersion(Date.now());
      await fetchProfile();
      Alert.alert('Success', 'Profile photo deleted successfully');
    } catch (err) {
      Alert.alert('Delete failed', err.response?.data?.message || 'Unable to delete photo');
    }
  };

  const deletePhoto = async () => {
    if (Platform.OS === 'web') {
      const confirmed = typeof window !== 'undefined' ? window.confirm('Delete the current profile photo?') : true;
      if (confirmed) {
        await performDeletePhoto();
      }
      return;
    }

    Alert.alert('Delete Photo', 'Delete the current profile photo?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: performDeletePhoto }
    ]);
  };

  const performLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (_err) {
      // Sign out locally even if backend logout fails.
    }

    await signOut();
  };

  const logout = async () => {
    if (Platform.OS === 'web') {
      const confirmed = typeof window !== 'undefined' ? window.confirm('Logout from the system?') : true;
      if (confirmed) {
        await performLogout();
      }
      return;
    }

    Alert.alert('Logout', 'Logout from the system?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: performLogout }
    ]);
  };

  const detailRows = useMemo(
    () => [
      { label: 'User ID', value: formatValue(profile?.userId || profile?.staffId) },
      { label: 'Username', value: formatValue(profile?.username) },
      { label: 'Role', value: formatValue(profile?.role) },
      { label: 'Full Name', value: formatValue(profile?.fullName) },
      { label: 'Email', value: formatValue(profile?.email) },
      { label: 'Phone', value: formatValue(profile?.phone) },
      { label: 'NIC', value: formatValue(profile?.nic) },
      { label: 'Address', value: formatValue(profile?.address) },
      {
        label: 'Date of Birth',
        value: profile?.dateOfBirth ? new Date(profile.dateOfBirth).toLocaleDateString() : '-'
      }
    ],
    [profile]
  );

  if (loading && !profile) {
    return <ActivityIndicator size="large" color="#1abc9c" style={styles.loader} />;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text allowFontScaling={false} style={styles.title}>My Security Profile</Text>
        {!!error && <Text allowFontScaling={false} style={styles.errorText}>{error}</Text>}

        <View style={styles.card}>
          <Image source={{ uri: buildProfilePhotoUri(profile?.profilePhoto, photoVersion) }} style={styles.avatar} />

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.smallButton} onPress={pickPhoto}>
              <Text allowFontScaling={false} style={styles.smallButtonText}>Upload Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.smallButton, styles.warnButton]} onPress={deletePhoto}>
              <Text allowFontScaling={false} style={styles.smallButtonText}>Delete Photo</Text>
            </TouchableOpacity>
          </View>

          <Text allowFontScaling={false} style={styles.name}>{formatValue(profile?.fullName)}</Text>
          <Text allowFontScaling={false} style={styles.role}>{formatValue(profile?.role)}</Text>

          <View style={styles.detailsWrap}>
            {detailRows.map((item) => (
              <View key={item.label} style={styles.detailRow}>
                <Text allowFontScaling={false} style={styles.detailLabel}>{item.label}</Text>
                <Text allowFontScaling={false} style={styles.detailValue}>{item.value}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => {
              setEditError('');
              setEditOpen(true);
            }}
          >
            <Text allowFontScaling={false} style={styles.primaryButtonText}>Edit Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => setPasswordOpen(true)}>
            <Text allowFontScaling={false} style={styles.secondaryButtonText}>Change Password</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutButton} onPress={logout}>
            <Text allowFontScaling={false} style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={editOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ScrollView>
              <Text allowFontScaling={false} style={styles.modalTitle}>Edit Profile</Text>
              <Text allowFontScaling={false} style={styles.fieldLabel}>Full Name</Text>
              <TextInput allowFontScaling={false} style={styles.input} placeholder="Full Name" value={editForm.fullName} onChangeText={(value) => updateEditField('fullName', value)} />
              <Text allowFontScaling={false} style={styles.fieldLabel}>Username</Text>
              <TextInput allowFontScaling={false} style={styles.input} placeholder="Username" value={editForm.username} onChangeText={(value) => updateEditField('username', value)} autoCapitalize="none" />
              <Text allowFontScaling={false} style={styles.fieldLabel}>NIC</Text>
              <TextInput allowFontScaling={false} style={styles.input} placeholder="NIC" value={editForm.nic} onChangeText={(value) => updateEditField('nic', value)} autoCapitalize="characters" />
              <Text allowFontScaling={false} style={styles.fieldLabel}>Email</Text>
              <TextInput allowFontScaling={false} style={styles.input} placeholder="Email" value={editForm.email} onChangeText={(value) => updateEditField('email', value)} autoCapitalize="none" keyboardType="email-address" />
              <Text allowFontScaling={false} style={styles.fieldLabel}>Phone</Text>
              <TextInput allowFontScaling={false} style={styles.input} placeholder="Phone (10 digits)" value={editForm.phone} onChangeText={(value) => updateEditField('phone', value)} keyboardType="phone-pad" />
              <Text allowFontScaling={false} style={styles.fieldLabel}>Address</Text>
              <TextInput allowFontScaling={false} style={styles.input} placeholder="Address" value={editForm.address} onChangeText={(value) => updateEditField('address', value)} />
              <Text allowFontScaling={false} style={styles.fieldLabel}>Date of Birth</Text>
              {Platform.OS === 'web' ? (
                <WebDateInput
                  value={editForm.dateOfBirth}
                  onChange={(value) => updateEditField('dateOfBirth', value)}
                  style={styles.webDateInput}
                />
              ) : (
                <>
                  <TouchableOpacity style={styles.dateInput} onPress={() => setShowEditDobPicker(true)}>
                    <Text allowFontScaling={false} style={editForm.dateOfBirth ? styles.dateValue : styles.datePlaceholder}>
                      {editForm.dateOfBirth || 'Select Date of Birth'}
                    </Text>
                  </TouchableOpacity>

                  {showEditDobPicker && (
                    <DateTimePicker
                      value={parseDate(editForm.dateOfBirth)}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      maximumDate={new Date()}
                      onChange={(_event, selectedDate) => {
                        setShowEditDobPicker(false);
                        if (selectedDate) {
                          updateEditField('dateOfBirth', formatDate(selectedDate));
                        }
                      }}
                    />
                  )}
                </>
              )}

              {!!editError && <Text allowFontScaling={false} style={styles.errorText}>{editError}</Text>}

              <TouchableOpacity style={styles.primaryButton} onPress={saveProfile} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text allowFontScaling={false} style={styles.primaryButtonText}>Save Changes</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => {
                  syncEditForm(profile);
                  setShowEditDobPicker(false);
                  setEditError('');
                  setEditOpen(false);
                }}
              >
                <Text allowFontScaling={false} style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={passwordOpen} animationType="fade" transparent onRequestClose={() => setPasswordOpen(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setPasswordOpen(false)} />
          <View style={styles.modalCard}>
            <Text allowFontScaling={false} style={styles.modalTitle}>Change Password</Text>
            <TextInput allowFontScaling={false} 
              style={styles.input} 
              placeholder="Current Password" 
              value={passwordForm.currentPassword} 
              onChangeText={(value) => updatePasswordField('currentPassword', value)} 
              secureTextEntry
              editable={!passwordSaving}
            />
            <TextInput allowFontScaling={false} 
              style={styles.input} 
              placeholder="New Password" 
              value={passwordForm.newPassword} 
              onChangeText={(value) => updatePasswordField('newPassword', value)} 
              secureTextEntry
              editable={!passwordSaving}
            />
            <TextInput allowFontScaling={false} 
              style={styles.input} 
              placeholder="Confirm New Password" 
              value={passwordForm.confirmPassword} 
              onChangeText={(value) => updatePasswordField('confirmPassword', value)} 
              secureTextEntry
              editable={!passwordSaving}
            />

            {!!passwordMessage && (
              <Text allowFontScaling={false} style={passwordMessageType === 'success' ? styles.successText : styles.errorText}>
                {passwordMessage}
              </Text>
            )}

            <TouchableOpacity 
              style={[styles.primaryButton, passwordSaving && styles.buttonDisabled]} 
              onPress={changePassword} 
              disabled={passwordSaving}
              activeOpacity={passwordSaving ? 1 : 0.7}
            >
              {passwordSaving ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color="#fff" />
                  <Text allowFontScaling={false} style={styles.primaryButtonText}>Updating...</Text>
                </View>
              ) : (
                <Text allowFontScaling={false} style={styles.primaryButtonText}>Update Password</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => {
                setPasswordForm(emptyPasswordForm);
                setPasswordMessage('');
                setPasswordOpen(false);
              }}
              disabled={passwordSaving}
              activeOpacity={passwordSaving ? 1 : 0.7}
            >
              <Text allowFontScaling={false} style={styles.secondaryButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f5f8'
  },
  content: {
    padding: 16,
    paddingBottom: 28
  },
  loader: {
    marginTop: 40
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 10
  },
  errorText: {
    color: '#dc2626',
    marginBottom: 8
  },
  successText: {
    color: '#059669',
    marginBottom: 8
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    elevation: 2
  },
  avatar: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignSelf: 'center',
    marginBottom: 12,
    backgroundColor: '#e5e7eb'
  },
  name: {
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: '#111827'
  },
  role: {
    textAlign: 'center',
    color: '#0f766e',
    textTransform: 'capitalize',
    marginTop: 4,
    marginBottom: 14,
    fontWeight: '700'
  },
  detailsWrap: {
    gap: 10
  },
  detailRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 8
  },
  detailLabel: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2
  },
  detailValue: {
    color: '#1f2937',
    fontSize: 15
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14
  },
  smallButton: {
    flex: 1,
    backgroundColor: '#0ea5a2',
    borderRadius: 8,
    alignItems: 'center',
    paddingVertical: 10
  },
  warnButton: {
    backgroundColor: '#f59e0b'
  },
  smallButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12
  },
  primaryButton: {
    backgroundColor: '#0ea5a2',
    borderRadius: 8,
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 10
  },
  buttonDisabled: {
    backgroundColor: '#9ca3af',
    opacity: 0.6
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700'
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#94a3b8',
    borderRadius: 8,
    alignItems: 'center',
    paddingVertical: 11,
    marginTop: 8
  },
  secondaryButtonText: {
    color: '#334155',
    fontWeight: '600'
  },
  logoutButton: {
    backgroundColor: '#ef4444',
    borderRadius: 8,
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 10
  },
  logoutButtonText: {
    color: '#fff',
    fontWeight: '700'
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: 14
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    maxHeight: '92%'
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 10,
    color: '#1f2937'
  },
  fieldLabel: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
    marginTop: 2
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8
  },
  dateInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8
  },
  datePlaceholder: {
    color: '#9ca3af',
    fontSize: 15
  },
  dateValue: {
    color: '#111827',
    fontSize: 15
  },
  webDateInput: {
    width: '100%',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
    fontSize: 15,
    boxSizing: 'border-box'
  }
});

export default ProfileScreen;