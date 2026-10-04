# 상세페이지 카드 생성기

홈페이지 상품 상세페이지의 **특징 이미지(feature_images)** 로 올릴 카드 이미지를 브랜드 스타일(짙은 녹색 바탕, 흰/노랑 글자, 세로 카드)로 만든다.
관리자 > 상세페이지 편집기가 쓰는 것과 같은 테이블·스토리지 경로에 올리므로, 생성 후에는 편집기에서 순서 변경·삭제·추가가 그대로 된다.

## 사용법

```bash
# 1) 이미지만 생성해서 확인 (scripts/detail-cards/out/<설정이름>/001.jpg …)
node scripts/detail-cards/render.mjs scripts/detail-cards/configs/heater-30g.json

# 2) 확인 후 업로드 + feature_images 교체 (config 에 specs 가 있으면 사양표도 갱신)
node scripts/detail-cards/render.mjs scripts/detail-cards/configs/heater-30g.json --upload
```

- 렌더링은 로컬 Chrome(headless)을 사용한다. 추가 패키지 설치 없음.
- 출력 크기는 2688×3438 (기존 상세 이미지 2687×3437과 같은 비율).
- 히어로 이미지·게시 여부는 건드리지 않는다. 상세페이지 행이 없으면 **미게시** 상태로 새로 만들어 두니 관리자에서 히어로를 넣고 게시한다.

## 새 상품에 적용하기

1. `configs/` 에 JSON 을 복사해 `productId`(products.id), 문구, 수량을 바꾼다.
2. 사진은 `assets/<카테고리>/` 에 넣고 config 의 `assets` 경로를 맞춘다. (jpg 100~400KB 권장)
3. 카드 구성 자체(장수·레이아웃)를 바꾸려면 `template.html` 의 `cards` 배열을 수정하고 `render.mjs` 의 `CARD_COUNT` 를 맞춘다.

## 현재 카드 구성 (발열제)

1. 커버: 문제 제기 + 25% 절감 배지 + 포장 사진
2. 소량 테스트 안내 (1팩 먼저)
3. 개별 포장의 불편 3가지
4. 성능 3가지 (온도·지속·발열 속도)
5. 사용법 3단계
6. 추천 대상 4곳
7. 구성 옵션 (1팩 / 1박스)
8. 안전 주의사항 (포장 아이콘 + 5항목)

사양표(specs)는 이미지가 아니라 관리자 사양 항목으로 들어가므로 편집기에서 바로 고칠 수 있다.
