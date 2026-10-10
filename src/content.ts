// Everything on the site comes from the /content folder.
// Drop files in, the site picks them up. No code edits needed.
import profile from '../content/profile.json'
import skillsJson from '../content/skills.json'
import experience from '../content/experience.json'
import systems from '../content/systems.json'

// icon and color are optional: known tools get their logo and brand colour from src/brands.tsx
export type Skill = { name: string; note: string; icon?: string; color?: string; ink?: string }
const skills: Skill[] = skillsJson

export { profile, skills, experience, systems }

// names are matched loosely: "Hugging Face", "hugging-face" and "HuggingFace" are all "huggingface"
export const slug = (s: string) => s.normalize('NFD').toLowerCase().replace(/[^a-z0-9]/g, '')

// logo files for keys and contact cards: content/icons/ollama.svg replaces the Ollama logo
const iconGlob = import.meta.glob<string>('../content/icons/*.{svg,png,webp,jpg,jpeg,avif}', {
  eager: true,
  query: '?url',
  import: 'default',
})
export const iconFiles = new Map(Object.entries(iconGlob).map(([path, url]) => [slug(path.split('/').pop()!.replace(/\.[^.]+$/, '')), url]))

export type Project = {
  slug: string
  title: string
  tagline: string
  description: string
  year?: string
  tags?: string[]
  featured?: boolean
  stats?: { value: string; label: string }[]
  links?: { label: string; url: string }[]
  cover?: string
}

const projectFiles = import.meta.glob<Omit<Project, 'slug'>>('../content/projects/*/project.json', {
  eager: true,
  import: 'default',
})
const coverFiles = import.meta.glob<string>('../content/projects/*/cover.{png,jpg,jpeg,webp,gif,avif}', {
  eager: true,
  query: '?url',
  import: 'default',
})
const folderOf = (path: string) => path.split('/').at(-2)!

// folders are sorted by name, so "01-..." comes first
export const projects: Project[] = Object.entries(projectFiles)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([path, data]) => {
    const slug = folderOf(path)
    const cover = Object.entries(coverFiles).find(([p]) => folderOf(p) === slug)?.[1]
    return { ...data, slug, cover }
  })

const avatarFiles = import.meta.glob<string>('../content/avatar.{png,jpg,jpeg,webp,gif,avif}', {
  eager: true,
  query: '?url',
  import: 'default',
})
export const avatar: string | undefined = Object.values(avatarFiles)[0]

// any single PDF dropped into /content is the résumé visitors download
const resumeFiles = import.meta.glob<string>('../content/*.pdf', { eager: true, query: '?url', import: 'default' })
export const resume: string | undefined = Object.values(resumeFiles)[0]
export const resumeName = `${profile.name.replace(/\s+/g, '_')}_Resume.pdf`

const musicFiles = import.meta.glob<string>('../content/music/*.{mp3,ogg,wav,m4a,flac,aac,opus,webm}', {
  eager: true,
  query: '?url',
  import: 'default',
})
// an image with the same name as a song is printed on the disc while it plays: "Night Drive.mp3" + "night-drive.jpg"
const musicArt = import.meta.glob<string>('../content/music/*.{jpg,jpeg,png,webp,avif,gif}', {
  eager: true,
  query: '?url',
  import: 'default',
})
const baseName = (path: string) => decodeURIComponent(path.split('/').pop()!).replace(/\.[^.]+$/, '')
const covers = new Map(Object.entries(musicArt).map(([path, url]) => [slug(baseName(path)), url]))
export const tracks: { url: string; title: string; cover?: string }[] = Object.entries(musicFiles)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([path, url]) => ({
    url,
    title: baseName(path).replace(/[-_]+/g, ' '),
    cover: covers.get(slug(baseName(path))),
  }))

// sound effects: the file name picks the sound it replaces. "key-2.wav" joins the "key" pool,
// so several takes of one sound play at random.
const sfxGlob = import.meta.glob<string>('../content/sfx/*.{mp3,ogg,wav,m4a,flac,aac,opus,webm}', {
  eager: true,
  query: '?url',
  import: 'default',
})
export const sfxFiles: [name: string, url: string][] = Object.entries(sfxGlob).map(([path, url]) => [
  path.split('/').pop()!.replace(/\.[^.]+$/, '').replace(/[-_ ]?\d+$/, '').toLowerCase(),
  url,
])
