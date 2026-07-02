# 캠페인 라인별 음성 (assets/audio/voice/)

캠페인 대사/내레이션의 영어 음성(voice-over). 정책: **영어 전용**(GAME_VOICE_LANG='en').

## 재생 규칙 (자동)
캠페인 씬 렌더 시 엔진이 아래 파일명을 찾아 재생한다(assets/campaign-system.js #_campaignVoiceFile):

    <questId>_<sceneId>_l<lineIdx>.mp3

이 파일명으로 mp3 를 이 폴더에 넣으면 자동 재생된다(BGM 위에 얹힘). 파일 없으면 무음(진행 영향 0).

## 제작 워크플로
1. `node tools/voice-manifest.js` 실행 → 이 폴더에 `voice-manifest.csv` / `voice-manifest.json` 생성.
   - 컬럼: file, speaker, type, chars, text. **화자별로 정렬**돼 있어 같은 보이스로 배치 생성하기 좋다.
2. 화자별로 TTS 보이스 배정(42 화자, narrator 가 라인의 절반·글자의 74%). PC 의 TTS 프로그램으로 각 행의 `text` 를 생성.
3. 생성한 오디오를 각 행의 `file` 이름 그대로 이 폴더에 저장 → 끝. (엔진이 자동으로 찾음)
4. 대본(text) 이 바뀌면 `node tools/voice-manifest.js` 재실행해 목록 갱신.

규모: 약 2,877 라인 / 42 화자 / ~304K 자. 대용량 mp3 는 git 대신 CDN/릴리스로 관리해도 된다(파일명만 맞으면 됨).
