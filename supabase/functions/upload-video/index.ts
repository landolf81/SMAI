// Upload video: shared authentication and provider ownership boundary.
import { createMediaHandler } from '../_shared/media.ts'
Deno.serve(createMediaHandler('video', 'upload'))
