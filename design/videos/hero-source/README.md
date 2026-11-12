# 메인 히어로 배경 영상 원본

`public/videos/hero-bg.mp4`를 만든 자막·로고 없는 원본 클립입니다. (Higgsfield seedance 2.5, 2026-11-01 생성, 무음)

| 파일 | 내용 |
| --- | --- |
| `01_물붓기_15s_1280x720.mp4` | 모서리를 접어 올리고 물을 붓는 장면 (15초) |
| `02_김오르며_줌아웃_6s_1280x720.mp4` | 김이 오르며 카메라가 뒤로 빠지는 장면 (6초) |

## hero-bg.mp4 만드는 법

01의 앞 9.375초 + 02 전체를 0.4초 겹침 전환으로 이어 15초로 만듭니다.

```bash
ffmpeg -i 01_물붓기_15s_1280x720.mp4 -i 02_김오르며_줌아웃_6s_1280x720.mp4 \
  -filter_complex "[0:v]trim=0:9.375,setpts=PTS-STARTPTS,fps=24,format=yuv420p[a];[1:v]setpts=PTS-STARTPTS,fps=24,format=yuv420p[b];[a][b]xfade=transition=fade:duration=0.4:offset=8.975[v]" \
  -map "[v]" -c:v libx264 -preset slow -crf 23 -pix_fmt yuv420p -movflags +faststart -an hero-bg.mp4
```
