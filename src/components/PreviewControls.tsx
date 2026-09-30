import { useId } from 'react'
import { previewHeights, previewSurfaces, previewWidths } from '../domain/preview'
import { useWorkspace } from '../state/WorkspaceProvider'

export const PreviewControls = () => {
  const { previewSettings, setPreviewSettings } = useWorkspace()
  const id = useId()
  return (
    <fieldset className="preview-controls" aria-label="Shared preview settings">
      <div className="preview-option">
        <label htmlFor={`${id}-width`}>Width</label>
        <select
          id={`${id}-width`}
          value={previewSettings.width}
          onChange={(event) => {
            const width = previewWidths.find((value) => String(value) === event.currentTarget.value)
            if (width !== undefined) setPreviewSettings((current) => ({ ...current, width }))
          }}
        >
          <option value="fit">Fit column</option>
          <option value="375">375 px</option>
          <option value="768">768 px</option>
          <option value="1280">1280 px</option>
        </select>
      </div>
      <div className="preview-option">
        <label htmlFor={`${id}-height`}>Height</label>
        <select
          id={`${id}-height`}
          value={previewSettings.height}
          onChange={(event) => {
            const height = previewHeights.find(
              (value) => String(value) === event.currentTarget.value,
            )
            if (height !== undefined) setPreviewSettings((current) => ({ ...current, height }))
          }}
        >
          <option value="240">Compact · 240 px</option>
          <option value="560">Standard · 560 px</option>
          <option value="720">Tall · 720 px</option>
        </select>
      </div>
      <div className="preview-option">
        <label htmlFor={`${id}-surface`}>Canvas</label>
        <select
          id={`${id}-surface`}
          value={previewSettings.surface}
          onChange={(event) => {
            const surface = previewSurfaces.find((value) => value === event.currentTarget.value)
            if (surface !== undefined) setPreviewSettings((current) => ({ ...current, surface }))
          }}
        >
          <option value="checkerboard">Transparency grid</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </div>
      <span className="preview-settings-note">All previews · Canvas is not exported</span>
    </fieldset>
  )
}
