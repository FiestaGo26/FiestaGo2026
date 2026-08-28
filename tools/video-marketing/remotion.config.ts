import { Config } from '@remotion/cli/config'

// Reels/TikTok/Shorts: 1080×1920 @ 30fps es el estándar universal.
Config.setVideoImageFormat('jpeg')
Config.setPixelFormat('yuv420p')     // compatible con IG/TikTok
Config.setCodec('h264')
Config.setCrf(20)                     // calidad alta pero peso razonable (< 15 MB por vídeo)
Config.setChromiumOpenGlRenderer('angle')
Config.setConcurrency(1)              // 1 vídeo a la vez, evita OOM en GitHub Actions
