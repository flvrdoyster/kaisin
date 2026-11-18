# 환세쾌진극 웹 포팅 (kaisin)

**▶ 웹에서 바로 플레이: https://kaisin.atah.io/**

## 개요

환세쾌진극(幻世快進劇, Compile, 1996/97)을 웹 브라우저에서 즐길 수 있게 옮긴 **비영리 복원·보존 프로젝트**.
원본 실행 파일을 에뮬레이션하지 않고, 게임 엔진을 TypeScript와 Canvas로 새로 구현했다.
한국어판과 일본어판을 모두 담았으며, 키보드와 모바일 터치로 플레이할 수 있다.

---

## 소프트웨어 고지 / Software Notice

본 저장소는 환세쾌진극의 한국어판과 일본어판을 브라우저 환경에서 실행하기 위한 재구현 엔진과,
원본 파일에서 변환한 게임 데이터(그래픽, 맵, 음향, 대사 등)를 포함합니다.

원본 게임은 Compile이 개발하였으며, 게임 자산(그래픽, 음악 등)의 모든 권리는 원저작권자에게 있습니다.

본 프로젝트는 비상업적 보존 목적으로만 운영됩니다. 저작권자로서 자료 삭제를 원하실 경우 Issue를 열어주시면 즉시 대응하겠습니다.

This repository contains a re-implemented engine for running the Korean and Japanese releases of
Gensei Kaishingeki (幻世快進劇) in a browser, along with game data (graphics, maps, sound, text, etc.)
converted from the original game files.

The game was originally developed by Compile. All rights to the game and its assets (graphics, music, etc.) belong to their respective copyright holders.

This project exists solely for non-commercial preservation. If you are a rights holder and would like this material removed, please open an issue and it will be promptly addressed.

---

## 웹 앱(홈 화면 추가)

- `manifest.webmanifest`와 `icons/`로 설치할 수 있는 웹 앱이며 `display`는 `standalone`이다. `name`은 페이지 제목에서 " : atah.io"를 뗀 것, 색은 페이지 바탕색(`#000000`)과 같다.
- 아이콘은 32px 도트 원본을 정수 배율 최근접 확대로 만들었다. `icon-192`는 6배, `icon-512`는 16배이고 투명 배경이다. `icon-maskable-192`는 3배(96px), `icon-maskable-512`는 9배(288px)를 가운데 두고 둘레를 `#000000`으로 채웠다. `apple-touch-icon`은 180px 불투명 이미지에 5배(160px)를 가운데 둔 것이다.
- `install.js`가 푸터(`atah.io/footer.js`가 그린다)에 "홈 화면에 추가" 링크를 붙인다. 푸터가 다시 그려지면 `MutationObserver`가 다시 붙인다. 홈 화면 앱으로 실행 중이거나 알려진 iOS 앱 내 브라우저에서는 보이지 않는다.
- Android는 `beforeinstallprompt`가 왔을 때만 링크를 보이고 누르면 설치 창을 띄운다. iOS는 설치 API가 없어 누르면 안내 문구를 펼친다.
- 서비스 워커는 없다. 오프라인 실행은 지원하지 않는다.
