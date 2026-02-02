export interface Canvas {
  id: string;
  name: string;
  color: string;
  order: number;
  createdAt: string;
  isDefault?: boolean;
}

export interface PersistedCanvas extends Canvas {
  // Additional persistence fields if needed in the future
}
