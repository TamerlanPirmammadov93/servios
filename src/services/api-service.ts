import { BaseService, type BaseServiceConfig } from './base-service';

export interface CrudResource {
  id: string | number;
}

export interface ApiServiceConfig extends BaseServiceConfig {
  resourcePath?: string;
  getAccessToken?: () => string | null;
}

export class ApiService<T extends CrudResource = CrudResource> extends BaseService {
  protected resourcePath: string;
  private static globalAccessTokenGetter: (() => string | null) | null = null;

  // Set token getter once globally
  static setAccessTokenGetter(getter: () => string | null) {
    ApiService.globalAccessTokenGetter = getter;
  }

  constructor(config: ApiServiceConfig & { resourcePath: string }) {
    super(config);
    this.resourcePath = config.resourcePath;

    // Use global token getter
    this.setupTokenHeader({
      ...config,
      getAccessToken: ApiService.globalAccessTokenGetter || config.getAccessToken,
    });
  }

  private setupTokenHeader(config: ApiServiceConfig) {
    const token = config.getAccessToken?.();
    if (token) {
      this.api.defaults.headers.common.Authorization = `Bearer ${token}`;
    }
  }

  async list(params?: Record<string, any>): Promise<T[]> {
    return this.get<T[]>({
      endpoint: this.resourcePath,
      params,
    });
  }

  async getById(id: string | number): Promise<T> {
    return this.get<T>({
      endpoint: `${this.resourcePath}/${id}`,
    });
  }

  async create(data: Partial<T>): Promise<T> {
    return this.post<T>({
      endpoint: this.resourcePath,
      data,
    });
  }

  async update(id: string | number, data: Partial<T>): Promise<T> {
    return this.put<T>({
      endpoint: `${this.resourcePath}/${id}`,
      data,
    });
  }

  async remove(id: string | number): Promise<void> {
    return this.delete<void>({
      endpoint: `${this.resourcePath}/${id}`,
    });
  }
}