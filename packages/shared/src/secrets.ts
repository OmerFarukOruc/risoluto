export interface SecretBackend {
  isInitialized(): boolean;
  list(): string[];
  get(key: string): string | null;
  initializeWithKey(masterKey: string): Promise<void>;
  reset(): void;
  store(key: string, value: string): Promise<void>;
  delete(key: string): Promise<boolean>;
  subscribe(listener: () => void): () => void;
}
