export const previewWidths = ['fit', 375, 768, 1280] as const
export const previewHeights = [240, 560, 720] as const
export const previewSurfaces = ['light', 'dark', 'checkerboard'] as const

export type PreviewSettings = {
  width: (typeof previewWidths)[number]
  height: (typeof previewHeights)[number]
  surface: (typeof previewSurfaces)[number]
}

export const defaultPreviewSettings: PreviewSettings = {
  width: 'fit',
  height: 560,
  surface: 'checkerboard',
}
