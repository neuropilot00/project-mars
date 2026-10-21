# v7.492 모바일 플레이 검수 릴리스

버전 `v7.492-mobile-play-2026-10-21`, 서비스워커 `mars-v177-mobile-play-20261021`.

검증·수정 범위는 MOBILE_PLAY_QA_2026-10-21.md와 CHANGELOG.md v7.492를 따른다. 현재 브랜치에서 GitHub main으로 일반 push하여 기존 Railway 자동 배포를1회 실행한다. 별도의 railway up/운영 키·환경변수 변경은 없다. Google Authenticator 비활성 유지 결정은 RELEASE_TOTP_CONFIGURATION_2026-10-21.md와 같다.

새 운영 마이그레이션은360~362의ADD ONLY 컬럼 복구3개이며 기존 파일은 수정하지 않았다. 보상·잔액·추천 수익·과거 무료 점령 회계를 추정해 UPDATE하거나 회수하지 않는다. 시작 명령은 기존 `cd server && node migrate.js && node index.js`를 유지한다.

직전 정상 코드 `f952af3ef037ed89f55bcca24f3c0fa62835502d`, Railway `b6784188-bf1a-4b37-8452-f79ea3117eee`를 롤백 기준으로 보관한다. 기존 스키마·자산을 삭제하지 않고 코드 롤백 시에도 새 컬럼은 유지한다. 직전 코드로 돌아가면 이번에 수정한 무료 점령·수확·UI 결함이 되돌아갈 수 있다.

배포 수락 기준: 현재 SHA의 Railway SUCCESS, 새migration3개 완료 및 서버 기동, 공개 /health와 /ready200 및 DB 정상, 변경된15개 공개 파일의SHA256 일치, 미니게임3개200, TOTP config.enabled=false. 이 공개 검사만으로 운영 계정을 이용한 실제 게임플레이·실결제·실폰 검수 완료를 뜻하지 않는다. 실제 변이 플레이는 격리 서버에서 검증했다.

Git에 포함하지 않은 원본 증거는 상위 작업공간 outputs/mobile-play-qa-20261021/에 보존한다. 보존 DBdump·세션/전체로그는 공개 패키지에 넣지 않는다. 배포 후 실제 commit/deployment/status와 공개 해시 비교 결과를 해당 작업 산출물에 저장한다.
