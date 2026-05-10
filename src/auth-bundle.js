import {
  login,
  signup,
  logout,
  getUser,
  handleAuthCallback,
  onAuthChange,
  requestPasswordRecovery,
  updateUser,
  AUTH_EVENTS,
  AuthError,
  MissingIdentityError,
} from '@netlify/identity';

window.NetlifyAuth = {
  login,
  signup,
  logout,
  getUser,
  handleAuthCallback,
  onAuthChange,
  requestPasswordRecovery,
  updateUser,
  AUTH_EVENTS,
  AuthError,
  MissingIdentityError,
};
