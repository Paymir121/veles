import { create } from 'zustand';

interface TreeUiState {
  showPhotos: boolean;
  isPeoplePanelOpen: boolean;
  setShowPhotos: (showPhotos: boolean) => void;
  toggleShowPhotos: () => void;
  setPeoplePanelOpen: (open: boolean) => void;
  togglePeoplePanel: () => void;
}

export const useTreeUiStore = create<TreeUiState>((set) => ({
  showPhotos: true,
  isPeoplePanelOpen: false,
  setShowPhotos: (showPhotos) => set({ showPhotos }),
  toggleShowPhotos: () => set((state) => ({ showPhotos: !state.showPhotos })),
  setPeoplePanelOpen: (isPeoplePanelOpen) => set({ isPeoplePanelOpen }),
  togglePeoplePanel: () =>
    set((state) => ({ isPeoplePanelOpen: !state.isPeoplePanelOpen })),
}));
