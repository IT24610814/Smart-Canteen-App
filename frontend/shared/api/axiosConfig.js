import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const isWeb = typeof window !== 'undefined' && typeof document !== 'undefined';
const DEFAULT_WEB_API_URL = 'http://localhost:5000/api';
const DEFAULT_NATIVE_API_URL = 'http://10.18.130.68:5000/api';

const getExpoHostIp = () => {
  const hostString =
    Constants.manifest?.debuggerHost ||
    Constants.expoConfig?.hostUri ||
    Constants.manifest?.hostUri;

  if (!hostString) return null;
  const host = hostString.split(':')[0];
  return host;
};

const resolveNativeApiUrl = () => {
  const host = getExpoHostIp();
  return host ? `http://${host}:5000/api` : DEFAULT_NATIVE_API_URL;
};

const RESOLVED_API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  process.env.REACT_APP_API_URL ||
  (isWeb ? DEFAULT_WEB_API_URL : resolveNativeApiUrl());

const api = axios.create({
  baseURL: RESOLVED_API_URL,
  timeout: 10000,
});

// Add token to every request
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('userRole');
      // Redirect to login will happen automatically
    }
    return Promise.reject(error);
  }
);

export default api;
