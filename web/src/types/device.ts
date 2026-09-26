export interface BrowserDevice {
  id: string;
  name: string;
  lastSeen: number; // Unix ms
}

export interface DeviceGuiState {
  devices?: BrowserDevice[];
  activeLocationDevice?: string;
  /** Device whose browser runs all browser work; unset means whoever polls first. */
  homeBrowserDevice?: string;
  locationWantId?: string;
}
