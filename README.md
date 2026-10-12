# 환세쾌진극 (幻世快進劇)

Compile의 Windows 게임 「환세쾌진극」(1996/97)을 웹 브라우저에서 돌리는 재구현이다. 원본 실행 파일을 에뮬레이션하지 않고, 원본 로직을 TypeScript와 Canvas로 새로 옮겼다. 한국어판과 일본어판을 모두 지원하고, 모바일 터치 조작이 있다.

비영리 복원·보존 프로젝트이며 Compile과는 관계가 없다. 게임과 그 자료의 권리는 원래 권리자에게 있다.

## 실행

Node.js 24 이상이 필요하다.

```bash
npm install
npm run dev
```

`http://localhost:5179/`를 연다. 주소 옵션은 다음과 같다.

| 옵션 | 뜻 |
|---|---|
| `?v=kr` / `?v=jp` | 시작 언어 |
| `?room=N` | N번 방에서 시작 |
| `?mode=trial` | 타임 트라이얼로 시작 |
| `?scene=ending` 등 | 해당 장면에서 시작 (`epilogue`, `clear`, `gameover`, `tomb`, `status`) |
| `?touch=1` | 데스크톱에서 터치 조작 표시 |

## 조작

| 입력 | 키보드 | 터치 |
|---|---|---|
| 이동 | 방향키 | 화면 왼쪽을 누른 채 끌기 |
| 공격·결정 | X, C, Z, Enter, Space | 화면 오른쪽 누르기 |
| 일시정지 | Esc | 오른쪽 위 ❚❚ 버튼 |
| 타이틀로 | F5 | 오른쪽 위 집 버튼 |

## 빌드와 배포

```bash
npm run build
```

`tsc`로 `dist/`를 만들고 `index.html`, `dist/`, `assets/`를 `site/`로 모은다. 파일 주소가 모두 상대 경로라 하위 경로 호스팅에서도 동작한다. `main`에 푸시하면 `.github/workflows/pages.yml`이 GitHub Pages로 올린다.

## 구성

| 경로 | 내용 |
|---|---|
| `src/` | 게임 엔진 (TypeScript) |
| `assets/` | 웹용으로 변환한 그래픽(인덱스 PNG), 맵·스크립트(JSON), 효과음·BGM, 대사 표 |
| `tools/` | 개발 서버와 배포용 패키징 스크립트 |

`assets/text/texts.tsv`는 대사 표(번호, 용도, 일본어, 한국어)로, 번역을 고칠 때는 한국어 열만 수정한다.
