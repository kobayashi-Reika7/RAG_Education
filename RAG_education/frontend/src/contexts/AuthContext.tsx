import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import '../lib/cognito';
import {
  signIn as amplifySignIn,
  signUp as amplifySignUp,
  signOut as amplifySignOut,
  confirmSignUp as amplifyConfirmSignUp,
  getCurrentUser,
  fetchAuthSession,
  fetchUserAttributes,
} from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';

export interface CognitoUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

interface AuthContextValue {
  user: CognitoUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<'CONFIRM_SIGN_UP' | 'DONE'>;
  confirmSignUp: (email: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

async function loadUser(): Promise<CognitoUser | null> {
  try {
    const { userId } = await getCurrentUser();
    const attrs = await fetchUserAttributes();
    return {
      uid: userId,
      email: attrs.email ?? null,
      displayName: attrs.name ?? attrs.email ?? null,
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CognitoUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser().then((u) => {
      setUser(u);
      setLoading(false);
    });

    const unsub = Hub.listen('auth', async ({ payload }) => {
      switch (payload.event) {
        case 'signedIn':
          setUser(await loadUser());
          break;
        case 'signedOut':
          setUser(null);
          break;
        case 'tokenRefresh':
          setUser(await loadUser());
          break;
      }
    });

    return unsub;
  }, []);

  const signIn = async (email: string, password: string) => {
    await amplifySignIn({ username: email, password });
    setUser(await loadUser());
  };

  const signUp = async (
    email: string,
    password: string,
    displayName: string,
  ): Promise<'CONFIRM_SIGN_UP' | 'DONE'> => {
    const { nextStep } = await amplifySignUp({
      username: email,
      password,
      options: {
        userAttributes: {
          email,
          name: displayName,
        },
      },
    });
    if (nextStep.signUpStep === 'CONFIRM_SIGN_UP') {
      return 'CONFIRM_SIGN_UP';
    }
    return 'DONE';
  };

  const confirmSignUp = async (email: string, code: string) => {
    await amplifyConfirmSignUp({ username: email, confirmationCode: code });
  };

  const signOut = async () => {
    await amplifySignOut();
    setUser(null);
  };

  const getIdToken = async (): Promise<string> => {
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();
    if (!token) throw new Error('Not authenticated');
    return token;
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, signIn, signUp, confirmSignUp, signOut, getIdToken }}
    >
      {children}
    </AuthContext.Provider>
  );
}
