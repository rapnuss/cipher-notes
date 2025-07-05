import {IconFileBig} from './icons/IconFileBig'

export type FileIconWithExtensionProps = {
  ext: string
  size?: number
}
export const FileIconWithExtension = ({ext, size = 100}: FileIconWithExtensionProps) => (
  <div style={{position: 'relative', display: 'flex'}}>
    <IconFileBig style={{width: size, height: 'auto'}} />
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        fontWeight: 'bold',
      }}
    >
      {ext}
    </div>
  </div>
)
