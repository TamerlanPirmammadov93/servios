import { type AxiosError, type AxiosRequestConfig } from 'axios';
import { BaseService, type BaseServiceConfig } from './base-service';

interface CustomAxiosRequestConfig extends AxiosRequestConfig {
  _retry?: boolean;
}

export interface AuthServiceConfig extends BaseServiceConfig {
  getAccessToken?: () => string | null;
  setAccessToken?: (token: string) => void;
  getRefreshToken?: () => string | null;
  setRefreshToken?: (token: string) => void;
  refreshToken?: () => Promise<{ accessToken: string; refreshToken?: string }>;
  onLogout?: () => void;
  retryOnStatusCodes?: number[];
}

export class AuthService extends BaseService {
  protected authConfig: AuthServiceConfig;
  private isRefreshing = false;
  private failedQueue: Array<{
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
    config: CustomAxiosRequestConfig;
  }> = [];

  constructor(config: AuthServiceConfig) {
    super(config);
    this.authConfig = {
      retryOnStatusCodes: [401],
      ...config,
    };
    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor: add token
    this.api.interceptors.request.use((config) => {
      const token = this.authConfig.getAccessToken?.();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Response interceptor: handle token refresh
    this.api.interceptors.response.use(
      (res) => res,
      async (error: AxiosError) => {
        const config = error.config as CustomAxiosRequestConfig;
        if (!config) return Promise.reject(error);

        const shouldRetry =
          error.response?.status &&
          this.authConfig.retryOnStatusCodes!.includes(error.response.status) &&
          !config._retry;

        if (shouldRetry && this.authConfig.refreshToken) {
          config._retry = true;

          return new Promise((resolve, reject) => {
            this.failedQueue.push({ resolve, reject, config });

            if (!this.isRefreshing) {
              this.isRefreshing = true;
              this.authConfig.refreshToken!()
                .then(({ accessToken, refreshToken }) => {
                  this.authConfig.setAccessToken?.(accessToken);
                  if (refreshToken) {
                    this.authConfig.setRefreshToken?.(refreshToken);
                  }
                  this.processQueue(null, accessToken);
                })
                .catch((err) => {
                  this.processQueue(err);
                  this.authConfig.onLogout?.();
                })
                .finally(() => (this.isRefreshing = false));
            }
          });
        }
        return Promise.reject(error);
      },
    );
  }

  private processQueue(error: any, token?: string) {
    this.failedQueue.forEach(({ resolve, reject, config }) => {
      if (error) reject(error);
      else {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
        resolve(this.api(config));
      }
    });
    this.failedQueue = [];
  }
}