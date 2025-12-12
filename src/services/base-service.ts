import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
} from 'axios';
import MockAdapter from 'axios-mock-adapter';

export type HttpMethod = 'get' | 'post' | 'put' | 'delete';

export interface BaseServiceConfig {
  baseURL: string;
  timeout?: number;
  headers?: Record<string, string>;
  useMock?: boolean;
  mockDelay?: number;
  transformError?: (error: AxiosError<any>) => any;
}

export interface RequestConfig<T = any> {
  endpoint: string;
  params?: Record<string, any>;
  data?: any;
  isMock?: boolean;
  mockData?: T;
  mockStatus?: number;
  config?: AxiosRequestConfig;
}

export class BaseService {
  protected api: AxiosInstance;
  private mock?: MockAdapter;
  protected config: BaseServiceConfig;

  constructor(config: BaseServiceConfig) {
    this.config = {
      timeout: 10000,
      useMock: false,
      mockDelay: 1000,
      transformError: (err) => err.response?.data ?? { message: err.message || 'Network error' },
      ...config,
    };

    this.api = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: this.config.headers,
    });

    if (this.config.useMock) this.enableMocking();
  }

  protected enableMocking() {
    this.mock = new MockAdapter(this.api, {
      delayResponse: this.config.mockDelay,
      onNoMatch: 'passthrough',
    });
  }

  protected registerMock<T>(method: HttpMethod, url: string, data: T, status = 200) {
    if (!this.mock) this.enableMocking();
    const methodName = `on${method.charAt(0).toUpperCase() + method.slice(1)}` as
      | 'onGet'
      | 'onPost'
      | 'onPut'
      | 'onDelete';
    (this.mock![methodName] as any)(url).replyOnce(status, data);
  }

  protected handleError(error: unknown): Error {
    if (error instanceof AxiosError) {
      return this.config.transformError?.(error) ?? error;
    }
    return new Error('An unexpected error occurred');
  }

  protected async request<T>(
    method: HttpMethod,
    config: RequestConfig<T>,
  ): Promise<T> {
    const {
      endpoint,
      params,
      data,
      isMock = false,
      mockData,
      mockStatus = 200,
      config: axiosConfig = {},
    } = config;

    if ((isMock || this.config.useMock) && mockData !== undefined) {
      this.registerMock(method, endpoint, mockData, mockStatus);
    }

    try {
      const response: AxiosResponse<T> =
        method === 'get' || method === 'delete'
          ? await this.api[method](endpoint, { params, ...axiosConfig })
          : await this.api[method](endpoint, data ?? {}, { params, ...axiosConfig });

      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  public get<T>(config: RequestConfig<T>): Promise<T> {
    return this.request<T>('get', config);
  }

  public post<T>(config: RequestConfig<T>): Promise<T> {
    return this.request<T>('post', config);
  }

  public put<T>(config: RequestConfig<T>): Promise<T> {
    return this.request<T>('put', config);
  }

  public delete<T>(config: RequestConfig<T>): Promise<T> {
    return this.request<T>('delete', config);
  }

  public getAxiosInstance(): AxiosInstance {
    return this.api;
  }
}