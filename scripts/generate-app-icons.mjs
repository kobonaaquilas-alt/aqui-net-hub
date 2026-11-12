import { mkdir, readFile, rm } from 'node:fs/promises'
import sharp from 'sharp'

const svg = await readFile('public/favicon.svg')
const output = async (path, size) => {
  await mkdir(path.substring(0, path.lastIndexOf('/')), { recursive: true })
  await sharp(svg).resize(size, size, { fit: 'contain' }).png().toFile(path)
}

await output('public/icons/icon-192.png', 192)
await output('public/icons/icon-512.png', 512)

const nativeRoot = 'android/app/src/main/res'
const densities = [
  ['mdpi', 48],
  ['hdpi', 72],
  ['xhdpi', 96],
  ['xxhdpi', 144],
  ['xxxhdpi', 192],
]

for (const [density, size] of densities) {
  const folder = `${nativeRoot}/mipmap-${density}`
  await output(`${folder}/ic_launcher.png`, size)
  await output(`${folder}/ic_launcher_round.png`, size)
}

// Use the same branded density icons on modern launchers rather than the
// default Capacitor template adaptive icon.
for (const name of ['ic_launcher.xml', 'ic_launcher_round.xml']) {
  await rm(`${nativeRoot}/mipmap-anydpi-v26/${name}`, { force: true })
}
