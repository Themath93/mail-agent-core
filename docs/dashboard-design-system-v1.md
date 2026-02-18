# Dashboard Design System v1 (Calm Ops)

- 작성일: 2026-02-18
- 범위: Dashboard/Search/Timeline 구현을 위한 설계 기준 문서(문서 정의만, UI 구현 제외)
- 기준 입력: `src/domain/dashboard-contract.ts`, `pm_notes/outlook_mail_agent_prd_v0_2.md`, `pm_notes/outlook_mail_agent_detailed_plan_v0_2.md`, `extension/sidepanel.html`
- 디자인 방향: Calm Ops (저자극 뉴트럴 기반 + 제한된 상태 액센트 + 고밀도 운영 가독성)

## 1) 목적과 설계 원칙

1. 정보 우선: 장식보다 KPI 스캔 속도, 드릴다운 맥락, 근거 점프 신뢰성을 우선한다.
2. 계약 정렬: KPI/드릴다운/타임라인 이벤트 시각화는 `dashboard-contract` 고정 키를 그대로 사용한다.
3. 저자극 시각: 과한 채도, 과도한 그림자, 과모션을 금지한다.
4. 접근성 기본값: WCAG AA 기준을 기본값으로 채택하고 예외 없이 적용한다.

## 2) Color Tokens

`Calm Ops`는 sidepanel의 뉴트럴 톤(`--nm-*`)을 확장한 semantic token 체계로 정의한다.

### 2.1 Surface

```css
:root {
  --co-surface-canvas: #eef2f5;
  --co-surface-app: #f7f9fb;
  --co-surface-panel: #ffffff;
  --co-surface-card: #f8fafc;
  --co-surface-card-hover: #f1f5f9;
  --co-surface-elevated: #ffffff;
}
```

### 2.2 Text

```css
:root {
  --co-text-primary: #0f172a;
  --co-text-secondary: #334155;
  --co-text-muted: #64748b;
  --co-text-disabled: #94a3b8;
  --co-text-on-accent: #ffffff;
}
```

### 2.3 Border

```css
:root {
  --co-border-subtle: #dbe2ea;
  --co-border-default: #cbd5e1;
  --co-border-strong: #94a3b8;
  --co-border-focus: #1d4ed8;
}
```

### 2.4 State

```css
:root {
  --co-state-info: #1d4ed8;
  --co-state-success: #166534;
  --co-state-warning: #b45309;
  --co-state-danger: #b91c1c;
  --co-state-accent: #0f766e;
}
```

### 2.5 Chart Semantic Palette

```css
:root {
  --co-chart-series-1: #1d4ed8;
  --co-chart-series-2: #0f766e;
  --co-chart-series-3: #b45309;
  --co-chart-series-4: #6d28d9;
  --co-chart-neutral-grid: #d9e1ea;
  --co-chart-neutral-axis: #64748b;
}
```

토큰 적용 규칙:
- 배경은 `surface`, 의미는 `state`, 데이터 시리즈는 `chart-series-*`로 분리한다.
- 경고/오류 표현은 색상 + 아이콘 + 텍스트 라벨을 함께 사용한다(색상 단독 금지).

## 3) Typography

가독성과 정보 밀도를 동시에 확보하기 위해 한글 친화 조합을 고정한다.

```css
:root {
  --co-font-heading: "SUIT", "Pretendard", "Noto Sans KR", sans-serif;
  --co-font-body: "Noto Sans KR", "Pretendard", sans-serif;
  --co-font-mono: "IBM Plex Mono", "JetBrains Mono", monospace;

  --co-text-xs: 12px;
  --co-text-sm: 13px;
  --co-text-md: 14px;
  --co-text-lg: 16px;
  --co-text-xl: 20px;
  --co-text-2xl: 24px;

  --co-leading-tight: 1.25;
  --co-leading-normal: 1.5;
  --co-leading-loose: 1.65;
}
```

타이포 용도:
- KPI 값: `--co-text-2xl` + heading
- 섹션 제목: `--co-text-lg` + heading
- 본문/테이블: `--co-text-md` + body
- 메타/보조: `--co-text-sm` + body
- ID/시간축/기술값: mono

## 4) Spacing

4px 기반 scale을 고정해 sidepanel과 desktop 대시보드 사이의 밀도 차이를 제어한다.

```css
:root {
  --co-space-1: 4px;
  --co-space-2: 8px;
  --co-space-3: 12px;
  --co-space-4: 16px;
  --co-space-5: 20px;
  --co-space-6: 24px;
  --co-space-8: 32px;
  --co-space-10: 40px;
}
```

레이아웃 규칙:
- 카드 내부 패딩: desktop `--co-space-4`, sidepanel `--co-space-3`
- 섹션 간격: desktop `--co-space-6`, sidepanel `--co-space-4`
- 차트/표 블록 간격: `--co-space-4`

## 5) Motion

운영 화면 기준으로 짧고 의미 있는 전환만 허용한다.

```css
:root {
  --co-motion-fast: 120ms;
  --co-motion-base: 180ms;
  --co-motion-slow: 240ms;
  --co-ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --co-ease-enter: cubic-bezier(0.12, 0.85, 0.28, 1);
  --co-ease-exit: cubic-bezier(0.4, 0, 1, 1);
}
```

모션 정책:
- 허용: 필터 변경, 카드 상태 업데이트, 차트 시리즈 토글(opacity/색상 중심)
- 금지: 큰 scale bounce, parallax, 지속 반복 애니메이션
- 뷰 진입 시 최대 2개 그룹만 stagger 적용(간격 40ms)

Reduced motion:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

## 6) Charts

차트는 `KPI metric semantics` 기준으로 고정 매핑한다.

### 6.1 Metric-to-chart mapping (Implementation Contract)

| KPI/Metric | Contract Source | Primary Chart | Secondary | 이유/규칙 |
|---|---|---|---|---|
| `today_mail_count` trend | `kpis.today_mail_count` + 시계열 집계 | Line | Area (보조) | 추세 분석은 line 우선. 7/14일 비교선 허용 |
| `today_todo_count` trend | `kpis.today_todo_count` + 시계열 집계 | Line | Column | 업무량 증감 추세 확인 |
| `progress_status` (`open/in_progress/done`) | `kpis.progress_status` | Stacked Bar | Grouped Bar | 상태 비교는 stacked/grouped bar 고정 |
| `weekly_completed_count` trend | `kpis.weekly_completed_count` + 주간 시계열 | Line | Bar | 주간 완료 흐름 확인 |
| `top_counterparties` compare | `kpis.top_counterparties[]` | Grouped Bar | Horizontal Bar | 상대별 mail/todo 동시 비교 |
| Todo pipeline (derived) | work item status funnel | Funnel | Stacked Bar | `open -> in_progress -> done` 전환 병목 표시 |
| Evidence confidence distribution (derived) | `evidence.confidence` 분포 | Histogram | Box Plot | 신뢰도 분포 편향 감지 |

필수 고정 매핑(요구사항 반영):
- trend -> line
- status/category compare -> stacked/grouped bar
- pipeline -> funnel
- confidence distribution -> histogram

### 6.2 Chart data/interaction rules

- 축/단위 표기: 축 라벨, 단위(건, %)를 항상 표시한다.
- Tooltip: 날짜/필터/드릴다운 힌트를 포함한다.
- Drilldown 연결: 각 시리즈/막대/버킷 클릭 시 `search.query` 또는 `timeline.list` payload를 생성한다.
- 빈 데이터 상태: "데이터 없음" + 추천 액션(동기화/필터 초기화) 표시.

## 7) A11y (WCAG Guardrails)

- Contrast: 일반 텍스트 4.5:1 이상, 큰 텍스트 3:1 이상, 아이콘/경계 등 비텍스트 3:1 이상
- Focus-visible: 모든 인터랙션 요소에 `:focus-visible` 제공, outline 제거 금지
- Keyboard: Tab 순서가 시각 순서와 동일, keyboard trap 금지, Enter/Space 동작 지원
- Reflow: 320 CSS px에서 가로 스크롤 없이 핵심 정보 접근 가능
- Color-only 금지: 상태/경고 전달 시 텍스트 또는 아이콘 병행
- 상태 공지: 오류/성공 메시지는 `aria-live` 또는 `role="alert"`로 전달

## 8) Responsive Behavior

### 8.1 Sidepanel (운영 패널 기준)

- 단일 열(single-column), 단계적 공개(progressive disclosure)
- 카드 우선 순서: 인증/동기화 -> 핵심 KPI 요약 -> 상세 리스트
- 차트는 소형 sparkline/compact bar 중심, 복합 차트 최소화

### 8.2 Desktop Dashboard

- tri-pane 레이아웃: KPI/차트 영역 + 검색/타임라인 + 근거 상세 레일
- 폭 기준:
  - `>= 1280px`: 3열
  - `768px ~ 1279px`: 2열(근거 레일 collapse)
  - `<= 767px`: 1열(카드 스택, 필터 상단 고정)

## 9) Component-Level Rules (구현 지침)

- KPI 카드: 값/변화율/드릴다운 버튼 3영역 구조, hover scale 금지
- 표/리스트: 헤더 고정, 행 하이라이트는 배경색 변화만 사용
- 버튼: `primary`, `secondary`, `danger` 3종 의미 고정
- 입력요소: 최소 높이 36px(desktop), 34px(sidepanel)
- 아이콘: SVG(Lucide/Heroicons) 고정, emoji 아이콘 금지

## 10) Anti-patterns

1. 저대비 텍스트(`#94A3B8` 계열을 본문에 사용) 금지
2. 상태 표현을 빨강/초록 색상만으로 전달하는 방식 금지
3. 데이터 화면에서 장식성 그라디언트/유리 효과 과다 사용 금지
4. hover 시 layout shift(scale/translate로 행 높이 변경) 금지
5. 계약 필드명(`open`, `in_progress`, `done`)을 표시 라벨과 혼용해 번역 오염 유발 금지

## 11) Implementation Handoff Checklist

- 토큰은 CSS 변수 또는 theme object로 1:1 정의되었는가
- KPI별 차트 타입이 본 문서 매핑을 준수하는가
- drilldown payload 생성이 `dashboard-contract` 키와 정합한가
- `prefers-reduced-motion` 및 focus-visible 규칙이 구현되었는가
- 320px/768px/1024px/1440px에서 정보 접근성이 유지되는가
