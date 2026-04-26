import React, { createContext, useContext } from 'react';

export const AuthContext = createContext({
  signIn: async () => {},
  signOut: async () => {},
  userRole: null
});

export const useAuth = () => useContext(AuthContext);
