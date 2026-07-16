// packages/image의 imgly.provider.ts가 onnxruntime-node를 동적 import하는데,
// 그 패키지는 이 pnpm 레이아웃에서 .d.ts를 실제로 배포하지 않는다. admin 앱의
// tsc는 워크스페이스 밖 파일(../../packages/image)의 ambient 선언을 자동으로
// 줍지 않으므로, 같은 선언을 admin 쪽에도 둔다.
declare module "onnxruntime-node";
