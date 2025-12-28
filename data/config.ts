
import { MusicTrack } from '../types';

export const APP_CONFIG = {
  // 播放列表配置
  // 部署说明：
  // 1. 在项目根目录创建 public/music 文件夹
  // 2. 将 MP3 文件放入该文件夹
  // 3. url 填写格式为 "./music/你的文件名.mp3"
  
  PLAYLIST: [
    {
       name: "christmas-piano-have-yourself",
       url: "./music/bgm1.mp3"
      
    },
    {
      name: "o-holy-night-gentle-christmas",  
      url: "./music/bgm2.mp3"
    },
    {
      name: "Mthe-first-noel",  
      url: "./music/bgm3.mp3"
    },
    {
      name: "the-quarrel",  
      url: "./music/bgm4.mp3"
    },
    {
      name: "we-wish-you",  
      url: "./music/bgm5.mp3"
    }
  ] as MusicTrack[],
  
  // 音乐音量 (0.0 - 1.0)
  MUSIC_VOLUME: 0.3,

  // Romantic 模式专属音乐
  // 当进入 Romantic 模式时，会自动切换到这首音乐并循环播放
  // 部署说明：上传文件到 public/music/romantic.mp3 或替换为网络链接
  ROMANTIC_MUSIC_URL: "./music/romantic.mp3"
};
