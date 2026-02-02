import type { AuthProvider } from '@refinedev/core';

export const authProvider: AuthProvider = {
  login: async ({ email, password }) => {
    // Заглушка для аутентификации
    // В будущем здесь будет реальная аутентификация через Firebase Auth
    if (email && password) {
      localStorage.setItem('auth', JSON.stringify({ email }));
      return {
        success: true,
        redirectTo: '/',
      };
    }
    return {
      success: false,
      error: {
        name: 'LoginError',
        message: 'Invalid email or password',
      },
    };
  },

  logout: async () => {
    localStorage.removeItem('auth');
    return {
      success: true,
      redirectTo: '/login',
    };
  },

  check: async () => {
    const auth = localStorage.getItem('auth');
    if (auth) {
      return {
        authenticated: true,
      };
    }
    return {
      authenticated: false,
      redirectTo: '/login',
    };
  },

  getPermissions: async () => {
    return ['admin'];
  },

  getIdentity: async () => {
    const auth = localStorage.getItem('auth');
    if (auth) {
      const { email } = JSON.parse(auth);
      return {
        id: 1,
        name: email,
        email,
      };
    }
    return null;
  },

  onError: async (error) => {
    console.error(error);
    return { error };
  },
};