import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserPool,
  type CognitoUserSession,
} from 'amazon-cognito-identity-js';
import {
  CognitoIdentityClient,
  GetCredentialsForIdentityCommand,
  GetIdCommand,
} from '@aws-sdk/client-cognito-identity';
import { config, isAwsConfigured } from '../config';
import type { AuthSession, AwsTempCredentials } from '../types';

export interface SignInResult {
  status: 'authenticated' | 'new_password_required';
  session?: AuthSession;
  completeNewPassword?: (newPassword: string) => Promise<AuthSession>;
}

let cachedPool: CognitoUserPool | null = null;
let cachedCredentials: AwsTempCredentials | null = null;

function getUserPool(): CognitoUserPool {
  if (!isAwsConfigured()) {
    throw new Error('Configuración de Cognito incompleta en variables de entorno.');
  }
  if (!cachedPool) {
    cachedPool = new CognitoUserPool({
      UserPoolId: config.userPoolId,
      ClientId: config.userPoolClientId,
    });
  }
  return cachedPool;
}

export function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return {};
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json = atob(padded);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function toAuthSession(cognitoSession: CognitoUserSession): AuthSession {
  const idToken = cognitoSession.getIdToken().getJwtToken();
  const accessToken = cognitoSession.getAccessToken().getJwtToken();
  const refreshToken = cognitoSession.getRefreshToken()?.getToken();
  const payload = decodeJwtPayload(idToken);

  const department = String(
    payload['department'] ??
      payload['custom:department'] ??
      payload['departmentId'] ??
      '201'
  );

  return {
    idToken,
    accessToken,
    refreshToken,
    email: String(payload['email'] ?? payload['cognito:username'] ?? ''),
    name: typeof payload['name'] === 'string' ? payload['name'] : undefined,
    department,
    sub: String(payload['sub'] ?? ''),
    exp: Number(payload['exp'] ?? Math.floor(Date.now() / 1000) + 3600),
    isDemo: false,
  };
}

export function signInWithCognito(
  username: string,
  password: string
): Promise<SignInResult> {
  const pool = getUserPool();
  const user = new CognitoUser({
    Username: username.trim(),
    Pool: pool,
  });

  const authDetails = new AuthenticationDetails({
    Username: username.trim(),
    Password: password,
  });

  return new Promise((resolve, reject) => {
    user.authenticateUser(authDetails, {
      onSuccess: (session) => {
        cachedCredentials = null;
        resolve({
          status: 'authenticated',
          session: toAuthSession(session),
        });
      },
      onFailure: (err: Error) => {
        reject(new Error(err.message || 'No se pudo iniciar sesión en Cognito.'));
      },
      newPasswordRequired: () => {
        resolve({
          status: 'new_password_required',
          completeNewPassword: (newPassword: string) =>
            new Promise<AuthSession>((res, rej) => {
              user.completeNewPasswordChallenge(
                newPassword,
                {},
                {
                  onSuccess: (session) => {
                    cachedCredentials = null;
                    res(toAuthSession(session));
                  },
                  onFailure: (err: Error) => {
                    rej(new Error(err.message || 'No se pudo actualizar la contraseña.'));
                  },
                }
              );
            }),
        });
      },
    });
  });
}

export function getExistingCognitoSession(): Promise<AuthSession | null> {
  if (!isAwsConfigured()) return Promise.resolve(null);
  const pool = getUserPool();
  const currentUser = pool.getCurrentUser();
  if (!currentUser) return Promise.resolve(null);

  return new Promise((resolve) => {
    currentUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session || !session.isValid()) {
        resolve(null);
        return;
      }
      resolve(toAuthSession(session));
    });
  });
}

export async function getFreshIdToken(): Promise<string> {
  const session = await getExistingCognitoSession();
  if (!session) {
    throw new Error('Sesión expirada. Inicia sesión nuevamente.');
  }
  return session.idToken;
}

export async function getTemporaryAwsCredentials(
  idToken: string
): Promise<AwsTempCredentials> {
  if (
    cachedCredentials &&
    cachedCredentials.expiration &&
    cachedCredentials.expiration.getTime() - Date.now() > 5 * 60 * 1000
  ) {
    return cachedCredentials;
  }

  if (!config.identityPoolId || !config.userPoolId) {
    throw new Error('Falta IdentityPoolId o UserPoolId para obtener credenciales MQTT.');
  }

  const providerKey = `cognito-idp.${config.region}.amazonaws.com/${config.userPoolId}`;
  const client = new CognitoIdentityClient({ region: config.region });

  const idResponse = await client.send(
    new GetIdCommand({
      IdentityPoolId: config.identityPoolId,
      Logins: { [providerKey]: idToken },
    })
  );

  if (!idResponse.IdentityId) {
    throw new Error('Cognito Identity Pool no devolvió IdentityId.');
  }

  const credsResponse = await client.send(
    new GetCredentialsForIdentityCommand({
      IdentityId: idResponse.IdentityId,
      Logins: { [providerKey]: idToken },
    })
  );

  const creds = credsResponse.Credentials;
  if (!creds?.AccessKeyId || !creds.SecretKey || !creds.SessionToken) {
    throw new Error('Cognito Identity Pool no devolvió credenciales temporales válidas.');
  }

  cachedCredentials = {
    accessKeyId: creds.AccessKeyId,
    secretAccessKey: creds.SecretKey,
    sessionToken: creds.SessionToken,
    expiration: creds.Expiration,
  };

  return cachedCredentials;
}

export function signOutCognito(): void {
  cachedCredentials = null;
  if (!isAwsConfigured()) return;
  try {
    const pool = getUserPool();
    const user = pool.getCurrentUser();
    user?.signOut();
  } catch {
    // Ignore errors during cleanup
  }
}

export function createDemoSession(department = '201', email = 'huesped@smarthotel.local'): AuthSession {
  const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const payload = btoa(
    JSON.stringify({
      sub: 'demo-user-001',
      email,
      department,
      exp: Math.floor(Date.now() / 1000) + 86400,
    })
  );
  return {
    idToken: `${header}.${payload}.demo`,
    accessToken: 'demo-access-token',
    email,
    name: 'Residente Demo',
    department,
    sub: 'demo-user-001',
    exp: Math.floor(Date.now() / 1000) + 86400,
    isDemo: true,
  };
}
