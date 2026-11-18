import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // 이 규칙은 "화면을 열 때 데이터를 불러오는" 표준 방식(useEffect 안에서 fetchData() 호출)과,
      // 브라우저에서만 알 수 있는 값(주소의 ?error=, 저장된 로그인 정보 등)을 화면에 반영하는 코드까지
      // 모두 오류로 잡는다. 현재 31곳이 해당하며 전부 정상 동작하는 코드다.
      // 화면 25개의 데이터 로딩을 한꺼번에 다시 짜는 것은 얻는 것에 비해 위험이 커서, 오류가 아닌 경고로 낮춘다.
      // (경고로는 계속 보이므로, 새 화면을 만들 때는 참고할 수 있다)
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
