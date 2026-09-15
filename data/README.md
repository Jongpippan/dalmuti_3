# Korean word database

이 프로젝트의 초성게임/끝말잇기 판정에는 [`korean-word-game/db`](https://github.com/korean-word-game/db)가 배포하는 남한말 표준국어대사전 표제어 DB `kr_korean.csv`를 사용합니다.

- 원본: `korean-word-game/db`
- 데이터 형식: `word, part` 2열 CSV
- 원본 크기: 약 9.72 MB
- 프로젝트 로컬 경로: `data/kr_korean.csv`
- `data/kr_korean.csv` 자체는 저장소에 커밋하지 않습니다.

`npm install` 시 다운로드를 시도하며, 서버 실행 전 `npm start`의 `prestart` 단계에서도 파일이 없으면 다시 다운로드합니다.
수동으로 받으려면 다음을 실행하세요.

    npm run setup:word-db

게임 판정에서는 한글 2글자 이상 표제어를 사용하고, 동사/형용사는 제외합니다. 초성게임은 2글자 단어 중 같은 초성 조합에 정답 후보가 충분히 존재하는 조합만 출제합니다.
