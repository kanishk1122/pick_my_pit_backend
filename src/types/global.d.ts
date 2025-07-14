// Custom type definitions for modules that might not have complete types

declare module "*.json" {
  const value: any;
  export default value;
}

// If axios types are still missing after installation
declare module "axios" {
  export interface AxiosResponse<T = any> {
    data: T;
    status: number;
    statusText: string;
    headers: any;
    config: any;
  }

  export interface AxiosRequestConfig {
    url?: string;
    method?: string;
    baseURL?: string;
    headers?: any;
    params?: any;
    data?: any;
    timeout?: number;
  }

  export function get<T = any>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>>;
  export function post<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>>;
  export function put<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>>;

  interface AxiosStatic {
    get: typeof get;
    post: typeof post;
    put: typeof put;
    delete<T = any>(
      url: string,
      config?: AxiosRequestConfig
    ): Promise<AxiosResponse<T>>;
  }

  const axios: AxiosStatic;
  export default axios;
}

// Additional type for process.env if needed
declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV?: string;
    PORT?: string;
    DATABASE_URL?: string;
    MONGO_URI?: string;
    REDIS_URL?: string;
    JWT_SECRET?: string;
    SESSION_SECRET?: string;
    CRYPTO_KEY?: string;
    CLOUDINARY_CLOUD_NAME?: string;
    CLOUDINARY_API_KEY?: string;
    CLOUDINARY_API_SECRET?: string;
    EMAIL_HOST?: string;
    EMAIL_PORT?: string;
    EMAIL_USER?: string;
    EMAIL_PASS?: string;
    ADMIN_UI_URL?: string;
    CLIENT_URL?: string;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
  }
}
