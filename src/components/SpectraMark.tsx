import mark from '../../media/spectra-icon.png?inline'

const maskImage = `url("${mark}")`

export const SpectraMark = ({ size = 24 }: { size?: number }) => (
  <i
    className="spectra-mark"
    aria-hidden="true"
    style={{ width: size, height: size, maskImage, WebkitMaskImage: maskImage }}
  />
)
